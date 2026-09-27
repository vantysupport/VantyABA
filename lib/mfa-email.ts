// Verificación en dos pasos por correo: firma de la cookie que marca una sesión como verificada.
// La cookie queda ligada al usuario Y a la sesión (session_id del JWT): no sirve en otra sesión ni
// en otro dispositivo. Sin dependencias de base de datos para poder usarse desde el proxy.

import { createHmac, createHash, timingSafeEqual } from 'crypto'

export const COOKIE_MFA_EMAIL = 'vanty_mfa_email'

const clave = () => process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function firma(uid: string, sid: string) {
  return createHmac('sha256', clave()).update(`mfa-email:${uid}:${sid}`).digest('hex')
}

/** Valor de la cookie para esta sesión. */
export function cookieMfaEmail(uid: string, sid: string): string {
  return `${sid}.${firma(uid, sid)}`
}

/** true si la cookie corresponde a este usuario y a esta misma sesión. */
export function cookieMfaEmailValida(valor: string | undefined, uid: string, sid: string | undefined): boolean {
  if (!valor || !sid || !clave()) return false
  const [cSid, cFirma] = valor.split('.')
  if (cSid !== sid || !cFirma) return false
  const esperado = Buffer.from(firma(uid, sid))
  const recibido = Buffer.from(cFirma)
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido)
}

/** Hash del código de 6 dígitos (nunca se guarda en claro). */
export function hashCodigo(uid: string, codigo: string): string {
  return createHash('sha256').update(`${clave()}:${uid}:${codigo}`).digest('hex')
}
