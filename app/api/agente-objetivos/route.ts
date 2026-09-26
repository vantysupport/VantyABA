// app/api/agente-objetivos/route.ts
// 🧠 CAPA 1 — Sub-agente: Generador de Objetivos Adaptativos
// Analiza el progreso actual y genera/ajusta objetivos terapéuticos automáticamente
// basándose en el nivel de dominio, patrones detectados y mejores prácticas ABA

import { NextRequest, NextResponse } from 'next/server'
import { sinTokens, descontarToken } from '@/lib/tokens-ia'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, canAccessChild, unauthorized, forbidden, notFound } from '@/lib/api-auth'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { buildAIContext } from '@/lib/ai-context-builder'


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
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const rawBody = await req.json()
    const userLocale = rawBody.locale || req.headers.get('x-locale') || 'es'
    const { childId, childName, accion = 'generar' } = rawBody
    // accion: 'generar' | 'ajustar' | 'evaluar_dominio'
    if (!childId) return NextResponse.json({ error: 'childId requerido' }, { status: 400 })
    if (!(await canAccessChild(caller, childId))) return notFound()
    // Tokens de análisis del centro
    const bloqueo = await sinTokens(caller.centroId, String(userLocale).toLowerCase().startsWith('en'))
    if (bloqueo) return bloqueo

    // Cargar datos del paciente
    const { data: child } = await supabaseAdmin
      .from('children')
      .select('name, age, birth_date, diagnosis')
      .eq('id', childId)
      .single()

    // Programas ABA activos con sus objetivos
    // FIX: objetivos_cp tiene `descripcion`, no `nombre`. Antes la query fallaba silenciosamente.
    const { data: programas, error: progErr } = await supabaseAdmin
      .from('programas_aba')
      .select('id, titulo, area, fase_actual, estado, criterio_dominio_pct, objetivos_cp(id, descripcion, estado, numero_set)')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (progErr) console.warn('[agente-objetivos] error cargando programas:', progErr.message)
    // Filtrar localmente programas archivados/dados de alta
    const programasFiltrados = (programas || []).filter((p: any) =>
      !['archivado', 'alta', 'dado_de_alta', 'inactivo', 'cancelado'].includes(String(p.estado || '').toLowerCase())
    )

    // Últimas 8 sesiones para contexto
    const { data: sesiones } = await supabaseAdmin
      .from('registro_aba')
      .select('fecha_sesion, datos')
      .eq('child_id', childId)
      .order('fecha_sesion', { ascending: false })
      .limit(8)

    // Patrones detectados recientes (puede no existir → maybeSingle para no romper)
    const { data: patronesData } = await supabaseAdmin
      .from('patrones_detectados')
      .select('patrones, analisis_ia')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nombre = (child as any)?.name || childName || 'Paciente'
    const diagnostico = (child as any)?.diagnosis || 'No especificado'
    const edad = (child as any)?.age || 'N/A'

    // Calcular tasa de dominio por programa
    const resumenProgramas = programasFiltrados.map((p: any) => {
      const objetivos = (p as any).objetivos_cp || []
      const total = objetivos.length
      // Lógica en cascada: mismo criterio que padre/stats
      const progDominado = p.estado === 'dominado'
      const dominados = progDominado
        ? total
        : objetivos.filter((o: any) => o.estado === 'dominado').length
      return {
        titulo: p.titulo,
        area: p.area,
        fase: p.fase_actual,
        estado: p.estado,
        pct_dominio: total > 0 ? Math.round((dominados / total) * 100) : (progDominado ? 100 : 0),
        dominados,
        total,
        criterio: p.criterio_dominio_pct || 80,
        sets: objetivos.map((o: any) => ({
          numero: o.numero_set,
          descripcion: o.descripcion,
          estado: o.estado,
        })),
      }
    })

    // Resumen sesiones recientes
    const resumenSesiones = sesiones?.slice(0, 3).map(s => ({
      fecha: s.fecha_sesion,
      objetivo: s.datos?.objetivo_principal || 'N/A',
      logro: s.datos?.nivel_logro_objetivos || 'N/A',
      habilidades: s.datos?.habilidades_objetivo || [],
      avances: s.datos?.avances_observados || ''
    })) || []

    const patrones = (patronesData as any)?.patrones || []
    const patronesUrgentes = patrones.filter((p: any) =>
      p.tipo === 'estancamiento' || p.tipo === 'regresion'
    )

    // Prompt según acción
    let promptBase = ''

    const protocolosGuia = `MARCO CLÍNICO PARA EL DISEÑO DE OBJETIVOS:
Diseña objetivos ABA basados en evidencia y buenas prácticas del análisis conductual, apropiados al nivel de desarrollo del paciente (zona de desarrollo próximo). Organiza por dominios funcionales del desarrollo: Conducta Verbal / Comunicación, Habilidades Académicas, Habilidades Sociales, Juego, Autonomía / Habilidades de la vida diaria, Conducta Adaptativa.

🚫 PROHIBIDO citar, nombrar o hacer referencia a instrumentos de evaluación estandarizados de terceros (marcas registradas) ni a sus códigos de ítem. Describe cada objetivo con lenguaje clínico propio y operacionalizado, sin mencionar el nombre de ningún test comercial.

🚫 NUNCA objetivos genéricos. ✅ SIEMPRE: SD/R/consecuencia + criterio numérico observable + técnica ABA reconocida (DTT, NET, ITT, errorless teaching, prompt fading, task analysis, BST, video modeling, etc.).`

    if (accion === 'evaluar_dominio') {
      promptBase = `${protocolosGuia}

TAREA: Evaluar si los siguientes programas están listos para avanzar de fase o cerrar por dominio, según buenas prácticas del análisis conductual aplicado.

PACIENTE: ${nombre} | Edad: ${edad} | Diagnóstico: ${diagnostico}

PROGRAMAS ACTIVOS:
${resumenProgramas.map(p => `- "${p.titulo}" (${p.area}): ${p.pct_dominio}% dominado (${p.dominados}/${p.total} objetivos), fase: ${p.fase}, criterio: ${p.criterio}%`).join('\n')}

ÚLTIMAS SESIONES:
${resumenSesiones.map(s => `- ${s.fecha}: objetivo="${s.objetivo}", logro=${s.logro}`).join('\n')}

Para cada programa, indica:
1. ESTADO: listo_para_avanzar / mantener / necesita_ajuste
2. ACCIÓN: qué hacer específicamente (avanzar al siguiente objetivo, cerrar el programa, ajustar criterio, agregar generalización con 2do terapeuta, etc.)
3. JUSTIFICACIÓN: 1 oración clínica basada en el desempeño observado (sin nombrar tests comerciales)
4. SIGUIENTE PASO: objetivo concreto del siguiente nivel, operacionalizado

Responde en JSON con array "evaluaciones": [{programa, estado, accion, justificacion, siguiente_paso}]
SOLO JSON, sin markdown.`

    } else if (accion === 'ajustar') {
      promptBase = `${protocolosGuia}

TAREA: Ajustar los objetivos terapéuticos actuales aplicando técnicas ABA basadas en evidencia.

PACIENTE: ${nombre} | Edad: ${edad} | Diagnóstico: ${diagnostico}

PATRONES PROBLEMÁTICOS DETECTADOS:
${patronesUrgentes.map((p: any) => `- [${p.tipo}] ${p.area}: ${p.descripcion}`).join('\n') || 'Ninguno detectado'}

PROGRAMAS ACTIVOS:
${resumenProgramas.map(p => `- "${p.titulo}" (${p.area}): fase ${p.fase}, ${p.pct_dominio}% dominio`).join('\n')}

Genera ajustes específicos para cada área problemática. Para cada ajuste:
1. QUÉ AJUSTAR: el objetivo o estrategia exacta a modificar
2. CÓMO AJUSTAR: técnica ABA específica (ej: "aplicar errorless teaching con prompt graduado de física total → física parcial → gestual → independiente", "fragmentar la tarea en 3 sub-pasos siguiendo task analysis", "introducir contraprueba con 2do terapeuta")
3. META 4 SEMANAS: resultado observable y medible

Responde en JSON: {"ajustes": [{area, que_ajustar, como_ajustar, meta_4_semanas}]}
SOLO JSON.`

    } else {
      // accion === 'generar' (default)
      promptBase = `${protocolosGuia}

TAREA: Generar 3-5 nuevos objetivos terapéuticos basados en evidencia, apropiados para el nivel actual del paciente (zona de desarrollo próximo).

PACIENTE: ${nombre} | Edad: ${edad} | Diagnóstico: ${diagnostico}

HABILIDADES ACTUALMENTE EN TRABAJO:
${resumenProgramas.map(p => `- ${p.area}: "${p.titulo}" (fase ${p.fase}, ${p.pct_dominio}% dominio)`).join('\n')}

AVANCES RECIENTES (últimas sesiones):
${resumenSesiones.map(s => `- ${s.avances}`).filter(Boolean).join('\n') || 'Sin avances registrados'}

PATRONES DETECTADOS:
${patrones.slice(0, 3).map((p: any) => `- [${p.tipo}] ${p.area}: ${p.descripcion}`).join('\n') || 'Sin patrones problemáticos'}

Para CADA objetivo nuevo devolvé:
- titulo: conducta operacionalizada (ej: "Petición de 5 ítems preferidos usando 2 palabras")
- area: dominio funcional (Conducta Verbal / Habilidades académicas / Autonomía / Habilidades sociales / etc.)
- descripcion: SD + R + consecuencia operacionalizadas
- criterio_dominio: numérico observable (ej: "80% en 3 sesiones consecutivas con 2 terapeutas distintos en 2 entornos diferentes")
- metodologia: técnica de enseñanza específica (DTT / NET / ITT / video modeling / BST / cadenas de tareas con prompt graduado / etc.)
- justificacion_clinica: 1-2 oraciones basadas en el nivel de desarrollo y el progreso actual (sin nombrar tests comerciales)
- prioridad: "alta" | "media" | "baja"

🚫 NUNCA devuelvas títulos genéricos como "Mejorar atención" o "Desarrollar lenguaje". Cada objetivo debe estar operacionalizado y anclado a una conducta concreta.

Responde en JSON: {"objetivos_sugeridos": [{titulo, area, descripcion, criterio_dominio, metodologia, justificacion_clinica, prioridad}]}
SOLO JSON.`
    }


    // ━━━ CEREBRO IA: grounding clínico general (sin apuntar a tests comerciales) ━━━
    let _cerebroCtx = ''
    try {
      const areasPaciente = [...new Set(resumenProgramas.map(p => p.area).filter(Boolean))].join(' ')
      const _query = `objetivos ABA criterios dominio ${areasPaciente} ${diagnostico}`
      const _kb = await buildAIContext(undefined, undefined, undefined, _query, caller.centroId)
      _cerebroCtx = _kb.knowledgeContext
    } catch { /* Cerebro IA no disponible */ }
    // ━━━ FIN CEREBRO IA ━━━

    const promptConCerebro = _cerebroCtx
      ? `${promptBase}\n\n📚 CONTEXTO CLÍNICO DE APOYO (Cerebro IA — úsalo solo como referencia general, NO copies ni cites nombres de tests comerciales):\n${_cerebroCtx}`
      : promptBase

    const sistemaPrompt = `Eres un psicólogo conductual certificado BCBA especializado en diseño de programas ABA para niños con TEA y TDAH.

REGLAS NO NEGOCIABLES:
1. NUNCA generes objetivos genéricos. Operacionaliza siempre la conducta.
2. PROHIBIDO nombrar, citar o referenciar instrumentos de evaluación estandarizados de terceros (marcas registradas) o sus códigos de ítem. Nunca copies textualmente contenido de esos instrumentos. Redacta cada objetivo con lenguaje clínico propio.
3. Operacionaliza cada conducta con SD (antecedente), R (respuesta esperada) y criterio numérico observable.
4. Los métodos de enseñanza deben ser técnicas ABA reconocidas genéricas (DTT, NET, ITT, errorless, prompt fading, task analysis, BST, etc.).
5. Respondes SIEMPRE con JSON válido sin texto adicional.`

    const respuestaRaw = await callGroqSimple(sistemaPrompt,
      promptConCerebro + getLangInstruction(userLocale),
      { model: GROQ_MODELS.SMART, temperature: 0.3, maxTokens: 4000 }
    )

    // Parsear JSON de la respuesta — robusto contra prefijos/sufijos extra Y truncamiento
    const intentarParsear = (txt: string): any | null => {
      try { return JSON.parse(txt) } catch { return null }
    }
    /**
     * Repara JSON truncado: cierra strings/braces/brackets abiertos y elimina la
     * última coma/objeto incompleto para que parseé como JSON válido.
     */
    const repararJsonTruncado = (txt: string): string => {
      let s = txt.trim()
      // Si terminamos en medio de un string, cerrarlo
      const comillas = (s.match(/"/g) || []).length
      // contar comillas no-escapadas
      let escapando = false
      let dentroString = false
      for (let i = 0; i < s.length; i++) {
        const c = s[i]
        if (escapando) { escapando = false; continue }
        if (c === '\\') { escapando = true; continue }
        if (c === '"') dentroString = !dentroString
      }
      if (dentroString) s += '"'
      // Cortar última coma colgante o coma + objeto/array incompleto
      s = s.replace(/,\s*$/, '')
      s = s.replace(/,\s*\{[^}]*$/, '')  // ", { ...incompleto"
      s = s.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, '')  // ", "key": "valor incompleto"
      s = s.replace(/,\s*"[^"]*"\s*:\s*$/, '')  // ", "key":"
      // Contar y cerrar brackets/braces abiertos
      let abreLlave = 0, abreCorch = 0
      escapando = false; dentroString = false
      for (const c of s) {
        if (escapando) { escapando = false; continue }
        if (c === '\\') { escapando = true; continue }
        if (c === '"') { dentroString = !dentroString; continue }
        if (dentroString) continue
        if (c === '{') abreLlave++
        else if (c === '}') abreLlave--
        else if (c === '[') abreCorch++
        else if (c === ']') abreCorch--
      }
      while (abreCorch > 0) { s += ']'; abreCorch-- }
      while (abreLlave > 0) { s += '}'; abreLlave-- }
      return s
    }

    let resultado: any = null
    // 1) Limpiar code fences ```json
    const sinFences = respuestaRaw.replace(/```json\n?|\n?```/g, '').trim()
    resultado = intentarParsear(sinFences)
    // 2) Extraer primer bloque { ... } completo (greedy hasta el último '}')
    if (!resultado) {
      const m = sinFences.match(/\{[\s\S]*\}/)
      if (m) resultado = intentarParsear(m[0])
    }
    // 3) Intentar reparar JSON truncado
    if (!resultado) {
      const reparado = repararJsonTruncado(sinFences)
      resultado = intentarParsear(reparado)
      if (resultado) console.log('[agente-objetivos] JSON reparado desde respuesta truncada')
    }
    // 4) Último recurso: devolver texto plano
    if (!resultado) {
      console.warn('[agente-objetivos] no se pudo parsear JSON, devolviendo texto plano. Respuesta:', respuestaRaw.slice(0, 200))
      resultado = { texto_libre: respuestaRaw }
    }

    // Guardar sugerencias en Supabase
    try {
      await supabaseAdmin.from('objetivos_adaptativos').insert({
        child_id: childId,
        accion,
        resultado,
        programas_analizados: resumenProgramas.length,
        centro_id: caller.centroId,
        created_at: new Date().toISOString()
      })
    } catch { /* no bloquear */ }

    // Se descuenta un token solo cuando se generó bien
    const tokens = await descontarToken(caller.centroId)

    return NextResponse.json({
      tokens,
      accion,
      paciente: nombre,
      resultado,
      programas_analizados: resumenProgramas.length,
      patrones_considerados: patronesUrgentes.length,
      timestamp: new Date().toISOString()
    })

  } catch (e: any) {
    console.error('❌ Error agente-objetivos:', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  const { searchParams } = new URL(req.url)
  const childId = searchParams.get('child_id')
  if (!childId) return NextResponse.json({ error: 'child_id requerido' }, { status: 400 })
  if (!(await canAccessChild(caller, childId))) return notFound()
  try {
    const { data } = await supabaseAdmin
      .from('objetivos_adaptativos')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(20)
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
