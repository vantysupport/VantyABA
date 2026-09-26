// Avisos in-app (campana) + push al celular. El equipo del centro lee la tabla `notificaciones`;
// la familia lee `notifications`. Nunca lanzan: un aviso fallido no debe deshacer la acción que lo origina.

import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { enviarPush, estiloAviso, panelDeRol, conVista, type PoseAria } from '@/lib/push'

type Texto = { es: string; en: string }
type RolEquipo = 'jefe' | 'admin' | 'secretaria' | 'especialista'
/** Texto propio para el celular (más corto y con gancho); si falta se usa el del aviso */
type TextoPush = { titulo?: Texto; cuerpo?: Texto; pose?: PoseAria }

/** true si el centro trabaja en inglés (los avisos salen en su idioma). */
export async function centroEnIngles(centroId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('centros').select('locale_default').eq('id', centroId).maybeSingle()
  return data?.locale_default === 'en'
}

const ids = (v: string | null | undefined) => String(v ?? '').split(',').map(s => s.trim()).filter(Boolean)

/** Push a un grupo de personas, cada una con el enlace a la sección correcta de SU panel. */
async function pushPorRol(userIds: string[], tipo: string, tag: string, titulo: string, cuerpo: string, pose?: PoseAria) {
  if (userIds.length === 0) return
  const { data: perfiles } = await supabaseAdmin.from('profiles').select('id, role').in('id', userIds)
  const grupos = new Map<string, { ids: string[]; pose: PoseAria; url: string }>()
  for (const p of perfiles ?? []) {
    const est = estiloAviso(tipo, p.role)
    const url = conVista(panelDeRol(p.role), est.vista)
    const g = grupos.get(url) ?? { ids: [], pose: pose ?? est.pose, url }
    g.ids.push(p.id); grupos.set(url, g)
  }
  await Promise.all([...grupos.values()].map(g => enviarPush(g.ids, { title: titulo, body: cuerpo, url: g.url, pose: g.pose, tag })))
}

/**
 * Aviso para el equipo del centro: los roles indicados más destinatarios puntuales (p. ej. el especialista del niño).
 * `agrupar`: si el destinatario ya tiene un aviso sin leer del mismo tipo (y niño), se actualiza en vez de sumar otro.
 */
export async function avisarEquipo(o: {
  centroId: string
  roles?: RolEquipo[]
  extra?: (string | null | undefined)[]
  excluir?: string | null
  tipo: string
  titulo: Texto
  mensaje: Texto
  childId?: string | null
  metadata?: Record<string, unknown>
  prioridad?: number
  push?: TextoPush | false
  agrupar?: (previo: Record<string, unknown>, en: boolean) => { titulo: string; mensaje: string; metadata: Record<string, unknown> }
}) {
  try {
    const en = await centroEnIngles(o.centroId)
    const roles = o.roles ?? ['jefe', 'admin']
    const { data: equipo } = roles.length
      ? await supabaseAdmin.from('profiles').select('id').eq('centro_id', o.centroId).in('role', roles)
      : { data: [] as { id: string }[] }
    const destino = new Set([...(equipo ?? []).map(p => p.id), ...o.extra?.flatMap(ids) ?? []])
    if (o.excluir) destino.delete(o.excluir)
    if (destino.size === 0) return

    const tag = `${o.tipo}:${o.childId ?? o.centroId}`
    let pendientes = [...destino]
    if (o.agrupar) {
      let q = supabaseAdmin.from('notificaciones').select('id, user_id, metadata')
        .eq('tipo', o.tipo).eq('leida', false).in('user_id', pendientes)
      q = o.childId ? q.eq('child_id', o.childId) : q
      const { data: previos } = await q
      for (const p of previos ?? []) {
        const n = o.agrupar((p.metadata ?? {}) as Record<string, unknown>, en)
        await supabaseAdmin.from('notificaciones').update({ titulo: n.titulo, mensaje: n.mensaje, metadata: n.metadata, created_at: new Date().toISOString() }).eq('id', p.id)
        if (o.push !== false) await pushPorRol([p.user_id], o.tipo, tag, n.titulo, n.mensaje, o.push?.pose)
      }
      const ya = new Set((previos ?? []).map(p => p.user_id))
      pendientes = pendientes.filter(u => !ya.has(u))
    }
    if (pendientes.length === 0) return
    const titulo = en ? o.titulo.en : o.titulo.es
    const mensaje = en ? o.mensaje.en : o.mensaje.es
    await supabaseAdmin.from('notificaciones').insert(pendientes.map(uid => ({
      user_id: uid, centro_id: o.centroId, child_id: o.childId ?? null, tipo: o.tipo, titulo, mensaje,
      prioridad: o.prioridad ?? 2, canal: 'in_app', leida: false, metadata: { ...(o.metadata ?? {}), n: 1 },
    })))
    if (o.push !== false) {
      const pt = o.push?.titulo ? (en ? o.push.titulo.en : o.push.titulo.es) : titulo
      const pc = o.push?.cuerpo ? (en ? o.push.cuerpo.en : o.push.cuerpo.es) : mensaje
      await pushPorRol(pendientes, o.tipo, tag, pt, pc, o.push?.pose)
    }
  } catch (e) {
    console.error('[avisos] equipo:', e)
  }
}

/** Aviso para una familia (portal del padre). Con `agrupar`, reutiliza el aviso sin leer del mismo tipo y niño. */
export async function avisarFamilia(o: {
  parentId: string | null | undefined
  centroId: string
  type: string
  title: Texto
  message: Texto
  childId?: string | null
  metadata?: Record<string, unknown>
  push?: TextoPush | false
  agrupar?: (previo: Record<string, unknown>, en: boolean) => { title: string; message: string; metadata: Record<string, unknown> }
}) {
  if (!o.parentId) return
  try {
    const en = await centroEnIngles(o.centroId)
    const est = estiloAviso(o.type, 'padre')
    const envio = (titulo: string, cuerpo: string) => o.push === false ? Promise.resolve(0) : enviarPush([o.parentId], {
      title: titulo, body: cuerpo, url: conVista('/padre', est.vista), pose: o.push?.pose ?? est.pose, tag: `${o.type}:${o.childId ?? ''}`,
    })
    if (o.agrupar) {
      let q = supabaseAdmin.from('notifications').select('id, metadata')
        .eq('user_id', o.parentId).eq('type', o.type).eq('is_read', false)
      q = o.childId ? q.eq('child_id', o.childId) : q
      const { data: previo } = await q.limit(1).maybeSingle()
      if (previo) {
        const n = o.agrupar((previo.metadata ?? {}) as Record<string, unknown>, en)
        await supabaseAdmin.from('notifications').update({ title: n.title, message: n.message, metadata: n.metadata, created_at: new Date().toISOString() }).eq('id', previo.id)
        await envio(n.title, n.message)
        return
      }
    }
    const title = en ? o.title.en : o.title.es
    const message = en ? o.message.en : o.message.es
    await supabaseAdmin.from('notifications').insert({
      user_id: o.parentId, centro_id: o.centroId, child_id: o.childId ?? null, type: o.type,
      title, message, is_read: false, metadata: { ...(o.metadata ?? {}), n: 1 },
    })
    const pt = o.push && o.push.titulo ? (en ? o.push.titulo.en : o.push.titulo.es) : title
    const pc = o.push && o.push.cuerpo ? (en ? o.push.cuerpo.en : o.push.cuerpo.es) : message
    await envio(pt, pc)
  } catch (e) {
    console.error('[avisos] familia:', e)
  }
}

/** Fecha corta legible: "sáb 27 sep" / "Sat, Sep 27" */
export function diaCorto(fecha: string, en: boolean) {
  const d = new Date(`${String(fecha).slice(0, 10)}T12:00:00Z`)
  return isNaN(d.getTime()) ? String(fecha) : d.toLocaleDateString(en ? 'en-US' : 'es-PE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '')
}

/** Aviso a la familia cuando el centro crea, mueve o cancela una cita de su hijo. */
export async function avisarCitaFamilia(
  apt: { id?: string; child_id?: string | null; appointment_date?: string | null; appointment_time?: string | null; service_type?: string | null },
  tipo: 'nueva' | 'actualizada' | 'cancelada',
) {
  if (!apt.child_id || !apt.appointment_date) return
  try {
    const { data: c } = await supabaseAdmin.from('children').select('name, parent_id, centro_id').eq('id', apt.child_id).maybeSingle()
    if (!c?.parent_id || !c.centro_id) return
    const n = c.name || ''
    const h = String(apt.appointment_time ?? '').slice(0, 5)
    const s = apt.service_type || null
    const f = (en: boolean) => `${diaCorto(apt.appointment_date!, en)}${h ? (en ? ` at ${h}` : ` a las ${h}`) : ''}`
    const T = {
      nueva: {
        title: { es: `Nueva cita · ${n}`, en: `New appointment · ${n}` },
        message: { es: `${s ?? 'Terapia'} el ${f(false)}.`, en: `${s ?? 'Therapy'} on ${f(true)}.` },
        push: { titulo: { es: `¡${n} tiene nueva cita!`, en: `${n} has a new appointment!` }, cuerpo: { es: `${s ?? 'Terapia'} el ${f(false)}. Te esperamos.`, en: `${s ?? 'Therapy'} on ${f(true)}. See you there.` }, pose: 'celebra' as const },
      },
      actualizada: {
        title: { es: `Cambió la cita de ${n}`, en: `${n}'s appointment changed` },
        message: { es: `Ahora es el ${f(false)}.`, en: `It is now on ${f(true)}.` },
        push: { titulo: { es: `Ojo: la cita de ${n} cambió`, en: `Heads up: ${n}'s appointment moved` }, cuerpo: { es: `Ahora es el ${f(false)}.`, en: `It is now on ${f(true)}.` }, pose: 'pensando' as const },
      },
      cancelada: {
        title: { es: `Cita cancelada · ${n}`, en: `Appointment cancelled · ${n}` },
        message: { es: `La cita del ${f(false)} se canceló. Si quieres otra fecha, escríbenos.`, en: `The appointment on ${f(true)} was cancelled. Message us for a new date.` },
        push: { titulo: { es: `Se canceló la cita de ${n}`, en: `${n}'s appointment was cancelled` }, cuerpo: { es: `Era el ${f(false)}. Escríbenos si quieres otra fecha.`, en: `It was on ${f(true)}. Message us for a new date.` }, pose: 'pensando' as const },
      },
    }[tipo]
    await avisarFamilia({
      parentId: c.parent_id, centroId: c.centro_id, type: `cita_${tipo}`, childId: apt.child_id,
      title: T.title, message: T.message, push: T.push, metadata: { appointment_id: apt.id ?? null },
    })
  } catch (e) {
    console.error('[avisos] cita familia:', e)
  }
}
