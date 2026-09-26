// app/api/progreso-paciente/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { getApiCaller, canAccessChild, unauthorized, notFound } from '@/lib/api-auth'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function parsearLogro(valor: any): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'number') return Math.min(100, Math.max(0, Math.round(valor)))
  const str = String(valor).trim().toLowerCase()
  if (str.includes('totalmente') || str.includes('completamente')) return 100
  if (str.includes('mayormente') || str.includes('51-75') || str.includes('51 - 75')) return 63
  if (str.includes('parcialmente') || str.includes('26-50') || str.includes('26 - 50')) return 38
  if (str.includes('emergente') || str.includes('inicial') || str.includes('0-25')) return 13
  if (str === 'alto' || str === 'excelente') return 85
  if (str === 'medio' || str === 'regular') return 55
  if (str === 'bajo') return 25
  if (str === 'logrado' || str === 'dominado') return 95
  if (str === 'no logrado') return 10
  const rangoMatch = str.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/)
  if (rangoMatch) return Math.round((parseFloat(rangoMatch[1]) + parseFloat(rangoMatch[2])) / 2)
  const numMatch = str.match(/(\d+(?:\.\d+)?)/)
  if (numMatch) return Math.min(100, Math.max(0, Math.round(parseFloat(numMatch[1]))))
  return null
}

// Convierte escala 1-5 a porcentaje 0-100
function escala5(v: any): number | null {
  if (!v && v !== 0) return null
  const n = Number(v)
  if (isNaN(n) || n < 1 || n > 5) return null
  return Math.round(((n - 1) / 4) * 100)
}


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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userLocale = searchParams.get('locale') || request.headers.get('x-locale') || 'es'
  const childId = searchParams.get('child_id')
  const semanas = parseInt(searchParams.get('semanas') || '12')
  if (!childId) return NextResponse.json({ error: 'child_id requerido' }, { status: 400 })

  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  if (!(await canAccessChild(caller, childId))) return notFound()

  const db = getAdmin()

  // ── Columnas reales de registro_aba: id, child_id, fecha_sesion, datos, creado_por, form_title
  const { data: sesiones, error: errSesiones } = await db
    .from('registro_aba')
    .select('id, child_id, fecha_sesion, datos, form_title')
    .eq('child_id', childId)
    .order('fecha_sesion', { ascending: true })

  // ── Programas ABA con sesiones_datos_aba
  const { data: programas } = await db
    .from('programas_aba')
    .select('id, titulo, sesiones_datos_aba(fecha, porcentaje_exito)')
    .eq('child_id', childId)

  // ── Tareas del hogar
  const fechaInicio = new Date()
  fechaInicio.setDate(fechaInicio.getDate() - semanas * 7)
  const fechaInicioStr = fechaInicio.toISOString().split('T')[0]
  const { data: tareasData } = await db
    .from('tareas_hogar')
    .select('id, completada, fecha_asignacion')
    .eq('child_id', childId)
    .gte('fecha_asignacion', fechaInicioStr)

  // ── Evaluaciones
  const evalTables = [
    { tabla: 'evaluacion_brief2', nombre: 'BRIEF-2' },
    { tabla: 'evaluacion_ados2', nombre: 'ADOS-2' },
    { tabla: 'evaluacion_vineland3', nombre: 'Vineland-3' },
    { tabla: 'evaluacion_wiscv', nombre: 'WISC-V' },
    { tabla: 'evaluacion_basc3', nombre: 'BASC-3' },
  ]
  const evaluaciones: Record<string, any[]> = {}
  for (const { tabla, nombre } of evalTables) {
    try {
      const { data } = await db.from(tabla).select('id, created_at, ai_analysis')
        .eq('child_id', childId).order('created_at', { ascending: false }).limit(3)
      if (data?.length) evaluaciones[nombre] = data
    } catch {}
  }

  // ── FUENTE A: registro_aba → puntos de gráfica ABA
  const puntosRegistro = (sesiones || []).map((s: any) => {
    let d: any = s.datos || {}
    if (typeof d === 'string') { try { d = JSON.parse(d) } catch { d = {} } }

    let logro = parsearLogro(d.nivel_logro_objetivos)
    if (logro === null) logro = parsearLogro(d.porcentaje_logro)
    if (logro === null) logro = parsearLogro(d.porcentaje_exito)
    if (logro === null) logro = parsearLogro(d.nivel_logro)
    if (logro === null) logro = 50 // si existe sesión, mostrar promedio

    const atencion     = escala5(d.nivel_atencion)
    const tolerancia   = escala5(d.tolerancia_frustracion ?? d.nivel_tolerancia)
    const comunicacion = escala5(d.iniciativa_comunicativa ?? d.nivel_comunicacion)

    return {
      fecha:        (s.fecha_sesion || '').split('T')[0],
      logro,
      atencion,
      tolerancia,
      comunicacion,
      objetivo:     d.objetivo_principal || d.conducta || s.form_title || 'Sesión ABA',
      tecnicas:     Array.isArray(d.tecnicas_aplicadas) ? d.tecnicas_aplicadas.join(', ') : (d.tecnicas_aplicadas || ''),
      asistio:      true,
      notas:        d.observaciones_tecnicas || d.observaciones_clinicas || '',
    }
  }).filter((p: any) => p.fecha)

  // ── FUENTE B: sesiones_datos_aba de programas ABA
  const sesionesDePrograma: Record<string, number[]> = {}
  for (const prog of (programas || []) as any[]) {
    for (const s of (prog.sesiones_datos_aba || [])) {
      const fecha = (s.fecha || '').split('T')[0]
      if (!fecha) continue
      if (!sesionesDePrograma[fecha]) sesionesDePrograma[fecha] = []
      if (s.porcentaje_exito != null) sesionesDePrograma[fecha].push(Number(s.porcentaje_exito))
    }
  }
  const puntosPrograma = Object.entries(sesionesDePrograma).map(([fecha, logros]) => ({
    fecha,
    logro: logros.length ? Math.round(logros.reduce((a, b) => a + b, 0) / logros.length) : 50,
    atencion: null, tolerancia: null, comunicacion: null,
    objetivo: 'Programa ABA', tecnicas: '', asistio: true, notas: ''
  }))

  // Combinar: registro_aba tiene prioridad sobre sesiones_datos_aba
  const fechasRegistro = new Set(puntosRegistro.map((p: any) => p.fecha))
  const graficaABA = [
    ...puntosRegistro,
    ...puntosPrograma.filter(p => !fechasRegistro.has(p.fecha))
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  // ── Asistencia (asumir asistió si hay registro)
  const asistencia = {
    tasa:      graficaABA.length > 0 ? 100 : 0,
    asistidas: graficaABA.length,
    total:     graficaABA.length,
  }

  // ── Tareas
  const tareasTotal = tareasData?.length || 0
  const tareasCompletadas = tareasData?.filter((t: any) => t.completada).length || 0
  const tareas = {
    adherencia:  tareasTotal > 0 ? Math.round((tareasCompletadas / tareasTotal) * 100) : 0,
    completadas: tareasCompletadas,
    total:       tareasTotal,
  }

  // ── Reporte IA
  let reporteSemanal: string | null = null
  if (graficaABA.length >= 2) {
    try {
      const promedio = Math.round(graficaABA.reduce((a: number, s: any) => a + s.logro, 0) / graficaABA.length)
      const { data: childData } = await db.from('children').select('name, diagnosis').eq('id', childId).single()
      const nombre = (childData as any)?.name || 'el paciente'
      const dx = (childData as any)?.diagnosis || 'perfil a determinar'
      reporteSemanal = await callGroqSimple(
        'Eres ARIA, analista de conducta. Responde en español clínico.',
        `Genera UN párrafo de 2-3 oraciones sobre ${nombre} (${dx}). ${semanas} semanas, ${graficaABA.length} sesiones, promedio logro ${promedio}%. Asistencia 100%.`,
        { model: GROQ_MODELS.SMART, temperature: 0.35, maxTokens: 200 }
      )
    } catch {}
  }

  // BUG FIX #2: exponer totalSesiones unificado para consistencia entre portal padres, Hub IA y admin
  const totalSesionesUnificado = Math.max(sesiones?.length || 0, graficaABA.length)

  return NextResponse.json({
    graficaABA,
    asistencia,
    tareas,
    evaluaciones,
    reporteSemanal,
    totalSesiones: totalSesionesUnificado,
    _debug: {
      registro_aba_count: errSesiones ? `ERROR: ${errSesiones.message}` : (sesiones?.length ?? 0),
      sesiones_datos_aba_count: graficaABA.length,
      total_unificado: totalSesionesUnificado,
    }
  })
}
