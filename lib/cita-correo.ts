// Correo a la familia cuando el centro crea, mueve o cancela una cita (plantilla con ARIA de lib/email).
// Lo usan la Agenda del admin y la de secretaría, así el padre recibe el mismo aviso venga de donde venga.
// Nunca lanza.

import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCentroBranding } from '@/lib/centro-branding'
import { sendEmail, buildEmailCita } from '@/lib/email'

export async function enviarCorreoCitaFamilia(
  apt: { child_id?: string | null; appointment_date?: string | null; appointment_time?: string | null; service_type?: string | null; modalidad?: string | null; video_link?: string | null },
  tipo: 'nueva' | 'actualizada' | 'cancelada',
  en = false,
) {
  try {
    if (!apt.child_id) return
    const { data: child } = await supabaseAdmin.from('children').select('name, parent_id').eq('id', apt.child_id).maybeSingle()
    if (!child?.parent_id) return
    const { data: p } = await supabaseAdmin.from('profiles').select('email, google_calendar_email, microsoft_calendar_email').eq('id', child.parent_id).maybeSingle()
    // Las cuentas de prueba (@prueba) no reciben correo: se usa el del calendario conectado si existe
    const correo = p?.email && !p.email.includes('@prueba') ? p.email : (p?.google_calendar_email || p?.microsoft_calendar_email || null)
    if (!correo) return
    const centro = await getCentroBranding({ childId: apt.child_id })
    const vars = {
      paciente: child.name || (en ? 'your child' : 'su hijo/a'),
      fecha: apt.appointment_date || '',
      hora: String(apt.appointment_time ?? '').slice(0, 5),
      servicio: apt.service_type || (en ? 'Therapy' : 'Terapia'),
      modalidad: apt.modalidad || 'Presencial',
      ...(apt.video_link ? { link: apt.video_link } : {}),
    }
    const { subject, html } = buildEmailCita(tipo, vars, centro.name, en)
    await sendEmail(correo, subject, html, centro.name)
  } catch (e) {
    console.error('[cita-correo]', e)
  }
}
