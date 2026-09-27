'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, Building2, MailOpen, CalendarCheck, Sparkles, ShieldCheck, Check } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'
import { useOAuthProviders } from '@/lib/use-oauth-providers'
import { claimSession } from '@/lib/session-lock'
import { reenviarConfirmacion, signInGuarded } from '@/app/login/actions'
import { emailRecordado, guardarPreferencia, prefRecordar } from '@/lib/recordar-sesion'
import { AuthShell } from '@/components/ui/auth-shell'

interface PageProps {
  searchParams: Promise<{ mode?: string; session?: string; redirect?: string }>
}

type Tab = 'signin' | 'new'

const HOME: Record<string, string> = {
  programador: '/control', jefe: '/admin', admin: '/admin', especialista: '/especialista', terapeuta: '/admin', secretaria: '/secretaria',
}

const inputClass =
  'h-12 w-full rounded-v-sm border border-v-border bg-v-elevated pr-4 pl-11 text-[16px] outline-none transition-shadow placeholder:text-v-subtle focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft'

export default function LoginPage(props: PageProps) {
  const searchParams = use(props.searchParams)
  const router = useRouter()
  const { t, locale } = useI18n()
  const [tab, setTab] = useState<Tab>(searchParams.mode === 'signup' ? 'new' : 'signin')
  const [isLoading, setIsLoading] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [lockMinutes, setLockMinutes] = useState(15)
  // Cuenta creada pero sin verificar: aviso con reenvío del correo en vez de un error
  const [emailPendiente, setEmailPendiente] = useState('')
  const [reenvio, setReenvio] = useState<'idle' | 'enviando' | 'enviado' | 'espera' | 'error'>('idle')
  const [esperaSeg, setEsperaSeg] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  // Mantener sesión iniciada (y recordar el correo); se lee del navegador al montar
  const [recordar, setRecordar] = useState(true)
  const [emailInicial, setEmailInicial] = useState('')
  useEffect(() => { setRecordar(prefRecordar()); setEmailInicial(emailRecordado()) }, [])
  const proveedores = useOAuthProviders()

  useEffect(() => {
    if (searchParams.session === 'taken') setErrorKey('sessionTaken')
    // Llegó aquí porque su sesión venció mientras usaba un panel (el proxy agrega ?redirect=)
    else if (searchParams.redirect) setErrorKey('sessionExpired')
  }, [searchParams.session, searchParams.redirect])

  async function oauth(provider: 'google' | 'azure') {
    setIsLoading(true)
    setErrorKey(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        ...(provider === 'azure' ? { scopes: 'email profile openid offline_access' } : {}),
      },
    })
    if (error) {
      setErrorKey('oauth')
      setIsLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setIsLoading(true)
    setErrorKey(null)
    try {
      const result = await signInGuarded(String(f.get('email') ?? ''), String(f.get('password') ?? ''))
      if (!result.ok) {
        if (result.code === 'locked') setLockMinutes(result.minutes ?? 15)
        if (result.code === 'unconfirmed') { setEmailPendiente(String(f.get('email') ?? '').trim()); setReenvio('idle') }
        setErrorKey(result.code)
        setIsLoading(false)
        return
      }
      // The server action set the auth cookies; hydrate the browser client from them.
      await supabase.auth.getSession()
      guardarPreferencia(recordar, String(f.get('email') ?? ''))

      if ((await claimSession()) === 'in_use') {
        setErrorKey('sessionTaken')
        setIsLoading(false)
        // scope 'local' closes only this blocked session, not the active one on the other device.
        supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        return
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', result.userId).maybeSingle()
      router.push(HOME[profile?.role ?? ''] ?? '/padre')
    } catch {
      setErrorKey('network')
      setIsLoading(false)
    }
  }

  const errorText = errorKey && errorKey !== 'unconfirmed' ? t(`vanty.login.errors.${errorKey}`, { minutes: String(lockMinutes) }) : null
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const reenviar = async () => {
    setReenvio('enviando')
    try {
      const r = await reenviarConfirmacion(emailPendiente, locale === 'en' ? 'en' : 'es')
      if (r.ok) setReenvio('enviado')
      else if (r.espera) { setEsperaSeg(r.espera); setReenvio('espera') }
      else setReenvio('error')
    } catch { setReenvio('error') }
  }

  return (
    <AuthShell
      brandTitle={t('vanty.login.brandTitle')}
      brandBody={t('vanty.login.brandBody')}
      features={[
        { icon: CalendarCheck, text: t('vanty.login.features.calendar') },
        { icon: Sparkles, text: t('vanty.login.features.aria') },
        { icon: ShieldCheck, text: t('vanty.login.features.secure') },
      ]}
    >
          <motion.h1 key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="v-headline text-[2.1rem] sm:text-4xl">
            {t(tab === 'signin' ? 'vanty.login.signinTitle' : 'vanty.login.newTitle')}
          </motion.h1>
          <p className="mt-2 text-v-muted">{t(tab === 'signin' ? 'vanty.login.signinSubtitle' : 'vanty.login.newSubtitle')}</p>

          <div role="tablist" className="mt-7 grid grid-cols-2 rounded-full bg-v-fill p-1">
            {(['signin', 'new'] as const).map(id => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => { setTab(id); setErrorKey(null) }}
                className={`relative h-10 rounded-full text-sm font-semibold transition-colors ${tab === id ? 'text-v-text' : 'text-v-muted'}`}
              >
                {tab === id && <motion.span layoutId="login-tab" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-full bg-v-elevated shadow-v" />}
                <span className="relative">{t(`vanty.login.tabs.${id}`)}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === 'signin' ? (
              <motion.div key="signin" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="mt-6">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-v-muted">{t('vanty.login.email')}</span>
                    <span className="relative block">
                      <Mail className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-v-subtle" />
                      <input key={emailInicial} name="email" type="email" required autoComplete="email" defaultValue={emailInicial} placeholder="tu@correo.com" className={inputClass} />
                    </span>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-v-muted">
                      {t('vanty.login.password')}
                      <Link href={`/${locale}/reset-password`} className="text-v-accent hover:underline">{t('vanty.login.forgot')}</Link>
                    </span>
                    <span className="relative block">
                      <Lock className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-v-subtle" />
                      <input name="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" className={inputClass} />
                      <button type="button" onClick={() => setShowPassword(s => !s)} aria-label={t('vanty.login.togglePassword')} className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full text-v-subtle hover:text-v-text">
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </span>
                  </label>

                  {/* Mantener sesión iniciada */}
                  <label className="-mt-1 flex cursor-pointer select-none items-center gap-2.5">
                    <input type="checkbox" checked={recordar} onChange={e => setRecordar(e.target.checked)} className="peer sr-only" />
                    <span aria-hidden className={`grid size-5 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-v-accent-soft ${recordar ? 'v-brand border-transparent' : 'border-v-border bg-v-elevated'}`} style={recordar ? { boxShadow: 'none' } : undefined}>
                      {recordar && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className="text-sm text-v-text">{L('Keep me signed in', 'Mantener sesión iniciada')}</span>
                    <span className="ml-auto text-xs text-v-subtle">{recordar ? L('Remembers your email', 'Recuerda tu correo') : L('Closes with the browser', 'Se cierra con el navegador')}</span>
                  </label>

                  <AnimatePresence>
                    {errorKey === 'unconfirmed' && (
                      <motion.div role="status" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="rounded-v-sm border border-v-accent/25 bg-v-accent-soft p-3.5">
                          <div className="flex items-start gap-3">
                            <span className="v-brand grid size-9 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><MailOpen size={17} /></span>
                            <div className="min-w-0 text-sm">
                              <p className="font-semibold text-v-text">{L('Verify your email to continue', 'Verifica tu correo para continuar')}</p>
                              <p className="mt-0.5 leading-relaxed text-v-muted">
                                {L('Your account is created. Open the link we sent to ', 'Tu cuenta ya está creada. Abre el enlace que te enviamos a ')}
                                <strong className="break-all text-v-text">{emailPendiente}</strong>
                                {L(' to activate it. Check your spam or promotions folder too.', ' para activarla. Revisa también la carpeta de spam o promociones.')}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2 pl-12">
                            <button type="button" onClick={reenviar} disabled={reenvio === 'enviando' || reenvio === 'enviado'}
                              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-v-accent/30 bg-v-elevated px-3.5 text-xs font-semibold text-v-accent transition-colors hover:bg-v-bg disabled:opacity-70">
                              {reenvio === 'enviando' ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                              {reenvio === 'enviado' ? L('Email sent', 'Correo enviado') : L('Resend email', 'Reenviar correo')}
                            </button>
                            {reenvio === 'enviado' && <span className="text-xs text-v-success">{L('Check your inbox in a minute.', 'Revisa tu bandeja en un minuto.')}</span>}
                            {reenvio === 'espera' && <span className="text-xs text-v-muted">{L(`Wait ${esperaSeg}s to resend.`, `Espera ${esperaSeg} s para reenviar.`)}</span>}
                            {reenvio === 'error' && <span className="text-xs text-v-danger">{L('We could not send it. Try again later.', 'No pudimos enviarlo. Intenta más tarde.')}</span>}
                          </div>
                        </div>
                      </motion.div>
                    )}
                    {errorText && (
                      <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="rounded-v-sm bg-v-danger/10 px-3 py-2.5 text-sm text-v-danger">
                        {errorText}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <button type="submit" disabled={isLoading} className="v-brand mt-1 flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-70">
                    {isLoading ? <Loader2 className="size-5 animate-spin" /> : <>{t('vanty.login.submit')}<ArrowRight className="size-4" /></>}
                  </button>
                </form>

                {proveedores && (proveedores.google || proveedores.azure) && (<>
                <div className="my-6 flex items-center gap-3 text-xs text-v-subtle">
                  <span className="h-px flex-1 bg-v-border" />{t('vanty.login.or')}<span className="h-px flex-1 bg-v-border" />
                </div>
                <div className={`grid gap-3 ${proveedores.google && proveedores.azure ? 'grid-cols-2' : ''}`}>
                  {proveedores.google && (
                  <button onClick={() => oauth('google')} disabled={isLoading} className="flex h-11 items-center justify-center gap-2 rounded-full border border-v-border bg-v-elevated text-sm font-medium transition-colors hover:bg-v-fill">
                    <svg className="size-4" viewBox="0 0 24 24" aria-hidden><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"/></svg>
                    Google
                  </button>
                  )}
                  {proveedores.azure && (
                  <button onClick={() => oauth('azure')} disabled={isLoading} className="flex h-11 items-center justify-center gap-2 rounded-full border border-v-border bg-v-elevated text-sm font-medium transition-colors hover:bg-v-fill">
                    <svg className="size-4" viewBox="0 0 23 23" aria-hidden><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>
                    Microsoft
                  </button>
                  )}
                </div>
                </>)}
              </motion.div>
            ) : (
              <motion.div key="new" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="mt-6 flex flex-col gap-3">
                <Link href={`/${locale}/crear-centro`} className="group rounded-v-lg border border-v-border bg-v-elevated p-5 shadow-v transition-all hover:-translate-y-0.5 hover:border-v-accent">
                  <span className="v-brand grid size-11 place-items-center rounded-[28%]"><Building2 className="size-5" /></span>
                  <p className="mt-4 font-semibold">{t('vanty.login.createTitle')}</p>
                  <p className="mt-1 text-sm text-v-muted">{t('vanty.login.createBody')}</p>
                  <p className="mt-3 flex items-center gap-1 text-sm font-semibold text-v-accent">
                    {t('vanty.login.createCta')}<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </p>
                </Link>
                <div className="rounded-v-lg border border-v-border bg-v-elevated p-5">
                  <span className="grid size-11 place-items-center rounded-[28%] bg-v-accent-soft text-v-accent"><MailOpen className="size-5" /></span>
                  <p className="mt-4 font-semibold">{t('vanty.login.invitedTitle')}</p>
                  <p className="mt-1 text-sm text-v-muted">{t('vanty.login.invitedBody')}</p>
                </div>
                <Link href={`/${locale}/precios`} className="mt-1 text-center text-sm font-medium text-v-accent hover:underline">{t('vanty.login.seePlans')}</Link>
              </motion.div>
            )}
          </AnimatePresence>
    </AuthShell>
  )
}
