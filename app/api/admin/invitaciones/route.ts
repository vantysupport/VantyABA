import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, rowInCentro, notFound } from '@/lib/api-auth'
import { profileLimitCheck } from '@/lib/profile-limits'
import { appBaseUrl } from '@/lib/auth-emails'
import { sendEmail } from '@/lib/email'
import { getCentroBranding } from '@/lib/centro-branding'
import {
  ROLES_INVITABLES, type Invitacion, type RolInvitable,
  nuevoToken, linkInvitacion, estadoInvitacion, buildEmailInvitacion,
} from '@/lib/invitaciones'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DIAS_VALIDOS = [1, 3, 7, 14, 30]

type FilaInvitacion = Invitacion & { children?: { name?: string } | null }

async function requireAdmin(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) } as const
  if (!hasRole(caller, ROLES.admins)) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) } as const
  return { caller } as const
}

const localeDe = (req: NextRequest, body?: { locale?: string }) =>
  (body?.locale ?? req.headers.get('x-locale')) === 'en' ? 'en' as const : 'es' as const

// Para el cliente: el link ya armado y el estado calculado.
function aVista(row: FilaInvitacion, base: string | null, locale: 'es' | 'en') {
  const { children, token, ...inv } = row
  return {
    ...inv,
    paciente: children?.name ?? null,
    estado: estadoInvitacion(inv),
    link: base ? linkInvitacion(base, token, locale) : null,
  }
}

// GET: invitaciones del centro (las revocadas no se muestran).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error
  const locale = localeDe(req)
  const { data, error } = await supabaseAdmin
    .from('invitaciones')
    .select('*, children(name)')
    .eq('centro_id', auth.caller.centroId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: 'No se pudieron cargar las invitaciones' }, { status: 500 })
  const base = appBaseUrl()
  return NextResponse.json({ data: ((data || []) as FilaInvitacion[]).map(r => aVista(r, base, locale)) })
}

// POST: crea una invitación; si trae email, además la envía por correo.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error
  const { caller } = auth
  const body = await req.json().catch(() => ({}))
  const locale = localeDe(req, body)
  const en = locale === 'en'
  const bad = (es: string, enMsg: string, status = 400) => NextResponse.json({ error: en ? enMsg : es }, { status })

  const role = body.role as RolInvitable
  if (!ROLES_INVITABLES.includes(role)) return bad('Rol no válido', 'Invalid role')
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : ''
  if (email && !EMAIL_RE.test(email)) return bad('Correo no válido', 'Invalid email')
  const childId = role === 'padre' && typeof body.child_id === 'string' && body.child_id ? body.child_id : null
  if (childId && !(await rowInCentro('children', childId, caller.centroId))) return notFound()
  const specialty = role !== 'padre' && typeof body.specialty === 'string' ? body.specialty.trim().slice(0, 80) || null : null
  const dias = DIAS_VALIDOS.includes(Number(body.days)) ? Number(body.days) : 7
  // Cada link es para una sola persona: así cada cuenta queda asociada a quien la recibió.
  const maxUses = 1

  // Sin cupo libre no tiene sentido invitar: primero hay que liberar uno.
  const cupo = await profileLimitCheck(role, caller.centroId)
  if (cupo.blocked) {
    return NextResponse.json({
      error: en
        ? `No seats available (${cupo.current}/${cupo.limit}). Deactivate someone or expand the plan.`
        : `No hay cupos libres (${cupo.current}/${cupo.limit}). Desactivá a alguien o ampliá el plan.`,
      code: 'seat_limit',
    }, { status: 409 })
  }

  if (email) {
    const { data: existe } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle()
    if (existe) return bad('Ese correo ya tiene una cuenta', 'That email already has an account', 409)
  }

  const base = appBaseUrl()
  if (!base) return bad('Falta configurar la URL del sitio (NEXT_PUBLIC_SITE_URL)', 'The site URL is not configured (NEXT_PUBLIC_SITE_URL)', 500)

  const expires = new Date(Date.now() + dias * 86_400_000)
  const { data: inv, error } = await supabaseAdmin
    .from('invitaciones')
    .insert({
      centro_id: caller.centroId, role, token: nuevoToken(), email: email || null, child_id: childId, specialty,
      max_uses: maxUses, expires_at: expires.toISOString(), created_by: caller.id,
    })
    .select('*, children(name)')
    .single()
  if (error || !inv) return bad('No se pudo crear la invitación', 'Could not create the invitation', 500)

  const vista = aVista(inv as FilaInvitacion, base, locale)
  let emailed = false
  if (email && vista.link) {
    const centro = await getCentroBranding({ centroId: caller.centroId })
    const { subject, html } = buildEmailInvitacion({ link: vista.link, centroNombre: centro.name, role, paciente: vista.paciente, vence: expires, en })
    emailed = await sendEmail(email, subject, html, centro.name)
  }
  return NextResponse.json({ data: vista, emailed })
}

// DELETE ?id= : revoca la invitación (el link deja de funcionar).
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error
  const id = req.nextUrl.searchParams.get('id')
  if (!id || !(await rowInCentro('invitaciones', id, auth.caller.centroId))) return notFound()
  const { error } = await supabaseAdmin.from('invitaciones').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo revocar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
