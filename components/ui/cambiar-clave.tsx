'use client'
// Cambio de contraseña con código por correo (todos los paneles).
//
//   const { error } = await cambiarClaveConCorreo(nueva)
//
// Abre una ventana, envía un código de 6 dígitos al correo de la cuenta y, con el código correcto,
// el servidor cambia la contraseña. <CambiarClaveHost /> va una sola vez en el layout raíz.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Loader2, Mail, ShieldCheck, X } from 'lucide-react'

type Resultado = { error: { message: string } | null }
type Pedido = { nueva: string; resolver: (r: Resultado) => void }

let mostrar: ((p: Pedido) => void) | null = null

export function cambiarClaveConCorreo(nueva: string): Promise<Resultado> {
  return new Promise(resolve => {
    if (!mostrar) return resolve({ error: { message: 'No se pudo abrir la verificación. Recarga la página.' } })
    mostrar({ nueva, resolver: resolve })
  })
}

export function CambiarClaveHost() {
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [correo, setCorreo] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [espera, setEspera] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const en = typeof document !== 'undefined' && document.documentElement.lang === 'en'
  const L = (e: string, s: string) => (en ? e : s)

  useEffect(() => {
    mostrar = p => { setPedido(p); setCorreo(null); setCodigo(''); setError(null); setEspera(0) }
    return () => { mostrar = null }
  }, [])

  useEffect(() => {
    if (espera <= 0) return
    const id = setTimeout(() => setEspera(x => x - 1), 1000)
    return () => clearTimeout(id)
  }, [espera])

  const llamar = (body: Record<string, unknown>) => fetch('/api/perfil/clave', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, locale: en ? 'en' : 'es' }),
  }).then(async r => ({ ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) }))

  async function enviar() {
    setBusy(true); setError(null)
    const { ok, status, j } = await llamar({ accion: 'enviar' })
    setBusy(false)
    if (status === 429) { setEspera(60); return setError(L('Wait a minute before requesting another code.', 'Espera un minuto antes de pedir otro código.')) }
    if (!ok) return setError(L('We could not send the code. Try again.', 'No pudimos enviar el código. Inténtalo de nuevo.'))
    setCorreo(j.correo || ''); setEspera(60)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // Al abrir, el código se envía solo
  useEffect(() => {
    if (pedido && correo === null && !busy) enviar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido])

  async function confirmar() {
    if (!pedido || codigo.length !== 6) return
    setBusy(true); setError(null)
    const { ok, j } = await llamar({ accion: 'cambiar', codigo, nueva: pedido.nueva })
    setBusy(false)
    if (ok) { pedido.resolver({ error: null }); setPedido(null); return }
    setCodigo('')
    const msg: Record<string, string> = {
      vencido: L('The code expired. Request a new one.', 'El código venció. Pide uno nuevo.'),
      intentos: L('Too many attempts. Request a new code.', 'Demasiados intentos. Pide un código nuevo.'),
      clave_corta: L('The password must have at least 8 characters.', 'La contraseña debe tener al menos 8 caracteres.'),
      clave_debil: L('That password is too weak or appeared in a data leak. Choose another one.', 'Esa contraseña es muy débil o apareció en una filtración. Elige otra.'),
    }
    setError(msg[j.error] ?? (typeof j.restantes === 'number'
      ? L(`Incorrect code. ${j.restantes} attempt(s) left.`, `Código incorrecto. Te quedan ${j.restantes} intento(s).`)
      : L('Incorrect code.', 'Código incorrecto.')))
    if (j.error === 'clave_corta' || j.error === 'clave_debil') { pedido.resolver({ error: { message: msg[j.error] } }); setPedido(null) }
  }

  function cancelar() {
    pedido?.resolver({ error: { message: L('Password change cancelled.', 'Cambio de contraseña cancelado.') } })
    setPedido(null)
  }

  return (
    <AnimatePresence>
      {pedido && (
        <motion.div key="clave" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="v-scope fixed inset-0 z-[500] grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={cancelar}>
          <motion.div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97 }}
            className="relative w-full max-w-sm rounded-v border border-v-border bg-v-elevated p-6 shadow-v-lg">
            <button onClick={cancelar} aria-label={L('Close', 'Cerrar')} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-v-muted hover:bg-v-fill"><X size={16} /></button>
            <span className="grid size-12 place-items-center rounded-[28%] bg-v-accent-soft text-v-accent"><ShieldCheck size={22} /></span>
            <h2 className="mt-4 text-lg font-semibold text-v-text">{L('Confirm it is you', 'Confirma que eres tú')}</h2>
            <p className="mt-1.5 text-sm text-v-muted">
              {correo === null
                ? L('Sending a code to your email…', 'Enviando un código a tu correo…')
                : <>{L('We sent a 6-digit code to', 'Enviamos un código de 6 dígitos a')} <strong className="text-v-text">{correo}</strong>. {L('Enter it to change your password.', 'Escríbelo para cambiar tu contraseña.')}</>}
            </p>

            <input ref={inputRef} value={codigo} inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={busy || correo === null}
              onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => { if (e.key === 'Enter') confirmar() }}
              placeholder="••••••"
              className="mt-5 h-14 w-full rounded-v-sm border border-v-border bg-v-bg text-center font-mono text-2xl tracking-[0.5em] text-v-text outline-none focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft disabled:opacity-60" />

            {error && <p role="alert" className="mt-3 rounded-v-sm bg-v-danger/10 px-3 py-2 text-sm text-v-danger">{error}</p>}

            <button onClick={confirmar} disabled={busy || codigo.length !== 6}
              className="v-brand mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : L('Change password', 'Cambiar contraseña')}
            </button>
            <button onClick={enviar} disabled={busy || espera > 0}
              className="mt-3 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-v-accent disabled:text-v-subtle">
              <Mail size={14} /> {espera > 0 ? L(`Resend code in ${espera}s`, `Reenviar código en ${espera} s`) : L('Resend code', 'Reenviar código')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
