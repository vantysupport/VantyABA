// Consentimiento para la IA.
// GET: estado del centro y de la propia cuenta. POST { ambito: 'centro' | 'propio', decision: 'aceptada' | 'rechazada' }:
// el centro solo lo decide la dirección (jefe/admin); 'propio' es la autorización de cada padre/tutor para ARIA.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, unauthorized, forbidden, ROLES } from '@/lib/api-auth'
import type { EstadoIA } from '@/lib/ia-consentimiento'

export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  const [{ data: centro }, { data: perfil }] = await Promise.all([
    caller.centroId ? supabaseAdmin.from('centros').select('ia_estado, ia_estado_at').eq('id', caller.centroId).maybeSingle() : Promise.resolve({ data: null }),
    supabaseAdmin.from('profiles').select('ia_consentimiento, ia_consentimiento_at').eq('id', caller.id).maybeSingle(),
  ])
  return NextResponse.json({
    rol: caller.role,
    centro: (centro?.ia_estado ?? null) as EstadoIA,
    centroAt: centro?.ia_estado_at ?? null,
    propio: (perfil?.ia_consentimiento ?? null) as EstadoIA,
    propioAt: perfil?.ia_consentimiento_at ?? null,
    puedeDecidirCentro: (ROLES.admins as readonly string[]).includes(caller.role),
  })
}

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  const body = await req.json().catch(() => ({}))
  const decision = body?.decision === 'aceptada' ? 'aceptada' : body?.decision === 'rechazada' ? 'rechazada' : null
  if (!decision) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const ahora = new Date().toISOString()

  if (body?.ambito === 'centro') {
    if (!caller.centroId || !(ROLES.admins as readonly string[]).includes(caller.role)) return forbidden()
    const { error } = await supabaseAdmin.from('centros')
      .update({ ia_estado: decision, ia_estado_at: ahora, ia_estado_por: caller.id }).eq('id', caller.centroId)
    if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    return NextResponse.json({ ok: true, centro: decision })
  }

  const { error } = await supabaseAdmin.from('profiles')
    .update({ ia_consentimiento: decision, ia_consentimiento_at: ahora }).eq('id', caller.id)
  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  return NextResponse.json({ ok: true, propio: decision })
}
