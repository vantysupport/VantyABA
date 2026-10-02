import 'server-only'
// Especialistas asignados a una cita que deben recibirla como invitación en su calendario personal
// (el evento vive en el calendario de una sola persona; los demás la reciben como invitados).

import { supabaseAdmin } from '@/lib/supabase-admin'

export type Invitado = { email: string; nombre: string }

/** Correos de los especialistas asignados a la cita, sin incluir al dueño del calendario. */
export async function especialistasInvitados(
  appointmentId: string | null | undefined,
  ownerId: string,
  specialistHint?: string | null,
): Promise<Invitado[]> {
  try {
    let asignados = specialistHint ?? null
    if (!asignados && appointmentId) {
      const { data } = await supabaseAdmin.from('appointments').select('specialist_id').eq('id', appointmentId).maybeSingle()
      asignados = (data?.specialist_id as string | null) ?? null
    }
    const ids = [...new Set(String(asignados ?? '').split(',').map(s => s.trim()).filter(id => /^[0-9a-f-]{36}$/i.test(id) && id !== ownerId))]
    if (!ids.length) return []
    const { data: perfiles } = await supabaseAdmin.from('profiles')
      .select('full_name, email, google_calendar_email, microsoft_calendar_email').in('id', ids)
    return (perfiles ?? []).flatMap(p => {
      const email = p.google_calendar_email || p.microsoft_calendar_email || p.email
      return email ? [{ email: String(email), nombre: p.full_name || 'Especialista' }] : []
    })
  } catch {
    return []
  }
}
