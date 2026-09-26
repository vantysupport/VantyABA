// POST /api/files/upload-url { bucket, path, contentType, size }
// Checks the caller may write there and returns a short-lived URL to PUT the file directly to
// Cloudflare R2 (no Vercel body limit), plus the value to store in the database ("r2:<bucket>/<path>").

import { NextRequest, NextResponse } from 'next/server'
import { getApiCaller, unauthorized, notFound } from '@/lib/api-auth'
import { canWriteObject, isPrivateBucket } from '@/lib/storage-access'
import { r2Configurado, r2UrlSubida } from '@/lib/r2'
import { r2Key } from '@/lib/file-url'
import { cabeArchivo } from '@/lib/uso-espacio'

export const dynamic = 'force-dynamic'

const MAX_BYTES: Record<string, number> = {
  'patient-documents': 50 * 1024 * 1024,
  'knowledge-base': 200 * 1024 * 1024,
  'chat-files': 25 * 1024 * 1024,
  'chat-media': 25 * 1024 * 1024,
}

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!r2Configurado()) return NextResponse.json({ error: 'El almacenamiento no está configurado' }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const bucket = String(body.bucket || '')
  const path = String(body.path || '').slice(0, 400)
  const contentType = String(body.contentType || 'application/octet-stream').slice(0, 120)
  const size = Number(body.size || 0)
  if (!isPrivateBucket(bucket) || !path) return notFound()
  if (!(await canWriteObject(caller, bucket, path))) return notFound()
  if (!size || size > MAX_BYTES[bucket]) {
    return NextResponse.json({ error: `El archivo supera el máximo de ${Math.round(MAX_BYTES[bucket] / 1024 / 1024)} MB` }, { status: 413 })
  }

  // Espacio de archivos del plan del centro
  if (caller.centroId) {
    const cabe = await cabeArchivo(caller.centroId, size)
    if (!cabe.ok) {
      return NextResponse.json({ error: 'Tu centro llegó al límite de espacio para archivos de su plan. Elimina archivos que ya no uses o amplía el plan.', code: 'storage_full' }, { status: 413 })
    }
  }

  const uploadUrl = await r2UrlSubida(r2Key(bucket, path), contentType)
  return NextResponse.json({ uploadUrl, url: `r2:${bucket}/${path}` })
}
