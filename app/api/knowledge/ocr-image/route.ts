// app/api/knowledge/ocr-image/route.ts
//
// Recibe N imágenes (páginas renderizadas de un PDF escaneado) y devuelve
// el texto extraído por la visión de Groq. Permite hasta 8 imágenes por request
// para mantenerse bajo el límite de 4.5 MB de Vercel.
//
// Modo de uso desde el browser:
//   FormData con campos: page_<n> = Blob (image/jpeg)
//   y opcionalmente: titulo, tipo, descripcion (si se quiere indexar directo)

import { NextRequest, NextResponse } from 'next/server'
import { groqVision, PROMPT_OCR_DOCUMENTO } from '@/lib/groq-vision'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, unauthorized, forbidden } from '@/lib/api-auth'
import { esCentroFundador } from '@/lib/knowledge-base'
import { indexDocument } from '@/lib/knowledge-base'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  if (!(await esCentroFundador(caller.centroId))) return NextResponse.json({ error: 'plan_fundador' }, { status: 403 })
  try {
    const fd = await req.formData()

    const titulo = (fd.get('titulo') as string) || ''
    const tipo   = (fd.get('tipo') as string)   || 'libro'
    const descripcion = (fd.get('descripcion') as string) || ''
    const indexar = (fd.get('indexar') as string) === '1'

    // Recolectar imágenes ordenadas por número de página
    const imagenes: { pagina: number; buffer: ArrayBuffer; mime: string }[] = []
    for (const [key, value] of fd.entries()) {
      if (!key.startsWith('page_')) continue
      // En el runtime de Next.js (web standard), los File de FormData no son
      // siempre `instanceof File` — usamos duck-typing por arrayBuffer + type.
      const v: any = value
      if (!v || typeof v.arrayBuffer !== 'function') continue
      const pagina = parseInt(key.replace('page_', ''), 10)
      if (isNaN(pagina)) continue
      imagenes.push({
        pagina,
        buffer: await v.arrayBuffer(),
        mime: v.type || 'image/jpeg',
      })
    }
    if (imagenes.length === 0) {
      return NextResponse.json({ error: 'No se recibieron imágenes (campos page_N)' }, { status: 400 })
    }
    imagenes.sort((a, b) => a.pagina - b.pagina)

    // OCR con la visión de Groq (lotes de 3 imágenes por request)
    let texto = ''
    try {
      texto = await groqVision(
        imagenes.map(img => ({ data: img.buffer, mime: img.mime })),
        (inicio, cantidad) => `${PROMPT_OCR_DOCUMENTO}
Son las páginas ${imagenes.slice(inicio, inicio + cantidad).map(i => i.pagina).join(', ')} de un documento clínico/educativo escaneado.
Antes del texto de cada página escribe el separador exacto "=== PÁGINA N ===" con su número.`,
      )
    } catch (e: any) {
      const msg = String(e?.message || e)
      const cuota = /cuota|429/i.test(msg)
      return NextResponse.json({
        error: cuota ? 'AI_QUOTA_EXCEEDED' : 'No se pudo extraer texto',
        detalle: cuota ? 'Se agotó la cuota de IA de hoy para leer documentos. Se reinicia en 24 h.' : msg.slice(0, 300),
      }, { status: cuota ? 429 : 502 })
    }

    // Si quieren que también lo indexemos directo en el cerebro
    if (indexar && titulo) {
      if (texto.trim().length < 50) {
        return NextResponse.json({ ok: false, texto, indexed: false, error: 'Texto OCR muy corto' })
      }
      const { data: doc, error: dErr } = await supabaseAdmin
        .from('knowledge_documents')
        .insert({
          titulo,
          tipo,
          descripcion: `${descripcion || ''}\n\n[OCR · ${imagenes.length} págs ${imagenes[0].pagina}-${imagenes[imagenes.length-1].pagina}]`.trim(),
          procesado: false,
          total_chunks: 0,
          centro_id: caller.centroId,
        })
        .select('id')
        .single()
      if (dErr) throw dErr

      const result = await indexDocument(doc.id, texto, {
        fuente: 'OCR',
        paginas: imagenes.map(i => i.pagina),
      })
      return NextResponse.json({
        ok: result.success,
        document_id: doc.id,
        chunks: result.chunks,
        texto_chars: texto.length,
        paginas: imagenes.length,
        indexed: true,
      })
    }

    return NextResponse.json({
      ok: true,
      texto,
      texto_chars: texto.length,
      paginas: imagenes.length,
      indexed: false,
    })
  } catch (e: any) {
    console.error('[ocr-image]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
