'use client'
// "No deseo continuar": cancelar la suscripción, eliminar el centro (solo la persona encargada) o eliminar
// la propia cuenta (padres, secretaría, especialistas y administradores que no crearon el centro).
// - Cancelar: Lemon no vuelve a cobrar; el acceso sigue hasta el final del periodo pagado. Se puede reanudar.
// - Eliminar centro: borra todo el centro (pacientes, registros, archivos, cuentas). Pide escribir su nombre.
// - Eliminar mi cuenta: borra los datos personales; los del niño quedan en el centro.

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, CalendarX, Check, Loader2, RotateCcw, Trash2, UserX, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n-context'
import { useToast } from '@/components/Toast'
import { confirmar } from '@/components/ui/confirmar'

type EstadoSuscripcion = {
  centro: string; status: string; paidUntil: string | null; trialEndsAt: string | null
  esEncargado: boolean; suscripcion: { estado: string | null } | null
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

async function salir(locale: string) {
  await supabase.auth.signOut().catch(() => {})
  window.location.assign(`/${locale}?cuenta=eliminada`)
}

/** Estado de la suscripción del centro del usuario (null mientras carga o si no tiene centro). */
export function useEstadoSuscripcion() {
  const [estado, setEstado] = useState<EstadoSuscripcion | null>(null)
  const [version, setVersion] = useState(0)
  const cargar = useCallback(() => setVersion(v => v + 1), [])
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const r = await fetch('/api/suscripcion', { cache: 'no-store', headers: await authHeaders() }).catch(() => null)
      if (vivo && r?.ok) setEstado(await r.json())
    })()
    return () => { vivo = false }
  }, [version])
  return { estado, recargar: cargar }
}

// ── Ventana base ────────────────────────────────────────────────────────────
function Ventana({ titulo, Icon, onClose, children }: { titulo: string; Icon: typeof Trash2; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div data-vanty-overlay="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      className="v-scope pointer-events-auto fixed inset-0 z-[380] grid place-items-center overflow-y-auto bg-[#081426]/55 p-4 backdrop-blur-sm">
      <motion.div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md rounded-v border border-v-border bg-v-elevated p-6 shadow-v-lg">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-12 place-items-center rounded-[30%] bg-v-danger/10 text-v-danger"><Icon className="size-6" /></span>
          <button onClick={onClose} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full text-v-subtle hover:bg-v-fill"><X size={16} /></button>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-v-text">{titulo}</h2>
        {children}
      </motion.div>
    </motion.div>
  )
}

// ── Eliminar centro (persona encargada) ─────────────────────────────────────
export function EliminarCentroDialog({ centro, conSuscripcion, onClose }: { centro: string; conSuscripcion: boolean; onClose: () => void }) {
  const { locale } = useI18n()
  const L = (e: string, s: string) => (locale === 'en' ? e : s)
  const [nombre, setNombre] = useState('')
  const [entiende, setEntiende] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [error, setError] = useState('')
  const coincide = nombre.trim().toLowerCase() === centro.trim().toLowerCase()

  const eliminar = async () => {
    setBorrando(true); setError('')
    const r = await fetch('/api/suscripcion/eliminar-centro', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ confirm_name: nombre }),
    }).catch(() => null)
    const j = await r?.json().catch(() => ({})) ?? {}
    if (r?.ok) { await salir(locale); return }
    setBorrando(false)
    setError(j.error === 'name_mismatch' ? L("The name doesn't match.", 'El nombre no coincide.')
      : String(j.error ?? '').startsWith('lemon_cancel_failed') ? L('We could not cancel your subscription. Try again or contact support.', 'No pudimos cancelar tu suscripción. Inténtalo de nuevo o escríbenos a soporte.')
      : L('Something went wrong. Try again.', 'Algo salió mal. Inténtalo de nuevo.'))
  }

  return (
    <Ventana titulo={L('Delete center and account', 'Eliminar centro y cuenta')} Icon={Trash2} onClose={borrando ? () => {} : onClose}>
      <p className="mt-1.5 text-sm text-v-muted">
        {L('This permanently deletes ', 'Esto elimina para siempre ')}<b className="text-v-text">{centro}</b>{L(' and everything in it:', ' y todo su contenido:')}
      </p>
      <ul className="mt-3 space-y-1.5 text-[13px] text-v-muted">
        {[
          L('Patients, sessions, assessments, reports and documents.', 'Pacientes, sesiones, evaluaciones, informes y documentos.'),
          L('Schedule, payments and files.', 'Agenda, pagos y archivos.'),
          L('The accounts of your team and of the families of this center.', 'Las cuentas de tu equipo y de las familias de este centro.'),
          ...(conSuscripcion ? [L('Your subscription is cancelled: no more charges will be made.', 'Tu suscripción se cancela: no se generará ningún cobro más.')] : []),
        ].map(x => <li key={x} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-v-danger" />{x}</li>)}
      </ul>
      <p className="mt-3 rounded-v-sm bg-v-warning/10 p-2.5 text-xs text-v-text">
        {L('Download any report you need before continuing. This cannot be undone.', 'Descarga antes los informes que necesites. Esto no se puede deshacer.')}
      </p>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-semibold text-v-muted">{L('Type the name of the center to confirm', 'Escribe el nombre del centro para confirmar')}</span>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder={centro} autoComplete="off"
          className="h-11 w-full rounded-v-sm border border-v-border bg-v-bg px-3 text-[15px] outline-none focus:border-v-danger focus:ring-4 focus:ring-v-danger/15" />
      </label>
      <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[13px] text-v-text">
        <input type="checkbox" checked={entiende} onChange={e => setEntiende(e.target.checked)} className="peer sr-only" />
        <span aria-hidden className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-v-danger/20 ${entiende ? 'border-v-danger bg-v-danger text-white' : 'border-[var(--v-border-strong)] bg-v-bg'}`}>
          {entiende && <Check className="size-3.5" strokeWidth={3} />}
        </span>
        {L('I understand that all the information will be permanently deleted.', 'Entiendo que toda la información se eliminará definitivamente.')}
      </label>
      {error && <p className="mt-2 text-xs text-v-danger">{error}</p>}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
        <button onClick={onClose} disabled={borrando} className="h-11 rounded-full border border-v-border px-5 text-sm font-semibold text-v-muted hover:bg-v-fill disabled:opacity-60 sm:flex-1">{L('Cancel', 'Cancelar')}</button>
        <button onClick={eliminar} disabled={!coincide || !entiende || borrando}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-v-danger px-5 text-sm font-semibold text-white disabled:opacity-50 sm:flex-1">
          {borrando ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} {borrando ? L('Deleting…', 'Eliminando…') : L('Delete everything', 'Eliminar todo')}
        </button>
      </div>
    </Ventana>
  )
}

// ── Eliminar mi cuenta (todas las demás personas) ───────────────────────────
export function EliminarCuentaDialog({ esFamilia, onClose }: { esFamilia: boolean; onClose: () => void }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const palabra = en ? 'DELETE' : 'ELIMINAR'
  const [texto, setTexto] = useState('')
  const [borrando, setBorrando] = useState(false)
  const [error, setError] = useState('')

  const eliminar = async () => {
    setBorrando(true); setError('')
    const r = await fetch('/api/suscripcion/eliminar-cuenta', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ confirm: texto }),
    }).catch(() => null)
    const j = await r?.json().catch(() => ({})) ?? {}
    if (r?.ok) { await salir(locale); return }
    setBorrando(false)
    setError(j.error === 'es_encargado'
      ? L('You created this center: to leave, delete the center from Settings → Center.', 'Creaste este centro: para irte, elimina el centro desde Configuración → Centro.')
      : L('Something went wrong. Try again.', 'Algo salió mal. Inténtalo de nuevo.'))
  }

  return (
    <Ventana titulo={L('Delete my account', 'Eliminar mi cuenta')} Icon={UserX} onClose={borrando ? () => {} : onClose}>
      <p className="mt-1.5 text-sm text-v-muted">{L('Your account and your personal data are permanently deleted:', 'Se eliminan para siempre tu cuenta y tus datos personales:')}</p>
      <ul className="mt-3 space-y-1.5 text-[13px] text-v-muted">
        {[
          L('Your name, email, phone and photo.', 'Tu nombre, correo, teléfono y foto.'),
          L('The messages you sent and your conversations with ARIA.', 'Los mensajes que enviaste y tus conversaciones con ARIA.'),
          L('Your notifications and linked calendars.', 'Tus notificaciones y calendarios vinculados.'),
        ].map(x => <li key={x} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-v-danger" />{x}</li>)}
      </ul>
      <p className="mt-3 rounded-v-sm bg-v-accent-soft/60 p-2.5 text-xs text-v-text">
        {esFamilia
          ? L("Your child's clinical record (sessions, assessments and reports) stays with the center, which is responsible for it. To delete it, ask the center.",
            'La historia clínica de tu hijo o hija (sesiones, evaluaciones e informes) se queda en el centro, que es responsable de ella. Para eliminarla, pídeselo al centro.')
          : L("Patients' records you created stay with the center.", 'Los registros de pacientes que hiciste se quedan en el centro.')}
      </p>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-semibold text-v-muted">{L(`Type ${palabra} to confirm`, `Escribe ${palabra} para confirmar`)}</span>
        <input value={texto} onChange={e => setTexto(e.target.value)} placeholder={palabra} autoComplete="off"
          className="h-11 w-full rounded-v-sm border border-v-border bg-v-bg px-3 text-[15px] uppercase outline-none focus:border-v-danger focus:ring-4 focus:ring-v-danger/15" />
      </label>
      {error && <p className="mt-2 text-xs text-v-danger">{error}</p>}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
        <button onClick={onClose} disabled={borrando} className="h-11 rounded-full border border-v-border px-5 text-sm font-semibold text-v-muted hover:bg-v-fill disabled:opacity-60 sm:flex-1">{L('Cancel', 'Cancelar')}</button>
        <button onClick={eliminar} disabled={texto.trim().toUpperCase() !== palabra || borrando}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-v-danger px-5 text-sm font-semibold text-white disabled:opacity-50 sm:flex-1">
          {borrando ? <Loader2 className="size-4 animate-spin" /> : <UserX className="size-4" />} {borrando ? L('Deleting…', 'Eliminando…') : L('Delete my account', 'Eliminar mi cuenta')}
        </button>
      </div>
    </Ventana>
  )
}

// ── Tarjeta para Configuración → Centro (persona encargada) ─────────────────
export function SalidaCentro() {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const toast = useToast()
  const { estado, recargar } = useEstadoSuscripcion()
  const [dialogo, setDialogo] = useState(false)
  const [cambiando, setCambiando] = useState(false)
  if (!estado?.esEncargado) return null

  const lemon = estado.suscripcion?.estado ?? null
  const activa = !!lemon && ['active', 'on_trial', 'past_due'].includes(lemon)
  const cancelada = lemon === 'cancelled'
  const fecha = (d: string | null) => d ? new Date(d).toLocaleDateString(en ? 'en-US' : 'es-PE', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

  const cambiar = async (accion: 'cancelar' | 'reanudar') => {
    if (accion === 'cancelar') {
      const ok = await confirmar(
        L(`You won't be charged again. Your center keeps working until ${fecha(estado.paidUntil)}; after that, access is paused. You can resume before that date.`,
          `No se te volverá a cobrar. Tu centro sigue funcionando hasta el ${fecha(estado.paidUntil)}; después, el acceso se pausa. Puedes reanudarla antes de esa fecha.`),
        { titulo: L('Cancel your subscription?', '¿Cancelar tu suscripción?'), confirmar: L('Yes, cancel', 'Sí, cancelar'), peligro: true },
      )
      if (!ok) return
    }
    setCambiando(true)
    const r = await fetch('/api/cobros/suscripcion', { method: accion === 'cancelar' ? 'DELETE' : 'PATCH', headers: await authHeaders() }).catch(() => null)
    setCambiando(false)
    if (r?.ok) {
      toast.success(accion === 'cancelar' ? L('Subscription cancelled. There will be no more charges.', 'Suscripción cancelada. No habrá más cobros.') : L('Subscription resumed.', 'Suscripción reanudada.'))
      recargar()
    } else toast.error(L('We could not update your subscription. Try again.', 'No pudimos actualizar tu suscripción. Inténtalo de nuevo.'))
  }

  return (
    <section className="overflow-hidden rounded-v border border-v-danger/30 bg-v-elevated shadow-v">
      <div className="flex items-center gap-3 border-b border-v-border px-5 py-4">
        <span className="grid size-9 place-items-center rounded-[30%] bg-v-danger/10 text-v-danger"><AlertTriangle size={16} /></span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-v-text">{L("Don't want to continue?", '¿No deseas continuar?')}</h3>
          <p className="text-xs text-v-muted">{L('Only you, as the person who created the center, can do this', 'Solo tú, como persona que creó el centro, puedes hacerlo')}</p>
        </div>
      </div>
      <div className="divide-y divide-v-border">
        {(activa || cancelada) && (
          <div className="flex flex-wrap items-center gap-3 px-5 py-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-fill text-v-muted"><CalendarX size={18} /></span>
            <span className="min-w-0 flex-[1_1_220px]">
              <span className="block text-sm font-semibold text-v-text">{cancelada ? L('Subscription cancelled', 'Suscripción cancelada') : L('Monthly subscription', 'Suscripción')}</span>
              <span className="block text-xs text-v-muted">
                {cancelada
                  ? L(`No more charges. Access until ${fecha(estado.paidUntil)}.`, `Sin más cobros. Acceso hasta el ${fecha(estado.paidUntil)}.`)
                  : L(`Renews on ${fecha(estado.paidUntil)}. Cancel to avoid the next charge.`, `Se renueva el ${fecha(estado.paidUntil)}. Cancélala para que no se genere el próximo cobro.`)}
              </span>
            </span>
            <button onClick={() => cambiar(cancelada ? 'reanudar' : 'cancelar')} disabled={cambiando}
              className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-60 ${cancelada ? 'bg-v-accent-soft text-v-accent hover:bg-v-accent hover:text-white' : 'border border-v-danger/40 text-v-danger hover:bg-v-danger/10'}`}>
              {cambiando ? <Loader2 size={15} className="animate-spin" /> : cancelada ? <RotateCcw size={15} /> : <CalendarX size={15} />}
              {cancelada ? L('Resume subscription', 'Reanudar suscripción') : L("I don't want to continue", 'No deseo continuar')}
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-danger/10 text-v-danger"><Trash2 size={18} /></span>
          <span className="min-w-0 flex-[1_1_220px]">
            <span className="block text-sm font-semibold text-v-text">{L('Delete center and account', 'Eliminar centro y cuenta')}</span>
            <span className="block text-xs text-v-muted">{L('Deletes the center, its patients, records and all accounts. Cannot be undone.', 'Borra el centro, sus pacientes, registros y todas las cuentas. No se puede deshacer.')}</span>
          </span>
          <button onClick={() => setDialogo(true)} className="inline-flex h-10 items-center gap-2 rounded-full bg-v-danger px-4 text-sm font-semibold text-white">
            <Trash2 size={15} /> {L('Delete', 'Eliminar')}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {dialogo && <EliminarCentroDialog centro={estado.centro} conSuscripcion={activa} onClose={() => setDialogo(false)} />}
      </AnimatePresence>
    </section>
  )
}

// ── Botón "Eliminar mi cuenta" para el perfil de cualquier persona ──────────
export function BotonEliminarCuenta({ esFamilia = false, className = '' }: { esFamilia?: boolean; className?: string }) {
  const { locale } = useI18n()
  const L = (e: string, s: string) => (locale === 'en' ? e : s)
  const { estado } = useEstadoSuscripcion()
  const [abierto, setAbierto] = useState(false)
  // La persona encargada no elimina solo su cuenta: elimina el centro (Configuración → Centro).
  if (estado?.esEncargado) return null
  return (
    <>
      <button onClick={() => setAbierto(true)}
        className={`flex w-full items-center gap-3.5 rounded-v border border-v-border bg-v-elevated px-5 py-3.5 text-left shadow-v transition-colors hover:border-v-danger/40 hover:bg-v-danger/5 ${className}`}>
        <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-danger/10 text-v-danger"><UserX size={18} /></span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-v-danger">{L('Delete my account', 'Eliminar mi cuenta')}</span>
          <span className="block text-xs text-v-muted">{L('Deletes your personal data permanently', 'Borra tus datos personales para siempre')}</span>
        </span>
      </button>
      <AnimatePresence>{abierto && <EliminarCuentaDialog esFamilia={esFamilia} onClose={() => setAbierto(false)} />}</AnimatePresence>
    </>
  )
}
