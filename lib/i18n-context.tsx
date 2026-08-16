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

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE)

  // Al montar: leer el idioma guardado
  useEffect(() => {
    try {
      const stored = localStorage.getItem('vanty_locale')
      if (stored === 'en' || stored === 'es') setLocale(stored)
    } catch { /* noop */ }
  }, [])

  // Reflejar el idioma en <html lang> para accesibilidad/SEO
  useEffect(() => {
    try { document.documentElement.lang = locale } catch { /* noop */ }
  }, [locale])

  const changeLocale = useCallback((loc: Locale) => {
    if (loc !== 'es' && loc !== 'en') return
    try { localStorage.setItem('vanty_locale', loc) } catch { /* noop */ }
    setLocale(loc)
  }, [])

  // useMemo: solo recalcula t cuando locale cambia
  const t = useMemo(() => createTranslator(MESSAGES[locale]), [locale])

  const value = useMemo(() => ({ t, locale, changeLocale }), [t, locale, changeLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() { return useContext(I18nContext) }
