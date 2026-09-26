// app/api/evaluacion-inicial/responder/route.ts
// El especialista/admin envía la respuesta final al padre tras revisar
// la selección de terapias. Estado pasa a 'revisado'.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, canAccessChild, rowInCentro, unauthorized, forbidden, notFound } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const body = await req.json()
    const { evaluacion_id, respuesta } = body
    let respondido_por: string | null = body.respondido_por || null
    if (!evaluacion_id || !respuesta?.trim()) {
      return NextResponse.json({ error: 'evaluacion_id y respuesta requeridos' }, { status: 400 })
    }
    if (!(await rowInCentro('evaluaciones_iniciales', evaluacion_id, caller.centroId))) return notFound()
    if (respondido_por && !(await rowInCentro('profiles', respondido_por, caller.centroId))) respondido_por = caller.id

    const ahora = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .update({
        respuesta_especialista: respuesta,
        respondido_en: ahora,
        respondido_por: respondido_por || null,
        estado: 'revisado',
        updated_at: ahora,
      })
      .eq('id', evaluacion_id)
      .select('*, children:child_id (id, name, parent_id)')
      .single()
    if (error) throw error

    // Notificar al padre
    try {
      const parentId = (data as any)?.children?.parent_id
      if (parentId) {
        await supabaseAdmin.from('notifications').insert({
          user_id: parentId,
          title: '💬 Respuesta del especialista',
          message: 'Nuestro equipo ha revisado tu solicitud. Entra a "Evaluación Inicial" para ver la respuesta.',
          type: 'evaluacion_inicial',
          is_read: false,
          centro_id: caller.centroId,
          created_at: ahora,
        })
      }
    } catch (e) { console.warn('[responder] noti falló', e) }

    return NextResponse.json({ ok: true, evaluacion: data })
  } catch (e: any) {
    console.error('[evaluacion-inicial][responder]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
