'use client'

import type { ReactNode, ComponentType } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { useI18n } from '@/lib/i18n-context'
import { VantyLogo } from '@/components/ui/vanty-logo'
import LocaleSelector from '@/app/components/LocaleSelector'

export type AuthFeature = { icon: ComponentType<{ className?: string }>; text: string }

type AuthShellProps = {
  brandTitle: string
  brandBody: string
  features?: AuthFeature[]
  children: ReactNode
}

// Shared frame for every sign-in / signup screen: brand panel + form, so no page is a lone card in empty space.
export function AuthShell({ brandTitle, brandBody, features = [], children }: AuthShellProps) {
  const { t, locale } = useI18n()

  return (
    <main className="v-root min-h-dvh lg:grid lg:grid-cols-[1fr_1.05fr]">
      <section className="v-brand v-sweep relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12" style={{ boxShadow: 'none' }}>
        <Ambient />
        <Link href={`/${locale}`} className="relative z-10 w-fit">
          <VantyLogo variant="white" size={40} className="[&>span]:text-2xl" />
        </Link>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 90, damping: 18, delay: 0.1 }} className="relative z-10 max-w-md">
          <h2 className="v-headline v-shine-text text-5xl">{brandTitle}</h2>
          <p className="mt-5 text-lg text-white/85">{brandBody}</p>
          {features.length > 0 && (
            <ul className="mt-10 space-y-3">
              {features.map(({ icon: Icon, text }, i) => (
                <motion.li
                  key={text}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 160, damping: 20, delay: 0.3 + i * 0.1 }}
                  whileHover={{ x: 4 }}
                  style={{ ['--v-sweep-delay' as string]: `${1.2 + i * 0.6}s`, ['--v-sweep-duration' as string]: '5.5s' }}
                  className="v-sweep flex w-fit items-center gap-3 rounded-full bg-white/10 py-2 pr-5 pl-2 text-white/95 ring-1 ring-white/20 backdrop-blur-sm"
                >
                  <motion.span
                    animate={{ y: [0, -2, 0] }}
                    transition={{ repeat: Infinity, duration: 3, delay: i * 0.4, ease: 'easeInOut' }}
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-white/20"
                  >
                    <Icon className="size-4" />
                  </motion.span>
                  {text}
                </motion.li>
              ))}
            </ul>
          )}
        </motion.div>
        <p className="relative z-10 text-sm text-white/70">© {new Date().getFullYear()} Vanty ABA</p>
      </section>

      <section className="flex min-h-dvh flex-col">
        {/* Mobile brand band replaces the desktop panel */}
        <div className="v-brand v-sweep relative overflow-hidden rounded-b-[2rem] px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-8 lg:hidden" style={{ boxShadow: 'none' }}>
          <Ambient />
          <div className="relative z-10 flex items-center justify-between">
            <Link href={`/${locale}`}><VantyLogo variant="white" size={30} /></Link>
            <LocaleSelector />
          </div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 mt-7">
            <p className="v-shine-text text-2xl font-semibold tracking-tight">{brandTitle}</p>
            <p className="mt-1.5 text-sm text-white/85">{brandBody}</p>
          </motion.div>
        </div>

        <div className="hidden justify-end px-8 pt-6 lg:flex"><LocaleSelector /></div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-7 pb-6 sm:px-8 lg:justify-center lg:pt-0">
          {children}
        </div>

        <footer className="flex justify-center gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-xs text-v-subtle">
          <Link href={`/${locale}/privacidad`} className="hover:text-v-text">{t('vanty.login.privacy')}</Link>
          <Link href={`/${locale}/terminos`} className="hover:text-v-text">{t('vanty.login.terms')}</Link>
        </footer>
      </section>
    </main>
  )
}

// Slow drifting light orbs behind the brand content.
function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <motion.div
        animate={{ x: [0, -40, 0], y: [0, 30, 0], scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: 14, ease: 'easeInOut' }}
        className="absolute -top-40 -right-40 size-[32rem] rounded-full bg-white/12 blur-3xl"
      />
      <motion.div
        animate={{ x: [0, 50, 0], y: [0, -30, 0] }}
        transition={{ repeat: Infinity, duration: 18, ease: 'easeInOut' }}
        className="absolute -bottom-48 -left-32 size-[28rem] rounded-full bg-[#01abfc]/45 blur-3xl"
      />
      <motion.div
        animate={{ opacity: [0.25, 0.6, 0.25], scale: [0.9, 1.05, 0.9] }}
        transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
        className="absolute top-1/3 left-1/2 size-64 rounded-full bg-[#7fd6ff]/25 blur-3xl"
      />
    </div>
  )
}
