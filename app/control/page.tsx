'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { LayoutGrid, Building2, Tags, ShieldCheck, SlidersHorizontal, Bug, LogOut, Lock, KeyRound } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'
import { VantyLogo } from '@/components/ui/vanty-logo'
import { callControl, ControlError } from './api'
import { OverviewSection } from './sections/overview'
import { CentrosSection } from './sections/centros'
import { PlanesSection } from './sections/planes'
import { SeguridadSection } from './sections/seguridad'
import { PlataformaSection } from './sections/plataforma'
import { ErroresSection } from './sections/errores'

const TABS = [
  { id: 'overview', icon: LayoutGrid },
  { id: 'centros', icon: Building2 },
  { id: 'plans', icon: Tags },
  { id: 'security', icon: ShieldCheck },
  { id: 'platform', icon: SlidersHorizontal },
  { id: 'errors', icon: Bug },
] as const

type TabId = (typeof TABS)[number]['id']
type Phase = 'loading' | 'ok' | 'forbidden' | 'mfa_required'

export default function ControlPage() {
  const { t, locale } = useI18n()
  const [phase, setPhase] = useState<Phase>('loading')
  const [tab, setTab] = useState<TabId>('overview')
  const [toast, setToast] = useState<string | null>(null)

  const handleError = useCallback((e: unknown) => {
    if (e instanceof ControlError) {
      if (e.code === 'no_session') return window.location.assign(`/${locale}/login`)
      if (e.code === 'forbidden') return setPhase('forbidden')
      if (e.code === 'mfa_required') return setPhase('mfa_required')
      setToast(t('vanty.control.errorGeneric', { code: e.code }))
      return
    }
    setToast(t('vanty.control.errorGeneric', { code: 'network' }))
  }, [locale, t])

  useEffect(() => {
    callControl('overview').then(() => setPhase('ok')).catch(handleError)
  }, [handleError])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(id)
  }, [toast])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.assign(`/${locale}/login`)
  }

  if (phase !== 'ok') {
    return (
      <main className="v-root grid min-h-dvh place-items-center px-4">
        {phase === 'loading' ? (
          <motion.div animate={{ opacity: [0.5, 1, 0.5], scale: [0.96, 1, 0.96] }} transition={{ repeat: Infinity, duration: 1.4 }}><VantyLogo size={56} withWordmark={false} /></motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm rounded-v-lg border border-v-border bg-v-elevated p-8 text-center shadow-v-lg">
            {phase === 'forbidden' ? <Lock className="mx-auto size-10 text-v-danger" strokeWidth={1.5} /> : <KeyRound className="mx-auto size-10 text-v-accent" strokeWidth={1.5} />}
            <h1 className="v-headline mt-4 text-2xl">{t(`vanty.control.gate.${phase}.title`)}</h1>
            <p className="mt-2 text-sm text-v-muted">{t(`vanty.control.gate.${phase}.body`)}</p>
            {phase === 'mfa_required' ? (
              <Link href={`/${locale}/mfa-required`} className="mt-6 inline-grid h-11 w-full place-items-center v-brand rounded-full text-[15px] font-semibold">
                {t('vanty.control.gate.mfa_required.cta')}
              </Link>
            ) : (
              <button onClick={signOut} className="mt-6 text-sm text-v-muted hover:text-v-text">{t('vanty.control.signOut')}</button>
            )}
          </motion.div>
        )}
      </main>
    )
  }

  return (
    <main className="v-root min-h-dvh">
      <header className="v-glass sticky top-0 z-30 border-x-0 border-t-0">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <span className="flex items-center gap-2"><VantyLogo size={28} /><span className="text-[15px] text-v-muted">· {t('vanty.control.console')}</span></span>
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {TABS.map(({ id, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)} className={`relative flex h-9 items-center gap-2 rounded-full px-3.5 text-sm transition-colors ${tab === id ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
                {tab === id && <motion.span layoutId="control-tab" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-full bg-v-accent-soft" />}
                <Icon className="relative size-4" />
                <span className="relative">{t(`vanty.control.tabs.${id}`)}</span>
              </button>
            ))}
          </nav>
          <button onClick={signOut} aria-label={t('vanty.control.signOut')} className="ml-auto grid size-9 place-items-center rounded-full text-v-muted hover:bg-v-fill hover:text-v-text md:ml-0">
            <LogOut className="size-4" />
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
          {TABS.map(({ id, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`relative flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-sm ${tab === id ? 'text-v-accent' : 'text-v-muted'}`}>
              {tab === id && <motion.span layoutId="control-tab-mobile" className="absolute inset-0 rounded-full bg-v-accent-soft" />}
              <Icon className="relative size-4" />
              <span className="relative">{t(`vanty.control.tabs.${id}`)}</span>
            </button>
          ))}
        </nav>
      </header>

      <AnimatePresence mode="wait">
        <motion.section
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          className="mx-auto max-w-6xl px-4 py-8"
        >
          {tab === 'overview' && <OverviewSection onOpenSecurity={() => setTab('security')} onOpenCentros={() => setTab('centros')} onError={handleError} />}
          {tab === 'centros' && <CentrosSection onError={handleError} />}
          {tab === 'plans' && <PlanesSection onError={handleError} />}
          {tab === 'security' && <SeguridadSection onError={handleError} />}
          {tab === 'platform' && <PlataformaSection onError={handleError} />}
          {tab === 'errors' && <ErroresSection onError={handleError} />}
        </motion.section>
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            className="v-glass fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-3 text-sm shadow-v-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
