// lib/knowledge-base.ts — v5
// Embeddings: modelo local multilingüe (lib/embeddings.ts) → sin API, sin costo por uso
// PDFs: pdf-parse (texto digital, gratis) → si es escaneado, OCR con la visión de Groq

import { supabaseAdmin } from '@/lib/supabase-admin'
import { embedText, EMBED_MODEL } from '@/lib/embeddings'
import { groqVision, PROMPT_OCR_DOCUMENTO } from '@/lib/groq-vision'

const CHUNK_SIZE    = 800
const CHUNK_OVERLAP = 100
// Tope de páginas que se mandan a OCR por documento escaneado (cada página consume cuota de IA).
const MAX_OCR_PAGES = 40

export { EMBED_MODEL }

// ── generateEmbedding: modelo local; [] si falla (la búsqueda cae a texto) ────
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    return await embedText(text)
  } catch (e: any) {
    console.warn('[embedding] Modelo local falló:', e?.message)
    return []
  }
}

// ── Extraer texto de PDF con pdf-parse (sin IA, gratis, sin límites) ────────────
// Funciona perfecto con PDFs digitales (libros, artículos, guías)
// No funciona con PDFs escaneados (solo imágenes) → fallback a Gemini Vision
async function extractTextWithPdfParse(buffer: ArrayBuffer): Promise<string> {
  try {
    // pdf-parse v2 exporta la CLASE `PDFParse` (no una función como v1).
    // API: new PDFParse({ data }).getText() → { pages, text, total }
    const mod = await import('pdf-parse') as any
    const PDFParse = mod.PDFParse ?? mod.default?.PDFParse ?? mod.default
    if (typeof PDFParse !== 'function') {
      console.warn('[pdf-parse] Clase PDFParse no encontrada en el módulo')
      return ''
    }
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    try {
      const result = await parser.getText()
      const text = (result?.text || '').trim()
      console.log(`[pdf-parse] Extraído: ${text.length} chars, ${result?.total} páginas`)
      return text
    } finally {
      try { await parser.destroy?.() } catch { /* noop */ }
    }
  } catch (e: any) {
    console.warn('[pdf-parse] Error:', e?.message)
    return ''
  }
}

// ── Heurística anti-basura ────────────────────────────────────────────────────
// El extractor manual de respaldo (extractPdfTextFallback) puede devolver "puro
// símbolo" cuando un PDF viene comprimido/escaneado. Antes eso se indexaba tal
// cual y ensuciaba el Cerebro IA. Esta función decide si un texto es realmente
// legible antes de aceptarlo.
export function esTextoLegible(text: string): boolean {
  if (!text || text.length < 50) return false
  const legibles = (text.match(/[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ0-9\s.,;:!?()"'%\-–—/]/g) || []).length
  const ratio = legibles / text.length
  const palabras = (text.match(/[a-zA-ZáéíóúñüÁÉÍÓÚÑ]{3,}/g) || []).length
  return ratio > 0.7 && palabras > 20
}

// ── extractTextFromPdf: pdf-parse primero → OCR (Groq visión) para escaneados → guarda anti-basura
export async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  // 1. Texto digital con pdf-parse (gratis, sin IA)
  const textoPdfParse = await extractTextWithPdfParse(buffer)
  if (textoPdfParse.length > 200 && esTextoLegible(textoPdfParse)) {
    console.log('[pdf] ✅ Texto extraído con pdf-parse (sin IA)')
    return textoPdfParse
  }

  // 2. PDF escaneado: renderizar páginas a imagen y leerlas con la visión de Groq
  console.log('[pdf] pdf-parse insuficiente, usando OCR (Groq visión)...')
  let textoOcr = ''
  try {
    textoOcr = await extractTextFromPdfWithOcr(buffer)
  } catch (e: any) {
    console.warn('[pdf] OCR falló:', e?.message)
  }

  // 3. Nunca indexar símbolos basura: si nada es legible, vacío (el documento queda "no procesado").
  if (esTextoLegible(textoOcr)) return textoOcr
  if (esTextoLegible(textoPdfParse)) return textoPdfParse
  console.warn('[pdf] ⚠️ No se obtuvo texto legible. No se indexará basura.')
  return ''
}

// ── Renderiza las páginas del PDF (pdf-parse + canvas) y las transcribe con Groq visión ──
export async function extractTextFromPdfWithOcr(buffer: ArrayBuffer, maxPages = MAX_OCR_PAGES): Promise<string> {
  const mod = await import('pdf-parse') as any
  const PDFParse = mod.PDFParse ?? mod.default?.PDFParse ?? mod.default
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const shots = await parser.getScreenshot({ first: maxPages, desiredWidth: 1400, imageDataUrl: false, imageBuffer: true })
    const pages: { data: Uint8Array; pageNumber: number }[] = shots?.pages || []
    if (pages.length === 0) return ''
    console.log(`[pdf-ocr] ${pages.length}/${shots.total} páginas → Groq visión`)
    return await groqVision(
      pages.map(pg => ({ data: pg.data, mime: 'image/png' })),
      (inicio, cantidad) => `${PROMPT_OCR_DOCUMENTO}
Son las páginas ${pages[inicio].pageNumber} a ${pages[inicio + cantidad - 1].pageNumber} de un documento clínico/educativo. Antes del texto de cada página escribe "=== PÁGINA N ===".`,
    )
  } finally {
    try { await parser.destroy?.() } catch { /* noop */ }
  }
}

// ── Fallback manual: extrae texto de PDFs con texto embebido ─────────────────
export function extractPdfTextFallback(buffer: ArrayBuffer): string {
  const raw    = new TextDecoder('latin1').decode(new Uint8Array(buffer))
  const chunks: string[] = []

  // Extraer bloques de texto BT...ET
  const btEtRegex = /BT([\s\S]*?)ET/g
  let match
  while ((match = btEtRegex.exec(raw)) !== null) {
    const inner = match[1]
    const tRegex = /\(([^)]{1,500})\)/g
    let t
    while ((t = tRegex.exec(inner)) !== null) {
      const clean = t[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\')
        .replace(/\\'/g, "'")
        .trim()
      if (clean.length > 2) chunks.push(clean)
    }
  }

  // Extraer texto legible de streams
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let sm
  while ((sm = streamRegex.exec(raw)) !== null) {
    const content = sm[1]
    if (/[a-zA-ZáéíóúñÁÉÍÓÚÑ]{4,}/.test(content) && !content.includes('\x00')) {
      const words = content.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ0-9\s,.;:!?()\-"']{10,}/g) || []
      chunks.push(...words)
    }
  }

  return chunks.join(' ').replace(/\s+/g, ' ').trim()
}

// ── Extraer texto de HTML ─────────────────────────────────────────────────────
export function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|br|tr|td|th|section|article)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim()
}

// ── Dividir texto en chunks con overlap ──────────────────────────────────────
export function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const words  = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  let i = 0

  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ')
    if (chunk.trim().length > 50) chunks.push(chunk.trim())
    i += chunkSize - overlap
  }

  return chunks
}

// ── Indexar documento: texto → chunks → embeddings → Supabase ────────────────
// Multi-tenant: los chunks heredan el centro_id del documento (knowledge_documents.centro_id).
export async function indexDocument(
  documentId: string,
  fullText: string,
  metadata: Record<string, any> = {}
): Promise<{ success: boolean; chunks: number; error?: string }> {
  try {
    const { data: docRow } = await supabaseAdmin
      .from('knowledge_documents').select('centro_id').eq('id', documentId).maybeSingle()
    const centroId = (docRow as { centro_id?: string | null } | null)?.centro_id ?? null
    if (!centroId) {
      return { success: false, chunks: 0, error: 'Documento sin centro asignado' }
    }

    if (!fullText || fullText.trim().length < 50) {
      return { success: false, chunks: 0, error: 'Texto insuficiente para indexar (menos de 50 caracteres)' }
    }

    const chunks = chunkText(fullText)
    if (chunks.length === 0) {
      return { success: false, chunks: 0, error: 'No se generaron chunks del texto' }
    }

    console.log(`[index] Indexando ${chunks.length} chunks para doc ${documentId}`)

    let indexed = 0
    let conEmbedding = 0
    const batchSize = 5

    for (let b = 0; b < chunks.length; b += batchSize) {
      const batch = chunks.slice(b, b + batchSize)

      await Promise.all(
        batch.map(async (chunk, idx) => {
          const chunkIdx = b + idx
          try {
            // Intentar embedding — si falla por cuota, guardar chunk igual (modo texto)
            let embeddingValue: string | null = null
            try {
              const embedding = await generateEmbedding(chunk)
              if (embedding.length > 0) {
                embeddingValue = `[${embedding.join(',')}]`
                conEmbedding++
              }
            } catch {
              // Sin cuota de embeddings — modo búsqueda por texto completo
            }

            // Guardar chunk SIEMPRE, con o sin embedding
            await supabaseAdmin.from('knowledge_chunks').insert({
              document_id: documentId,
              centro_id:   centroId,
              chunk_index: chunkIdx,
              contenido:   chunk,
              embedding:   embeddingValue,
              metadata: {
                ...metadata,
                chunk_index:   chunkIdx,
                total_chunks:  chunks.length,
                char_count:    chunk.length,
                sin_embedding: embeddingValue === null,
                embed_model:   embeddingValue ? EMBED_MODEL : null,
              },
            })
            indexed++
          } catch (e: any) {
            console.warn(`[index] Chunk ${chunkIdx} falló:`, e?.message)
          }
        })
      )

      if ((b + batchSize) % 50 === 0 || b + batchSize >= chunks.length) {
        console.log(`[index] Progreso: ${Math.min(b + batchSize, chunks.length)}/${chunks.length} chunks`)
      }

      if (b + batchSize < chunks.length) {
        await new Promise(r => setTimeout(r, 150))
      }
    }

    const exitoso = indexed > 0 && indexed >= Math.floor(chunks.length * 0.5)
    await supabaseAdmin
      .from('knowledge_documents')
      .update({ procesado: exitoso, total_chunks: indexed })
      .eq('id', documentId)

    console.log(`[index] Doc ${documentId}: ${indexed} chunks (${conEmbedding} con vector, ${indexed - conEmbedding} solo texto)`)

    if (indexed === 0) {
      return { success: false, chunks: 0, error: 'No se pudo guardar ningún fragmento del documento.' }
    }

    return { success: exitoso, chunks: indexed }

  } catch (error: any) {
    console.error('[index] Error fatal:', error)
    return { success: false, chunks: 0, error: error.message }
  }
}

// ── Centros cuyo conocimiento puede leer un centro ────────────────────────────
// El propio + la base COMPARTIDA: el Cerebro de los centros con plan Fundador (curado por la
// plataforma), que alimenta a ARIA y a los agentes de todas las clínicas. Caché de 5 min.
let cacheCompartidos: { ids: string[]; t: number } | null = null
export async function centrosConocimiento(centroId: string | null): Promise<string[]> {
  if (!centroId) return []
  if (!cacheCompartidos || Date.now() - cacheCompartidos.t > 300_000) {
    const { data } = await supabaseAdmin.from('centros').select('id, plans!inner(code)').eq('plans.code', 'fundador')
    cacheCompartidos = { ids: ((data || []) as { id: string }[]).map(c => c.id), t: Date.now() }
  }
  return [...new Set([centroId, ...cacheCompartidos.ids])]
}

// Solo los centros del plan Fundador alimentan (escriben) el Cerebro IA compartido
export async function esCentroFundador(centroId: string | null): Promise<boolean> {
  if (!centroId) return false
  await centrosConocimiento(centroId) // refresca la caché de centros Fundador
  return !!cacheCompartidos?.ids.includes(centroId)
}

// ── Buscar conocimiento relevante por similitud semántica ─────────────────────
// Multi-tenant: devuelve conocimiento del centro indicado + la base compartida. Sin centroId → nada.
export async function searchKnowledge(
  query: string,
  options: { maxResults?: number; threshold?: number; centroId: string | null }
): Promise<KnowledgeResult[]> {
  const { maxResults = 3, threshold = 0.55, centroId } = options // reducido de 6 para ahorrar tokens Groq
  if (!centroId) return []
  ensureEmbeddingsUpToDate()

  try {
    // Intentar búsqueda semántica (requiere cuota de embeddings)
    const queryEmbedding = await generateEmbedding(query)

    if (queryEmbedding.length > 0) {
      try {
        const permitidos = await centrosConocimiento(centroId)
        const { data: rpcData, error } = await supabaseAdmin.rpc('buscar_conocimiento_multi', {
          query_embedding:      `[${queryEmbedding.join(',')}]`,
          match_count:          maxResults * 5,
          similarity_threshold: threshold,
          p_centros:            permitidos,
        })
        const data = rpcData ? await filtrarPorCentro(rpcData as any[], permitidos, maxResults) : null
        if (!error && data && data.length > 0) {
          return data.map((r: any) => ({
            contenido: r.contenido,
            fuente:    r.titulo_doc,
            similitud: Math.round(r.similarity * 100),
            metadata:  r.metadata,
          }))
        }
      } catch { /* fallback a texto */ }
    }

    // Fallback: búsqueda por texto completo (PostgreSQL ILIKE)
    console.log('[search] Usando búsqueda por texto completo (sin embeddings)')
    const keywords = query.toLowerCase()
      .split(' ')
      .map((w: string) => w.replace(/[^a-záéíóúñü0-9]/gi, ''))
      .filter((w: string) => w.length > 3)
      .slice(0, 5)

    if (keywords.length === 0) return []

    const permitidosTxt = await centrosConocimiento(centroId)
    const { data: rows, error: ftsError } = await supabaseAdmin
      .from('knowledge_chunks')
      .select('contenido, metadata, document_id')
      .in('centro_id', permitidosTxt)
      .ilike('contenido', `%${keywords[0]}%`)
      .limit(maxResults * 4)

    if (ftsError || !rows) return []

    // Rankear por número de keywords encontradas en el chunk
    const scored = rows
      .map((row: any) => ({
        ...row,
        score: keywords.filter((kw: string) => row.contenido.toLowerCase().includes(kw)).length,
      }))
      .filter((r: any) => r.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, maxResults)

    const docIds = [...new Set(scored.map((r: any) => r.document_id))] as string[]
    const { data: docs } = await supabaseAdmin
      .from('knowledge_documents')
      .select('id, titulo')
      .in('centro_id', permitidosTxt)
      .in('id', docIds)

    const docMap: Record<string, string> = {}
    docs?.forEach((d: any) => { docMap[d.id] = d.titulo })

    return scored.map((r: any) => ({
      contenido: r.contenido,
      fuente:    docMap[r.document_id] || 'Documento',
      similitud: Math.min(95, r.score * 20 + 40),
      metadata:  r.metadata,
    }))

  } catch (error: any) {
    console.error('[search] Error:', error?.message)
    return []
  }
}

// ── Búsqueda DIRECTA por código de protocolo (F24, D1, B12…) ──────────────────
// La búsqueda semántica/keyword no recupera bien códigos exactos ("f24" es muy
// corto). Esta función detecta códigos en el texto y trae el chunk EXACTO por
// metadata.codigo, para que la IA cite el ítem correcto tal cual (sin inventar).
export async function buscarItemsPorCodigo(texto: string, centroId: string | null): Promise<string> {
  if (!texto || !centroId) return ''
  const codigos = Array.from(new Set(
    (texto.toUpperCase().match(/\b[A-Z]\s?-?\s?\d{1,2}\b/g) || [])
      .map(c => c.replace(/[\s-]/g, ''))
      .filter(c => /^[A-Z]\d{1,2}$/.test(c))
  )).slice(0, 8)
  if (codigos.length === 0) return ''

  try {
    const { data } = await supabaseAdmin
      .from('knowledge_chunks')
      .select('contenido, metadata')
      .in('centro_id', await centrosConocimiento(centroId))
      .in('metadata->>codigo', codigos)
      .limit(16)

    if (!data || data.length === 0) return ''
    const bloques = (data as any[]).map(r => r.contenido).join('\n\n')
    return `\n━━━ ÍTEM(S) DE PROTOCOLO SOLICITADO(S) — CITA TEXTUAL, NO INVENTAR ━━━\n${bloques}\n━━━ FIN ÍTEM(S) DE PROTOCOLO ━━━\n`
  } catch {
    return ''
  }
}

// ── Obtener instrucciones del centro ─────────────────────────────────────────
export async function getCentroInstrucciones(centroId: string | null): Promise<string> {
  if (!centroId) return ''
  try {
    const { data } = await supabaseAdmin
      .from('centro_instrucciones')
      .select('titulo, contenido, prioridad')
      .eq('centro_id', centroId)
      .eq('activo', true)
      .order('prioridad', { ascending: false })
      .limit(10)

    if (!data || data.length === 0) return ''

    return `\n━━━ INSTRUCCIONES DEL CENTRO ━━━\n` +
      data.map((i: any) => `[${i.titulo}]: ${i.contenido}`).join('\n') +
      `\n━━━ FIN INSTRUCCIONES ━━━\n`
  } catch {
    return ''
  }
}

// ── Construir contexto completo para la IA ────────────────────────────────────
export async function buildKnowledgeContext(query: string, centroId: string | null, childContext?: string): Promise<string> {
  const [resultados, instrucciones] = await Promise.all([
    searchKnowledge(query, { centroId }),
    getCentroInstrucciones(centroId),
  ])

  let context = instrucciones

  if (resultados.length > 0) {
    context += `\n━━━ CONOCIMIENTO CLÍNICO RELEVANTE ━━━\n`
    resultados.forEach((r, i) => {
      context += `\n[Fuente ${i + 1}: ${r.fuente} | ${r.similitud}% relevancia]\n${r.contenido}\n`
    })
    context += `━━━ FIN CONOCIMIENTO ━━━\n`
  }

  if (childContext) context += childContext
  return context
}

// ── Filtro de tenant para resultados del RPC vectorial ───────────────────────
// Defensa extra: solo filas de los centros permitidos (propio + base compartida).
async function filtrarPorCentro(rows: any[], permitidos: string[], max: number): Promise<any[]> {
  const ok = new Set(permitidos)
  return rows.filter(r => r.centro_id && ok.has(r.centro_id)).slice(0, max)
}

// ── Tipos exportados ──────────────────────────────────────────────────────────
export interface KnowledgeResult {
  contenido: string
  fuente:    string
  similitud: number
  metadata:  any
}


// ── Re-indexado de embeddings ─────────────────────────────────────────────────
// Rellena los fragmentos sin vector o generados con otro modelo. Se dispara solo (una vez por proceso)
// desde la búsqueda, y en segundo plano: no bloquea la respuesta al usuario.
let reindexando: Promise<number> | null = null
let reindexCompleto = false

export async function reembedPendingChunks(maxChunks = 5000): Promise<number> {
  let total = 0
  while (total < maxChunks) {
    const { data: rows, error } = await supabaseAdmin
      .from('knowledge_chunks')
      .select('id, contenido, metadata')
      .or(`metadata->>embed_model.is.null,metadata->>embed_model.neq."${EMBED_MODEL}"`)
      .limit(32)
    if (error) { console.warn('[reindex]', error.message); break }
    if (!rows || rows.length === 0) break

    const { embedTexts } = await import('@/lib/embeddings')
    const vecs = await embedTexts(rows.map((r: any) => r.contenido || ''))
    await Promise.all(rows.map((r: any, i: number) => supabaseAdmin
      .from('knowledge_chunks')
      .update({
        embedding: vecs[i]?.length ? `[${vecs[i].join(',')}]` : null,
        metadata: { ...(r.metadata || {}), embed_model: EMBED_MODEL, sin_embedding: !vecs[i]?.length },
      })
      .eq('id', r.id)))
    total += rows.length
    if (total % 320 === 0) console.log(`[reindex] ${total} fragmentos re-indexados…`)
  }
  if (total > 0) console.log(`[reindex] ✅ ${total} fragmentos con vector (${EMBED_MODEL})`)
  return total
}

export function ensureEmbeddingsUpToDate(): void {
  if (reindexCompleto || reindexando) return
  reindexando = reembedPendingChunks()
    .then(n => { reindexCompleto = true; return n })
    .catch(e => { console.warn('[reindex] falló:', e?.message); return 0 })
    .finally(() => { reindexando = null })
}
