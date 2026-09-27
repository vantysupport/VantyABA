// Precios de Vanty ABA por región. Todo se muestra y se cobra en dólares (USD); lo que cambia según la
// región del visitante es el monto.

export type Region = 'sudamerica' | 'norteamerica' | 'europa'
export type Ciclo = 'mensual' | 'anual'
export type PrecioRegion = Partial<Record<Region, number>>

export const REGIONES: Record<Region, { moneda: 'USD' | 'EUR'; es: string; en: string }> = {
  sudamerica: { moneda: 'USD', es: 'Latinoamérica', en: 'Latin America' },
  norteamerica: { moneda: 'USD', es: 'Norteamérica', en: 'North America' },
  europa: { moneda: 'USD', es: 'Europa', en: 'Europe' },
}
export const ORDEN_REGIONES: Region[] = ['sudamerica', 'norteamerica', 'europa']

/** Meses que se pagan al elegir el plan anual (2 meses gratis). */
export const MESES_ANUAL = 10

const NORTEAMERICA = ['US', 'CA', 'MX']
const EUROPA = ['ES', 'PT', 'FR', 'DE', 'IT', 'GB', 'IE', 'NL', 'BE', 'LU', 'CH', 'AT', 'DK', 'SE', 'NO', 'FI', 'IS', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'HR', 'SI', 'EE', 'LV', 'LT', 'UA', 'RS', 'BA', 'AL', 'MK', 'ME', 'MD', 'MT', 'CY', 'LI', 'MC', 'AD', 'SM']

export function regionDePais(pais?: string | null): Region {
  const c = (pais || '').toUpperCase()
  if (EUROPA.includes(c)) return 'europa'
  if (NORTEAMERICA.includes(c)) return 'norteamerica'
  return 'sudamerica' // Sudamérica, Centroamérica, Caribe y resto del mundo
}

// Moneda local de cada país (para mostrar el equivalente aproximado)
const MONEDA_PAIS: Record<string, string> = {
  PE: 'PEN', CL: 'CLP', CO: 'COP', AR: 'ARS', BR: 'BRL', UY: 'UYU', PY: 'PYG', BO: 'BOB', VE: 'USD', EC: 'USD',
  MX: 'MXN', GT: 'GTQ', CR: 'CRC', PA: 'USD', DO: 'DOP', HN: 'HNL', NI: 'NIO', SV: 'USD', CU: 'USD', PR: 'USD',
  US: 'USD', CA: 'CAD',
  GB: 'GBP', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', BG: 'BGN',
  IS: 'ISK', UA: 'UAH', RS: 'RSD', BA: 'BAM', AL: 'ALL', MK: 'MKD', MD: 'MDL',
}
export function monedaDePais(pais?: string | null): string {
  // Moneda única: los precios se muestran en USD en todos los países (sin equivalente local)
  void pais
  return 'USD'
}
/** Moneda local real del país (por si se quiere volver a mostrar un equivalente de referencia). */
export function monedaLocalReal(pais?: string | null): string {
  return MONEDA_PAIS[(pais || '').toUpperCase()] ?? 'USD'
}

/** Tasas de cambio con base USD (1 USD = n unidades). Respaldo si la API de tipos de cambio no responde. */
export const TASAS_RESPALDO: Record<string, number> = {
  USD: 1, EUR: 0.92, PEN: 3.75, CLP: 940, COP: 4000, ARS: 1000, BRL: 5.4, UYU: 40, PYG: 7500, BOB: 6.9,
  MXN: 18, GTQ: 7.8, CRC: 510, DOP: 60, HNL: 25, NIO: 36.7, CAD: 1.37, GBP: 0.79, CHF: 0.88, SEK: 10.5,
  NOK: 10.7, DKK: 6.9, PLN: 4, CZK: 23, HUF: 360, RON: 4.6, BGN: 1.8, ISK: 138, UAH: 41, RSD: 108, BAM: 1.8,
  ALL: 92, MKD: 57, MDL: 17.8,
}

export function precioMensual(precios: PrecioRegion | null | undefined, region: Region): number | null {
  const v = precios?.[region]
  return typeof v === 'number' && v > 0 ? v : null
}

export function precioCiclo(mensual: number, ciclo: Ciclo) {
  return ciclo === 'anual' ? mensual * MESES_ANUAL : mensual
}

/** Convierte un monto de la moneda de la región a la moneda local (null si es la misma o no hay tasa). */
export function equivalenteLocal(monto: number, monedaRegion: string, monedaLocal: string, tasas: Record<string, number>): number | null {
  if (monedaRegion === monedaLocal) return null
  const desde = tasas[monedaRegion], hasta = tasas[monedaLocal]
  if (!desde || !hasta) return null
  return (monto / desde) * hasta
}

export function formatoMoneda(monto: number, moneda: string, locale: 'es' | 'en', decimales = 0) {
  try {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-PE', {
      style: 'currency', currency: moneda, maximumFractionDigits: decimales, minimumFractionDigits: 0,
      // En dólares se muestra "US$" para no confundir con pesos u otras monedas con "$"
      currencyDisplay: moneda === 'USD' ? 'symbol' : 'narrowSymbol',
    }).format(monto)
  } catch {
    return `${moneda} ${Math.round(monto)}`
  }
}

/** Contexto de precios que el servidor calcula para el visitante (país detectado, región y tasas). */
export type ContextoPrecios = { pais: string | null; region: Region; monedaLocal: string; tasas: Record<string, number> }
