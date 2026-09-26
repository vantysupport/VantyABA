// Solicitudes de la familia sobre una cita: reprogramar (propone fecha y hora) o cancelar.
// La cita no se borra: queda marcada y el equipo del centro recibe un aviso para gestionarla.
//  POST { id, accion: 'reprogramar' | 'cancelar', fecha?, hora?, motivo? }

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, unauthorized, forbidden } from '@/lib/api-auth'
import { getLocaleFromRequest } from '@/lib/lang'
import { avisarEquipo } from '@/lib/avisos'

export const dynamic = 'force-dynamic'

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const HORA = /^\d{2}:\d{2}$/

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (caller.role !== 'padre' || !caller.centroId) return forbidden()

  const body = await req.json().catch(() => ({}))
  const id = typeof body?.id === 'string' ? body.id : ''
  const accion = body?.accion === 'cancelar' ? 'cancelar' : body?.accion === 'reprogramar' ? 'reprogramar' : null
  const motivo = String(body?.motivo ?? '').trim().slice(0, 400) || null
  const fecha = typeof body?.fecha === 'string' && FECHA.test(body.fecha) ? body.fecha : null
  const hora = typeof body?.hora === 'string' && HORA.test(body.hora) ? body.hora : null
  if (!id || !accion) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  if (accion === 'reprogramar' && !fecha) return NextResponse.json({ error: 'fecha_requerida' }, { status: 400 })
  if (fecha && fecha <= new Date().toISOString().slice(0, 10)) return NextResponse.json({ error: 'fecha_pasada' }, { status: 400 })

  // La cita debe ser de un hijo de esta familia y de su centro
  const { data: cita } = await supabaseAdmin.from('appointments')
    .select('id, child_id, centro_id, status, appointment_date, appointment_time, service_type, specialist_id, metadata, children!inner(name, parent_id)')
    .eq('id', id).eq('centro_id', caller.centroId).maybeSingle()
  const hijo = (cita?.children ?? null) as unknown as { name: string; parent_id: string } | null
  if (!cita || hijo?.parent_id !== caller.id) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (cita.status === 'cancelled' || cita.status === 'completed') return NextResponse.json({ error: 'no_aplica' }, { status: 409 })

  const metadata = { ...((cita.metadata ?? {}) as Record<string, unknown>) }
  const ahora = new Date().toISOString()
  let cambios: Record<string, unknown>
  if (accion === 'cancelar') {
    metadata.cancelacion = { por: 'familia', motivo, en: ahora }
    cambios = { status: 'cancelled', metadata }
  } else {
    metadata.reprogramacion = { fecha, hora, motivo, en: ahora, estado: 'solicitada' }
    cambios = { status: 'pending', metadata }
  }
  const { error } = await supabaseAdmin.from('appointments').update(cambios).eq('id', id)
  if (error) return NextResponse.json({ error: 'no_guardado' }, { status: 500 })

  // Aviso al equipo: dirección del centro y especialista asignado
  const en = getLocaleFromRequest(req) === 'en'
  const cuando = `${cita.appointment_date} ${String(cita.appointment_time ?? '').slice(0, 5)}`
  const titulo = accion === 'cancelar'
    ? (en ? `Appointment cancelled by the family · ${hijo.name}` : `Cita cancelada por la familia · ${hijo.name}`)
    : (en ? `Reschedule request · ${hijo.name}` : `Solicitud de reprogramación · ${hijo.name}`)
  const mensaje = accion === 'cancelar'
    ? (en ? `The family cancelled the appointment of ${cuando}.` : `La familia canceló la cita del ${cuando}.`) + (motivo ? ` ${en ? 'Reason' : 'Motivo'}: ${motivo}` : '')
    : (en ? `The family asks to move the appointment of ${cuando} to ${fecha}${hora ? ` ${hora}` : ''}.` : `La familia pide mover la cita del ${cuando} al ${fecha}${hora ? ` a las ${hora}` : ''}.`) + (motivo ? ` ${en ? 'Reason' : 'Motivo'}: ${motivo}` : '')
  await avisarEquipo({
    centroId: caller.centroId, roles: ['jefe', 'admin', 'secretaria'], extra: [cita.specialist_id], excluir: caller.id,
    tipo: accion === 'cancelar' ? 'cita_cancelada_familia' : 'cita_reprogramacion', childId: cita.child_id, prioridad: 1,
    titulo: { es: titulo, en: titulo }, mensaje: { es: mensaje, en: mensaje },
    push: accion === 'cancelar'
      ? { titulo: { es: `${hijo.name} no podrá asistir`, en: `${hijo.name} can't make it` } }
      : { titulo: { es: `${hijo.name} necesita otra fecha`, en: `${hijo.name} needs another date` } },
    metadata: { appointment_id: id, fecha, hora },
  })
  return NextResponse.json({ ok: true })
}
