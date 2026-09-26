'use client'
// components/AvisoPago.tsx
// Aviso de pago para la DIRECCIÓN del centro (solo jefe/admin; el equipo y las familias no lo ven).
//   por_vencer → aviso suave: el plan vence en ≤ 3 días
//   gracia     → aviso rojo fijo: el pago venció y el acceso se pausará al terminar la gracia
// Se puede ocultar por sesión (vuelve a aparecer al día siguiente o al recargar tras 24 h).

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, CalendarClock, X, CreditCard } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { jsonCompartido } from '@/lib/pedido-compartido'

type Pago = { fase: 'ok' | 'por_vencer' | 'gracia' | 'vencido'; dias: number | null; vence: string | null; pausa: string | null }
const CLAVE = 'vanty_aviso_pago_oculto'

export default function AvisoPago() {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [pago, setPago] = useState<Pago | null>(null)
  const [plan, setPlan] = useState<string | null>(null)
  const [oculto, setOculto] = useState(false)

  useEffect(() => {
    jsonCompartido('/api/suscripcion')
      .then(({ data: d }) => {
        if (!d?.esDueno) return
        setPago(d.pago)
        const p = (d.planes || []).find((x: any) => x.id === d.planId)
        if (p) setPlan(en ? p.name_en : p.name_es)
        try { const h = localStorage.getItem(CLAVE); if (h && Date.now() - Number(h) < 86_400_000 && d.pago?.fase === 'por_vencer') setOculto(true) } catch { /* sin storage */ }
      })
      .catch(() => {})
  }, [en])

  if (!pago || (pago.fase !== 'por_vencer' && pago.fase !== 'gracia')) return null
  const fecha = (x: string | null) => (x ? new Date(x).toLocaleDateString(en ? 'en-US' : 'es-PE', { day: 'numeric', month: 'long' }) : '')
  const gracia = pago.fase === 'gracia'
  const titulo = gracia
    ? L(`Payment pending: access will pause on ${fecha(pago.pausa)}`, `Pago pendiente: el acceso se pausará el ${fecha(pago.pausa)}`)
    : pago.dias === 0 ? L(`Your ${plan ?? ''} plan expires today`, `Tu plan ${plan ?? ''} vence hoy`)
    : L(`Your ${plan ?? ''} plan expires on ${fecha(pago.vence)}`, `Tu plan ${plan ?? ''} vence el ${fecha(pago.vence)}`)
  const cuerpo = gracia
    ? L(`Your plan expired on ${fecha(pago.vence)}. You have ${pago.dias} day${pago.dias === 1 ? '' : 's'} left to renew before your team and families lose access.`,
      `Tu plan venció el ${fecha(pago.vence)}. Te ${pago.dias === 1 ? 'queda 1 día' : `quedan ${pago.dias} días`} para renovar antes de que tu equipo y las familias pierdan el acceso.`)
    : pago.dias === 0 ? L('Renew today so your team is not interrupted.', 'Renueva hoy para no interrumpir a tu equipo.')
    : L(`Renew in time so your team is not interrupted. ${pago.dias === 1 ? '1 day left.' : `${pago.dias} days left.`}`,
      `Renueva a tiempo para no interrumpir a tu equipo. ${pago.dias === 1 ? 'Queda 1 día.' : `Quedan ${pago.dias} días.`}`)
  const contacto = process.env.NEXT_PUBLIC_SUPPORT_EMAIL

  return (
    <AnimatePresence>
      {!oculto && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
          className={`v-scope mb-3 flex items-start gap-3 rounded-v border p-3.5 shadow-v md:mb-4 ${gracia ? 'border-v-danger/30 bg-v-danger/10' : 'border-v-warning/30 bg-v-warning/10'}`}>
          <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] ${gracia ? 'bg-v-danger text-white' : 'bg-v-warning/20 text-v-warning'}`}>
            {gracia ? <AlertTriangle size={17} /> : <CalendarClock size={17} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold ${gracia ? 'text-v-danger' : 'text-v-text'}`}>{titulo}</p>
            <p className="mt-0.5 text-xs text-v-muted">{cuerpo}</p>
          </div>
          {contacto && (
            <a href={`mailto:${contacto}?subject=${encodeURIComponent(L('Plan renewal', 'Renovación de plan'))}`}
              className={`hidden h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-semibold sm:inline-flex ${gracia ? 'bg-v-danger text-white hover:brightness-95' : 'v-brand'}`}>
              <CreditCard size={14} /> {L('Renew', 'Renovar')}
            </a>
          )}
          {!gracia && (
            <button onClick={() => { setOculto(true); try { localStorage.setItem(CLAVE, String(Date.now())) } catch { /* sin storage */ } }}
              aria-label={L('Dismiss', 'Ocultar')} className="grid size-8 shrink-0 place-items-center rounded-full text-v-muted hover:bg-v-fill"><X size={15} /></button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
