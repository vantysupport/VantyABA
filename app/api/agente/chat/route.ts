// app/api/agente/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { vantyAgent } from '@/lib/vanty-agent'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkAriaRateLimit } from '@/lib/aria-rate-limit'
import { getApiCaller, hasRole, ROLES, canAccessChild, rowInCentro, unauthorized, forbidden, notFound } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const body = await req.json()
    const { mensaje, childId, conversacionId, contexto } = body
    // El usuario es siempre quien llama (no se confía en el userId del body).
    const userId = caller.id

    if (!mensaje) {
      return NextResponse.json({ error: 'mensaje y userId son requeridos' }, { status: 400 })
    }
    if (childId && !(await canAccessChild(caller, childId))) return notFound()

    // Rate limiting de ARIA para el personal (jefe/especialista), configurable en /control.
    const rl = await checkAriaRateLimit(String(userId), 'staff', caller.centroId)
    if (!rl.allowed) {
      // Sin "error" → el frontend muestra "respuesta" como mensaje de ARIA.
      return NextResponse.json({ respuesta: rl.message, rateLimited: true, conversacionId: conversacionId || null })
    }

    const locale = req.headers.get('x-locale') || 'es'
    const response = await vantyAgent.chat(mensaje, {
      childId, userId, conversacionId, contexto, locale, centroId: caller.centroId,
    })

    return NextResponse.json(response)
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const childId = searchParams.get('child_id')
  const userId = searchParams.get('user_id') ? caller.id : null

  try {
    if (childId && !(await canAccessChild(caller, childId))) return notFound()

    if (action === 'analisis_proactivo' && childId) {
      const analysis = await vantyAgent.analizarPacienteProactivo(childId, caller.centroId)
      return NextResponse.json(analysis)
    }

    if (action === 'alertas' && childId) {
      const { data } = await supabaseAdmin
        .from('agente_alertas')
        .select('*')
        .eq('child_id', childId)
        .eq('resuelta', false)
        .order('prioridad', { ascending: true })
        .order('created_at', { ascending: false })
      return NextResponse.json({ data })
    }

    if (action === 'alertas_todas') {
      const { data } = await supabaseAdmin
        .from('agente_alertas')
        .select('*, children(name)')
        .eq('centro_id', caller.centroId)
        .eq('resuelta', false)
        .order('prioridad', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(50)
      return NextResponse.json({ data })
    }

    if (action === 'conversaciones' && userId) {
      const { data } = await supabaseAdmin
        .from('agente_conversaciones')
        .select('id, titulo, contexto, created_at, child_id, children(name)')
        .eq('user_id', userId)
        .eq('activa', true)
        .order('updated_at', { ascending: false })
        .limit(20)
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const body = await req.json()
    const { action, id } = body
    if (!(await rowInCentro('agente_alertas', id, caller.centroId))) return notFound()

    if (action === 'resolver_alerta') {
      await supabaseAdmin
        .from('agente_alertas')
        .update({ resuelta: true })
        .eq('id', id)
      return NextResponse.json({ success: true })
    }

    if (action === 'marcar_leida') {
      await supabaseAdmin
        .from('agente_alertas')
        .update({ leida: true })
        .eq('id', id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const { searchParams } = new URL(req.url)
    const conversacionId = searchParams.get('conversacion_id')
    const userId = searchParams.get('user_id') ? caller.id : null

    if (!userId) {
      return NextResponse.json({ error: 'user_id requerido' }, { status: 400 })
    }

    // Borrar la conversación indicada o todas las del usuario (sus acciones se borran en cascada)
    if (conversacionId) {
      const { data: conv } = await supabaseAdmin
        .from('agente_conversaciones').select('id').eq('id', conversacionId).eq('user_id', userId).maybeSingle()
      if (!conv) return notFound()
      const { error } = await supabaseAdmin.from('agente_conversaciones').delete().eq('id', conversacionId).eq('user_id', userId)
      if (error) throw error
    } else {
      const { error } = await supabaseAdmin.from('agente_conversaciones').delete().eq('user_id', userId)
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
