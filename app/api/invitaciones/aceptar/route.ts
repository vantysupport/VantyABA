import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { aplicarInvitacion, invitacionPorToken, validarInvitacion } from '@/lib/invitaciones'

// POST { token } con la sesión recién creada por Google/Microsoft: une esa cuenta al centro de la invitación.
// El proveedor ya verificó el correo, así que no hace falta el email de confirmación.

const MINUTOS_CUENTA_NUEVA = 15

const nombreDe = (u: User) =>
  String(u.user_metadata?.full_name || u.user_metadata?.name || u.user_metadata?.display_name || u.email?.split('@')[0] || '').trim().slice(0, 120)

export async function POST(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!bearer) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: auth } = await supabaseAdmin.auth.getUser(bearer)
  const user = auth?.user
  if (!user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token : ''
  const email = user.email.toLowerCase()

  const { data: profile } = await supabaseAdmin.from('profiles').select('centro_id, created_at').eq('id', user.id).maybeSingle()
  // Una cuenta que ya pertenece a un centro no se mueve con una invitación.
  if (profile?.centro_id) return NextResponse.json({ error: 'alreadyMember' }, { status: 409 })

  // Si la cuenta se acaba de crear solo por este intento y no se puede usar, se quita para no dejarla huérfana.
  const limpiar = async () => {
    const creada = new Date(user.created_at).getTime()
    if (!profile?.centro_id && Date.now() - creada < MINUTOS_CUENTA_NUEVA * 60_000) {
      await supabaseAdmin.auth.admin.deleteUser(user.id)
    }
  }

  if (!user.email_confirmed_at) {
    await limpiar()
    return NextResponse.json({ error: 'generic' }, { status: 400 })
  }

  const inv = await invitacionPorToken(token)
  const invalida = await validarInvitacion(inv, email)
  if (invalida || !inv) {
    await limpiar()
    return NextResponse.json({ error: invalida ?? 'invalid' }, { status: 400 })
  }

  const fallo = await aplicarInvitacion(inv, user.id, { fullName: nombreDe(user) || email, email })
  if (fallo) {
    await limpiar()
    return NextResponse.json({ error: fallo }, { status: 400 })
  }
  return NextResponse.json({ ok: true, role: inv.role })
}
