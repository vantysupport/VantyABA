import { getLocaleFromRequest } from '@/lib/lang'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, canAccessChild, rowInCentro, unauthorized, forbidden, notFound } from '@/lib/api-auth'
import { getCentroBranding } from '@/lib/centro-branding'
import { internalApiHeaders } from '@/lib/calendar-integration'
import { after } from 'next/server'
import { sincronizarCalendarios } from '@/lib/calendar-sync'
import { enviarCorreoCitaFamilia, avisarEspecialistaCita } from '@/lib/cita-correo'
import { avisarCitaFamilia, avisarFamilia } from '@/lib/avisos'


export async function GET(request: NextRequest) {
  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const { data, error } = await supabaseAdmin
      .from('appointments')
      .select('*, children(name, parent_id)')
      .eq('centro_id', caller.centroId)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })

    if (error) throw error

    // Adjuntar info del especialista asignado a cada cita
    const specialistIds = Array.from(new Set(
      (data || [])
        .map((a: any) => a.specialist_id)
        .filter((id: any) => !!id)
    ))

    let specialistMap: Record<string, { full_name: string; specialty: string | null; role: string | null }> = {}
    if (specialistIds.length > 0) {
      const { data: specialists } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, specialty, role')
        .in('id', specialistIds)
      for (const s of (specialists || []) as any[]) {
        specialistMap[s.id] = { full_name: s.full_name, specialty: s.specialty, role: s.role }
      }
    }

    const enriched = (data || []).map((a: any) => ({
      ...a,
      specialist: a.specialist_id ? specialistMap[a.specialist_id] || null : null,
    }))

    return NextResponse.json({ data: enriched })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const body = await request.json()
    const appointments = Array.isArray(body) ? body : [body]
    for (const apt of appointments) {
      if (apt?.child_id && !(await canAccessChild(caller, apt.child_id))) return notFound()
      if (apt?.specialist_id && !(await rowInCentro('profiles', apt.specialist_id, caller.centroId))) return notFound()
    }

    // Generar video_link para citas virtuales antes de insertar
    const appointmentsConLink = appointments.map((apt: any) => {
      if (apt.modalidad === 'virtual' && !apt.video_link && !apt.videoLink) {
        const tempId = `${apt.child_id}-${apt.appointment_date}-${(apt.appointment_time || '').replace(/:/g, '-')}`
        return { ...apt, video_link: `https://meet.jit.si/VantyMeet-${tempId}`, centro_id: caller.centroId }
      }
      return { ...apt, centro_id: caller.centroId }
    })

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .insert(appointmentsConLink)
      .select('*, children(name)')

    if (error) throw error

    // Aviso en el portal y en el celular de cada familia
    after(() => Promise.all((data || []).flatMap((apt: any) => [avisarCitaFamilia(apt, 'nueva'), enviarCorreoCitaFamilia(apt, 'nueva', getLocaleFromRequest(request) === 'en'), avisarEspecialistaCita(apt, 'nueva', caller.id)])))

    // ?sincronizar=1 (p. ej. al agendar la sesión desde Pagos): llevar la cita a Google/Outlook desde el
    // servidor. La Agenda no lo usa porque sincroniza por su cuenta.
    if (request.nextUrl.searchParams.get('sincronizar') === '1') {
      after(() => Promise.all((data || []).map((apt: { id: string }) => sincronizarCalendarios(apt.id, 'actualizar'))))
    }

    // Responder inmediatamente — las notificaciones corren en background
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const body = await request.json()
    let { status, appointment_date, appointment_time } = body
    const { id, notes } = body
    if (!id) throw new Error('id es requerido')
    if (!(await rowInCentro('appointments', id, caller.centroId))) return notFound()

    const updates: Record<string, any> = {}

    // Respuesta del centro a una solicitud de reprogramación de la familia
    let avisoFamilia: { parentId: string; titulo: string; mensaje: string } | null = null
    if (body.reprogramacion === 'aprobar' || body.reprogramacion === 'rechazar') {
      const { data: actual } = await supabaseAdmin.from('appointments')
        .select('metadata, appointment_date, appointment_time, children(name, parent_id)').eq('id', id).single()
      const meta = { ...((actual?.metadata ?? {}) as Record<string, any>) }
      const sol = meta.reprogramacion
      if (!sol || sol.estado !== 'solicitada') return NextResponse.json({ error: 'sin_solicitud' }, { status: 409 })
      const aprobar = body.reprogramacion === 'aprobar'
      meta.reprogramacion = { ...sol, estado: aprobar ? 'aprobada' : 'rechazada', respondida_en: new Date().toISOString(), por: caller.id }
      updates.metadata = meta
      status = 'confirmed'
      if (aprobar) {
        appointment_date = sol.fecha
        if (sol.hora) appointment_time = sol.hora
      }
      const en = getLocaleFromRequest(request, body) === 'en'
      const hijo = (actual?.children ?? null) as unknown as { name: string; parent_id: string } | null
      if (hijo?.parent_id) {
        const cuando = aprobar ? `${sol.fecha}${sol.hora ? ` ${sol.hora}` : ''}` : `${actual?.appointment_date} ${String(actual?.appointment_time ?? '').slice(0, 5)}`
        avisoFamilia = {
          parentId: hijo.parent_id,
          titulo: aprobar ? (en ? `Appointment rescheduled · ${hijo.name}` : `Cita reprogramada · ${hijo.name}`) : (en ? `Reschedule not possible · ${hijo.name}` : `No se pudo reprogramar · ${hijo.name}`),
          mensaje: aprobar
            ? (en ? `The center confirmed the new date: ${cuando}.` : `El centro confirmó la nueva fecha: ${cuando}.`)
            : (en ? `The center kept the original appointment: ${cuando}.` : `El centro mantuvo la cita original: ${cuando}.`),
        }
      }
    }
    if (status !== undefined) updates.status = status
    if (appointment_date !== undefined) updates.appointment_date = appointment_date
    if (appointment_time !== undefined) {
      const t = String(appointment_time)
      updates.appointment_time = t.length === 5 ? `${t}:00` : t
    }
    if (notes !== undefined) updates.notes = notes

    if (Object.keys(updates).length === 0) {
      throw new Error('No hay campos para actualizar')
    }

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    if (avisoFamilia) {
      const aprobada = body.reprogramacion === 'aprobar'
      await avisarFamilia({
        parentId: avisoFamilia.parentId, centroId: caller.centroId!, type: 'cita_reprogramacion_respuesta', childId: data.child_id,
        title: { es: avisoFamilia.titulo, en: avisoFamilia.titulo }, message: { es: avisoFamilia.mensaje, en: avisoFamilia.mensaje },
        push: aprobada
          ? { titulo: { es: '¡Listo! Tu cita tiene nueva fecha', en: 'Done! Your appointment has a new date' }, pose: 'celebra' }
          : { pose: 'pensando' },
        metadata: { appointment_id: id },
      })
      if (aprobada) after(() => Promise.all([enviarCorreoCitaFamilia(data, 'actualizada', getLocaleFromRequest(request) === 'en'), avisarEspecialistaCita(data, 'actualizada', caller.id)]))
    } else if (status === 'cancelled') {
      after(() => Promise.all([avisarCitaFamilia(data, 'cancelada'), enviarCorreoCitaFamilia(data, 'cancelada', getLocaleFromRequest(request) === 'en'), avisarEspecialistaCita(data, 'cancelada', caller.id)]))
    } else if (appointment_date !== undefined || appointment_time !== undefined) {
      after(() => Promise.all([avisarCitaFamilia(data, 'actualizada'), enviarCorreoCitaFamilia(data, 'actualizada', getLocaleFromRequest(request) === 'en'), avisarEspecialistaCita(data, 'actualizada', caller.id)]))
    }

    // ── Calendarios externos (Google / Outlook): mover o borrar el evento según el cambio ──
    const timeChanged = appointment_date !== undefined || appointment_time !== undefined
    const cancelada = status === 'cancelled' || status === 'cancelada'
    const calendarSync = cancelada
      ? await sincronizarCalendarios(id, 'cancelar')
      : timeChanged ? await sincronizarCalendarios(id, 'actualizar') : null

    return NextResponse.json({ data, calendarSync: calendarSync ?? undefined })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const { id } = await request.json()
    if (!(await rowInCentro('appointments', id, caller.centroId))) return notFound()
    const locale = request.headers.get('x-locale') || 'es'

    // 1. Leer la cita ANTES de borrarla — necesitamos los event IDs y el especialista
    const { data: apt } = await supabaseAdmin
      .from('appointments')
      .select('id, google_calendar_event_id, microsoft_calendar_event_id, parent_google_calendar_event_id, parent_microsoft_calendar_event_id, created_by, child_id, appointment_date, appointment_time, service_type, status, specialist_id, centro_id, modalidad')
      .eq('id', id)
      .single()

    // Si era una cita futura y activa, la familia recibe el aviso de cancelación
    if (apt && apt.status !== 'completed' && apt.status !== 'cancelled' && String(apt.appointment_date) >= new Date().toISOString().slice(0, 10)) {
      after(() => Promise.all([avisarCitaFamilia(apt, 'cancelada'), enviarCorreoCitaFamilia(apt, 'cancelada', getLocaleFromRequest(request) === 'en'), avisarEspecialistaCita(apt, 'cancelada', caller.id)]))
    }

    // 2. Quitar el evento de los calendarios conectados (centro y familia) antes de borrar la cita
    await sincronizarCalendarios(id, 'cancelar')

    // 6. Borrar la cita en DB
    const { error } = await supabaseAdmin.from('appointments').delete().eq('id', id).eq('centro_id', caller.centroId)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}
