'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { appBaseUrl, authMailConfigured, createUserWithConfirmationEmail } from '@/lib/auth-emails'
import { liberarCorreoHuerfano } from '@/lib/cuenta-huerfana'
import { aplicarInvitacion, invitacionPorToken, validarInvitacion, type ErrorInvitacion } from '@/lib/invitaciones'

export type AceptarState = {
  error?: ErrorInvitacion | 'required' | 'email' | 'password' | 'mismatch' | 'terms' | 'emailTaken' | 'mail'
  ok?: boolean
  email?: string
  /** Lo que la persona escribió, para no vaciar el formulario cuando hay un error. */
  values?: { fullName: string; email: string; phone: string; specialty: string }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const text = (f: FormData, k: string, max = 200) => String(f.get(k) ?? '').trim().slice(0, max)

export async function aceptarInvitacion(_prev: AceptarState, formData: FormData): Promise<AceptarState> {
  const r = await procesar(formData)
  if (r.ok) return r
  return { ...r, values: { fullName: text(formData, 'fullName', 120), email: text(formData, 'email', 200), phone: text(formData, 'phone', 40), specialty: text(formData, 'specialty', 80) } }
}

async function procesar(formData: FormData): Promise<AceptarState> {
  const token = text(formData, 'token', 80)
  const fullName = text(formData, 'fullName', 120)
  const email = text(formData, 'email', 200).toLowerCase()
  const phone = text(formData, 'phone', 40)
  const specialty = text(formData, 'specialty', 80)
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')
  const locale = formData.get('locale') === 'en' ? 'en' : 'es'

  const inv = await invitacionPorToken(token)
  if (fullName.length < 2) return { error: 'required' }
  if (!EMAIL_RE.test(email)) return { error: 'email' }
  if (password.length < 8) return { error: 'password' }
  if (password !== confirm) return { error: 'mismatch' }
  if (formData.get('terminos') !== '1') return { error: 'terms' }
  const invalida = await validarInvitacion(inv, email)
  if (invalida || !inv) return { error: invalida ?? 'invalid' }

  const siteUrl = appBaseUrl()
  if (!siteUrl || !authMailConfigured()) return { error: 'mail' }

  // Correo ocupado por una cuenta que se creó sola (Google/Microsoft) sin pertenecer a nada: se libera.
  await liberarCorreoHuerfano(email)
  // La cuenta queda sin confirmar hasta que la persona abra el correo: así se valida que el email es suyo.
  const created = await createUserWithConfirmationEmail({ email, password, fullName, siteUrl, locale })
  if ('error' in created) {
    if (created.error === 'email_taken') return { error: 'emailTaken' }
    return { error: created.error === 'send_failed' ? 'mail' : 'generic' }
  }

  const fallo = await aplicarInvitacion(inv, created.userId, { fullName, email, phone, specialty, nombreConfirmado: true, terminosAceptados: true })
  if (fallo) {
    await supabaseAdmin.auth.admin.deleteUser(created.userId)
    return { error: fallo }
  }
  return { ok: true, email }
}
