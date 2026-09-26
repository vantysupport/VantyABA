export const maxDuration = 60;

// app/api/engagement-padres/route.ts
// 👨‍👩‍👧 Módulo de Engagement para Padres
// Genera planes semanales personalizados de actividades en casa
// ajustados por IA según el progreso real del niño

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { getApiCaller, canAccessChild, unauthorized, notFound } from '@/lib/api-auth'
import { puedeGenerarPractica, consumirPractica } from '@/lib/tokens-padres'


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

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  try {
    const body = await req.json()
    const { childId, accion = 'generar_plan', locale = 'es' } = body
    // accion: 'generar_plan' | 'registrar_actividad' | 'obtener_historial'

    if (!childId) return NextResponse.json({ error: 'childId requerido' }, { status: 400 })
    if (!(await canAccessChild(caller, childId))) return notFound()

    if (accion === 'registrar_actividad') {
      const { actividadId, completada, nota } = body
      const { error } = await supabaseAdmin
        .from('engagement_actividades')
        .update({ completada, nota_padre: nota, fecha_completada: new Date().toISOString() })
        .eq('id', actividadId)
        .eq('child_id', childId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (accion === 'actualizar_completadas') {
      const { planId, actividades, completadas_pct } = body
      if (!planId) return NextResponse.json({ error: 'planId requerido' }, { status: 400 })
      // Solo se copia el estado "hecha" por posición: el cliente puede estar viendo una
      // traducción y no debe sobrescribir el texto original del plan.
      const { data: actual } = await supabaseAdmin.from('engagement_planes').select('actividades').eq('id', planId).eq('child_id', childId).maybeSingle()
      const originales: any[] = Array.isArray(actual?.actividades) ? actual!.actividades : []
      const marcadas = originales.map((a, i) => ({ ...a, completada: !!(actividades as any[])?.[i]?.completada }))
      const { error } = await supabaseAdmin
        .from('engagement_planes')
        .update({ actividades: marcadas, completadas_pct })
        .eq('id', planId)
        .eq('child_id', childId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // Tokens de familia: cada padre genera un número de planes al mes según el plan del centro
    const esPadre = caller.role === 'padre'
    if (esPadre) {
      const t = await puedeGenerarPractica(caller.id, caller.centroId)
      if (!t.ok) {
        const en = locale === 'en'
        return NextResponse.json({
          code: 'tokens_padre',
          usados: t.usados, max: t.max,
          error: en
            ? `You have used your ${t.max} practice plans for this month. New ones will be available next month.`
            : `Ya usaste tus ${t.max} planes de práctica de este mes. Tendrás nuevos el próximo mes.`,
        }, { status: 402 })
      }
    }

    // Cargar datos del niño
    const { data: child } = await supabaseAdmin
      .from('children')
      .select('name, age, diagnosis, centro_id')
      .eq('id', childId)
      .single()

    const childName = (child as any)?.name || 'el paciente'
    const diagnostico = (child as any)?.diagnosis || 'TEA'

    // Cargar últimas sesiones para contexto
    const { data: sesiones } = await supabaseAdmin
      .from('registro_aba')
      .select('datos, fecha_sesion')
      .eq('child_id', childId)
      .order('fecha_sesion', { ascending: false })
      .limit(5)

    // Cargar programas activos
    const { data: programas } = await supabaseAdmin
      .from('programas_aba')
      .select('titulo, area, fase_actual, objetivos_cp(nombre, estado)')
      .eq('child_id', childId)
      .in('estado', ['activo', 'intervencion'])
      .limit(5)

    // Cargar engagement previo para continuidad
    const { data: engagementPrevio } = await supabaseAdmin
      .from('engagement_planes')
      .select('semana, actividades, completadas_pct')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(3)

    const contextoPrevio = engagementPrevio && engagementPrevio.length > 0
      ? `Semanas anteriores: ${engagementPrevio.map((e: any) => `semana ${e.semana}: ${e.completadas_pct || 0}% completado`).join(', ')}`
      : 'Primera semana del programa'

    const resumenSesiones = sesiones && sesiones.length > 0
      ? sesiones.slice(0, 3).map((s: any) => {
          const d = s.datos || {}
          return `Sesión ${new Date(s.fecha_sesion).toLocaleDateString('es-ES')}: objetivo=${d.objetivo_principal || 'N/A'}, logro=${d.porcentaje_exito || 'N/A'}%`
        }).join('\n')
      : 'Sin sesiones recientes'

    const resumenProgramas = programas && programas.length > 0
      ? programas.map((p: any) => `${p.area}: ${p.titulo} (fase: ${p.fase_actual})`).join(', ')
      : 'Sin programas activos'

    const localeNames: Record<string,string> = { es:'español', en:'English', pt:'português', fr:'français', de:'Deutsch', it:'italiano' }
    const langInstruction = locale !== 'es' ? `\n\n[RESPONDE OBLIGATORIAMENTE EN: ${localeNames[locale] || 'español'}]` : ''
    const prompt = `Eres un especialista en ABA y participación familiar. IMPORTANTE: Estas actividades deben reforzar EN CASA los objetivos del programa ABA diseñado por el terapeuta. NO inventes objetivos nuevos. Basate ESTRICTAMENTE en los programas activos.

Genera actividades de refuerzo en casa para los padres de ${childName} (${diagnostico}), siguiendo el programa terapéutico del especialista.

CONTEXTO CLÍNICO:
- Programas activos: ${resumenProgramas}
- Últimas sesiones:
${resumenSesiones}
- ${contextoPrevio}

OBJETIVO: Crear actividades en casa que REFUERCEN lo trabajado en terapia, sean REALIZABLES (15-20 min/día), y aumenten la PARTICIPACIÓN de los padres.

INSTRUCCIONES:
- Genera exactamente 5 actividades para esta semana
- Cada actividad debe tener: titulo, descripcion (2-3 oraciones), duracion_minutos (10-20), dificultad (facil/media/alta), area (comunicacion/conducta/habilidades/socializacion/autonomia), materiales_necesarios (lista simple), por_que_importa (1 oración que conecta con la terapia)
- Las actividades deben ser CONCRETAS y ESPECÍFICAS, no genéricas
- Incluye variedad de áreas
- Considera el nivel actual del niño según las sesiones

Responde ÚNICAMENTE con JSON válido, sin markdown, sin explicaciones:
{
  "semana": "Semana del [fecha inicio] al [fecha fin]",
  "mensaje_motivacional": "Mensaje cálido de 1-2 oraciones para los padres",
  "actividades": [
    {
      "titulo": "",
      "descripcion": "",
      "duracion_minutos": 15,
      "dificultad": "facil",
      "area": "comunicacion",
      "materiales_necesarios": ["item1", "item2"],
      "por_que_importa": "",
      "dias_recomendados": ["lunes", "miercoles", "viernes"]
    }
  ]
}`

    const respuestaRaw = await callGroqSimple('', prompt, { model: GROQ_MODELS.SMART, temperature: 0.6, maxTokens: 2000 })

    let plan: any
    try {
      const clean = respuestaRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      plan = JSON.parse(clean)
    } catch {
      throw new Error('La IA no generó un plan válido')
    }

    // Guardar el plan en Supabase — UPSERT manual (no requiere unique constraint
    // en la DB). Antes usábamos .upsert() con onConflict, pero rompía si la tabla
    // no tenía el índice único correspondiente.
    const semanaNum = getWeekNumber(new Date())
    const anio = new Date().getFullYear()

    const payload = {
      child_id: childId,
      centro_id: (child as any)?.centro_id,
      semana: semanaNum,
      anio,
      actividades: plan.actividades,
      mensaje_motivacional: plan.mensaje_motivacional,
      completadas_pct: 0,
      idioma: String(locale).toLowerCase().startsWith('en') ? 'en' : 'es',
      traducciones: {},
    }

    // 1. ¿Ya existe un plan para esta (child_id, semana, anio)?
    const { data: existente } = await supabaseAdmin
      .from('engagement_planes')
      .select('id')
      .eq('child_id', childId)
      .eq('semana', semanaNum)
      .eq('anio', anio)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let planGuardado: any = null
    let saveErr: any = null

    if (existente?.id) {
      // UPDATE — sobrescribir el plan existente
      const { data, error } = await supabaseAdmin
        .from('engagement_planes')
        .update(payload)
        .eq('id', existente.id)
        .select()
        .single()
      planGuardado = data; saveErr = error
    } else {
      // INSERT — primera vez para esta semana
      const { data, error } = await supabaseAdmin
        .from('engagement_planes')
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select()
        .single()
      planGuardado = data; saveErr = error
    }

    if (saveErr) {
      console.error('[engagement-padres] save failed:', saveErr)
      return NextResponse.json({
        error: `No se pudo guardar el plan: ${saveErr.message}. Reintentá en unos segundos.`,
      }, { status: 500 })
    }

    if (esPadre) await consumirPractica(caller.id, caller.centroId)

    return NextResponse.json({
      success: true,
      plan: {
        ...plan,
        semana_num: semanaNum,
        id: (planGuardado as any)?.id,
        child_name: childName,
      }
    })

  } catch (e: any) {
    console.error('Error engagement-padres:', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const childId = searchParams.get('child_id')
  if (!childId) return NextResponse.json({ error: 'child_id requerido' }, { status: 400 })
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!(await canAccessChild(caller, childId))) return notFound()

  const semanaNum = getWeekNumber(new Date())
  const anio = new Date().getFullYear()

  // 1. Intentar plan de la semana en curso
  const { data: planSemanaActual } = await supabaseAdmin
    .from('engagement_planes')
    .select('*')
    .eq('child_id', childId)
    .eq('semana', semanaNum)
    .eq('anio', anio)
    .maybeSingle()

  // 2. Fallback: si no hay plan de esta semana, traer el más reciente
  //    (cubre cambios de semana naturales que no deberían borrar el plan visible)
  let plan = planSemanaActual
  if (!plan) {
    const { data: planReciente } = await supabaseAdmin
      .from('engagement_planes')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    plan = planReciente
  }

  const loc = (searchParams.get('locale') || 'es').toLowerCase().startsWith('en') ? 'en' : 'es'
  if (plan && (plan.idioma || 'es') !== loc) plan = await traducirPlan(plan, loc)

  const { data: historial } = await supabaseAdmin
    .from('engagement_planes')
    .select('semana, anio, completadas_pct, created_at')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(8)

  return NextResponse.json({ plan, historial: historial || [] })
}

// Traduce el texto del plan (títulos, descripciones, materiales, días, mensaje) al otro idioma.
// Se hace una sola vez con el modelo rápido y queda guardado en `traducciones`.
async function traducirPlan(plan: any, loc: 'es' | 'en') {
  const acts: any[] = Array.isArray(plan.actividades) ? plan.actividades : []
  const mezclar = (t: any) => ({
    ...plan,
    mensaje_motivacional: t.mensaje_motivacional || plan.mensaje_motivacional,
    actividades: acts.map((a, i) => ({ ...a, ...(t.actividades?.[i] || {}), area: a.area, dificultad: a.dificultad, duracion_minutos: a.duracion_minutos, completada: a.completada })),
  })
  const guardada = plan.traducciones?.[loc]
  if (guardada?.actividades?.length === acts.length) return mezclar(guardada)
  try {
    const fuente = {
      mensaje_motivacional: plan.mensaje_motivacional || '',
      actividades: acts.map(a => ({ titulo: a.titulo, descripcion: a.descripcion, por_que_importa: a.por_que_importa, materiales_necesarios: a.materiales_necesarios || [], dias_recomendados: a.dias_recomendados || [] })),
    }
    const idioma = loc === 'en' ? 'English' : 'español'
    const raw = await callGroqSimple(
      `You are a professional translator for a children's therapy app. Translate every text value of the JSON into ${idioma}, keeping a warm tone for parents. Keep exactly the same keys, structure and number of items. Return ONLY the JSON.`,
      JSON.stringify(fuente),
      { model: GROQ_MODELS.FAST, temperature: 0.2, maxTokens: 2500 },
    )
    const t = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
    if (!Array.isArray(t.actividades) || t.actividades.length !== acts.length) return plan
    await supabaseAdmin.from('engagement_planes').update({ traducciones: { ...(plan.traducciones || {}), [loc]: t } }).eq('id', plan.id)
    return mezclar(t)
  } catch (e) {
    console.warn('[engagement-padres] no se pudo traducir el plan:', (e as Error).message)
    return plan
  }
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
