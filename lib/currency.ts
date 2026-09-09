// lib/currency.ts — Moneda global del centro.
// El código de moneda se guarda en `centro_config.moneda` (una sola fila) y se
// aplica en toda la app (formularios, KPIs, reportes, recibos).

export type CurrencyCode = 'PEN' | 'USD' | 'EUR' | 'MXN' | 'COP' | 'CLP' | 'ARS' | 'BOB' | 'GBP'

export interface CurrencyInfo {
  code: CurrencyCode
  symbol: string        // símbolo corto para mostrar junto al monto (ej. "S/", "$")
  nombre: string        // nombre en español
  name: string          // nombre en inglés
  locale: string        // locale para toLocaleString (formato de miles/decimales)
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  PEN: { code: 'PEN', symbol: 'S/',   nombre: 'Sol peruano',        name: 'Peruvian Sol',    locale: 'es-PE' },
  USD: { code: 'USD', symbol: '$',    nombre: 'Dólar estadounidense', name: 'US Dollar',     locale: 'en-US' },
  EUR: { code: 'EUR', symbol: '€',    nombre: 'Euro',               name: 'Euro',            locale: 'de-DE' },
  MXN: { code: 'MXN', symbol: 'MX$',  nombre: 'Peso mexicano',      name: 'Mexican Peso',    locale: 'es-MX' },
  COP: { code: 'COP', symbol: 'COL$', nombre: 'Peso colombiano',    name: 'Colombian Peso',  locale: 'es-CO' },
  CLP: { code: 'CLP', symbol: 'CLP$', nombre: 'Peso chileno',       name: 'Chilean Peso',    locale: 'es-CL' },
  ARS: { code: 'ARS', symbol: 'AR$',  nombre: 'Peso argentino',     name: 'Argentine Peso',  locale: 'es-AR' },
  BOB: { code: 'BOB', symbol: 'Bs',   nombre: 'Boliviano',          name: 'Bolivian Boliviano', locale: 'es-BO' },
  GBP: { code: 'GBP', symbol: '£',    nombre: 'Libra esterlina',    name: 'Pound Sterling',  locale: 'en-GB' },
}

export const DEFAULT_CURRENCY: CurrencyCode = 'PEN'

export function normalizeCurrency(code?: string | null): CurrencyCode {
  const c = String(code || '').toUpperCase()
  return (c in CURRENCIES ? c : DEFAULT_CURRENCY) as CurrencyCode
}

export function currencySymbol(code?: string | null): string {
  return CURRENCIES[normalizeCurrency(code)].symbol
}

/** Formatea un monto: "S/ 1,234.50". `decimals` por defecto 2. */
export function formatMoney(n: number, code?: string | null, decimals = 2): string {
  const info = CURRENCIES[normalizeCurrency(code)]
  const num = Number(n || 0).toLocaleString(info.locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return `${info.symbol} ${num}`
}
