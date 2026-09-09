// lib/centro-moneda.ts — Lee la moneda global del centro (server-side).
// La usan reportes y recibos generados en el servidor.

import { supabaseAdmin } from '@/lib/supabase-admin'
import { CURRENCIES, normalizeCurrency, type CurrencyInfo } from '@/lib/currency'

/** Devuelve la info de moneda del centro (fila única centro_config). Nunca lanza. */
export async function getCentroMoneda(): Promise<CurrencyInfo> {
  try {
    const { data } = await supabaseAdmin.from('centro_config').select('moneda').eq('id', 1).maybeSingle()
    return CURRENCIES[normalizeCurrency((data as any)?.moneda)]
  } catch {
    return CURRENCIES.PEN
  }
}
