'use client'

// Panel para configurar la disponibilidad del centro y generar links de reserva
// que se envían a los padres. Se abre como modal desde la Agenda.

import { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n-context'
import { SelectorV } from '@/components/ui/selector-v'
import {
  X, Clock, Plus, Trash2, Loader2, Link2, Copy, CheckCircle2,
  Settings, CalendarClock, Power, ChevronLeft, ChevronRight, RefreshCw, Sparkles, CalendarOff, MapPin, Video,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import GoogleCalendarSync from './GoogleCalendarSync'
import MicrosoftCalendarSync from './MicrosoftCalendarSync'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const DIAS = [
  { k: '1', label: 'Lunes' }, { k: '2', label: 'Martes' }, { k: '3', label: 'Miércoles' },
  { k: '4', label: 'Jueves' }, { k: '5', label: 'Viernes' }, { k: '6', label: 'Sábado' }, { k: '0', label: 'Domingo' },
]

type Props = {
  ninos: any[]
  especialistas: any[]
  onClose: () => void
}

export default function ReservasOnlinePanel({ ninos, especialistas, onClose }: Props) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const [tab, setTab] = useState<'config' | 'links'>('config')

  // ── Config ──
  const [cfg, setCfg] = useState<any>(null)
  const [loadingCfg, setLoadingCfg] = useState(true)
  const [savingCfg, setSavingCfg] = useState(false)
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })

  // ── Links ──
  const [links, setLinks] = useState<any[]>([])
  const [loadingLinks, setLoadingLinks] = useState(false)
  const [creando, setCreando] = useState(false)
  const [form, setForm] = useState({
    child_id: '', specialist_id: '', max_slots: 1, plan_type: 'individual',
    service_type: 'Terapia ABA', modalidad: 'presencial', expires_in_days: 14,
  })
  const [copiado, setCopiado] = useState<string | null>(null)

  useEffect(() => { cargarConfig(); cargarLinks() }, [])

  const cargarConfig = async () => {
    setLoadingCfg(true)
    try {
      const r = await fetch('/api/booking/config').then(r => r.json())
      setCfg(r.config || defaultCfg())
    } catch { setCfg(defaultCfg()) }
    finally { setLoadingCfg(false) }
  }
  const defaultCfg = () => ({
    session_duration_min: 45, slot_step_min: 60, max_advance_days: 30,
    closed_dates: [],
    working_hours: Object.fromEntries(DIAS.map(d => [d.k, { activo: ['1','2','3','4','5'].includes(d.k), bloques: ['1','2','3','4','5'].includes(d.k) ? [{ inicio: '09:00', fin: '13:00' }, { inicio: '15:00', fin: '19:00' }] : [] }])),
  })

  const cargarLinks = async () => {
    setLoadingLinks(true)
    try {
      const r = await fetch('/api/booking/links').then(r => r.json())
      setLinks(r.links || [])
    } catch {} finally { setLoadingLinks(false) }
  }

  const guardarConfig = async () => {
    setSavingCfg(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      // El paso entre turnos = duración + descanso. Si no hay paso válido, usar la duración.
      const dur = Number(cfg.session_duration_min) || 45
      const step = Number(cfg.slot_step_min) >= dur ? Number(cfg.slot_step_min) : dur
      const payload = { ...cfg, session_duration_min: dur, slot_step_min: step, updated_by: user?.id }
      const r = await fetch('/api/booking/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      toast.success('Disponibilidad guardada')
      setCfg(d.config)
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setSavingCfg(false) }
  }

  const crearLink = async () => {
    setCreando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const r = await fetch('/api/booking/links', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, created_by: user?.id }),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      toast.success('Link generado')
      cargarLinks()
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setCreando(false) }
  }

  const toggleLink = async (id: string, active: boolean) => {
    await fetch('/api/booking/links', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active: !active }),
    })
    cargarLinks()
  }

  // Confirmación en el propio panel: window.confirm no aparece en algunos navegadores integrados.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const eliminarLink = async (id: string) => {
    setDeleting(id)
    try {
      const r = await fetch(`/api/booking/links?id=${id}`, { method: 'DELETE' })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      toast.success(t('auto.reservasOnlinePanel.linkEliminado'))
      setLinks(prev => prev.filter(l => l.id !== id))
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setDeleting(null); setConfirmDelete(null) }
  }

  const urlDe = (token: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/reservar/${token}`
  const copiar = (token: string) => {
    navigator.clipboard?.writeText(urlDe(token))
    setCopiado(token)
    setTimeout(() => setCopiado(null), 1800)
  }

  // Helpers config
  const setDiaActivo = (k: string, activo: boolean) =>
    setCfg((c: any) => ({ ...c, working_hours: { ...c.working_hours, [k]: { ...(c.working_hours[k] || { bloques: [] }), activo } } }))
  const addBloque = (k: string) =>
    setCfg((c: any) => ({ ...c, working_hours: { ...c.working_hours, [k]: { ...c.working_hours[k], bloques: [...(c.working_hours[k]?.bloques || []), { inicio: '09:00', fin: '13:00' }] } } }))
  const setBloque = (k: string, i: number, campo: 'inicio' | 'fin', val: string) =>
    setCfg((c: any) => {
      const bloques = [...(c.working_hours[k]?.bloques || [])]
      bloques[i] = { ...bloques[i], [campo]: val }
      return { ...c, working_hours: { ...c.working_hours, [k]: { ...c.working_hours[k], bloques } } }
    })
  const delBloque = (k: string, i: number) =>
    setCfg((c: any) => ({ ...c, working_hours: { ...c.working_hours, [k]: { ...c.working_hours[k], bloques: (c.working_hours[k]?.bloques || []).filter((_: any, idx: number) => idx !== i) } } }))
  // Marca/desmarca un día como cerrado (toggle)
  const toggleClosed = (d: string) =>
    setCfg((c: any) => {
      const set = new Set<string>(c.closed_dates || [])
      if (set.has(d)) set.delete(d); else set.add(d)
      return { ...c, closed_dates: [...set].sort() }
    })

  const TABS = [
    { id: 'config' as const, label: 'Disponibilidad', icon: Settings },
    { id: 'links' as const, label: 'Generar links', icon: Link2 },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#081426]/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="v-scope flex w-full max-w-3xl flex-col overflow-hidden rounded-v-lg border border-v-border bg-v-elevated shadow-v-lg"
        style={{ maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4 pt-5">
          <h2 className="flex items-center gap-3 text-xl font-semibold tracking-tight text-v-text">
            <span className="v-brand grid size-10 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><CalendarClock size={20} /></span>
            Reservas online
          </h2>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-fill hover:text-v-text"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="px-6 pb-4">
          <div className="inline-flex rounded-full bg-v-fill p-1">
            {TABS.map(tb => (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${tab === tb.id ? 'text-v-text' : 'text-v-muted hover:text-v-text'}`}>
                {tab === tb.id && (
                  <motion.span layoutId="reservas-tab" className="absolute inset-0 rounded-full bg-v-elevated shadow-v"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                )}
                <tb.icon size={15} className={`relative ${tab === tb.id ? 'text-v-accent' : ''}`} />
                <span className="relative">{tb.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border-t border-v-border bg-v-bg px-6 py-5" style={{ scrollbarWidth: 'thin' }}>
          {/* Aviso: sincronización con calendarios y correos */}
          <div className="mb-5 flex items-start gap-3 rounded-v border border-v-border bg-v-elevated p-4 shadow-v">
            <span className="grid size-9 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><RefreshCw size={16} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-v-text">Cada reserva se sincroniza sola</p>
              <p className="mt-0.5 text-xs leading-relaxed text-v-muted">
                Cuando una familia reserva, la cita entra a la agenda, se agrega al Google Calendar u Outlook conectado
                (del especialista del link o del jefe del centro) y se envía un correo de confirmación a la familia y al equipo.
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <GoogleCalendarSync />
                <MicrosoftCalendarSync />
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
          {/* ─── TAB CONFIG ─── */}
          {tab === 'config' && (
            <motion.div key="config" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.18 }}>
            {loadingCfg || !cfg ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-v-accent" /></div> : (
              <div className="space-y-5">
                {/* Duración + descanso → el sistema arma los turnos solo */}
                {(() => {
                  const dur = Number(cfg.session_duration_min) || 45
                  const descanso = Math.max(0, (Number(cfg.slot_step_min) || dur) - dur)
                  const setDur = (v: number) => setCfg((c: any) => ({ ...c, session_duration_min: v, slot_step_min: v + descanso }))
                  const setDescanso = (v: number) => setCfg((c: any) => ({ ...c, slot_step_min: dur + Math.max(0, v) }))
                  // Vista previa de turnos en un bloque ejemplo 09:00–13:00
                  const preview: string[] = []
                  for (let t = 9 * 60; t + dur <= 13 * 60 && preview.length < 5; t += (dur + descanso)) {
                    preview.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`)
                  }
                  return (
                    <div className="rounded-v border border-v-border bg-v-elevated p-5 shadow-v">
                      <div className="grid grid-cols-2 gap-3">
                        <Campo label="Duración de cada cita" suffix="min">
                          <input type="number" min={5} value={dur} onChange={e => setDur(Number(e.target.value))} className={inp} />
                        </Campo>
                        <Campo label="Descanso entre citas" suffix="min">
                          <input type="number" min={0} value={descanso} onChange={e => setDescanso(Number(e.target.value))} className={inp} />
                        </Campo>
                      </div>
                      <div className="mt-4">
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-v-muted">
                          <Sparkles size={12} className="text-v-accent" /> Así quedarían los turnos en un bloque de 09:00 a 13:00
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {preview.map((h, i) => (
                            <motion.span key={`${h}-${dur}-${descanso}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
                              className="rounded-full bg-v-accent-soft px-3 py-1 text-xs font-semibold tabular-nums text-v-accent">{h}</motion.span>
                          ))}
                        </div>
                        <p className="mt-3 text-xs leading-relaxed text-v-subtle">
                          Solo marcá los <strong className="text-v-muted">rangos de atención</strong> de cada día y el sistema arma los turnos. Para abrir sábados o domingos, activá el día y agregale un bloque.
                        </p>
                      </div>
                    </div>
                  )
                })()}

                {/* Horario por día */}
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-v-text"><Clock size={14} className="text-v-accent" /> {t('admin.horarioAtencion')}</p>
                  <div className="overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v">
                    {DIAS.map((d, idx) => {
                      const dia = cfg.working_hours[d.k] || { activo: false, bloques: [] }
                      return (
                        <div key={d.k} className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start ${idx > 0 ? 'border-t border-v-border' : ''}`}>
                          <div className="flex w-full items-center gap-3 sm:w-36 sm:shrink-0 sm:pt-1.5">
                            <Toggle checked={!!dia.activo} onChange={v => setDiaActivo(d.k, v)} />
                            <span className={`text-sm font-semibold ${dia.activo ? 'text-v-text' : 'text-v-subtle'}`}>{d.label}</span>
                          </div>
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                            {!dia.activo ? (
                              <span className="pt-1.5 text-xs text-v-subtle">Cerrado</span>
                            ) : (
                              <>
                                {(dia.bloques || []).length === 0 && <span className="text-xs italic text-v-subtle">{t('admin.sinHorario')}</span>}
                                <AnimatePresence initial={false}>
                                  {(dia.bloques || []).map((b: any, i: number) => (
                                    <motion.div key={i} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                      className="group inline-flex items-center gap-1 rounded-full border border-v-border bg-v-bg py-1 pl-3 pr-1">
                                      <input type="time" value={b.inicio} onChange={e => setBloque(d.k, i, 'inicio', e.target.value)} className={timeInp} />
                                      <span className="text-xs text-v-subtle">–</span>
                                      <input type="time" value={b.fin} onChange={e => setBloque(d.k, i, 'fin', e.target.value)} className={timeInp} />
                                      <button onClick={() => delBloque(d.k, i)} title="Quitar bloque"
                                        className="grid size-6 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-danger/10 hover:text-v-danger">
                                        <X size={12} />
                                      </button>
                                    </motion.div>
                                  ))}
                                </AnimatePresence>
                                <button onClick={() => addBloque(d.k)}
                                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-v-accent transition-colors hover:bg-v-accent-soft">
                                  <Plus size={13} /> Bloque
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Días cerrados — calendario navegable por mes */}
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-v-text"><CalendarOff size={14} className="text-v-danger" /> {t('admin.diasCerrados')}</p>
                  <p className="mb-2 mt-0.5 text-xs text-v-subtle">{t('admin.tocaDiasCerrado')}</p>
                  <CalendarioDiasCerrados
                    mes={calMonth}
                    onCambiarMes={setCalMonth}
                    cerrados={cfg.closed_dates || []}
                    onToggle={toggleClosed}
                  />
                  {(cfg.closed_dates || []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {[...(cfg.closed_dates || [])].sort().map((d: string) => (
                        <span key={d} className="inline-flex items-center gap-1 rounded-full bg-v-danger/10 py-1 pl-3 pr-1 text-xs font-semibold text-v-danger">
                          {d}
                          <button onClick={() => toggleClosed(d)} className="grid size-5 place-items-center rounded-full hover:bg-v-danger/15"><X size={11} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <motion.button whileTap={{ scale: 0.98 }} onClick={guardarConfig} disabled={savingCfg}
                  className="v-brand flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold disabled:opacity-50">
                  {savingCfg ? <><Loader2 size={16} className="animate-spin" /> {t('admin.guardando')}</> : <><CheckCircle2 size={16} /> {t('admin.guardarDisponibilidad')}</>}
                </motion.button>
              </div>
            )}
            </motion.div>
          )}

          {/* ─── TAB LINKS ─── */}
          {tab === 'links' && (
            <motion.div key="links" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }} className="space-y-5">
              {/* Crear link */}
              <div className="rounded-v border border-v-border bg-v-elevated p-5 shadow-v">
                <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-v-text">
                  <span className="grid size-7 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Link2 size={14} /></span>
                  {t('admin.nuevoLinkReserva')}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Campo label="Paciente (opcional)">
                    <SelectorV en={locale === 'en'} value={form.child_id} onChange={v => setForm(f => ({ ...f, child_id: v }))}
                      opciones={[
                        { value: '', label: t('admin.padreEligeHijo'), sub: locale === 'en' ? 'The family chooses when booking' : 'La familia lo elige al reservar' },
                        ...ninos.map(n => ({ value: n.id, label: n.name })),
                      ]} />
                  </Campo>
                  <Campo label="Especialista (opcional)">
                    <SelectorV en={locale === 'en'} value={form.specialist_id} onChange={v => setForm(f => ({ ...f, specialist_id: v }))}
                      opciones={[
                        { value: '', label: t('admin.sinEspecialistaFijo'), sub: locale === 'en' ? 'Any available specialist' : 'Cualquier especialista disponible' },
                        ...especialistas.map(e => ({ value: e.id, label: e.full_name || e.email, sub: e.specialty || undefined })),
                      ]} />
                  </Campo>
                  <div className="sm:col-span-2">
                    <Campo label="Tipo de reserva">
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { v: 'individual', title: 'Individual', sub: '1 cita', apply: (f: typeof form) => ({ ...f, plan_type: 'individual', max_slots: 1 }) },
                          { v: 'mensual', title: 'Mensual / Paquete', sub: 'varias citas', apply: (f: typeof form) => ({ ...f, plan_type: 'mensual', max_slots: f.max_slots > 1 ? f.max_slots : 4 }) },
                        ]).map(o => {
                          const on = form.plan_type === o.v
                          return (
                            <button key={o.v} type="button" onClick={() => setForm(o.apply)}
                              className={`rounded-v-sm border p-3 text-left transition-all ${on ? 'border-v-accent/50 bg-v-accent-soft ring-4 ring-v-accent-soft' : 'border-v-border bg-v-bg hover:border-v-accent/30'}`}>
                              <span className={`block text-sm font-semibold ${on ? 'text-v-accent' : 'text-v-text'}`}>{o.title}</span>
                              <span className="text-xs text-v-subtle">{o.sub}</span>
                            </button>
                          )
                        })}
                      </div>
                    </Campo>
                  </div>
                  <div className="sm:col-span-2">
                    <Campo label={locale === 'en' ? 'Format' : 'Modalidad'}>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { v: 'presencial', Icon: MapPin, title: locale === 'en' ? 'In person' : 'Presencial', sub: locale === 'en' ? 'At the center' : 'En el centro' },
                          { v: 'virtual', Icon: Video, title: 'Virtual', sub: locale === 'en' ? 'Video call, link created automatically' : 'Videollamada, link automático' },
                        ]).map(o => {
                          const on = form.modalidad === o.v
                          return (
                            <button key={o.v} type="button" onClick={() => setForm(f => ({ ...f, modalidad: o.v }))}
                              className={`flex items-center gap-3 rounded-v-sm border p-3 text-left transition-all ${on ? 'border-v-accent/50 bg-v-accent-soft ring-4 ring-v-accent-soft' : 'border-v-border bg-v-bg hover:border-v-accent/30'}`}>
                              <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] ${on ? 'v-brand' : 'bg-v-fill text-v-muted'}`} style={on ? { boxShadow: 'none' } : undefined}><o.Icon size={16} /></span>
                              <span className="min-w-0">
                                <span className={`block text-sm font-semibold ${on ? 'text-v-accent' : 'text-v-text'}`}>{o.title}</span>
                                <span className="block text-xs text-v-subtle">{o.sub}</span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </Campo>
                  </div>
                  {form.plan_type === 'mensual' && (
                    <Campo label="¿Cuántas citas incluye el paquete?">
                      <select value={form.max_slots} onChange={e => setForm(f => ({ ...f, max_slots: Number(e.target.value) }))} className={inp}>
                        {[2, 3, 4, 5, 6, 8, 10, 12, 16, 20].map(n => <option key={n} value={n}>{n} citas</option>)}
                      </select>
                    </Campo>
                  )}
                  <Campo label="Servicio">
                    <input value={form.service_type} onChange={e => setForm(f => ({ ...f, service_type: e.target.value }))} className={inp} />
                  </Campo>
                  <Campo label="Vence en" suffix="días">
                    <input type="number" value={form.expires_in_days} onChange={e => setForm(f => ({ ...f, expires_in_days: Number(e.target.value) }))} className={inp} />
                  </Campo>
                </div>
                <motion.button whileTap={{ scale: 0.98 }} onClick={crearLink} disabled={creando}
                  className="v-brand mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold disabled:opacity-50">
                  {creando ? <><Loader2 size={16} className="animate-spin" /> {t('common.generando')}</> : <><Link2 size={16} /> {t('admin.generarLink')}</>}
                </motion.button>
              </div>

              {/* Lista de links */}
              <div>
                <p className="mb-2 text-sm font-semibold text-v-text">{t('admin.linksGenerados')}</p>
                {loadingLinks ? <div className="flex justify-center py-6"><Loader2 className="animate-spin text-v-accent" /></div> : (
                  <div className="space-y-2">
                    {links.length === 0 && (
                      <div className="flex flex-col items-center rounded-v border border-dashed border-v-border py-8 text-center">
                        <span className="grid size-11 place-items-center rounded-full bg-v-fill"><Link2 size={18} className="text-v-subtle" /></span>
                        <p className="mt-2 text-sm text-v-muted">{t('admin.sinLinks')}</p>
                      </div>
                    )}
                    {links.map((l, i) => {
                      const agotado = l.slots_used >= l.max_slots
                      const vencido = l.expires_at && new Date(l.expires_at) < new Date()
                      const vivo = l.active && !agotado && !vencido
                      const childName = ninos.find(n => n.id === l.child_id)?.name
                      const estado = agotado ? { label: 'Completado', cls: 'bg-v-accent-soft text-v-accent' }
                        : vencido ? { label: 'Vencido', cls: 'bg-v-fill text-v-subtle' }
                        : !l.active ? { label: 'Desactivado', cls: 'bg-v-warning/15 text-v-warning' }
                        : { label: 'Activo', cls: 'bg-v-success/15 text-v-success' }
                      const pct = Math.min(100, Math.round((l.slots_used / Math.max(1, l.max_slots)) * 100))
                      return (
                        <motion.div key={l.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}
                          className={`rounded-v border border-v-border bg-v-elevated p-4 shadow-v transition-opacity ${vivo ? '' : 'opacity-60'}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-v-text">{l.service_type}</p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${estado.cls}`}>{estado.label}</span>
                                <span className="rounded-full bg-v-fill px-2 py-0.5 text-[10px] font-semibold capitalize text-v-muted">{l.plan_type}</span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-v-fill px-2 py-0.5 text-[10px] font-semibold text-v-muted">
                                  {l.modalidad === 'virtual' ? <><Video size={10} /> Virtual</> : <><MapPin size={10} /> {locale === 'en' ? 'In person' : 'Presencial'}</>}
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs text-v-subtle">{childName || 'La familia elige al paciente'}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <motion.button whileTap={{ scale: 0.95 }} onClick={() => copiar(l.token)} title={t('admin.copiarLink')}
                                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${copiado === l.token ? 'bg-v-success/15 text-v-success' : 'v-brand'}`}
                                style={copiado === l.token ? undefined : { boxShadow: 'none' }}>
                                {copiado === l.token ? <><CheckCircle2 size={13} /> {t('admin.copiado')}</> : <><Copy size={13} /> {t('admin.copiarLink')}</>}
                              </motion.button>
                              <button onClick={() => toggleLink(l.id, l.active)} title={l.active ? 'Desactivar' : 'Activar'}
                                className={`grid size-8 place-items-center rounded-full transition-colors ${l.active ? 'text-v-warning hover:bg-v-warning/15' : 'text-v-success hover:bg-v-success/15'}`}>
                                <Power size={14} />
                              </button>
                              <AnimatePresence mode="wait" initial={false}>
                                {confirmDelete === l.id ? (
                                  <motion.div key="confirm" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                    className="inline-flex items-center gap-1 rounded-full bg-v-danger/10 py-0.5 pl-3 pr-0.5">
                                    <span className="text-xs font-semibold text-v-danger">¿Borrar?</span>
                                    <button onClick={() => eliminarLink(l.id)} disabled={deleting === l.id} title={t('admin.eliminarLink')}
                                      className="grid size-7 place-items-center rounded-full bg-v-danger text-white transition-opacity disabled:opacity-60">
                                      {deleting === l.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                    </button>
                                    <button onClick={() => setConfirmDelete(null)} title="Cancelar"
                                      className="grid size-7 place-items-center rounded-full text-v-danger transition-colors hover:bg-v-danger/15">
                                      <X size={13} />
                                    </button>
                                  </motion.div>
                                ) : (
                                  <motion.button key="trash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    onClick={() => setConfirmDelete(l.id)} title={t('admin.eliminarLink')}
                                    className="grid size-8 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-danger/10 hover:text-v-danger">
                                    <Trash2 size={14} />
                                  </motion.button>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-3">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-v-fill">
                              <motion.div className="v-brand h-full rounded-full" style={{ boxShadow: 'none' }}
                                initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
                            </div>
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-v-muted">{l.slots_used}/{l.max_slots} citas</span>
                          </div>
                          <p className="mt-2 truncate rounded-full bg-v-bg px-3 py-1.5 font-mono text-[11px] text-v-subtle">{urlDe(l.token)}</p>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}

const inp = 'w-full rounded-v-sm border border-v-border bg-v-bg px-3.5 py-2.5 text-sm text-v-text outline-none transition-shadow focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft'
const timeInp = 'w-[5.2rem] bg-transparent text-sm font-medium tabular-nums text-v-text outline-none'

function Campo({ label, suffix, children }: { label: string; suffix?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 flex items-baseline gap-1 text-xs font-semibold text-v-muted">
        {label}{suffix && <span className="font-normal text-v-subtle">({suffix})</span>}
      </label>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? 'v-brand' : 'bg-v-border'}`}
      style={checked ? { boxShadow: 'none' } : undefined}>
      <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow ${checked ? 'right-0.5' : 'left-0.5'}`} />
    </button>
  )
}

// Calendario mensual para marcar varios días cerrados
function CalendarioDiasCerrados({ mes, onCambiarMes, cerrados, onToggle }: {
  mes: Date
  onCambiarMes: (d: Date) => void
  cerrados: string[]
  onToggle: (fecha: string) => void
}) {
  const year = mes.getFullYear()
  const month = mes.getMonth()
  const primerDia = new Date(year, month, 1)
  const offset = (primerDia.getDay() + 6) % 7 // lunes = 0
  const diasEnMes = new Date(year, month + 1, 0).getDate()
  const hoyStr = new Date().toISOString().slice(0, 10)
  const cerradosSet = new Set(cerrados)
  const nombreMes = mes.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  const celdas: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ]

  const fechaDe = (dia: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

  return (
    <div className="rounded-v border border-v-border bg-v-elevated p-4 shadow-v">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => onCambiarMes(new Date(year, month - 1, 1))}
          className="grid size-8 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text"><ChevronLeft size={16} /></button>
        <p className="text-sm font-semibold capitalize text-v-text">{nombreMes}</p>
        <button onClick={() => onCambiarMes(new Date(year, month + 1, 1))}
          className="grid size-8 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text"><ChevronRight size={16} /></button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <span key={i} className="text-[10px] font-semibold uppercase text-v-subtle">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((dia, i) => {
          if (dia === null) return <div key={i} />
          const fecha = fechaDe(dia)
          const cerrado = cerradosSet.has(fecha)
          const pasado = fecha < hoyStr
          const hoy = fecha === hoyStr
          return (
            <motion.button key={i} disabled={pasado} whileTap={{ scale: 0.9 }}
              onClick={() => onToggle(fecha)}
              className={`grid aspect-square place-items-center rounded-full text-xs font-semibold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                cerrado ? 'bg-v-danger text-white' : hoy ? 'bg-v-accent-soft text-v-accent' : 'text-v-text hover:bg-v-fill'
              }`}
              title={cerrado ? 'Cerrado — tocá para abrir' : 'Abierto — tocá para cerrar'}>
              {dia}
            </motion.button>
          )
        })}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-v-subtle">
        <span className="inline-block size-2.5 rounded-full bg-v-danger" /> Cerrado
      </p>
    </div>
  )
}
