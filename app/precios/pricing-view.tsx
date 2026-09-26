'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n-context'
import { PlanesPrecios, type PlanPublico } from '@/components/ui/planes-precios'
import { Reveal } from '@/components/ui/reveal'
import { VantyLogo } from '@/components/ui/vanty-logo'
import type { ContextoPrecios } from '@/lib/precios'

export default function PricingView({ plans, contexto }: { plans: PlanPublico[]; contexto: ContextoPrecios }) {
  const { t, locale } = useI18n()
  const router = useRouter()

  return (
    <main className="v-root min-h-dvh">
      <header className="v-glass sticky top-0 z-30 border-x-0 border-t-0">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href={`/${locale}`}><VantyLogo size={26} /></Link>
          <Link href={`/${locale}/login`} className="text-sm text-v-muted transition-colors hover:text-v-text">{t('vanty.nav.signIn')}</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <p className="text-sm font-semibold text-v-accent">{t('vanty.pricing.eyebrow')}</p>
          <h1 className="v-headline mt-3 text-5xl md:text-6xl">{t('vanty.pricing.title')}</h1>
          <p className="mt-5 text-lg text-v-muted">{t('vanty.pricing.subtitle')}</p>
        </Reveal>
        {plans.length > 0
          ? <PlanesPrecios planes={plans} contexto={contexto} onElegir={(plan, ciclo) => router.push(`/${locale}/crear-centro?plan=${plan.code}&ciclo=${ciclo}`)} />
          : <p className="text-center text-v-muted">{t('vanty.pricing.unavailable')}</p>}
      </section>
    </main>
  )
}
