// app/api/knowledge/seed-protocolos/route.ts
//
// Endpoint "one-click" para importar protocolos preestablecidos al Cerebro IA.
// El admin solo presiona un botón en KnowledgeBaseView → la IA recibe los items.
//
// Soporta varios protocolos identificados por `preset`:
//   - abllsr-d  → ABLLS-R Sección D (Imitación motriz) · 27 ítems
//   (futuro: abllsr-a, abllsr-b, ..., afls-bls, ...)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, unauthorized, forbidden } from '@/lib/api-auth'
import { esCentroFundador } from '@/lib/knowledge-base'
import { generateEmbedding } from '@/lib/knowledge-base'
import { ABLLSR_SECCIONES } from '@/app/api/knowledge/data/abllsr-protocolo'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300

// ─── PRESETS: ABLLS-R completo (25 secciones A–Z, 545 ítems) ─────────────
// Los datos viven en app/api/knowledge/data/abllsr-protocolo.ts (auto-generado
// desde el Protocolo ABLLS-R). Cada sección es un preset: 'abllsr-a' … 'abllsr-z'.
type PresetData = { titulo: string; fuente: string; area: string; descripcion: string; items: { codigo: string; nombre: string; objetivo: string; criterios: string }[] }

const PRESETS: Record<string, PresetData> = Object.fromEntries(
  ABLLSR_SECCIONES.map(s => [s.preset, { titulo: s.titulo, fuente: s.fuente, area: s.area, descripcion: s.descripcion, items: s.items }])
)


// ─── GET: listar presets disponibles (para la UI del Cerebro IA) ──────────
export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  const presets = ABLLSR_SECCIONES.map(s => ({
    preset: s.preset,
    letra: s.letra,
    titulo: s.titulo,
    area: s.area,
    items: s.items.length,
  }))
  return NextResponse.json({ presets, total_items: presets.reduce((a, p) => a + p.items, 0) })
}

function formatChunk(item: any, fuente: string, area: string): string {
  return [
    `Código: ${item.codigo}`,
    `Tarea: ${item.nombre}`,
    `Área: ${area}`,
    `Fuente: ${fuente}`,
    `Objetivo: ${item.objetivo}`,
    `Criterios de logro: ${item.criterios}`,
  ].join('\n')
}

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.admins)) return forbidden()
  if (!(await esCentroFundador(caller.centroId))) return NextResponse.json({ error: 'plan_fundador' }, { status: 403 })
  try {
    const { preset, force } = await req.json()
    if (!preset || !PRESETS[preset]) {
      return NextResponse.json({
        error: 'preset no encontrado',
        disponibles: Object.keys(PRESETS),
      }, { status: 400 })
    }

    const data = PRESETS[preset]

    // 1. Si ya existe, eliminar o avisar
    const { data: existente } = await supabaseAdmin
      .from('knowledge_documents')
      .select('id, total_chunks')
      .eq('titulo', data.titulo)
      .eq('centro_id', caller.centroId)
      .maybeSingle()

    if (existente && !force) {
      return NextResponse.json({
        ok: false,
        ya_existe: true,
        existente: { id: existente.id, total_chunks: existente.total_chunks },
        mensaje: `Ya existe "${data.titulo}" con ${existente.total_chunks} chunks. Envía { force: true } para reemplazar.`,
      })
    }

    if (existente && force) {
      await supabaseAdmin.from('knowledge_chunks').delete().eq('document_id', existente.id).eq('centro_id', caller.centroId)
      await supabaseAdmin.from('knowledge_documents').delete().eq('id', existente.id).eq('centro_id', caller.centroId)
    }

    // 2. Crear documento
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('knowledge_documents')
      .insert({
        titulo: data.titulo,
        tipo: 'protocolo',
        descripcion: `${data.descripcion}\n\n[Fuente: ${data.fuente} · Área: ${data.area} · ${data.items.length} ítems · preset:${preset}]`,
        procesado: false,
        total_chunks: 0,
        centro_id: caller.centroId,
      })
      .select()
      .single()
    if (docErr) throw docErr
    const docId = (doc as any).id

    // 3. Insertar chunks (en lotes de 5 para no saturar HF)
    let indexados = 0, conEmbedding = 0
    for (let i = 0; i < data.items.length; i += 5) {
      const lote = data.items.slice(i, i + 5)
      await Promise.all(
        lote.map(async (item, idx) => {
          const chunkIdx = i + idx
          const contenido = formatChunk(item, data.fuente, data.area)

          let embeddingValue: string | null = null
          try {
            const emb = await generateEmbedding(contenido)
            if (emb.length > 0) {
              embeddingValue = `[${emb.join(',')}]`
              conEmbedding++
            }
          } catch { /* sin embedding, igual guardamos */ }

          try {
            await supabaseAdmin.from('knowledge_chunks').insert({
              document_id: docId,
              centro_id: caller.centroId,
              chunk_index: chunkIdx,
              contenido,
              embedding: embeddingValue,
              metadata: {
                codigo: item.codigo,
                nombre: item.nombre,
                fuente: data.fuente,
                area: data.area,
                item_type: 'protocolo_estructurado',
                sin_embedding: embeddingValue === null,
              },
            })
            indexados++
          } catch (e: any) {
            console.warn(`[seed-protocolos] chunk ${item.codigo} falló:`, e?.message)
          }
        })
      )
      if (i + 5 < data.items.length) await new Promise(r => setTimeout(r, 250))
    }

    // 4. Marcar como procesado
    await supabaseAdmin
      .from('knowledge_documents')
      .update({ procesado: indexados > 0, total_chunks: indexados })
      .eq('id', docId)

    return NextResponse.json({
      ok: true,
      document_id: docId,
      titulo: data.titulo,
      items_totales: data.items.length,
      chunks_indexados: indexados,
      con_embedding: conEmbedding,
      sin_embedding: indexados - conEmbedding,
    })
  } catch (e: any) {
    console.error('[seed-protocolos]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
