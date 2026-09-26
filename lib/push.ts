// Notificaciones push al celular (web-push). Estilo "Duolingo": ARIA a la derecha con una pose según el
// aviso, título con gancho, texto corto y botones de acción. Nunca lanzan.

import 'server-only'
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase-admin'

export type PoseAria = 'saludo' | 'celebra' | 'pensando' | 'feliz' | 'guino' | 'laptop' | 'corre'

export type Push = {
  title: string
  body: string
  /** Ruta que abre al tocarla, p. ej. /padre?vista=miscitas */
  url: string
  pose?: PoseAria
  /** Avisos con el mismo tag se reemplazan en el celular en vez de acumularse */
  tag?: string
  acciones?: { id: string; titulo: string; url: string }[]
  /** Se queda en pantalla hasta que la persona la toque (citas que empiezan pronto) */
  insistente?: boolean
}

let configurado: boolean | null = null
function configurar() {
  if (configurado !== null) return configurado
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return (configurado = false)
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || (process.env.GMAIL_USER ? `mailto:${process.env.GMAIL_USER}` : 'mailto:noreply@vanty.app'),
    pub, priv,
  )
  return (configurado = true)
}

/** Envía a todos los dispositivos de esas personas. Devuelve cuántos envíos salieron. */
export async function enviarPush(userIds: (string | null | undefined)[], p: Push): Promise<number> {
  const ids = [...new Set(userIds.filter(Boolean) as string[])]
  if (ids.length === 0 || !configurar()) return 0
  try {
    const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('user_id, endpoint, subscription').in('user_id', ids)
    if (!subs?.length) return 0
    const payload = JSON.stringify({
      title: p.title,
      body: p.body,
      icon: `/push/aria-${p.pose ?? 'saludo'}.png`,
      badge: '/push/badge.png',
      tag: p.tag,
      requireInteraction: !!p.insistente,
      actions: (p.acciones ?? []).slice(0, 2).map(a => ({ action: a.id, title: a.titulo })),
      data: { url: p.url, acciones: Object.fromEntries((p.acciones ?? []).map(a => [a.id, a.url])) },
    })
    const r = await Promise.allSettled(subs.map(async s => {
      try {
        await webpush.sendNotification(s.subscription as webpush.PushSubscription, payload, { TTL: 60 * 60 * 12 })
      } catch (e: any) {
        // Suscripción vencida o revocada: se borra
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('user_id', s.user_id).eq('endpoint', s.endpoint)
        }
        throw e
      }
    }))
    return r.filter(x => x.status === 'fulfilled').length
  } catch (e) {
    console.error('[push]', e)
    return 0
  }
}

/** Igual que enviarPush pero solo la primera vez para esa clave (recordatorios programados). */
export async function enviarPushUnaVez(clave: string, userId: string, p: Push): Promise<boolean> {
  const { error } = await supabaseAdmin.from('push_enviados').insert({ clave, user_id: userId })
  if (error) return false // ya enviado (clave duplicada)
  await enviarPush([userId], p)
  return true
}

/** Panel de cada rol (para armar los enlaces). */
export function panelDeRol(role: string | null | undefined) {
  if (role === 'padre') return '/padre'
  if (role === 'especialista' || role === 'terapeuta') return '/especialista'
  if (role === 'secretaria') return '/secretaria'
  return '/admin'
}

/** Pose de ARIA y sección de destino según el tipo de aviso y el rol de quien lo recibe. */
export function estiloAviso(tipo: string, role: string | null | undefined): { pose: PoseAria; vista: string | null } {
  const panel = panelDeRol(role)
  const agenda = panel === '/padre' ? 'miscitas' : 'agenda'
  if (tipo === 'mensaje_familia' || tipo === 'mensaje_centro') {
    return { pose: 'guino', vista: panel === '/padre' ? 'chat-familias' : panel === '/admin' ? 'chat-especialistas' : panel === '/especialista' ? 'evaluaciones' : null }
  }
  if (tipo === 'reserva_online') return { pose: 'celebra', vista: agenda }
  if (tipo === 'cita_reprogramacion') return { pose: 'pensando', vista: agenda }
  if (tipo === 'cita_reprogramacion_respuesta') return { pose: 'feliz', vista: agenda }
  if (tipo.includes('cancel')) return { pose: 'pensando', vista: agenda }
  if (tipo.startsWith('cita')) return { pose: 'corre', vista: agenda }
  if (tipo === 'nuevo_miembro') return { pose: 'saludo', vista: panel === '/admin' ? 'usuarios' : null }
  if (tipo === 'compra_tokens' || tipo === 'pago_suscripcion') return { pose: 'celebra', vista: null }
  if (tipo === 'suscripcion_suspendida') return { pose: 'pensando', vista: null }
  if (tipo.startsWith('tarea')) return { pose: 'laptop', vista: panel === '/padre' ? 'programas' : null }
  return { pose: 'saludo', vista: null }
}

export const conVista = (panel: string, vista: string | null) => (vista ? `${panel}?vista=${vista}` : panel)
