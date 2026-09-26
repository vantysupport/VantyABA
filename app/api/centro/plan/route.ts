// Plan summary of the CALLER's center for the panel sidebar: plan name, status and usage against its limits.
// Scoped by the caller's own centro_id; never accepts a centro id from the request.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, unauthorized, forbidden } from '@/lib/api-auth'
import { limitesCentro } from '@/lib/limites-centro'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()

  const { data: centro } = await supabaseAdmin
    .from('centros')
    .select('status, trial_ends_at, paid_until, extra_parents, plans(name_es, name_en, max_patients, max_professionals, max_parents)')
    .eq('id', caller.centroId)
    .maybeSingle()
  if (!centro) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Solo los perfiles activos ocupan cupo (igual que lib/profile-limits)
  const [{ count: patients }, { count: professionals }, { count: parents }] = await Promise.all([
    supabaseAdmin.from('children').select('id', { count: 'exact', head: true }).eq('centro_id', caller.centroId),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('centro_id', caller.centroId).neq('role', 'padre').not('is_active', 'is', false),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('centro_id', caller.centroId).eq('role', 'padre').not('is_active', 'is', false),
  ])

  const plan = (Array.isArray(centro.plans) ? centro.plans[0] : centro.plans) as
    | { name_es: string; name_en: string; max_patients: number | null; max_professionals: number | null; max_parents: number | null }
    | null

  const lim = await limitesCentro(caller.centroId)

  return NextResponse.json({
    status: centro.status,
    trialEndsAt: centro.trial_ends_at,
    paidUntil: centro.paid_until,
    planName: plan ? { es: plan.name_es, en: plan.name_en } : null,
    patients: { used: patients ?? 0, max: lim.max_patients },
    professionals: { used: professionals ?? 0, max: lim.max_professionals },
    parents: { used: parents ?? 0, max: lim.max_parents ? lim.max_parents + lim.extra_parents : null },
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
