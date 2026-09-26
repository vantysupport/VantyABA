'use client'
// Subida de archivos PRIVADOS (documentos de pacientes, adjuntos de chats, base de conocimiento)
// a Cloudflare R2: se pide permiso a /api/files/upload-url y el archivo va directo a R2.
// Las fotos se comprimen antes (lado máximo 2000 px, WebP) para ahorrar espacio y datos móviles.

import { supabase } from '@/lib/supabase'

export type BucketPrivado = 'patient-documents' | 'chat-files' | 'chat-media' | 'knowledge-base'

const COMPRIMIBLES = ['image/jpeg', 'image/png', 'image/webp']
const LADO_MAX = 2000
const MIN_PARA_COMPRIMIR = 300 * 1024

async function comprimirImagen(file: File): Promise<File> {
  if (!COMPRIMIBLES.includes(file.type) || file.size < MIN_PARA_COMPRIMIR || typeof createImageBitmap === 'undefined') return file
  try {
    const bmp = await createImageBitmap(file)
    const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * escala), h = Math.round(bmp.height * escala)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/webp', 0.82))
    // Solo si realmente ahorra espacio
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, '') + '.webp', { type: 'image/webp' })
  } catch {
    return file
  }
}

const limpiarNombre = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'archivo'

/**
 * Sube un archivo a una carpeta privada. `carpeta` es la ruta sin el nombre
 * (p. ej. "<child_id>" o "chat/<user_id>"); se agrega un prefijo único al nombre.
 * Devuelve el valor a guardar en la base ("r2:<bucket>/<ruta>") y los datos finales del archivo.
 */
export async function subirArchivoPrivado(bucket: BucketPrivado, carpeta: string, archivo: File | Blob, nombre?: string): Promise<{ url: string; nombre: string; size: number; type: string }> {
  let file = archivo instanceof File ? archivo : new File([archivo], nombre || 'archivo', { type: archivo.type || 'application/octet-stream' })
  file = await comprimirImagen(file)
  const unico = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${limpiarNombre(file.name)}`
  const path = `${carpeta.replace(/^\/+|\/+$/g, '')}/${unico}`
  const type = file.type || 'application/octet-stream'

  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/files/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
    body: JSON.stringify({ bucket, path, contentType: type, size: file.size }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.uploadUrl) throw new Error(j.error || 'No se pudo preparar la subida')

  const put = await fetch(j.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': type } })
  if (!put.ok) throw new Error('No se pudo subir el archivo')
  return { url: j.url as string, nombre: file.name, size: file.size, type }
}
