// app/api/dashboard/metricas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, unauthorized, forbidden } from '@/lib/api-auth'

// Desactiva cache de Next.js — el dashboard debe reflejar cambios inmediatos
// (citas creadas/editadas/borradas, alertas resueltas, etc.)
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  const { searchParams } = new URL(req.url)
  const periodo = searchParams.get('periodo') || '7d' // 7d | 30d | 90d
  const hoy = new Date().toISOString().split('T')[0]

  // Calcular rango de fechas
  const diasAtras = periodo === '30d' ? 30 : periodo === '90d' ? 90 : 7
  const fechaInicio = new Date()
  fechaInicio.setDate(fechaInicio.getDate() - diasAtras)
  const fechaInicioStr = fechaInicio.toISOString().split('T')[0]
  const inicioMes = new Date()
  inicioMes.setDate(1)
  const hace30str = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const centro = caller.centroId

  try {
    // Todas las consultas son independientes: salen en paralelo (antes iban una tras otra, ~5 s)
    const [
      { data: sesionesHoy },
      { count: totalPacientes },
      { count: pacientesNuevosMes },
      { data: alertas },
      { data: sesionesPeriodo },
      { data: tareas },
      { count: formPendientes },
      { data: ultimasSesiones },
      { data: allChildren },
      { data: conSesAgenda },
      { data: conSesABA },
      { data: conSesV2 },
      { data: conSesPrograma },
      { data: proximasSesiones },
      { data: alertasRecientes },
      { data: ingresosMes },
      facturasPendientes,
    ] = await Promise.all([
      supabaseAdmin.from('agenda_sesiones').select('id, estado, hora_inicio, hora_fin, tipo, terapeuta_id').eq('centro_id', centro).eq('fecha', hoy),
      supabaseAdmin.from('children').select('*', { count: 'exact', head: true }).eq('centro_id', centro),
      supabaseAdmin.from('children').select('*', { count: 'exact', head: true }).eq('centro_id', centro).gte('created_at', inicioMes.toISOString()),
      supabaseAdmin.from('agente_alertas').select('id, prioridad, tipo, created_at').eq('centro_id', centro).eq('resuelta', false).order('prioridad', { ascending: true }).limit(100),
      supabaseAdmin.from('agenda_sesiones').select('fecha, estado').eq('centro_id', centro).gte('fecha', fechaInicioStr).lte('fecha', hoy),
      supabaseAdmin.from('tareas_hogar').select('id, completada, fecha_asignada').eq('centro_id', centro).eq('activa', true).gte('fecha_asignada', fechaInicioStr),
      supabaseAdmin.from('parent_forms').select('*', { count: 'exact', head: true }).eq('centro_id', centro).eq('status', 'pending'),
      supabaseAdmin.from('registro_aba').select('datos').eq('centro_id', centro).gte('fecha_sesion', fechaInicioStr).limit(50),
      supabaseAdmin.from('children').select('id, name').eq('centro_id', centro).order('name'),
      supabaseAdmin.from('agenda_sesiones').select('child_id').eq('centro_id', centro).in('estado', ['realizada', 'completada']).gte('fecha', hace30str),
      supabaseAdmin.from('registro_aba').select('child_id').eq('centro_id', centro).gte('fecha_sesion', hace30str),
      supabaseAdmin.from('aba_sessions_v2').select('child_id').eq('centro_id', centro).gte('session_date', hace30str),
      supabaseAdmin.from('sesiones_datos_aba').select('child_id').eq('centro_id', centro).gte('fecha', hace30str),
      supabaseAdmin.from('agenda_sesiones').select('*, children(name, diagnosis)').eq('centro_id', centro).gte('fecha', hoy).in('estado', ['programada', 'confirmada'])
        .order('fecha', { ascending: true }).order('hora_inicio', { ascending: true }).limit(5),
      // Trae más alertas para que los logros (prioridad baja) no queden cortados por el cupo
      supabaseAdmin.from('agente_alertas').select('*, children(name)').eq('centro_id', centro).eq('resuelta', false).order('created_at', { ascending: false }).limit(30),
      supabaseAdmin.from('facturas').select('monto, estado').eq('centro_id', centro).gte('fecha_emision', inicioMes.toISOString().split('T')[0]).eq('estado', 'pagado'),
      supabaseAdmin.from('facturas').select('*', { count: 'exact', head: true }).eq('centro_id', centro).eq('estado', 'pendiente'),
    ])

    // ── SESIONES HOY ─────────────────────────────────────────
    const totalHoy       = sesionesHoy?.length || 0
    const realizadasHoy  = sesionesHoy?.filter(s => s.estado === 'realizada').length || 0
    const canceladasHoy  = sesionesHoy?.filter(s => s.estado === 'cancelada').length || 0
    const programadasHoy = sesionesHoy?.filter(s => s.estado === 'programada' || s.estado === 'confirmada').length || 0

    // ── ALERTAS ──────────────────────────────────────────────
    const alertasUrgentes = alertas?.filter(a => a.prioridad === 1).length || 0
    const alertasTotal    = alertas?.length || 0

    // ── SESIONES DEL PERIODO (para gráfico) ───────────────────
    const porFecha: Record<string, { total: number; realizadas: number; canceladas: number }> = {}
    sesionesPeriodo?.forEach(s => {
      if (!porFecha[s.fecha]) porFecha[s.fecha] = { total: 0, realizadas: 0, canceladas: 0 }
      porFecha[s.fecha].total++
      if (s.estado === 'realizada')  porFecha[s.fecha].realizadas++
      if (s.estado === 'cancelada')  porFecha[s.fecha].canceladas++
    })
    const graficaSesiones = Object.entries(porFecha).map(([fecha, data]) => ({ fecha, ...data }))

    // ── TAREAS HOGAR ─────────────────────────────────────────
    const tareasTotal       = tareas?.length || 0
    const tareasCompletadas = tareas?.filter(t => t.completada).length || 0
    const tareasCompletitudPct = tareasTotal > 0 ? Math.round((tareasCompletadas / tareasTotal) * 100) : 0

    // ── PROGRESO PROMEDIO PACIENTES ───────────────────────────
    let sumaLogro = 0
    let countLogro = 0
    ultimasSesiones?.forEach(s => {
      const logro = s.datos?.nivel_logro_objetivos
      if (logro) {
        const valor = logro.includes('76') || logro.includes('Completamente') ? 90
          : logro.includes('51') || logro.includes('Mayormente') ? 70
          : logro.includes('26') || logro.includes('Parcialmente') ? 50 : 25
        sumaLogro += valor
        countLogro++
      }
    })
    const progresoPromedio = countLogro > 0 ? Math.round(sumaLogro / countLogro) : 0

    // ── PACIENTES SIN SESIÓN (30d) ────────────────────────────
    const conSesionSet = new Set([
      ...(conSesAgenda || []).map(s => s.child_id),
      ...(conSesABA || []).map(s => s.child_id),
      ...(conSesV2 || []).map(s => s.child_id),
      ...(conSesPrograma || []).map(s => s.child_id),
    ])
    const pacientesSinSesion30d = (allChildren || []).filter(n => !conSesionSet.has(n.id))

    // ── TERAPEUTAS CON CARGA HOY (de las mismas sesiones de hoy) ──
    const cargaTerapeutas: Record<string, { total: number; realizadas: number }> = {}
    sesionesHoy?.forEach(s => {
      if (!cargaTerapeutas[s.terapeuta_id]) cargaTerapeutas[s.terapeuta_id] = { total: 0, realizadas: 0 }
      cargaTerapeutas[s.terapeuta_id].total++
      if (s.estado === 'realizada') cargaTerapeutas[s.terapeuta_id].realizadas++
    })

    // ── INGRESOS DEL MES ──────────────────────────────────────
    const totalIngresosMes = ingresosMes?.reduce((acc, f) => acc + Number(f.monto), 0) || 0

    return NextResponse.json({
      // Resumen del día
      hoy: {
        fecha: hoy,
        sesiones: { total: totalHoy, realizadas: realizadasHoy, canceladas: canceladasHoy, programadas: programadasHoy },
        tasaAsistencia: totalHoy > 0 ? Math.round(((realizadasHoy + programadasHoy) / totalHoy) * 100) : 100
      },
      // Pacientes
      pacientes: {
        total: totalPacientes || 0,
        nuevosMes: pacientesNuevosMes || 0,
        progresoPromedio
      },
      // Alertas
      alertas: {
        total: alertasTotal,
        urgentes: alertasUrgentes,
        recientes: alertasRecientes
      },
      // Tareas
      tareas: {
        total: tareasTotal,
        completadas: tareasCompletadas,
        completitudPct: tareasCompletitudPct,
        formPendientes: formPendientes || 0
      },
      // Financiero
      financiero: {
        ingresosMes: totalIngresosMes,
        facturasPendientes: facturasPendientes.count || 0
      },
      // Para gráficos
      graficas: {
        sesionesXFecha: graficaSesiones,
        cargaTerapeutas: Object.entries(cargaTerapeutas).map(([id, data]) => ({ terapeutaId: id, ...data }))
      },
      // Próximas citas
      proximasSesiones: proximasSesiones || [],
      // Pacientes sin sesión (calculado server-side con supabaseAdmin para bypasear RLS)
      pacientesSinSesion: pacientesSinSesion30d
    })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
