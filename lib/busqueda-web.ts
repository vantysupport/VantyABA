import 'server-only'
// Búsqueda en internet para ARIA, independiente del proveedor de IA: Tavily (web, TAVILY_API_KEY) y OpenAlex
// (artículos académicos, gratis y sin clave). El modelo que esté disponible (Groq o DeepInfra) redacta la
// respuesta con estos resultados.
// Privacidad: al buscador solo se envía la PREGUNTA, sin el contexto del paciente y sin nombres, correos,
// teléfonos ni números de documento (se quitan antes de enviar).

export type FuenteWeb = { titulo: string; url: string; extracto: string; tipo: 'web' | 'academica'; anio?: number | null }

const TIMEOUT_MS = 12_000
const MAX_EXTRACTO = 900

/** Quita de la pregunta nombres de personas conocidas y datos de contacto o identificación. */
export function limpiarConsulta(pregunta: string, nombres: (string | null | undefined)[] = []): string {
  let q = ` ${pregunta} `
  for (const nombre of nombres) {
    for (const parte of String(nombre || '').split(/\s+/).filter(p => p.length >= 3)) {
      const seguro = parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      q = q.replace(new RegExp(`(^|[^\\p{L}])${seguro}(?=[^\\p{L}]|$)`, 'giu'), '$1')
    }
  }
  return q
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, ' ')        // correos
    .replace(/\+?\d[\d\s-]{5,}\d/g, ' ')             // teléfonos, DNI y otros números largos
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 380)
}

async function tavily(consulta: string): Promise<FuenteWeb[]> {
  const key = process.env.TAVILY_API_KEY
  if (!key) return []
  const r = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: consulta, search_depth: 'basic', max_results: 5, include_answer: false, topic: 'general' }),
  })
  if (!r.ok) { console.warn('[busqueda-web] Tavily', r.status); return [] }
  const j = await r.json() as { results?: { title?: string; url?: string; content?: string }[] }
  return (j.results ?? []).filter(x => x.url).map(x => ({
    titulo: String(x.title || x.url), url: String(x.url), extracto: String(x.content || '').slice(0, MAX_EXTRACTO), tipo: 'web' as const,
  }))
}

// OpenAlex guarda el resumen como índice invertido { palabra: [posiciones] }
function resumenOpenAlex(indice: Record<string, number[]> | null | undefined): string {
  if (!indice) return ''
  const palabras: string[] = []
  for (const [palabra, posiciones] of Object.entries(indice)) for (const p of posiciones) palabras[p] = palabra
  return palabras.filter(Boolean).join(' ')
}

async function openAlex(consulta: string): Promise<FuenteWeb[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(consulta)}&per-page=3&filter=from_publication_date:2015-01-01,has_abstract:true`
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': 'VantyABA (mailto:vantysupport@gmail.com)' } })
  if (!r.ok) return []
  const j = await r.json() as { results?: { display_name?: string; doi?: string | null; id?: string; publication_year?: number; abstract_inverted_index?: Record<string, number[]> }[] }
  return (j.results ?? []).map(w => ({
    titulo: String(w.display_name || 'Artículo'),
    url: String(w.doi || w.id || ''),
    extracto: resumenOpenAlex(w.abstract_inverted_index).slice(0, MAX_EXTRACTO),
    tipo: 'academica' as const,
    anio: w.publication_year ?? null,
  })).filter(f => f.url && f.extracto)
}

/**
 * Busca en la web y en artículos académicos. Nunca lanza: si un buscador falla, se usan los demás.
 * `nombres`: nombres del paciente y su familia, que se quitan de la consulta antes de enviarla.
 */
export async function buscarEnInternet(pregunta: string, nombres: (string | null | undefined)[] = []): Promise<{ consulta: string; fuentes: FuenteWeb[] }> {
  const consulta = limpiarConsulta(pregunta, nombres)
  if (consulta.length < 4) return { consulta, fuentes: [] }
  const [web, academicas] = await Promise.all([
    tavily(consulta).catch(() => [] as FuenteWeb[]),
    openAlex(consulta).catch(() => [] as FuenteWeb[]),
  ])
  return { consulta, fuentes: [...web, ...academicas] }
}

/** Bloque de texto con las fuentes, para el contexto del modelo. */
export function fuentesComoContexto(fuentes: FuenteWeb[]): string {
  return fuentes.map((f, i) =>
    `[${i + 1}] ${f.tipo === 'academica' ? 'Artículo académico' : 'Web'}${f.anio ? ` (${f.anio})` : ''}: ${f.titulo}\nURL: ${f.url}\n${f.extracto}`,
  ).join('\n\n')
}

export const busquedaWebConfigurada = () => !!process.env.TAVILY_API_KEY
