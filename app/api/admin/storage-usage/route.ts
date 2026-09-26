// app/api/admin/storage-usage/route.ts
// Espacio usado por ESTE centro (archivos y datos) contra los límites de su plan. Solo jefe/admin.

import { NextRequest, NextResponse } from 'next/server'
import { getApiCaller, hasRole, ROLES } from '@/lib/api-auth'
import { usoEspacio } from '@/lib/uso-espacio'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!hasRole(caller, ROLES.admins)) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  try {
    const u = await usoEspacio(caller.centroId, { forzarDatos: req.nextUrl.searchParams.get('recalcular') === '1' })
    return NextResponse.json({ storage: u.archivos, database: u.datos }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'No se pudo calcular el uso' }, { status: 500 })
  }
}
