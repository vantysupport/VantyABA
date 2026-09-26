// Stored file URLs point at Supabase storage or at Cloudflare R2 ("r2:<bucket>/<path>").
// Private files must go through /api/files (permission check + short-lived signed URL);
// anything else (public images, external links) is returned unchanged.

const PRIVATE = ['patient-documents', 'chat-files', 'chat-media', 'knowledge-base']
const STORAGE_RE = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?#]+)/
const R2_RE = /^r2:([^/]+)\/(.+)$/

export const esR2 = (url: string | null | undefined) => !!url && url.startsWith('r2:')

export function fileUrl(url: string | null | undefined, opts?: { download?: boolean }): string {
  if (!url) return ''
  const dl = opts?.download ? '&download=1' : ''
  const r2 = url.match(R2_RE)
  if (r2) return `/api/files?r=1&b=${encodeURIComponent(r2[1])}&p=${encodeURIComponent(r2[2])}${dl}`
  const m = url.match(STORAGE_RE)
  if (!m || !PRIVATE.includes(m[1])) return url
  const path = decodeURIComponent(m[2])
  return `/api/files?b=${encodeURIComponent(m[1])}&p=${encodeURIComponent(path)}${dl}`
}

/** "bucket/path" (y dónde vive) de una URL guardada, para código de servidor que descarga o borra. */
export function storageObjectOf(url: string | null | undefined): { bucket: string; path: string; r2: boolean } | null {
  const u = url || ''
  const r2 = u.match(R2_RE)
  if (r2) return { bucket: r2[1], path: r2[2], r2: true }
  const m = u.match(STORAGE_RE)
  return m ? { bucket: m[1], path: decodeURIComponent(m[2]), r2: false } : null
}

/** Clave del objeto en R2 para un bucket lógico y una ruta. */
export const r2Key = (bucket: string, path: string) => `${bucket}/${path}`
