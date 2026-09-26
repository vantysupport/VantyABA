'use client'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import { translateAlertaMensaje } from '@/lib/translate-alertas'
import { adminFetch } from '@/lib/admin-fetch'
import { useState, useEffect, useCallback } from 'react'
import {
  Activity, Brain, Calendar, ChevronRight, Clock,
  FileText, Users, AlertTriangle, Sparkles,
  Bell, ArrowUpRight, MessageCircle, TrendingUp,
  CheckCircle2, AlertCircle, Zap,
  ClipboardList, X, Trophy, RefreshCw, ArrowRight, CalendarCheck
} from 'lucide-react'
import { AnimatePresence, animate, motion } from 'motion/react'
import { supabase } from '@/lib/supabase'

// ─── Concepts: one icon and one tone each, used everywhere on the page ─────────
const CONCEPT = {
  pacientes: { icon: Users, tone: 'bg-v-accent-soft text-v-accent' },
  sesiones:  { icon: CalendarCheck, tone: 'bg-v-success/15 text-v-success' },
  sinSesion: { icon: AlertTriangle, tone: 'bg-v-warning/15 text-v-warning' },
  programas: { icon: ClipboardList, tone: 'bg-v-accent-soft text-v-accent' },
  alertas:   { icon: Bell, tone: 'bg-v-warning/15 text-v-warning' },
  citas:     { icon: Calendar, tone: 'bg-v-accent-soft text-v-accent' },
  logro:     { icon: Trophy, tone: 'bg-v-success/15 text-v-success' },
  urgente:   { icon: AlertCircle, tone: 'bg-v-danger/10 text-v-danger' },
} as const

// ─── Animated number ──────────────────────────────────────────────────────────
function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const controls = animate(0, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1], onUpdate: v => setDisplay(Math.round(v)) })
    return () => controls.stop()
  }, [value])
  return <>{display}</>
}

// ─── Card shell ───────────────────────────────────────────────────────────────
const cardClass = 'rounded-v border border-v-border bg-v-elevated shadow-v'

function Section({ index = 0, className = '', children }: { index?: number; className?: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, type: 'spring', stiffness: 180, damping: 24 }}
      className={`${cardClass} ${className}`}
    >
      {children}
    </motion.section>
  )
}

function SectionHeader({ concept, title, count, children }: any) {
  const { icon: Icon, tone } = CONCEPT[concept as keyof typeof CONCEPT]
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`grid size-8 shrink-0 place-items-center rounded-[30%] ${tone}`}><Icon size={15} /></span>
        <p className="truncate text-[15px] font-semibold tracking-tight text-v-text">{title}</p>
        {count > 0 && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>{count}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

function EmptyState({ icon: Icon, text, action, onAction, tone = 'text-v-subtle' }: any) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <motion.span
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="grid size-12 place-items-center rounded-full bg-v-fill"
      >
        <Icon size={20} className={tone} />
      </motion.span>
      <p className="mt-3 text-sm text-v-muted">{text}</p>
      {action && (
        <button onClick={onAction} className="mt-3 inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-3.5 py-1.5 text-xs font-semibold text-v-accent transition-transform hover:scale-105 active:scale-95">
          {action} <ArrowRight size={12} />
        </button>
      )}
    </div>
  )
}

// ─── Bar chart ────────────────────────────────────────────────────────────────
function BarChart({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex h-36 items-end gap-2 sm:gap-3">
      {values.map((v, i) => {
        const isToday = i === values.length - 1
        return (
          <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
            <span className={`text-[11px] font-semibold tabular-nums ${v > 0 ? 'text-v-muted' : 'text-transparent'} group-hover:text-v-text`}>{v}</span>
            <motion.div
              className={`w-full max-w-10 rounded-t-lg rounded-b-sm ${isToday ? 'bg-v-success' : 'bg-v-success/20 group-hover:bg-v-success/40'}`}
              initial={{ height: 4 }}
              animate={{ height: Math.max(4, (v / max) * 100) }}
              transition={{ delay: 0.2 + i * 0.05, type: 'spring', stiffness: 140, damping: 18 }}
            />
            <span className={`text-[11px] font-medium ${isToday ? 'font-semibold text-v-success' : 'text-v-subtle'}`}>{labels[i]}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Ring ─────────────────────────────────────────────────────────────────────
function Ring({ value, total, size = 64 }: { value: number; total: number; size?: number }) {
  const pct = total > 0 ? value / total : 0
  const r = size / 2 - 6
  const circ = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--v-brand-from)" />
            <stop offset="100%" stopColor="var(--v-brand-to)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--v-fill)" strokeWidth="6" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ring-grad)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - pct) }}
          transition={{ delay: 0.3, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-bold tabular-nums text-v-text">{Math.round(pct * 100)}%</span>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, concept, urgent, onClick, index = 0 }: any) {
  const { icon: Icon, tone } = CONCEPT[concept as keyof typeof CONCEPT]
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.06, type: 'spring', stiffness: 200, damping: 22 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className={`group relative overflow-hidden p-5 text-left ${cardClass} ${urgent ? 'ring-1 ring-v-warning/40' : ''}`}
    >
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: 'var(--v-glow-1)' }} />
      <div className="relative flex items-start justify-between">
        <p className="text-xs font-medium text-v-muted">{label}</p>
        <span className={`grid size-10 place-items-center rounded-[30%] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${tone}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className={`relative mt-3 text-[2.6rem] font-bold leading-none tracking-tight tabular-nums ${urgent ? 'text-v-warning' : 'text-v-text'}`}>
        <CountUp value={value} />
      </p>
      <div className="relative mt-2 flex items-center justify-between">
        <p className="text-xs text-v-subtle">{sub}</p>
        <ArrowUpRight size={14} className="text-v-subtle opacity-0 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-v-accent group-hover:opacity-100" />
      </div>
    </motion.button>
  )
}

// ─── Alerta row ───────────────────────────────────────────────────────────────
function AlertaRow({ tipo, paciente, mensaje, prioridad, onClick, onDismiss }: any) {
  const { t, locale } = useI18n()
  const mensajeL = translateAlertaMensaje(String(mensaje || ''), locale)
  // Detecta alertas positivas (logros) por prefijo del tipo
  const tipoStr = String(tipo || '')
  const esLogro = tipoStr.startsWith('logro_') || tipoStr === 'criterio_alcanzado'

  // Normaliza prioridad — acepta números (1,2,3) y strings ('alta','media','baja')
  const prioridadNum = (() => {
    if (typeof prioridad === 'number') return prioridad
    const p = String(prioridad || '').toLowerCase()
    if (p === 'alta' || p === 'high' || p === 'urgent') return 1
    if (p === 'media' || p === 'medium') return 2
    if (p === 'baja' || p === 'low' || p === 'info') return 3
    return 2
  })()

  const kind = esLogro ? 'logro' : tipoStr.startsWith('sin_sesion') ? 'sinSesion' : prioridadNum === 1 ? 'urgente' : 'alertas'
  const { icon: Icon, tone } = CONCEPT[kind]

  // Etiqueta legible del tipo
  const tipoLabel = (() => {
    if (tipoStr.startsWith('logro_dominio')) return t('dashboard.lblCriterioAlcanzado')
    if (tipoStr.startsWith('logro_cerca_dominio')) return t('dashboard.lblFalta1Sesion')
    if (tipoStr.startsWith('logro_progreso')) return t('dashboard.lblProgresoConsistente')
    if (tipoStr.startsWith('logro_criterio')) return t('dashboard.lblCriterioDominado')
    if (tipoStr === 'criterio_alcanzado') return t('dashboard.lblCriterioDominado')
    if (tipoStr.startsWith('sin_sesion')) return t('dashboard.lblSinSesion')
    return tipoStr.replace(/_[0-9a-f-]{8,}$/i, '').replace(/_/g, ' ')
  })()

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="group flex items-center gap-3 rounded-v-sm px-3 py-3 transition-colors hover:bg-v-fill"
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${tone}`}><Icon size={15} /></span>
      <button onClick={onClick} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-v-text">{paciente || mensajeL}</p>
          {tipo && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{tipoLabel}</span>}
        </div>
        {paciente && mensajeL && <p className="mt-0.5 line-clamp-2 text-xs text-v-muted">{mensajeL}</p>}
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <button onClick={onClick} aria-label={tipoLabel}
          className="grid size-7 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-accent-soft hover:text-v-accent">
          <ChevronRight size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss?.() }}
          title={t('dashboard.descartarAlerta')}
          className="grid size-7 place-items-center rounded-full text-v-subtle opacity-60 transition-all hover:bg-v-danger/10 hover:text-v-danger group-hover:opacity-100">
          <X size={13} />
        </button>
      </div>
    </motion.div>
  )
}

// ─── Cita row ─────────────────────────────────────────────────────────────────
function CitaRow({ cita, index }: any) {
  const { t, locale } = useI18n()
  const fecha = new Date((cita.fecha || cita.appointment_date) + 'T00:00:00')
  const hoy = new Date().toISOString().split('T')[0]
  const esHoy = (cita.fecha || cita.appointment_date) === hoy
  const mes = fecha.toLocaleString(locale === 'en' ? 'en' : 'es', { month: 'short' }).toUpperCase()
  const dia = fecha.getDate()
  const nombre = cita.children?.name || cita.paciente || 'Paciente'
  const hora = cita.hora_inicio || cita.appointment_time
  const servicio = cita.service_type || cita.tipo || ''
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index }}
      className={`flex items-center gap-3 rounded-v-sm p-3 transition-colors ${esHoy ? 'bg-v-accent-soft' : 'hover:bg-v-fill'}`}
    >
      <div className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-[30%] ${esHoy ? 'v-brand' : 'bg-v-fill text-v-muted'}`}>
        <span className="text-[8px] font-bold leading-none">{mes}</span>
        <span className="text-base font-bold leading-none">{dia}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-v-text">{nombre}</p>
        <p className="flex items-center gap-1 text-[11px] text-v-muted">
          {hora && <><Clock size={10} /> {hora.slice(0, 5)}</>}
          {servicio && <span className="truncate"> · {servicio}</span>}
        </p>
      </div>
      {esHoy && <span className="shrink-0 rounded-full bg-v-accent px-2 py-0.5 text-[10px] font-bold text-white">{t('common.hoy')}</span>}
    </motion.div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function DashboardHome({ navigateTo, navigateToPatient }: { navigateTo: (view: string) => void; navigateToPatient?: (childId: string, tab?: string) => void }) {
  const { t, locale } = useI18n()

  // State
  const [metricas, setMetricas] = useState<any>(null)
  const [proximasCitas, setProximasCitas] = useState<any[]>([])
  const [alertasClinicas, setAlertasClinicas] = useState<any[]>([])
  const [actividadReciente, setActividadReciente] = useState<any[]>([])
  const [programasActivos, setProgramasActivos] = useState<any[]>([])
  const [totalProgramasAba, setTotalProgramasAba] = useState<number>(0)
  const [sesSemanales, setSesSemanales] = useState<number[]>([0,0,0,0,0,0,0])
  const [diasLabels, setDiasLabels] = useState<string[]>(['L','M','M','J','V','S','D'])
  const [sinSesion, setSinSesion] = useState<any[]>([])
  const [sesHoyCount, setSesHoyCount] = useState(0)
  const [horaActual, setHoraActual] = useState<Date | null>(null)
  const [diaStr, setDiaStr] = useState('')
  const [saludo, setSaludo] = useState('')
  const [loading, setLoading] = useState(true)

  // Clock
  useEffect(() => {
    const update = () => {
      const now = new Date()
      setHoraActual(now)
      setSaludo(now.getHours() < 12 ? t('dashboard.saludoManana') : now.getHours() < 19 ? t('dashboard.saludoTarde') : t('dashboard.saludoNoche'))
      setDiaStr(now.toLocaleDateString(toBCP47(locale), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
    }
    update()
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
  }, [locale])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      // 1. API de métricas (usa agenda_sesiones, agente_alertas, etc.)
      const resM = await fetch('/api/dashboard/metricas?periodo=7d', { cache: 'no-store' })
      const dataM = resM.ok ? await resM.json() : null
      setMetricas(dataM)

      // Próximas citas — fechas de hoy en adelante, no canceladas ni completadas.
      // No filtramos por hora del día: si una cita de hoy es de las 3pm y son las 5pm,
      // sigue siendo "del día de hoy" mientras no esté en estado terminal.
      const hoyStr = new Date().toISOString().split('T')[0]
      const estadosTerminados = ['cancelled', 'cancelada', 'completed', 'completada', 'done', 'realizada']
      const { data: citasDirectas } = await supabase
        .from('appointments')
        .select('*, children(name)')
        .gte('appointment_date', hoyStr)
        .not('status', 'in', `(${estadosTerminados.join(',')})`)
        .order('appointment_date').order('appointment_time')
        .limit(6)

      if (citasDirectas && citasDirectas.length > 0) {
        setProximasCitas(citasDirectas)
      } else if (dataM?.proximasSesiones?.length > 0) {
        // Fallback: agenda_sesiones via API métricas
        setProximasCitas(dataM.proximasSesiones)
      } else {
        setProximasCitas([])
      }

      // Sesiones hoy desde appointments
      const { data: aptsHoy } = await supabase
        .from('appointments')
        .select('id')
        .eq('appointment_date', hoyStr)
        .neq('status', 'cancelled')
      setSesHoyCount(aptsHoy?.length ?? dataM?.hoy?.sesiones?.total ?? 0)

      // (alertas se construyen al final junto con sin_sesion)

      // 2. Sesiones por día — usa appointments (misma fuente que el calendario)
      const labels: string[] = []
      const datesArr: string[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000)
        labels.push(d.toLocaleDateString('es', { weekday: 'short' }).charAt(0).toUpperCase())
        datesArr.push(d.toISOString().split('T')[0])
      }
      setDiasLabels(labels)

      // Fuente primaria: appointments (misma tabla que el CalendarView)
      const { data: aptsSemanales } = await supabase
        .from('appointments')
        .select('appointment_date, status')
        .gte('appointment_date', datesArr[0])
        .lte('appointment_date', datesArr[6])
        .neq('status', 'cancelled')

      if (aptsSemanales && aptsSemanales.length > 0) {
        const map: Record<string, number> = {}
        datesArr.forEach(d => { map[d] = 0 })
        aptsSemanales.forEach((a: any) => { if (map[a.appointment_date] !== undefined) map[a.appointment_date]++ })
        setSesSemanales(Object.values(map))
      } else if (dataM?.graficas?.sesionesXFecha?.length > 0) {
        // Fallback: API métricas (agenda_sesiones)
        const map: Record<string, number> = {}
        datesArr.forEach(d => { map[d] = 0 })
        dataM.graficas.sesionesXFecha.forEach((s: any) => { if (map[s.fecha] !== undefined) map[s.fecha] = s.total })
        setSesSemanales(Object.values(map))
      } else {
        // Último fallback: registro_aba
        const { data: sesABA } = await supabase
          .from('registro_aba')
          .select('fecha_sesion')
          .gte('fecha_sesion', datesArr[0])
        const map: Record<string, number> = {}
        datesArr.forEach(d => { map[d] = 0 })
        ;(sesABA || []).forEach((s: any) => { if (map[s.fecha_sesion] !== undefined) map[s.fecha_sesion]++ })
        setSesSemanales(Object.values(map))
      }

      // 3. Children map — usa /api/admin/children (supabaseAdmin, bypassa RLS)
      // FIX: No usar supabase browser client aquí porque la RLS de children filtra
      // solo los pacientes del usuario autenticado, ocultando pacientes de otros especialistas.
      const childrenResp = await adminFetch('/api/admin/children')
      const childrenData = childrenResp.ok ? await childrenResp.json() : { data: [] }
      const todosNinos: any[] = childrenData.data || []
      const ninosMap: Record<string, string> = {}
      todosNinos.forEach((n: any) => { ninosMap[n.id] = n.name })

      // Programas ABA activos con último porcentaje
      const { data: progData } = await supabase
        .from('programas_aba')
        .select('id, titulo, child_id, estado, criterio_dominio_pct, fase_actual, sesiones_datos_aba(porcentaje_exito, fecha)')
        .eq('estado', 'activo')
        .order('updated_at', { ascending: false })

      // Contar total de programas ABA activos
      const { count: countProgramas } = await supabase
        .from('programas_aba')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'activo')
      setTotalProgramasAba(countProgramas || 0)

      if (progData && progData.length > 0) {
        const enriquecidos = progData.map((p: any) => {
          const seses = (p.sesiones_datos_aba || []).sort((a: any, b: any) => b.fecha?.localeCompare(a.fecha || '') || 0)
          const ultimoPct = seses[0]?.porcentaje_exito ?? null
          const nombre = ninosMap[p.child_id] || 'Paciente'
          return { id: p.id, child_id: p.child_id, titulo: p.titulo, nombre, ultimoPct, criterio: p.criterio_dominio_pct || 90, fase: p.fase_actual }
        })
        setProgramasActivos(enriquecidos)
      }

      // Actividad reciente — agenda_sesiones realizadas (primary) + registro_aba (fallback)
      const { data: sesAgenda } = await supabase
        .from('agenda_sesiones')
        .select('id, child_id, fecha, hora_inicio, estado, tipo, children(name)')
        .in('estado', ['realizada', 'completada', 'confirmada'])
        .order('fecha', { ascending: false })
        .limit(8)

      let actividadFinal: any[] = []
      if (sesAgenda && sesAgenda.length > 0) {
        actividadFinal = sesAgenda.map((s: any) => ({
          nombrePaciente: s.children?.name || ninosMap[s.child_id] || 'Paciente',
          objetivo: s.tipo || 'Sesión terapéutica',
          fecha_sesion: s.fecha,
        }))
      } else {
        // Fallback: registro_aba
        const { data: sesABA } = await supabase
          .from('registro_aba')
          .select('child_id, fecha_sesion, datos')
          .order('fecha_sesion', { ascending: false })
          .limit(8)
        actividadFinal = (sesABA || []).map((s: any) => ({
          nombrePaciente: ninosMap[s.child_id] || 'Paciente',
          objetivo: s.datos?.objetivo_principal || s.datos?.objetivo || 'Sesión ABA',
          fecha_sesion: s.fecha_sesion,
        }))
      }
      setActividadReciente(actividadFinal)

      // 4. Pacientes sin sesión — viene del API de métricas (supabaseAdmin, bypassa RLS)
      // FIX: antes se consultaban agenda_sesiones, registro_aba, etc. con el cliente browser
      // (sujeto a RLS), mostrando solo pacientes del usuario. Ahora viene del servidor.
      const pacientesSinSesion: any[] = dataM?.pacientesSinSesion || []
      setSinSesion(pacientesSinSesion)

      // ── Alertas: consolidar en UNA sola asignación ──────────────────────────────
      const dismissed: string[] = JSON.parse(localStorage.getItem('alertas_descartadas') || '[]')

      // Alertas de agente_alertas (regresiones, etc.) — filtrar ids descartadas en BD (ya vienen con resuelta=false)
      const alertasRawTodas = (dataM?.alertas?.recientes || [])
        .filter((a: any) => !dismissed.includes((a.tipo || '') + ':' + a.child_id))

      // Consolidar SIN SESIÓN duplicadas por paciente — mostramos solo la más urgente por niño.
      // Si Sophia tiene 4 programas sin sesión, vemos 1 sola entrada que dice "4 programas".
      const sinSesionPorNino = new Map<string, any[]>()
      const otrasAlertas: any[] = []
      for (const a of alertasRawTodas) {
        const t = String(a.tipo || '')
        const esSinSesion = t === 'sin_sesion' || t.startsWith('sin_sesion_')
        if (esSinSesion && a.child_id) {
          if (!sinSesionPorNino.has(a.child_id)) sinSesionPorNino.set(a.child_id, [])
          sinSesionPorNino.get(a.child_id)!.push(a)
        } else {
          otrasAlertas.push(a)
        }
      }
      const sinSesionConsolidadas = Array.from(sinSesionPorNino.values()).map((grupo: any[]) => {
        // Tomar la alerta de mayor prioridad como representante
        const rep = grupo.sort((x, y) => {
          const px = String(x.prioridad || '').toLowerCase()
          const py = String(y.prioridad || '').toLowerCase()
          const rank: Record<string, number> = { alta: 1, media: 2, baja: 3 }
          return (rank[px] || 2) - (rank[py] || 2)
        })[0]
        const mensaje = grupo.length > 1
          ? `${grupo.length} ${t('dashboard.programasSinSesiones')}. ${rep.descripcion || rep.mensaje || ''}`
          : (rep.descripcion || rep.mensaje || '')
        return { ...rep, descripcion: mensaje, mensaje, _grupo: grupo.length }
      })

      const alertasApi = [...otrasAlertas, ...sinSesionConsolidadas].map((a: any) => ({
        id: a.id,
        tipo: a.tipo,
        child_id: a.child_id,
        paciente: a.children?.name || 'Paciente',
        mensaje: a.descripcion || a.mensaje || '',
        prioridad: a.prioridad || 2,
      }))

      // Alertas sin_sesion — evitar duplicar pacientes ya en alertasApi
      const idsEnApi = new Set(alertasApi.map((a: any) => a.child_id))
      const alertasSinSesion = pacientesSinSesion
        .filter((n: any) => {
          const key = 'sin_sesion:' + n.id
          return !dismissed.includes(key) && !idsEnApi.has(n.id)
        })
        .map((n: any) => ({
          tipo: 'sin_sesion', child_id: n.id, paciente: n.name,
          mensaje: 'Sin sesión en los últimos 30 días.', prioridad: 2,
        }))

      // Ordenar: alertas negativas (prioridad 1, 2) primero, logros (prioridad 3) al final
      const todasAlertas = [...alertasApi, ...alertasSinSesion]
      const esLogro = (a: any) => {
        const t = String(a.tipo || '')
        return t.startsWith('logro_') || t === 'criterio_alcanzado'
      }
      const prioridadNum = (p: any): number => {
        if (typeof p === 'number') return p
        const s = String(p || '').toLowerCase()
        if (s === 'alta' || s === 'high' || s === 'urgent') return 1
        if (s === 'media' || s === 'medium') return 2
        if (s === 'baja' || s === 'low' || s === 'info') return 3
        return 2
      }
      todasAlertas.sort((a, b) => {
        const aLogro = esLogro(a) ? 1 : 0
        const bLogro = esLogro(b) ? 1 : 0
        if (aLogro !== bLogro) return aLogro - bLogro
        return prioridadNum(a.prioridad) - prioridadNum(b.prioridad)
      })
      setAlertasClinicas(todasAlertas)

    } catch (e) {
      console.error('Dashboard error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Refrescar alertas para todos los pacientes (logros + alertas que ya no aplican) en segundo plano:
  // puede tardar decenas de segundos, así que no bloquea las métricas; al terminar se recarga el panel.
  useEffect(() => {
    let cancelled = false
    fetch('/api/agente/refrescar-alertas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      cache: 'no-store',
    })
      .then(r => { if (r.ok && !cancelled) cargar() })
      .catch(() => { /* silencioso */ })
    return () => { cancelled = true }
    // Solo una vez por montaje; cargar cambia con el idioma y no debe relanzar el refresco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refrescar al volver al tab — captura cambios hechos en otra ventana/dispositivo
  useEffect(() => {
    const onFocus = () => { cargar() }
    const onVisibility = () => { if (document.visibilityState === 'visible') cargar() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [cargar])

  // Derived stats
  const totalSesHoy = sesHoyCount || metricas?.hoy?.sesiones?.total || 0
  const realizadasHoy = metricas?.hoy?.sesiones?.realizadas ?? 0
  const totalPacientes = metricas?.pacientes?.total ?? 0
  const alertasUrgentes = metricas?.alertas?.urgentes ?? 0

  const dismissAlerta = useCallback(async (index: number) => {
    const alerta = alertasClinicas[index]
    setAlertasClinicas(prev => prev.filter((_, i) => i !== index))
    if (alerta?.id) {
      // Alerta de agente_alertas: marcar como resuelta en BD (persiste)
      await supabase.from('agente_alertas').update({ resuelta: true }).eq('id', alerta.id)
    } else if (alerta?.tipo && alerta?.child_id) {
      // Alerta sin ID (sin_sesion, etc.): guardar clave en localStorage
      const key = alerta.tipo + ':' + alerta.child_id
      const dismissed = JSON.parse(localStorage.getItem('alertas_descartadas') || '[]')
      if (!dismissed.includes(key)) {
        dismissed.push(key)
        localStorage.setItem('alertas_descartadas', JSON.stringify(dismissed))
      }
    }
  }, [alertasClinicas])
  const mensajesPendientes = metricas?.tareas?.formPendientes ?? 0
  const tasaAsistencia = metricas?.hoy?.tasaAsistencia ?? 0
  const totalSes7d = sesSemanales.reduce((a, b) => a + b, 0)

  const retenidos = Math.max(0, totalPacientes - sinSesion.length)

  const horaStr = horaActual ? horaActual.toLocaleTimeString(toBCP47(locale), { hour: '2-digit', minute: '2-digit' }) : '--:--'

  return (
    <div className="v-scope space-y-4 md:space-y-5">

      {/* ── HERO ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 22 }}
        className={`relative overflow-hidden ${cardClass}`}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(40rem 14rem at 0% 0%, var(--v-glow-1), transparent 70%)' }} />
        <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
        <div className="relative flex items-center justify-between gap-5 p-5 sm:p-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm text-v-muted first-letter:uppercase">{diaStr}</p>
              {/* En celular la hora va compacta junto a la fecha; en pantallas grandes, grande a la derecha */}
              <p className="v-brand-text shrink-0 text-lg font-extrabold tabular-nums tracking-tight sm:hidden">{horaStr}</p>
            </div>
            <h2 className="v-headline mt-1 text-[1.6rem] leading-tight text-v-text sm:text-[1.9rem]">
              {saludo}, <span className="v-brand-text">{t('dashboard.directora')}</span>{' '}
              <motion.span className="inline-block origin-[70%_70%]"
                animate={{ rotate: [0, 14, -8, 14, 0] }} transition={{ delay: 0.6, duration: 1.4 }}>👋</motion.span>
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${CONCEPT.sesiones.tone}`}>
                <CalendarCheck size={12} /> {totalSesHoy} {t('dashboard.sesionesHoyMin')}
              </span>
              {sinSesion.length > 0 && (
                <button onClick={() => navigateTo('ninos')} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-transform hover:scale-105 ${CONCEPT.sinSesion.tone}`}>
                  <AlertTriangle size={12} /> {sinSesion.length} {t('dashboard.sinSesion30dInline')}
                </button>
              )}
              {alertasUrgentes > 0 && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${CONCEPT.urgente.tone}`}>
                  <AlertCircle size={12} /> {alertasUrgentes} {t('dashboard.alertasUrgentesInline')}
                </span>
              )}
            </div>
          </div>
          <p className="v-brand-text hidden shrink-0 text-5xl font-extrabold tabular-nums tracking-tight sm:block">{horaStr}</p>
        </div>
      </motion.div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <KPI index={0} label={t('pacientes.titulo')} value={totalPacientes} sub={t('dashboard.totalRegistrados')} concept="pacientes" onClick={() => navigateTo('ninos')} />
        <KPI index={1} label={t('dashboard.sesionesHoy')} value={totalSesHoy} sub={`${realizadasHoy} ${t('dashboard.realizadasLbl')}`} concept="sesiones" onClick={() => navigateTo('agenda')} />
        <KPI index={2} label={t('dashboard.sinSesion30d')} value={sinSesion.length} sub={t('dashboard.requierenSeguimiento')} concept="sinSesion" urgent={sinSesion.length > 0} onClick={() => navigateTo('ninos')} />
        <KPI index={3} label={t('nav.programas')} value={totalProgramasAba} sub={t('programas.activos')} concept="programas" onClick={() => navigateTo('ninos')} />
      </div>

      {/* ── MÉTRICAS MEDIAS ── */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">

        {/* Sesiones 7 días + Retención */}
        <Section index={4} className="flex flex-col">
          <SectionHeader concept="sesiones" title={t('dashboard.sesionesUlt7')}>
            <span className="text-2xl font-bold tabular-nums text-v-success"><CountUp value={totalSes7d} /></span>
          </SectionHeader>
          <div className="relative flex-1 px-5">
            <BarChart values={sesSemanales} labels={diasLabels} />
            {totalSes7d === 0 && !loading && (
              <div className="absolute inset-x-5 top-8 flex justify-center">
                <span className="rounded-full border border-v-border bg-v-elevated px-3 py-1 text-xs text-v-muted shadow-v">
                  {t('vanty.home.noSessionsWeek')}
                </span>
              </div>
            )}
          </div>
          <div className="mx-5 mt-4 mb-5 flex items-center gap-4 rounded-v-sm bg-v-fill p-4">
            <Ring value={retenidos} total={totalPacientes} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-v-muted">{t('dashboard.retencionActiva')}</p>
              <p className="mt-0.5 text-xl font-bold leading-none text-v-text">
                <CountUp value={retenidos} /><span className="ml-1 text-sm font-medium text-v-subtle">/ {totalPacientes}</span>
              </p>
              <p className="mt-1 text-xs text-v-subtle">{t('dashboard.pacientesSesionReciente')}</p>
            </div>
            <TrendingUp size={18} className="shrink-0 text-v-success" />
          </div>
        </Section>

        {/* Programas ABA activos */}
        <Section index={5} className="flex flex-col">
          <SectionHeader concept="programas" title={t('dashboard.programasActivos')} count={programasActivos.length}>
            <button onClick={() => navigateTo('ninos')} className="inline-flex items-center gap-1 text-xs font-semibold text-v-accent hover:underline">
              {t('common.verTodos')} <ArrowRight size={12} />
            </button>
          </SectionHeader>
          {programasActivos.length > 0 ? (
            <div className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 pb-4" style={{ maxHeight: 330, scrollbarWidth: 'thin' }}>
              {programasActivos.map((p, i) => {
                const pct = p.ultimoPct ?? 0
                const done = p.ultimoPct !== null && pct >= p.criterio
                const bar = done ? 'bg-v-success' : pct >= 60 ? 'bg-v-warning' : 'v-brand'
                const text = done ? 'text-v-success' : pct >= 60 ? 'text-v-warning' : 'text-v-accent'
                return (
                  <motion.button
                    key={p.id ?? i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + Math.min(i, 8) * 0.04 }}
                    className="block w-full rounded-v-sm px-2 py-2.5 text-left transition-colors hover:bg-v-fill"
                    onClick={() => {
                      if (p.child_id && navigateToPatient) navigateToPatient(p.child_id, 'programas')
                      else navigateTo('ninos')
                    }}
                    title={p.nombre}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-v-text">{p.titulo}</p>
                        <p className="truncate text-[11px] text-v-subtle">{p.nombre}</p>
                      </div>
                      <span className={`shrink-0 text-sm font-bold tabular-nums ${p.ultimoPct !== null ? text : 'text-v-subtle'}`}>
                        {p.ultimoPct !== null ? `${p.ultimoPct}%` : '—'}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-v-fill">
                      <motion.div className={`h-full rounded-full ${bar}`}
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.4 + Math.min(i, 8) * 0.05, duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
                    </div>
                  </motion.button>
                )
              })}
            </div>
          ) : (
            <EmptyState icon={ClipboardList} text={t('auto.dashboardHome.sinProgramasActivos')} action={t('vanty.home.createProgram')} onAction={() => navigateTo('ninos')} />
          )}
        </Section>
      </div>

      {/* ── PANEL INFERIOR ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Alertas clínicas */}
        <Section index={6} className="flex flex-col overflow-hidden">
          <SectionHeader concept="alertas" title={t('dashboard.alertasClinicas')} count={alertasClinicas.length} />
          <div className="flex-1 overflow-y-auto px-2 pb-3" style={{ maxHeight: 360, scrollbarWidth: 'thin' }}>
            {alertasClinicas.length > 0 ? (
              <AnimatePresence initial={false}>
                {alertasClinicas.map((a, i) => (
                  <AlertaRow key={a.id ?? `${a.tipo}:${a.child_id}`} {...a}
                    onClick={() => {
                      if (a.child_id && navigateToPatient) {
                        const tab = (a.tipo === 'regresion' || a.tipo?.startsWith('regresion')) ? 'programas' : undefined
                        navigateToPatient(a.child_id, tab)
                      } else navigateTo('ninos')
                    }}
                    onDismiss={() => dismissAlerta(i)}
                  />
                ))}
              </AnimatePresence>
            ) : (
              <EmptyState icon={CheckCircle2} tone="text-v-success" text={t('dashboard.sinAlertas')} />
            )}
          </div>
        </Section>

        {/* Próximas citas */}
        <Section index={7} className="flex flex-col overflow-hidden">
          <SectionHeader concept="citas" title={t('dashboard.proximasCitas')} count={proximasCitas.length}>
            <button
              onClick={() => cargar()}
              disabled={loading}
              title={t('dashboard.refrescarDatos')}
              className="grid size-7 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-fill hover:text-v-accent disabled:opacity-40"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => navigateTo('agenda')} className="inline-flex items-center gap-1 text-xs font-semibold text-v-accent hover:underline">
              {t('agenda.verCalendario')} <ArrowUpRight size={12} />
            </button>
          </SectionHeader>
          <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-3" style={{ maxHeight: 360, scrollbarWidth: 'thin' }}>
            {proximasCitas.length > 0
              ? proximasCitas.map((c, i) => <CitaRow key={c.id ?? i} cita={c} index={i} />)
              : <EmptyState icon={Calendar} text={t('agenda.sinCitas')} action={t('agenda.agendarAhora')} onAction={() => navigateTo('agenda')} />}
          </div>
        </Section>
      </div>
    </div>
  )
}
