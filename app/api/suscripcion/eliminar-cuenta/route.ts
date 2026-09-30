// POST { confirm: 'ELIMINAR' | 'DELETE' } → cualquier persona elimina su propia cuenta y sus datos personales.
// Los datos del niño se conservan en el centro (los borra la dirección o el especialista a cargo).
// La persona encargada del centro debe eliminar el centro completo (/api/suscripcion/eliminar-centro).
// Bajo /api/suscripcion para que funcione también con el centro bloqueado.

import { NextRequest, NextResponse } from 'next/server'
import { getApiCaller, unauthorized, forbidden } from '@/lib/api-auth'
import { esEncargadoDelCentro } from '@/lib/eliminar-centro'
import { eliminarCuentaPersonal } from '@/lib/eliminar-cuenta'
import { logAuditEvent } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (caller.role === 'programador') return forbidden()
  if (caller.centroId && await esEncargadoDelCentro(caller.id, caller.centroId)) return NextResponse.json({ error: 'es_encargado' }, { status: 409 })

  const body = await req.json().catch(() => ({}))
  const confirm = typeof body?.confirm === 'string' ? body.confirm.trim().toUpperCase() : ''
  if (confirm !== 'ELIMINAR' && confirm !== 'DELETE') return NextResponse.json({ error: 'confirm_required' }, { status: 400 })

  await logAuditEvent({ action: 'delete', resource_type: 'usuario', userId: caller.id, userEmail: caller.email ?? undefined, userRole: caller.role,
    description: 'Cuenta eliminada por su titular', metadata: { centroId: caller.centroId }, req })
  const r = await eliminarCuentaPersonal(caller.id)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
