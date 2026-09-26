// Chat del equipo (director ↔ especialistas). El texto de los mensajes se guarda CIFRADO:
// por eso las pantallas leen y envían por aquí (el servidor cifra y descifra), no directo a la base.
//  GET  ?con=<id>     → conversación con esa persona (y la marca como leída)
//  GET  ?resumen=1    → último mensaje y no leídos por contacto
//  GET  ?id=<msg>     → un mensaje (lo usa el aviso en tiempo real)
//  POST { recipient_id, content, message_type?, file_url?, file_name?, file_type? } → enviar

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, rowInCentro, unauthorized, forbidden, notFound } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f-]{36}$/i
const entre = (a: string, b: string) => `and(sender_id.eq.${a},recipient_id.eq.${b}),and(sender_id.eq.${b},recipient_id.eq.${a})`

export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  const sp = req.nextUrl.searchParams

  // Un mensaje suelto (solo si participas en él)
  const id = sp.get('id')
  if (id) {
    if (!UUID.test(id)) return notFound()
    const { data } = await supabaseAdmin.from('chat_especialista_admin').select('*').eq('id', id).maybeSingle()
    if (!data || (data.sender_id !== caller.id && data.recipient_id !== caller.id)) return notFound()
    return NextResponse.json({ data })
  }

  // Resumen por contacto: último mensaje + no leídos
  if (sp.get('resumen') === '1') {
    const { data } = await supabaseAdmin
      .from('chat_especialista_admin')
      .select('sender_id, recipient_id, content, created_at, read_at, message_type')
      .or(`sender_id.eq.${caller.id},recipient_id.eq.${caller.id}`)
      .order('created_at', { ascending: false })
      .limit(1000)
    const resumen: Record<string, { last: { content: string | null; created_at: string; message_type: string | null } | null; unread: number }> = {}
    for (const m of data || []) {
      const otro = m.sender_id === caller.id ? m.recipient_id : m.sender_id
      if (!otro) continue
      resumen[otro] ??= { last: null, unread: 0 }
      if (!resumen[otro].last) resumen[otro].last = { content: m.content, created_at: m.created_at, message_type: m.message_type }
      if (m.sender_id === otro && !m.read_at) resumen[otro].unread++
    }
    return NextResponse.json({ data: resumen }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // Conversación con una persona del mismo centro
  const con = sp.get('con')
  if (!con || !UUID.test(con) || !(await rowInCentro('profiles', con, caller.centroId))) return notFound()
  const { data, error } = await supabaseAdmin
    .from('chat_especialista_admin')
    .select('*')
    .or(entre(caller.id, con))
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: 'No se pudo cargar' }, { status: 500 })
  const noLeidos = (data || []).filter(m => m.sender_id === con && !m.read_at).map(m => m.id)
  if (noLeidos.length) await supabaseAdmin.from('chat_especialista_admin').update({ read_at: new Date().toISOString() }).in('id', noLeidos)
  return NextResponse.json({ data: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  const b = await req.json().catch(() => ({}))
  const recipient = String(b.recipient_id || '')
  const content = typeof b.content === 'string' ? b.content.slice(0, 8000) : ''
  if (!UUID.test(recipient) || !content.trim()) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  if (!(await rowInCentro('profiles', recipient, caller.centroId))) return notFound()

  const { data: yo } = await supabaseAdmin.from('profiles').select('full_name').eq('id', caller.id).maybeSingle()
  const tipo = ['text', 'file', 'audio', 'image'].includes(b.message_type) ? b.message_type : 'text'
  const { data, error } = await supabaseAdmin.from('chat_especialista_admin').insert({
    content,
    sender_id: caller.id,
    sender_role: caller.role === 'admin' ? 'jefe' : caller.role,
    sender_name: yo?.full_name || 'Usuario',
    recipient_id: recipient,
    message_type: tipo,
    file_url: typeof b.file_url === 'string' ? b.file_url : null,
    file_name: typeof b.file_name === 'string' ? b.file_name.slice(0, 200) : null,
    file_type: typeof b.file_type === 'string' ? b.file_type.slice(0, 100) : null,
    read_at: null,
    centro_id: caller.centroId,
  }).select().single()
  if (error) return NextResponse.json({ error: 'No se pudo enviar' }, { status: 500 })
  return NextResponse.json({ data })
}
