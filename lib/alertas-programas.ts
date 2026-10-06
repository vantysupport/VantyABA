// Motor ÚNICO de alertas de programas ABA (reglas, sin IA). Lo usan el dashboard (refrescar-alertas) y el
// análisis de ARIA en la ficha del paciente, así una misma situación nunca genera dos alertas distintas.
//
// Reglas:
//  · Programas dominados, pausados o cerrados no generan alertas (el "programa dominado" sí, una vez).
//  · Paciente sin sesiones en NINGÚN programa hace ≥14 días → UNA sola alerta del paciente (no una por programa).
//  · Paciente activo pero un programa sin practicar hace ≥21 días → alerta de ese programa.
//  · Tendencias y logros (regresión, estancamiento, "falta 1 sesión"…) solo con datos recientes (≤30 días):
//    con datos viejos se contradecían con "sin sesión hace N días".
//  · Cada alerta tiene un "tipo" estable (regla + programa + set): si ya existe se ACTUALIZA el texto
//    (los días cambian), si dejó de aplicar se resuelve sola, y si la persona la descartó no vuelve a salir
//    mientras la situación siga igual.

import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'

export interface AlertaPrograma {
  child_id: string
  tipo: string
  titulo: string
  mensaje: string
  programa_id?: string | null
  prioridad: 'alta' | 'media' | 'baja'
}

const DIAS_PACIENTE = 14       // sin ninguna sesión → alerta del paciente
const DIAS_PROGRAMA = 21       // paciente activo pero este programa abandonado
const DIAS_DATOS_RECIENTES = 30 // tendencias/logros solo con sesiones recientes
const ESTADOS_CERRADOS = ['dominado', 'logrado', 'criterio_alcanzado', 'pausado', 'suspendido', 'archivado', 'cerrado', 'inactivo', 'mantenimiento']

const diasDesde = (fecha: string) => Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000))
const fechaCorta = (fecha: string) => new Date(fecha).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' })

function slopeLineal(ys: number[]): number {
  const n = ys.length
  if (n < 2) return 0
  let sx = 0, sy = 0, sxy = 0, sxx = 0
  ys.forEach((y, i) => { const x = i + 1; sx += x; sy += y; sxy += x * y; sxx += x * x })
  const d = n * sxx - sx * sx
  return d === 0 ? 0 : (n * sxy - sx * sy) / d
}

type Sesion = { programa_id: string; fecha: string; porcentaje_exito: number | null; fase: string | null; set: string | null }

function tendencia(sesiones: Sesion[]) {
  const v = sesiones.filter(s => typeof s.porcentaje_exito === 'number' && !isNaN(s.porcentaje_exito))
  if (v.length < 2) return null
  const ventana = v.slice(-Math.min(6, v.length)).map(s => s.porcentaje_exito as number)
  const n = ventana.length
  const reciente = ventana.reduce((a, b) => a + b, 0) / n
  const ant = v.length > n ? v.slice(-2 * n, -n).map(s => s.porcentaje_exito as number) : []
  const anterior = ant.length ? ant.reduce((a, b) => a + b, 0) / ant.length : reciente
  const slope = Math.round(slopeLineal(ventana) * 10) / 10
  return {
    reciente: Math.round(reciente), anterior: Math.round(anterior), cambio: Math.round(reciente - anterior), slope, n,
    tipo: slope > 1.5 ? 'mejorando' : slope < -1.5 ? 'regresion' : 'estable',
  }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'main'

/** Calcula las alertas que aplican HOY a un paciente (no escribe nada). */
export async function generarAlertasNino(childId: string): Promise<AlertaPrograma[]> {
  const alertas: AlertaPrograma[] = []
  const { data: programas } = await supabaseAdmin
    .from('programas_aba')
    .select('id, titulo, criterio_dominio_pct, criterio_sesiones_consecutivas, estado, objetivos_cp ( id, numero_set, descripcion, estado )')
    .eq('child_id', childId)
  if (!programas?.length) return alertas

  const { data: sesionesRaw } = await supabaseAdmin
    .from('sesiones_datos_aba')
    .select('programa_id, fecha, porcentaje_exito, fase, set')
    .in('programa_id', programas.map(p => p.id))
    .order('fecha', { ascending: true })
  const porPrograma = new Map<string, Sesion[]>()
  for (const s of (sesionesRaw ?? []) as Sesion[]) {
    if (!porPrograma.has(s.programa_id)) porPrograma.set(s.programa_id, [])
    porPrograma.get(s.programa_id)!.push(s)
  }

  type Prog = { id: string; titulo: string; criterio_dominio_pct: number | null; criterio_sesiones_consecutivas: number | null; estado: string | null; objetivos_cp: { numero_set: number | null; descripcion: string | null; estado: string | null }[] | null }
  const activos: Prog[] = []
  for (const prog of programas as Prog[]) {
    const sets = prog.objetivos_cp ?? []
    if (sets.length > 0 && sets.every(s => s.estado === 'dominado')) {
      alertas.push({
        child_id: childId, tipo: `logro_programa_${prog.id}`, programa_id: prog.id, prioridad: 'baja',
        titulo: `🏆 Programa dominado: "${prog.titulo}"`,
        mensaje: `Los ${sets.length} sets del programa están dominados. Considera pasarlo a mantenimiento o cerrarlo y continuar con uno nuevo.`,
      })
      continue
    }
    if (ESTADOS_CERRADOS.includes(String(prog.estado || '').toLowerCase())) continue
    activos.push(prog)
  }

  // ── Inactividad: primero a nivel paciente ──
  const conSesiones = activos.filter(p => (porPrograma.get(p.id) ?? []).length > 0)
  const ultimaPaciente = conSesiones.map(p => porPrograma.get(p.id)!.at(-1)!.fecha).sort().at(-1)
  const diasPaciente = ultimaPaciente ? diasDesde(ultimaPaciente) : null
  if (diasPaciente !== null && diasPaciente >= DIAS_PACIENTE) {
    alertas.push({
      child_id: childId, tipo: 'sin_sesion_paciente', programa_id: null,
      prioridad: diasPaciente >= 30 ? 'alta' : 'media',
      titulo: `Sin sesiones hace ${diasPaciente} días`,
      mensaje: `Ningún programa ABA tiene sesiones registradas desde el ${fechaCorta(ultimaPaciente!)} (${conSesiones.length} ${conSesiones.length === 1 ? 'programa activo' : 'programas activos'}). Verificar asistencia del paciente o si se pausó la intervención.`,
    })
    return alertas // con el paciente inactivo, las alertas por programa solo repetirían lo mismo
  }

  for (const prog of activos) {
    const todas = porPrograma.get(prog.id) ?? []
    if (todas.length === 0) continue
    const dias = diasDesde(todas.at(-1)!.fecha)

    if (dias >= DIAS_PROGRAMA) {
      alertas.push({
        child_id: childId, tipo: `sin_sesion_${prog.id}`, programa_id: prog.id,
        prioridad: dias >= 45 ? 'alta' : 'media',
        titulo: `"${prog.titulo}" sin practicar hace ${dias} días`,
        mensaje: `El paciente sigue con sesiones en otros programas, pero este no se trabaja desde el ${fechaCorta(todas.at(-1)!.fecha)}. Retomarlo o pausarlo si cambió la prioridad.`,
      })
    }
    if (dias > DIAS_DATOS_RECIENTES) continue // datos viejos: no hay tendencias ni logros que reportar

    const criterio = prog.criterio_dominio_pct || 90
    const nConsec = Number(prog.criterio_sesiones_consecutivas) || 2
    const estadoSet: Record<string, string> = {}
    for (const o of prog.objetivos_cp ?? []) estadoSet[o.numero_set ? `Set ${o.numero_set}` : (o.descripcion || '').slice(0, 20)] = o.estado || 'pendiente'

    const porSet = new Map<string, Sesion[]>()
    for (const s of todas.filter(s => s.fase !== 'linea_base')) {
      const k = s.set || '__sin_set__'
      if (!porSet.has(k)) porSet.set(k, [])
      porSet.get(k)!.push(s)
    }
    for (const [setNombre, ses] of porSet) {
      if ((estadoSet[setNombre] || 'en_progreso') === 'dominado') continue
      if (diasDesde(ses.at(-1)!.fecha) > DIAS_DATOS_RECIENTES) continue // set que ya no se trabaja
      const etiqueta = setNombre !== '__sin_set__' ? ` (${setNombre})` : ''
      const base = `${prog.id}_${slug(setNombre)}`
      const tend = tendencia(ses)
      const cumple = (s: Sesion) => (s.porcentaje_exito ?? 0) >= criterio

      if (ses.length >= nConsec && ses.slice(-nConsec).every(cumple)) {
        const prom = Math.round(ses.slice(-nConsec).reduce((a, s) => a + (s.porcentaje_exito ?? 0), 0) / nConsec)
        alertas.push({
          child_id: childId, tipo: `logro_dominio_${base}`, programa_id: prog.id, prioridad: 'baja',
          titulo: `🎯 Criterio alcanzado en "${prog.titulo}"${etiqueta}`,
          mensaje: `${nConsec} sesiones seguidas cumpliendo el ${criterio}% (promedio ${prom}%). Marca el set como dominado para avanzar.`,
        })
      } else if (nConsec >= 2 && ses.length >= nConsec - 1 && ses.slice(-(nConsec - 1)).every(cumple)) {
        alertas.push({
          child_id: childId, tipo: `logro_cerca_dominio_${base}`, programa_id: prog.id, prioridad: 'baja',
          titulo: `⚡ Falta 1 sesión para dominar "${prog.titulo}"${etiqueta}`,
          mensaje: `Última sesión al ${ses.at(-1)!.porcentaje_exito}% (criterio ${criterio}%). Una sesión más en el criterio confirma el dominio.`,
        })
      } else if (tend && ses.length >= 5 && tend.slope >= 5 && tend.reciente >= 60) {
        alertas.push({
          child_id: childId, tipo: `logro_progreso_${base}`, programa_id: prog.id, prioridad: 'baja',
          titulo: `📈 Progreso consistente en "${prog.titulo}"${etiqueta}`,
          mensaje: `+${tend.slope}% por sesión, promedio ${tend.reciente}% en las últimas ${tend.n} sesiones. Buen avance hacia el ${criterio}%.`,
        })
      }
      if (tend && tend.tipo === 'regresion' && tend.cambio < -10) {
        alertas.push({
          child_id: childId, tipo: `regresion_${base}`, programa_id: prog.id, prioridad: 'alta',
          titulo: `Regresión en "${prog.titulo}"${etiqueta}`,
          mensaje: `El % bajó ${Math.abs(tend.cambio)} puntos (${tend.anterior}% → ${tend.reciente}%, ${tend.slope}%/sesión). Revisar antecedentes y reforzadores.`,
        })
      }
      if (tend && ses.length >= 5 && tend.tipo === 'estable' && tend.reciente < Math.min(70, criterio - 10) && !ses.slice(-nConsec).every(cumple)) {
        alertas.push({
          child_id: childId, tipo: `estancamiento_${base}`, programa_id: prog.id, prioridad: 'media',
          titulo: `Estancamiento en "${prog.titulo}"${etiqueta}`,
          mensaje: `${ses.length} sesiones sin mejora (promedio ${tend.reciente}%, criterio ${criterio}%). Considera revisar el procedimiento o el nivel de ayuda.`,
        })
      }
    }
  }
  return alertas
}

const ES_DE_REGLA = /^(logro_|regresion|estancamiento|sin_sesion|criterio_alcanzado)/

/**
 * Deja la tabla agente_alertas igual a las reglas de hoy para ese paciente:
 * crea las nuevas, actualiza el texto de las que siguen (días, %), resuelve las que ya no aplican
 * y borra duplicados. Devuelve las alertas vigentes (sin las descartadas por el equipo).
 */
export async function sincronizarAlertasNino(childId: string, centroId: string | null): Promise<(AlertaPrograma & { id: string })[]> {
  const nuevas = await generarAlertasNino(childId)
  const porTipo = new Map(nuevas.map(a => [a.tipo, a]))

  const { data: abiertas } = await supabaseAdmin
    .from('agente_alertas').select('id, tipo, titulo, mensaje, prioridad, metadata, created_at')
    .eq('child_id', childId).eq('resuelta', false).order('created_at', { ascending: true })

  // Descartadas por el equipo en los últimos 60 días: no se vuelven a crear mientras la situación siga
  const { data: descartadas } = await supabaseAdmin
    .from('agente_alertas').select('tipo')
    .eq('child_id', childId).eq('resuelta', true).eq('metadata->>descartada', 'true')
    .gte('created_at', new Date(Date.now() - 60 * 864e5).toISOString())
  const tiposDescartados = new Set((descartadas ?? []).map(d => d.tipo as string))

  const aResolver: string[] = []
  const vistos = new Set<string>()
  const vigentes: (AlertaPrograma & { id: string })[] = []
  for (const e of abiertas ?? []) {
    const tipo = String(e.tipo || '')
    if (!ES_DE_REGLA.test(tipo)) continue           // alertas de otro origen: no se tocan
    const nueva = porTipo.get(tipo)
    if (!nueva || vistos.has(tipo) || tiposDescartados.has(tipo)) { aResolver.push(e.id); continue } // ya no aplica o duplicada
    vistos.add(tipo)
    if (e.titulo !== nueva.titulo || e.mensaje !== nueva.mensaje || e.prioridad !== nueva.prioridad) {
      await supabaseAdmin.from('agente_alertas').update({ titulo: nueva.titulo, mensaje: nueva.mensaje, prioridad: nueva.prioridad }).eq('id', e.id)
    }
    vigentes.push({ ...nueva, id: e.id })
  }
  for (let i = 0; i < aResolver.length; i += 500) {
    await supabaseAdmin.from('agente_alertas').update({ resuelta: true }).in('id', aResolver.slice(i, i + 500))
  }

  const faltan = nuevas.filter(a => !vistos.has(a.tipo) && !tiposDescartados.has(a.tipo))
  if (faltan.length) {
    const { data: creadas } = await supabaseAdmin.from('agente_alertas')
      .insert(faltan.map(a => ({ ...a, resuelta: false, centro_id: centroId })))
      .select('id, tipo')
    for (const c of creadas ?? []) vigentes.push({ ...porTipo.get(c.tipo as string)!, id: c.id as string })
  }
  return vigentes
}
