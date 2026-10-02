import 'server-only'
// lib/tokens-padres.ts
// Tokens de IA de cada familia, según el plan del centro (o los límites propios del centro):
//   práctica → planes de "Practicar en casa" generados por mes calendario (max_parent_plans_month)
//   aria     → mensajes a ARIA por día, ventana de 24 h (max_aria_msgs_parent_day; lo cobra lib/aria-rate-limit)
// Además, tokens COMPRADOS (tokens_padre_extra): no vencen y se usan cuando se acaba la cuota.
// El consumo de la cuota vive en aria_usage. Sin tope en el centro ni en el plan → el mínimo por defecto
// (nadie tiene IA ilimitada). Ante errores, falla abierto.

import { supabaseAdmin } from '@/lib/supabase-admin'
import { ARIA_TOPE_POR_DEFECTO } from '@/lib/aria-rate-limit'

/** Planes de práctica por mes si el centro y su plan no fijan uno. */
const PRACTICA_TOPE_POR_DEFECTO = 5

type Topes = { practica: number | null; aria: number | null }
export type EstadoToken = { usados: number; max: number | null; extra: number; reinicia: string | null }
export type TipoToken = 'practica' | 'aria'

const mesActual = () => new Date().toISOString().slice(0, 7)
const clavePractica = (userId: string) => `practica:${userId}:${mesActual()}`
const primeroDelMesSiguiente = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString() }

export async function topesPadre(centroId: string | null): Promise<Topes> {
  if (!centroId) return { practica: PRACTICA_TOPE_POR_DEFECTO, aria: ARIA_TOPE_POR_DEFECTO.padres }
  const { data } = await supabaseAdmin.from('centros').select('limites, plans(max_parent_plans_month, max_aria_msgs_parent_day)').eq('id', centroId).maybeSingle()
  const raw = (data as { plans?: any } | null)?.plans
  const p = Array.isArray(raw) ? raw[0] : raw
  // Límite propio del centro (fijado en /control, centros.limites) y, si no hay, el del plan
  const propios = ((data as { limites?: Record<string, unknown> } | null)?.limites || {}) as Record<string, unknown>
  const valor = (k: string) => (typeof propios[k] === 'number' ? propios[k] : p?.[k])
  const n = (x: unknown, defecto: number) => { const v = Math.floor(Number(x) || 0); return v > 0 ? v : defecto }
  return { practica: n(valor('max_parent_plans_month'), PRACTICA_TOPE_POR_DEFECTO), aria: n(valor('max_aria_msgs_parent_day'), ARIA_TOPE_POR_DEFECTO.padres) }
}

async function leer(rlKey: string) {
  const { data } = await supabaseAdmin.from('aria_usage').select('count, window_start').eq('rl_key', rlKey).maybeSingle()
  return data as { count?: number; window_start?: string } | null
}

export async function extrasPadre(userId: string): Promise<{ practica: number; aria: number }> {
  const { data } = await supabaseAdmin.from('tokens_padre_extra').select('practica, aria').eq('user_id', userId).maybeSingle()
  return { practica: Number(data?.practica || 0), aria: Number(data?.aria || 0) }
}

/** Suma (delta > 0) o gasta (delta < 0) tokens comprados. false si no alcanzaban. */
export async function moverExtra(userId: string, centroId: string | null, tipo: TipoToken, delta: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('mover_tokens_padre', { p_user: userId, p_centro: centroId, p_tipo: tipo, p_delta: delta })
  return !error && data === true
}

/** Estado de los dos tipos de token del padre (para mostrar el contador). */
export async function estadoTokensPadre(userId: string, centroId: string | null): Promise<{ practica: EstadoToken; aria: EstadoToken }> {
  const [t, pr, ar, ex] = await Promise.all([topesPadre(centroId), leer(clavePractica(userId)), leer(`padres:${userId}`), extrasPadre(userId)])
  // ARIA usa ventana móvil de 24 h desde el primer mensaje (igual que lib/aria-rate-limit)
  const inicio = ar?.window_start ? new Date(ar.window_start).getTime() : 0
  const vigente = inicio && Date.now() - inicio < 86_400_000
  return {
    practica: { usados: Number(pr?.count || 0), max: t.practica, extra: ex.practica, reinicia: primeroDelMesSiguiente() },
    aria: { usados: vigente ? Number(ar?.count || 0) : 0, max: t.aria, extra: ex.aria, reinicia: vigente ? new Date(inicio + 86_400_000).toISOString() : null },
  }
}

/** ¿Puede generar otro plan de práctica? (cuota del mes o tokens comprados) */
export async function puedeGenerarPractica(userId: string, centroId: string | null): Promise<{ ok: boolean; usados: number; max: number | null; extra: number }> {
  try {
    const { practica } = await estadoTokensPadre(userId, centroId)
    const ok = practica.max == null || practica.usados < practica.max || practica.extra > 0
    return { ok, usados: practica.usados, max: practica.max, extra: practica.extra }
  } catch { return { ok: true, usados: 0, max: null, extra: 0 } }
}

/** Descuenta 1 plan (llamar solo si se generó y guardó bien): primero la cuota del mes, luego lo comprado. */
export async function consumirPractica(userId: string, centroId: string | null) {
  try {
    const [t, actual] = await Promise.all([topesPadre(centroId), leer(clavePractica(userId))])
    const usados = Number(actual?.count || 0)
    if (t.practica != null && usados >= t.practica) {
      if (await moverExtra(userId, centroId, 'practica', -1)) return
    }
    await supabaseAdmin.from('aria_usage').upsert({
      rl_key: clavePractica(userId), count: usados + 1,
      window_start: actual?.window_start || new Date().toISOString(), updated_at: new Date().toISOString(), centro_id: centroId,
    }, { onConflict: 'rl_key' })
  } catch { /* no bloquear por el contador */ }
}
