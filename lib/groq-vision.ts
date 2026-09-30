// lib/groq-vision.ts
// OCR / lectura de imágenes con el modelo de visión de Groq (misma clave GROQ_API_KEY que el resto de la IA),
// con DeepInfra como respaldo si Groq falla o no está configurado (lib/proveedores-ia.ts).
// Groq acepta hasta 3 imágenes por request; cada imagen cuenta como ~2k tokens de entrada.

import sharp from 'sharp'
import { logServerError } from '@/lib/log-server-error'
import { iaDesactivadaAhora } from '@/lib/ia-contexto'
import { modeloVisionDeepInfra, proveedoresIA, type ProveedorIA } from '@/lib/proveedores-ia'

// Configurable por si Groq rota el modelo de visión (ver console.groq.com/docs/vision).
export const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b'
const MAX_IMAGES_PER_REQUEST = 3
const MAX_SIDE = 1800

export type VisionImage = { data: ArrayBuffer | Uint8Array | Buffer; mime?: string }

// Reduce y normaliza a JPEG: menos bytes, menos latencia y formatos raros (HEIC/BMP/GIF) quedan soportados.
async function toJpegDataUrl(img: VisionImage): Promise<string> {
  const buf = Buffer.from(img.data instanceof ArrayBuffer ? new Uint8Array(img.data) : img.data)
  try {
    const out = await sharp(buf, { failOn: 'none' })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82 })
      .toBuffer()
    return `data:image/jpeg;base64,${out.toString('base64')}`
  } catch {
    return `data:${img.mime || 'image/jpeg'};base64,${buf.toString('base64')}`
  }
}

async function callVision(proveedor: ProveedorIA, prompt: string, dataUrls: string[], maxTokens: number): Promise<string> {
  const body = JSON.stringify({
    model: proveedor.id === 'groq' ? GROQ_VISION_MODEL : modeloVisionDeepInfra(),
    temperature: 0.1,
    max_tokens: maxTokens,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        ...dataUrls.map(url => ({ type: 'image_url', image_url: { url } })),
      ],
    }],
  })

  for (let intento = 1; intento <= 3; intento++) {
    const res = await fetch(proveedor.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${proveedor.key}`, 'Content-Type': 'application/json' },
      body,
    })
    if (res.ok) {
      const data = await res.json()
      return String(data.choices?.[0]?.message?.content || '')
        .replace(/<think>[\s\S]*?<\/think>/g, '') // algunos modelos devuelven su razonamiento
        .trim()
    }
    const err = await res.json().catch(() => ({}))
    const msg: string = err?.error?.message || res.statusText
    // Límite por minuto → esperar lo que pide Groq (tope 30 s) y reintentar. Límite diario → cortar.
    if (res.status === 429 && !/per day|\bRPD\b|\bTPD\b/i.test(msg) && intento < 3) {
      const wait = Math.min(30, Number(res.headers.get('retry-after')) || 5 * intento)
      await new Promise(r => setTimeout(r, wait * 1000))
      continue
    }
    await logServerError(`IA visión error ${proveedor.id} ${res.status}`, msg, 'groq')
    throw new Error(res.status === 429 ? 'Se agotó la cuota de IA por hoy. Intentá mañana.' : `${proveedor.id} vision ${res.status}: ${msg}`)
  }
  return ''
}

/**
 * Lee una o varias imágenes con un mismo prompt. Si son más de 3, se procesan por lotes y el texto se concatena
 * (el prompt recibe el rango de páginas del lote vía `promptFor`).
 */
export async function groqVision(
  images: VisionImage[],
  promptFor: (loteInicio: number, loteCantidad: number) => string,
  opts: { maxTokens?: number } = {},
): Promise<string> {
  if (iaDesactivadaAhora()) return ''
  const proveedores = proveedoresIA()
  if (proveedores.length === 0) {
    await logServerError('IA sin configurar', 'Faltan GROQ_API_KEY y DEEPINFRA_API_KEY (visión)', 'groq')
    throw new Error('GROQ_API_KEY no configurada')
  }
  // Primer proveedor que responda; si Groq falla (cupo, error, red), se prueba el respaldo.
  const leer = async (prompt: string, urls: string[]) => {
    for (const [n, p] of proveedores.entries()) {
      try { return await callVision(p, prompt, urls, opts.maxTokens ?? 4000) }
      catch (e) { if (n === proveedores.length - 1) throw e }
    }
    return ''
  }
  const partes: string[] = []
  for (let i = 0; i < images.length; i += MAX_IMAGES_PER_REQUEST) {
    const lote = images.slice(i, i + MAX_IMAGES_PER_REQUEST)
    const urls = await Promise.all(lote.map(toJpegDataUrl))
    const texto = await leer(promptFor(i, lote.length), urls)
    if (texto) partes.push(texto)
  }
  return partes.join('\n\n')
}

export const PROMPT_OCR_DOCUMENTO = `Transcribe TODO el texto visible en las imágenes, en orden de lectura: encabezados, párrafos, tablas (columnas separadas por " | "), criterios, fechas, sellos y notas al pie.
Transcripción literal: no resumas, no traduzcas, no agregues comentarios. Conserva el idioma original (español o inglés).
Si una imagen no tiene texto, escribe "[Sin texto]".`
