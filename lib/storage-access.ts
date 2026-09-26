// Access rules for the private file areas (clinical documents, chat attachments, knowledge base).
// Files are never served by public URL: /api/files checks these rules and redirects to a
// short-lived signed URL (Supabase Storage for older files, Cloudflare R2 for new ones).

import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { canAccessChild, ROLES, type ApiCaller } from '@/lib/api-auth'

export const PRIVATE_BUCKETS = ['patient-documents', 'chat-files', 'chat-media', 'knowledge-base'] as const
export type PrivateBucket = typeof PRIVATE_BUCKETS[number]

export const isPrivateBucket = (b: string): b is PrivateBucket => (PRIVATE_BUCKETS as readonly string[]).includes(b)

const isStaff = (c: ApiCaller) => (ROLES.staff as readonly string[]).includes(c.role)

async function sameCentroUser(caller: ApiCaller, userId: string): Promise<boolean> {
  if (userId === caller.id) return true
  if (!caller.centroId) return false
  const { data } = await supabaseAdmin.from('profiles').select('centro_id').eq('id', userId).maybeSingle()
  return !!data && data.centro_id === caller.centroId
}

const rutaValida = (path: string) => !!path && !path.includes('..') && !path.startsWith('/') && !/[\\\u0000]/.test(path)

/**
 * Path layouts written by the app:
 *   patient-documents/<child_id>/...          → the child's family or staff of the child's centro
 *   chat-media/chat-familias/<child_id>/...   → same as above (family ↔ center chat)
 *   chat-files/chat/<user_id>/...             → staff of the uploader's centro (team chat)
 *   chat-files/avatars/<user_id>.<ext>        → anyone signed in to the same centro
 *   knowledge-base/knowledge/<centro_id>/...  → staff of that centro
 */
export async function canReadObject(caller: ApiCaller, bucket: PrivateBucket, path: string): Promise<boolean> {
  if (!rutaValida(path)) return false
  const parts = path.split('/')
  if (bucket === 'patient-documents') return canAccessChild(caller, parts[0])
  if (bucket === 'chat-media') return parts[0] === 'chat-familias' && canAccessChild(caller, parts[1])
  if (bucket === 'knowledge-base') return parts[0] === 'knowledge' && isStaff(caller) && !!caller.centroId && parts[1] === caller.centroId
  if (parts[0] === 'chat') return isStaff(caller) && !!parts[1] && sameCentroUser(caller, parts[1])
  if (parts[0] === 'avatars') {
    const userId = (parts[1] || '').replace(/\.[a-z0-9]+$/i, '')
    return !!userId && sameCentroUser(caller, userId)
  }
  return false
}

/** Who may upload to a path: same layouts, but chat and avatar files only under your own user id. */
export async function canWriteObject(caller: ApiCaller, bucket: PrivateBucket, path: string): Promise<boolean> {
  if (!rutaValida(path)) return false
  const parts = path.split('/')
  if (bucket === 'patient-documents') return parts.length >= 2 && canAccessChild(caller, parts[0])
  if (bucket === 'chat-media') return parts[0] === 'chat-familias' && parts.length >= 3 && canAccessChild(caller, parts[1])
  if (bucket === 'knowledge-base') return parts[0] === 'knowledge' && isStaff(caller) && !!caller.centroId && parts[1] === caller.centroId && parts.length >= 3
  if (parts[0] === 'chat') return isStaff(caller) && parts[1] === caller.id && parts.length >= 3
  if (parts[0] === 'avatars') return (parts[1] || '').replace(/\.[a-z0-9]+$/i, '') === caller.id
  return false
}
