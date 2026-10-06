// app/api/agente/refrescar-alertas/route.ts
// Endpoint rápido (sin IA) que regenera alertas de programas ABA para uno o todos los niños.
// Lo invoca el dashboard al cargar para mantener los logros y alertas siempre frescos.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, canAccessChild, unauthorized, forbidden, notFound } from '@/lib/api-auth'
import { sincronizarAlertasNino } from '@/lib/alertas-programas'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const body = await req.json().catch(() => ({}))
    const childId: string | undefined = body?.child_id
    if (childId && !(await canAccessChild(caller, childId))) return notFound()

    // Lista de niños a procesar: uno específico o todos
    let childIds: string[] = []
    if (childId) {
      childIds = [childId]
    } else {
      const { data: children } = await supabaseAdmin.from('children').select('id').eq('centro_id', caller.centroId)
      childIds = (children || []).map((c: any) => c.id)
    }

    // Motor único de alertas (lib/alertas-programas): crea, actualiza, resuelve y quita duplicados
    let totalAlertas = 0
    for (const cid of childIds) {
      totalAlertas += (await sincronizarAlertasNino(cid, caller.centroId)).length
    }

    return NextResponse.json({
      ok: true,
      pacientes_procesados: childIds.length,
      alertas_vigentes: totalAlertas,
    })
  } catch (error: any) {
    console.error('[refrescar-alertas] error:', error)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}
