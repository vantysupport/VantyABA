'use client'
// Pide el nombre de perfil la primera vez que alguien entra a un panel si no lo escribió la persona
// (cuentas de Google/Microsoft, o creadas con el correo como nombre). No se puede cerrar sin guardar:
// el nombre es el que ven el equipo y las familias.

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { UserRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n-context'

const PANEL = /^(?:\/(?:es|en))?\/(?:admin|especialista|secretaria|padre|control)(?:\/|$)/

export default function NombrePerfilGuard() {
  const pathname = usePathname() ?? ''
  const { locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const [userId, setUserId] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(false)
  const confirmado = useRef(false)

  useEffect(() => {
    if (confirmado.current || !PANEL.test(pathname)) return
    let vivo = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const id = session?.user?.id
      if (!id) return
      const { data } = await supabase.from('profiles').select('nombre_confirmado').eq('id', id).maybeSingle()
      if (!vivo || !data) return
      if (data.nombre_confirmado === false) setUserId(id)
      else confirmado.current = true
    })().catch(() => {})
    return () => { vivo = false }
  }, [pathname])

  const limpio = nombre.trim().replace(/\s+/g, ' ')
  const valido = limpio.length >= 2

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !valido) return
    setGuardando(true); setError(false)
    const { error: err } = await supabase.from('profiles')
      .update({ full_name: limpio.slice(0, 120), nombre_confirmado: true, updated_at: new Date().toISOString() })
      .eq('id', userId)
    if (err) { setError(true); setGuardando(false); return }
    confirmado.current = true
    // Los paneles ya cargaron el nombre anterior: se recarga para mostrar el nuevo en todos lados.
    window.location.reload()
  }

  return (
    <AnimatePresence>
      {userId && (
        <motion.div data-vanty-overlay="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="v-scope pointer-events-auto fixed inset-0 z-[400] grid place-items-center bg-[#081426]/55 p-4 backdrop-blur-sm">
          <motion.form onSubmit={guardar} role="dialog" aria-modal="true" aria-labelledby="nombre-perfil-titulo"
            initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-sm rounded-v border border-v-border bg-v-elevated p-6 shadow-v-lg">
            <span className="v-brand grid size-12 place-items-center rounded-[30%]"><UserRound className="size-6" /></span>
            <h2 id="nombre-perfil-titulo" className="mt-4 text-lg font-semibold text-v-text">{L("What's your name?", '¿Cómo te llamas?')}</h2>
            <p className="mt-1 text-sm text-v-muted">
              {L('Write your first and last name as you want it to appear. Your team and families will see it.',
                'Escribe tu nombre y apellido como quieres que aparezca. Lo verán tu equipo y las familias.')}
            </p>
            <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus autoComplete="name" maxLength={120}
              placeholder={L('e.g. Mary Smith', 'Ej.: María López')} aria-label={L('Full name', 'Nombre y apellido')}
              className="mt-4 h-11 w-full rounded-v-sm border border-v-border bg-v-bg px-3 text-[15px] outline-none transition-shadow focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft" />
            {error && <p className="mt-2 text-xs text-v-danger">{L('Could not save. Try again.', 'No se pudo guardar. Inténtalo de nuevo.')}</p>}
            <button type="submit" disabled={!valido || guardando}
              className="v-brand mt-4 h-11 w-full rounded-full text-[15px] font-semibold disabled:opacity-50">
              {guardando ? L('Saving…', 'Guardando…') : L('Continue', 'Continuar')}
            </button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
