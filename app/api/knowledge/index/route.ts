// app/api/knowledge/index/route.ts
// Indexa un documento ya guardado en la DB (para libros grandes)
// El cliente lo llama después del ingest con needsIndex: true

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, rowInCentro, unauthorized, forbidden, notFound } from '@/lib/api-auth'
import { esCentroFundador } from '@/lib/knowledge-base'
import { indexDocument } from '@/lib/knowledge-base'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  if (!(await esCentroFundador(caller.centroId))) return NextResponse.json({ error: 'plan_fundador' }, { status: 403 })
  try {
    const { docId } = await req.json()
    if (!docId) return NextResponse.json({ error: 'docId requerido' }, { status: 400 })
    if (!(await rowInCentro('knowledge_documents', docId, caller.centroId))) return notFound()

    // Obtener el texto extraído guardado en el ingest
    const { data: doc, error } = await supabaseAdmin
      .from('knowledge_documents')
      .select('id, titulo, tipo, texto_extraido, procesado')
      .eq('id', docId)
      .single()

    if (error || !doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    if (doc.procesado) return NextResponse.json({ ok: true, message: 'Ya estaba indexado', chunks: 0 })
    if (!doc.texto_extraido) return NextResponse.json({ error: 'No hay texto para indexar' }, { status: 422 })

    const result = await indexDocument(docId, doc.texto_extraido, { titulo: doc.titulo, tipo: doc.tipo })

    return NextResponse.json({ ok: result.success, chunks: result.chunks, error: result.error })
  } catch (e: any) {
    console.error('[index] Error:', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
