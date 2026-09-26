// POST /api/files/delete { url }
// Borra un archivo privado (R2 o Supabase Storage) si quien llama podía subirlo ahí.
// Se usa al eliminar un documento o adjunto, para no dejar archivos huérfanos ocupando espacio.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, unauthorized, notFound } from '@/lib/api-auth'
import { canReadObject, canWriteObject, isPrivateBucket } from '@/lib/storage-access'
import { hasRole, ROLES } from '@/lib/api-auth'
import { r2Delete } from '@/lib/r2'
import { r2Key, storageObjectOf } from '@/lib/file-url'

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  const body = await req.json().catch(() => ({}))
  const obj = storageObjectOf(typeof body.url === 'string' ? body.url : '')
  if (!obj || !isPrivateBucket(obj.bucket)) return notFound()
  const puede = (await canWriteObject(caller, obj.bucket, obj.path)) || (hasRole(caller, ROLES.admins) && (await canReadObject(caller, obj.bucket, obj.path)))
  if (!puede) return notFound()

  if (obj.r2) await r2Delete(r2Key(obj.bucket, obj.path))
  else await supabaseAdmin.storage.from(obj.bucket).remove([obj.path]).catch(() => {})
  return NextResponse.json({ ok: true })
}
