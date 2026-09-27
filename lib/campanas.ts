// Notificaciones creadas a mano desde /control: calcula destinatarios y las envía como push (celular/web)
// y aviso en la campana de cada panel. Las programadas las despacha /api/cron/campanas cada 5 minutos.

import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { enviarPush, panelDeRol, type PoseAria } from '@/lib/push'

export const AUDIENCIAS = {
  directores: ['jefe', 'admin'],
  especialistas: ['especialista', 'terapeuta'],
  secretarias: ['secretaria'],
  padres: ['padre'],
} as const
export type Audiencia = keyof typeof AUDIENCIAS

export const POSES: PoseAria[] = ['saludo', 'celebra', 'feliz', 'guino', 'pensando', 'laptop', 'corre']

export function rolesDe(audiencia: string[]): string[] {
  return [...new Set(audiencia.flatMap(a => (AUDIENCIAS as Record<string, readonly string[]>)[a] ?? []))]
}

/** Personas que recibirían la campaña (solo cuentas de centros activos o en prueba). */
export async function destinatarios(audiencia: string[], centroId: string | null) {
  const roles = rolesDe(audiencia)
  if (!roles.length) return []
  let q = supabaseAdmin.from('profiles').select('id, role, centro_id, centros!inner(status)').in('role', roles).in('centros.status', ['trial', 'active'])
  if (centroId) q = q.eq('centro_id', centroId)
  const { data } = await q.limit(20000)
  return (data ?? []) as unknown as { id: string; role: string; centro_id: string }[]
}

/** Envía una campaña ya guardada. Idempotente: solo corre si sigue 'programada'. */
export async function enviarCampana(id: string) {
  // Se toma de forma atómica para que dos procesos no la manden dos veces
  const { data: c } = await supabaseAdmin.from('campanas_notificacion')
    .update({ estado: 'enviando' }).eq('id', id).eq('estado', 'programada')
    .select('*').maybeSingle()
  if (!c) return null

  const personas = await destinatarios(c.audiencia, c.centro_id)
  const staff = personas.filter(p => p.role !== 'padre')
  const padres = personas.filter(p => p.role === 'padre')
  const meta = { campana_id: c.id }

  // Campana (aviso dentro de la app), en lotes
  for (let i = 0; i < staff.length; i += 500) {
    await supabaseAdmin.from('notificaciones').insert(staff.slice(i, i + 500).map(p => ({
      user_id: p.id, centro_id: p.centro_id, tipo: 'aviso_plataforma', titulo: c.titulo, mensaje: c.cuerpo,
      prioridad: 2, canal: 'in_app', leida: false, metadata: meta,
    })))
  }
  for (let i = 0; i < padres.length; i += 500) {
    await supabaseAdmin.from('notifications').insert(padres.slice(i, i + 500).map(p => ({
      user_id: p.id, centro_id: p.centro_id, type: 'aviso_plataforma', title: c.titulo, message: c.cuerpo, is_read: false, metadata: meta,
    })))
  }

  // Push al celular / navegador, cada grupo con el enlace a su panel
  const grupos = new Map<string, string[]>()
  for (const p of personas) {
    const url = panelDeRol(p.role)
    grupos.set(url, [...(grupos.get(url) ?? []), p.id])
  }
  let push = 0
  for (const [url, ids] of grupos) {
    for (let i = 0; i < ids.length; i += 300) {
      push += await enviarPush(ids.slice(i, i + 300), { title: c.titulo, body: c.cuerpo, url, pose: (POSES.includes(c.pose) ? c.pose : 'saludo') as PoseAria, tag: `campana:${c.id}` })
    }
  }

  await supabaseAdmin.from('campanas_notificacion').update({
    estado: 'enviada', enviada_en: new Date().toISOString(), destinatarios: personas.length, enviados_push: push,
  }).eq('id', c.id)
  return { destinatarios: personas.length, push }
}

/** Envía las campañas cuya hora ya llegó. */
export async function procesarCampanasPendientes() {
  const { data } = await supabaseAdmin.from('campanas_notificacion').select('id')
    .eq('estado', 'programada').lte('programada_para', new Date().toISOString()).order('programada_para').limit(20)
  const res = []
  for (const c of data ?? []) res.push(await enviarCampana(c.id))
  return res.filter(Boolean).length
}
