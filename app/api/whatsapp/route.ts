// app/api/whatsapp/route.ts
// Proxy al microservicio Baileys + estado del canal

import { NextRequest, NextResponse } from 'next/server'
import { notify, getNotifStatus, type NotifTipo } from '@/lib/notifications'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCentroBranding } from '@/lib/centro-branding'
import { getApiCaller, hasRole, canAccessChild, rowInCentro, ROLES, unauthorized, forbidden, notFound } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  try {
    const caller = await getApiCaller(req)
    if (!caller) return unauthorized()
    if (!hasRole(caller, ROLES.staff)) return forbidden()

    const body = await req.json()
    const { tipo, vars, guardar = true, userId, childId } = body

    if (!tipo) return NextResponse.json({ error: 'tipo requerido' }, { status: 400 })
    if (childId && !(await canAccessChild(caller, childId))) return notFound()
    if (guardar && userId && !(await rowInCentro('profiles', userId, caller.centroId))) return notFound()

    // Always the caller's own centro (its admin phone receives the message).
    const centro = await getCentroBranding({ centroId: caller.centroId })
    const sent = await notify({ tipo: tipo as NotifTipo, vars: vars || {}, centro })

    if (guardar && userId) {
      const tipoLabels: Record<string, string> = {
        cita_confirmada:   'Nueva cita agendada',
        cita_cancelada:    'Cita cancelada',
        formulario_nuevo:  'Formulario subido',
        informe_nuevo:     'Informe disponible',
        alerta_clinica:    'Alerta clínica',
        mensaje_terapeuta: 'Mensaje del terapeuta',
        recurso_nuevo:     'Nuevo recurso',
      }
      await supabaseAdmin.from('notificaciones').insert({
        user_id:    userId,
        child_id:   childId || null,
        tipo,
        titulo:     tipoLabels[tipo] || tipo,
        leida:      false,
        centro_id:  caller.centroId,
        created_at: new Date().toISOString(),
      }).maybeSingle()
    }

    return NextResponse.json({ ok: true, sent })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff) && caller.role !== 'programador') return forbidden()
  const status = getNotifStatus()
  return NextResponse.json({
    ...status,
    setup: {
      variables: ['WSP_SERVICE_URL', 'WSP_SERVICE_SECRET'],
      descripcion: 'URL y clave secreta del microservicio Baileys en Railway/Render',
    },
  })
}
