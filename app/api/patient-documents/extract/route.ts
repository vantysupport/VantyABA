// app/api/patient-documents/extract/route.ts
//
// Extrae texto de los documentos del paciente (PDF, DOCX, imagen, TXT)
// y lo guarda en `patient_documents.extracted_text` para que la IA pueda
// citarlo cuando responda sobre ese paciente.
//
// Modos:
//   POST { document_id }                → procesar uno
//   POST { child_id, only_pending: 1 }  → procesar pendientes de un paciente
//   POST { all_pending: 1, limit: 50 }  → procesar pendientes de toda la base

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, canAccessChild, ROLES, unauthorized, forbidden, notFound } from '@/lib/api-auth'
import { extractTextFromPdf } from '@/lib/knowledge-base'
import { groqVision } from '@/lib/groq-vision'
import JSZip from 'jszip'
import { storageObjectOf, r2Key } from '@/lib/file-url'
import { r2Buffer } from '@/lib/r2'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300

const MAX_CHARS = 200_000  // tope para no llenar la BD si es un libro enorme

// ─── DOCX → texto (DOCX es un ZIP con document.xml dentro) ─────────────
async function extractDocx(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const docXml = await zip.file('word/document.xml')?.async('string')
  if (!docXml) return ''
  // Extrae todo el texto entre <w:t...>...</w:t>, preserva saltos de párrafo
  const text = docXml
    .replace(/<w:p[\s>][^<]*?>/g, '\n')      // párrafo → salto de línea
    .replace(/<w:br[^>]*\/>/g, '\n')         // brs
    .replace(/<[^>]+>/g, '')                 // resto de tags
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text
}

// ─── Imagen → OCR con la visión de Groq ─────────────────────────────────
async function extractImageWithVision(buffer: ArrayBuffer, mimeType: string): Promise<string> {
  return groqVision([{ data: buffer, mime: mimeType }], () => `Esta es una imagen relacionada con un paciente de un centro de neuropsicología.
Extrae TODA la información útil que veas: texto manuscrito o impreso, datos médicos, gráficos, esquemas, tablas, sellos, fechas, firmas, observaciones.
Si es una foto de un documento, transcribe el contenido completo en su idioma original (español o inglés).
Si es una foto del niño/a o de una actividad, describe brevemente qué se ve (sin describir rasgos personales, solo el contexto clínico relevante).
Responde SOLO con el contenido extraído, sin comentarios previos.`)
}

// ─── TXT/Markdown/CSV → directo ──────────────────────────────────────────
function extractText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8').decode(new Uint8Array(buffer))
  } catch {
    return new TextDecoder('latin1').decode(new Uint8Array(buffer))
  }
}

// ─── Dispatcher por mime type / extensión ───────────────────────────────
async function extraerSegunTipo(buffer: ArrayBuffer, fileName: string, fileType: string | null): Promise<{ texto: string; nota?: string }> {
  const name = (fileName || '').toLowerCase()
  const type = (fileType || '').toLowerCase()

  // PDF
  if (name.endsWith('.pdf') || type.includes('pdf')) {
    const texto = await extractTextFromPdf(buffer)
    return { texto }
  }

  // DOCX
  if (name.endsWith('.docx') || type.includes('officedocument.wordprocessingml')) {
    const texto = await extractDocx(buffer)
    return { texto }
  }

  // DOC viejo (Word 97-2003) — no soportado sin LibreOffice
  if (name.endsWith('.doc')) {
    return { texto: '', nota: 'Formato .doc (Word 97-2003) no soportado. Convierte a .docx o PDF.' }
  }

  // Imágenes → OCR con IA
  if (/\.(jpg|jpeg|png|webp|heic|heif|gif|bmp)$/i.test(name) || type.startsWith('image/')) {
    const mime = type.startsWith('image/') ? type : (
      name.endsWith('.png') ? 'image/png' :
      name.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
    )
    try {
      const texto = await extractImageWithVision(buffer, mime)
      return { texto }
    } catch (e: any) {
      return { texto: '', nota: `OCR falló: ${e?.message || 'IA no disponible'}` }
    }
  }

  // Texto plano
  if (/\.(txt|md|csv|json|xml|html?)$/i.test(name) || type.startsWith('text/')) {
    return { texto: extractText(buffer) }
  }

  // No soportado
  return { texto: '', nota: `Tipo de archivo no soportado para extracción automática: ${type || 'desconocido'}` }
}

// ─── Procesar un documento ──────────────────────────────────────────────
async function procesarDocumento(doc: any): Promise<{ ok: boolean; chars: number; error?: string }> {
  try {
    // El bucket es privado: se descarga con la clave de servicio a partir de bucket/ruta del file_url guardado.
    const obj = storageObjectOf(doc.file_url)
    if (!obj) throw new Error('Documento sin file_url')
    let fileBuffer: ArrayBuffer
    if (obj.r2) {
      const buf = await r2Buffer(r2Key(obj.bucket, obj.path))
      if (!buf) throw new Error('Archivo no encontrado')
      fileBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
    } else {
      const { data: blob, error: dlErr } = await supabaseAdmin.storage.from(obj.bucket).download(obj.path)
      if (dlErr || !blob) throw new Error(`Storage: ${dlErr?.message || 'no encontrado'}`)
      fileBuffer = await blob.arrayBuffer()
    }

    const { texto, nota } = await extraerSegunTipo(fileBuffer, doc.file_name || '', doc.file_type || null)

    if (!texto || texto.trim().length < 10) {
      await supabaseAdmin.from('patient_documents')
        .update({
          extraction_status: nota ? 'not_supported' : 'failed',
          extraction_error: nota || 'No se extrajo texto',
          extracted_at: new Date().toISOString(),
        })
        .eq('id', doc.id)
      return { ok: false, chars: 0, error: nota || 'sin texto' }
    }

    const textoLimitado = texto.length > MAX_CHARS ? texto.slice(0, MAX_CHARS) + '\n\n[…texto truncado por longitud]' : texto

    await supabaseAdmin.from('patient_documents')
      .update({
        extracted_text: textoLimitado,
        extracted_chars: textoLimitado.length,
        extraction_status: 'done',
        extraction_error: null,
        extracted_at: new Date().toISOString(),
      })
      .eq('id', doc.id)

    return { ok: true, chars: textoLimitado.length }
  } catch (e: any) {
    await supabaseAdmin.from('patient_documents')
      .update({
        extraction_status: 'failed',
        extraction_error: e?.message?.slice(0, 500) || 'Error desconocido',
        extracted_at: new Date().toISOString(),
      })
      .eq('id', doc.id)
    return { ok: false, chars: 0, error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : (e?.message || "error") }
  }
}

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const body = await req.json()
    const { document_id, child_id, only_pending, all_pending, limit } = body

    // ─── Modo 1: un solo documento ──────────────────────────────────
    if (document_id) {
      const { data: doc } = await supabaseAdmin
        .from('patient_documents')
        .select('*')
        .eq('id', document_id)
        .maybeSingle()
      if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
      if (doc.centro_id !== caller.centroId) return notFound()

      const result = await procesarDocumento(doc)
      return NextResponse.json({ ...result, document_id })
    }

    // ─── Modo 2: pendientes de un paciente ──────────────────────────
    if (child_id) {
      if (!(await canAccessChild(caller, child_id))) return notFound()
      let q = supabaseAdmin.from('patient_documents').select('*').eq('child_id', child_id)
      if (only_pending) q = q.in('extraction_status', ['pending', 'failed'])
      const { data: docs } = await q.limit(50)

      const resultados = []
      for (const d of (docs || [])) {
        resultados.push({ id: d.id, ...(await procesarDocumento(d)) })
      }
      return NextResponse.json({ ok: true, procesados: resultados.length, resultados })
    }

    // ─── Modo 3: todos los pendientes del sistema ───────────────────
    if (all_pending) {
      const { data: docs } = await supabaseAdmin
        .from('patient_documents')
        .select('*')
        .eq('centro_id', caller.centroId)
        .in('extraction_status', ['pending'])
        .limit(limit || 30)

      const resultados = []
      for (const d of (docs || [])) {
        resultados.push({ id: d.id, ...(await procesarDocumento(d)) })
      }
      return NextResponse.json({ ok: true, procesados: resultados.length, resultados })
    }

    return NextResponse.json({ error: 'Falta document_id, child_id o all_pending' }, { status: 400 })
  } catch (e: any) {
    console.error('[patient-documents/extract]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
