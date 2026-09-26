'use client'
// app/especialista/components/MiAgenda.tsx
// Agenda del especialista: calendario mensual, detalle del día y próximas citas. Sincroniza con Google / Outlook.

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import { useState, useEffect, useCallback } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Clock, Loader2, CalendarDays, Check, Video, MapPin, CalendarCheck, CalendarClock, Sun } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { confirmar } from '@/components/ui/confirmar'

const cardClass = 'rounded-v border border-v-border bg-v-elevated shadow-v'
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function GoogleLogo() {
  return <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
}
function MicrosoftLogo() {
  return <svg width="13" height="13" viewBox="0 0 21 21" aria-hidden><rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" /><rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" /></svg>
}

/* ── Conectar calendario externo (Google / Outlook) ─────────────────────── */
function CalendarioExterno({ userId, api, param, nombre, Logo }: { userId: string; api: string; param: string; nombre: string; Logo: () => React.ReactElement }) {
  const { locale } = useI18n()
  const L = (e: string, s: string) => (locale === 'en' ? e : s)
  const toast = useToast()
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading')
  const [busy, setBusy] = useState(false)

  const check = async () => {
    try { const d = await (await fetch(`/api/${api}?action=status&userId=${userId}`)).json(); setStatus(d.connected ? 'connected' : 'disconnected') }
    catch { setStatus('disconnected') }
  }
  useEffect(() => {
    if (!userId) return
    check()
    if (new URLSearchParams(window.location.search).get(param) === 'connected') {
      toast.success(L(`${nombre} connected`, `${nombre} conectado`)); check()
      window.history.replaceState({}, '', window.location.pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const connect = async () => {
    setBusy(true)
    try { const d = await (await fetch(`/api/${api}?action=auth-url&userId=${userId}&role=especialista`)).json(); if (d.url) window.location.href = d.url; else throw new Error() }
    catch { toast.error(L(`Could not connect ${nombre}`, `No se pudo conectar ${nombre}`)); setBusy(false) }
  }
  const disconnect = async () => {
    if (!await confirmar(L(`Disconnect ${nombre}?`, `¿Desconectar ${nombre}?`))) return
    await fetch(`/api/${api}?action=disconnect&userId=${userId}`)
    setStatus('disconnected'); toast.success(L(`${nombre} disconnected`, `${nombre} desconectado`))
  }

  if (status === 'loading') return <span className="h-10 w-36 animate-pulse rounded-full bg-v-fill" />
  return status === 'connected' ? (
    <button onClick={disconnect} title={L('Click to disconnect', 'Clic para desconectar')}
      className="group inline-flex h-10 items-center gap-2 rounded-full border border-v-success/30 bg-v-success/10 px-4 text-xs font-semibold text-v-success transition-colors hover:border-v-danger/30 hover:bg-v-danger/10 hover:text-v-danger">
      <Logo /> {nombre} <Check size={13} className="group-hover:hidden" />
    </button>
  ) : (
    <button onClick={connect} disabled={busy}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-v-border bg-v-elevated px-4 text-xs font-semibold text-v-text shadow-v transition-colors hover:border-v-accent/40 disabled:opacity-60">
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Logo />} {L(`Connect ${nombre.split(' ')[0]}`, `Conectar ${nombre.split(' ')[0]}`)}
    </button>
  )
}

const ESTADO: Record<string, { tone: string; dot: string; chip: string }> = {
  confirmed: { tone: 'bg-v-success/15 text-v-success', dot: 'bg-v-success', chip: 'bg-v-success text-white' },
  pending: { tone: 'bg-v-warning/15 text-v-warning', dot: 'bg-v-warning', chip: 'bg-v-warning text-white' },
  cancelled: { tone: 'bg-v-danger/10 text-v-danger', dot: 'bg-v-danger', chip: 'bg-v-danger/80 text-white line-through' },
  completed: { tone: 'bg-v-accent-soft text-v-accent', dot: 'bg-v-accent', chip: 'v-brand' },
}

/* ── Componente ─────────────────────────────────────────────────────────── */
export default function MiAgenda(_: { isDark?: boolean }) {
  const toast = useToast()
  const { t, locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const bcp = toBCP47(locale)

  const [citas, setCitas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(() => new Date())
  const [dir, setDir] = useState(0)
  const [diaSel, setDiaSel] = useState<string>(() => iso(new Date()))
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => { if (session?.user?.id) setUserId(session.user.id) })
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('appointments').select('*, children(name, profiles!fk_children_parent(full_name))').order('appointment_date').order('appointment_time')
      if (error) throw error
      setCitas(data || [])
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const año = mes.getFullYear()
  const mesN = mes.getMonth()
  const hoy = iso(new Date())
  const primerDia = new Date(año, mesN, 1).getDay()
  const diasEnMes = new Date(año, mesN + 1, 0).getDate()
  const semanas = Math.ceil((primerDia + diasEnMes) / 7)
  const diasSemana = Array.from({ length: 7 }, (_, i) => new Date(2026, 1, 1 + i).toLocaleDateString(bcp, { weekday: 'short' }).replace('.', ''))

  const porFecha: Record<string, any[]> = {}
  citas.forEach(c => { (porFecha[c.appointment_date] ||= []).push(c) })
  const citasDia = (porFecha[diaSel] || []).slice().sort((a, b) => (a.appointment_time || '').localeCompare(b.appointment_time || ''))
  const proximas = citas.filter(c => c.appointment_date >= hoy && c.status !== 'cancelled').slice(0, 8)
  const prefMes = `${año}-${String(mesN + 1).padStart(2, '0')}`
  const delMes = citas.filter(c => c.appointment_date?.startsWith(prefMes) && c.status !== 'cancelled').length
  const deHoy = (porFecha[hoy] || []).filter(c => c.status !== 'cancelled').length
  const virtuales = citas.filter(c => c.is_virtual && c.appointment_date >= hoy && c.status !== 'cancelled').length

  const cambiarMes = (d: number) => { setDir(d); setMes(new Date(año, mesN + d, 1)) }
  const irHoy = () => { const n = new Date(); setDir(0); setMes(n); setDiaSel(iso(n)) }
  const fechaSel = new Date(diaSel + 'T00:00:00')
  const esHoySel = diaSel === hoy
  const tituloMes = mes.toLocaleDateString(bcp, { month: 'long' })

  const kpis = [
    { label: L('Month', 'Este mes'), value: delMes, Icon: CalendarDays, tone: 'bg-v-accent-soft text-v-accent' },
    { label: L('Today', 'Hoy'), value: deHoy, Icon: Sun, tone: 'bg-v-warning/15 text-v-warning' },
    { label: L('Next', 'Próximas'), value: proximas.length, Icon: CalendarClock, tone: 'bg-v-success/15 text-v-success' },
    { label: L('Online', 'Virtuales'), value: virtuales, Icon: Video, tone: 'bg-[#8b5cf6]/12 text-[#8b5cf6]' },
  ]

  return (
    <div className="v-scope space-y-4 pb-8 md:space-y-5">
      {/* Encabezado */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`relative overflow-hidden ${cardClass}`}>
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(40rem 14rem at 0% 0%, var(--v-glow-1), transparent 70%)' }} />
        <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
        <div className="relative flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-v-muted">{L('My schedule', 'Mi agenda')}</p>
            <h2 className="v-headline mt-1 text-[1.6rem] capitalize leading-tight text-v-text sm:text-[2rem]">{tituloMes} <span className="v-brand-text">{año}</span></h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {userId && <>
                <CalendarioExterno userId={userId} api="google-calendar" param="gcal" nombre="Google Calendar" Logo={GoogleLogo} />
                <CalendarioExterno userId={userId} api="microsoft-calendar" param="mscal" nombre="Outlook Calendar" Logo={MicrosoftLogo} />
              </>}
            </div>
          </div>
          <div className="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-2 lg:w-[26rem]">
            {kpis.map(k => (
              <div key={k.label} className="rounded-v-sm bg-v-elevated/80 p-3 text-center shadow-v">
                <span className={`mx-auto grid size-8 place-items-center rounded-[30%] ${k.tone}`}><k.Icon size={15} /></span>
                <p className="v-headline mt-1.5 text-xl tabular-nums text-v-text">{loading ? '—' : k.value}</p>
                <p className="truncate text-[10px] font-medium text-v-muted">{k.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Calendario */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className={`${cardClass} overflow-hidden`}>
          <div className="flex items-center justify-between gap-2 border-b border-v-border px-3 py-3 sm:px-5">
            <button onClick={() => cambiarMes(-1)} aria-label={L('Previous month', 'Mes anterior')} className="grid size-9 place-items-center rounded-full text-v-muted hover:bg-v-fill"><ChevronLeft size={18} /></button>
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold capitalize text-v-text">{tituloMes} <span className="text-v-subtle">{año}</span></p>
              {(mesN !== new Date().getMonth() || año !== new Date().getFullYear() || !esHoySel) && (
                <button onClick={irHoy} className="rounded-full bg-v-accent-soft px-2.5 py-1 text-[11px] font-semibold text-v-accent hover:bg-v-accent hover:text-white">{L('Today', 'Hoy')}</button>
              )}
            </div>
            <button onClick={() => cambiarMes(1)} aria-label={L('Next month', 'Mes siguiente')} className="grid size-9 place-items-center rounded-full text-v-muted hover:bg-v-fill"><ChevronRight size={18} /></button>
          </div>

          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] border-b border-v-border bg-v-fill/40">
            {diasSemana.map((d, i) => <p key={i} className="py-2.5 text-center text-[11px] font-semibold capitalize text-v-subtle">{d}</p>)}
          </div>

          {loading ? (
            <div className="grid place-items-center py-24"><Loader2 size={24} className="animate-spin text-v-accent" /></div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={prefMes} initial={{ opacity: 0, x: dir * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -24 }} transition={{ duration: 0.18 }}
                className="grid grid-cols-[repeat(7,minmax(0,1fr))]" style={{ gridTemplateRows: `repeat(${semanas}, minmax(0, 1fr))` }}>
                {Array.from({ length: primerDia }, (_, i) => <div key={`e${i}`} className="min-h-14 border-b border-r border-v-border bg-v-fill/30 sm:min-h-24" />)}
                {Array.from({ length: diasEnMes }, (_, i) => {
                  const dia = i + 1
                  const f = `${prefMes}-${String(dia).padStart(2, '0')}`
                  const lista = porFecha[f] || []
                  const esHoy = f === hoy
                  const sel = f === diaSel
                  const finde = (primerDia + i) % 7 === 0 || (primerDia + i) % 7 === 6
                  return (
                    <button key={f} onClick={() => setDiaSel(f)}
                      className={`group relative flex min-h-14 flex-col gap-1 border-b border-r border-v-border p-1 text-left transition-colors sm:min-h-24 sm:p-1.5 ${sel ? 'bg-v-accent-soft/70' : finde ? 'bg-v-fill/25 hover:bg-v-fill/60' : 'hover:bg-v-fill/60'}`}>
                      {sel && <motion.span layoutId="agenda-sel" className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-v-accent/60" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                      <span className={`grid size-7 place-items-center rounded-full text-xs font-semibold tabular-nums ${esHoy ? 'v-brand' : sel ? 'text-v-accent' : 'text-v-text'}`} style={esHoy ? { boxShadow: 'none' } : undefined}>{dia}</span>
                      {/* Celular: puntos. Escritorio: chips con hora y paciente */}
                      {lista.length > 0 && (
                        <>
                          <span className="flex flex-wrap gap-0.5 px-1 sm:hidden">{lista.slice(0, 3).map((c, k) => <span key={k} className={`size-1.5 rounded-full ${(ESTADO[c.status] || ESTADO.confirmed).dot}`} />)}</span>
                          <span className="hidden w-full flex-col gap-0.5 sm:flex">
                            {lista.slice(0, 2).map((c, k) => (
                              <span key={k} className={`flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${(ESTADO[c.status] || ESTADO.confirmed).chip}`} style={{ boxShadow: 'none' }}>
                                {c.is_virtual ? <Video size={9} className="shrink-0" /> : <MapPin size={9} className="shrink-0" />}
                                <span className="truncate">{c.appointment_time?.slice(0, 5)} {c.children?.name}</span>
                              </span>
                            ))}
                            {lista.length > 2 && <span className="px-1 text-[10px] font-semibold text-v-subtle">+{lista.length - 2} {L('more', 'más')}</span>}
                          </span>
                        </>
                      )}
                    </button>
                  )
                })}
              </motion.div>
            </AnimatePresence>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-v-border px-4 py-2.5 text-[11px] text-v-muted">
            {[['confirmed', L('Confirmed', 'Confirmada')], ['pending', L('Pending', 'Pendiente')], ['completed', L('Completed', 'Completada')], ['cancelled', L('Cancelled', 'Cancelada')]].map(([k, l]) => (
              <span key={k} className="inline-flex items-center gap-1.5"><span className={`size-2 rounded-full ${ESTADO[k].dot}`} /> {l}</span>
            ))}
          </div>
        </motion.div>

        {/* Panel lateral */}
        <div className="grid gap-4 md:grid-cols-2 xl:flex xl:flex-col">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`${cardClass} overflow-hidden`}>
            <div className="flex items-center gap-3 border-b border-v-border px-4 py-3.5 sm:px-5">
              <span className="v-brand grid h-12 w-12 shrink-0 place-items-center rounded-v-sm text-center leading-none" style={{ boxShadow: 'none' }}>
                <span><span className="block text-[10px] font-semibold uppercase opacity-80">{fechaSel.toLocaleDateString(bcp, { month: 'short' }).replace('.', '')}</span><span className="block text-lg font-bold">{fechaSel.getDate()}</span></span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-v-subtle">{esHoySel ? L('Today', 'Hoy') : L('Selected day', 'Día seleccionado')}</p>
                <p className="truncate text-sm font-semibold text-v-text first-letter:uppercase">{fechaSel.toLocaleDateString(bcp, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              <span className="shrink-0 rounded-full bg-v-fill px-2.5 py-1 text-[11px] font-semibold tabular-nums text-v-muted">{citasDia.length} {citasDia.length === 1 ? L('appt.', 'cita') : L('appts.', 'citas')}</span>
            </div>
            {citasDia.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-10 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-v-fill text-v-subtle"><CalendarDays size={20} /></span>
                <p className="mt-3 text-sm font-semibold text-v-text">{L('No appointments this day', 'Sin citas este día')}</p>
                <p className="mt-0.5 text-xs text-v-muted">{L('Pick another day on the calendar.', 'Elige otro día en el calendario.')}</p>
              </div>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto p-3">
                {citasDia.map(c => {
                  const e = ESTADO[c.status] || ESTADO.confirmed
                  return (
                    <div key={c.id} className="flex items-center gap-3 rounded-v-sm border border-v-border bg-v-bg p-3">
                      <span className="w-12 shrink-0 text-center">
                        <span className="block text-sm font-bold tabular-nums text-v-text">{c.appointment_time?.slice(0, 5) || '—'}</span>
                        <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-v-subtle">{c.is_virtual ? <><Video size={9} /> {L('Online', 'Virtual')}</> : <><MapPin size={9} /> {L('On-site', 'Presencial')}</>}</span>
                      </span>
                      <span className="h-9 w-px shrink-0 bg-v-border" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-v-text">{c.children?.name || L('Patient', 'Paciente')}</span>
                        <span className="block truncate text-xs text-v-subtle">{c.service_type || c.children?.profiles?.full_name || L('Therapy session', 'Sesión de terapia')}</span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.tone}`}>{t('estado.' + c.status)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className={`${cardClass} flex flex-col overflow-hidden xl:min-h-0 xl:flex-1`}>
            <div className="flex items-center gap-3 border-b border-v-border px-4 py-3.5 sm:px-5">
              <span className="grid size-9 place-items-center rounded-[30%] bg-v-success/15 text-v-success"><CalendarCheck size={16} /></span>
              <p className="flex-1 text-sm font-semibold text-v-text">{L('Upcoming appointments', 'Próximas citas')}</p>
              <span className="rounded-full bg-v-fill px-2 py-0.5 text-[11px] font-semibold tabular-nums text-v-muted">{proximas.length}</span>
            </div>
            {loading ? (
              <div className="grid place-items-center py-10"><Loader2 size={18} className="animate-spin text-v-accent" /></div>
            ) : proximas.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-v-fill text-v-subtle"><Calendar size={20} /></span>
                <p className="mt-3 text-sm font-semibold text-v-text">{L('No upcoming appointments', 'Sin citas próximas')}</p>
                <p className="mt-0.5 text-xs text-v-muted">{L('New bookings will appear here.', 'Las nuevas citas aparecerán aquí.')}</p>
              </div>
            ) : (
              <div className="max-h-96 flex-1 space-y-1 overflow-y-auto p-2 xl:max-h-none">
                {proximas.map(c => {
                  const f = new Date(c.appointment_date + 'T00:00:00')
                  const esHoyItem = c.appointment_date === hoy
                  return (
                    <button key={c.id} onClick={() => { setDiaSel(c.appointment_date); setDir(0); setMes(f) }}
                      className="flex w-full items-center gap-3 rounded-v-sm p-2.5 text-left transition-colors hover:bg-v-fill/60">
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-v-sm text-center leading-none ${esHoyItem ? 'v-brand' : 'bg-v-fill text-v-text'}`} style={esHoyItem ? { boxShadow: 'none' } : undefined}>
                        <span><span className="block text-[9px] font-semibold uppercase opacity-70">{f.toLocaleDateString(bcp, { month: 'short' }).replace('.', '')}</span><span className="block text-sm font-bold">{f.getDate()}</span></span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-v-text">{c.children?.name || L('Patient', 'Paciente')}</span>
                        <span className="flex items-center gap-1 text-xs text-v-subtle"><Clock size={10} /> {c.appointment_time?.slice(0, 5)}{esHoyItem && <span className="font-semibold text-v-accent"> · {L('Today', 'Hoy')}</span>}{c.is_virtual && <> · <Video size={10} /></>}</span>
                      </span>
                      <span className={`size-2 shrink-0 rounded-full ${(ESTADO[c.status] || ESTADO.confirmed).dot}`} />
                    </button>
                  )
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
