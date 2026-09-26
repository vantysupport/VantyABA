import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail } from '@/lib/email'
import { emailLayout } from '@/lib/email-layout'

// Auth emails sent by the app itself (Gmail SMTP as vantysupport) instead of Supabase's mailer:
// Supabase only mints the one-time token; we brand the email and link to /auth/confirm (server-side verification, no PKCE).

const BRAND = 'Vanty ABA'

type Copy = { subject: string; heading: string; body: string; cta: string; note: string }

const COPY: Record<'recovery' | 'signup' | 'invite', { es: Copy; en: Copy }> = {
  recovery: {
    es: {
      subject: 'Restablece tu contraseña',
      heading: 'Restablece tu contraseña',
      body: `Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>${BRAND}</strong>. Pulsa el botón para crear una nueva.`,
      cta: 'Crear nueva contraseña',
      note: 'El enlace es de un solo uso y caduca pronto. Si no lo pediste, ignora este correo: tu contraseña no cambiará.',
    },
    en: {
      subject: 'Reset your password',
      heading: 'Reset your password',
      body: `We received a request to reset the password of your <strong>${BRAND}</strong> account. Use the button to create a new one.`,
      cta: 'Create new password',
      note: "The link works once and expires soon. If you didn't ask for it, ignore this email: your password won't change.",
    },
  },
  signup: {
    es: {
      subject: `Confirma tu correo · ${BRAND}`,
      heading: 'Confirma tu correo',
      body: `Gracias por crear tu centro en <strong>${BRAND}</strong>. Confirma tu correo para activar tu cuenta y empezar tu prueba gratis.`,
      cta: 'Confirmar mi correo',
      note: `Si no creaste una cuenta en ${BRAND}, puedes ignorar este correo.`,
    },
    en: {
      subject: `Confirm your email · ${BRAND}`,
      heading: 'Confirm your email',
      body: `Thanks for creating your center on <strong>${BRAND}</strong>. Confirm your email to activate your account and start your free trial.`,
      cta: 'Confirm my email',
      note: `If you didn't create a ${BRAND} account, you can ignore this email.`,
    },
  },
  invite: {
    es: {
      subject: `Te invitaron a ${BRAND}`,
      heading: `Te invitaron a ${BRAND}`,
      body: `Tu centro te invitó a unirte a <strong>${BRAND}</strong>. Acepta la invitación para crear tu contraseña.`,
      cta: 'Aceptar invitación',
      note: 'Si no esperabas esta invitación, puedes ignorar este correo.',
    },
    en: {
      subject: `You're invited to ${BRAND}`,
      heading: `You're invited to ${BRAND}`,
      body: `Your center invited you to join <strong>${BRAND}</strong>. Accept the invitation to create your password.`,
      cta: 'Accept invitation',
      note: "If you weren't expecting this invitation, you can ignore this email.",
    },
  },
}

function renderEmail(c: Copy, url: string, locale: 'es' | 'en', tipo: 'recovery' | 'signup') {
  return emailLayout({
    locale, subject: c.subject, title: c.heading, intro: c.body, note: c.note,
    cta: { href: url, label: c.cta },
    aria: tipo === 'signup' ? 'celebra' : 'laptop',
    ariaDice: tipo === 'signup' ? (locale === 'en' ? 'Welcome aboard!' : '¡Qué gusto tenerte!') : undefined,
  })
}

/** Base URL for links in emails. Never derived from the request Host header (it can be forged to phish tokens). */
export function appBaseUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (configured) return configured
  return process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null
}

export function authMailConfigured() {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_PASS)
}

const confirmUrl = (siteUrl: string, tokenHash: string, type: string) =>
  `${siteUrl.replace(/\/$/, '')}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${type}`

/** Returns false only on delivery failure; an unknown email is treated as success so callers can't enumerate accounts. */
export async function sendRecoveryEmail(email: string, siteUrl: string, locale: 'es' | 'en' = 'es'): Promise<boolean> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email })
  if (error || !data?.properties?.hashed_token) return true
  const c = COPY.recovery[locale]
  return sendEmail(email, c.subject, renderEmail(c, confirmUrl(siteUrl, data.properties.hashed_token, 'recovery'), locale, 'recovery'), BRAND)
}

/**
 * Re-sends the confirmation email to an account that exists but is still unconfirmed (e.g. someone who
 * registered through an invitation and lost the email). A magic link confirms the email when opened.
 * Always resolves true for unknown or already-confirmed emails so callers can't enumerate accounts.
 */
export async function resendConfirmationEmail(email: string, siteUrl: string, locale: 'es' | 'en' = 'es'): Promise<boolean> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data?.properties?.hashed_token || data.user?.email_confirmed_at) return true
  const c = COPY.signup[locale]
  const copy: Copy = {
    ...c,
    body: locale === 'en'
      ? `Your <strong>${BRAND}</strong> account is ready. Confirm your email to activate it and sign in.`
      : `Tu cuenta en <strong>${BRAND}</strong> ya está creada. Confirma tu correo para activarla e ingresar.`,
  }
  return sendEmail(email, c.subject, renderEmail(copy, confirmUrl(siteUrl, data.properties.hashed_token, 'magiclink'), locale, 'signup'), BRAND)
}

/** Creates the (unconfirmed) user and emails the confirmation link. Returns the new user id, or an error code. */
export async function createUserWithConfirmationEmail(opts: {
  email: string
  password: string
  fullName: string
  siteUrl: string
  locale?: 'es' | 'en'
}): Promise<{ userId: string } | { error: 'email_taken' | 'failed' | 'send_failed' }> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'signup',
    email: opts.email,
    password: opts.password,
    options: { data: { full_name: opts.fullName } },
  })
  if (error) return { error: /already|registered|exists/i.test(error.message) ? 'email_taken' : 'failed' }
  const userId = data?.user?.id
  const tokenHash = data?.properties?.hashed_token
  if (!userId || !tokenHash) return { error: 'failed' }

  const locale = opts.locale ?? 'es'
  const c = COPY.signup[locale]
  const sent = await sendEmail(opts.email, c.subject, renderEmail(c, confirmUrl(opts.siteUrl, tokenHash, 'signup'), locale, 'signup'), BRAND)
  if (!sent) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    return { error: 'send_failed' }
  }
  return { userId }
}
