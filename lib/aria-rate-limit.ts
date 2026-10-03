// lib/aria-rate-limit.ts — Rate limiting de ARIA (IA de padres y staff).
// El tope sale del centro o de su plan (plans.max_aria_msgs_parent_day / max_aria_msgs_staff_day),
// por usuario y por día; si no hay ninguno, ARIA_TOPE_POR_DEFECTO. A prueba de fallos: si algo falla, NO bloquea (fail open).

import { supabaseAdmin } from '@/lib/supabase-admin'
import { avisarTokensAgotados } from '@/lib/correo-tokens'

export type AriaRateResult = { allowed: boolean; message?: string; retryAfterMinutes?: number; extra?: boolean }

/** Devuelve 1 mensaje consumido (la IA falló y el usuario no recibió respuesta real).
 *  `extra` = el mensaje se había cobrado de los tokens comprados, no de la cuota diaria. */
export async function devolverAria(key: string, kind: 'padres' | 'staff' = 'padres', extra = false) {
  try {
    if (extra) { await supabaseAdmin.rpc('mover_tokens_padre', { p_user: key, p_centro: null, p_tipo: 'aria', p_delta: 1 }); return }
    const rlKey = `${kind}:${key}`
    const { data } = await supabaseAdmin.from('aria_usage').select('count').eq('rl_key', rlKey).maybeSingle()
    const n = Number((data as { count?: number } | null)?.count || 0)
    if (n > 0) await supabaseAdmin.from('aria_usage').update({ count: n - 1, updated_at: new Date().toISOString() }).eq('rl_key', rlKey)
  } catch { /* no bloquear */ }
}

const WINDOW_HOURS = 24

/** Si ni el centro ni su plan fijan un tope, se usa este: nadie tiene ARIA ilimitada (tampoco el plan Fundador). */
export const ARIA_TOPE_POR_DEFECTO = { staff: 5, padres: 5 } as const

/** Mensajes a ARIA por día para ese tipo de usuario: límite propio del centro, si no el del plan, si no el mínimo. */
export async function topeAria(centroId: string | null, kind: 'padres' | 'staff'): Promise<number> {
  const defecto = ARIA_TOPE_POR_DEFECTO[kind]
  if (!centroId) return defecto
  const { data: c } = await supabaseAdmin
    .from('centros').select('limites, plans(max_aria_msgs_staff_day, max_aria_msgs_parent_day)').eq('id', centroId).maybeSingle()
  type PlanLim = { max_aria_msgs_staff_day?: number | null; max_aria_msgs_parent_day?: number | null }
  const rawPlan = (c as { plans?: PlanLim | PlanLim[] | null } | null)?.plans
  const plan = Array.isArray(rawPlan) ? rawPlan[0] : rawPlan
  const clave = kind === 'staff' ? 'max_aria_msgs_staff_day' : 'max_aria_msgs_parent_day'
  const propio = ((c as { limites?: Record<string, unknown> } | null)?.limites || {})[clave]
  const max = Math.floor(Number(typeof propio === 'number' ? propio : plan?.[clave]) || 0)
  return max > 0 ? max : defecto
}

/** Cuánto lleva usado hoy (ventana de 24 h desde el primer mensaje), sin consumir. */
export async function estadoAria(userId: string, kind: 'padres' | 'staff', centroId: string | null): Promise<{ usados: number; max: number; reinicia: string | null }> {
  const max = await topeAria(centroId, kind)
  const { data } = await supabaseAdmin.from('aria_usage').select('count, window_start').eq('rl_key', `${kind}:${userId}`).maybeSingle()
  const inicio = (data as { window_start?: string } | null)?.window_start ? new Date((data as { window_start: string }).window_start).getTime() : 0
  const vigente = !!inicio && Date.now() - inicio < WINDOW_HOURS * 3600_000
  return { usados: vigente ? Number((data as { count?: number } | null)?.count || 0) : 0, max, reinicia: vigente ? new Date(inicio + WINDOW_HOURS * 3600_000).toISOString() : null }
}

/** `key` es el id del usuario. `centroId` es el centro del usuario; si no se pasa, se deduce del perfil. */
export async function checkAriaRateLimit(
  key: string,
  kind: 'padres' | 'staff' = 'padres',
  centroId?: string | null,
): Promise<AriaRateResult> {
  try {
    if (!key) return { allowed: true }

    let centro = centroId || null
    if (!centro) {
      const { data: p } = await supabaseAdmin.from('profiles').select('centro_id').eq('id', key).maybeSingle()
      centro = (p as { centro_id?: string | null } | null)?.centro_id ?? null
    }
    if (!centro) {
      // Compat: algunos llamadores pasan el id del niño cuando no hay usuario.
      const { data: ch } = await supabaseAdmin.from('children').select('centro_id').eq('id', key).maybeSingle()
      centro = (ch as { centro_id?: string | null } | null)?.centro_id ?? null
    }

    // Siempre hay un tope (sin límite en el plan → el mínimo por defecto)
    const maxMessages = await topeAria(centro, kind)

    const rlKey = `${kind}:${key}` // prefijo para no mezclar contadores de padres y staff
    const now = Date.now()
    const windowMs = WINDOW_HOURS * 3600_000

    const { data: row } = await supabaseAdmin
      .from('aria_usage').select('count, window_start').eq('rl_key', rlKey).maybeSingle()
    let count = Number((row as { count?: number } | null)?.count || 0)
    const ws = (row as { window_start?: string } | null)?.window_start
    let windowStart = ws ? new Date(ws).getTime() : 0

    // Ventana expirada (o inexistente) → reiniciar.
    if (!windowStart || now - windowStart >= windowMs) {
      windowStart = now
      count = 0
    }

    if (count >= maxMessages) {
      // Familias: si compraron tokens de ARIA, se usan antes de bloquear
      if (kind === 'padres') {
        const { data: ok } = await supabaseAdmin.rpc('mover_tokens_padre', { p_user: key, p_centro: centro, p_tipo: 'aria', p_delta: -1 })
        if (ok === true) return { allowed: true, extra: true }
        avisarTokensAgotados('aria', { userId: key, centroId: centro })
      }
      const retryMs = windowMs - (now - windowStart)
      const retryAfterMinutes = Math.max(1, Math.ceil(retryMs / 60000))
      const h = Math.floor(retryAfterMinutes / 60), m = retryAfterMinutes % 60
      const tiempo = h > 0 ? `${h} h ${m} min` : `${m} min`
      return {
        allowed: false,
        retryAfterMinutes,
        message: `Has alcanzado el límite de consultas a ARIA (${maxMessages} por día). Podrás volver a preguntar en ${tiempo}.${kind === 'staff' ? ' El límite depende del plan de tu centro.' : ' Para más, contacta al centro.'}`,
      }
    }

    // Registrar el consumo de este mensaje.
    await supabaseAdmin.from('aria_usage').upsert({
      rl_key: rlKey,
      count: count + 1,
      window_start: new Date(windowStart).toISOString(),
      updated_at: new Date(now).toISOString(),
      centro_id: centro,
    }, { onConflict: 'rl_key' })

    return { allowed: true }
  } catch {
    return { allowed: true } // fail open
  }
}
