// app/api/knowledge/instrucciones/route.ts
// ============================================================================
// API: Instrucciones del Centro — ARIA las incluye en cada análisis
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, rowInCentro, unauthorized, forbidden, notFound } from '@/lib/api-auth'

// ── GET: Listar instrucciones activas ──────────────────────────────────────
export async function GET(request: NextRequest) {
  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const { data, error } = await supabaseAdmin
      .from('centro_instrucciones')
      .select('id, titulo, contenido, categoria, prioridad, activo, created_at')
      .eq('centro_id', caller.centroId)
      .eq('activo', true)
      .order('prioridad', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

// ── POST: Crear nueva instrucción ──────────────────────────────────────────
export async function POST(request: NextRequest) {
  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.clinical)) return forbidden()
  try {
    const { titulo, contenido, categoria = 'protocolo', prioridad = 5 } = await request.json()

    if (!titulo || !contenido) {
      return NextResponse.json({ error: 'titulo y contenido son requeridos' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('centro_instrucciones')
      .insert({ titulo, contenido, categoria, prioridad, activo: true, centro_id: caller.centroId })
      .select('id')
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, id: data.id })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

// ── DELETE: Desactivar instrucción ─────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.clinical)) return forbidden()
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    if (!(await rowInCentro('centro_instrucciones', id, caller.centroId))) return notFound()

    const { error } = await supabaseAdmin
      .from('centro_instrucciones')
      .update({ activo: false })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}
