// app/api/booking/config/route.ts
// Configuración de disponibilidad del centro para reservas online.
// GET  → devuelve la config (singleton).
// POST → actualiza (solo staff; usa service_role).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, unauthorized, forbidden } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const caller = await getApiCaller(req)
    if (!caller) return unauthorized()
    if (!hasRole(caller, ROLES.staff)) return forbidden()
    const { data, error } = await supabaseAdmin
      .from('booking_config')
      .select('*')
      .eq('centro_id', caller.centroId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return NextResponse.json({ ok: true, config: data || null })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getApiCaller(req)
    if (!caller) return unauthorized()
    if (!hasRole(caller, ROLES.staff)) return forbidden()
    const body = await req.json()
    const {
      session_duration_min, slot_step_min, working_hours,
      closed_dates, max_advance_days,
    } = body

    const payload: Record<string, any> = { updated_at: new Date().toISOString() }
    if (session_duration_min != null) payload.session_duration_min = Number(session_duration_min)
    if (slot_step_min != null) payload.slot_step_min = Number(slot_step_min)
    if (working_hours != null) payload.working_hours = working_hours
    if (closed_dates != null) payload.closed_dates = closed_dates
    if (max_advance_days != null) payload.max_advance_days = Number(max_advance_days)
    payload.updated_by = caller.id

    // Buscar la fila existente (singleton por centro); a client-sent id is ignored so another centro's row can't be targeted.
    const { data: existing } = await supabaseAdmin
      .from('booking_config').select('id').eq('centro_id', caller.centroId).order('updated_at', { ascending: false }).limit(1).maybeSingle()

    let result
    if (existing?.id) {
      const { data, error } = await supabaseAdmin
        .from('booking_config').update(payload).eq('id', existing.id).eq('centro_id', caller.centroId).select().single()
      if (error) throw error
      result = data
    } else {
      const { data, error } = await supabaseAdmin
        .from('booking_config').insert({ ...payload, centro_id: caller.centroId }).select().single()
      if (error) throw error
      result = data
    }
    return NextResponse.json({ ok: true, config: result })
  } catch (e: any) {
    console.error('[booking/config]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
