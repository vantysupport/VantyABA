'use client'
// Conectar Google Calendar u Outlook para recibir las citas en el calendario del teléfono.
// Usa las mismas rutas que "Mi perfil" (/api/google-calendar y /api/microsoft-calendar).

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Check, Loader2, CalendarSync } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { useToast } from '@/components/Toast'
import { confirmar } from '@/components/ui/confirmar'

/** Vista a la que vuelve el padre al regresar del inicio de sesión de Google/Microsoft. */
export const VOLVER_TRAS_CALENDARIO = 'vanty_cal_volver'

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
)
const MicrosoftLogo = () => (
  <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden>
    <rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
)

type Estado = 'cargando' | 'conectado' | 'desconectado'

function useConexion(apiBase: string, paramKey: string, nombre: string, userId?: string) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const toast = useToast()
  const [estado, setEstado] = useState<Estado>('cargando')
  const [email, setEmail] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const revisar = useCallback(async () => {
    if (!userId) return
    try {
      const d = await fetch(`/api/${apiBase}?action=status&userId=${userId}`).then(r => r.json())
      setEstado(d.connected ? 'conectado' : 'desconectado'); setEmail(d.email || null)
    } catch { setEstado('desconectado') }
  }, [apiBase, userId])

  useEffect(() => {
    revisar()
    // Regreso del inicio de sesión: avisar y limpiar la URL
    const v = new URLSearchParams(window.location.search).get(paramKey)
    if (v === 'connected') { toast.success(en ? `${nombre} connected` : `${nombre} conectado`); window.history.replaceState({}, '', window.location.pathname) }
    else if (v === 'error') { toast.error(en ? `Could not connect ${nombre}` : `No se pudo conectar ${nombre}`); window.history.replaceState({}, '', window.location.pathname) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revisar])

  const conectar = async () => {
    if (!userId) return
    setOcupado(true)
    try {
      try { sessionStorage.setItem(VOLVER_TRAS_CALENDARIO, 'miscitas') } catch { /* sin storage */ }
      const d = await fetch(`/api/${apiBase}?action=auth-url&userId=${userId}&role=padre`).then(r => r.json())
      if (d.url) window.location.href = d.url
      else throw new Error()
    } catch {
      toast.error(en ? 'Could not start the connection' : 'No se pudo iniciar la conexión')
      setOcupado(false)
    }
  }
  const desconectar = async () => {
    if (!userId || !(await confirmar(en ? `Disconnect ${nombre}?` : `¿Desconectar ${nombre}?`))) return
    setOcupado(true)
    await fetch(`/api/${apiBase}?action=disconnect&userId=${userId}`).catch(() => {})
    setEstado('desconectado'); setEmail(null); setOcupado(false)
    toast.success(en ? `${nombre} disconnected` : `${nombre} desconectado`)
  }
  return { estado, email, ocupado, conectar, desconectar }
}

function BotonCalendario({ nombre, Logo, apiBase, paramKey, userId }: { nombre: string; Logo: () => React.ReactElement; apiBase: string; paramKey: string; userId?: string }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const { estado, email, ocupado, conectar, desconectar } = useConexion(apiBase, paramKey, nombre, userId)

  if (estado === 'cargando') return <div className="h-12 flex-1 animate-pulse rounded-v-sm bg-v-fill" />
  if (estado === 'conectado') return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-v-sm bg-v-success/10 px-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-v-elevated"><Logo /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-xs font-semibold text-v-success"><Check size={12} /> {en ? 'Connected' : 'Conectado'}</span>
        <span className="block truncate text-[11px] text-v-muted">{email || nombre}</span>
      </span>
      <button onClick={desconectar} disabled={ocupado} className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-v-danger transition-colors hover:bg-v-danger/10 disabled:opacity-50">
        {en ? 'Remove' : 'Quitar'}
      </button>
    </div>
  )
  return (
    <motion.button type="button" onClick={conectar} disabled={ocupado} whileTap={{ scale: 0.97 }}
      className="flex min-w-0 flex-1 items-center justify-center gap-2.5 rounded-full border border-v-border bg-v-elevated px-4 py-2.5 text-sm font-semibold text-v-text shadow-v transition-colors hover:border-v-accent/40 hover:bg-v-fill disabled:opacity-60">
      {ocupado ? <Loader2 size={16} className="animate-spin text-v-muted" /> : <Logo />}
      <span className="truncate">{nombre}</span>
    </motion.button>
  )
}

export default function ConectarCalendarios({ userId, className = '' }: { userId?: string; className?: string }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 24 }}
      className={`rounded-v border border-v-border bg-v-elevated p-5 shadow-v ${className}`}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><CalendarSync size={15} /></span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold tracking-tight text-v-text">{en ? 'Get them on your calendar' : 'Recíbelas en tu calendario'}</p>
          <p className="text-xs text-v-muted">{en ? 'Appointments appear and update on their own.' : 'Las citas aparecen y se actualizan solas.'}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row xl:flex-col 2xl:flex-row">
        <BotonCalendario nombre="Google Calendar" Logo={GoogleLogo} apiBase="google-calendar" paramKey="gcal" userId={userId} />
        <BotonCalendario nombre="Outlook" Logo={MicrosoftLogo} apiBase="microsoft-calendar" paramKey="mscal" userId={userId} />
      </div>
    </motion.section>
  )
}
