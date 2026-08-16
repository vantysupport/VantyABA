'use client'
import { useI18n } from '@/lib/i18n-context'

// Switch de idioma Español ⇄ Inglés (segmentado ES | EN).
// Persiste en localStorage y cambia toda la app: textos con t(), y el idioma
// que se envía a la IA / documentos vía x-locale.
export default function LocaleSelector({ compact = false }: { compact?: boolean }) {
  const { locale, changeLocale } = useI18n()

  const opts: { code: 'es' | 'en'; label: string; flag: string }[] = [
    { code: 'es', label: 'ES', flag: '🇵🇪' },
    { code: 'en', label: 'EN', flag: '🇺🇸' },
  ]

  return (
    <div
      role="group"
      aria-label="Idioma / Language"
      className="inline-flex items-center rounded-lg border overflow-hidden"
      style={{ borderColor: 'var(--card-border)', background: 'var(--card)' }}
    >
      {opts.map(o => {
        const active = locale === o.code
        return (
          <button
            key={o.code}
            type="button"
            onClick={() => changeLocale(o.code)}
            aria-pressed={active}
            title={o.code === 'es' ? 'Cambiar a Español' : 'Switch to English'}
            className={`flex items-center gap-1 font-bold transition-colors ${compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'}`}
            style={
              active
                ? { background: 'var(--text-primary)', color: 'var(--card)' }
                : { background: 'transparent', color: 'var(--text-muted)' }
            }
          >
            <span>{o.flag}</span>
            <span>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
