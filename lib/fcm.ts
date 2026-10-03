// Avisos a la app de Android por Firebase Cloud Messaging (HTTP v1).
// Privacidad: el texto del aviso se guarda en Supabase (app_avisos) y por Firebase (Google) solo viaja el id
// de esa fila; el celular lee el contenido con la sesión de la persona (RLS). Nunca lanza.

import 'server-only'
import { createSign } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Push } from '@/lib/push'

type Cuenta = { project_id: string; client_email: string; private_key: string }

let cuenta: Cuenta | null | undefined
function leerCuenta(): Cuenta | null {
  if (cuenta !== undefined) return cuenta
  try {
    const c = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '') as Cuenta
    cuenta = c.project_id && c.client_email && c.private_key ? { ...c, private_key: c.private_key.replace(/\\n/g, '\n') } : null
  } catch { cuenta = null }
  return cuenta
}

export const fcmConfigurado = () => leerCuenta() !== null

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

// Token de acceso de Google (dura 1 h; se reutiliza 50 min)
let acceso: { token: string; vence: number } | null = null
async function tokenAcceso(c: Cuenta): Promise<string | null> {
  if (acceso && acceso.vence > Date.now()) return acceso.token
  const ahora = Math.floor(Date.now() / 1000)
  const sinFirma = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({
    iss: c.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600,
  }))}`
  const firma = b64url(createSign('RSA-SHA256').update(sinFirma).sign(c.private_key))
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${sinFirma}.${firma}` }),
  })
  if (!r.ok) { console.error('[fcm] token', r.status, await r.text().catch(() => '')); return null }
  const j = await r.json() as { access_token: string }
  acceso = { token: j.access_token, vence: Date.now() + 50 * 60 * 1000 }
  return acceso.token
}

/** Envía el aviso a los celulares con la app de esas personas. Devuelve cuántos envíos salieron. */
export async function enviarApp(userIds: string[], p: Push): Promise<number> {
  const c = leerCuenta()
  if (!c || userIds.length === 0) return 0
  try {
    const { data: dispositivos } = await supabaseAdmin.from('app_dispositivos').select('token, user_id').in('user_id', userIds)
    if (!dispositivos?.length) return 0
    const access = await tokenAcceso(c)
    if (!access) return 0

    // Una fila por persona con el contenido (lo lee el celular); por Firebase solo va su id
    const personas = [...new Set(dispositivos.map(d => d.user_id as string))]
    const { data: filas } = await supabaseAdmin.from('app_avisos').insert(personas.map(u => ({
      user_id: u, titulo: p.title, cuerpo: p.body, url: p.url, pose: p.pose ?? 'saludo', tag: p.tag ?? null, insistente: !!p.insistente,
    }))).select('id, user_id')
    const idDe = new Map((filas ?? []).map(f => [f.user_id as string, f.id as string]))

    const r = await Promise.allSettled(dispositivos.map(async d => {
      const id = idDe.get(d.user_id as string)
      if (!id) throw new Error('sin fila')
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${c.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token: d.token, data: { aviso: id }, android: { priority: 'high', ttl: '43200s' } } }),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        // Celular que ya no tiene la app o token vencido: se borra
        if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(txt)) {
          await supabaseAdmin.from('app_dispositivos').delete().eq('token', d.token)
        }
        throw new Error(`fcm ${res.status}`)
      }
    }))

    // Limpieza: los avisos ya entregados no hacen falta después de una semana
    await supabaseAdmin.from('app_avisos').delete().lt('created_at', new Date(Date.now() - 7 * 864e5).toISOString())
    return r.filter(x => x.status === 'fulfilled').length
  } catch (e) {
    console.error('[fcm]', e)
    return 0
  }
}
