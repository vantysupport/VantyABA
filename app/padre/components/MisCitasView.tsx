'use client'
// Agenda del portal de familias — mismo lenguaje visual que el resto de Vanty:
// tarjetas v-*, un tono por estado de cita, calendario animado y sin emojis.

import { useCentroBranding } from '@/components/CentroBrandingContext'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import {
  CalendarDays, CalendarCheck, Clock, CheckCircle2, XCircle, AlertCircle,
  Phone, Video, ChevronLeft, ChevronRight, Mail, MapPin, MessageCircle, RefreshCw, Baby, ListChecks,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import VideoCallModal from '@/components/VideoCallModal'
import ConectarCalendarios from './ConectarCalendarios'

interface Appointment {
  id: string; child_id: string; parent_id: string
  appointment_date: string; appointment_time: string
  service_type: string; status: string; notes: string
  is_group: boolean; group_name: string; type: string
  children?: { name: string; birth_date: string }
}
interface Props {
  profile: any; selectedChild: any
  onCancelAppointment: (cita: { id: string; appointment_date: string; appointment_time: string | null; service_type?: string | null }, reschedule: boolean) => void
  onChangeView: (view: string) => void
}

const cardClass = 'rounded-v border border-v-border bg-v-elevated shadow-v'

// Un tono por estado, igual en el calendario, el detalle y la lista
const ESTADO: Record<string, { es: string; en: string; chip: string; solid: string; Icon: any }> = {
  confirmed: { es: 'Confirmada',    en: 'Confirmed', chip: 'bg-v-accent-soft text-v-accent',   solid: 'bg-v-accent',  Icon: CheckCircle2 },
  pending:   { es: 'Por confirmar', en: 'Pending',   chip: 'bg-v-warning/15 text-v-warning',   solid: 'bg-v-warning', Icon: AlertCircle },
  cancelled: { es: 'Cancelada',     en: 'Cancelled', chip: 'bg-v-danger/10 text-v-danger',     solid: 'bg-v-danger',  Icon: XCircle },
  completed: { es: 'Realizada',     en: 'Done',      chip: 'bg-v-success/15 text-v-success',   solid: 'bg-v-success', Icon: CheckCircle2 },
}
const estadoDe = (s: string) => ESTADO[s === 'realizada' || s === 'completada' ? 'completed' : s] || ESTADO.confirmed

function fmt(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function EmptyState({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
      <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="grid size-12 place-items-center rounded-full bg-v-fill">
        <Icon size={20} className="text-v-subtle" />
      </motion.span>
      <p className="mt-3 text-sm font-semibold text-v-text">{title}</p>
      <p className="mt-1 max-w-[16rem] text-xs text-v-muted">{text}</p>
    </div>
  )
}

export default function MisCitasView({ profile, selectedChild, onCancelAppointment, onChangeView }: Props) {
  const CONTACTO = useCentroBranding()
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const bcp = toBCP47(locale)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const hoy = isoLocal(new Date())
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>(hoy)
  const [videoSession, setVideoSession] = useState<any>(null)
  const [activeVid, setActiveVid] = useState<Record<string, any>>({})
  const [mes, setMes] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [dir, setDir] = useState(0)

  const año = mes.getFullYear()
  const mesN = mes.getMonth()
  const primerDia = new Date(año, mesN, 1).getDay()
  const diasEnMes = new Date(año, mesN + 1, 0).getDate()
  const celdasFinal = (7 - ((primerDia + diasEnMes) % 7)) % 7

  const porFecha: Record<string, Appointment[]> = {}
  appointments.forEach(a => { (porFecha[a.appointment_date] ??= []).push(a) })

  const citasDelDia = (porFecha[diaSeleccionado] || []).slice().sort((a, b) => (a.appointment_time || '').localeCompare(b.appointment_time || ''))
  const proximasCitas = appointments.filter(a => a.appointment_date >= hoy && a.status !== 'cancelled').slice(0, 12)
  const completadas = appointments.filter(a => ['completed', 'realizada', 'completada'].includes(a.status)).length
  const nombresDias = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleDateString(bcp, { weekday: 'short' }).replace('.', ''))
  const tituloMes = mes.toLocaleDateString(bcp, { month: 'long' })

  const pollVid = useCallback(async (apts: Appointment[]) => {
    const virt = apts.filter(a => (a as any).modalidad === 'virtual' && a.appointment_date >= isoLocal(new Date()) && (a.status === 'confirmed' || a.status === 'pending'))
    if (!virt.length) return
    const res: Record<string, any> = {}
    await Promise.all(virt.map(async apt => {
      try { const r = await fetch(`/api/video-call?appointment_id=${apt.id}`); const d = await r.json(); if (d.session?.roomUrl) res[apt.id] = d.session } catch { /* sin sala */ }
    }))
    setActiveVid(res)
  }, [])

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    const [{ data: kids1 }, { data: parentLinks }] = await Promise.all([
      supabase.from('children').select('id').eq('parent_id', profile.id),
      supabase.from('parent_accounts').select('child_id').eq('user_id', profile.id),
    ])
    const allChildIds = [...new Set([...(kids1 || []).map((c: any) => c.id), ...(parentLinks || []).map((p: any) => p.child_id)])]
    let q = supabase.from('appointments').select('*, children(name, birth_date)').order('appointment_date', { ascending: true }).order('appointment_time', { ascending: true })
    if (selectedChild?.id) q = q.eq('child_id', selectedChild.id)
    else if (allChildIds.length > 0) q = q.or([...allChildIds.map((id: string) => `child_id.eq.${id}`), `parent_id.eq.${profile.id}`].join(','))
    else q = q.eq('parent_id', profile.id)
    const { data } = await q
    setAppointments(data || [])
    pollVid(data || [])
    setLoading(false)
  }, [profile?.id, selectedChild?.id, pollVid])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!appointments.length) return
    const i = setInterval(() => pollVid(appointments), 15000)
    return () => clearInterval(i)
  }, [appointments, pollVid])

  const irMes = (delta: number) => { setDir(delta); setMes(new Date(año, mesN + delta, 1)) }
  const irHoy = () => { const d = new Date(); setDir(0); setMes(new Date(d.getFullYear(), d.getMonth(), 1)); setDiaSeleccionado(hoy) }
  const elegirCita = (c: Appointment) => {
    const f = new Date(c.appointment_date + 'T00:00:00')
    setDir(0); setMes(new Date(f.getFullYear(), f.getMonth(), 1)); setDiaSeleccionado(c.appointment_date)
  }

  const kpis = [
    { n: proximasCitas.length, label: L('Upcoming', 'Próximas'), Icon: CalendarDays, tone: 'bg-v-accent-soft text-v-accent' },
    { n: completadas, label: L('Done', 'Realizadas'), Icon: CalendarCheck, tone: 'bg-v-success/15 text-v-success' },
    { n: appointments.length, label: L('Total', 'Total'), Icon: ListChecks, tone: 'bg-v-fill text-v-muted' },
  ]
  const fechaSel = diaSeleccionado ? new Date(diaSeleccionado + 'T00:00:00') : null
  // Resumen del mes que se está viendo y últimas sesiones (ya pasadas)
  const prefijoMes = `${año}-${String(mesN + 1).padStart(2, '0')}`
  const delMes = appointments.filter(a => a.appointment_date.startsWith(prefijoMes))
  const resumenMes = [
    { n: delMes.length, label: L('Appointments', 'Citas'), tone: 'text-v-text' },
    { n: delMes.filter(a => ['completed', 'realizada', 'completada'].includes(a.status)).length, label: L('Done', 'Realizadas'), tone: 'text-v-success' },
    { n: delMes.filter(a => a.status === 'cancelled').length, label: L('Cancelled', 'Canceladas'), tone: 'text-v-danger' },
  ]
  const recientes = appointments.filter(a => a.appointment_date < hoy).slice(-5).reverse()

  return (
    <div className="v-scope space-y-4 pb-20 md:space-y-5 md:pb-8">
      {videoSession && (
        <VideoCallModal roomUrl={videoSession.roomUrl} sessionId={videoSession.sessionId}
          appointmentId={videoSession.appointmentId} participantName={profile?.full_name || L('Parent', 'Padre/Madre')}
          onClose={() => { setVideoSession(null); load() }} />
      )}

      {/* ── Encabezado ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="v-headline text-[1.6rem] leading-tight text-v-text sm:text-[1.9rem]">
            {L('Sessions of ', 'Sesiones de ')}<span className="v-brand-text">{selectedChild?.name?.split(' ')[0] || L('your child', 'tu hijo/a')}</span>
          </h2>
          <p className="mt-1 text-sm text-v-muted">{L('The center schedules them; here you see all of them.', 'El centro las programa; aquí las ves todas.')}</p>
        </motion.div>
        <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 sm:flex">
          {kpis.map(({ n, label, Icon, tone }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, type: 'spring', stiffness: 240, damping: 24 }}
              className={`${cardClass} flex items-center gap-2.5 px-3 py-2.5 sm:min-w-[120px]`}>
              <span className={`hidden size-8 shrink-0 place-items-center rounded-[30%] sm:grid ${tone}`}><Icon size={15} /></span>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-none tabular-nums text-v-text">{n}</p>
                <p className="mt-1 truncate text-[11px] font-medium text-v-muted">{label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-8">
        {/* ── Calendario ── */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 24 }}
          className={`${cardClass} overflow-hidden`}>
          <div className="flex items-center gap-2 px-4 py-3.5 sm:px-5">
            <h3 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-v-text">
              <span className="capitalize">{tituloMes}</span> <span className="font-medium text-v-subtle">{año}</span>
            </h3>
            <button onClick={irHoy} className="h-8 rounded-full bg-v-fill px-3 text-xs font-semibold text-v-text transition-colors hover:bg-v-accent-soft hover:text-v-accent">{L('Today', 'Hoy')}</button>
            <button onClick={() => irMes(-1)} aria-label={L('Previous month', 'Mes anterior')} className="grid size-8 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text"><ChevronLeft size={17} /></button>
            <button onClick={() => irMes(1)} aria-label={L('Next month', 'Mes siguiente')} className="grid size-8 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text"><ChevronRight size={17} /></button>
          </div>

          <div className="grid grid-cols-7 border-y border-v-border bg-v-fill/50">
            {nombresDias.map((d, i) => (
              <div key={i} className={`py-2 text-center text-[11px] font-semibold uppercase tracking-wide ${i === 0 || i === 6 ? 'text-v-subtle' : 'text-v-muted'}`}>{d}</div>
            ))}
          </div>

          <div className="relative overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.div key={`${año}-${mesN}`} custom={dir}
                initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -40 }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                className="grid grid-cols-7">
                {Array.from({ length: primerDia }, (_, i) => <div key={`e-${i}`} className="min-h-[56px] border-b border-r border-v-border sm:min-h-[92px]" />)}
                {Array.from({ length: diasEnMes }, (_, i) => {
                  const dia = i + 1
                  const fechaStr = `${año}-${String(mesN + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
                  const citasDia = porFecha[fechaStr] || []
                  const esHoy = fechaStr === hoy
                  const esSel = fechaStr === diaSeleccionado
                  const finde = (primerDia + i) % 7 === 0 || (primerDia + i) % 7 === 6
                  return (
                    <button key={dia} onClick={() => setDiaSeleccionado(fechaStr)}
                      className={`group relative flex min-h-[56px] flex-col gap-1 border-b border-r border-v-border p-1 text-left transition-colors sm:min-h-[92px] sm:p-1.5 ${finde ? 'bg-v-fill/30' : ''} hover:bg-v-fill/60`}>
                      {esSel && <motion.span layoutId="agenda-dia-sel" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0.5 rounded-v-sm bg-v-accent-soft ring-1 ring-v-accent/30" />}
                      <span className={`relative grid size-6 place-items-center rounded-full text-[11px] font-semibold tabular-nums sm:size-7 sm:text-xs ${esHoy ? 'v-brand' : citasDia.length ? 'text-v-text' : 'text-v-subtle'}`}
                        style={esHoy ? { boxShadow: 'none' } : undefined}>{dia}</span>
                      {/* Celular: puntos; pantallas grandes: la hora de cada cita */}
                      <span className="relative flex gap-0.5 px-0.5 sm:hidden">
                        {citasDia.slice(0, 3).map((c, k) => <span key={k} className={`size-1.5 rounded-full ${estadoDe(c.status).solid}`} />)}
                      </span>
                      <span className="relative hidden w-full flex-col gap-0.5 sm:flex">
                        {citasDia.slice(0, 2).map((c, k) => {
                          const e = estadoDe(c.status)
                          return (
                            <span key={k} className={`flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${e.chip}`}>
                              {(c as any).modalidad === 'virtual' ? <Video size={9} className="shrink-0" /> : <MapPin size={9} className="shrink-0" />}
                              <span className="truncate tabular-nums">{fmt(c.appointment_time)}</span>
                            </span>
                          )
                        })}
                        {citasDia.length > 2 && <span className="px-1 text-[10px] font-semibold text-v-subtle">+{citasDia.length - 2}</span>}
                      </span>
                    </button>
                  )
                })}
                {Array.from({ length: celdasFinal }, (_, i) => <div key={`f-${i}`} className="min-h-[56px] border-b border-r border-v-border sm:min-h-[92px]" />)}
              </motion.div>
            </AnimatePresence>
            {loading && <div className="absolute inset-0 grid place-items-center bg-v-elevated/60"><RefreshCw size={18} className="animate-spin text-v-accent" /></div>}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 sm:px-5">
            {(['confirmed', 'pending', 'completed', 'cancelled'] as const).map(k => (
              <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-v-muted">
                <span className={`size-2 rounded-full ${ESTADO[k].solid}`} /> {en ? ESTADO[k].en : ESTADO[k].es}
              </span>
            ))}
          </div>
        </motion.section>

        {/* ── Este mes + sesiones recientes (se estira hasta igualar la columna derecha) ── */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, type: 'spring', stiffness: 180, damping: 24 }}
          className={`${cardClass} grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]`}>
          <div className="flex flex-col border-b border-v-border p-5 md:border-b-0 md:border-r">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-[30%] bg-v-success/15 text-v-success"><CalendarCheck size={15} /></span>
              <p className="text-[15px] font-semibold tracking-tight text-v-text">{L('This month', 'Este mes')} <span className="font-medium capitalize text-v-subtle">· {tituloMes}</span></p>
            </div>
            <div className="mt-4 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
              {resumenMes.map(({ n, label, tone }) => (
                <div key={label} className="rounded-v-sm bg-v-fill px-3 py-3 text-center">
                  <p className={`text-2xl font-bold leading-none tabular-nums ${tone}`}>{n}</p>
                  <p className="mt-1.5 truncate text-[11px] font-medium text-v-muted">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-auto pt-4">
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="font-medium text-v-muted">{L('Attendance', 'Asistencia')}</span>
                <span className="font-semibold tabular-nums text-v-text">{delMes.length ? Math.round(resumenMes[1].n / delMes.length * 100) : 0}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-v-fill">
                <motion.div key={prefijoMes} className="h-full rounded-full bg-v-success" initial={{ width: 0 }}
                  animate={{ width: `${delMes.length ? resumenMes[1].n / delMes.length * 100 : 0}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
              </div>
              <p className="mt-2 text-[11px] text-v-subtle">{L('Done out of the appointments of the month.', 'Realizadas sobre las citas del mes.')}</p>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2.5 px-5 pb-2 pt-5">
              <span className="grid size-8 shrink-0 place-items-center rounded-[30%] bg-v-fill text-v-muted"><ListChecks size={15} /></span>
              <p className="text-[15px] font-semibold tracking-tight text-v-text">{L('Recent sessions', 'Sesiones recientes')}</p>
            </div>
            {recientes.length === 0 ? (
              <EmptyState icon={ListChecks} title={L('No past sessions yet', 'Aún no hay sesiones pasadas')} text={L('When sessions take place, you will see them here.', 'Cuando se realicen sesiones las verás aquí.')} />
            ) : (
              <ul className="space-y-0.5 px-3 pb-3">
                {recientes.map(c => {
                  const f = new Date(c.appointment_date + 'T00:00:00')
                  const e = estadoDe(c.status)
                  return (
                    <li key={c.id}>
                      <button onClick={() => elegirCita(c)} className="flex w-full items-center gap-3 rounded-v-sm px-2 py-2 text-left transition-colors hover:bg-v-fill">
                        <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-v-muted">{f.toLocaleDateString(bcp, { day: 'numeric', month: 'short' }).replace('.', '')}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-v-text">{c.service_type || c.type || L('ABA therapy', 'Terapia ABA')}</span>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.chip}`}><e.Icon size={10} /> {en ? e.en : e.es}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </motion.section>
        </div>

        {/* ── Panel derecho ── */}
        <div className="flex flex-col gap-4 xl:col-span-4">
          <ConectarCalendarios userId={profile?.id} />
          {/* Día seleccionado */}
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, type: 'spring', stiffness: 180, damping: 24 }}
            className={`${cardClass} flex flex-col`}>
            <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
              <span className="grid size-8 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><CalendarDays size={15} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-v-subtle">{diaSeleccionado === hoy ? L('Today', 'Hoy') : L('Selected day', 'Día seleccionado')}</p>
                <p className="truncate text-[15px] font-semibold tracking-tight text-v-text first-letter:uppercase">
                  {fechaSel?.toLocaleDateString(bcp, { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              <span className="rounded-full bg-v-fill px-2.5 py-1 text-[11px] font-semibold tabular-nums text-v-muted">{citasDelDia.length}</span>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={diaSeleccionado} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                {citasDelDia.length === 0 ? (
                  <EmptyState icon={CalendarDays} title={L('No sessions this day', 'Sin sesiones este día')} text={L('Pick a day with appointments in the calendar.', 'Elige en el calendario un día con citas.')} />
                ) : (
                  <ul className="space-y-2 px-4 pb-4">
                    {citasDelDia.map(c => {
                      const e = estadoDe(c.status)
                      const roomUrl = activeVid[c.id]?.roomUrl || (c as any).video_link
                      const activa = c.status === 'confirmed' || c.status === 'pending'
                      const futura = c.appointment_date >= hoy
                      return (
                        <li key={c.id} className="rounded-v-sm bg-v-fill p-3.5">
                          <div className="flex items-start gap-3">
                            <span className={`mt-0.5 h-9 w-1 shrink-0 rounded-full ${e.solid}`} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-v-text">{c.service_type || c.type || L('ABA therapy', 'Terapia ABA')}</p>
                              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-v-muted">
                                <span className="inline-flex items-center gap-1"><Clock size={11} /> {fmt(c.appointment_time)}</span>
                                <span className="inline-flex items-center gap-1">{(c as any).modalidad === 'virtual' ? <><Video size={11} /> {L('Online', 'Virtual')}</> : <><MapPin size={11} /> {L('In person', 'Presencial')}</>}</span>
                                {c.children?.name && !selectedChild?.id && <span className="inline-flex items-center gap-1"><Baby size={11} /> {c.children.name}</span>}
                              </p>
                            </div>
                            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.chip}`}><e.Icon size={10} /> {en ? e.en : e.es}</span>
                          </div>
                          {(c as any).metadata?.reprogramacion?.estado === 'solicitada' && (
                            <p className="mt-2.5 flex items-center gap-1.5 rounded-full bg-v-accent-soft px-3 py-1.5 text-[11px] font-semibold text-v-accent">
                              <RefreshCw size={11} /> {L('Change requested for', 'Cambio solicitado para el')} {(c as any).metadata.reprogramacion.fecha}{(c as any).metadata.reprogramacion.hora ? ` · ${(c as any).metadata.reprogramacion.hora}` : ''}
                            </p>
                          )}
                          {roomUrl && activa && (
                            <a href={roomUrl} target="_blank" rel="noopener noreferrer"
                              className="v-brand mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-full text-xs font-semibold">
                              <Video size={13} /> {L('Join video call', 'Unirse a la videollamada')}
                            </a>
                          )}
                          {activa && futura && (c as any).metadata?.reprogramacion?.estado !== 'solicitada' && (
                            <div className="mt-3 flex gap-2">
                              <button onClick={() => onCancelAppointment(c, true)} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full bg-v-elevated text-xs font-semibold text-v-accent transition-transform active:scale-95">
                                <RefreshCw size={12} /> {L('Reschedule', 'Reprogramar')}
                              </button>
                              <button onClick={() => onCancelAppointment(c, false)} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full bg-v-elevated text-xs font-semibold text-v-danger transition-transform active:scale-95">
                                <XCircle size={12} /> {L('Cancel', 'Cancelar')}
                              </button>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.section>

          {/* Próximas sesiones */}
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, type: 'spring', stiffness: 180, damping: 24 }}
            className={`${cardClass} flex flex-1 flex-col`}>
            <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
              <span className="grid size-8 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Clock size={15} /></span>
              <p className="flex-1 text-[15px] font-semibold tracking-tight text-v-text">{L('Upcoming sessions', 'Próximas sesiones')}</p>
              {proximasCitas.length > 0 && <span className="rounded-full bg-v-accent-soft px-2 py-0.5 text-[10px] font-bold text-v-accent">{proximasCitas.length}</span>}
            </div>
            {!loading && proximasCitas.length === 0 ? (
              <EmptyState icon={CalendarCheck} title={L('No upcoming sessions', 'Sin sesiones próximas')} text={L('The center schedules the appointments; they will show up here.', 'El centro programa las citas; aparecerán aquí.')} />
            ) : (
              <ul className="max-h-80 space-y-1 overflow-y-auto px-3 pb-3" style={{ scrollbarWidth: 'thin' }}>
                {proximasCitas.map((c, i) => {
                  const f = new Date(c.appointment_date + 'T00:00:00')
                  const esHoyC = c.appointment_date === hoy
                  const e = estadoDe(c.status)
                  return (
                    <motion.li key={c.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i }}>
                      <button onClick={() => elegirCita(c)} className="group flex w-full items-center gap-3 rounded-v-sm px-2 py-2.5 text-left transition-colors hover:bg-v-fill">
                        <span className={`grid w-11 shrink-0 place-items-center rounded-v-sm py-1.5 text-center ${esHoyC ? 'v-brand' : 'bg-v-fill text-v-text'}`} style={esHoyC ? { boxShadow: 'none' } : undefined}>
                          <span className="text-[10px] font-semibold uppercase leading-none opacity-80">{f.toLocaleDateString(bcp, { month: 'short' }).replace('.', '')}</span>
                          <span className="text-base font-bold leading-tight tabular-nums">{f.getDate()}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-v-text">{c.service_type || c.type || L('ABA therapy', 'Terapia ABA')}</span>
                          <span className="mt-0.5 block truncate text-xs text-v-muted first-letter:uppercase">
                            {esHoyC ? L('Today', 'Hoy') : f.toLocaleDateString(bcp, { weekday: 'long' })} · {fmt(c.appointment_time)}
                          </span>
                        </span>
                        <span className={`size-2 shrink-0 rounded-full ${e.solid}`} title={en ? e.en : e.es} />
                        <ChevronRight size={15} className="shrink-0 text-v-subtle transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </motion.li>
                  )
                })}
              </ul>
            )}
          </motion.section>

          {/* Contacto con el centro */}
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, type: 'spring', stiffness: 180, damping: 24 }}
            className={`${cardClass} relative overflow-hidden p-5`}>
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(22rem 10rem at 100% 0%, var(--v-glow-1), transparent 70%)' }} />
            <div className="relative flex items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><MessageCircle size={15} /></span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold tracking-tight text-v-text">{L('Need a change?', '¿Necesitas un cambio?')}</p>
                <p className="text-xs text-v-muted">{L('Changes, cancellations or new appointments', 'Cambios, cancelaciones o nuevas citas')}</p>
              </div>
            </div>
            <p className="relative mt-3 text-sm leading-relaxed text-v-muted">
              {L('Appointments are scheduled by the center team. Reach out and they will help you.', 'Las citas las programa el equipo del centro. Escríbeles y te ayudarán.')}
            </p>
            <div className="relative mt-4 flex flex-col gap-2">
              <button onClick={() => onChangeView('chat-familias')} className="v-brand inline-flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold">
                <MessageCircle size={15} /> {L('Write to the center', 'Escribir al centro')}
              </button>
              <div className="flex gap-2">
                {CONTACTO.telefono && (
                  <a href={`tel:+${CONTACTO.telefonoDigitos}`} className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-v-fill px-3 text-sm font-semibold text-v-text transition-colors hover:bg-v-accent-soft hover:text-v-accent">
                    <Phone size={14} className="shrink-0" /> <span className="truncate">{L('Call', 'Llamar')}</span>
                  </a>
                )}
                {CONTACTO.email && (
                  <a href={`mailto:${CONTACTO.email}`} className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-v-fill px-3 text-sm font-semibold text-v-text transition-colors hover:bg-v-accent-soft hover:text-v-accent">
                    <Mail size={14} className="shrink-0" /> <span className="truncate">{L('Email', 'Correo')}</span>
                  </a>
                )}
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  )
}
