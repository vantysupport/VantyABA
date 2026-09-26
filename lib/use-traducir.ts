'use client'
// Muestra textos del expediente (escritos por el equipo, normalmente en español) en el idioma
// de la app. Usa /api/traducir (traducción una sola vez por texto, guardada en el servidor)
// y recuerda en memoria lo ya traducido durante la sesión.
//
//   const tr = useTraducir([prog.titulo, prog.descripcion])
//   <p>{tr(prog.titulo)}</p>

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n-context'

const memoria: Record<string, Map<string, string>> = { en: new Map(), es: new Map() }

export function useTraducir(textos: (string | null | undefined)[]) {
  const { locale } = useI18n()
  const idioma = String(locale || 'es').toLowerCase().startsWith('en') ? 'en' : 'es'
  const [, setVersion] = useState(0)
  const clave = useMemo(() => [...new Set(textos.filter((t): t is string => !!t && !!t.trim()))].sort().join('\u0001'), [textos])

  useEffect(() => {
    // El contenido se escribe en español: solo hace falta traducir cuando la app está en inglés
    if (idioma !== 'en' || !clave) return
    const pendientes = clave.split('\u0001').filter(t => !memoria.en.has(t))
    if (!pendientes.length) return
    let vivo = true
    ;(async () => {
      for (let i = 0; i < pendientes.length; i += 60) {
        const lote = pendientes.slice(i, i + 60)
        try {
          const r = await fetch('/api/traducir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ textos: lote, idioma: 'en' }) })
          const j = await r.json()
          if (Array.isArray(j.textos)) lote.forEach((t, k) => memoria.en.set(t, j.textos[k] || t))
        } catch { /* se muestra el original */ }
      }
      if (vivo) setVersion(v => v + 1)
    })()
    return () => { vivo = false }
  }, [clave, idioma])

  return (t: string | null | undefined): string => {
    if (!t) return ''
    return idioma === 'en' ? (memoria.en.get(t) ?? t) : t
  }
}
