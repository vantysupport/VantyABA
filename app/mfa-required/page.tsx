'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { ShieldCheck, Smartphone, KeyRound, Copy, Check, Loader2, Lock, Fingerprint, Mail, ArrowLeft } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'
import { AuthShell } from '@/components/ui/auth-shell'
import { PLATFORM_NAME } from '@/lib/branding'

type Mode = 'loading' | 'intro' | 'enroll' | 'challenge' | 'email' | 'done'

const HOME: Record<string, string> = {
  programador: '/control', jefe: '/admin', admin: '/admin', especialista: '/especialista', terapeuta: '/admin', secretaria: '/secretaria',
}

function CodeInput({ onComplete, disabled }: { onComplete: (code: string) => void; disabled?: boolean }) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const update = (next: string[]) => {
    setDigits(next)
    if (next.every(d => d !== '')) onComplete(next.join(''))
  }

  return (
    <div className="flex justify-between gap-2" onPaste={e => {
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
      if (!pasted) return
      e.preventDefault()
      const next = Array.from({ length: 6 }, (_, i) => pasted[i] ?? '')
      update(next)
      refs.current[Math.min(pasted.length, 5)]?.focus()
    }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Dígito ${i + 1}`}
          maxLength={1}
          autoFocus={i === 0}
          onChange={e => {
            const v = e.target.value.replace(/\D/g, '').slice(-1)
            const next = [...digits]
            next[i] = v
            update(next)
            if (v && i < 5) refs.current[i + 1]?.focus()
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
          }}
          className="h-14 w-full min-w-0 rounded-v-sm border border-v-border bg-v-elevated text-center text-2xl font-semibold tabular-nums outline-none transition-shadow focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft disabled:opacity-60"
        />
      ))}
    </div>
  )
}

export default function MFAPage() {
  const { t, locale } = useI18n()
  const [mode, setMode] = useState<Mode>('loading')
  const [role, setRole] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  // Código por correo (alternativa a la app de autenticación)
  const [correoMascara, setCorreoMascara] = useState<string | null>(null)
  // 'activar' = eligiendo el correo como método; 'verificar' = iniciando sesión con él
  const [emailAccion, setEmailAccion] = useState<'verificar' | 'activar'>('verificar')
  const [tieneApp, setTieneApp] = useState(false)
  const [espera, setEspera] = useState(0)
  const L = (e: string, es: string) => (locale === 'en' ? e : es)

  useEffect(() => {
    if (espera <= 0) return
    const id = setTimeout(() => setEspera(x => x - 1), 1000)
    return () => clearTimeout(id)
  }, [espera])

  async function enviarCorreo() {
    setBusy(true)
    setError(null)
    const r = await fetch('/api/session/mfa-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'enviar', locale }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (r.status === 429) { setEspera(60); return setError(L('Wait a minute before requesting another code.', 'Espera un minuto antes de pedir otro código.')) }
    if (!r.ok) return setError(L('We could not send the code. Try again.', 'No pudimos enviar el código. Inténtalo de nuevo.'))
    setCorreoMascara(j.correo || null)
    setEspera(60)
    setAttempt(a => a + 1)
  }

  async function verificarCorreo(codigo: string) {
    setBusy(true)
    setError(null)
    const r = await fetch('/api/session/mfa-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: emailAccion, codigo }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (r.ok) return setMode('done')
    setAttempt(a => a + 1)
    if (j.error === 'vencido') return setError(L('The code expired. Request a new one.', 'El código venció. Pide uno nuevo.'))
    if (j.error === 'intentos') return setError(L('Too many attempts. Request a new code.', 'Demasiados intentos. Pide un código nuevo.'))
    setError(typeof j.restantes === 'number'
      ? L(`Incorrect code. ${j.restantes} attempt(s) left.`, `Código incorrecto. Te quedan ${j.restantes} intento(s).`)
      : L('Incorrect code.', 'Código incorrecto.'))
  }

  const required = role === 'programador'
  const home = `/${locale}${HOME[role ?? ''] ?? '/padre'}`

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return window.location.assign(`/${locale}/login`)
      const [{ data: profile }, { data: aal }, { data: factors }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ])
      setRole(profile?.role ?? null)
      if (aal?.currentLevel === 'aal2') return setMode('done')
      const verified = factors?.totp.find(f => f.status === 'verified')
      if (verified) {
        setFactorId(verified.id)
        setTieneApp(true)
        setMode('challenge')
      } else if (user.app_metadata?.mfa_email === true) {
        setEmailAccion('verificar')
        setMode('email')
      } else {
        setMode('intro')
      }
    })()
  }, [locale])

  useEffect(() => {
    if (mode !== 'done') return
    const id = setTimeout(() => window.location.assign(home), 1400)
    return () => clearTimeout(id)
  }, [mode, home])

  async function startEnroll() {
    setBusy(true)
    setError(null)
    // A previous abandoned attempt leaves an unverified factor that blocks a new one.
    const { data: factors } = await supabase.auth.mfa.listFactors()
    for (const f of factors?.all ?? []) {
      if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `${PLATFORM_NAME} ABA` })
    setBusy(false)
    if (enrollError) return setError(t('vanty.mfa.errors.enroll'))
    setFactorId(data.id)
    const code = data.totp.qr_code
    setQr(code.startsWith('data:') ? code : `data:image/svg+xml;utf8,${encodeURIComponent(code)}`)
    setSecret(data.totp.secret)
    setMode('enroll')
  }

  async function verify(code: string) {
    if (!factorId) return
    setBusy(true)
    setError(null)
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    const { error: verifyError } = challengeError
      ? { error: challengeError }
      : await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
    setBusy(false)
    if (verifyError) {
      setError(t('vanty.mfa.errors.code'))
      setAttempt(a => a + 1)
      return
    }
    setMode('done')
  }

  return (
    <AuthShell
      brandTitle={t('vanty.mfa.brandTitle')}
      brandBody={t('vanty.mfa.brandBody')}
      features={[
        { icon: Lock, text: t('vanty.mfa.features.password') },
        { icon: Smartphone, text: t('vanty.mfa.features.phone') },
        { icon: Fingerprint, text: t('vanty.mfa.features.only') },
      ]}
    >
      <AnimatePresence mode="wait">
        {mode === 'loading' && (
          <motion.div key="loading" exit={{ opacity: 0 }} className="grid place-items-center py-20">
            <Loader2 className="size-7 animate-spin text-v-accent" />
          </motion.div>
        )}

        {mode === 'intro' && (
          <motion.div key="intro" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }}>
            <span className="grid size-14 place-items-center rounded-[28%] bg-v-accent-soft"><ShieldCheck className="size-7 text-v-accent" strokeWidth={1.6} /></span>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <h1 className="v-headline text-[2.1rem] sm:text-4xl">{t('vanty.mfa.introTitle')}</h1>
            </div>
            <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${required ? 'bg-v-accent-soft text-v-accent' : 'bg-v-success/15 text-v-success'}`}>
              {t(required ? 'vanty.mfa.requiredBadge' : 'vanty.mfa.optionalBadge')}
            </span>
            <p className="mt-4 text-v-muted">{t(required ? 'vanty.mfa.introRequired' : 'vanty.mfa.introOptional')}</p>


            <p className="mt-8 text-sm font-semibold text-v-text">{L('Choose how you want to verify', 'Elige cómo quieres verificarte')}</p>
            <div className="mt-3 grid gap-3">
              <button onClick={startEnroll} disabled={busy}
                className="flex items-center gap-3 rounded-v-sm border border-v-border p-4 text-left transition-colors hover:border-v-accent/40 hover:bg-v-accent-soft/40 disabled:opacity-60">
                <span className="v-brand grid size-10 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}>{busy ? <Loader2 className="size-5 animate-spin" /> : <Smartphone className="size-5" />}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-v-text">{L('Authenticator app', 'App de autenticación')} <span className="ml-1 rounded-full bg-v-success/15 px-2 py-0.5 text-[10px] font-semibold text-v-success">{L('Most secure', 'Más segura')}</span></span>
                  <span className="block text-xs text-v-muted">{L('Google Authenticator, Authy or similar. Works without signal.', 'Google Authenticator, Authy u otra. Funciona sin señal.')}</span>
                </span>
              </button>
              {!required && (
                <button onClick={() => { setError(null); setCorreoMascara(null); setEmailAccion('activar'); setMode('email') }}
                  className="flex items-center gap-3 rounded-v-sm border border-v-border p-4 text-left transition-colors hover:border-v-accent/40 hover:bg-v-accent-soft/40">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Mail className="size-5" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-v-text">{L('Code by email', 'Código por correo')}</span>
                    <span className="block text-xs text-v-muted">{L('Nothing to install: we email you a code each time you sign in.', 'Sin instalar nada: te enviamos un código al correo cada vez que inicies sesión.')}</span>
                  </span>
                </button>
              )}
            </div>
            {!required && (
              <Link href={home} className="mt-4 block text-center text-sm font-medium text-v-muted hover:text-v-text">{t('vanty.mfa.skip')}</Link>
            )}
          </motion.div>
        )}

        {mode === 'enroll' && (
          <motion.div key="enroll" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            <h1 className="v-headline text-3xl">{t('vanty.mfa.scanTitle')}</h1>
            <p className="mt-2 text-v-muted">{t('vanty.mfa.scanBody')}</p>
            {qr && (
              <div className="mt-6 flex justify-center">
                <div className="rounded-v-lg border border-v-border bg-white p-4 shadow-v">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt={t('vanty.mfa.qrAlt')} width={184} height={184} className="size-46" />
                </div>
              </div>
            )}
            {secret && (
              <button
                onClick={() => { navigator.clipboard?.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                className="mx-auto mt-4 flex max-w-full items-center gap-2 rounded-full bg-v-fill px-4 py-2 font-mono text-xs text-v-muted transition-colors hover:text-v-text"
              >
                <span className="truncate">{secret}</span>
                {copied ? <Check className="size-3.5 shrink-0 text-v-success" /> : <Copy className="size-3.5 shrink-0" />}
              </button>
            )}
            <p className="mt-7 mb-3 text-sm font-medium">{t('vanty.mfa.enterCode')}</p>
            <CodeInput key={attempt} onComplete={verify} disabled={busy} />
          </motion.div>
        )}

        {mode === 'challenge' && (
          <motion.div key="challenge" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <span className="grid size-14 place-items-center rounded-[28%] bg-v-accent-soft"><KeyRound className="size-7 text-v-accent" strokeWidth={1.6} /></span>
            <h1 className="v-headline mt-6 text-[2.1rem] sm:text-4xl">{t('vanty.mfa.challengeTitle')}</h1>
            <p className="mt-2 mb-7 text-v-muted">{t('vanty.mfa.challengeBody')}</p>
            <CodeInput key={attempt} onComplete={verify} disabled={busy} />
            {!required && (
              <button onClick={() => { setError(null); setMode('email') }}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-v-border py-3 text-sm font-semibold text-v-text transition-colors hover:bg-v-fill">
                <Mail className="size-4 text-v-accent" /> {L("Don't have your phone? Get a code by email", '¿No tienes tu celular? Recibir código por correo')}
              </button>
            )}
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.assign(`/${locale}/login`) }}
              className="mt-6 block w-full text-center text-sm text-v-muted hover:text-v-text"
            >
              {t('vanty.mfa.useOtherAccount')}
            </button>
          </motion.div>
        )}

        {mode === 'email' && (
          <motion.div key="email" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            {(emailAccion === 'activar' || tieneApp) && (
              <button onClick={() => { setError(null); setMode(emailAccion === 'activar' ? 'intro' : 'challenge') }} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-v-muted hover:text-v-text">
                <ArrowLeft className="size-4" /> {emailAccion === 'activar' ? L('Back', 'Volver') : L('Use the authenticator app', 'Usar la app de autenticación')}
              </button>
            )}
            <span className="grid size-14 place-items-center rounded-[28%] bg-v-accent-soft"><Mail className="size-7 text-v-accent" strokeWidth={1.6} /></span>
            <h1 className="v-headline mt-6 text-[2.1rem] sm:text-4xl">{L('Code by email', 'Código por correo')}</h1>
            {!correoMascara ? (
              <>
                <p className="mt-2 text-v-muted">{L("We'll send a 6-digit code to your account's email. It expires in 10 minutes.", 'Te enviaremos un código de 6 dígitos al correo de tu cuenta. Vence en 10 minutos.')}</p>
                <button onClick={enviarCorreo} disabled={busy} className="v-brand mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-70">
                  {busy ? <Loader2 className="size-5 animate-spin" /> : <><Mail className="size-4" /> {L('Send code', 'Enviar código')}</>}
                </button>
              </>
            ) : (
              <>
                <p className="mt-2 mb-7 text-v-muted">{L('We sent it to', 'Lo enviamos a')} <strong className="text-v-text">{correoMascara}</strong>. {L('Check spam too.', 'Revisa también la carpeta de spam.')}</p>
                <CodeInput key={`e${attempt}`} onComplete={verificarCorreo} disabled={busy} />
                <button onClick={enviarCorreo} disabled={busy || espera > 0} className="mt-6 block w-full text-center text-sm font-medium text-v-accent disabled:text-v-subtle">
                  {espera > 0 ? L(`Resend code in ${espera}s`, `Reenviar código en ${espera} s`) : L('Resend code', 'Reenviar código')}
                </button>
              </>
            )}
          </motion.div>
        )}

        {mode === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-10 text-center">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
              className="v-brand mx-auto grid size-16 place-items-center rounded-full"
            >
              <Check className="size-8" strokeWidth={2.5} />
            </motion.span>
            <h1 className="v-headline mt-6 text-3xl">{t('vanty.mfa.doneTitle')}</h1>
            <p className="mt-2 text-v-muted">{t('vanty.mfa.doneBody')}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 rounded-v-sm bg-v-danger/10 px-3 py-2.5 text-sm text-v-danger">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </AuthShell>
  )
}
