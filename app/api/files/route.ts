// GET /api/files?b=<bucket>&p=<path>[&r=1][&download=1]
// Serves a private file: checks the caller may see it, then redirects to a signed URL valid
// for a few minutes. r=1 → the file lives in Cloudflare R2; otherwise in Supabase Storage.
// Works as <img src>, <iframe src>, <a href> and downloads.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, unauthorized, notFound } from '@/lib/api-auth'
import { canReadObject, isPrivateBucket } from '@/lib/storage-access'
import { r2UrlLectura } from '@/lib/r2'
import { r2Key } from '@/lib/file-url'

export const dynamic = 'force-dynamic'

const SIGNED_URL_TTL_SECONDS = 300

export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()

  const { searchParams } = new URL(req.url)
  const bucket = searchParams.get('b') || ''
  const path = searchParams.get('p') || ''
  if (!isPrivateBucket(bucket) || !path) return notFound()
  // Same answer for "doesn't exist" and "not yours", so paths can't be probed.
  if (!(await canReadObject(caller, bucket, path))) return notFound()

  const nombre = path.split('/').pop() || 'archivo'
  const download = searchParams.get('download') === '1'
  let destino: string | null = null
  if (searchParams.get('r') === '1') {
    try { destino = await r2UrlLectura(r2Key(bucket, path), SIGNED_URL_TTL_SECONDS, download ? nombre : undefined) } catch { destino = null }
  } else {
    const { data } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS, download ? { download: nombre } : undefined)
    destino = data?.signedUrl ?? null
  }
  if (!destino) return notFound()

  return NextResponse.redirect(destino, { status: 302, headers: { 'Cache-Control': 'private, no-store' } })
}
