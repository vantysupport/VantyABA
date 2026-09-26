import { getLocaleFromRequest } from '@/lib/lang'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, canAccessChild, rowInCentro, unauthorized, forbidden, notFound } from '@/lib/api-auth'
import { notifyAsync, notifyParentDirect } from '@/lib/notifications'
import { getCentroBranding } from '@/lib/centro-branding'
import { internalApiHeaders } from '@/lib/calendar-integration'
import { after } from 'next/server'
import { avisarCitaFamilia, avisarFamilia } from '@/lib/avisos'

// Helper: notificar al padre de un paciente
async function notificarPadre(childId: string, tipo: 'cita_confirmada' | 'cita_cancelada', vars: Record<string, string>) {
  try {
    const centro = await getCentroBranding({ childId })
    const { data: parentLink } = await supabaseAdmin
      .from('parent_accounts').select('user_id').eq('child_id', childId).maybeSingle()
    if (parentLink?.user_id) {
      const { data: parentProf } = await supabaseAdmin
        .from('profiles').select('phone').eq('id', parentLink.user_id).maybeSingle()
      if ((parentProf as any)?.phone) {
        await notifyParentDirect((parentProf as any).phone, tipo, vars, centro)
      }
    }
    // También notificar al admin del centro
    await notifyAsync({ tipo, vars, centro })
  } catch (err) {
    console.error('[notificarPadre] Error:', err)
  }
}

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

    // Notificar al padre — fire-and-forget para no bloquear la respuesta al cliente
    // (cada notificación puede tardar hasta 8 s por el timeout de Baileys)
    Promise.all(
      (data || []).map((apt: any) => {
        if (!apt.child_id) return Promise.resolve()
        const childName = apt.children?.name || 'Paciente'
        const fecha     = apt.appointment_date || ''
        const hora      = apt.appointment_time || ''
        const modalidad = apt.modalidad === 'virtual' ? 'Virtual 📹' : (apt.appointment_type || 'Presencial')
        const videoLink = apt.video_link || apt.videoLink || null
        return notificarPadre(apt.child_id, 'cita_confirmada', {
          fecha, hora, paciente: childName, tipo: modalidad,
          ...(videoLink ? { link: videoLink } : {}),
        })
      })
    ).catch(err => console.error('[notif fire-and-forget]', err))

    // Aviso en el portal y en el celular de cada familia
    after(() => Promise.all((data || []).map((apt: any) => avisarCitaFamilia(apt, 'nueva'))))

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
    } else if (status === 'cancelled') {
      after(() => avisarCitaFamilia(data, 'cancelada'))
    } else if (appointment_date !== undefined || appointment_time !== undefined) {
      after(() => avisarCitaFamilia(data, 'actualizada'))
    }

    // ── Sincronizar cambio de fecha/hora con calendarios externos ──
    const timeChanged = appointment_date !== undefined || appointment_time !== undefined
    let calendarSync: any = { google: null, microsoft: null, parentGoogle: null, parentMicrosoft: null }

    if (timeChanged) {
      const newDate = appointment_date ?? data.appointment_date
      const newTime = (appointment_time ?? data.appointment_time)
      const timeOnly = String(newTime).slice(0, 5)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      // Cargar event IDs y owners
      const { data: apt } = await supabaseAdmin
        .from('appointments')
        .select('google_calendar_event_id, microsoft_calendar_event_id, parent_google_calendar_event_id, parent_microsoft_calendar_event_id, created_by, child_id')
        .eq('id', id)
        .single()

      // 1. Google del especialista/admin
      if (apt?.google_calendar_event_id && apt?.created_by) {
        try {
          const r = await fetch(`${baseUrl}/api/google-calendar`, {
            method: 'POST',
            headers: internalApiHeaders(),
            body: JSON.stringify({
              action: 'update-event',
              userId: apt.created_by,
              eventId: apt.google_calendar_event_id,
              appointment_date: newDate,
              appointment_time: timeOnly,
              notifyAttendees: true,
            }),
          })
          calendarSync.google = await r.json().catch(() => null)
        } catch (e: any) { calendarSync.google = { error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : (e?.message || "error") } }
      }

      // 2. Microsoft del especialista/admin
      if (apt?.microsoft_calendar_event_id && apt?.created_by) {
        try {
          const r = await fetch(`${baseUrl}/api/microsoft-calendar`, {
            method: 'POST',
            headers: internalApiHeaders(),
            body: JSON.stringify({
              action: 'update-event',
              userId: apt.created_by,
              eventId: apt.microsoft_calendar_event_id,
              appointment_date: newDate,
              appointment_time: timeOnly,
            }),
          })
          calendarSync.microsoft = await r.json().catch(() => null)
        } catch (e: any) { calendarSync.microsoft = { error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : (e?.message || "error") } }
      }

      // 3. Google del PADRE
      if (apt?.parent_google_calendar_event_id && apt?.child_id) {
        try {
          const { data: child } = await supabaseAdmin
            .from('children').select('parent_id').eq('id', apt.child_id).single()
          if (child?.parent_id) {
            const r = await fetch(`${baseUrl}/api/google-calendar`, {
              method: 'POST',
              headers: internalApiHeaders(),
              body: JSON.stringify({
                action: 'update-event',
                userId: child.parent_id,
                eventId: apt.parent_google_calendar_event_id,
                appointment_date: newDate,
                appointment_time: timeOnly,
                notifyAttendees: true,
              }),
            })
            calendarSync.parentGoogle = await r.json().catch(() => null)
          }
        } catch (e: any) { calendarSync.parentGoogle = { error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : (e?.message || "error") } }
      }

      // 4. Microsoft del PADRE
      if (apt?.parent_microsoft_calendar_event_id && apt?.child_id) {
        try {
          const { data: child } = await supabaseAdmin
            .from('children').select('parent_id').eq('id', apt.child_id).single()
          if (child?.parent_id) {
            const r = await fetch(`${baseUrl}/api/microsoft-calendar`, {
              method: 'POST',
              headers: internalApiHeaders(),
              body: JSON.stringify({
                action: 'update-event',
                userId: child.parent_id,
                eventId: apt.parent_microsoft_calendar_event_id,
                appointment_date: newDate,
                appointment_time: timeOnly,
              }),
            })
            calendarSync.parentMicrosoft = await r.json().catch(() => null)
          }
        } catch (e: any) { calendarSync.parentMicrosoft = { error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : (e?.message || "error") } }
      }
    }

    return NextResponse.json({ data, calendarSync: timeChanged ? calendarSync : undefined })
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
      .select('id, google_calendar_event_id, microsoft_calendar_event_id, parent_google_calendar_event_id, parent_microsoft_calendar_event_id, created_by, child_id, appointment_date, appointment_time, service_type, status')
      .eq('id', id)
      .single()

    // Si era una cita futura y activa, la familia recibe el aviso de cancelación
    if (apt && apt.status !== 'completed' && apt.status !== 'cancelled' && String(apt.appointment_date) >= new Date().toISOString().slice(0, 10)) {
      after(() => avisarCitaFamilia(apt, 'cancelada'))
    }

    // 2. Borrar en Google Calendar si hay event ID
    if (apt?.google_calendar_event_id && apt?.created_by) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/google-calendar`, {
          method: 'POST',
          headers: internalApiHeaders(),
          body: JSON.stringify({
            action:  'delete-event',
            userId:  apt.created_by,
            eventId: apt.google_calendar_event_id,
          }),
        })
      } catch { /* silent — no bloquear el borrado de DB */ }
    }

    // 3. Borrar en Microsoft Calendar si hay event ID
    if (apt?.microsoft_calendar_event_id && apt?.created_by) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/microsoft-calendar`, {
          method: 'POST',
          headers: internalApiHeaders(),
          body: JSON.stringify({
            action:  'delete-event',
            userId:  apt.created_by,
            eventId: apt.microsoft_calendar_event_id,
          }),
        })
      } catch { /* silent */ }
    }

    // 4. Borrar eventos del PADRE en Google Calendar
    if (apt?.parent_google_calendar_event_id && apt?.child_id) {
      try {
        // Buscar parent_id del niño
        const { data: child } = await supabaseAdmin
          .from('children').select('parent_id').eq('id', apt.child_id).single()
        if (child?.parent_id) {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/google-calendar`, {
            method: 'POST',
            headers: internalApiHeaders(),
            body: JSON.stringify({
              action:  'delete-event',
              userId:  child.parent_id,
              eventId: apt.parent_google_calendar_event_id,
            }),
          })
        }
      } catch { /* silent */ }
    }

    // 5. Borrar eventos del PADRE en Microsoft Calendar
    if (apt?.parent_microsoft_calendar_event_id && apt?.child_id) {
      try {
        const { data: child } = await supabaseAdmin
          .from('children').select('parent_id').eq('id', apt.child_id).single()
        if (child?.parent_id) {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/microsoft-calendar`, {
            method: 'POST',
            headers: internalApiHeaders(),
            body: JSON.stringify({
              action:  'delete-event',
              userId:  child.parent_id,
              eventId: apt.parent_microsoft_calendar_event_id,
            }),
          })
        }
      } catch { /* silent */ }
    }

    // 5b. Notificar al padre SOLO si la cita no estaba ya completada/realizada
    // (borrar un historial completado no debe generar "cita cancelada")
    if (apt?.child_id) {
      try {
        const { data: childData } = await supabaseAdmin
          .from('appointments')
          .select('appointment_date, appointment_time, appointment_type, status, children(name)')
          .eq('id', id).maybeSingle()
        const aptStatus = (childData as any)?.status || ''
        const esCompletada = ['completed', 'realizada', 'done', 'completada'].includes(aptStatus)
        if (!esCompletada) {
          const childName = (childData as any)?.children?.name || 'Paciente'
          notificarPadre(apt.child_id, 'cita_cancelada', {
            fecha:    (childData as any)?.appointment_date || '',
            hora:     (childData as any)?.appointment_time || '',
            paciente: childName,
          })
        }
      } catch { /* silent */ }
    }

    // 6. Borrar la cita en DB
    const { error } = await supabaseAdmin.from('appointments').delete().eq('id', id).eq('centro_id', caller.centroId)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}
