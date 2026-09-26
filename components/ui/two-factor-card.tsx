'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, ShieldOff, Loader2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'
import { confirmar } from '@/components/ui/confirmar'

// Optional two-step verification for center accounts (only the platform console makes it mandatory).
export function TwoFactorCard() {
  const { t, locale } = useI18n()
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => setFactorId(data?.totp.find(f => f.status === 'verified')?.id ?? null))
  }, [])

  async function disable() {
    if (!factorId || !await confirmar(t('vanty.twoFactor.disableConfirm'))) return
    setBusy(true)
    setError(null)
    // Supabase only allows removing a factor from a session that already passed it (aal2).
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId })
    setBusy(false)
    if (unenrollError) return setError(t('vanty.twoFactor.verifyFirst'))
    setFactorId(null)
  }

  const active = !!factorId

  return (
    <div className="v-scope rounded-2xl border border-v-border bg-v-elevated p-5">
      <div className="flex items-start gap-4">
        <span className={`grid size-11 shrink-0 place-items-center rounded-[28%] ${active ? 'bg-v-success/15 text-v-success' : 'bg-v-accent-soft text-v-accent'}`}>
          {active ? <ShieldCheck className="size-5" /> : <ShieldOff className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{t('vanty.twoFactor.title')}</p>
            {factorId !== undefined && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${active ? 'bg-v-success/15 text-v-success' : 'bg-v-fill text-v-muted'}`}>
                {t(active ? 'vanty.twoFactor.on' : 'vanty.twoFactor.off')}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-v-muted">{t(active ? 'vanty.twoFactor.onBody' : 'vanty.twoFactor.offBody')}</p>
          {error && (
            <p className="mt-2 text-sm text-v-danger">
              {error}{' '}
              <Link href={`/${locale}/mfa-required`} className="font-medium underline">{t('vanty.twoFactor.verifyLink')}</Link>
            </p>
          )}
          <div className="mt-4">
            {factorId === undefined ? (
              <Loader2 className="size-4 animate-spin text-v-subtle" />
            ) : active ? (
              <button onClick={disable} disabled={busy} className="h-9 rounded-full border border-v-border px-4 text-sm font-medium text-v-danger transition-colors hover:bg-v-danger/10 disabled:opacity-60">
                {t('vanty.twoFactor.disable')}
              </button>
            ) : (
              <Link href={`/${locale}/mfa-required`} className="v-brand inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold">
                {t('vanty.twoFactor.enable')}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
