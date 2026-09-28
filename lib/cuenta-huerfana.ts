import 'server-only'
// Cuenta "huérfana": se creó sola al entrar con Google/Microsoft sin tener cuenta ni invitación
// (el trigger handle_new_user le pone rol padre y ningún centro). No pertenece a nada, así que se
// puede borrar sin perder información y el correo queda libre para crear un centro o aceptar una
// invitación.

import { supabaseAdmin } from '@/lib/supabase-admin'

export async function esCuentaHuerfana(userId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return false
  const { data: perfil } = await supabaseAdmin.from('profiles').select('role, centro_id').eq('id', userId).maybeSingle()
  if (perfil && (perfil.role !== 'padre' || perfil.centro_id)) return false
  const [hijos, cuentas] = await Promise.all([
    supabaseAdmin.from('children').select('id', { count: 'exact', head: true }).eq('parent_id', userId),
    supabaseAdmin.from('parent_accounts').select('user_id', { count: 'exact', head: true }).eq('user_id', userId),
  ])
  if (hijos.error || cuentas.error) return false // ante la duda, no se borra
  return (hijos.count ?? 0) === 0 && (cuentas.count ?? 0) === 0
}

/** Borra la cuenta si es huérfana. Devuelve true si la borró. */
export async function borrarSiHuerfana(userId: string): Promise<boolean> {
  if (!(await esCuentaHuerfana(userId))) return false
  await supabaseAdmin.from('profiles').delete().eq('id', userId)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  return !error
}

/** Si el correo pertenece a una cuenta huérfana, la borra para que el correo quede libre. */
export async function liberarCorreoHuerfano(email: string): Promise<boolean> {
  // ilike sin comodines (el "_" es común en correos): coincide solo el correo exacto, sin importar mayúsculas.
  const exacto = email.trim().replace(/[\\%_]/g, c => `\\${c}`)
  const { data: perfil } = await supabaseAdmin.from('profiles').select('id').ilike('email', exacto).maybeSingle()
  return perfil?.id ? borrarSiHuerfana(perfil.id) : false
}
