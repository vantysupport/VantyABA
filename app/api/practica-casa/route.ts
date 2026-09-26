import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, canAccessChild, unauthorized, notFound } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const programaId = searchParams.get('programa_id')
    const dias = parseInt(searchParams.get('dias') || '56')

    if (!programaId) {
      return NextResponse.json({ error: 'programa_id requerido' }, { status: 400 })
    }

    const { data: programa } = await supabaseAdmin.from('programas_aba').select('child_id').eq('id', programaId).maybeSingle()
    if (!programa || !(await canAccessChild(caller, programa.child_id))) return notFound()

    const desde = new Date()
    desde.setDate(desde.getDate() - dias)

    const { data, error } = await supabaseAdmin
      .from('programa_practica_casa')
      .select('fecha, objetivo_id')
      .eq('programa_id', programaId)
      .gte('fecha', desde.toISOString().split('T')[0])
      .order('fecha', { ascending: false })

    if (error) throw error

    // Cualquier registro existente = practicado ese día
    const registros = (data || []).map((r: any) => ({ ...r, practicado: true }))

    return NextResponse.json({ data: registros })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}
