// app/api/chat-familias/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'
import { getApiCaller, canAccessChild, hasRole, ROLES, unauthorized, forbidden, notFound } from '@/lib/api-auth'
import { avisarEquipo, avisarFamilia } from '@/lib/avisos'

// GET — cargar mensajes con avatar de cada remitente
export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  const { searchParams } = new URL(req.url)

  // Lista de conversaciones del centro (último mensaje por paciente) — solo el equipo
  if (searchParams.get('resumen') === '1') {
    if (!hasRole(caller, ROLES.staff)) return forbidden()
    const { data, error } = await supabaseAdmin
      .from('chat_familias')
      .select('child_id, content, message_type, sender_name, sender_id, sender_role, read_by, created_at, children(name)')
      .eq('centro_id', caller.centroId)
      .order('created_at', { ascending: false }).limit(300)
    if (error) return NextResponse.json({ error: 'No se pudo cargar' }, { status: 500 })
    return NextResponse.json({ data: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const childId = searchParams.get('child_id')
  const rawUserId = searchParams.get('user_id')
  // Solo se puede marcar como leído en nombre propio
  const userId  = rawUserId ? caller.id : null
  const limit   = Number(searchParams.get('limit') || 60)

  if (!childId) return NextResponse.json({ error: 'child_id requerido' }, { status: 400 })
  if (!(await canAccessChild(caller, childId))) return notFound()

  try {
    const { data, error } = await supabaseAdmin
      .from('chat_familias')
      .select('id, content, sender_id, sender_role, sender_name, read_by, message_type, file_url, file_name, file_size, created_at')
      .eq('child_id', childId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw error

    const messages = data || []

    // Obtener avatares únicos desde profiles
    const senderIds = [...new Set(messages.map(m => m.sender_id))]
    if (senderIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, avatar_url')
        .in('id', senderIds)

      const avatarMap: Record<string, string | null> = {}
      profiles?.forEach(p => { avatarMap[p.id] = p.avatar_url })

      // Inyectar sender_avatar en cada mensaje
      messages.forEach(m => {
        (m as any).sender_avatar = avatarMap[m.sender_id] || null
      })
    }

    // Marcar como leídos en background
    if (userId && messages.length) {
      const toUpdate = messages.filter(m => !m.read_by?.includes(userId));
      (async () => {
        for (const m of toUpdate) {
          try {
            await supabaseAdmin
              .from('chat_familias')
              .update({ read_by: [...(m.read_by || []), userId] })
              .eq('id', m.id)
          } catch {}
        }
      })()
    }

    return NextResponse.json({ data: messages })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

const MAX_MENSAJE = 4000
const TIPOS = ['text', 'image', 'audio', 'document']
const ENVIOS = { name: 'chat-envio', limit: 40, windowMs: 60 * 1000 }

// POST — enviar mensaje
export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  try {
    const body = await req.json().catch(() => ({}))
    const { child_id, sender_id, message_type, file_url, file_name, file_size } = body
    const content = typeof body.content === 'string' ? body.content.trim().slice(0, MAX_MENSAJE) : ''

    if (!child_id || !content || !sender_id) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }
    if (sender_id !== caller.id) return forbidden()
    if (!(await canAccessChild(caller, child_id))) return notFound()

    // Tope de envíos por persona (evita que un script llene el chat o sature el servidor)
    const limite = await rateLimit(`chat:${caller.id}`, ENVIOS)
    if (!limite.allowed) return NextResponse.json({ error: 'Estás enviando mensajes muy rápido. Espera un momento.' }, { status: 429 })

    // Solo tipos conocidos; un adjunto solo puede apuntar a la carpeta privada de ESTE niño
    const tipo = TIPOS.includes(message_type) ? message_type : 'text'
    const adjunto = tipo !== 'text' && typeof file_url === 'string' && file_url.startsWith(`r2:chat-media/chat-familias/${child_id}/`)
      ? file_url.slice(0, 400) : null
    if (tipo !== 'text' && !adjunto) return NextResponse.json({ error: 'Adjunto no válido' }, { status: 400 })

    // Nombre y rol los pone el servidor según la cuenta (nadie puede hacerse pasar por otro)
    const [{ data: childRow }, { data: perfil }] = await Promise.all([
      supabaseAdmin.from('children').select('centro_id, name, parent_id, specialist_id').eq('id', child_id).maybeSingle(),
      supabaseAdmin.from('profiles').select('full_name').eq('id', caller.id).maybeSingle(),
    ])
    const sender_name = (perfil?.full_name || caller.email?.split('@')[0] || 'Usuario').slice(0, 120)

    const { data, error } = await supabaseAdmin
      .from('chat_familias')
      .insert({
        child_id,
        centro_id:    childRow?.centro_id ?? null,
        content,
        sender_id,
        sender_role:  caller.role,
        sender_name,
        message_type: tipo,
        file_url:     adjunto,
        file_name:    adjunto && typeof file_name === 'string' ? file_name.slice(0, 200) : null,
        file_size:    adjunto && Number.isFinite(Number(file_size)) ? Number(file_size) : null,
        read_by:      [sender_id],
      })
      .select()
      .single()

    if (error) throw error

    // Aviso en la campana del otro lado (varios mensajes seguidos se agrupan en un solo aviso)
    if (childRow?.centro_id) {
      const texto = message_type && message_type !== 'text' ? null : String(content).trim().slice(0, 140)
      const vista = (en: boolean) => texto ?? (en ? 'Sent a file' : 'Envió un archivo')
      const nombre = childRow.name || ''
      if (caller.role === 'padre') {
        await avisarEquipo({
          centroId: childRow.centro_id, roles: ['jefe', 'admin'], extra: [childRow.specialist_id], excluir: caller.id,
          tipo: 'mensaje_familia', childId: child_id, prioridad: 1,
          titulo: { es: `Mensaje de ${sender_name} · ${nombre}`, en: `Message from ${sender_name} · ${nombre}` },
          mensaje: { es: vista(false), en: vista(true) },
          agrupar: (prev, en) => {
            const n = Number(prev.n ?? 1) + 1
            return { titulo: en ? `${n} new messages · ${nombre}` : `${n} mensajes nuevos · ${nombre}`, mensaje: `${sender_name}: ${vista(en)}`, metadata: { ...prev, n } }
          },
        })
      } else if (childRow.parent_id && childRow.parent_id !== caller.id) {
        await avisarFamilia({
          parentId: childRow.parent_id, centroId: childRow.centro_id, type: 'mensaje_centro', childId: child_id,
          title: { es: `Nuevo mensaje de ${sender_name}`, en: `New message from ${sender_name}` },
          message: { es: vista(false), en: vista(true) },
          agrupar: (prev, en) => {
            const n = Number(prev.n ?? 1) + 1
            return { title: en ? `${n} new messages from the center` : `${n} mensajes nuevos del centro`, message: `${sender_name}: ${vista(en)}`, metadata: { ...prev, n } }
          },
        })
      }
    }
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

// PATCH — marcar mensajes como leídos
export async function PATCH(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  try {
    const { child_id, user_id } = await req.json()
    if (!child_id || !user_id) return NextResponse.json({ ok: false })
    if (user_id !== caller.id) return forbidden()
    if (!(await canAccessChild(caller, child_id))) return notFound()

    const { data: msgs } = await supabaseAdmin
      .from('chat_familias')
      .select('id, read_by')
      .eq('child_id', child_id)
      .not('sender_id', 'eq', user_id)

    const toUpdate = (msgs || []).filter(m => !m.read_by?.includes(user_id))

    for (const m of toUpdate) {
      await supabaseAdmin
        .from('chat_familias')
        .update({ read_by: [...(m.read_by || []), user_id] })
        .eq('id', m.id)
    }

    return NextResponse.json({ ok: true, marked: toUpdate.length })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
