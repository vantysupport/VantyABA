import 'server-only'
// Cloudflare R2 (compatible con S3): archivos privados de la app (documentos de pacientes,
// base de conocimiento, adjuntos de chats). El bucket es PRIVADO: nadie accede directo,
// todo pasa por /api/files (permisos) y enlaces firmados de pocos minutos.
//
// Clave del objeto = "<bucket lógico>/<ruta>", con las mismas rutas que usaba Supabase Storage
// (p. ej. "patient-documents/<child_id>/<archivo>"), así las reglas de lib/storage-access siguen igual.
// En la base se guarda como "r2:<bucket>/<ruta>" (ver lib/file-url).

import { AwsClient } from 'aws4fetch'

const cfg = () => ({
  account: process.env.R2_ACCOUNT_ID || '',
  key: process.env.R2_ACCESS_KEY_ID || '',
  secret: process.env.R2_SECRET_ACCESS_KEY || '',
  bucket: process.env.R2_BUCKET || '',
})

export const r2Configurado = () => { const c = cfg(); return !!(c.account && c.key && c.secret && c.bucket) }

let cliente: AwsClient | null = null
function aws(): AwsClient {
  const c = cfg()
  if (!r2Configurado()) throw new Error('R2 no está configurado (R2_* en .env.local)')
  cliente ??= new AwsClient({ accessKeyId: c.key, secretAccessKey: c.secret, service: 's3', region: 'auto' })
  return cliente
}

const codificar = (key: string) => key.split('/').map(encodeURIComponent).join('/')
const urlDe = (key: string) => { const c = cfg(); return `https://${c.account}.r2.cloudflarestorage.com/${c.bucket}/${codificar(key)}` }

export async function r2Put(key: string, body: BodyInit | Buffer | Uint8Array, contentType = 'application/octet-stream'): Promise<void> {
  const res = await aws().fetch(urlDe(key), { method: 'PUT', body: body as BodyInit, headers: { 'Content-Type': contentType } })
  if (!res.ok) throw new Error(`R2 put ${res.status}`)
}

export async function r2Get(key: string): Promise<Response | null> {
  const res = await aws().fetch(urlDe(key))
  return res.ok ? res : null
}

export async function r2Buffer(key: string): Promise<Buffer | null> {
  const res = await r2Get(key)
  return res ? Buffer.from(await res.arrayBuffer()) : null
}

export async function r2Head(key: string): Promise<{ size: number; contentType: string } | null> {
  const res = await aws().fetch(urlDe(key), { method: 'HEAD' })
  if (!res.ok) return null
  return { size: Number(res.headers.get('content-length') || 0), contentType: res.headers.get('content-type') || '' }
}

export async function r2Delete(key: string): Promise<void> {
  await aws().fetch(urlDe(key), { method: 'DELETE' }).catch(() => {})
}

/** Enlace temporal para LEER (opcionalmente como descarga con nombre). */
export async function r2UrlLectura(key: string, segundos = 300, descargarComo?: string): Promise<string> {
  const u = new URL(urlDe(key))
  u.searchParams.set('X-Amz-Expires', String(segundos))
  if (descargarComo) u.searchParams.set('response-content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(descargarComo)}`)
  const firmado = await aws().sign(u.toString(), { aws: { signQuery: true } })
  return firmado.url
}

/** Enlace temporal para SUBIR directo desde el navegador (PUT), sin pasar por el servidor. */
export async function r2UrlSubida(key: string, contentType: string, segundos = 600): Promise<string> {
  const u = new URL(urlDe(key))
  u.searchParams.set('X-Amz-Expires', String(segundos))
  const firmado = await aws().sign(u.toString(), { method: 'PUT', headers: { 'Content-Type': contentType }, aws: { signQuery: true } })
  return firmado.url
}

/** Claves (y tamaños) de todos los objetos bajo un prefijo, p. ej. "patient-documents/<child_id>/". */
export async function r2Listar(prefijo: string): Promise<{ key: string; size: number }[]> {
  const c = cfg()
  const out: { key: string; size: number }[] = []
  let token = ''
  do {
    const u = `https://${c.account}.r2.cloudflarestorage.com/${c.bucket}?list-type=2&prefix=${encodeURIComponent(prefijo)}${token ? `&continuation-token=${encodeURIComponent(token)}` : ''}`
    const xml = await (await aws().fetch(u)).text()
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = (m[1].match(/<Key>([^<]+)<\/Key>/) || [])[1]
      const size = Number((m[1].match(/<Size>(\d+)<\/Size>/) || [])[1] || 0)
      if (key) out.push({ key: key.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"), size })
    }
    token = (xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/) || [])[1] || ''
  } while (token)
  return out
}

/** Borra todos los objetos bajo un prefijo. Devuelve cuántos borró. */
export async function r2BorrarCarpeta(prefijo: string): Promise<number> {
  if (!prefijo || !prefijo.endsWith('/') || prefijo.split('/').filter(Boolean).length < 2) throw new Error('Prefijo inválido')
  const objs = await r2Listar(prefijo)
  for (const o of objs) await r2Delete(o.key)
  return objs.length
}
