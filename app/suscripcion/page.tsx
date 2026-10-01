'use client'
// app/suscripcion/page.tsx
// Estado de la suscripción del centro. La dirección elige o renueva el plan (queda 'pending_payment'
// hasta que la plataforma confirme el pago en /control). El equipo y las familias ven un aviso propio,
// sin detalles de facturación (a los padres nunca se les habla de pagos).

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { Clock, PauseCircle, Building2, LogOut, Check, Loader2, CreditCard, Crown, Sparkles, Users, UserRound, Baby, FileText, MessagesSquare, BookOpen, BarChart3, Hourglass, ShieldCheck, UserX } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'
import { AuthShell } from '@/components/ui/auth-shell'
import { formatoMoneda, precioCiclo, type Ciclo } from '@/lib/precios'
import { EliminarCentroDialog, EliminarCuentaDialog } from '@/components/cuenta/SalidaCuenta'

// 'elegir': el dueño entra por su cuenta (p. ej. durante la prueba) para pagar un plan
const REASONS = { elegir: Sparkles, trial_expired: Clock, pending_payment: Hourglass, past_due: Clock, suspended: PauseCircle, no_centro: Building2 } as const
type Reason = keyof typeof REASONS

type Plan = {
  id: string; code: string; name_es: string; name_en: string; precio: number | null; local: number | null
  max_patients: number | null; max_professionals: number | null; max_parents: number | null; max_ai_reports: number | null
  has_team_chat: boolean; has_catalog: boolean; has_financial_reports: boolean
}
type Estado = { centro: string; status: string; trialEndsAt: string | null; paidUntil: string | null; planId: string | null; rol: string; esDueno: boolean; esEncargado?: boolean; suscripcion?: { estado: string | null } | null; bloqueo: string | null; planes: Plan[]; moneda: string; monedaLocal: string; ciclo: Ciclo }

function SubscriptionStatus() {
  const { t, locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const raw = useSearchParams().get('motivo')
  const pagoOk = useSearchParams().get('pago') === 'ok'
  const [reason, setReason] = useState<Reason>(raw && raw in REASONS ? (raw as Reason) : pagoOk ? 'elegir' : 'suspended')
  const [estado, setEstado] = useState<Estado | null>(null)
  const [cargando, setCargando] = useState(true)
  const [elegido, setElegido] = useState<string | null>(null)
  const [ciclo, setCiclo] = useState<Ciclo>('mensual')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [salida, setSalida] = useState<'centro' | 'cuenta' | null>(null)
  const contact = process.env.NEXT_PUBLIC_SUPPORT_EMAIL

  useEffect(() => {
    fetch('/api/suscripcion', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: Estado | null) => {
        if (d) {
          setEstado(d)
          if (d.ciclo === 'anual') setCiclo('anual')
          if (d.bloqueo && d.bloqueo in REASONS && !pagoOk) setReason(d.bloqueo as Reason)
          const actual = d.planes.find(p => p.id === d.planId)
          setElegido(actual?.code ?? d.planes[0]?.code ?? null)
        }
      })
      .finally(() => setCargando(false))
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.assign(`/${locale}/login`)
  }

  // Vuelta desde el checkout: se espera a que el webhook active el centro
  const volvioDePago = pagoOk
  const [confirmando, setConfirmando] = useState(volvioDePago)
  const [activado, setActivado] = useState<string | null>(null) // nombre del plan activado
  useEffect(() => {
    if (!volvioDePago) return
    let intentos = 0
    const t = setInterval(async () => {
      intentos++
      // Respaldo del webhook: pide a Vanty que consulte a Lemon directamente
      await fetch('/api/cobros/suscripcion', { method: 'PUT' }).catch(() => {})
      const d = await fetch('/api/suscripcion', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null)
      if (d && d.status === 'active' && !d.bloqueo) {
        clearInterval(t)
        const plan = (d.planes as Plan[]).find(p => p.id === d.planId)
        setActivado(plan ? (en ? plan.name_en : plan.name_es) : 'Vanty ABA')
        setConfirmando(false)
      }
      if (intentos >= 20) { clearInterval(t); setConfirmando(false) }
    }, 3000)
    return () => clearInterval(t)
  }, [volvioDePago, locale])

  async function confirmar() {
    if (!elegido) return
    setEnviando(true); setError('')
    try {
      // Pago con tarjeta en la pasarela (Lemon Squeezy)
      const c = await fetch('/api/cobros/suscripcion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: elegido, ciclo }) })
      const cj = await c.json().catch(() => ({}))
      if (c.ok && cj.url) { window.location.href = cj.url; return }
      if (c.status !== 503) throw new Error(cj.error)
      // Sin pasarela configurada: se registra el plan elegido y el pago se coordina a mano
      const r = await fetch('/api/suscripcion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: elegido, ciclo }) })
      if (!r.ok) throw new Error()
      const plan = estado?.planes.find(p => p.code === elegido)
      setEstado(e => (e ? { ...e, status: 'pending_payment', planId: plan?.id ?? e.planId } : e))
      setReason('pending_payment')
    } catch { setError(L('We could not save your choice. Try again.', 'No pudimos guardar tu elección. Inténtalo de nuevo.')) }
    finally { setEnviando(false) }
  }

  const conPlanes = reason === 'elegir' || reason === 'trial_expired' || reason === 'pending_payment' || reason === 'past_due'
  const puedeElegir = !!estado?.esDueno && conPlanes && (estado?.planes.length ?? 0) > 0 && !confirmando
  const esPadre = estado?.rol === 'padre'
  const esEquipo = !!estado && !estado.esDueno && !esPadre
  const planActual = estado?.planes.find(p => p.id === estado.planId)
  const n = (x: number | null, u: string) => (x == null ? L(`Unlimited ${u}`, `${u.charAt(0).toUpperCase() + u.slice(1)} ilimitados`) : `${x} ${u}`)
  const rasgos = (p: Plan) => [
    { Icon: Baby, t: n(p.max_patients, L('patients', 'pacientes')) },
    { Icon: UserRound, t: p.max_professionals === 1 ? L('1 professional', '1 profesional') : n(p.max_professionals, L('professionals', 'profesionales')) },
    { Icon: Users, t: p.max_parents === 0 ? L('No family portal', 'Sin portal de familias') : n(p.max_parents, L('families', 'familias')) },
    { Icon: FileText, t: p.max_ai_reports == null ? L('Unlimited AI reports', 'Reportes IA ilimitados') : L(`${p.max_ai_reports} AI reports / month`, `${p.max_ai_reports} reportes IA / mes`) },
    ...(p.has_team_chat ? [{ Icon: MessagesSquare, t: L('Team chat', 'Chat del equipo') }] : []),
    ...(p.has_catalog ? [{ Icon: BookOpen, t: L('Therapy catalog', 'Catálogo de terapias') }] : []),
    ...(p.has_financial_reports ? [{ Icon: BarChart3, t: L('Financial reports', 'Reportes financieros') }] : []),
  ]

  const centro = estado?.centro || L('your center', 'tu centro')
  const fechaPago = estado?.paidUntil ? new Date(estado.paidUntil + 'T12:00:00').toLocaleDateString(en ? 'en-US' : 'es-PE', { day: 'numeric', month: 'long' }) : null
  const texto = (() => {
    // Vuelta desde el checkout: nunca se muestra un mensaje de bloqueo mientras se activa el plan
    if (confirmando) return {
      titulo: L('Payment received', 'Pago recibido'),
      cuerpo: L('Thank you! We are activating your plan; this takes a few seconds.', '¡Gracias! Estamos activando tu plan; tarda unos segundos.'),
    }
    // Familias: nunca se menciona el pago
    if (esPadre && reason !== 'no_centro') return {
      titulo: L('Portal temporarily unavailable', 'Portal no disponible por ahora'),
      cuerpo: L(`The ${centro} portal is not available at the moment. Your child's information is safe. If you need something urgent, please contact the center directly.`,
        `El portal de ${centro} no está disponible por el momento. La información de tu hijo/a está segura. Si necesitas algo urgente, comunícate directamente con el centro.`),
    }
    // Equipo (especialistas, secretaría, terapeutas): pausa sin detalles de facturación
    if (esEquipo && reason !== 'no_centro') return {
      titulo: L('Access temporarily paused', 'Acceso pausado temporalmente'),
      cuerpo: L(`The center's management is resolving the ${centro} subscription. Your information and your patients' records are safe; you will regain access as soon as it is reactivated.`,
        `La dirección del centro está resolviendo la suscripción de ${centro}. Tu información y la de tus pacientes están seguras; recuperarás el acceso apenas se reactive.`),
    }
    if (reason === 'elegir') return {
      titulo: L('Choose your plan', 'Elige tu plan'),
      cuerpo: L(`Pick the plan for ${centro} and pay securely by card. If you are still on your free trial, you keep all its days.`,
        `Elige el plan de ${centro} y paga de forma segura con tarjeta. Si aún estás en tu prueba gratis, no pierdes ninguno de sus días.`),
    }
    if (reason === 'past_due') return {
      titulo: L('Your plan has expired', 'Tu plan venció'),
      cuerpo: L(`${fechaPago ? `The ${centro} plan expired on ${fechaPago} and ` : ''}the grace period has ended, so access is paused for your team and families. Renew your plan to reactivate everything. Your data is safe.`,
        `${fechaPago ? `El plan de ${centro} venció el ${fechaPago} y ` : ''}terminó el periodo de gracia, por eso el acceso está pausado para tu equipo y las familias. Renueva tu plan para reactivar todo. Tus datos están a salvo.`),
    }
    if (reason === 'pending_payment' && planActual) return {
      titulo: t('vanty.subscription.pending_payment.title'),
      cuerpo: L(`You chose the ${planActual.name_en} plan. As soon as we confirm your payment, ${centro} will be active again. Your data is safe.`,
        `Elegiste el plan ${planActual.name_es}. Apenas confirmemos tu pago, ${centro} volverá a estar activo. Tus datos están a salvo.`),
    }
    return { titulo: t(`vanty.subscription.${reason}.title`), cuerpo: t(`vanty.subscription.${reason}.body`) }
  })()

  if (confirmando || activado) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative text-center">
        {/* Confeti */}
        {activado && Array.from({ length: 18 }, (_, i) => (
          <motion.span key={i} aria-hidden className="pointer-events-none absolute left-1/2 top-24 size-2 rounded-[2px]"
            style={{ background: ['#01abfc', '#0063d8', '#34c759', '#ffcc00', '#ff6b9a'][i % 5] }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x: (i % 2 ? 1 : -1) * (40 + (i * 23) % 160), y: -60 - (i * 37) % 140, opacity: 0, rotate: 360 }}
            transition={{ duration: 1.6 + (i % 4) * 0.2, ease: 'easeOut', delay: 0.1 }} />
        ))}
        <div className="relative mx-auto grid size-44 place-items-center">
          <motion.span aria-hidden className="absolute inset-4 rounded-full" style={{ background: 'radial-gradient(circle, rgba(1,171,252,0.35), transparent 70%)' }}
            animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2.4, repeat: Infinity }} />
          <motion.img src={activado ? '/aria/pose-2.webp' : '/aria/pose-8.webp'} alt="ARIA" width={150} height={150}
            key={activado ? 'ok' : 'espera'}
            initial={{ scale: 0.7, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: [0, -8, 0] }}
            transition={{ scale: { type: 'spring', stiffness: 220, damping: 14 }, opacity: { duration: 0.3 }, y: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } }}
            style={{ width: 132, height: 'auto' }} className="relative drop-shadow-[0_18px_30px_rgba(0,50,140,0.35)]" />
        </div>
        {activado ? (
          <>
            <h1 className="v-headline mt-2 text-[2rem] leading-tight sm:text-4xl">{L('Your plan is active!', '¡Tu plan está activo!')}</h1>
            <p className="mt-3 text-v-muted">{L(`Welcome to ${activado}. Your whole team and every family already have access. I'm ready to help you.`, `Bienvenido a ${activado}. Todo tu equipo y cada familia ya tienen acceso. Estoy lista para ayudarte.`)}</p>
            <a href={`/${locale}/admin`} className="v-brand mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold">
              {L('Go to my panel', 'Ir a mi panel')} <Check className="size-4" />
            </a>
          </>
        ) : (
          <>
            <h1 className="v-headline mt-2 text-[2rem] leading-tight sm:text-4xl">{L('Payment received', 'Pago recibido')}</h1>
            <p className="mt-3 text-v-muted">{L('Thank you! I am activating your plan; it only takes a few seconds.', '¡Gracias! Estoy activando tu plan; solo tarda unos segundos.')}</p>
            <div className="mx-auto mt-6 flex max-w-xs items-center justify-center gap-2.5 rounded-full bg-v-accent-soft/70 px-4 py-3 text-sm font-medium text-v-text">
              <Loader2 className="size-4 shrink-0 animate-spin text-v-accent" /> {L('Activating your plan…', 'Activando tu plan…')}
            </div>
          </>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }}>
      <AnimatePresence mode="wait">
        <motion.div key={reason} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          <h1 className="v-headline text-[2.1rem] leading-tight sm:text-4xl">{texto.titulo}</h1>
          <p className="mt-3 text-v-muted">{texto.cuerpo}</p>
        </motion.div>
      </AnimatePresence>

      {cargando ? (
        <div className="mt-8 grid place-items-center py-6"><Loader2 className="size-6 animate-spin text-v-accent" /></div>
      ) : puedeElegir ? (
        <div className="mt-6">
          <p className="mb-2.5 text-sm font-semibold text-v-text">{reason === 'pending_payment' ? L('Your plan', 'Tu plan') : reason === 'past_due' ? L('Renew or change your plan', 'Renueva o cambia de plan') : L('Choose how to continue', 'Elige con qué plan seguir')}</p>
          {reason !== 'pending_payment' && (
            <div className="mb-3 flex items-center gap-2">
              <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] rounded-full bg-v-fill p-1">
                {(['mensual', 'anual'] as const).map(c => (
                  <button key={c} type="button" onClick={() => setCiclo(c)}
                    className={`h-8 rounded-full px-4 text-xs font-semibold transition-colors ${ciclo === c ? 'bg-v-elevated text-v-text shadow-v' : 'text-v-muted'}`}>
                    {c === 'mensual' ? L('Monthly', 'Mensual') : L('Yearly', 'Anual')}
                  </button>
                ))}
              </div>
              <span className="rounded-full bg-v-success/15 px-2.5 py-1 text-[11px] font-semibold text-v-success">{L('Yearly: 2 months free', 'Anual: 2 meses gratis')}</span>
            </div>
          )}
          <div className="space-y-2.5" role="radiogroup">
            {estado!.planes.map((p, i) => {
              const on = elegido === p.code
              const bloqueado = reason === 'pending_payment'
              return (
                <motion.button key={p.id} type="button" role="radio" aria-checked={on} disabled={bloqueado && !on}
                  onClick={() => !bloqueado && setElegido(p.code)}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: bloqueado && !on ? 0.45 : 1, y: 0 }} transition={{ delay: 0.05 * i }}
                  className={`relative w-full rounded-v border p-4 text-left transition-all ${on ? 'border-v-accent bg-v-accent-soft/50 ring-4 ring-v-accent-soft' : 'border-v-border bg-v-elevated hover:border-v-accent/40'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-v-accent bg-v-accent text-white' : 'border-v-border'}`}>{on && <Check className="size-3" strokeWidth={3} />}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="flex items-center gap-1.5 text-base font-semibold text-v-text">
                          {p.code === 'clinic' ? <Crown className="size-4 text-v-accent" /> : p.code === 'professional' ? <Sparkles className="size-4 text-v-accent" /> : null}
                          {en ? p.name_en : p.name_es}
                          {p.code === 'professional' && <span className="rounded-full bg-v-accent px-2 py-0.5 text-[10px] font-bold text-white">{L('Popular', 'Popular')}</span>}
                        </p>
                        <p className="text-right text-v-text">
                          {p.precio != null ? (<>
                            <span className="text-xl font-bold tabular-nums">{formatoMoneda(precioCiclo(p.precio, ciclo), estado!.moneda, en ? 'en' : 'es')}</span>
                            <span className="text-xs text-v-muted"> {estado!.moneda} / {ciclo === 'anual' ? L('year', 'año') : L('month', 'mes')} + IGV</span>
                            {p.local != null && <span className="block text-[11px] text-v-subtle">≈ {formatoMoneda(precioCiclo(p.local, ciclo), estado!.monedaLocal, en ? 'en' : 'es')} {estado!.monedaLocal}</span>}
                          </>) : <span className="text-sm font-semibold">{L('Contact us', 'Consúltanos')}</span>}
                        </p>
                      </div>
                      <ul className="mt-2 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-3 gap-y-1">
                        {rasgos(p).map(r => <li key={r.t} className="flex items-center gap-1.5 truncate text-xs text-v-muted"><r.Icon className="size-3.5 shrink-0 text-v-accent" /> <span className="truncate">{r.t}</span></li>)}
                      </ul>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
          <p className="mt-2 text-center text-[11px] text-v-subtle">{L('Prices do not include IGV (VAT).', 'Los precios no incluyen IGV.')}</p>

          {confirmando ? (
            <div className="mt-5 flex items-center gap-2.5 rounded-v-sm bg-v-accent-soft/60 p-3.5 text-sm text-v-text">
              <Loader2 className="size-4 shrink-0 animate-spin text-v-accent" />
              <span>{L('Confirming your payment… this takes a few seconds.', 'Confirmando tu pago… tarda unos segundos.')}</span>
            </div>
          ) : reason !== 'pending_payment' ? (
            <button onClick={confirmar} disabled={!elegido || enviando} className="v-brand mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold disabled:opacity-60">
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />} {reason === 'past_due' ? L('Renew and pay', 'Renovar y pagar') : L('Continue to payment', 'Continuar al pago')}
            </button>
          ) : (
            <div className="mt-5 flex items-start gap-2.5 rounded-v-sm bg-v-accent-soft/60 p-3.5 text-sm text-v-text">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-v-accent" />
              <span>{L('We will contact you to coordinate the payment. Once confirmed, your whole team regains access automatically.', 'Te contactaremos para coordinar el pago. Al confirmarlo, todo tu equipo recupera el acceso automáticamente.')}</span>
            </div>
          )}
          {error && <p role="alert" className="mt-3 text-center text-sm text-v-danger">{error}</p>}
          <p className="mt-3 text-center text-xs text-v-subtle">{L(`Prices in ${estado!.moneda}; local amounts are approximate. You can change plans later.`, `Precios en ${estado!.moneda}; los montos locales son aproximados. Podrás cambiar de plan más adelante.`)}</p>
        </div>
      ) : confirmando ? (
        <div className="mt-6 flex items-center justify-center gap-2.5 rounded-v-sm bg-v-accent-soft/60 p-4 text-sm font-medium text-v-text">
          <Loader2 className="size-4 shrink-0 animate-spin text-v-accent" /> {L('Activating your plan…', 'Activando tu plan…')}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col items-stretch gap-3">
        {!puedeElegir && !esPadre && !esEquipo && reason !== 'no_centro' && (
          <Link href={`/${locale}/precios`} className="v-brand grid h-11 place-items-center rounded-full px-6 text-[15px] font-semibold transition-transform active:scale-95">
            {t('vanty.subscription.seePlans')}
          </Link>
        )}
        {contact && !esPadre && <a href={`mailto:${contact}`} className="text-center text-sm font-medium text-v-accent hover:underline">{t('vanty.subscription.contact')}</a>}
        <button onClick={signOut} className="mx-auto mt-1 inline-flex items-center gap-2 text-sm text-v-muted hover:text-v-text">
          <LogOut className="size-4" /> {t('vanty.subscription.signOut')}
        </button>
        {estado && !confirmando && (
          <div className="mt-3 border-t border-v-border pt-4 text-center">
            <button onClick={() => setSalida(estado.esEncargado ? 'centro' : 'cuenta')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-v-danger hover:underline">
              <UserX className="size-4" /> {L("I don't want to continue", 'No deseo continuar')}
            </button>
            <p className="mt-1 text-xs text-v-subtle">
              {estado.esEncargado
                ? L('Delete your account and all the information of the center.', 'Elimina tu cuenta y toda la información del centro.')
                : L('Delete your account and your personal data.', 'Elimina tu cuenta y tus datos personales.')}
            </p>
          </div>
        )}
      </div>
      <AnimatePresence>
        {salida === 'centro' && estado && <EliminarCentroDialog centro={estado.centro} onClose={() => setSalida(null)}
          conSuscripcion={!!estado.suscripcion?.estado && ['active', 'on_trial', 'past_due'].includes(estado.suscripcion.estado)} />}
        {salida === 'cuenta' && <EliminarCuentaDialog esFamilia={esPadre} onClose={() => setSalida(null)} />}
      </AnimatePresence>
    </motion.div>
  )
}

export default function SuscripcionPage() {
  const { t } = useI18n()
  return (
    <AuthShell brandTitle={t('vanty.subscription.brandTitle')} brandBody={t('vanty.subscription.brandBody')}>
      <Suspense>
        <SubscriptionStatus />
      </Suspense>
    </AuthShell>
  )
}
