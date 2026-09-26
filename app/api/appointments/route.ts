import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, canAccessChild, ROLES, unauthorized, forbidden } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const caller = await getApiCaller(request)
    if (!caller) return unauthorized()

    const { searchParams } = new URL(request.url)
    const childId = searchParams.get('child_id')
    const date = searchParams.get('date')

    let query = supabaseAdmin.from('appointments').select('*')

    if (hasRole(caller, ROLES.staff)) {
      query = query.eq('centro_id', caller.centroId)
    } else if (caller.role === 'padre') {
      // Parents only see their own children's appointments.
      if (!childId || !(await canAccessChild(caller, childId))) return forbidden()
    } else {
      return forbidden()
    }

    if (childId) query = query.eq('child_id', childId)
    if (date) query = query.eq('appointment_date', date)

    const { data, error } = await query.order('appointment_date', { ascending: true })
    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getApiCaller(request)
    if (!caller) return unauthorized()
    if (!hasRole(caller, ROLES.staff)) return forbidden()

    const body = await request.json()
    if (body?.child_id && !(await canAccessChild(caller, body.child_id))) return forbidden()

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .insert([{ ...body, centro_id: caller.centroId }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}
