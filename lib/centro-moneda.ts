// Currency of the requesting user's center, for server-generated reports and receipts.

import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { CURRENCIES, normalizeCurrency, type CurrencyInfo } from '@/lib/currency'

/** Never throws; falls back to PEN. Pass centroId when there is no user session (e.g. background jobs). */
export async function getCentroMoneda(centroId?: string | null): Promise<CurrencyInfo> {
  try {
    let id = centroId ?? null
    if (!id) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabaseAdmin.from('profiles').select('centro_id').eq('id', user.id).maybeSingle()
        id = data?.centro_id ?? null
      }
    }
    if (!id) return CURRENCIES.PEN
    const { data } = await supabaseAdmin.from('centros').select('currency').eq('id', id).maybeSingle()
    return CURRENCIES[normalizeCurrency(data?.currency)]
  } catch {
    return CURRENCIES.PEN
  }
}
