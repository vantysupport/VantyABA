// POST { confirm_name } → la persona encargada elimina su centro con toda su información y su cuenta.
// Está bajo /api/suscripcion para que funcione también con la prueba terminada o el centro bloqueado.
// Antes de borrar se cancela la suscripción en Lemon Squeezy, así no se genera ningún cobro más.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, unauthorized, forbidden } from '@/lib/api-auth'
import { eliminarCentro, esEncargadoDelCentro } from '@/lib/eliminar-centro'
import { logAuditEvent } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!caller.centroId || !(await esEncargadoDelCentro(caller.id, caller.centroId))) return forbidden()

  const body = await req.json().catch(() => ({}))
  const { data: centro } = await supabaseAdmin.from('centros').select('id, name').eq('id', caller.centroId).maybeSingle()
  if (!centro) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const escrito = typeof body?.confirm_name === 'string' ? body.confirm_name.trim().toLowerCase() : ''
  if (!escrito || escrito !== (centro.name ?? '').trim().toLowerCase()) return NextResponse.json({ error: 'name_mismatch' }, { status: 400 })

  // Se registra antes: después la cuenta ya no existe.
  await logAuditEvent({ action: 'delete', resource_type: 'config', userId: caller.id, userEmail: caller.email ?? undefined, userRole: caller.role,
    description: 'Centro eliminado por su encargado', metadata: { centroId: centro.id, centro: centro.name }, req })
  const r = await eliminarCentro(centro.id)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === 'has_programador' ? 409 : 500 })
  return NextResponse.json({ ok: true, pacientes: r.pacientes, cuentas: r.cuentas })
}
