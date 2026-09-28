'use client'
// app/especialista/components/EspecialistaHome.tsx
// Inicio del especialista: saludo, indicadores, actividad de la semana, evaluaciones, pacientes y citas de hoy.

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import { useState, useEffect, useCallback } from 'react'
import {
  FileText, Clock, CheckCircle2, XCircle, Calendar, ChevronRight, ArrowRight, Plus, Brain, Users, Heart,
  AlertTriangle, Target, BarChart3, Trophy, CalendarCheck, Activity, ClipboardList,
} from 'lucide-react'
import { motion } from 'motion/react'
import { supabase } from '@/lib/supabase'

interface Props {
  userId: string
  profile: any
  setActiveView: (v: string) => void
}

const TIPS_CLINICOS = [
  { Icon: Target, es: 'Registra las conductas objetivo con antecedente, conducta y consecuencia (ABC) para mejorar la calidad de tu análisis ABA.', en: 'Record target behaviors with antecedent, behavior and consequence (ABC) to improve the quality of your ABA analysis.' },
  { Icon: BarChart3, es: 'Cuando un objetivo supera el 80% de dominio por 3 sesiones consecutivas, es momento de proponer un nuevo objetivo.', en: 'When a goal exceeds 80% mastery for 3 consecutive sessions, it is time to propose a new goal.' },
  { Icon: Heart, es: 'Pregunta brevemente al padre o madre cómo se ha sentido esta semana. El bienestar del cuidador influye directamente en el progreso del niño.', en: 'Briefly ask the parent how they have felt this week. The caregiver’s well-being directly influences the child’s progress.' },
  { Icon: FileText, es: 'Las notas de sesión con observaciones específicas son más útiles que las generales. Detalla cada avance con datos concretos.', en: 'Session notes with specific observations are more useful than general ones. Detail each advance with concrete data.' },
  { Icon: Trophy, es: 'Celebra los micro-logros con el niño y la familia. Un objetivo alcanzado, por pequeño que sea, merece reconocimiento.', en: 'Celebrate micro-wins with the child and family. A goal reached, however small, deserves recognition.' },
]

const cardClass = 'rounded-v border border-v-border bg-v-elevated shadow-v'
const TONOS = ['bg-v-accent-soft text-v-accent', 'bg-v-success/15 text-v-success', 'bg-v-warning/15 text-v-warning', 'bg-[#8b5cf6]/12 text-[#8b5cf6]']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function Titulo({ Icon, texto, accion }: { Icon: any; texto: string; accion?: { label: string; onClick: () => void } }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-v-text"><span className="grid size-8 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Icon size={15} /></span><span className="truncate">{texto}</span></p>
      {accion && <button onClick={accion.onClick} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-v-accent hover:underline">{accion.label} <ArrowRight size={12} /></button>}
    </div>
  )
}

function Vacio({ Icon, texto, accion }: { Icon: any; texto: string; accion?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-v-fill text-v-subtle"><Icon size={20} /></span>
      <p className="mt-3 text-sm text-v-muted">{texto}</p>
      {accion && <button onClick={accion.onClick} className="mt-3 inline-flex h-8 items-center gap-1 rounded-full bg-v-accent-soft px-3.5 text-xs font-semibold text-v-accent hover:bg-v-accent hover:text-white">{accion.label} <ArrowRight size={12} /></button>}
    </div>
  )
}

export default function EspecialistaHome({ userId, profile, setActiveView }: Props) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const bcp = toBCP47(locale)

  const [stats, setStats] = useState({ pendientes: 0, aprobadas: 0, rechazadas: 0, citasHoy: 0, totalPacientes: 0, citas7: 0, sinSesion: 0 })
  const [recientes, setRecientes] = useState<any[]>([])
  const [citasHoy, setCitasHoy] = useState<any[]>([])
  const [ultimaSesion, setUltimaSesion] = useState<string | null>(null)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [semana, setSemana] = useState<{ label: string; n: number; hoy: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [tipIdx, setTipIdx] = useState(() => Math.floor(Math.random() * TIPS_CLINICOS.length))
  const tip = TIPS_CLINICOS[tipIdx]
  const [ahora, setAhora] = useState<Date | null>(null)

  useEffect(() => {
    setAhora(new Date())
    const iv = setInterval(() => setAhora(new Date()), 1000)
    return () => clearInterval(iv)
  }, [])

  const cargar = useCallback(async () => {
    try {
      const hoy = new Date()
      const hoyIso = iso(hoy)
      const dias = Array.from({ length: 7 }, (_, i) => new Date(hoy.getTime() - (6 - i) * 86400000))
      const desde7 = iso(dias[0])
      const desde30 = iso(new Date(hoy.getTime() - 30 * 86400000))

      const [subRes, citHoyRes, nRes, semRes, ultRes, act30Res, recRes, pacRes] = await Promise.all([
        supabase.from('specialist_submissions').select('status').eq('specialist_id', userId),
        supabase.from('appointments').select('appointment_date, appointment_time, status, children(name)').eq('appointment_date', hoyIso).neq('status', 'cancelled').order('appointment_time'),
        supabase.from('children').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('appointments').select('appointment_date').neq('status', 'cancelled').gte('appointment_date', desde7).lte('appointment_date', hoyIso),
        supabase.from('appointments').select('appointment_date').neq('status', 'cancelled').lte('appointment_date', hoyIso).order('appointment_date', { ascending: false }).limit(1),
        supabase.from('appointments').select('child_id').neq('status', 'cancelled').gte('appointment_date', desde30).lte('appointment_date', hoyIso),
        supabase.from('specialist_submissions').select('id, titulo, status, created_at, children(name)').eq('specialist_id', userId).order('created_at', { ascending: false }).limit(5),
        supabase.from('children').select('id, name, birth_date').eq('is_active', true).order('created_at', { ascending: false }).limit(8),
      ])

      const subs = subRes.data || []
      const porDia: Record<string, number> = {}
      ;(semRes.data || []).forEach((s: any) => { porDia[s.appointment_date] = (porDia[s.appointment_date] || 0) + 1 })
      setSemana(dias.map(d => ({ label: d.toLocaleDateString(bcp, { weekday: 'short' }).replace('.', ''), n: porDia[iso(d)] || 0, hoy: iso(d) === hoyIso })))

      const total = nRes.count || 0
      const conSesion = new Set((act30Res.data || []).map((a: any) => a.child_id).filter(Boolean)).size
      const ult = ultRes.data?.[0]?.appointment_date
      setUltimaSesion(ult ? new Date(ult + 'T00:00:00').toLocaleDateString(bcp, { day: 'numeric', month: 'short' }) : null)

      setStats({
        pendientes: subs.filter((s: any) => s.status === 'pending_approval').length,
        aprobadas: subs.filter((s: any) => s.status === 'approved').length,
        rechazadas: subs.filter((s: any) => s.status === 'rejected').length,
        citasHoy: (citHoyRes.data || []).length,
        totalPacientes: total,
        citas7: (semRes.data || []).length,
        sinSesion: Math.max(0, total - conSesion),
      })
      setCitasHoy(citHoyRes.data || [])
      setRecientes(recRes.data || [])
      setPacientes(pacRes.data || [])
    } finally { setLoading(false) }
  }, [userId, bcp])

  useEffect(() => { cargar() }, [cargar])

  const nombre = (profile?.full_name || '').trim().split(/\s+/)[0] || ''
  const hora = ahora?.getHours() ?? 12
  const saludo = hora < 12 ? L('Good morning', 'Buenos días') : hora < 19 ? L('Good afternoon', 'Buenas tardes') : L('Good evening', 'Buenas noches')
  const fecha = ahora ? ahora.toLocaleDateString(bcp, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const totalEvals = stats.aprobadas + stats.pendientes + stats.rechazadas
  const conSesion = stats.totalPacientes - stats.sinSesion
  const retencion = stats.totalPacientes ? Math.round((conSesion / stats.totalPacientes) * 100) : 0
  const maxDia = Math.max(1, ...semana.map(d => d.n))
  const v = (x: any) => (loading ? '—' : x)

  const kpis = [
    { label: L('Patients', 'Pacientes'), value: v(stats.totalPacientes), sub: L('Active', 'Activos'), Icon: Users, tone: TONOS[0], go: 'pacientes' },
    { label: L('Appointments', 'Citas'), value: v(stats.citas7), sub: L('Last 7 days', 'Últimos 7 días'), Icon: CalendarCheck, tone: TONOS[1], go: 'agenda' },
    { label: L('Assessments', 'Evaluaciones'), value: v(totalEvals), sub: stats.pendientes ? L(`${stats.pendientes} under review`, `${stats.pendientes} en revisión`) : L('Total recorded', 'Total registradas'), Icon: ClipboardList, tone: TONOS[2], go: 'formularios' },
    { label: L('Last session', 'Última sesión'), value: v(ultimaSesion ?? '—'), sub: L('Most recent date', 'Fecha más reciente'), Icon: Activity, tone: TONOS[3], go: 'agenda' },
  ]
  const ESTADO: Record<string, { label: string; tone: string; Icon: any }> = {
    pending_approval: { label: L('Under review', 'En revisión'), tone: 'bg-v-warning/15 text-v-warning', Icon: Clock },
    approved: { label: L('Approved', 'Aprobada'), tone: 'bg-v-success/15 text-v-success', Icon: CheckCircle2 },
    rejected: { label: L('Rejected', 'Rechazada'), tone: 'bg-v-danger/10 text-v-danger', Icon: XCircle },
  }

  return (
    <div className="v-scope space-y-3 sm:space-y-4 md:space-y-5">
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
            <h2 className="v-headline mt-1 text-[1.75rem] leading-tight text-v-text sm:text-[2rem]">{saludo}{nombre && <>, <span className="v-brand-text">{nombre}</span></>}</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-v-accent-soft px-3 py-1 text-xs font-semibold text-v-accent"><Calendar size={12} /> {stats.citasHoy} {stats.citasHoy === 1 ? L('session today', 'sesión hoy') : L('sessions today', 'sesiones hoy')}</span>
              {stats.pendientes > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-v-warning/15 px-3 py-1 text-xs font-semibold text-v-warning"><Clock size={12} /> {stats.pendientes} {L('under review', 'en revisión')}</span>}
              {!loading && stats.sinSesion > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-v-danger/10 px-3 py-1 text-xs font-semibold text-v-danger"><AlertTriangle size={12} /> {stats.sinSesion} {L('without a session (30d)', 'sin sesión (30 d)')}</span>}
            </div>
            <div className="mt-5 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 sm:flex sm:flex-wrap">
              <button onClick={() => setActiveView('formularios')} className="v-brand inline-flex flex-col items-center justify-center gap-1 rounded-v-sm px-2 py-2.5 text-xs font-semibold sm:h-10 sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-4 sm:py-0 sm:text-sm"><Plus size={16} /> <span className="sm:hidden">{L('Assess', 'Evaluar')}</span><span className="hidden sm:inline">{L('New assessment', 'Nueva evaluación')}</span></button>
              <button onClick={() => setActiveView('agenda')} className="border border-v-border bg-v-elevated text-v-text hover:bg-v-fill inline-flex flex-col items-center justify-center gap-1 rounded-v-sm px-2 py-2.5 text-xs font-semibold sm:h-10 sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-4 sm:py-0 sm:text-sm"><Calendar size={16} className="text-v-accent" /> {L('My schedule', 'Mi agenda')}</button>
              <button onClick={() => setActiveView('pacientes')} className="border border-v-border bg-v-elevated text-v-text hover:bg-v-fill inline-flex flex-col items-center justify-center gap-1 rounded-v-sm px-2 py-2.5 text-xs font-semibold sm:h-10 sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-4 sm:py-0 sm:text-sm"><Users size={16} className="text-v-accent" /> {L('Patients', 'Pacientes')}</button>
            </div>
          </div>
          <div className="hidden shrink-0 text-right lg:block">
            <p className="v-headline v-brand-text text-5xl tabular-nums leading-none sm:text-6xl">{ahora ? ahora.toLocaleTimeString(bcp, { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
            <p className="mt-2 text-xs text-v-subtle">{L('Local time', 'Hora local')}</p>
          </div>
        </div>
      </motion.div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
        {kpis.map((k, i) => (
          <motion.button key={k.label} onClick={() => setActiveView(k.go)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}
            className={`${cardClass} group p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-v-accent/40 sm:p-5`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-v-muted">{k.label}</p>
              <span className={`grid size-8 shrink-0 place-items-center rounded-[30%] sm:size-9 ${k.tone}`}><k.Icon size={15} /></span>
            </div>
            <p className="v-headline mt-2 truncate text-[1.75rem] tabular-nums text-v-text sm:text-3xl">{k.value}</p>
            <p className="mt-0.5 truncate text-xs text-v-subtle">{k.sub}</p>
          </motion.button>
        ))}
      </div>

      {/* Semana + evaluaciones */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className={`${cardClass} flex flex-col p-4 sm:p-5`}>
          <Titulo Icon={BarChart3} texto={L('Sessions · last 7 days', 'Sesiones · últimos 7 días')} />
          <div className="flex h-24 items-end gap-1.5 sm:h-32 sm:gap-2">
            {semana.map((d, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className={`text-[11px] font-semibold tabular-nums ${d.n ? 'text-v-text' : 'text-v-subtle'}`}>{d.n || ''}</span>
                <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(6, (d.n / maxDia) * 100)}%` }} transition={{ delay: 0.15 + i * 0.04, type: 'spring', stiffness: 120, damping: 18 }}
                  className={`w-full max-w-10 rounded-t-v-sm ${d.hoy ? 'v-brand' : d.n ? 'bg-v-accent/35' : 'bg-v-fill'}`} style={d.hoy ? { boxShadow: 'none' } : undefined} />
                <span className={`text-[11px] capitalize ${d.hoy ? 'font-semibold text-v-accent' : 'text-v-subtle'}`}>{d.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-4 rounded-v-sm bg-v-fill/60 p-4">
            <div className="relative size-16 shrink-0">
              <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" className="stroke-v-border" />
                <motion.circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" strokeLinecap="round" className="stroke-v-success"
                  strokeDasharray="97.4" initial={{ strokeDashoffset: 97.4 }} animate={{ strokeDashoffset: 97.4 * (1 - retencion / 100) }} transition={{ duration: 0.9 }} />
              </svg>
              <span className="absolute inset-0 grid place-items-center text-xs font-bold tabular-nums text-v-text">{v(`${retencion}%`)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-v-text">{L('Active retention', 'Retención activa')}</p>
              <p className="text-lg font-bold tabular-nums text-v-text">{v(conSesion)} <span className="text-sm font-medium text-v-subtle">/ {v(stats.totalPacientes)}</span></p>
              <p className="text-xs text-v-muted">{L('patients with a session in the last 30 days', 'pacientes con sesión en los últimos 30 días')}</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className={`${cardClass} flex flex-col p-4 sm:p-5`}>
          <Titulo Icon={ClipboardList} texto={L('My recent assessments', 'Mis evaluaciones recientes')} accion={{ label: L('View all', 'Ver todas'), onClick: () => setActiveView('formularios') }} />
          <div className="mb-4 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
            {[[stats.aprobadas, L('Approved', 'Aprobadas'), 'text-v-success'], [stats.pendientes, L('Under review', 'En revisión'), 'text-v-warning'], [stats.rechazadas, L('Rejected', 'Rechazadas'), 'text-v-danger']].map(([n, t, c]) => (
              <div key={t as string} className="rounded-v-sm bg-v-fill/60 px-3 py-2.5 text-center">
                <p className={`text-xl font-bold tabular-nums ${c}`}>{v(n)}</p>
                <p className="truncate text-[11px] text-v-muted">{t}</p>
              </div>
            ))}
          </div>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 animate-pulse rounded-v-sm bg-v-fill" />)}</div>
          ) : recientes.length === 0 ? (
            <Vacio Icon={FileText} texto={L('No assessments yet', 'Aún no hay evaluaciones')} accion={{ label: L('Create assessment', 'Crear evaluación'), onClick: () => setActiveView('formularios') }} />
          ) : (
            <div className="space-y-2">
              {recientes.slice(0, 4).map((r: any) => {
                const e = ESTADO[r.status] || ESTADO.pending_approval
                return (
                  <button key={r.id} onClick={() => setActiveView('formularios')} className="group flex w-full items-center gap-3 rounded-v-sm border border-v-border bg-v-bg p-3 text-left transition-colors hover:border-v-accent/40">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] ${e.tone}`}><e.Icon size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-v-text">{r.titulo}</span>
                      <span className="block truncate text-xs text-v-subtle">{[r.children?.name, new Date(r.created_at).toLocaleDateString(bcp, { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline ${e.tone}`}>{e.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Pacientes + hoy */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`${cardClass} flex flex-col p-4 sm:p-5`}>
          <Titulo Icon={Users} texto={L('My patients', 'Mis pacientes')} accion={{ label: stats.totalPacientes > 8 ? L(`View all (${stats.totalPacientes})`, `Ver todos (${stats.totalPacientes})`) : L('View all', 'Ver todos'), onClick: () => setActiveView('pacientes') }} />
          {loading ? (
            <div className="grid gap-2 sm:grid-cols-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-16 animate-pulse rounded-v-sm bg-v-fill" />)}</div>
          ) : pacientes.length === 0 ? (
            <Vacio Icon={Users} texto={L('No active patients', 'Sin pacientes activos')} />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {pacientes.map((p: any, i) => {
                const edad = p.birth_date ? Math.floor((Date.now() - new Date(p.birth_date).getTime()) / (365.25 * 86400000)) : null
                const ini = p.name?.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
                return (
                  <motion.button key={p.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.22 + i * 0.03 }} onClick={() => setActiveView('pacientes')}
                    className="group flex items-center gap-3 rounded-v-sm border border-v-border bg-v-bg p-3 text-left transition-colors hover:border-v-accent/40">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold ${TONOS[i % TONOS.length]}`}>{ini}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-v-text">{p.name}</span>
                      {edad !== null && <span className="block text-xs text-v-subtle">{edad} {edad === 1 ? L('year', 'año') : L('years', 'años')}</span>}
                    </span>
                    <ChevronRight size={15} className="shrink-0 text-v-subtle transition-transform group-hover:translate-x-0.5" />
                  </motion.button>
                )
              })}
            </div>
          )}
          {stats.totalPacientes > pacientes.length && (
            <div className="mt-auto pt-3">
              <button onClick={() => setActiveView('pacientes')}
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-v-sm border border-dashed border-v-border text-sm font-semibold text-v-accent transition-colors hover:border-v-accent/40 hover:bg-v-accent-soft/40">
                <Users size={15} /> {L(`See all ${stats.totalPacientes} patients`, `Ver los ${stats.totalPacientes} pacientes`)} <ArrowRight size={14} />
              </button>
            </div>
          )}
        </motion.div>

        <div className="flex flex-col gap-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className={`${cardClass} flex flex-1 flex-col p-4 sm:p-5`}>
            <Titulo Icon={Calendar} texto={L("Today's appointments", 'Citas de hoy')} accion={{ label: L('Schedule', 'Agenda'), onClick: () => setActiveView('agenda') }} />
            {citasHoy.length === 0 ? (
              <Vacio Icon={Calendar} texto={L('No appointments for today', 'No hay citas para hoy')} accion={{ label: L('Open schedule', 'Abrir agenda'), onClick: () => setActiveView('agenda') }} />
            ) : (
              <div className="space-y-2">
                {citasHoy.map((c: any, i) => (
                  <button key={i} onClick={() => setActiveView('agenda')} className="flex w-full items-center gap-3 rounded-v-sm border border-v-border bg-v-bg p-3 text-left hover:border-v-accent/40">
                    <span className="v-brand grid h-11 w-14 shrink-0 place-items-center rounded-v-sm text-sm font-bold tabular-nums" style={{ boxShadow: 'none' }}>{c.appointment_time?.slice(0, 5) || '—'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-v-text">{c.children?.name || L('Patient', 'Paciente')}</span>
                      <span className="block text-xs text-v-subtle">{L('Therapy session', 'Sesión de terapia')}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Tip clínico: tarjeta de marca, se puede pasar al siguiente */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }} className="v-brand relative overflow-hidden rounded-v p-5 text-white">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/10" />
            <div aria-hidden className="pointer-events-none absolute -bottom-14 right-16 size-28 rounded-full bg-white/[0.07]" />
            <div className="relative flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-xs font-semibold text-white/85"><Brain size={14} /> {L('Clinical tip', 'Tip clínico')} <span className="tabular-nums text-white/60">{tipIdx + 1}/{TIPS_CLINICOS.length}</span></p>
              <div className="flex gap-1">
                <button onClick={() => setTipIdx(i => (i - 1 + TIPS_CLINICOS.length) % TIPS_CLINICOS.length)} aria-label={L('Previous tip', 'Tip anterior')} className="grid size-7 place-items-center rounded-full bg-white/15 transition-colors hover:bg-white/25"><ChevronRight size={14} className="rotate-180" /></button>
                <button onClick={() => setTipIdx(i => (i + 1) % TIPS_CLINICOS.length)} aria-label={L('Next tip', 'Siguiente tip')} className="grid size-7 place-items-center rounded-full bg-white/15 transition-colors hover:bg-white/25"><ChevronRight size={14} /></button>
              </div>
            </div>
            <motion.div key={tipIdx} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="relative mt-4 flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-white/20 backdrop-blur"><tip.Icon size={18} /></span>
              <p className="text-[15px] font-medium leading-relaxed">{en ? tip.en : tip.es}</p>
            </motion.div>
            <p className="relative mt-4 flex items-center gap-1.5 text-xs text-white/75"><Heart size={12} /> {L('Your work makes a real difference for every family.', 'Tu trabajo hace una diferencia real en cada familia.')}</p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
