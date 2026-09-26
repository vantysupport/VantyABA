import 'server-only'
import { headers } from 'next/headers'
import { TASAS_RESPALDO, monedaDePais, regionDePais, type ContextoPrecios } from '@/lib/precios'

/** País del visitante: cabecera de geolocalización (Vercel / Cloudflare) o, en su defecto, el idioma del navegador. */
export async function detectarPais(): Promise<string | null> {
  const h = await headers()
  const geo = h.get('x-vercel-ip-country') || h.get('cf-ipcountry')
  if (geo && /^[A-Z]{2}$/i.test(geo) && geo.toUpperCase() !== 'XX') return geo.toUpperCase()
  // es-PE, en-US… → PE, US
  const m = /[a-z]{2}-([A-Z]{2})/.exec(h.get('accept-language') || '')
  return m ? m[1] : null
}

/** Tipos de cambio base USD, con caché de 12 h; si la API falla se usan las tasas de respaldo. */
export async function tasasCambio(): Promise<Record<string, number>> {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { next: { revalidate: 43_200 } })
    if (!r.ok) throw new Error(String(r.status))
    const d = await r.json()
    if (d?.result === 'success' && d.rates) return { ...TASAS_RESPALDO, ...d.rates }
  } catch { /* respaldo */ }
  return TASAS_RESPALDO
}

/** `forzarPais`: código ISO para ver los precios como otro país (p. ej. ?pais=PE para pruebas). */
export async function contextoPrecios(forzarPais?: string | null): Promise<ContextoPrecios> {
  const forzado = forzarPais && /^[A-Z]{2}$/i.test(forzarPais) ? forzarPais.toUpperCase() : null
  const [detectado, tasas] = await Promise.all([forzado ? Promise.resolve(forzado) : detectarPais(), tasasCambio()])
  const pais = detectado
  return { pais, region: regionDePais(pais), monedaLocal: monedaDePais(pais), tasas }
}
