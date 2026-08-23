export const maxDuration = 60

// Resumen clínico IA persistente del paciente.
//  - action 'generate': lee TODA la historia + RAG + protocolos UNA vez y produce
//    un resumen en prosa (caro, se usa poco).
//  - action 'update':   toma el resumen actual + el contenido nuevo (un reporte/sesión)
//    y lo fusiona SIN releer todo (barato — este es el ahorro de tokens).
//  - action 'save':     guarda una edición manual del especialista.
// Se guarda en children.ai_summary y se usa luego como contexto compacto para la IA.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildAIContext } from '@/lib/ai-context-builder'
import { callGroqSimple, GROQ_MODELS, GroqExhaustedError } from '@/lib/groq-client'
import { getLangInstruction } from '@/lib/lang'

const SYSTEM = 'Eres una neuropsicóloga clínica del Centro SANTI, experta en ABA, TEA, TDAH y neurodesarrollo infantil. Escribes resúmenes clínicos claros, precisos y bien redactados para el equipo terapéutico.'

// Prosa concisa: ~250-400 palabras, secciones cortas en negrita, SIN tablas ni <br>.
const FORMATO = `
FORMATO DEL RESUMEN (obligatorio):
- Prosa clínica clara y bien redactada, máximo ~350 palabras.
- Organiza en 4 bloques cortos con estos títulos en negrita: **Perfil general**, **Fortalezas**, **Áreas de trabajo**, **Progreso y recomendaciones**.
- Cada bloque: 2-4 oraciones. Concreto, sin relleno, sin repetir datos crudos innecesarios.
- PROHIBIDO: tablas markdown ( | col | ), etiquetas HTML (<br>), listas larguísimas. Usa viñetas "• " solo si es imprescindible.
- No inventes datos: usa solo lo que aparezca en el contexto.`

async function guardar(childId: string, summary: string, source: string) {
  await supabaseAdmin.from('children').update({
    ai_summary: summary,
    ai_summary_updated_at: new Date().toISOString(),
    ai_summary_source: source,
  }).eq('id', childId)
}

export async function GET(req: NextRequest) {
  const childId = new URL(req.url).searchParams.get('childId')
  if (!childId) return NextResponse.json({ error: 'childId requerido' }, { status: 400 })
  const { data } = await supabaseAdmin
    .from('children').select('ai_summary, ai_summary_updated_at, ai_summary_source').eq('id', childId).maybeSingle()
  return NextResponse.json({
    summary: (data as any)?.ai_summary || '',
    updatedAt: (data as any)?.ai_summary_updated_at || null,
    source: (data as any)?.ai_summary_source || null,
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { childId, action = 'generate', newContent = '', summary: manualSummary = '' } = body
    const userLocale = body.locale || req.headers.get('x-locale') || 'es'
    if (!childId) return NextResponse.json({ error: 'childId requerido' }, { status: 400 })

    // ── Edición manual: guardar verbatim ──────────────────────────────────────
    if (action === 'save') {
      await guardar(childId, String(manualSummary || ''), 'manual')
      return NextResponse.json({ summary: String(manualSummary || ''), source: 'manual' })
    }

    const { data: child } = await supabaseAdmin
      .from('children').select('name, ai_summary').eq('id', childId).maybeSingle()
    const nombre = (child as any)?.name || 'el/la paciente'
    const actual = (child as any)?.ai_summary || ''

    // ── Actualización incremental: resumen actual + contenido nuevo ────────────
    // NO relee toda la historia → gasta pocos tokens.
    if (action === 'update' && actual.trim() && String(newContent).trim()) {
      const prompt = `Este es el RESUMEN CLÍNICO ACTUAL de ${nombre}:
"""
${actual}
"""

Acaba de registrarse esta información NUEVA del paciente:
"""
${String(newContent).slice(0, 4000)}
"""

Actualiza el resumen integrando SOLO lo relevante de la información nueva (progresos, cambios, nuevas áreas o logros). Mantén todo lo que siga vigente del resumen actual, corrige lo que haya cambiado y NO alargues de más: sigue siendo un resumen conciso.
${FORMATO}` + getLangInstruction(userLocale)

      const out = await callGroqSimple(SYSTEM, prompt, { model: GROQ_MODELS.SMART, temperature: 0.4, maxTokens: 900 })
      const texto = (out || '').replace(/```/g, '').trim()
      if (!texto) return NextResponse.json({ error: 'La IA no devolvió resumen' }, { status: 502 })
      await guardar(childId, texto, 'ia_update')
      return NextResponse.json({ summary: texto, source: 'ia_update' })
    }

    // ── Generación completa: lee TODO el expediente + RAG una vez ──────────────
    const ctx = await buildAIContext(childId, undefined, undefined, `resumen perfil clínico ${nombre} ABA TEA TDAH neurodesarrollo`)
    const prompt = `Genera el RESUMEN CLÍNICO INTEGRAL de ${nombre} a partir de TODO su expediente (historia clínica, evaluaciones, sesiones ABA, entorno y conocimiento clínico del centro):

${ctx.fullContext || '(Sin datos registrados todavía)'}
${FORMATO}` + getLangInstruction(userLocale)

    const out = await callGroqSimple(SYSTEM, prompt, { model: GROQ_MODELS.SMART, temperature: 0.5, maxTokens: 1100 })
    const texto = (out || '').replace(/```/g, '').trim()
    if (!texto) return NextResponse.json({ error: 'La IA no devolvió resumen' }, { status: 502 })
    await guardar(childId, texto, 'ia_full')
    return NextResponse.json({ summary: texto, source: 'ia_full' })

  } catch (e: any) {
    if (e instanceof GroqExhaustedError) {
      return NextResponse.json({ error: e.isPerMinute
        ? 'ARIA está muy solicitada ahora. Intenta en unos segundos.'
        : 'ARIA alcanzó su límite de uso por hoy. Estará disponible nuevamente mañana.' }, { status: 429 })
    }
    return NextResponse.json({ error: process.env.NODE_ENV === 'production' ? 'Ocurrió un error. Intenta de nuevo.' : e.message }, { status: 500 })
  }
}
