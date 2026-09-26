import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, rowInCentro, notFound } from '@/lib/api-auth'

// GET /api/admin/children — lista todos los pacientes usando service role (bypassa RLS)
export async function GET(req: NextRequest) {
  // Notas de un paciente (descifradas): ?notas=<child_id>
  const notasDe = new URL(req.url).searchParams.get('notas')
  if (notasDe) {
    const quien = await getApiCaller(req)
    if (!hasRole(quien, ROLES.staff)) return NextResponse.json({ error: 'No autorizado' }, { status: quien ? 403 : 401 })
    if (!(await rowInCentro('children', notasDe, quien.centroId))) return notFound()
    const { data } = await supabaseAdmin.from('children').select('notas').eq('id', notasDe).maybeSingle()
    return NextResponse.json({ notas: (data?.notas as string | null) ?? '' }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const caller = await getApiCaller(req)
  if (!hasRole(caller, ROLES.staff)) return NextResponse.json({ error: 'No autorizado', data: [] }, { status: caller ? 403 : 401 })
  try {
    // Try full select first
    let { data, error } = await supabaseAdmin
      .from('children')
      .select('id, name, diagnosis, age, birth_date, parent_id, created_at')
      .eq('centro_id', caller.centroId)
      .order('name')

    // If error due to missing columns, fallback to minimal select
    if (error) {
      const fallback = await supabaseAdmin
        .from('children')
        .select('id, name, parent_id')
        .eq('centro_id', caller.centroId)
        .order('name')
      if (fallback.error) throw fallback.error
      data = fallback.data as any[]
    }

    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message, data: [] }, { status: 200 })
  }
}

// PATCH /api/admin/children — actualiza parent_id + sincroniza parent_accounts
export async function PATCH(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!hasRole(caller, ROLES.staff)) return NextResponse.json({ error: 'No autorizado' }, { status: caller ? 403 : 401 })
  try {
    const body = await req.json()
    const { childId, parentId } = body
    if (!childId) return NextResponse.json({ error: 'childId requerido' }, { status: 400 })
    if (!(await rowInCentro('children', childId, caller.centroId))) return notFound()

    // Notas del paciente: se guardan cifradas (lo hace el cliente de base del servidor)
    if ('notas' in body) {
      const notas = typeof body.notas === 'string' ? body.notas.trim().slice(0, 10000) : ''
      const { error } = await supabaseAdmin.from('children').update({ notas: notas || null }).eq('id', childId)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }
    // El padre asignado debe ser una cuenta del mismo centro.
    if (parentId && !(await rowInCentro('profiles', parentId, caller.centroId))) return notFound()

    // 1. Actualizar parent_id en children
    const { error } = await supabaseAdmin
      .from('children')
      .update({ parent_id: parentId ?? null })
      .eq('id', childId)
    if (error) throw error

    // 2. Sincronizar parent_accounts automáticamente
    if (parentId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name, phone, email')
        .eq('id', parentId)
        .maybeSingle()

      await supabaseAdmin
        .from('parent_accounts')
        .upsert({
          user_id:         parentId,
          child_id:        childId,
          nombre:          (profile as any)?.full_name || 'Padre/Tutor',
          telefono:        (profile as any)?.phone || null,
          email:           (profile as any)?.email || null,
          parentesco:      'padre',
          whatsapp_activo: !!((profile as any)?.phone),
          notif_citas:     true,
          notif_reportes:  true,
          notif_tareas:    true,
          centro_id:       caller.centroId,
        }, { onConflict: 'user_id,child_id', ignoreDuplicates: false })
    } else {
      await supabaseAdmin
        .from('parent_accounts')
        .delete()
        .eq('child_id', childId)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
