'use client'
// lib/form-translate.ts
// Traducción EN de formularios/evaluaciones EN VIVO (con caché en localStorage).
// Cuando el idioma es 'en', extrae los textos visibles de la definición del
// formulario, los traduce por IA una sola vez (cacheado), y reconstruye el
// formulario con los textos en inglés. Si algo falla, cae al español (sin romper).

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n-context'

// Claves cuyo VALOR string debe traducirse.
const TEXT_KEYS = new Set(['title', 'subtitle', 'description', 'label', 'placeholder', 'helpText', 'fullLabel', 'name'])
// Claves de arrays de strings (opciones) que deben traducirse elemento a elemento.
const OPTION_KEYS = new Set(['options'])

// Recorre el objeto y junta todos los textos únicos traducibles.
export function collectFormTexts(node: any, acc: Set<string> = new Set()): string[] {
  if (node == null) return Array.from(acc)
  if (Array.isArray(node)) { node.forEach(n => collectFormTexts(n, acc)); return Array.from(acc) }
  if (typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const v = node[k]
      if (typeof v === 'string' && TEXT_KEYS.has(k) && /[a-záéíóúñ]/i.test(v)) acc.add(v)
      else if (Array.isArray(v) && OPTION_KEYS.has(k)) v.forEach(o => { if (typeof o === 'string' && /[a-záéíóúñ]/i.test(o)) acc.add(o) })
      else collectFormTexts(v, acc)
    }
  }
  return Array.from(acc)
}

// Reconstruye el objeto reemplazando cada texto por su traducción del mapa.
export function applyFormTexts(node: any, map: Record<string, string>): any {
  if (node == null) return node
  if (Array.isArray(node)) return node.map(n => applyFormTexts(n, map))
  if (typeof node === 'object') {
    const out: any = Array.isArray(node) ? [] : { ...node }
    for (const k of Object.keys(node)) {
      const v = node[k]
      if (typeof v === 'string' && TEXT_KEYS.has(k)) out[k] = map[v] ?? v
      else if (Array.isArray(v) && OPTION_KEYS.has(k)) out[k] = v.map((o: any) => (typeof o === 'string' ? (map[o] ?? o) : applyFormTexts(o, map)))
      else out[k] = applyFormTexts(v, map)
    }
    return out
  }
  return node
}

async function fetchTranslations(texts: string[]): Promise<Record<string, string>> {
  const res = await fetch('/api/translate-form', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, target: 'en' }),
  })
  if (!res.ok) throw new Error('translate-form failed')
  const json = await res.json()
  const translations: string[] = json.translations || []
  const map: Record<string, string> = {}
  texts.forEach((tx, i) => { if (translations[i]) map[tx] = translations[i] })
  return map
}

// Hook: devuelve el formulario en el idioma actual.
// - 'es' → el formulario original tal cual.
// - 'en' → versión traducida (cacheada). Mientras traduce por primera vez,
//   muestra el original y luego actualiza; nunca bloquea ni rompe.
export function useTranslatedForm<T>(form: T | null | undefined): T | null | undefined {
  const { locale } = useI18n()
  const [out, setOut] = useState<T | null | undefined>(form)

  useEffect(() => {
    let cancelled = false
    if (!form || locale !== 'en') { setOut(form); return }

    const id = (form as any)?.id || 'form'
    const cacheKey = `formtr_en_${id}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) { setOut(applyFormTexts(form, JSON.parse(cached))); return }
    } catch { /* noop */ }

    const texts = collectFormTexts(form)
    if (texts.length === 0) { setOut(form); return }

    setOut(form) // mostrar ES mientras llega la traducción
    fetchTranslations(texts)
      .then(map => {
        if (cancelled) return
        try { localStorage.setItem(cacheKey, JSON.stringify(map)) } catch { /* noop */ }
        setOut(applyFormTexts(form, map))
      })
      .catch(() => { if (!cancelled) setOut(form) })

    return () => { cancelled = true }
  }, [form, locale])

  return out
}
