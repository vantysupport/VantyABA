import { PLATFORM_NAME } from '@/lib/branding'
import { emailLayout, escHtml } from '@/lib/email-layout'
// lib/email.ts
// Envío de emails via Gmail SMTP + Nodemailer v8
// Variables requeridas: GMAIL_USER, GMAIL_PASS (contraseña de aplicación de 16 chars)

import { createTransport } from 'nodemailer'

function getTransporter() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_PASS?.replace(/\s/g, '') // quita espacios de la app password
  if (!user || !pass) {
    console.log('[Email] GMAIL_USER / GMAIL_PASS no configurados — omitido')
    return null
  }
  // Nodemailer v8: usar SMTP directo, NO service:'gmail' (fue eliminado en v8)
  return createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  })
}

// ── Envío base ────────────────────────────────────────────────────────────────
export type EmailAttachment = { filename: string; content: string | Buffer; contentType: string }

/** `fromName`: display name of the sender — the center's name (getCentroBranding().name). */
export async function sendEmail(to: string, subject: string, html: string, fromName: string, attachments?: EmailAttachment[]): Promise<boolean> {
  const transporter = getTransporter()
  if (!transporter) return false
  try {
    await transporter.sendMail({
      from: `"${fromName.replace(/"/g, '')}" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
      ...(attachments?.length ? { attachments } : {}),
    })
    console.log(`[Email] ✅ Enviado → ${to}`)
    return true
  } catch (e) {
    console.error('[Email] Error enviando:', e)
    return false
  }
}

// ── Templates (plantilla común en lib/email-layout) ───────────────────────────
// `en`: idioma de quien originó el correo (la secretaría que agenda, la familia que reserva…)
interface CitaVars {
  paciente: string; fecha: string; hora: string
  servicio?: string; modalidad?: string; link?: string; secretaria?: string
}

// "2026-09-26" → "sábado, 26 de septiembre de 2026" / "Saturday, September 26, 2026"
function fmtFecha(fecha: string, en: boolean) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha
  const d = new Date(`${fecha}T12:00:00Z`)
  const txt = d.toLocaleDateString(en ? 'en-US' : 'es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

// Valores por defecto guardados en español → inglés
const EN_VALOR: Record<string, string> = { terapia: 'Therapy', presencial: 'In person', virtual: 'Online', secretaria: 'Front desk', 'secretaría': 'Front desk', paciente: 'Patient' }
const valor = (v: string, en: boolean) => (en ? EN_VALOR[v.trim().toLowerCase()] ?? v : v)

export function buildEmailCita(accion: 'nueva' | 'actualizada' | 'cancelada', vars: CitaVars, centroNombre: string, en = false) {
  const { fecha, hora, servicio = 'Terapia', modalidad = 'Presencial', link } = vars
  const L = (e: string, s: string) => (en ? e : s)
  const paciente = escHtml(vars.paciente)
  const titulos = {
    nueva: L('New appointment scheduled', 'Nueva cita programada'),
    actualizada: L('Your appointment changed', 'Tu cita cambió'),
    cancelada: L('Appointment cancelled', 'Cita cancelada'),
  }
  const asuntos = {
    nueva: L(`New appointment for ${vars.paciente}`, `Nueva cita para ${vars.paciente}`),
    actualizada: L(`Appointment updated for ${vars.paciente}`, `Cita actualizada de ${vars.paciente}`),
    cancelada: L(`Appointment cancelled for ${vars.paciente}`, `Cita cancelada de ${vars.paciente}`),
  }
  const mensajes = {
    nueva: L(`We scheduled a new appointment for <strong>${paciente}</strong>. Here are the details:`, `Programamos una nueva cita para <strong>${paciente}</strong>. Estos son los detalles:`),
    actualizada: L(`We updated the appointment details for <strong>${paciente}</strong>. Please review the new information:`, `Actualizamos los datos de la cita de <strong>${paciente}</strong>. Revisa la nueva información:`),
    cancelada: L(`The appointment for <strong>${paciente}</strong> was cancelled. Contact the center to reschedule.`, `La cita de <strong>${paciente}</strong> fue cancelada. Contacta al centro para reprogramarla.`),
  }
  const subject = `${asuntos[accion]} · ${centroNombre}`
  const html = emailLayout({
    locale: en ? 'en' : 'es', subject, eyebrow: escHtml(centroNombre), title: titulos[accion], intro: mensajes[accion],
    tono: accion === 'cancelada' ? 'alerta' : 'normal',
    detalles: [
      { label: L('Patient', 'Paciente'), value: paciente },
      { label: L('Date', 'Fecha'), value: escHtml(fmtFecha(fecha, en)) },
      { label: L('Time', 'Hora'), value: escHtml(hora) },
      { label: L('Service', 'Servicio'), value: escHtml(valor(servicio, en)) },
      { label: L('Format', 'Modalidad'), value: escHtml(valor(modalidad, en)) },
      ...(link && accion !== 'cancelada' ? [{ label: L('Video call', 'Videollamada'), value: `<a href="${escHtml(link)}" style="display:inline-block;padding:8px 16px;border-radius:999px;background:#0069db;background-image:linear-gradient(135deg,#01abfc 0%,#0063d8 100%);color:#ffffff;font-size:13px;font-weight:600;text-decoration:none">${L('Join video call', 'Unirse a la videollamada')} &rarr;</a>` }] : []),
    ],
    note: accion === 'cancelada'
      ? L('If you have questions, please contact the center directly.', 'Si tienes preguntas, comunícate directamente con el centro.')
      : L(`You can see all the details in your ${PLATFORM_NAME} ABA portal.`, `Puedes ver todos los detalles en tu portal de ${PLATFORM_NAME} ABA.`),
    aria: accion === 'cancelada' ? 'pensando' : 'cita',
    ariaDice: accion === 'nueva' ? L('See you soon!', '¡Nos vemos pronto!') : undefined,
  })
  return { subject, html }
}

/** One email per online booking (a family may book several slots at once), for the family or for the center's staff. */
export function buildEmailReservaOnline(
  audience: 'familia' | 'centro',
  vars: {
    paciente: string; servicio?: string; modalidad?: string; especialista?: string | null
    citas: { fecha: string; hora: string; googleUrl?: string; outlookUrl?: string; videoLink?: string }[]
  },
  centroNombre: string,
  en = false,
) {
  const L = (e: string, s: string) => (en ? e : s)
  const paciente = escHtml(vars.paciente)
  const n = vars.citas.length
  const citasTxt = en ? `${n} appointment${n === 1 ? '' : 's'}` : `${n} cita${n === 1 ? '' : 's'}`
  const subject = audience === 'familia'
    ? L(`Booking confirmed for ${vars.paciente}`, `Reserva confirmada de ${vars.paciente}`) + ` · ${centroNombre}`
    : L(`New online booking (${citasTxt}) for ${vars.paciente}`, `Nueva reserva online (${citasTxt}) de ${vars.paciente}`) + ` · ${centroNombre}`
  const intro = audience === 'familia'
    ? L(`Your booking for <strong>${paciente}</strong> is confirmed. These are your appointments:`, `Tu reserva para <strong>${paciente}</strong> quedó confirmada. Estas son tus citas:`)
    : L(`The family of <strong>${paciente}</strong> booked ${citasTxt} through the online booking link:`, `La familia de <strong>${paciente}</strong> reservó ${citasTxt} desde el enlace de reservas online:`)
  const calLink = (href: string, label: string) =>
    `<a href="${escHtml(href)}" style="display:inline-block;margin:6px 6px 0 0;padding:5px 12px;border-radius:999px;background:#e6f3ff;color:#0069db;font-size:12px;font-weight:600;text-decoration:none">${label}</a>`
  // Cita virtual: botón directo a la videollamada
  const videoBtn = (href: string) =>
    `<a href="${escHtml(href)}" style="display:inline-block;margin:8px 0 2px;padding:8px 16px;border-radius:999px;background:#0069db;background-image:linear-gradient(135deg,#01abfc 0%,#0063d8 100%);color:#ffffff;font-size:13px;font-weight:600;text-decoration:none">${L('Join video call', 'Unirse a la videollamada')} &rarr;</a>`
  const virtual = vars.citas.some(c => c.videoLink)
  const html = emailLayout({
    locale: en ? 'en' : 'es', subject, eyebrow: escHtml(centroNombre),
    title: audience === 'familia' ? L('Booking confirmed', 'Reserva confirmada') : L('New online booking', 'Nueva reserva online'),
    intro,
    detalles: [
      ...vars.citas.map((c, i) => ({
        label: n > 1 ? L(`Appointment ${i + 1}`, `Cita ${i + 1}`) : L('Date and time', 'Fecha y hora'),
        value: `${escHtml(fmtFecha(c.fecha, en))} · ${escHtml(c.hora)}${c.videoLink ? `<br>${videoBtn(c.videoLink)}` : ''}${audience === 'familia' && (c.googleUrl || c.outlookUrl)
          ? `<br>${c.googleUrl ? calLink(c.googleUrl, '+ Google Calendar') : ''}${c.outlookUrl ? calLink(c.outlookUrl, '+ Outlook') : ''}` : ''}`,
      })),
      { label: L('Service', 'Servicio'), value: escHtml(valor(vars.servicio || 'Terapia', en)) },
      { label: L('Format', 'Modalidad'), value: escHtml(valor(vars.modalidad || 'Presencial', en)) },
      ...(vars.especialista ? [{ label: L('Specialist', 'Especialista'), value: escHtml(vars.especialista) }] : []),
    ],
    note: (virtual ? L('Use the video call button a few minutes before the appointment; the link is also in your calendar and your portal. ', 'Usa el botón de videollamada unos minutos antes de la cita; el enlace también queda en tu calendario y en tu portal. ') : '') + (audience === 'familia'
      ? L(`We attached <strong>citas.ics</strong>: open it to add every appointment to your calendar (Google, Outlook or iPhone). You can also see them in your ${PLATFORM_NAME} ABA portal.`,
          `Adjuntamos el archivo <strong>citas.ics</strong>: ábrelo para agregar todas las citas a tu calendario (Google, Outlook o iPhone). También puedes verlas en tu portal de ${PLATFORM_NAME} ABA.`)
      : L(`The appointments are already in the center's schedule in ${PLATFORM_NAME} ABA.`, `Las citas ya están en la agenda del centro en ${PLATFORM_NAME} ABA.`)),
    aria: audience === 'familia' ? 'celebra' : 'cita',
    ariaDice: audience === 'familia' ? L('All set!', '¡Todo listo!') : undefined,
  })
  return { subject, html }
}

export function buildEmailAdmin(accion: 'nueva' | 'actualizada' | 'cancelada', vars: CitaVars, centroNombre: string, en = false) {
  const { paciente, fecha, hora, servicio = 'Terapia', secretaria = 'Secretaría' } = vars
  const L = (e: string, s: string) => (en ? e : s)
  const labels = {
    nueva: L('New appointment created', 'Nueva cita creada'),
    actualizada: L('Appointment updated', 'Cita actualizada'),
    cancelada: L('Appointment cancelled', 'Cita cancelada'),
  }
  const subject = `${labels[accion]}: ${paciente} · ${centroNombre}`
  const html = emailLayout({
    locale: en ? 'en' : 'es', subject, eyebrow: escHtml(centroNombre), title: labels[accion],
    intro: L(`<strong>${escHtml(valor(secretaria, en))}</strong> made a change to the center's schedule:`, `<strong>${escHtml(secretaria)}</strong> realizó un cambio en la agenda del centro:`),
    tono: accion === 'cancelada' ? 'alerta' : 'normal',
    detalles: [
      { label: L('Patient', 'Paciente'), value: escHtml(paciente) },
      { label: L('Date', 'Fecha'), value: escHtml(fmtFecha(fecha, en)) },
      { label: L('Time', 'Hora'), value: escHtml(hora) },
      { label: L('Service', 'Servicio'), value: escHtml(valor(servicio, en)) },
    ],
    note: L(`Review the details in the ${PLATFORM_NAME} ABA admin panel.`, `Revisa los detalles en el panel de administración de ${PLATFORM_NAME} ABA.`),
    aria: accion === 'cancelada' ? 'pensando' : 'laptop',
  })
  return { subject, html }
}

// ── Cambio de contraseña (enviado desde Usuarios) ─────────────────────────────
export function buildEmailReset(link: string, centroNombre: string, en = false) {
  const centro = escHtml(centroNombre)
  const subject = en ? `Change your password · ${centroNombre}` : `Cambia tu contraseña · ${centroNombre}`
  const html = emailLayout({
    locale: en ? 'en' : 'es', subject, eyebrow: centro,
    title: en ? 'Change your password' : 'Cambia tu contraseña',
    intro: en
      ? `The administrator of <strong>${centro}</strong> sent you this link so you can set a new password for your account.`
      : `El administrador de <strong>${centro}</strong> te envió este enlace para que elijas una nueva contraseña para tu cuenta.`,
    cta: { href: link, label: en ? 'Set new password' : 'Elegir nueva contraseña' },
    note: en
      ? 'The link works only once and expires in 1 hour. If you did not expect this email, you can ignore it: your current password will keep working.'
      : 'El enlace sirve una sola vez y vence en 1 hora. Si no esperabas este correo, puedes ignorarlo: tu contraseña actual seguirá funcionando.',
    aria: 'laptop',
  })
  return { subject, html }
}
