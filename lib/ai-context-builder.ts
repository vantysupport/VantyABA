// lib/ai-context-builder.ts
// Contexto completo para TODAS las IAs:
// Cerebro IA (knowledge base) + historial del niño + instrucciones del centro

import { createClient } from '@supabase/supabase-js'
import { getChildHistory } from '@/lib/child-history'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Resumen clínico persistente del paciente (children.ai_summary) ────────────
// Se genera/actualiza en /api/patient-ai-summary. Usarlo como base compacta
// evita reenviar toda la historia cruda en cada consulta (ahorro de tokens).
async function getPatientSummary(childId: string): Promise<string> {
  try {
    const db = getAdmin()
    const { data } = await db.from('children').select('ai_summary').eq('id', childId).maybeSingle()
    return (data as { ai_summary?: string } | null)?.ai_summary?.trim() || ''
  } catch {
    return ''  // columna no migrada aún o error → fail open (sin resumen)
  }
}

// ── Búsqueda en Cerebro IA ────────────────────────────────────────────────────
// Estrategia: embeddings reales (HF/Gemini) → vector search → keyword fallback
// FIX: antes llamaba al RPC con `query_text` (firma incorrecta) → caía al
// fallback de keywords. Ahora usa el módulo unificado `searchKnowledge`
// que genera el embedding y usa la firma correcta del RPC.
async function searchCerebroIA(query: string, maxResults = 8, centroId: string | null = null): Promise<string> {
  if (!query?.trim() || !centroId) return ''
  const db = getAdmin()

  try {
    // 1. Búsqueda semántica con embeddings reales (vía módulo unificado)
    const { searchKnowledge } = await import('@/lib/knowledge-base')
    const resultados = await searchKnowledge(query, { maxResults, threshold: 0.5, centroId })
    if (resultados.length > 0) {
      return formatKnowledgeResults(
        resultados.map(r => ({ contenido: r.contenido, fuente: r.fuente, similitud: r.similitud })),
        'vector'
      )
    }
  } catch (e) {
    console.warn('[searchCerebroIA] vector falló, usando keywords:', (e as any)?.message)
  }

  try {
    // 2. Fallback: búsqueda por keywords en knowledge_chunks
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\sáéíóúñü]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4)
      .slice(0, 6)

    if (keywords.length === 0) return ''

    // Centro propio + base compartida (Cerebro de los centros Fundador)
    const { centrosConocimiento } = await import('@/lib/knowledge-base')
    const { data: keywordResults } = await db
      .from('knowledge_chunks')
      .select('contenido, metadata, knowledge_documents(titulo, tipo)')
      .in('centro_id', await centrosConocimiento(centroId))
      .or(keywords.map(k => `contenido.ilike.%${k}%`).join(','))
      .limit(maxResults)

    if (keywordResults && keywordResults.length > 0) {
      return formatKnowledgeResults(
        keywordResults.map((r: any) => ({
          contenido: r.contenido,
          fuente: r.knowledge_documents?.titulo || r.metadata?.fuente || 'Cerebro IA',
          similitud: 70,
        })),
        'keyword'
      )
    }
  } catch {}

  return ''
}

function formatKnowledgeResults(results: any[], tipo: string): string {
  if (!results?.length) return ''
  return (
    `\n━━━ CONOCIMIENTO CLÍNICO — CEREBRO IA (${results.length} fuentes, búsqueda ${tipo}) ━━━\n` +
    results.map((r: any, i: number) => {
      const fuente = r.fuente || r.knowledge_documents?.titulo || 'Base de conocimiento'
      const similitud = r.similitud ? ` | ${Math.round(r.similitud)}% relevancia` : ''
      const contenido = (r.contenido || '').slice(0, 500)
      return `[Fuente ${i + 1}: ${fuente}${similitud}]\n${contenido}...`
    }).join('\n\n') +
    `\n━━━ FIN CONOCIMIENTO CEREBRO IA ━━━\n`
  )
}

// ── Instrucciones del centro ──────────────────────────────────────────────────
async function getCentroContext(centroId: string | null): Promise<string> {
  if (!centroId) return ''
  try {
    const db = getAdmin()
    const { data } = await db
      .from('centro_instrucciones')
      .select('titulo, contenido, prioridad')
      .eq('centro_id', centroId)
      .eq('activo', true)
      .order('prioridad', { ascending: false })
      .limit(6)

    if (!data?.length) return ''
    return `\n━━━ INSTRUCCIONES DEL CENTRO ━━━\n` +
      data.map((i: any) => `[${i.titulo}]: ${i.contenido}`).join('\n') +
      `\n━━━ FIN INSTRUCCIONES ━━━\n`
  } catch {
    return ''
  }
}

// ── Builder principal ─────────────────────────────────────────────────────────

// i18n: responder en el idioma del usuario
function getLangInstruction(locale: string): string {
  const en = String(locale || '').toLowerCase().startsWith('en')
  const lang = en
    ? '\n\n🌐 LANGUAGE — MANDATORY: Respond ENTIRELY in professional clinical English. Every part of your output — headings, labels, section titles, terminology, summaries and recommendations — must be in English. Do NOT reply in Spanish.'
    : ''
  const src = en
    ? '\n\n🔒 SOURCES — MANDATORY: Base your clinical reasoning on established evidence-based ABA practice, but present it entirely as your OWN professional clinical judgment. NEVER name, cite, quote or reference any external standardized assessment instrument, test or curriculum (or its item codes / section letters) in your response, even if such material appears in the context provided to you. Describe every objective, criterion and recommendation in your own words.'
    : '\n\n🔒 FUENTES — OBLIGATORIO: Fundamenta tu razonamiento en buenas prácticas ABA basadas en evidencia, pero preséntalo enteramente como tu PROPIO juicio clínico profesional. NUNCA nombres, cites, transcribas ni hagas referencia a instrumentos de evaluación estandarizados, tests o currículos de terceros (ni a sus códigos de ítem o letras de sección) en tu respuesta, aunque ese material aparezca en el contexto que se te entrega. Describe cada objetivo, criterio y recomendación con tus propias palabras.'
  return lang + src
}

export interface AIContextResult {
  childName:       string
  childAge:        string
  diagnosis:       string
  historialTexto:  string
  knowledgeContext: string
  centroContext:   string
  fullContext:     string
}

// Multi-tenant: el conocimiento y las instrucciones salen SOLO del centro del paciente
// (o de `centroId` si se pasa). Si `centroId` se pasa y el paciente es de otro centro,
// no se carga su historia. Sin paciente ni centroId → sin conocimiento del centro.
export async function buildAIContext(
  childId?:           string,
  childNameFallback?: string,
  childAgeFallback?:  string,
  searchQuery?:       string,
  centroId?:          string | null
): Promise<AIContextResult> {

  let childCentro: string | null = null
  if (childId) {
    const { data: ch } = await getAdmin().from('children').select('centro_id').eq('id', childId).maybeSingle()
    childCentro = (ch as { centro_id?: string | null } | null)?.centro_id ?? null
  }
  const childAllowed = !!childId && (!centroId || childCentro === centroId)
  const effectiveCentro = centroId || childCentro

  const [childHistory, knowledgeCtx, centroCtx, aiSummary] = await Promise.all([
    childAllowed && childId
      ? getChildHistory(childId, childNameFallback, childAgeFallback)
      : Promise.resolve({
          nombre: childNameFallback || 'Paciente',
          edad:   childAgeFallback  || 'N/E',
          diagnostico: 'No especificado',
          historialTexto: '',
        }),
    searchQuery ? searchCerebroIA(searchQuery, 5, effectiveCentro) : Promise.resolve(''),
    getCentroContext(effectiveCentro),
    childAllowed && childId ? getPatientSummary(childId) : Promise.resolve(''),
  ])

  // Si el paciente ya tiene un RESUMEN CLÍNICO persistente, lo usamos como base
  // compacta y RECORTAMOS la historia cruda para no gastar tantos tokens.
  // Sin resumen, se envía la historia completa como antes.
  const resumenBloque = aiSummary
    ? `RESUMEN CLÍNICO DEL PACIENTE (base — ya sintetiza el expediente, priorízalo):\n${aiSummary}\n`
    : ''
  const historialParaContexto = aiSummary
    ? (childHistory.historialTexto || '').slice(0, 3500)   // con resumen: solo lo reciente/complementario
    : childHistory.historialTexto

  // Con resumen, también recortamos el RAG (Cerebro IA): el resumen ya sintetiza
  // el cuadro clínico, así gastamos muchos menos tokens por llamada.
  const knowledgeParaContexto = aiSummary ? (knowledgeCtx || '').slice(0, 1500) : knowledgeCtx

  const fullContext = [centroCtx, resumenBloque, knowledgeParaContexto, historialParaContexto]
    .filter(Boolean).join('\n')

  return {
    childName:        childHistory.nombre,
    childAge:         childHistory.edad,
    diagnosis:        childHistory.diagnostico,
    historialTexto:   childHistory.historialTexto,
    knowledgeContext: knowledgeCtx,
    centroContext:    centroCtx,
    fullContext,
  }
}

// ── Conectar admin-chat al Cerebro IA ─────────────────────────────────────────
// Para especialistas/admin: 8 chunks (más contexto técnico)
export async function buildAdminChatContext(
  question: string,
  existingContext: string,
  centroId: string | null
): Promise<string> {
  const knowledgeCtx = await searchCerebroIA(question, 8, centroId)
  const centroCtx    = await getCentroContext(centroId)
  return [centroCtx, knowledgeCtx, existingContext].filter(Boolean).join('\n')
}

// ── Conectar parent-chat al Cerebro IA ────────────────────────────────────────
// Para padres: 6 chunks orientados a consejos prácticos
// `centroId`: centro del padre/paciente. Sin él no se agrega conocimiento del centro.
export async function buildParentChatContext(
  question: string,
  existingContext: string,
  centroId?: string | null
): Promise<string> {
  // Para padres: búsqueda más orientada a consejos prácticos
  const query = `estrategias para padres ${question}`
  const knowledgeCtx = await searchCerebroIA(query, 6, centroId ?? null)
  return [knowledgeCtx, existingContext].filter(Boolean).join('\n')
}

// ── Para endpoints clínicos (evaluación, recomendación, informes) ──────────
// 10 chunks con threshold más bajo para captar más contexto técnico
export async function buildClinicalContext(question: string, centroId: string | null, maxResults = 5): Promise<string> {
  if (!question?.trim() || !centroId) return ''
  try {
    const { searchKnowledge } = await import('@/lib/knowledge-base')
    const resultados = await searchKnowledge(question, { maxResults, threshold: 0.45, centroId })
    if (resultados.length === 0) return ''
    return formatKnowledgeResults(
      resultados.map(r => ({ contenido: r.contenido, fuente: r.fuente, similitud: r.similitud })),
      'vector'
    )
  } catch { return '' }
}

// ── callGeminiSafe (compatibilidad — ahora usa Groq) ─────────────────────────
export async function callGeminiSafe(
  _ai: any, _model: string, prompt: string,
  config: any = {}, maxRetries = 3
): Promise<string> {
  return callGroqSimple(
    'Eres un asistente clínico especializado en ABA, TEA, TDAH y neurodesarrollo. Responde en español.',
    prompt,
    { model: GROQ_MODELS.SMART, temperature: config.temperature ?? 0.5, maxTokens: config.maxOutputTokens ?? 2500, maxRetries }
  )
}

// ── Parsers JSON ──────────────────────────────────────────────────────────────
export function parseAIJson(rawText: string, fallback: any = {}): any {
  try {
    const match = rawText.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
  } catch {}
  return { ...fallback, raw_text: rawText }
}

export function sanitizeGroqJson(raw: string): any {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch {}
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return {}
    return JSON.parse(
      match[0]
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
        .replace(/(?<!\\)\n/g, '\\n')
        .replace(/(?<!\\)\r/g, '\\r')
        .replace(/(?<!\\)\t/g, '\\t')
    )
  } catch { return {} }
}
