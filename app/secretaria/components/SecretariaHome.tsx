'use client'
// app/secretaria/components/SecretariaHome.tsx
// Inicio de secretaría: saludo, accesos rápidos, indicadores de citas, semana, resumen y citas de hoy / próximas.

import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import {
  Calendar, CalendarDays, Users, CheckCircle2, XCircle, AlertCircle, ArrowRight, Clock, TrendingUp, BarChart3,
  DollarSign, CalendarClock, Sun, Video, MapPin,
} from 'lucide-react'
import { motion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const cardClass = 'rounded-v border border-v-border bg-v-elevated shadow-v'
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const ESTADO: Record<string, { tone: string; dot: string }> = {
  confirmed: { tone: 'bg-v-success/15 text-v-success', dot: 'bg-v-success' },
  pending: { tone: 'bg-v-warning/15 text-v-warning', dot: 'bg-v-warning' },
  cancelled: { tone: 'bg-v-danger/10 text-v-danger', dot: 'bg-v-danger' },
  completed: { tone: 'bg-v-accent-soft text-v-accent', dot: 'bg-v-accent' },
  realizada: { tone: 'bg-v-accent-soft text-v-accent', dot: 'bg-v-accent' },
}

function Titulo({ Icon, texto, n, accion }: { Icon: any; texto: string; n?: number; accion?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-v-border px-4 py-3.5 sm:px-5">
      <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-v-text">
        <span className="grid size-8 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Icon size={15} /></span>
        <span className="truncate">{texto}</span>
        {!!n && <span className="rounded-full bg-v-accent px-2 py-0.5 text-[10px] font-bold text-white">{n}</span>}
      </p>
      {accion && <button onClick={accion.onClick} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-v-accent hover:underline">{accion.label} <ArrowRight size={12} /></button>}
    </div>
  )
}

function Vacio({ Icon, titulo, sub }: { Icon: any; titulo: string; sub?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-v-fill text-v-subtle"><Icon size={20} /></span>
      <p className="mt-3 text-sm font-semibold text-v-text">{titulo}</p>
      {sub && <p className="mt-0.5 text-xs text-v-muted">{sub}</p>}
    </div>
  )
}

function Cita({ apt }: { apt: any }) {
  const { t, locale } = useI18n()
  const L = (e: string, s: string) => (locale === 'en' ? e : s)
  const f = new Date(apt.appointment_date + 'T00:00:00')
  const esHoy = apt.appointment_date === iso(new Date())
  const e = ESTADO[apt.status] || ESTADO.confirmed
  return (
    <div className="flex items-center gap-3 rounded-v-sm p-2.5 transition-colors hover:bg-v-fill/60">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-v-sm text-center leading-none ${esHoy ? 'v-brand' : 'bg-v-fill text-v-text'}`} style={esHoy ? { boxShadow: 'none' } : undefined}>
        <span><span className="block text-[9px] font-semibold uppercase opacity-70">{f.toLocaleDateString(toBCP47(locale), { month: 'short' }).replace('.', '')}</span><span className="block text-sm font-bold">{f.getDate()}</span></span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-v-text">{apt.children?.name || apt.patient_name || L('Patient', 'Paciente')}</span>
        <span className="flex items-center gap-1 truncate text-xs text-v-subtle">
          <Clock size={10} /> {apt.appointment_time?.slice(0, 5) || '—'}
          {apt.is_virtual ? <><span>·</span><Video size={10} /></> : <><span>·</span><MapPin size={10} /></>}
          {apt.therapist_name && <span className="truncate">· {apt.therapist_name}</span>}
        </span>
      </span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.tone}`}>{t('estado.' + apt.status)}</span>
    </div>
  )
}

interface Props { onNavigate?: (view: string) => void; nombre?: string }

export default function SecretariaHome({ onNavigate, nombre }: Props) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const bcp = toBCP47(locale)
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [ahora, setAhora] = useState<Date | null>(null)
  const [stats, setStats] = useState({ hoy: 0, semana: 0, pendientes: 0, canceladas: 0, pacientes: 0, completadas: 0 })
  const [citasHoy, setCitasHoy] = useState<any[]>([])
  const [proximas, setProximas] = useState<any[]>([])
  const [recientes, setRecientes] = useState<any[]>([])
  const [semana, setSemana] = useState<{ label: string; n: number; hoy: boolean }[]>([])

  useEffect(() => {
    setAhora(new Date())
    const iv = setInterval(() => setAhora(new Date()), 1000)
    return () => clearInterval(iv)
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const hoy = new Date()
      const hoyStr = iso(hoy)
      const dow = hoy.getDay()
      const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1))
      const dias = Array.from({ length: 7 }, (_, i) => { const d = new Date(lunes); d.setDate(lunes.getDate() + i); return d })
      const hace30 = new Date(hoy.getTime() - 30 * 86400000)

      const [{ data: todas, error }, { count: nPac }] = await Promise.all([
        supabase.from('appointments').select('*, children(name)').gte('appointment_date', iso(hace30)).order('appointment_date').order('appointment_time').limit(400),
        supabase.from('children').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ])
      if (error) throw error
      const apts = todas || []
      const activas = apts.filter(a => a.status !== 'cancelled')
      const semanaIso = dias.map(iso)
      setSemana(dias.map((d, i) => ({ label: d.toLocaleDateString(bcp, { weekday: 'short' }).replace('.', ''), n: activas.filter(a => a.appointment_date === semanaIso[i]).length, hoy: semanaIso[i] === hoyStr })))
      setCitasHoy(apts.filter(a => a.appointment_date === hoyStr))
      setProximas(activas.filter(a => a.appointment_date > hoyStr).slice(0, 6))
      setRecientes(apts.filter(a => a.appointment_date < hoyStr).reverse().slice(0, 6))
      setStats({
        hoy: activas.filter(a => a.appointment_date === hoyStr).length,
        semana: activas.filter(a => semanaIso.includes(a.appointment_date)).length,
        pendientes: apts.filter(a => a.status === 'pending' && a.appointment_date >= hoyStr).length,
        canceladas: apts.filter(a => a.status === 'cancelled' && a.appointment_date <= hoyStr).length,
        pacientes: nPac || 0,
        completadas: apts.filter(a => ['completed', 'realizada'].includes(a.status)).length,
      })
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bcp])
  useEffect(() => { cargar() }, [cargar])

  const hora = ahora?.getHours() ?? 12
  const saludo = hora < 12 ? L('Good morning', 'Buenos días') : hora < 19 ? L('Good afternoon', 'Buenas tardes') : L('Good evening', 'Buenas noches')
  const fecha = ahora ? ahora.toLocaleDateString(bcp, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const primerNombre = (nombre || '').split(' ')[0]
  const maxDia = Math.max(1, ...semana.map(d => d.n))
  const v = (x: number) => (loading ? '—' : x)
  const ir = (x: string) => onNavigate?.(x)
  const listaDerecha = proximas.length ? proximas : recientes

  const kpis = [
    { label: L('Today', 'Citas hoy'), value: v(stats.hoy), sub: L('Scheduled', 'Programadas'), Icon: Sun, tone: 'bg-v-accent-soft text-v-accent', go: 'agenda' },
    { label: L('Pending', 'Pendientes'), value: v(stats.pendientes), sub: L('To confirm', 'Por confirmar'), Icon: AlertCircle, tone: 'bg-v-warning/15 text-v-warning', go: 'agenda' },
    { label: L('Cancelled', 'Canceladas'), value: v(stats.canceladas), sub: L('Last 30 days', 'Últimos 30 días'), Icon: XCircle, tone: 'bg-v-danger/10 text-v-danger', go: 'agenda' },
    { label: L('Completed', 'Completadas'), value: v(stats.completadas), sub: L('Last 30 days', 'Últimos 30 días'), Icon: CheckCircle2, tone: 'bg-v-success/15 text-v-success', go: 'agenda' },
  ]
  const acciones = [
    { Icon: Calendar, label: L('Schedule', 'Agenda'), go: 'agenda', brand: true },
    { Icon: DollarSign, label: L('Payments', 'Pagos'), go: 'pagos' },
    { Icon: TrendingUp, label: L('Reports', 'Reportes'), go: 'reportes-financieros' },
  ]

  return (
    <div className="v-scope space-y-3 pb-8 sm:space-y-4 md:space-y-5">
      {/* Saludo */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }} className={`relative overflow-hidden ${cardClass}`}>
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(40rem 14rem at 0% 0%, var(--v-glow-1), transparent 70%)' }} />
        <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
        <div className="relative flex flex-col gap-5 p-4 sm:p-6 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm text-v-muted first-letter:uppercase">{fecha}</p>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-v-elevated px-2.5 py-1 text-xs font-semibold tabular-nums text-v-accent shadow-v lg:hidden"><Clock size={12} /> {ahora ? ahora.toLocaleTimeString(bcp, { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
            </div>
            <h2 className="v-headline mt-1 text-[1.75rem] leading-tight text-v-text sm:text-[2rem]">{saludo}{primerNombre && <>, <span className="v-brand-text">{primerNombre}</span></>}</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-v-accent-soft px-3 py-1 text-xs font-semibold text-v-accent"><Calendar size={12} /> {stats.hoy} {stats.hoy === 1 ? L('appointment today', 'cita hoy') : L('appointments today', 'citas hoy')}</span>
              {!loading && stats.pendientes > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-v-warning/15 px-3 py-1 text-xs font-semibold text-v-warning"><AlertCircle size={12} /> {stats.pendientes} {L('to confirm', 'por confirmar')}</span>}
            </div>
            <div className="mt-5 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 sm:flex sm:flex-wrap">
              {acciones.map(a => (
                <button key={a.go} onClick={() => ir(a.go)}
                  className={`inline-flex flex-col items-center justify-center gap-1 rounded-v-sm px-2 py-2.5 text-xs font-semibold sm:h-10 sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-4 sm:py-0 sm:text-sm ${a.brand ? 'v-brand' : 'border border-v-border bg-v-elevated text-v-text hover:bg-v-fill'}`}>
                  <a.Icon size={16} className={a.brand ? '' : 'text-v-accent'} /> {a.label}
                </button>
              ))}
            </div>
          </div>
          <div className="hidden shrink-0 text-right lg:block">
            <p className="v-headline v-brand-text text-6xl tabular-nums leading-none">{ahora ? ahora.toLocaleTimeString(bcp, { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
            <p className="mt-2 text-xs text-v-subtle">{L('Local time', 'Hora local')}</p>
          </div>
        </div>
      </motion.div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
        {kpis.map((k, i) => (
          <motion.button key={k.label} onClick={() => ir(k.go)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}
            className={`${cardClass} p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-v-accent/40 sm:p-5`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-v-muted">{k.label}</p>
              <span className={`grid size-8 shrink-0 place-items-center rounded-[30%] sm:size-9 ${k.tone}`}><k.Icon size={15} /></span>
            </div>
            <p className="v-headline mt-2 text-[1.75rem] tabular-nums text-v-text sm:text-3xl">{k.value}</p>
            <p className="mt-0.5 truncate text-xs text-v-subtle">{k.sub}</p>
          </motion.button>
        ))}
      </div>

      {/* Semana + resumen */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`${cardClass} overflow-hidden`}>
          <Titulo Icon={BarChart3} texto={L('This week', 'Esta semana')} accion={{ label: L('Schedule', 'Agenda'), onClick: () => ir('agenda') }} />
          <div className="p-4 sm:p-5">
            <div className="flex items-baseline gap-2">
              <p className="v-headline text-3xl tabular-nums text-v-text">{v(stats.semana)}</p>
              <p className="text-sm text-v-muted">{L('appointments Mon–Sun', 'citas de lunes a domingo')}</p>
            </div>
            <div className="mt-4 flex h-28 items-end gap-1.5 sm:h-32 sm:gap-2">
              {semana.map((d, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className={`text-[11px] font-semibold tabular-nums ${d.n ? 'text-v-text' : 'text-v-subtle'}`}>{d.n || ''}</span>
                  <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(6, (d.n / maxDia) * 100)}%` }} transition={{ delay: 0.15 + i * 0.04, type: 'spring', stiffness: 120, damping: 18 }}
                    className={`w-full max-w-12 rounded-t-v-sm ${d.hoy ? 'v-brand' : d.n ? 'bg-v-accent/35' : 'bg-v-fill'}`} style={d.hoy ? { boxShadow: 'none' } : undefined} />
                  <span className={`text-[11px] capitalize ${d.hoy ? 'font-semibold text-v-accent' : 'text-v-subtle'}`}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className={`${cardClass} flex flex-col overflow-hidden`}>
          <Titulo Icon={TrendingUp} texto={L('Summary', 'Resumen')} />
          <div className="flex flex-1 flex-col justify-center gap-2 p-3 sm:p-4">
            {[
              { Icon: Users, tone: 'bg-v-accent-soft text-v-accent', label: L('Active patients', 'Pacientes activos'), value: stats.pacientes },
              { Icon: CalendarClock, tone: 'bg-v-success/15 text-v-success', label: L('Upcoming appointments', 'Próximas citas'), value: proximas.length },
              { Icon: CheckCircle2, tone: 'bg-[#8b5cf6]/12 text-[#8b5cf6]', label: L('Completed (30 d)', 'Completadas (30 d)'), value: stats.completadas },
            ].map(r => (
              <div key={r.label} className="flex items-center gap-3 rounded-v-sm bg-v-fill/50 p-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] ${r.tone}`}><r.Icon size={16} /></span>
                <span className="flex-1 text-sm text-v-muted">{r.label}</span>
                <span className="text-xl font-bold tabular-nums text-v-text">{v(r.value)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Hoy + próximas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className={`${cardClass} flex flex-col overflow-hidden`}>
          <Titulo Icon={Sun} texto={L('Today', 'Hoy')} n={citasHoy.length} accion={{ label: L('View schedule', 'Ver agenda'), onClick: () => ir('agenda') }} />
          {loading ? <div className="space-y-2 p-3">{[1, 2, 3].map(i => <div key={i} className="h-14 animate-pulse rounded-v-sm bg-v-fill" />)}</div>
            : citasHoy.length === 0 ? <Vacio Icon={Calendar} titulo={L('No appointments today', 'Sin citas para hoy')} sub={L('New bookings for today will appear here.', 'Las citas de hoy aparecerán aquí.')} />
              : <div className="space-y-1 p-2">{citasHoy.map(a => <Cita key={a.id} apt={a} />)}</div>}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className={`${cardClass} flex flex-col overflow-hidden`}>
          <Titulo Icon={CalendarDays} texto={proximas.length ? L('Upcoming appointments', 'Próximas citas') : L('Recent appointments', 'Citas recientes')} accion={{ label: L('View all', 'Ver todas'), onClick: () => ir('agenda') }} />
          {loading ? <div className="space-y-2 p-3">{[1, 2, 3].map(i => <div key={i} className="h-14 animate-pulse rounded-v-sm bg-v-fill" />)}</div>
            : listaDerecha.length === 0 ? <Vacio Icon={CalendarDays} titulo={L('No appointments recorded', 'Sin citas registradas')} sub={L('Book the first one from the schedule.', 'Agenda la primera desde la agenda.')} />
              : <div className="space-y-1 p-2">{listaDerecha.map(a => <Cita key={a.id} apt={a} />)}</div>}
        </motion.div>
      </div>
    </div>
  )
}
