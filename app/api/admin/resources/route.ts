import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, canAccessChild, rowInCentro, unauthorized, forbidden, notFound } from '@/lib/api-auth'
import { esUUID } from '@/lib/seguridad-filtros'

export async function GET(request: NextRequest) {
  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  const isStaff = hasRole(caller, ROLES.staff)
  if (!isStaff && caller.role !== 'padre') return forbidden()
  try {
    const { searchParams } = new URL(request.url)
    const parentId = searchParams.get('parent_id')
    const childId = searchParams.get('child_id')
    const global = searchParams.get('global')
    if (!caller.centroId) return NextResponse.json({ data: [] })
    // Un padre solo ve lo suyo (o lo de sus hijos) y los recursos globales de su centro.
    if (!isStaff) {
      if (childId && !(await canAccessChild(caller, childId))) return notFound()
      if (!childId && parentId !== caller.id) return notFound()
    }

    let query = supabaseAdmin
      .from('parent_resources')
      .select('*')
      .eq('centro_id', caller.centroId)
      .order('created_at', { ascending: false })

    if (childId) {
      if (!esUUID(childId)) return NextResponse.json({ error: 'child_id inválido' }, { status: 400 })
      // Resources for a specific child OR global
      query = query.or(`child_id.eq.${childId},is_global.eq.true`)
    } else if (parentId) {
      if (!esUUID(parentId)) return NextResponse.json({ error: 'parent_id inválido' }, { status: 400 })
      // Legacy: resources for parent_id OR global
      query = query.or(`parent_id.eq.${parentId},is_global.eq.true`)
    } else if (global === 'true') {
      query = query.eq('is_global', true)
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const body = await request.json()
    if (body.child_id && !(await canAccessChild(caller, body.child_id))) return notFound()
    if (body.parent_id && !(await rowInCentro('profiles', body.parent_id, caller.centroId))) return notFound()

    const { data, error } = await supabaseAdmin
      .from('parent_resources')
      .insert([{
        ...body,
        centro_id: caller.centroId,
        created_at: new Date().toISOString(),
      }])
      .select()

    if (error) throw error

    // Notify parent if it's targeted (best-effort)
    if (body.parent_id && !body.is_global) {
      try {
        await supabaseAdmin.from('notifications').insert([{
          user_id: body.parent_id,
          title: `📎 Nuevo material compartido`,
          message: `${body.title} - ${body.description || ''}`,
          type: 'resource',
          is_read: false,
          centro_id: caller.centroId,
          created_at: new Date().toISOString(),
        }])
      } catch (_e) { /* best-effort */ }
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const { id } = await request.json()
    if (!(await rowInCentro('parent_resources', id, caller.centroId))) return notFound()
    const { error } = await supabaseAdmin.from('parent_resources').delete().eq('id', id).eq('centro_id', caller.centroId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}
