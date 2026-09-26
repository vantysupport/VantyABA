'use client'
import { useId } from 'react'
import { motion } from 'motion/react'
import { useI18n } from '@/lib/i18n-context'

// Switch de idioma Español ⇄ Inglés (segmentado ES | EN).
// Persiste en localStorage y cambia toda la app: textos con t(), y el idioma
// que se envía a la IA / documentos vía x-locale.
export default function LocaleSelector({ compact = false }: { compact?: boolean }) {
  const { locale, changeLocale } = useI18n()
  const id = useId()
  const opts = [
    { code: 'es' as const, label: 'ES', title: 'Cambiar a Español' },
    { code: 'en' as const, label: 'EN', title: 'Switch to English' },
  ]

  return (
    <div role="group" aria-label="Idioma / Language" className="inline-flex items-center rounded-full bg-v-fill p-0.5">
      {opts.map(o => {
        const active = locale === o.code
        return (
          <button key={o.code} type="button" onClick={() => changeLocale(o.code)} aria-pressed={active} title={o.title}
            className={`relative rounded-full font-semibold tracking-wide transition-colors ${compact ? 'h-7 px-2.5 text-[11px]' : 'h-8 px-3 text-xs'} ${active ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
            {active && <motion.span layoutId={`locale-${id}`} transition={{ type: 'spring', stiffness: 420, damping: 32 }} className="absolute inset-0 rounded-full bg-v-elevated shadow-v" />}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
