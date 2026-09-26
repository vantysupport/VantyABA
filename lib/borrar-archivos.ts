import 'server-only'
// Borrado definitivo de archivos al eliminar algo en la app (documento, mensaje, paciente, usuario),
// para que no queden archivos huérfanos ocupando espacio. Nunca lanza: un fallo al borrar el
// archivo no debe impedir la eliminación del registro.

import { supabaseAdmin } from '@/lib/supabase-admin'
import { r2BorrarCarpeta, r2Configurado, r2Delete } from '@/lib/r2'
import { r2Key, storageObjectOf } from '@/lib/file-url'

/** Borra el archivo al que apunta una URL guardada (R2 o Supabase Storage). */
export async function borrarArchivoGuardado(url: string | null | undefined): Promise<void> {
  try {
    const obj = storageObjectOf(url)
    if (!obj) return
    if (obj.r2) { if (r2Configurado()) await r2Delete(r2Key(obj.bucket, obj.path)) }
    else await supabaseAdmin.storage.from(obj.bucket).remove([obj.path])
  } catch { /* noop */ }
}

/** Borra todos los archivos de un paciente: documentos y adjuntos del chat con su familia. */
export async function borrarArchivosDePaciente(childId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(childId) || !r2Configurado()) return
  await r2BorrarCarpeta(`patient-documents/${childId}/`).catch(() => 0)
  await r2BorrarCarpeta(`chat-media/chat-familias/${childId}/`).catch(() => 0)
}

/** Borra los archivos que subió una persona en el chat del equipo y su foto de perfil. */
export async function borrarArchivosDeUsuario(userId: string, avatarUrl?: string | null): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return
  if (r2Configurado()) await r2BorrarCarpeta(`chat-files/chat/${userId}/`).catch(() => 0)
  if (avatarUrl) await borrarArchivoGuardado(avatarUrl)
}
