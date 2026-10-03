'use client'
// Notificaciones manuales: texto, pose de ARIA con vista previa, a quién (roles y centro) y cuándo.
// Llegan como push al celular/navegador y como aviso en la campana de cada panel.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Bell, Send, CalendarClock, Users, Stethoscope, Headset, Heart, Crown, Loader2, X, CheckCircle2, Clock, Ban, Trash2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { confirmar } from '@/components/ui/confirmar'
import { callControl } from '../api'
import { SectionTitle } from '../ui'

type Campana = {
  id: string; titulo: string; cuerpo: string; pose: string; audiencia: string[]; centro_id: string | null
  programada_para: string; estado: string; destinatarios: number | null; enviados_push: number | null
  created_at: string; enviada_en: string | null; centros: { name: string } | null
}

const POSES = ['saludo', 'celebra', 'feliz', 'guino', 'pensando', 'laptop', 'corre'] as const
const POSE_TXT: Record<string, { es: string; en: string }> = {
  saludo: { es: 'Saluda', en: 'Waves' }, celebra: { es: 'Celebra', en: 'Celebrates' }, feliz: { es: 'Feliz', en: 'Happy' },
  guino: { es: 'Guiño', en: 'Winks' }, pensando: { es: 'Pensando', en: 'Thinking' }, laptop: { es: 'Con laptop', en: 'With laptop' },
  corre: { es: 'Corre', en: 'Runs' },
}
const AUD = [
  { id: 'directores', Icon: Crown, es: 'Directores', en: 'Directors' },
  { id: 'especialistas', Icon: Stethoscope, es: 'Especialistas', en: 'Specialists' },
  { id: 'secretarias', Icon: Headset, es: 'Secretarías', en: 'Front desk' },
  { id: 'padres', Icon: Heart, es: 'Padres', en: 'Parents' },
] as const

// "2026-09-27T10:30" en hora local para el input datetime-local
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

export function NotificacionesSection({ onError }: { onError: (e: unknown) => void }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)

  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [pose, setPose] = useState<string>('saludo')
  const [audiencia, setAudiencia] = useState<string[]>(['padres'])
  const [centroId, setCentroId] = useState('')
  const [programar, setProgramar] = useState(false)
  const [cuando, setCuando] = useState(() => localInput(new Date(Date.now() + 60 * 60 * 1000)))
  const [alcance, setAlcance] = useState<{ total: number; conPush: number } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const [campanas, setCampanas] = useState<Campana[]>([])
  const [centros, setCentros] = useState<{ id: string; name: string }[]>([])

  const cargar = useCallback(() => {
    callControl<{ campanas: Campana[]; centros: { id: string; name: string }[] }>('campanas_list')
      .then(r => { setCampanas(r.campanas); setCentros(r.centros) }).catch(onError)
  }, [onError])
  useEffect(() => { cargar() }, [cargar])

  // Alcance en vivo al cambiar a quién va
  useEffect(() => {
    if (!audiencia.length) { setAlcance({ total: 0, conPush: 0 }); return }
    setAlcance(null)
    const id = setTimeout(() => {
      callControl<{ total: number; conPush: number }>('campana_alcance', { audiencia, centro_id: centroId || null }).then(setAlcance).catch(() => setAlcance(null))
    }, 300)
    return () => clearTimeout(id)
  }, [audiencia, centroId])

  const alternar = (id: string) => setAudiencia(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id])
  const listo = titulo.trim() && cuerpo.trim() && audiencia.length > 0 && (!programar || new Date(cuando).getTime() > Date.now())

  async function enviar() {
    if (!listo) return
    const n = alcance?.total ?? 0
    const cuandoTxt = programar ? new Date(cuando).toLocaleString(en ? 'en-US' : 'es-PE', { dateStyle: 'medium', timeStyle: 'short' }) : L('now', 'ahora')
    if (!await confirmar(L(`Send to ${n} people (${cuandoTxt})?`, `¿Enviar a ${n} personas (${cuandoTxt})?`), { peligro: false, confirmar: L('Send', 'Enviar') })) return
    setEnviando(true); setAviso(null)
    try {
      const r = await callControl<{ enviada: boolean; destinatarios?: number; push?: number }>('campana_crear', {
        titulo, cuerpo, pose, audiencia, centro_id: centroId || null,
        programada_para: programar ? new Date(cuando).toISOString() : new Date().toISOString(),
      })
      setAviso(r.enviada
        ? L(`Sent to ${r.destinatarios} people · ${r.push} phones/browsers`, `Enviada a ${r.destinatarios} personas · ${r.push} celulares/navegadores`)
        : L(`Scheduled for ${cuandoTxt}`, `Programada para el ${cuandoTxt}`))
      setTitulo(''); setCuerpo('')
      cargar()
    } catch (e) { onError(e) } finally { setEnviando(false) }
  }

  async function cancelar(c: Campana) {
    if (!await confirmar(L('Cancel this scheduled notification?', '¿Cancelar esta notificación programada?'))) return
    await callControl('campana_cancelar', { id: c.id }).catch(onError)
    cargar()
  }

  async function eliminar(c: Campana | null) {
    const ok = await confirmar(c
      ? L('Delete this notification? It will also disappear from the bell of each person (what already reached their phones stays there).', '¿Eliminar esta notificación? También desaparece de la campana de cada persona (lo que ya llegó a su celular se queda ahí).')
      : L('Delete ALL the history? Notifications also disappear from everyone\'s bell.', '¿Eliminar TODO el historial? Las notificaciones también desaparecen de la campana de todos.'),
      { confirmar: L('Delete', 'Eliminar') })
    if (!ok) return
    await callControl('campana_eliminar', c ? { id: c.id } : { todas: true }).catch(onError)
    cargar()
  }

  const vistaTitulo = titulo.trim() || L('Your title here', 'Tu título aquí')
  const vistaCuerpo = cuerpo.trim() || L('The message your users will read.', 'El mensaje que leerán tus usuarios.')
  const fecha = useMemo(() => (iso: string) => new Date(iso).toLocaleString(en ? 'en-US' : 'es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), [en])

  const campo = 'w-full rounded-v-sm border border-v-border bg-v-bg px-3.5 py-2.5 text-sm text-v-text outline-none focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft'

  return (
    <div className="space-y-6">
      <SectionTitle title={L('Notifications', 'Notificaciones')} subtitle={L('Send a message to phones and the in-app bell, now or at a set time.', 'Envía un mensaje al celular y a la campana de la app, ahora o a la hora que elijas.')} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Formulario */}
        <div className="space-y-5 rounded-v border border-v-border bg-v-elevated p-5 shadow-v">
          <label className="block">
            <span className="mb-1.5 flex justify-between text-xs font-semibold text-v-muted"><span>{L('Title', 'Título')}</span><span className="tabular-nums">{titulo.length}/80</span></span>
            <input value={titulo} maxLength={80} onChange={e => setTitulo(e.target.value)} placeholder={L('E.g. New feature available!', 'Ej.: ¡Nueva función disponible!')} className={campo} />
          </label>
          <label className="block">
            <span className="mb-1.5 flex justify-between text-xs font-semibold text-v-muted"><span>{L('Message', 'Mensaje')}</span><span className="tabular-nums">{cuerpo.length}/240</span></span>
            <textarea value={cuerpo} maxLength={240} rows={3} onChange={e => setCuerpo(e.target.value)} placeholder={L('Short and clear: it shows on the lock screen.', 'Corto y claro: se ve en la pantalla de bloqueo.')} className={`${campo} resize-none`} />
          </label>

          <div>
            <p className="mb-2 text-xs font-semibold text-v-muted">{L('ARIA character', 'Personaje de ARIA')}</p>
            <div className="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-2 sm:grid-cols-[repeat(7,minmax(0,1fr))]">
              {POSES.map(p => (
                <button key={p} type="button" onClick={() => setPose(p)} title={en ? POSE_TXT[p].en : POSE_TXT[p].es}
                  className={`flex flex-col items-center gap-1 rounded-v-sm border p-1.5 transition-colors ${pose === p ? 'border-v-accent bg-v-accent-soft' : 'border-v-border hover:bg-v-fill'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/push/aria-${p}.png`} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} className="rounded-lg" />
                  <span className={`text-[10px] font-semibold ${pose === p ? 'text-v-accent' : 'text-v-muted'}`}>{en ? POSE_TXT[p].en : POSE_TXT[p].es}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-v-muted">{L('Send to', 'Enviar a')}</p>
            <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))]">
              {AUD.map(a => {
                const on = audiencia.includes(a.id)
                return (
                  <button key={a.id} type="button" onClick={() => alternar(a.id)}
                    className={`flex items-center gap-2 rounded-v-sm border px-3 py-2.5 text-sm font-semibold transition-colors ${on ? 'border-v-accent bg-v-accent-soft text-v-accent' : 'border-v-border text-v-muted hover:bg-v-fill'}`}>
                    <a.Icon size={15} /> {en ? a.en : a.es}
                  </button>
                )
              })}
            </div>
            <select value={centroId} onChange={e => setCentroId(e.target.value)} className={`${campo} mt-2`}>
              <option value="">{L('All centers', 'Todos los centros')}</option>
              {centros.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-v-muted">
              <Users size={13} />
              {alcance === null ? <Loader2 size={12} className="animate-spin" />
                : L(`${alcance.total} people · ${alcance.conPush} with notifications on their phone`, `${alcance.total} personas · ${alcance.conPush} con notificaciones en el celular`)}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-v-muted">{L('When', 'Cuándo')}</p>
            <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2">
              <button type="button" onClick={() => setProgramar(false)} className={`flex items-center justify-center gap-2 rounded-v-sm border py-2.5 text-sm font-semibold ${!programar ? 'border-v-accent bg-v-accent-soft text-v-accent' : 'border-v-border text-v-muted hover:bg-v-fill'}`}><Send size={14} /> {L('Now', 'Ahora')}</button>
              <button type="button" onClick={() => setProgramar(true)} className={`flex items-center justify-center gap-2 rounded-v-sm border py-2.5 text-sm font-semibold ${programar ? 'border-v-accent bg-v-accent-soft text-v-accent' : 'border-v-border text-v-muted hover:bg-v-fill'}`}><CalendarClock size={14} /> {L('Schedule', 'Programar')}</button>
            </div>
            {programar && (
              <input type="datetime-local" value={cuando} min={localInput(new Date())} onChange={e => setCuando(e.target.value)} className={`${campo} mt-2`} />
            )}
            {programar && <p className="mt-1.5 text-[11px] text-v-subtle">{L('Uses your computer’s time zone. Sent within 5 minutes of the chosen time.', 'Usa la hora de tu computadora. Se envía dentro de los 5 minutos de la hora elegida.')}</p>}
          </div>

          <button onClick={enviar} disabled={!listo || enviando}
            className="v-brand flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-50">
            {enviando ? <Loader2 size={17} className="animate-spin" /> : programar ? <><CalendarClock size={16} /> {L('Schedule notification', 'Programar notificación')}</> : <><Send size={16} /> {L('Send now', 'Enviar ahora')}</>}
          </button>
          <AnimatePresence>
            {aviso && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 rounded-v-sm bg-v-success/10 px-3 py-2.5 text-sm font-medium text-v-success">
                <CheckCircle2 size={16} /> {aviso}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Vista previa */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-v-subtle">{L('Preview', 'Vista previa')}</p>

          {/* Celular (pantalla de bloqueo) */}
          <div className="rounded-[28px] bg-gradient-to-b from-[#1b2a4a] to-[#0d1526] p-4 pb-8 shadow-v">
            <p className="text-center text-4xl font-light tabular-nums text-white/90">9:41</p>
            <p className="mb-4 text-center text-xs text-white/60">{L('Monday, September 28', 'lunes, 28 de septiembre')}</p>
            <motion.div key={pose} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 rounded-2xl bg-white/90 p-3 backdrop-blur">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="grid size-4 place-items-center rounded bg-[#0a84ff] text-[8px] font-bold text-white">V</span> Vanty ABA · {L('now', 'ahora')}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vistaTitulo}</p>
                <p className="text-[13px] leading-snug text-slate-700" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{vistaCuerpo}</p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/push/aria-${pose}.png`} alt="" style={{ width: 52, height: 52, objectFit: 'cover' }} className="shrink-0 rounded-xl" />
            </motion.div>
          </div>

          {/* Campana de la app */}
          <div className="rounded-v border border-v-border bg-v-elevated p-3 shadow-v">
            <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold text-v-text"><Bell size={13} /> {L('In-app bell', 'Campana de la app')}</p>
            <div className="flex items-start gap-2.5 rounded-xl bg-v-fill p-2.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-v-accent-soft text-v-accent"><Bell size={13} /></span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-v-text">{vistaTitulo}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-v-muted">{vistaCuerpo}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Historial */}
      <div className="rounded-v border border-v-border bg-v-elevated shadow-v">
        <div className="flex items-center justify-between gap-3 border-b border-v-border px-5 py-3">
          <p className="text-sm font-semibold text-v-text">{L('History', 'Historial')}</p>
          {campanas.length > 0 && (
            <button onClick={() => eliminar(null)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-v-muted transition-colors hover:bg-v-danger/10 hover:text-v-danger">
              <Trash2 size={13} /> {L('Clear all', 'Vaciar historial')}
            </button>
          )}
        </div>
        {campanas.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-v-muted">{L('No notifications sent yet.', 'Aún no enviaste notificaciones.')}</p>
        ) : (
          <ul className="divide-y divide-v-border">
            {campanas.map(c => {
              const est = c.estado === 'enviada' ? { Icon: CheckCircle2, t: L('Sent', 'Enviada'), tone: 'bg-v-success/15 text-v-success' }
                : c.estado === 'programada' ? { Icon: Clock, t: L('Scheduled', 'Programada'), tone: 'bg-v-accent-soft text-v-accent' }
                : c.estado === 'cancelada' ? { Icon: Ban, t: L('Cancelled', 'Cancelada'), tone: 'bg-v-fill text-v-muted' }
                : { Icon: Loader2, t: L('Sending', 'Enviando'), tone: 'bg-v-warning/15 text-v-warning' }
              return (
                <li key={c.id} className="flex items-start gap-3 px-5 py-3.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/push/aria-${c.pose}.png`} alt="" style={{ width: 38, height: 38, objectFit: 'cover' }} className="shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-v-text">{c.titulo}</p>
                    <p className="text-xs text-v-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cuerpo}</p>
                    <p className="mt-1 text-[11px] text-v-subtle">
                      {c.audiencia.map(a => { const x = AUD.find(z => z.id === a); return x ? (en ? x.en : x.es) : a }).join(' · ')}
                      {' · '}{c.centros?.name ?? L('All centers', 'Todos los centros')}
                      {' · '}{c.estado === 'enviada' && c.enviada_en ? fecha(c.enviada_en) : fecha(c.programada_para)}
                      {c.estado === 'enviada' && c.destinatarios != null && ` · ${c.destinatarios} ${L('people', 'personas')} · ${c.enviados_push ?? 0} push`}
                    </p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${est.tone}`}><est.Icon size={11} /> {est.t}</span>
                  {c.estado === 'programada' && (
                    <button onClick={() => cancelar(c)} title={L('Cancel', 'Cancelar')} className="grid size-7 shrink-0 place-items-center rounded-full text-v-muted hover:bg-v-danger/10 hover:text-v-danger"><X size={14} /></button>
                  )}
                  {c.estado !== 'enviando' && (
                    <button onClick={() => eliminar(c)} title={L('Delete', 'Eliminar')} aria-label={L('Delete', 'Eliminar')} className="grid size-7 shrink-0 place-items-center rounded-full text-v-muted hover:bg-v-danger/10 hover:text-v-danger"><Trash2 size={14} /></button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
