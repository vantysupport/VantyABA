import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, canAccessChild, rowInCentro, ROLES, unauthorized, forbidden, notFound } from '@/lib/api-auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getApiCaller(request)
    if (!caller) return unauthorized()
    if (!hasRole(caller, ROLES.staff)) return forbidden()

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }
    if (!(await rowInCentro('appointments', id, caller.centroId))) return notFound()

    const { error } = await supabaseAdmin
      .from('appointments')
      .delete()
      .eq('id', id)
      .eq('centro_id', caller.centroId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error eliminando cita:', error)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getApiCaller(request)
    if (!caller) return unauthorized()
    if (!hasRole(caller, ROLES.staff)) return forbidden()

    const { id } = await params
    const body = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }
    if (!(await rowInCentro('appointments', id, caller.centroId))) return notFound()
    if (body?.child_id && !(await canAccessChild(caller, body.child_id))) return forbidden()
    // The centro of an appointment can't be moved.
    delete body.centro_id

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .update(body)
      .eq('id', id)
      .eq('centro_id', caller.centroId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error actualizando cita:', error)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}
