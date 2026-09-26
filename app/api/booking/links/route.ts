// app/api/booking/links/route.ts
// Gestión de links de reserva.
// GET  → lista links (opcional ?token= para uno; ?child_id= para filtrar).
// POST → crea un link nuevo. Devuelve el token/URL.

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, canAccessChild, rowInCentro, ROLES, unauthorized, forbidden, notFound } from '@/lib/api-auth'
import { getCentroBranding } from '@/lib/centro-branding'

export const dynamic = 'force-dynamic'

function genToken(): string {
  // token corto, legible, no adivinable (it is the only credential of the public booking page, so use a CSPRNG)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from(randomBytes(16), b => alphabet[b % alphabet.length]).join('')
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    const childId = searchParams.get('child_id')

    if (token) {
      // Carga pública del link (para la página de reserva) — incluye datos del paciente/especialista.
      // Public by design: the token is the secret; everything returned is scoped to that link's row.
      const { data: link, error } = await supabaseAdmin
        .from('booking_links').select('*').eq('token', token).maybeSingle()
      if (error) throw error
      if (!link) return NextResponse.json({ error: 'Link no encontrado' }, { status: 404 })

      let childName: string | null = null
      let specialistName: string | null = null
      if (link.child_id) {
        const { data: c } = await supabaseAdmin.from('children').select('name').eq('id', link.child_id).maybeSingle()
        childName = (c as any)?.name || null
      }
      if (link.specialist_id) {
        const { data: s } = await supabaseAdmin.from('profiles').select('full_name, specialty').eq('id', link.specialist_id).maybeSingle()
        specialistName = (s as any)?.full_name || null
      }
      // Only the center's public identity (name + logo), to brand the booking page.
      const centro = await getCentroBranding({ centroId: link.centro_id })
      return NextResponse.json({ ok: true, link, childName, specialistName, centro: { name: centro.name, logoUrl: centro.logoUrl } })
    }

    const caller = await getApiCaller(req)
    if (!caller) return unauthorized()
    if (!hasRole(caller, ROLES.staff)) return forbidden()

    let q = supabaseAdmin.from('booking_links').select('*').eq('centro_id', caller.centroId).order('created_at', { ascending: false }).limit(100)
    if (childId) q = q.eq('child_id', childId)
    const { data, error } = await q
    if (error) throw error
    return NextResponse.json({ ok: true, links: data || [] })
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
      child_id, specialist_id, max_slots, plan_type,
      service_type, modalidad, notas, expires_in_days,
    } = body
    if (child_id && !(await canAccessChild(caller, child_id))) return notFound()
    if (specialist_id && !(await rowInCentro('profiles', specialist_id, caller.centroId))) return notFound()

    const token = genToken()
    const expires_at = expires_in_days
      ? new Date(Date.now() + Number(expires_in_days) * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 días por defecto

    const { data, error } = await supabaseAdmin.from('booking_links').insert({
      token,
      child_id: child_id || null,
      specialist_id: specialist_id || null,
      max_slots: Math.max(1, Number(max_slots) || 1),
      plan_type: plan_type || 'individual',
      service_type: service_type || 'Terapia',
      modalidad: modalidad || 'presencial',
      notas: notas || null,
      expires_at,
      created_by: caller.id,
      centro_id: caller.centroId,
    }).select().single()
    if (error) throw error

    return NextResponse.json({ ok: true, link: data, token })
  } catch (e: any) {
    console.error('[booking/links][POST]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

// PATCH → desactivar / reactivar un link
export async function PATCH(req: NextRequest) {
  try {
    const caller = await getApiCaller(req)
    if (!caller) return unauthorized()
    if (!hasRole(caller, ROLES.staff)) return forbidden()
    const { id, active } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    if (!(await rowInCentro('booking_links', id, caller.centroId))) return notFound()
    const { error } = await supabaseAdmin.from('booking_links').update({ active }).eq('id', id).eq('centro_id', caller.centroId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

// DELETE → eliminar un link permanentemente
export async function DELETE(req: NextRequest) {
  try {
    const caller = await getApiCaller(req)
    if (!caller) return unauthorized()
    if (!hasRole(caller, ROLES.staff)) return forbidden()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    if (!(await rowInCentro('booking_links', id, caller.centroId))) return notFound()
    const { error } = await supabaseAdmin.from('booking_links').delete().eq('id', id).eq('centro_id', caller.centroId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
