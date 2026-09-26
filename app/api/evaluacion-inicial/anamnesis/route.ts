// app/api/evaluacion-inicial/anamnesis/route.ts
// El padre completa la SEGUNDA anamnesis (psicológica o neuropsicológica)
// dependiendo de la recomendación. Las respuestas se guardan en
// `anamnesis_especifica` (JSONB) y avanza al estado 'anamnesis_completa'.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, canAccessChild, rowInCentro, unauthorized, forbidden, notFound } from '@/lib/api-auth'

// Evaluación → su paciente/centro, para verificar acceso antes de tocarla.
async function evalOwner(id: string | null | undefined) {
  if (!id) return null
  const { data } = await supabaseAdmin.from('evaluaciones_iniciales').select('child_id, centro_id').eq('id', id).maybeSingle()
  return data as { child_id: string; centro_id: string | null } | null
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  try {
    const { evaluacion_id, respuestas } = await req.json()
    if (!evaluacion_id || !respuestas) {
      return NextResponse.json({ error: 'evaluacion_id y respuestas requeridos' }, { status: 400 })
    }
    const owner = await evalOwner(evaluacion_id)
    if (!owner || !(await canAccessChild(caller, owner.child_id))) return notFound()

    const ahora = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .update({
        anamnesis_especifica: respuestas,
        anamnesis_completada_en: ahora,
        anamnesis_llenado_por: caller.id,
        anamnesis_llenado_rol: caller.role,
        estado: 'anamnesis_completa',
        updated_at: ahora,
      })
      .eq('id', evaluacion_id)
      .select()
      .single()
    if (error) throw error

    // 🔮 En paralelo, fire-and-forget:
    //   • Recomendación IA de terapias del catálogo
    //   • Generación del informe Word (que aparecerá en Historial & IA)
    try {
      const base = new URL(req.url)
      const recUrl = new URL('/api/evaluacion-inicial/recomendar-terapias', base)
      const wordUrl = new URL('/api/evaluacion-inicial/generar-informe-word', base)
      // Reenviar la sesión de quien llama: esas rutas exigen autenticación.
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const authz = req.headers.get('authorization'); if (authz) headers.authorization = authz
      const cookie = req.headers.get('cookie'); if (cookie) headers.cookie = cookie
      const body = JSON.stringify({ evaluacion_id })
      fetch(recUrl.toString(),  { method: 'POST', headers, body }).catch(() => {})
      fetch(wordUrl.toString(), { method: 'POST', headers, body }).catch(() => {})
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true, evaluacion: data })
  } catch (e: any) {
    console.error('[evaluacion-inicial][anamnesis]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
