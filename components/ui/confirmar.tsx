'use client'
// Confirmación propia de Vanty (reemplaza a window.confirm, que no funciona en algunos
// navegadores integrados y se ve distinta en cada uno).
//
//   if (!(await confirmar('¿Eliminar esta cita?'))) return
//
// <ConfirmarHost /> va una sola vez en el layout raíz y dibuja el diálogo.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, HelpCircle } from 'lucide-react'

type Opciones = { titulo?: string; confirmar?: string; cancelar?: string; peligro?: boolean }
type Pedido = Opciones & { mensaje: string; resolver: (ok: boolean) => void }

let mostrar: ((p: Pedido) => void) | null = null
const PELIGRO = /eliminar|borrar|descartar|desconectar|desactivar|suspender|cancelar esta|quitar|revocar|delete|remove|disconnect|clear/i

export function confirmar(mensaje: string, opciones: Opciones = {}): Promise<boolean> {
  return new Promise(resolve => {
    if (!mostrar) {
      // Sin host montado (no debería pasar): se usa el del navegador como respaldo.
      resolve(typeof window !== 'undefined' ? window.confirm(mensaje) : false)
      return
    }
    mostrar({ ...opciones, mensaje, peligro: opciones.peligro ?? PELIGRO.test(mensaje), resolver: resolve })
  })
}

export function ConfirmarHost() {
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const en = typeof document !== 'undefined' && document.documentElement.lang === 'en'

  useEffect(() => {
    mostrar = p => setPedido(p)
    return () => { mostrar = null }
  }, [])

  const cerrar = (ok: boolean) => {
    pedido?.resolver(ok)
    setPedido(null)
  }

  useEffect(() => {
    if (!pedido) return
    botonRef.current?.focus()
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar(false)
      if (e.key === 'Enter') cerrar(true)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido])

  const Icono = pedido?.peligro ? AlertTriangle : HelpCircle
  return (
    <AnimatePresence>
      {pedido && (
        <motion.div
          className="v-scope fixed inset-0 z-[200] flex items-end justify-center bg-[#081426]/50 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => cerrar(false)}
          role="presentation"
        >
          <motion.div
            role="alertdialog" aria-modal="true" aria-labelledby="confirmar-titulo" aria-describedby="confirmar-mensaje"
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="w-full max-w-sm rounded-v-lg border border-v-border bg-v-elevated p-5 shadow-v-lg"
          >
            <div className="flex items-start gap-3.5">
              <span className={`grid size-11 shrink-0 place-items-center rounded-[30%] ${pedido.peligro ? 'bg-v-danger/10 text-v-danger' : 'bg-v-accent-soft text-v-accent'}`}>
                <Icono size={20} />
              </span>
              <div className="min-w-0 pt-0.5">
                <p id="confirmar-titulo" className="text-[15px] font-semibold text-v-text">
                  {pedido.titulo ?? (pedido.peligro ? (en ? 'Are you sure?' : '¿Estás seguro?') : (en ? 'Confirm' : 'Confirmar'))}
                </p>
                <p id="confirmar-mensaje" className="mt-1 whitespace-pre-line text-sm leading-relaxed text-v-muted">{pedido.mensaje}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => cerrar(false)} className="h-10 rounded-full px-4 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill">
                {pedido.cancelar ?? (en ? 'Cancel' : 'Cancelar')}
              </button>
              <button ref={botonRef} type="button" onClick={() => cerrar(true)}
                className={`h-10 rounded-full px-5 text-sm font-semibold text-white transition-transform active:scale-95 ${pedido.peligro ? 'bg-v-danger' : 'v-brand'}`}>
                {pedido.confirmar ?? (pedido.peligro ? (en ? 'Yes, continue' : 'Sí, continuar') : (en ? 'Accept' : 'Aceptar'))}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
