// Mantiene Google Calendar y Outlook al día cuando una cita cambia de fecha/hora o se cancela,
// desde cualquier panel (admin, secretaría, familia). Nunca lanza: un fallo de calendario no
// debe deshacer el cambio de la cita.
//
// El evento vive en el calendario de UNA persona. Se busca en este orden: la dueña guardada al
// crear el evento (metadata.gcal_owner / ms_owner), quien creó la cita, el especialista asignado y,
// si nada de eso, el primer jefe/admin del centro con el calendario conectado.

import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { internalApiHeaders } from '@/lib/calendar-integration'

type Resultado = { ok: boolean; updated?: boolean; created?: boolean; deleted?: boolean; skipped?: string; error?: string }
export type SyncCalendarios = { google: Resultado | null; microsoft: Resultado | null }

const base = () => process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

async function llamar(proveedor: 'google-calendar' | 'microsoft-calendar', body: Record<string, unknown>): Promise<Resultado> {
  try {
    const r = await fetch(`${base()}/api/${proveedor}`, { method: 'POST', headers: internalApiHeaders(), body: JSON.stringify(body) })
    return (await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))) as Resultado
  } catch (e: any) {
    return { ok: false, error: e?.message || 'fetch' }
  }
}

async function dueno(candidatos: (string | null | undefined)[], columna: 'google_calendar_token' | 'microsoft_calendar_token', centroId: string | null): Promise<string | null> {
  const ids = [...new Set(candidatos.flatMap(c => String(c ?? '').split(',')).map(s => s.trim()).filter(Boolean))]
  if (ids.length) {
    const { data } = await supabaseAdmin.from('profiles').select(`id, ${columna}`).in('id', ids)
    for (const id of ids) if ((data ?? []).find((p: any) => p.id === id && p[columna])) return id
  }
  if (!centroId) return null
  const { data: jefes } = await supabaseAdmin.from('profiles').select(`id, ${columna}`).eq('centro_id', centroId).in('role', ['jefe', 'admin'])
  return ((jefes ?? []).find((p: any) => p[columna]) as { id: string } | undefined)?.id ?? null
}

/** Refleja en los calendarios conectados el estado actual de la cita (movida o cancelada). */
export async function sincronizarCalendarios(appointmentId: string, accion: 'actualizar' | 'cancelar'): Promise<SyncCalendarios> {
  const salida: SyncCalendarios = { google: null, microsoft: null }
  try {
    const { data: a } = await supabaseAdmin.from('appointments')
      .select('id, centro_id, child_id, appointment_date, appointment_time, service_type, notes, modalidad, video_link, created_by, specialist_id, metadata, google_calendar_event_id, microsoft_calendar_event_id, parent_google_calendar_event_id, parent_microsoft_calendar_event_id, children(name, parent_id)')
      .eq('id', appointmentId).maybeSingle()
    if (!a) return salida
    const meta = (a.metadata ?? {}) as Record<string, any>
    const hijo = (a.children ?? null) as unknown as { name: string; parent_id: string | null } | null
    const hora = String(a.appointment_time ?? '').slice(0, 5)

    const cita = {
      date: a.appointment_date, time: hora, childId: a.child_id, patientName: hijo?.name || 'Paciente',
      serviceType: a.service_type, notes: a.notes, modality: a.modalidad, sessionType: 'individual', videoLink: a.video_link,
    }

    for (const [proveedor, clave, col, tokenCol, dueñoMeta] of [
      ['google-calendar', 'google', 'google_calendar_event_id', 'google_calendar_token', meta.gcal_owner],
      ['microsoft-calendar', 'microsoft', 'microsoft_calendar_event_id', 'microsoft_calendar_token', meta.ms_owner],
    ] as const) {
      const eventId = (a as any)[col] as string | null
      const owner = await dueno([dueñoMeta, a.created_by, a.specialist_id], tokenCol, a.centro_id)
      if (!owner) continue

      if (accion === 'cancelar') {
        if (!eventId) continue
        const r = await llamar(proveedor, { action: 'delete-event', userId: owner, eventId })
        if (r.ok) await supabaseAdmin.from('appointments').update({ [col]: null }).eq('id', a.id)
        salida[clave] = { ...r, deleted: r.ok }
      } else if (eventId) {
        const r = await llamar(proveedor, { action: 'update-event', userId: owner, eventId, appointment_date: a.appointment_date, appointment_time: hora, notifyAttendees: true })
        salida[clave] = { ...r, updated: r.ok && !r.skipped }
      } else {
        // La cita nunca se había llevado al calendario (creada antes de conectarlo, por reserva o por secretaría): se crea ahora
        const r = await llamar(proveedor, { action: 'sync-appointment', userId: owner, appointmentId: a.id, appointment: cita })
        salida[clave] = { ...r, created: r.ok }
      }
    }

    // Calendario propio de la familia (si lo conectó en su portal)
    if (accion === 'cancelar' && hijo?.parent_id) {
      if (a.parent_google_calendar_event_id) {
        const r = await llamar('google-calendar', { action: 'delete-event', userId: hijo.parent_id, eventId: a.parent_google_calendar_event_id })
        if (r.ok) await supabaseAdmin.from('appointments').update({ parent_google_calendar_event_id: null }).eq('id', a.id)
      }
      if (a.parent_microsoft_calendar_event_id) {
        const r = await llamar('microsoft-calendar', { action: 'delete-event', userId: hijo.parent_id, eventId: a.parent_microsoft_calendar_event_id })
        if (r.ok) await supabaseAdmin.from('appointments').update({ parent_microsoft_calendar_event_id: null }).eq('id', a.id)
      }
    } else if (accion === 'actualizar' && hijo?.parent_id) {
      if (a.parent_google_calendar_event_id) await llamar('google-calendar', { action: 'update-event', userId: hijo.parent_id, eventId: a.parent_google_calendar_event_id, appointment_date: a.appointment_date, appointment_time: hora, notifyAttendees: true })
      if (a.parent_microsoft_calendar_event_id) await llamar('microsoft-calendar', { action: 'update-event', userId: hijo.parent_id, eventId: a.parent_microsoft_calendar_event_id, appointment_date: a.appointment_date, appointment_time: hora })
    }
  } catch (e) {
    console.error('[calendar-sync]', e)
  }
  return salida
}
