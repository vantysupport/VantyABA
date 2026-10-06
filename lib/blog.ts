// Blog público de Vanty ABA: tipos, categorías y utilidades compartidas entre las páginas públicas (/blog)
// y el editor de /control. Los artículos viven en public.blog_articulos (supabase/migrations/0053_blog.sql).

export type EstadoArticulo = 'borrador' | 'publicado'

export type Articulo = {
  id: string
  slug: string
  titulo: string
  resumen: string
  contenido: string
  portada_url: string | null
  portada_alt: string | null
  categoria: string
  etiquetas: string[]
  autor_nombre: string
  estado: EstadoArticulo
  destacado: boolean
  publicado_en: string | null
  seo_titulo: string | null
  seo_descripcion: string | null
  created_at: string
  updated_at: string
}

/** Columnas para listados (sin el contenido completo). */
export const COLUMNAS_LISTA = 'id, slug, titulo, resumen, portada_url, portada_alt, categoria, etiquetas, autor_nombre, estado, destacado, publicado_en, contenido, updated_at'

export const CATEGORIAS = [
  { id: 'noticias', es: 'Noticias', en: 'News' },
  { id: 'producto', es: 'Novedades de Vanty', en: 'Product updates' },
  { id: 'aba', es: 'Terapia ABA', en: 'ABA therapy' },
  { id: 'familias', es: 'Familias', en: 'Families' },
  { id: 'centros', es: 'Gestión de centros', en: 'Running a center' },
  { id: 'eventos', es: 'Eventos', en: 'Events' },
] as const

export function nombreCategoria(id: string, en: boolean): string {
  const c = CATEGORIAS.find(x => x.id === id)
  return c ? (en ? c.en : c.es) : id
}

/** Minutos de lectura a ~200 palabras por minuto (mínimo 1). */
export function minutosLectura(contenido: string): number {
  const palabras = contenido.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(palabras / 200))
}

/** "Hola, ¿qué tal? Año 2026" → "hola-que-tal-ano-2026" */
export function slugDe(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90).replace(/-+$/, '')
}

export function fechaLarga(iso: string | null, en: boolean): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(en ? 'en-US' : 'es-PE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Lima' })
}

/** Id de ancla para un título (## Mi sección → mi-seccion). */
export const anclaDe = (texto: string) => slugDe(texto.replace(/[*_`[\]]/g, '')) || 'seccion'

/** Títulos de segundo nivel del artículo, para el índice lateral. */
export function indiceDe(contenido: string): { id: string; texto: string }[] {
  const vistos = new Map<string, number>()
  return contenido.split('\n').filter(l => /^##\s+/.test(l) && !/^###/.test(l)).map(l => {
    const texto = l.replace(/^##\s+/, '').replace(/[*_`]/g, '').trim()
    const base = anclaDe(texto)
    const n = vistos.get(base) ?? 0
    vistos.set(base, n + 1)
    return { id: n ? `${base}-${n + 1}` : base, texto }
  })
}
