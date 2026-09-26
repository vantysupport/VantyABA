// lib/estado-centro.ts
// Fase de pago de un centro activo según `paid_until` (fecha hasta la que pagó).
//   ok          → al día
//   por_vencer  → vence en ≤ AVISO_DIAS: aviso suave a la dirección
//   gracia      → ya venció, pero dentro de GRACIA_DIAS: aviso fuerte a la dirección, todo sigue funcionando
//   vencido     → pasó la gracia: el centro se pausa (proxy + guardián) hasta que se confirme el pago
// Se calcula al vuelo (sin cron): basta con confirmar el pago en /control para reactivar.

export const GRACIA_DIAS = 5
export const AVISO_DIAS = 3
const DIA = 86_400_000

export type FasePago = 'ok' | 'por_vencer' | 'gracia' | 'vencido'

/** Inicio del día (hora local) de una fecha YYYY-MM-DD o de un instante. */
function dia(x: string | number) {
  const d = typeof x === 'string' ? new Date(`${x.slice(0, 10)}T00:00:00`) : new Date(x)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * `paid_until` (YYYY-MM-DD) es el último día pagado. Se cuentan días de calendario:
 * vence ese día; la gracia cubre los GRACIA_DIAS siguientes y el acceso se pausa el día después.
 */
export function fasePago(c: { status?: string | null; paid_until?: string | null } | null | undefined, ahora = Date.now()) {
  if (!c || c.status !== 'active' || !c.paid_until) return { fase: 'ok' as FasePago, dias: null as number | null, vence: null as string | null, pausa: null as string | null }
  const hoy = dia(ahora)
  const vence = dia(c.paid_until)
  const pausa = vence + (GRACIA_DIAS + 1) * DIA
  const iso = (t: number) => new Date(t).toISOString()
  const base = { vence: iso(vence), pausa: iso(pausa) }
  if (hoy >= pausa) return { fase: 'vencido' as FasePago, dias: 0, ...base }
  if (hoy > vence) return { fase: 'gracia' as FasePago, dias: Math.round((pausa - hoy) / DIA), ...base }
  const falta = Math.round((vence - hoy) / DIA)
  return { fase: (falta <= AVISO_DIAS ? 'por_vencer' : 'ok') as FasePago, dias: falta, ...base }
}

/** ¿El centro debe quedar bloqueado? (prueba vencida, suspendido, pago pendiente o pago vencido tras la gracia) */
export function motivoBloqueo(c: { status?: string | null; trial_ends_at?: string | null; paid_until?: string | null } | null | undefined): string | null {
  if (!c) return 'no_centro'
  if (c.status === 'suspended' || c.status === 'pending_payment') return c.status
  if (c.status === 'trial' && c.trial_ends_at && new Date(c.trial_ends_at).getTime() < Date.now()) return 'trial_expired'
  if (fasePago(c).fase === 'vencido') return 'past_due'
  return null
}
