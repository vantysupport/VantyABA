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
import { getApiCaller, hasRole, canAccessChild, ROLES, unauthorized, forbidden, notFound } from '@/lib/api-auth'

const SYSTEM = 'Eres una neuropsicóloga clínica, experta en ABA, TEA, TDAH y neurodesarrollo infantil. Escribes resúmenes clínicos claros, precisos y bien redactados para el equipo terapéutico.'

// Prosa concisa: ~250-400 palabras, secciones cortas en negrita, SIN tablas ni <br>.
const FORMATO = `
FORMATO DEL RESUMEN (obligatorio):
- Prosa clínica clara y bien redactada, máximo ~350 palabras.
- Organiza en 4 bloques cortos con estos títulos en negrita: **Perfil general**, **Fortalezas**, **Áreas de trabajo**, **Progreso y recomendaciones**.
- Cada bloque: 2-4 oraciones. Concreto, sin relleno, sin repetir datos crudos innecesarios.
- PROHIBIDO: tablas markdown ( | col | ), etiquetas HTML (<br>), listas larguísimas. Usa viñetas "• " solo si es imprescindible.
- No inventes datos: usa solo lo que aparezca en el contexto.`

async function guardar(childId: string, summary: string, source: string, lang: string) {
  await supabaseAdmin.from('children').update({
    ai_summary: summary,
    ai_summary_updated_at: new Date().toISOString(),
    ai_summary_source: source,
    ai_summary_lang: lang === 'en' ? 'en' : 'es',
  }).eq('id', childId)
}

export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  const childId = new URL(req.url).searchParams.get('childId')
  if (!childId) return NextResponse.json({ error: 'childId requerido' }, { status: 400 })
  if (!(await canAccessChild(caller, childId))) return notFound()
  const { data } = await supabaseAdmin
    .from('children').select('ai_summary, ai_summary_updated_at, ai_summary_source, ai_summary_lang').eq('id', childId).maybeSingle()
  return NextResponse.json({
    summary: (data as any)?.ai_summary || '',
    updatedAt: (data as any)?.ai_summary_updated_at || null,
    source: (data as any)?.ai_summary_source || null,
    lang: (data as any)?.ai_summary_lang || null,
  })
}

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const body = await req.json()
    const { childId, action = 'generate', newContent = '', summary: manualSummary = '' } = body
    const userLocale = body.locale || req.headers.get('x-locale') || 'es'
    if (!childId) return NextResponse.json({ error: 'childId requerido' }, { status: 400 })
    if (!(await canAccessChild(caller, childId))) return notFound()

    // ── Edición manual: guardar verbatim ──────────────────────────────────────
    if (action === 'save') {
      await guardar(childId, String(manualSummary || ''), 'manual', userLocale)
      return NextResponse.json({ summary: String(manualSummary || ''), source: 'manual', lang: userLocale === 'en' ? 'en' : 'es' })
    }

    const { data: child } = await supabaseAdmin
      .from('children').select('name, ai_summary').eq('id', childId).maybeSingle()
    const nombre = (child as any)?.name || 'el/la paciente'
    const actual = (child as any)?.ai_summary || ''

    // ── Traducir el resumen existente al idioma actual (barato, sin releer nada) ──
    if (action === 'translate' && actual.trim()) {
      const prompt = `Traduce el siguiente RESUMEN CLÍNICO al ${userLocale === 'en' ? 'INGLÉS' : 'ESPAÑOL'} profesional, manteniendo EXACTAMENTE el mismo formato (títulos en **negrita**, párrafos, viñetas) y el mismo contenido clínico. No agregues ni quites información, solo traduce.\n\n"""\n${actual}\n"""` + getLangInstruction(userLocale)
      const out = await callGroqSimple(SYSTEM, prompt, { model: GROQ_MODELS.SMART, temperature: 0.2, maxTokens: 1100 })
      const texto = (out || '').replace(/```/g, '').trim()
      if (!texto) return NextResponse.json({ error: 'La IA no devolvió traducción' }, { status: 502 })
      await guardar(childId, texto, 'manual', userLocale)
      return NextResponse.json({ summary: texto, source: 'translate', lang: userLocale === 'en' ? 'en' : 'es' })
    }

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
      await guardar(childId, texto, 'ia_update', userLocale)
      return NextResponse.json({ summary: texto, source: 'ia_update', lang: userLocale === 'en' ? 'en' : 'es' })
    }

    // ── Generación completa: lee el expediente + RAG una vez ──────────────────
    // Para pacientes con MUCHOS datos el expediente completo excede el límite de
    // tokens del modelo (429/413). Acotamos: priorizamos la historia clínica del
    // paciente (que suele venir con lo más reciente primero) y un poco del centro,
    // y dejamos fuera el RAG pesado. El resultado se mantiene actualizado luego con
    // las actualizaciones incrementales.
    const ctx = await buildAIContext(childId, undefined, undefined, '', caller.centroId)
    const HIST_MAX = 13000   // ~3200 tokens
    const centro = (ctx.centroContext || '').slice(0, 1200)
    const hist = (ctx.historialTexto || '').slice(0, HIST_MAX)
    const truncNota = (ctx.historialTexto || '').length > HIST_MAX
      ? '\n[…expediente extenso: se resumió a partir de los registros más recientes/relevantes]' : ''
    const contexto = [centro, hist].filter(Boolean).join('\n\n') + truncNota

    const prompt = `Genera el RESUMEN CLÍNICO INTEGRAL de ${nombre} a partir de su expediente (historia clínica, evaluaciones, sesiones ABA, entorno):

${contexto || '(Sin datos registrados todavía)'}
${FORMATO}` + getLangInstruction(userLocale)

    const out = await callGroqSimple(SYSTEM, prompt, { model: GROQ_MODELS.SMART, temperature: 0.5, maxTokens: 1100 })
    const texto = (out || '').replace(/```/g, '').trim()
    if (!texto) return NextResponse.json({ error: 'La IA no devolvió resumen' }, { status: 502 })
    await guardar(childId, texto, 'ia_full', userLocale)
    return NextResponse.json({ summary: texto, source: 'ia_full', lang: userLocale === 'en' ? 'en' : 'es' })

  } catch (e: any) {
    if (e instanceof GroqExhaustedError) {
      return NextResponse.json({ error: e.isPerMinute
        ? 'ARIA está muy solicitada ahora. Intenta en unos segundos.'
        : 'ARIA alcanzó su límite de uso por hoy. Estará disponible nuevamente mañana.' }, { status: 429 })
    }
    return NextResponse.json({ error: process.env.NODE_ENV === 'production' ? 'Ocurrió un error. Intenta de nuevo.' : e.message }, { status: 500 })
  }
}
