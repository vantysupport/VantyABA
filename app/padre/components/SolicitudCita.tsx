'use client'
// Ventana para que la familia pida reprogramar (propone fecha y hora) o cancele una cita.
// Envía la solicitud a /api/padre/citas; el centro recibe un aviso y confirma el cambio.

import { useState } from 'react'
import { CalendarClock, XCircle, Loader2, Sun, Sunset } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import { ModalShell } from './PerfilModales'

export type CitaSolicitud = { id: string; modo: 'reprogramar' | 'cancelar'; fecha: string; hora: string | null; servicio?: string | null }

const manana = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) }

export function SolicitudCitaModal({ cita, onClose, onListo }: { cita: CitaSolicitud; onClose: () => void; onListo: (mensaje: string) => void }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const reprogramar = cita.modo === 'reprogramar'
  const [fecha, setFecha] = useState('')
  const [franja, setFranja] = useState<'manana' | 'tarde' | 'hora'>('manana')
  const [hora, setHora] = useState('')
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const actual = new Date(`${cita.fecha}T12:00:00`).toLocaleDateString(toBCP47(locale), { weekday: 'long', day: 'numeric', month: 'long' })
    + (cita.hora ? ` · ${cita.hora.slice(0, 5)}` : '')

  async function enviar() {
    if (reprogramar && !fecha) { setError(L('Choose the new date.', 'Elige la nueva fecha.')); return }
    setEnviando(true); setError('')
    const horaFinal = !reprogramar ? null : franja === 'hora' ? hora || null : franja === 'manana' ? '09:00' : '15:00'
    const nota = reprogramar && franja !== 'hora'
      ? `${franja === 'manana' ? L('Prefers morning', 'Prefiere en la mañana') : L('Prefers afternoon', 'Prefiere en la tarde')}${motivo ? ` · ${motivo}` : ''}`
      : motivo
    try {
      const r = await fetch('/api/padre/citas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cita.id, accion: cita.modo, fecha: reprogramar ? fecha : null, hora: horaFinal, motivo: nota || null }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error === 'fecha_pasada' ? L('Choose a future date.', 'Elige una fecha futura.') : L('We could not send your request. Try again.', 'No pudimos enviar tu solicitud. Inténtalo de nuevo.'))
      onListo(reprogramar ? L('Request sent to the center', 'Solicitud enviada al centro') : L('Appointment cancelled', 'Cita cancelada'))
    } catch (e) { setError(e instanceof Error ? e.message : '') }
    finally { setEnviando(false) }
  }

  const campo = 'w-full rounded-v-sm border border-v-border bg-v-bg px-3.5 py-2.5 text-sm text-v-text outline-none focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft'

  return (
    <ModalShell
      Icon={reprogramar ? CalendarClock : XCircle}
      tone={reprogramar ? 'bg-v-accent-soft text-v-accent' : 'bg-v-danger/10 text-v-danger'}
      title={reprogramar ? L('Reschedule appointment', 'Reprogramar cita') : L('Cancel appointment', 'Cancelar cita')}
      subtitle={`${cita.servicio || L('Therapy', 'Terapia')} · ${actual}`}
      onClose={onClose}
      footer={
        <div className="flex gap-2.5">
          <button onClick={onClose} className="h-11 flex-1 rounded-full border border-v-border text-sm font-semibold text-v-muted hover:bg-v-fill">{L('Back', 'Volver')}</button>
          <button onClick={enviar} disabled={enviando}
            className={`inline-flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-60 ${reprogramar ? 'v-brand' : 'bg-v-danger text-white'}`}>
            {enviando && <Loader2 size={15} className="animate-spin" />}
            {reprogramar ? L('Send request', 'Enviar solicitud') : L('Cancel appointment', 'Cancelar cita')}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {reprogramar ? (
          <>
            <p className="text-sm text-v-muted">{L('Tell us when you would like the new appointment. The center will confirm it and notify you.', 'Cuéntanos cuándo te gustaría la nueva cita. El centro la confirmará y te avisará.')}</p>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-v-muted">{L('New date', 'Nueva fecha')}</span>
              <input type="date" min={manana()} value={fecha} onChange={e => setFecha(e.target.value)} className={campo} />
            </label>
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-v-muted">{L('Preferred time', 'Horario preferido')}</span>
              <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
                {([
                  { k: 'manana', Icon: Sun, t: L('Morning', 'Mañana') },
                  { k: 'tarde', Icon: Sunset, t: L('Afternoon', 'Tarde') },
                  { k: 'hora', Icon: CalendarClock, t: L('Exact time', 'Hora exacta') },
                ] as const).map(o => (
                  <button key={o.k} type="button" onClick={() => setFranja(o.k)}
                    className={`flex flex-col items-center gap-1 rounded-v-sm border py-2.5 text-xs font-semibold transition-colors ${franja === o.k ? 'border-v-accent/50 bg-v-accent-soft text-v-accent' : 'border-v-border text-v-muted hover:bg-v-fill'}`}>
                    <o.Icon size={16} /> {o.t}
                  </button>
                ))}
              </div>
              {franja === 'hora' && <input type="time" value={hora} onChange={e => setHora(e.target.value)} className={`${campo} mt-2`} />}
            </div>
          </>
        ) : (
          <p className="rounded-v-sm bg-v-danger/10 px-3.5 py-3 text-sm text-v-text">
            {L('The appointment will be cancelled and the center will be notified. If you would rather change the day, use "Reschedule".', 'La cita se cancelará y el centro recibirá el aviso. Si prefieres cambiar el día, usa "Reprogramar".')}
          </p>
        )}
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-v-muted">{L('Reason (optional)', 'Motivo (opcional)')}</span>
          <textarea rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={300}
            placeholder={L('E.g. we will be traveling', 'Ej.: estaremos de viaje')} className={`${campo} resize-none`} />
        </label>
        {error && <p role="alert" className="text-sm text-v-danger">{error}</p>}
      </div>
    </ModalShell>
  )
}
