'use client'
// Página 404 de Vanty ABA: ARIA "buscando" la página, con salidas claras al inicio, precios o iniciar sesión.

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import { ArrowLeft, Home, LogIn, Tag } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'

export default function NoEncontrado() {
  const { locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const base = `/${locale}`

  return (
    <main className="v-scope relative flex min-h-dvh items-center justify-center overflow-hidden bg-v-bg px-4 py-12">
      {/* Fondo suave de marca */}
      <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 size-[520px] rounded-full bg-[#01abfc]/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -right-40 size-[560px] rounded-full bg-[#0063d8]/15 blur-3xl" />

      <div className="relative flex w-full max-w-3xl flex-col items-center gap-8 text-center sm:flex-row sm:text-left">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative shrink-0">
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
            <Image src="/aria/pose-4.webp" alt="ARIA" width={220} height={220} priority className="size-40 object-contain sm:size-52" />
          </motion.div>
          <motion.span aria-hidden className="absolute -bottom-1 left-1/2 h-3 w-24 -translate-x-1/2 rounded-full bg-[#0b3d91]/20 blur-[3px]"
            animate={{ scaleX: [1, 0.8, 1], opacity: [0.9, 0.55, 0.9] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}>
          <p className="v-brand-text text-7xl font-extrabold leading-none tracking-tight sm:text-8xl">404</p>
          <h1 className="v-headline mt-3 text-[1.7rem] leading-tight text-v-text sm:text-3xl">
            {L("We couldn't find this page", 'No encontramos esta página')}
          </h1>
          <p className="mt-2 max-w-md text-v-muted">
            {L('ARIA looked everywhere. The link may be wrong or the page may have moved.',
              'ARIA buscó por todos lados. Puede que el enlace esté mal escrito o que la página se haya movido.')}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2.5 sm:justify-start">
            <Link href={base} className="v-brand inline-flex h-11 items-center gap-2 rounded-full px-5 text-[15px] font-semibold">
              <Home className="size-4" /> {L('Go to home', 'Ir al inicio')}
            </Link>
            <Link href={`${base}/login`} className="inline-flex h-11 items-center gap-2 rounded-full border border-v-border bg-v-elevated px-5 text-[15px] font-semibold text-v-text transition-colors hover:bg-v-fill">
              <LogIn className="size-4" /> {L('Sign in', 'Iniciar sesión')}
            </Link>
            <Link href={`${base}/precios`} className="inline-flex h-11 items-center gap-2 rounded-full border border-v-border bg-v-elevated px-5 text-[15px] font-semibold text-v-text transition-colors hover:bg-v-fill">
              <Tag className="size-4" /> {L('See plans', 'Ver planes')}
            </Link>
          </div>
          <button type="button" onClick={() => history.length > 1 ? history.back() : location.assign(base)}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-v-accent hover:underline">
            <ArrowLeft className="size-4" /> {L('Go back', 'Volver atrás')}
          </button>
        </motion.div>
      </div>
    </main>
  )
}
