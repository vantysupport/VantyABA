// lib/profile-limits.ts — Bloqueo DURO de límites de perfiles (server-side).
// El límite sale del plan del centro (centros.plan_id → plans): max_professionals
// para el staff y max_parents (+ centros.extra_parents) para las familias. Solo
// cuenta los perfiles ACTIVOS de ESE centro: desactivar a alguien libera su cupo.
// A prueba de fallos: si algo falla al leer, NO bloquea.

import { supabaseAdmin } from '@/lib/supabase-admin'
import { limitesCentro } from '@/lib/limites-centro'

// Cualquier rol → su "clave de límite".
export function limitKeyForRole(role: string): string {
  if (role === 'padre') return 'padre'
  if (role === 'programador') return 'programador'
  return 'staff' // jefe, admin, especialista, terapeuta, secretaria
}

export async function profileLimitCheck(
  role: string,
  centroId: string,
  excludeUserId?: string,
): Promise<{ blocked: boolean; limit: number; current: number; key: string }> {
  const key = limitKeyForRole(role)
  try {
    if (!centroId || key === 'programador') return { blocked: false, limit: 0, current: 0, key }
    // Límite propio del centro (fijado en /control) o el de su plan
    const lim = await limitesCentro(centroId)
    const base = key === 'padre' ? lim.max_parents : lim.max_professionals
    // null / 0 = sin límite.
    if (!base || base <= 0) return { blocked: false, limit: 0, current: 0, key }
    const limit = Math.floor(Number(base) + (key === 'padre' ? lim.extra_parents : 0))

    const { data: profs } = await supabaseAdmin.from('profiles').select('id, role, is_active').eq('centro_id', centroId)
    let current = 0
    for (const p of (profs || []) as { id: string; role?: string; is_active?: boolean | null }[]) {
      if (excludeUserId && p.id === excludeUserId) continue
      if (p.is_active === false) continue // inactivo = no ocupa cupo
      if (limitKeyForRole(p.role || '') === key) current++
    }
    return { blocked: current >= limit, limit, current, key }
  } catch {
    return { blocked: false, limit: 0, current: 0, key } // fail open
  }
}
