'use client'

import { Suspense, useActionState, useRef, useState, type InputHTMLAttributes } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { MailCheck, ImagePlus, ArrowLeft, Gift, Users, FileBadge, Mail, MousePointerClick, LogIn, ExternalLink, Inbox, CheckCircle2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { FlipButton, FlipButtonBack, FlipButtonFront } from '@/components/ui/flip-button'
import { AuthShell } from '@/components/ui/auth-shell'
import { createCentro, type CreateCentroState } from './actions'

const inputClass =
  'h-12 w-full rounded-v-sm border border-v-border bg-v-elevated px-4 text-[16px] outline-none transition-shadow focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft'

function Input({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-v-muted">{label}</span>
      <input {...props} className={inputClass} />
      {hint && <span className="mt-1 block text-xs text-v-subtle">{hint}</span>}
    </label>
  )
}

function LogoPicker({ label, hint, changeLabel }: { label: string; hint: string; changeLabel: string }) {
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-v-muted">{label}</span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center gap-4 rounded-v border border-dashed border-[var(--v-border-strong)] p-3 text-left transition-colors hover:bg-v-fill"
      >
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-[23%] bg-v-accent-soft">
          {preview
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={preview} alt="" className="size-full object-cover" />
            : <ImagePlus className="size-6 text-v-accent" strokeWidth={1.5} />}
        </span>
        <span className="text-sm">
          <span className="block font-medium text-v-accent">{preview ? changeLabel : label}</span>
          <span className="block text-xs text-v-subtle">{hint}</span>
        </span>
      </button>
      <input
        ref={inputRef}
        name="logo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          setPreview(file ? URL.createObjectURL(file) : null)
        }}
      />
    </div>
  )
}

function CreateCentroForm() {
  const { t, locale } = useI18n()
  const params = useSearchParams()
  const plan = params.get('plan') ?? 'starter'
  const ciclo = params.get('ciclo') === 'anual' ? 'anual' : 'mensual'
  const [state, action, pending] = useActionState<CreateCentroState, FormData>(createCentro, {})
  const [step, setStep] = useState<1 | 2>(1)
  const stepOneRef = useRef<HTMLDivElement>(null)

  const next = () => {
    const fields = stepOneRef.current?.querySelectorAll<HTMLInputElement>('input:not([type=file])') ?? []
    for (const f of fields) if (!f.reportValidity()) return
    setStep(2)
  }

  if (state.ok) return <CentroCreado email={state.email ?? ''} dias={state.trialDays ?? 14} />

  return (
    <>
      <h1 className="v-headline text-[2.1rem] sm:text-4xl">{t('vanty.createCenter.title')}</h1>
      <p className="mt-2 mb-6 text-v-muted">{t('vanty.createCenter.subtitle')}</p>
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="ciclo" value={ciclo} />
      <input type="hidden" name="locale" value={locale} />

      <div className="mb-2 flex items-center gap-3">
        {step === 2 && (
          <button type="button" onClick={() => setStep(1)} aria-label={t('vanty.createCenter.back')} className="grid size-8 place-items-center rounded-full text-v-muted hover:bg-v-fill">
            <ArrowLeft className="size-4" />
          </button>
        )}
        <div className="flex-1">
          <p className="text-xs font-medium text-v-subtle">{t('vanty.createCenter.stepOf', { n: String(step) })}</p>
          <p className="font-semibold">{t(step === 1 ? 'vanty.createCenter.step1Title' : 'vanty.createCenter.step2Title')}</p>
        </div>
      </div>
      <div className="mb-2 h-1 overflow-hidden rounded-full bg-v-fill">
        <motion.div className="v-brand h-full rounded-full" animate={{ width: step === 1 ? '50%' : '100%' }} transition={{ type: 'spring', stiffness: 160, damping: 24 }} />
      </div>

      {/* Both steps stay mounted so every field is submitted in one FormData. */}
      <motion.div ref={stepOneRef} hidden={step !== 1} initial={false} animate={step === 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -24 }} className="flex flex-col gap-3">
        <Input name="centroName" required minLength={2} autoComplete="organization" label={t('vanty.createCenter.fields.centroName')} />
        <Input name="direccion" required minLength={4} autoComplete="street-address" label={t('vanty.createCenter.fields.direccion')} />
        <div className="grid grid-cols-2 gap-3">
          <Input name="telefono" type="tel" required minLength={6} autoComplete="tel" label={t('vanty.createCenter.fields.telefono')} />
          <Input name="ruc" inputMode="numeric" pattern="[0-9A-Za-z-]{6,20}" label={t('vanty.createCenter.fields.ruc')} hint={t('vanty.createCenter.rucHint')} />
        </div>
        <Input name="centroEmail" type="email" required autoComplete="email" label={t('vanty.createCenter.fields.centroEmail')} />
        <LogoPicker label={t('vanty.createCenter.fields.logo')} hint={t('vanty.createCenter.logoHint')} changeLabel={t('vanty.createCenter.logoChange')} />
        <button type="button" onClick={next} className="v-brand mt-3 h-11 rounded-full text-[15px] font-semibold transition-transform active:scale-95">
          {t('vanty.createCenter.continue')}
        </button>
      </motion.div>

      <motion.div hidden={step !== 2} initial={false} animate={step === 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 24 }} className="flex flex-col gap-3">
        <Input name="fullName" required minLength={2} autoComplete="name" label={t('vanty.createCenter.fields.fullName')} />
        <Input name="email" type="email" required autoComplete="email" label={t('vanty.createCenter.fields.email')} />
        <Input name="password" type="password" required minLength={8} autoComplete="new-password" label={t('vanty.createCenter.fields.password')} />
        <AnimatePresence>
          {state.error && (
            <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-sm text-v-danger">
              {t(state.error)}
            </motion.p>
          )}
        </AnimatePresence>
        <FlipButton type="submit" disabled={pending} className="mt-3 w-full">
          <FlipButtonFront>{pending ? t('vanty.createCenter.creating') : t('vanty.createCenter.submit')}</FlipButtonFront>
          <FlipButtonBack>{t('vanty.createCenter.submitHover')}</FlipButtonBack>
        </FlipButton>
        <p className="mt-2 text-center text-xs text-v-subtle">{t('vanty.createCenter.trialNote')}</p>
      </motion.div>
    </form>
    </>
  )
}

// Pantalla tras crear el centro: confirmar correo y entrar
function CentroCreado({ email, dias }: { email: string; dias: number }) {
  const { locale } = useI18n()
  const L = (e: string, s: string) => (locale === 'en' ? e : s)
  const dominio = email.split('@')[1]?.toLowerCase() || ''
  const buzon = /gmail|googlemail/.test(dominio) ? { url: 'https://mail.google.com/mail/u/0/#inbox', nombre: 'Gmail' }
    : /outlook|hotmail|live|msn/.test(dominio) ? { url: 'https://outlook.live.com/mail/0/inbox', nombre: 'Outlook' }
    : /yahoo/.test(dominio) ? { url: 'https://mail.yahoo.com', nombre: 'Yahoo Mail' } : null
  const pasos = [
    { Icon: Inbox, t: L('Open your inbox', 'Abre tu bandeja de entrada'), d: L('Look for the email from Vanty ABA.', 'Busca el correo de Vanty ABA.') },
    { Icon: MousePointerClick, t: L('Confirm your account', 'Confirma tu cuenta'), d: L('Click the button in the email.', 'Haz clic en el botón del correo.') },
    { Icon: LogIn, t: L('Sign in to your center', 'Entra a tu centro'), d: L(`Your ${dias}-day free trial starts right away.`, `Tu prueba gratis de ${dias} días empieza de inmediato.`) },
  ]
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 24 }}>
      <div className="relative mx-auto grid size-20 place-items-center">
        <motion.span className="absolute inset-0 rounded-full bg-v-accent-soft" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: [0.6, 1.15, 1], opacity: 1 }} transition={{ duration: 0.7 }} />
        <motion.span className="absolute inset-0 rounded-full ring-2 ring-v-accent/30" animate={{ scale: [1, 1.35], opacity: [0.6, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }} />
        <span className="v-brand relative grid size-14 place-items-center rounded-full"><MailCheck className="size-7" strokeWidth={1.75} /></span>
      </div>

      <div className="mt-5 text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-v-success/15 px-3 py-1 text-xs font-semibold text-v-success"><CheckCircle2 className="size-3.5" /> {L('Center created', 'Centro creado')}</p>
        <h1 className="v-headline mt-3 text-[2rem] leading-tight sm:text-4xl">{L('Check your ', 'Revisa tu ')}<span className="v-brand-text">{L('email', 'correo')}</span></h1>
        <p className="mt-2 text-v-muted">{L('We sent a confirmation link to', 'Enviamos un enlace de confirmación a')}</p>
        <p className="mx-auto mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-v-border bg-v-elevated px-4 py-2 text-sm font-semibold text-v-text shadow-v">
          <Mail className="size-4 shrink-0 text-v-accent" /><span className="truncate">{email}</span>
        </p>
      </div>

      <ol className="mt-7 space-y-2.5">
        {pasos.map((p, i) => (
          <motion.li key={p.t} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.08 }}
            className="flex items-center gap-3 rounded-v-sm border border-v-border bg-v-elevated p-3">
            <span className="relative grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent">
              <p.Icon className="size-[18px]" />
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-v-accent text-[10px] font-bold text-white">{i + 1}</span>
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-v-text">{p.t}</span>
              <span className="block text-xs text-v-muted">{p.d}</span>
            </span>
          </motion.li>
        ))}
      </ol>

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
        {buzon && (
          <a href={buzon.url} target="_blank" rel="noopener noreferrer" className="v-brand inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold">
            {L(`Open ${buzon.nombre}`, `Abrir ${buzon.nombre}`)} <ExternalLink className="size-4" />
          </a>
        )}
        <Link href={`/${locale}/login`} className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold ${buzon ? 'border border-v-border bg-v-elevated text-v-text hover:bg-v-fill' : 'v-brand'}`}>
          <LogIn className="size-4" /> {L('Go to sign in', 'Ir a iniciar sesión')}
        </Link>
      </div>
      <p className="mt-4 text-center text-xs text-v-subtle">{L("Didn't get it? Check your spam or promotions folder; it can take a couple of minutes.", '¿No te llegó? Revisa spam o promociones; puede tardar un par de minutos.')}</p>
    </motion.div>
  )
}

export default function CrearCentroPage() {
  const { t, locale } = useI18n()
  return (
    <AuthShell
      brandTitle={t('vanty.createCenter.brandTitle')}
      brandBody={t('vanty.createCenter.brandBody')}
      features={[
        { icon: Gift, text: t('vanty.createCenter.features.trial') },
        { icon: Users, text: t('vanty.createCenter.features.invites') },
        { icon: FileBadge, text: t('vanty.createCenter.features.branding') },
      ]}
    >
        <div>
          <Suspense>
            <CreateCentroForm />
          </Suspense>
        </div>
        <p className="mt-8 text-center text-sm text-v-muted">
          {t('vanty.createCenter.haveAccount')}{' '}
          <Link href={`/${locale}/login`} className="font-medium text-v-accent hover:underline">{t('vanty.nav.signIn')}</Link>
        </p>
    </AuthShell>
  )
}
