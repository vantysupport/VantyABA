'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { MailCheck, KeyRound, Link2, Timer, ShieldCheck } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'
import { AuthShell } from '@/components/ui/auth-shell'

type Mode = 'loading' | 'request' | 'sent' | 'set' | 'done'

const HOME: Record<string, string> = {
  programador: '/control', jefe: '/admin', admin: '/admin', especialista: '/especialista', terapeuta: '/admin', secretaria: '/secretaria',
}

const inputClass =
  'h-12 w-full rounded-v-sm border border-v-border bg-v-elevated px-4 text-[16px] outline-none transition-shadow focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft'

export default function ResetPasswordPage() {
  const { t, locale } = useI18n()
  const [mode, setMode] = useState<Mode>('loading')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Arriving from the recovery email, /auth/callback already exchanged the code, so a session means "set a new password".
  useEffect(() => {
    const expired = new URLSearchParams(window.location.search).has('expired')
    supabase.auth.getSession().then(({ data }) => {
      setMode(data.session ? 'set' : 'request')
      if (expired && !data.session) setError(t('vanty.resetPassword.expired'))
    })
  }, [t])

  async function requestLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email') ?? '').trim().toLowerCase()
    setBusy(true)
    setError(null)
    // The response is the same whether or not the account exists, so the form can't be used to discover emails.
    await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, locale }),
    }).catch(() => null)
    setBusy(false)
    setMode('sent')
  }

  async function setPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const password = String(f.get('password') ?? '')
    if (password.length < 8) return setError(t('vanty.resetPassword.tooShort'))
    if (password !== String(f.get('confirm') ?? '')) return setError(t('vanty.resetPassword.mismatch'))
    setBusy(true)
    setError(null)
    const { data, error: updateError } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (updateError) return setError(t('vanty.resetPassword.failed'))
    setMode('done')
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
    setTimeout(() => window.location.assign(`/${locale}${HOME[profile?.role ?? ''] ?? '/padre'}`), 1200)
  }

  return (
    <AuthShell
      brandTitle={t('vanty.resetPassword.brandTitle')}
      brandBody={t('vanty.resetPassword.brandBody')}
      features={[
        { icon: Link2, text: t('vanty.resetPassword.features.link') },
        { icon: Timer, text: t('vanty.resetPassword.features.expires') },
        { icon: ShieldCheck, text: t('vanty.resetPassword.features.never') },
      ]}
    >
        <div>
          <AnimatePresence mode="wait">
            {(mode === 'request' || mode === 'loading') && (
              <motion.form key="request" onSubmit={requestLink} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-3">
                <h1 className="v-headline text-3xl">{t('vanty.resetPassword.requestTitle')}</h1>
                <p className="mb-3 text-v-muted">{t('vanty.resetPassword.requestBody')}</p>
                <input name="email" type="email" required autoComplete="email" placeholder={t('vanty.resetPassword.email')} className={inputClass} />
                <button type="submit" disabled={busy || mode === 'loading'} className="v-brand mt-2 h-11 rounded-full text-[15px] font-semibold transition-transform active:scale-95 disabled:opacity-60">
                  {t('vanty.resetPassword.send')}
                </button>
              </motion.form>
            )}
            {mode === 'sent' && (
              <motion.div key="sent" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                <MailCheck className="mx-auto size-12 text-v-accent" strokeWidth={1.5} />
                <h1 className="v-headline mt-4 text-3xl">{t('vanty.resetPassword.sentTitle')}</h1>
                <p className="mt-3 text-v-muted">{t('vanty.resetPassword.sentBody')}</p>
              </motion.div>
            )}
            {mode === 'set' && (
              <motion.form key="set" onSubmit={setPassword} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
                <KeyRound className="size-9 text-v-accent" strokeWidth={1.5} />
                <h1 className="v-headline text-3xl">{t('vanty.resetPassword.setTitle')}</h1>
                <p className="mb-3 text-v-muted">{t('vanty.resetPassword.setBody')}</p>
                <input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder={t('vanty.resetPassword.password')} className={inputClass} />
                <input name="confirm" type="password" required minLength={8} autoComplete="new-password" placeholder={t('vanty.resetPassword.confirm')} className={inputClass} />
                <button type="submit" disabled={busy} className="v-brand mt-2 h-11 rounded-full text-[15px] font-semibold transition-transform active:scale-95 disabled:opacity-60">
                  {t('vanty.resetPassword.save')}
                </button>
              </motion.form>
            )}
            {mode === 'done' && (
              <motion.p key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center font-medium">{t('vanty.resetPassword.done')}</motion.p>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {error && (
              <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 text-sm text-v-danger">
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <Link href={`/${locale}/login`} className="mt-8 text-center text-sm font-medium text-v-accent hover:underline">{t('vanty.resetPassword.backToLogin')}</Link>
    </AuthShell>
  )
}
