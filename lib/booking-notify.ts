// After a family books through an online booking link: put each appointment on the center's
// connected calendar (Google or Outlook) and email the family and the center's staff.
// Never throws — a failed sync or email must not undo a confirmed booking.

import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCentroBranding } from '@/lib/centro-branding'
import { internalApiHeaders } from '@/lib/calendar-integration'
import { appBaseUrl } from '@/lib/auth-emails'
import { sendEmail, buildEmailReservaOnline } from '@/lib/email'
import { buildIcs, googleCalendarUrl, outlookCalendarUrl, type CalendarEvent } from '@/lib/ics'
import { avisarEquipo } from '@/lib/avisos'

type BookedAppointment = {
  id: string
  appointment_date: string
  appointment_time: string
  video_link?: string | null
}

type BookingContext = {
  centroId: string
  childId: string
  specialistId: string | null
  serviceType: string
  modalidad: string
  notes: string
  /** The patient's parent (may differ from who booked when staff books on the family's behalf). */
  parentUserId: string | null
  /** Address the family chose on the booking page for the confirmation + calendar invite. */
  inviteEmail: string | null
  /** Idioma de quien reservó: los correos salen en ese idioma */
  locale?: 'es' | 'en'
}

type CalendarOwner = { id: string; google_calendar_token: string | null; microsoft_calendar_token: string | null }

// Test accounts (@prueba) can't receive mail; fall back to the address of their connected calendar.
const deliverableEmail = (p: { email?: string | null; google_calendar_email?: string | null; microsoft_calendar_email?: string | null } | null) =>
  !p ? null : (p.email && !p.email.includes('@prueba') ? p.email : p.google_calendar_email || p.microsoft_calendar_email || null)

/** Calendar to write to: the link's specialist if they connected one, otherwise the first jefe/admin of the center who did. */
async function pickCalendarOwner(centroId: string, specialistId: string | null): Promise<CalendarOwner | null> {
  const cols = 'id, google_calendar_token, microsoft_calendar_token'
  if (specialistId) {
    const { data } = await supabaseAdmin.from('profiles').select(cols).eq('id', specialistId).eq('centro_id', centroId).maybeSingle()
    if (data && (data.google_calendar_token || data.microsoft_calendar_token)) return data
  }
  const { data: admins } = await supabaseAdmin.from('profiles').select(cols).in('role', ['jefe', 'admin']).eq('centro_id', centroId)
  return (admins || []).find(a => a.google_calendar_token || a.microsoft_calendar_token) ?? null
}

async function syncToCalendar(owner: CalendarOwner, apts: BookedAppointment[], ctx: BookingContext, childName: string) {
  const base = appBaseUrl()
  if (!base) return
  const provider = owner.google_calendar_token ? 'google-calendar' : 'microsoft-calendar'
  for (const apt of apts) {
    try {
      const res = await fetch(`${base}/api/${provider}`, {
        method: 'POST',
        headers: internalApiHeaders(),
        body: JSON.stringify({
          action: 'sync-appointment',
          userId: owner.id,
          appointmentId: apt.id,
          appointment: {
            date: apt.appointment_date,
            time: String(apt.appointment_time).slice(0, 5),
            patientName: childName,
            serviceType: ctx.serviceType,
            notes: ctx.notes,
            modality: ctx.modalidad,
            sessionType: 'individual',
            videoLink: apt.video_link || undefined,
            childId: ctx.childId,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.ok) console.error(`[booking] ${provider} sync failed:`, data.error)
    } catch (e) {
      console.error(`[booking] ${provider} sync error:`, e)
    }
  }
}

async function sendBookingEmails(apts: BookedAppointment[], ctx: BookingContext, childName: string) {
  const centro = await getCentroBranding({ centroId: ctx.centroId })
  const [{ data: parent }, { data: staff }, { data: specialist }] = await Promise.all([
    ctx.parentUserId
      ? supabaseAdmin.from('profiles').select('email, google_calendar_email, microsoft_calendar_email').eq('id', ctx.parentUserId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin.from('profiles').select('email, google_calendar_email, microsoft_calendar_email').in('role', ['jefe', 'admin']).eq('centro_id', ctx.centroId),
    ctx.specialistId
      ? supabaseAdmin.from('profiles').select('full_name, email, google_calendar_email, microsoft_calendar_email').eq('id', ctx.specialistId).eq('centro_id', ctx.centroId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const { data: config } = await supabaseAdmin
    .from('booking_config').select('session_duration_min').eq('centro_id', ctx.centroId)
    .order('updated_at', { ascending: false }).limit(1).maybeSingle()
  const durationMin = Number(config?.session_duration_min) || 45
  const events: CalendarEvent[] = apts.map(a => ({
    uid: a.id,
    date: a.appointment_date,
    time: String(a.appointment_time).slice(0, 5),
    durationMin,
    title: `${ctx.serviceType} — ${childName}`,
    description: `Cita en ${centro.name}${specialist?.full_name ? ` con ${specialist.full_name}` : ''}. Modalidad: ${ctx.modalidad === 'virtual' ? 'virtual' : 'presencial'}.${a.video_link ? `\nVideollamada: ${a.video_link}` : ''}`,
    location: ctx.modalidad === 'virtual' ? (a.video_link || undefined) : (centro.direccion || centro.name),
  }))

  const vars = {
    paciente: childName,
    citas: events.map((e, i) => ({ fecha: e.date, hora: e.time, googleUrl: googleCalendarUrl(e), outlookUrl: outlookCalendarUrl(e), videoLink: apts[i]?.video_link || undefined })),
    servicio: ctx.serviceType,
    modalidad: ctx.modalidad === 'virtual' ? 'Virtual' : 'Presencial',
    especialista: specialist?.full_name ?? null,
  }

  const familyEmail = ctx.inviteEmail || deliverableEmail(parent)
  if (familyEmail) {
    const { subject, html } = buildEmailReservaOnline('familia', vars, centro.name, ctx.locale === 'en')
    await sendEmail(familyEmail, subject, html, centro.name, [
      { filename: 'citas.ics', content: buildIcs(events, centro.name), contentType: 'text/calendar; charset=utf-8; method=PUBLISH' },
    ])
  }

  // Center side: specialist, jefes/admins and the center's contact inbox — each address once.
  const staffEmails = new Set<string>()
  for (const p of [specialist, ...(staff || [])]) {
    const e = deliverableEmail(p)
    if (e) staffEmails.add(e.toLowerCase())
  }
  if (centro.email) staffEmails.add(centro.email.toLowerCase())
  staffEmails.delete(familyEmail?.toLowerCase() ?? '')
  if (staffEmails.size > 0) {
    const { subject, html } = buildEmailReservaOnline('centro', vars, centro.name, ctx.locale === 'en')
    for (const to of staffEmails) await sendEmail(to, subject, html, centro.name)
  }
}

/** Aviso en la campana del centro (dirección, secretaría y el especialista de la reserva). */
async function avisarReserva(apts: BookedAppointment[], ctx: BookingContext, childName: string) {
  const primera = apts[0]
  const cuando = `${primera.appointment_date} ${String(primera.appointment_time).slice(0, 5)}`
  const mas = apts.length > 1 ? apts.length - 1 : 0
  const virtual = ctx.modalidad === 'virtual'
  await avisarEquipo({
    centroId: ctx.centroId, roles: ['jefe', 'admin', 'secretaria'], extra: [ctx.specialistId],
    tipo: 'reserva_online', childId: ctx.childId, prioridad: 1,
    titulo: { es: `Reserva online · ${childName}`, en: `Online booking · ${childName}` },
    mensaje: {
      es: `${ctx.serviceType} · ${cuando}${mas ? ` y ${mas} cita${mas > 1 ? 's' : ''} más` : ''} · ${virtual ? 'Virtual' : 'Presencial'}.`,
      en: `${ctx.serviceType} · ${cuando}${mas ? ` and ${mas} more` : ''} · ${virtual ? 'Online' : 'In person'}.`,
    },
    metadata: { appointment_ids: apts.map(a => a.id) },
  })
}

export async function notifyOnlineBooking(apts: BookedAppointment[], ctx: BookingContext): Promise<void> {
  if (apts.length === 0) return
  try {
    const { data: child } = await supabaseAdmin.from('children').select('name').eq('id', ctx.childId).maybeSingle()
    const childName = child?.name || 'Paciente'
    const owner = await pickCalendarOwner(ctx.centroId, ctx.specialistId)
    await Promise.all([
      owner ? syncToCalendar(owner, apts, ctx, childName) : Promise.resolve(),
      sendBookingEmails(apts, ctx, childName),
      avisarReserva(apts, ctx, childName),
    ])
  } catch (e) {
    console.error('[booking] notify error:', e)
  }
}
