// app/api/knowledge/seed-archivos/route.ts
//
// Carga conocimiento al Cerebro IA desde archivos de texto versionados en el
// repo (carpeta /knowledge-seed). 100% confiable: NO pasa por extracción de PDF,
// así que nunca produce "símbolos basura". Cada archivo .md/.txt = un documento.
//
// GET  → lista los archivos disponibles.
// POST → { archivo?: string, force?: boolean } indexa uno (o todos si no se
//        especifica). force:true reemplaza el documento si ya existía.

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { indexDocument } from '@/lib/knowledge-base'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300

const SEED_DIR = path.join(process.cwd(), 'knowledge-seed')
const EXT_OK = /\.(md|markdown|txt)$/i

// Título legible a partir del nombre del archivo: "guia-manejo_conductas.md" → "Guia manejo conductas"
function tituloDesdeArchivo(nombre: string): string {
  const base = nombre.replace(EXT_OK, '').replace(/[-_]+/g, ' ').trim()
  return base.charAt(0).toUpperCase() + base.slice(1)
}

function listarArchivos(): { archivo: string; bytes: number }[] {
  try {
    return fs.readdirSync(SEED_DIR)
      .filter(f => EXT_OK.test(f) && !/^readme/i.test(f))
      .map(f => {
        try { return { archivo: f, bytes: fs.statSync(path.join(SEED_DIR, f)).size } }
        catch { return { archivo: f, bytes: 0 } }
      })
  } catch {
    return []
  }
}

export async function GET() {
  return NextResponse.json({ dir: 'knowledge-seed', archivos: listarArchivos() })
}

export async function POST(req: NextRequest) {
  try {
    const { archivo, force } = await req.json().catch(() => ({}))

    const objetivo = archivo
      ? [path.basename(String(archivo))]           // solo el nombre base — evita path traversal
      : listarArchivos().map(a => a.archivo)

    if (objetivo.length === 0) {
      return NextResponse.json({ ok: false, error: 'No hay archivos .md/.txt en /knowledge-seed' }, { status: 400 })
    }

    const resultados: any[] = []

    for (const nombre of objetivo) {
      // Seguridad: nombre sin separadores ni ".." y con extensión válida
      if (nombre.includes('/') || nombre.includes('\\') || nombre.includes('..') || !EXT_OK.test(nombre)) {
        resultados.push({ archivo: nombre, ok: false, error: 'nombre inválido' })
        continue
      }

      const full = path.join(SEED_DIR, nombre)
      let contenido = ''
      try {
        contenido = fs.readFileSync(full, 'utf8')
      } catch {
        resultados.push({ archivo: nombre, ok: false, error: 'no se pudo leer el archivo' })
        continue
      }
      if (contenido.trim().length < 50) {
        resultados.push({ archivo: nombre, ok: false, error: 'contenido insuficiente (<50 caracteres)' })
        continue
      }

      const titulo = tituloDesdeArchivo(nombre)

      // Si ya existe un documento con ese título, reemplazar (force) o avisar
      const { data: existente } = await supabaseAdmin
        .from('knowledge_documents')
        .select('id')
        .eq('titulo', titulo)
        .maybeSingle()

      if (existente && !force) {
        resultados.push({ archivo: nombre, ok: false, ya_existe: true, mensaje: 'Ya existe. Usa force:true para reemplazar.' })
        continue
      }
      if (existente && force) {
        await supabaseAdmin.from('knowledge_chunks').delete().eq('document_id', existente.id)
        await supabaseAdmin.from('knowledge_documents').delete().eq('id', existente.id)
      }

      // Crear documento e indexar (chunks + embeddings) — mismo pipeline que el resto del Cerebro IA
      const { data: doc, error: docErr } = await supabaseAdmin
        .from('knowledge_documents')
        .insert({
          titulo,
          tipo: 'documento',
          descripcion: `Cargado desde knowledge-seed/${nombre}`,
          procesado: false,
          total_chunks: 0,
        })
        .select('id')
        .single()

      if (docErr || !doc) {
        resultados.push({ archivo: nombre, ok: false, error: docErr?.message || 'no se pudo crear el documento' })
        continue
      }

      const r = await indexDocument((doc as any).id, contenido, {
        fuente: titulo,
        origen: 'knowledge-seed',
        archivo: nombre,
      })
      resultados.push({ archivo: nombre, ok: r.success, chunks: r.chunks, error: r.error })
    }

    const totalChunks = resultados.reduce((a, r) => a + (r.chunks || 0), 0)
    return NextResponse.json({ ok: true, archivos_procesados: resultados.length, total_chunks: totalChunks, resultados })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === 'production' ? 'Ocurrió un error. Intentá de nuevo.' : e.message }, { status: 500 })
  }
}
