import 'server-only'
// Límites efectivos de un centro: los propios (centros.limites, fijados desde /control) y, si no hay,
// los de su plan. null = sin límite. Misma regla que la función SQL limite_centro().

import { supabaseAdmin } from '@/lib/supabase-admin'

export const CLAVES_LIMITE = ['max_patients', 'max_professionals', 'max_parents', 'max_storage_mb', 'max_db_mb'] as const
export type ClaveLimite = typeof CLAVES_LIMITE[number]
export type Limites = Record<ClaveLimite, number | null>

export async function limitesCentro(centroId: string): Promise<Limites & { extra_parents: number }> {
  const { data } = await supabaseAdmin
    .from('centros')
    .select('limites, extra_parents, plans(max_patients, max_professionals, max_parents, max_storage_mb, max_db_mb)')
    .eq('id', centroId)
    .maybeSingle()
  const plan = (Array.isArray(data?.plans) ? data?.plans[0] : data?.plans) as Partial<Limites> | null
  const propios = (data?.limites || {}) as Partial<Record<ClaveLimite, unknown>>
  const out = { extra_parents: Number(data?.extra_parents || 0) } as Limites & { extra_parents: number }
  for (const k of CLAVES_LIMITE) {
    const p = propios[k]
    out[k] = typeof p === 'number' && Number.isFinite(p) && p >= 0 ? p : (plan?.[k] ?? null)
  }
  return out
}
