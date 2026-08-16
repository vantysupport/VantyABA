'use client'
import { useI18n } from '@/lib/i18n-context'

// Toggle de idioma Español ⇄ Inglés. Persiste en localStorage y cambia toda la
// app (textos con t(), y el idioma que se envía a la IA / documentos vía x-locale).
export default function LocaleSelector({ compact = false }: { compact?: boolean }) {
  const { locale, changeLocale } = useI18n()
  const next = locale === 'es' ? 'en' : 'es'
  const label = locale === 'es' ? '🇵🇪 ES' : '🇺🇸 EN'

  return (
    <button
      type="button"
      onClick={() => changeLocale(next)}
      title={locale === 'es' ? 'Switch to English' : 'Cambiar a Español'}
      aria-label={locale === 'es' ? 'Switch to English' : 'Cambiar a Español'}
      className={`flex items-center gap-1 rounded-lg border font-bold transition hover:opacity-80 ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}
      style={{ borderColor: 'var(--card-border)', background: 'var(--card)', color: 'var(--text-secondary)' }}
    >
      {label}
    </button>
  )
}
