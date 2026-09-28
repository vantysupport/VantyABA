import 'server-only'
import { emailLayout } from '@/lib/email-layout'
// Invitaciones por link: el jefe/admin de un centro invita a especialistas, secretarias
// o padres. La cuenta se crea ya dentro de SU centro, con el rol de la invitación.

import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { profileLimitCheck } from '@/lib/profile-limits'
import { avisarEquipo } from '@/lib/avisos'

export const ROLES_INVITABLES = ['especialista', 'secretaria', 'padre'] as const
export type RolInvitable = typeof ROLES_INVITABLES[number]

export type Invitacion = {
  id: string
  centro_id: string
  role: RolInvitable
  token: string
  email: string | null
  child_id: string | null
  specialty: string | null
  max_uses: number
  uses: number
  accepted: { user_id: string; email: string; at: string }[]
  expires_at: string
  revoked_at: string | null
  created_by: string | null
  created_at: string
}

export type EstadoInvitacion = 'activa' | 'usada' | 'vencida' | 'revocada'

export function estadoInvitacion(inv: Pick<Invitacion, 'revoked_at' | 'expires_at' | 'uses' | 'max_uses'>): EstadoInvitacion {
  if (inv.revoked_at) return 'revocada'
  if (inv.uses >= inv.max_uses) return 'usada'
  if (new Date(inv.expires_at).getTime() <= Date.now()) return 'vencida'
  return 'activa'
}

export const nuevoToken = () => randomBytes(24).toString('base64url') // 32 caracteres

export const linkInvitacion = (base: string, token: string, locale: 'es' | 'en') =>
  `${base.replace(/\/$/, '')}/${locale}/invitar/${token}`

export async function invitacionPorToken(token: string): Promise<Invitacion | null> {
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return null
  const { data } = await supabaseAdmin.from('invitaciones').select('*').eq('token', token).maybeSingle()
  return (data as Invitacion | null) ?? null
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

const ROL_TXT: Record<RolInvitable, { es: string; en: string }> = {
  especialista: { es: 'especialista', en: 'specialist' },
  secretaria: { es: 'secretaría', en: 'front desk' },
  padre: { es: 'padre, madre o tutor', en: 'parent or guardian' },
}

export function rolTexto(role: RolInvitable, en: boolean) {
  return ROL_TXT[role][en ? 'en' : 'es']
}

export function buildEmailInvitacion(opts: { link: string; centroNombre: string; role: RolInvitable; paciente?: string | null; vence: Date; en: boolean }) {
  const { link, centroNombre, role, paciente, vence, en } = opts
  const centro = esc(centroNombre)
  const rol = esc(rolTexto(role, en))
  const fecha = vence.toLocaleDateString(en ? 'en-US' : 'es-PE', { day: 'numeric', month: 'long', timeZone: 'America/Lima' })
  const extra = role === 'padre' && paciente
    ? (en ? ` You will be able to follow the progress, appointments and home activities of <strong>${esc(paciente)}</strong>.` : ` Podrás seguir el progreso, las citas y las actividades en casa de <strong>${esc(paciente)}</strong>.`)
    : ''
  const subject = en ? `${centroNombre} invited you to Vanty ABA` : `${centroNombre} te invitó a Vanty ABA`
  const html = emailLayout({
    locale: en ? 'en' : 'es',
    subject,
    preheader: en ? `Join ${centroNombre} on Vanty ABA` : `Únete a ${centroNombre} en Vanty ABA`,
    eyebrow: centro,
    title: en ? 'You are invited' : 'Te damos la bienvenida',
    intro: en
      ? `<strong>${centro}</strong> invited you to join its team on Vanty ABA as <strong>${rol}</strong>.${extra}`
      : `<strong>${centro}</strong> te invitó a unirte a Vanty ABA como <strong>${rol}</strong>.${extra}`,
    detalles: [
      { label: en ? 'Center' : 'Centro', value: centro },
      { label: en ? 'Role' : 'Rol', value: rol.charAt(0).toUpperCase() + rol.slice(1) },
      { label: en ? 'Valid until' : 'Válida hasta', value: esc(fecha) },
    ],
    cta: { href: link, label: en ? 'Create my account' : 'Crear mi cuenta' },
    note: en ? 'It only takes a minute. If you did not expect this invitation, you can ignore this email.' : 'Solo toma un minuto. Si no esperabas esta invitación, puedes ignorar este correo.',
    aria: 'saludo',
    ariaDice: en ? 'See you inside!' : '¡Te espero dentro!',
  })
  return { subject, html }
}

// ── Aceptación (formulario o Google/Microsoft) ───────────────────────────────
export type ErrorInvitacion = 'invalid' | 'expired' | 'used' | 'suspended' | 'emailMismatch' | 'seats' | 'generic'

/** Revisa que la invitación siga sirviendo para registrar a `email` (vigencia, centro activo, correo fijo y cupo). */
export async function validarInvitacion(inv: Invitacion | null, email?: string): Promise<ErrorInvitacion | null> {
  if (!inv) return 'invalid'
  const estado = estadoInvitacion(inv)
  if (estado === 'revocada') return 'invalid'
  if (estado === 'vencida') return 'expired'
  if (estado === 'usada') return 'used'
  const { data: centro } = await supabaseAdmin.from('centros').select('status').eq('id', inv.centro_id).maybeSingle()
  if (!centro || centro.status === 'suspended') return 'suspended'
  if (email !== undefined && inv.email && inv.email.toLowerCase() !== email.toLowerCase()) return 'emailMismatch'
  const cupo = await profileLimitCheck(inv.role, inv.centro_id)
  if (cupo.blocked) return 'seats'
  return null
}

/**
 * Consume la invitación de forma atómica y deja la cuenta dentro del centro con su rol
 * (y vinculada al paciente si es un padre). No borra la cuenta si falla: eso lo decide quien llama.
 */
export async function aplicarInvitacion(
  inv: Invitacion,
  userId: string,
  datos: { fullName: string; email: string; phone?: string; specialty?: string; nombreConfirmado?: boolean },
): Promise<ErrorInvitacion | null> {
  const { data: usada } = await supabaseAdmin.rpc('consume_invitacion', { p_token: inv.token, p_user: userId, p_email: datos.email })
  if (!(usada as Invitacion | null)?.id) return 'used'

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      role: inv.role,
      centro_id: inv.centro_id,
      full_name: datos.fullName,
      nombre_confirmado: !!datos.nombreConfirmado,
      is_active: true,
      ...(datos.phone ? { phone: datos.phone } : {}),
      ...(inv.role !== 'padre' ? { specialty: datos.specialty || inv.specialty || null } : {}),
    })
    .eq('id', userId)
  if (error) return 'generic'

  if (inv.role === 'padre' && inv.child_id) {
    const { data: child } = await supabaseAdmin.from('children').select('id, parent_id, centro_id').eq('id', inv.child_id).maybeSingle()
    if (child && child.centro_id === inv.centro_id) {
      if (!child.parent_id) await supabaseAdmin.from('children').update({ parent_id: userId }).eq('id', child.id)
      await supabaseAdmin.from('parent_accounts').upsert({
        user_id: userId,
        child_id: child.id,
        nombre: datos.fullName,
        telefono: datos.phone || null,
        email: datos.email,
        parentesco: 'padre',
        whatsapp_activo: !!datos.phone,
        notif_citas: true,
        notif_reportes: true,
        notif_tareas: true,
        centro_id: inv.centro_id,
      }, { onConflict: 'user_id,child_id', ignoreDuplicates: false })
    }
  }

  // Aviso al centro: quién se unió y con qué rol
  const ROL: Record<string, { es: string; en: string }> = {
    padre: { es: 'Familia', en: 'Family' }, especialista: { es: 'Especialista', en: 'Specialist' }, secretaria: { es: 'Secretaria', en: 'Secretary' },
  }
  const rol = ROL[inv.role] ?? { es: inv.role, en: inv.role }
  let hijo: string | null = null
  if (inv.role === 'padre' && inv.child_id) {
    const { data: c } = await supabaseAdmin.from('children').select('name').eq('id', inv.child_id).maybeSingle()
    hijo = c?.name ?? null
  }
  await avisarEquipo({
    centroId: inv.centro_id, roles: inv.role === 'padre' ? ['jefe', 'admin', 'secretaria'] : ['jefe', 'admin'],
    excluir: userId, tipo: 'nuevo_miembro', childId: inv.role === 'padre' ? inv.child_id ?? null : null,
    titulo: { es: `Nuevo integrante · ${rol.es}`, en: `New member · ${rol.en}` },
    mensaje: {
      es: `${datos.fullName} aceptó la invitación y ya tiene acceso${hijo ? ` como familia de ${hijo}` : ''}.`,
      en: `${datos.fullName} accepted the invitation and now has access${hijo ? ` as ${hijo}'s family` : ''}.`,
    },
    metadata: { user_id: userId, role: inv.role },
  })
  return null
}
