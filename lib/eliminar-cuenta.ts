import 'server-only'
// Elimina la cuenta de una persona (padre/tutor, secretaría, especialista, administración) con SUS datos
// personales: perfil, acceso, foto, ficha de contacto de familia, mensajes que envió, chats con ARIA y
// notificaciones. Nunca borra datos del niño: fichas, sesiones, evaluaciones, informes y documentos quedan
// en el centro (las referencias a la persona pasan a null por las FKs "on delete set null").
// La persona encargada del centro no usa esto: elimina el centro completo (lib/eliminar-centro.ts).

import { supabaseAdmin } from '@/lib/supabase-admin'
import { borrarArchivosDeUsuario } from '@/lib/borrar-archivos'

export async function eliminarCuentaPersonal(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: perfil } = await supabaseAdmin.from('profiles').select('id, role, avatar_url').eq('id', userId).maybeSingle()
  if (!perfil) return { ok: false, error: 'not_found' }
  if (perfil.role === 'programador') return { ok: false, error: 'forbidden' }

  // Datos personales sin FK hacia profiles (las tablas con FK se limpian solas al borrar el perfil).
  const tablas: [string, string][] = [
    ['parent_accounts', 'user_id'], ['chat_familias', 'sender_id'], ['agente_conversaciones', 'user_id'],
    ['notificaciones', 'user_id'], ['notifications', 'user_id'], ['push_subscriptions', 'user_id'], ['app_dispositivos', 'user_id'], ['app_avisos', 'user_id'],
  ]
  for (const [tabla, col] of tablas) {
    const { error } = await supabaseAdmin.from(tabla).delete().eq(col, userId)
    if (error && !/does not exist|schema cache/i.test(error.message)) return { ok: false, error: `${tabla}: ${error.message}` }
  }

  await borrarArchivosDeUsuario(userId, perfil.avatar_url)
  const { error: ep } = await supabaseAdmin.from('profiles').delete().eq('id', userId)
  if (ep) return { ok: false, error: ep.message }
  const { error: eu } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (eu && !/not.?found/i.test(eu.message)) return { ok: false, error: eu.message }
  return { ok: true }
}
