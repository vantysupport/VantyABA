// Correo a la familia cuando el centro crea, mueve o cancela una cita (plantilla con ARIA de lib/email).
// Lo usan la Agenda del admin y la de secretaría, así el padre recibe el mismo aviso venga de donde venga.
// Nunca lanza.

import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCentroBranding } from '@/lib/centro-branding'
import { sendEmail, buildEmailCita } from '@/lib/email'
import { emailLayout, escHtml } from '@/lib/email-layout'
import { avisarEquipo, centroEnIngles } from '@/lib/avisos'

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

/**
 * Aviso al especialista asignado cuando otra persona (admin, jefe o secretaría) le crea, mueve o cancela
 * una cita: correo + campana + push. No se avisa a quien hizo el cambio.
 */
export async function avisarEspecialistaCita(
  apt: { id?: string; child_id?: string | null; specialist_id?: string | null; centro_id?: string | null; appointment_date?: string | null; appointment_time?: string | null; service_type?: string | null; modalidad?: string | null; video_link?: string | null },
  tipo: 'nueva' | 'actualizada' | 'cancelada',
  actorId: string | null,
) {
  try {
    const ids = String(apt.specialist_id ?? '').split(',').map(s => s.trim()).filter(Boolean).filter(id => id !== actorId)
    if (!ids.length || !apt.appointment_date) return
    const [{ data: nino }, { data: perfiles }] = await Promise.all([
      apt.child_id ? supabaseAdmin.from('children').select('name, centro_id').eq('id', apt.child_id).maybeSingle() : Promise.resolve({ data: null }),
      supabaseAdmin.from('profiles').select('id, email, google_calendar_email, microsoft_calendar_email, centro_id').in('id', ids),
    ])
    const centroId = apt.centro_id || nino?.centro_id || perfiles?.[0]?.centro_id
    if (!centroId) return
    const centro = await getCentroBranding({ centroId })
    const en = await centroEnIngles(centroId)
    const L = (e: string, s: string) => (en ? e : s)
    const paciente = nino?.name || L('a patient', 'un paciente')
    const hora = String(apt.appointment_time ?? '').slice(0, 5)
    const d = new Date(`${apt.appointment_date}T12:00:00Z`)
    const dia = d.toLocaleDateString(en ? 'en-US' : 'es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    const virtual = apt.modalidad === 'virtual'

    const T = {
      nueva: { titulo: L('New appointment on your schedule', 'Nueva cita en tu agenda'), corto: L(`New: ${paciente}, ${dia} at ${hora}`, `Nueva: ${paciente}, ${dia} a las ${hora}`), pose: 'cita' as const },
      actualizada: { titulo: L('An appointment was rescheduled', 'Se movió una cita'), corto: L(`${paciente} now: ${dia} at ${hora}`, `${paciente} ahora: ${dia} a las ${hora}`), pose: 'pensando' as const },
      cancelada: { titulo: L('An appointment was cancelled', 'Se canceló una cita'), corto: L(`${paciente}, ${dia} at ${hora} was cancelled`, `Se canceló ${paciente}, ${dia} a las ${hora}`), pose: 'pensando' as const },
    }[tipo]

    // Campana + push
    await avisarEquipo({
      centroId, roles: [], extra: ids, tipo: `cita_especialista_${tipo}`, childId: apt.child_id ?? null, prioridad: tipo === 'cancelada' ? 1 : 2,
      titulo: { es: T.titulo, en: T.titulo }, mensaje: { es: T.corto, en: T.corto },
      push: { pose: tipo === 'nueva' ? 'celebra' : 'pensando' },
      metadata: { appointment_id: apt.id ?? null },
    })

    // Correo
    const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
    const html = emailLayout({
      locale: en ? 'en' : 'es', subject: `${T.titulo} · ${paciente}`, preheader: T.corto, eyebrow: centro.name,
      title: T.titulo, intro: T.corto + '.', aria: T.pose, tono: tipo === 'cancelada' ? 'alerta' : 'normal',
      detalles: [
        { label: L('Patient', 'Paciente'), value: escHtml(paciente) },
        { label: L('Date', 'Fecha'), value: escHtml(dia) },
        { label: L('Time', 'Hora'), value: escHtml(hora) },
        { label: L('Service', 'Servicio'), value: escHtml(apt.service_type || L('Therapy', 'Terapia')) },
        { label: L('Format', 'Modalidad'), value: virtual ? L('Online', 'Virtual') : L('In person', 'Presencial') },
      ],
      ...(base && tipo !== 'cancelada' ? { cta: { href: `${base}/especialista?vista=agenda`, label: L('Open my schedule', 'Ver mi agenda') } } : {}),
    })
    for (const p of perfiles ?? []) {
      const correo = p.email && !p.email.includes('@prueba') ? p.email : (p.google_calendar_email || p.microsoft_calendar_email || null)
      if (correo) await sendEmail(correo, `${T.titulo} · ${paciente}`, html, centro.name)
    }
  } catch (e) {
    console.error('[cita-especialista]', e)
  }
}
