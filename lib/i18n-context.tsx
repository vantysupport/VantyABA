'use client'
import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { createTranslator, type Locale, DEFAULT_LOCALE } from './i18n'
import ES from '../messages/es.json'
import EN from '../messages/en.json'

// Deep-merge: EN encima de ES. Así cualquier clave aún NO traducida al inglés
// cae automáticamente al texto en español (bilingüe funcional, nunca "clave rota").
function deepMerge(base: any, over: any): any {
  if (!over || typeof over !== 'object') return base
  const out: any = Array.isArray(base) ? [...base] : { ...base }
  for (const k of Object.keys(over)) {
    if (over[k] && typeof over[k] === 'object' && base?.[k] && typeof base[k] === 'object') {
      out[k] = deepMerge(base[k], over[k])
    } else {
      out[k] = over[k]
    }
  }
  return out
}

const MESSAGES: Record<Locale, Record<string, any>> = {
  es: ES as any,
  en: deepMerge(ES, EN) as any,
}

export type T = (key: string, vars?: Record<string, string>) => string
interface I18nCtx { t: T; locale: Locale; changeLocale: (l: Locale) => void }

const I18nContext = createContext<I18nCtx>({
  t: createTranslator(ES),
  locale: 'es',
  changeLocale: () => {},
})

// Lee el idioma del PREFIJO de la URL (/en/... o /es/...). Es la fuente de verdad:
// el middleware (proxy.ts) garantiza que toda página tenga prefijo de idioma.
function localeFromPath(): Locale | null {
  try {
    const seg = window.location.pathname.split('/')[1]
    return seg === 'en' || seg === 'es' ? seg : null
  } catch { return null }
}

// Reconstruye la URL actual cambiando el prefijo de idioma (conserva ruta+query+hash).
function urlWithLocale(loc: Locale): string {
  const { pathname, search, hash } = window.location
  const parts = pathname.split('/')
  if (parts[1] === 'en' || parts[1] === 'es') parts[1] = loc
  else parts.splice(1, 0, loc)
  return parts.join('/') + search + hash
}

export function I18nProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE)

  // Al montar: el idioma lo dicta el prefijo de la URL (fuente de verdad).
  useEffect(() => {
    const fromPath = localeFromPath()
    if (fromPath && fromPath !== locale) setLocale(fromPath)
    // Mantener localStorage sincronizado para el resto de la UI
    try { if (fromPath) localStorage.setItem('vanty_locale', fromPath) } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reflejar el idioma en <html lang> para accesibilidad/SEO
  useEffect(() => {
    try { document.documentElement.lang = locale } catch { /* noop */ }
  }, [locale])

  // Cambiar de idioma = navegar a la MISMA página con el otro prefijo de URL
  // (p. ej. /es/admin → /en/admin). Recarga completa: simple y 100% fiable.
  const changeLocale = useCallback((loc: Locale) => {
    if (loc !== 'es' && loc !== 'en') return
    try { localStorage.setItem('vanty_locale', loc) } catch { /* noop */ }
    try { document.cookie = `vanty_locale=${loc}; path=/; max-age=31536000` } catch { /* noop */ }
    try { window.location.assign(urlWithLocale(loc)); return } catch { /* noop */ }
    setLocale(loc)
  }, [])

  // useMemo: solo recalcula t cuando locale cambia
  const t = useMemo(() => createTranslator(MESSAGES[locale]), [locale])

  const value = useMemo(() => ({ t, locale, changeLocale }), [t, locale, changeLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() { return useContext(I18nContext) }
