'use client'
// Moneda global del centro, disponible en toda la app vía useCurrency().
// Se lee una vez de /api/centro/moneda y se cachea en localStorage para render
// instantáneo (evita el "flash" de S/ mientras carga).

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { CURRENCIES, normalizeCurrency, formatMoney, type CurrencyCode } from '@/lib/currency'

const LS_KEY = 'centro_moneda'

interface CurrencyCtx {
  code: CurrencyCode
  symbol: string
  /** Formatea un monto con el símbolo (ej. "S/ 1,234.50"). */
  fmt: (n: number, decimals?: number) => string
  /** Cambia y persiste la moneda del centro (admin). */
  setCurrency: (code: string) => Promise<void>
  refresh: () => Promise<void>
}

const Ctx = createContext<CurrencyCtx>({
  code: 'PEN', symbol: 'S/',
  fmt: (n, d) => formatMoney(n, 'PEN', d),
  setCurrency: async () => {},
  refresh: async () => {},
})

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [code, setCode] = useState<CurrencyCode>('PEN')

  // Hidratar desde localStorage al montar (instantáneo)
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LS_KEY)
      if (cached) setCode(normalizeCurrency(cached))
    } catch { /* noop */ }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/centro/moneda')
      const j = await r.json()
      const c = normalizeCurrency(j?.moneda)
      setCode(c)
      try { localStorage.setItem(LS_KEY, c) } catch { /* noop */ }
    } catch { /* mantiene el cache */ }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const setCurrency = useCallback(async (next: string) => {
    const c = normalizeCurrency(next)
    setCode(c)
    try { localStorage.setItem(LS_KEY, c) } catch { /* noop */ }
    try {
      await fetch('/api/centro/moneda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moneda: c }),
      })
    } catch { /* noop */ }
  }, [])

  const symbol = CURRENCIES[code].symbol
  const fmt = useCallback((n: number, decimals = 2) => formatMoney(n, code, decimals), [code])

  return (
    <Ctx.Provider value={{ code, symbol, fmt, setCurrency, refresh }}>
      {children}
    </Ctx.Provider>
  )
}

export function useCurrency() { return useContext(Ctx) }
