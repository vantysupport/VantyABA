'use client'
import { useI18n } from '@/lib/i18n-context'
import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Bell, BellRing, Check, X } from 'lucide-react'
import { usePushNotifications } from '../lib/usePushNotifications'

interface Props {
  userId: string | null
  /** Ajusta el texto a lo que recibe cada rol */
  rol?: 'padre' | 'especialista' | 'equipo'
}

const TEXTOS = {
  padre: {
    en: 'Appointment reminders, messages from the center and a nudge to keep your practice streak, even with the app closed.',
    es: 'Recordatorios de citas, mensajes del centro y un empujón para no perder la racha de práctica, incluso con la app cerrada.',
  },
  especialista: {
    en: 'Your daily summary, a heads-up before each session and messages from families, right on your phone.',
    es: 'Tu resumen del día, un aviso antes de cada sesión y los mensajes de las familias, directo en tu celular.',
  },
  equipo: {
    en: 'Online bookings, reschedule requests, payments and new members the moment they happen.',
    es: 'Reservas online, solicitudes de reprogramación, pagos y nuevos integrantes en el momento en que pasan.',
  },
}

// Tarjeta flotante para activar las notificaciones push. Cede el lugar mientras
// se muestra el aviso de instalar la app (PWAInstallButton) para no encimarse.
export default function PushNotificationBanner({ userId, rol = 'padre' }: Props) {
  const { permission, isSubscribed, isLoading, requestPermission } = usePushNotifications(userId)
  const { locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const [dismissed, setDismissed] = useState(false)
  const [justEnabled, setJustEnabled] = useState(false)
  const [pwaVisible, setPwaVisible] = useState(false)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    try { if (localStorage.getItem('push-banner-dismissed')) setDismissed(true) } catch { /* sin storage */ }
    const sync = () => setPwaVisible(document.body.dataset.pwaBanner === '1')
    sync()
    window.addEventListener('vanty:pwa-banner', sync)
    // Aparece con un pequeño retraso para no competir con la carga del panel
    const t = setTimeout(() => setListo(true), 2500)
    return () => { window.removeEventListener('vanty:pwa-banner', sync); clearTimeout(t) }
  }, [])

  const handleDismiss = () => {
    try { localStorage.setItem('push-banner-dismissed', '1') } catch { /* sin storage */ }
    setDismissed(true)
  }

  const handleEnable = async () => {
    const success = await requestPermission()
    if (success) {
      // Notificación de bienvenida: así se verán los avisos
      fetch('/api/push/prueba', { method: 'POST' }).catch(() => {})
      setJustEnabled(true)
      setTimeout(() => setDismissed(true), 3000)
    }
  }

  const visible = listo && !dismissed && !pwaVisible && permission !== 'unsupported' && permission !== 'denied' && (!isSubscribed || justEnabled)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div key={justEnabled ? 'ok' : 'ask'} role="dialog" aria-live="polite"
          initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="v-scope fixed bottom-24 left-3 right-3 z-50 md:bottom-6 md:left-auto md:right-6 md:w-[360px]">
          {justEnabled ? (
            <div className="flex items-center gap-3 rounded-v border border-v-border bg-v-elevated p-4 shadow-v">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-v-success/15 text-v-success"><Check size={18} /></span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-v-text">{L('Notifications on', 'Notificaciones activadas')}</p>
                <p className="text-xs text-v-muted">{L('We just sent you a sample so you know how they look.', 'Te enviamos una de ejemplo para que veas cómo llegan.')}</p>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-v border border-v-border bg-v-elevated p-4 shadow-v">
              <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
              <button onClick={handleDismiss} aria-label={L('Close', 'Cerrar')}
                className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full text-v-muted hover:bg-v-fill"><X size={15} /></button>
              <div className="flex items-start gap-3 pr-6">
                <motion.span animate={{ rotate: [0, -10, 8, -5, 0] }} transition={{ delay: 0.6, duration: 0.8 }}
                  className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-[30%] bg-v-accent-soft">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/push/aria-saludo.png" alt="" style={{ width: 48, height: 48, objectFit: 'cover' }} />
                  <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-v-accent text-white ring-2 ring-v-elevated"><BellRing size={10} /></span>
                </motion.span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-v-text">{L('Turn on notifications?', '¿Activamos las notificaciones?')}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-v-muted">
                    {L(TEXTOS[rol].en, TEXTOS[rol].es)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={handleDismiss} className="h-10 flex-1 rounded-full border border-v-border text-sm font-semibold text-v-muted hover:bg-v-fill">
                  {L('Not now', 'Ahora no')}
                </button>
                <button onClick={handleEnable} disabled={isLoading}
                  className="v-brand inline-flex h-10 flex-[1.6] items-center justify-center gap-1.5 rounded-full text-sm font-semibold disabled:opacity-60">
                  {isLoading ? <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <><Bell size={14} /> {L('Turn on', 'Activar')}</>}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
