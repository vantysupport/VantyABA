// Avisos programados al celular, por rol. Corre cada hora (Vercel Cron o pg_cron) y decide qué mandar
// según la hora local de cada centro. Cada aviso se manda una sola vez (tabla push_enviados).
//
//  Cada hora      → cita en ~1 hora: familia y especialista (con botón "Unirse" si es virtual)
//  07:00          → resumen del día: especialista (sus sesiones), jefe/admin/secretaria (agenda y pendientes)
//  09:00          → jefe/admin: la suscripción o la prueba vencen en 3 días o mañana
//  19:00          → familia: cita de mañana + racha de práctica en casa (no perderla / celebrar hitos)
//
// GET /api/cron/avisos  (Authorization: Bearer CRON_SECRET)  · ?hora=19 fuerza la hora local para probar

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { enviarPushUnaVez, type Push } from '@/lib/push'
import { rachaDe } from '@/lib/racha'
import { diaCorto } from '@/lib/avisos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ZONAS: Record<string, string> = {
  PE: 'America/Lima', EC: 'America/Guayaquil', CO: 'America/Bogota', MX: 'America/Mexico_City', CL: 'America/Santiago',
  AR: 'America/Argentina/Buenos_Aires', BO: 'America/La_Paz', PY: 'America/Asuncion', UY: 'America/Montevideo', VE: 'America/Caracas',
  BR: 'America/Sao_Paulo', GT: 'America/Guatemala', CR: 'America/Costa_Rica', PA: 'America/Panama', DO: 'America/Santo_Domingo',
  US: 'America/New_York', CA: 'America/Toronto', ES: 'Europe/Madrid', PT: 'Europe/Lisbon', GB: 'Europe/London', FR: 'Europe/Paris',
  DE: 'Europe/Berlin', IT: 'Europe/Rome',
}

/** Fecha (YYYY-MM-DD), hora y minutos actuales en la zona del centro */
function ahoraEn(tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).map(x => [x.type, x.value]))
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour), minutos: Number(p.hour) * 60 + Number(p.minute) }
}
const sumarDias = (f: string, n: number) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const aMin = (h: string | null) => { const [a, b] = String(h ?? '').split(':').map(Number); return (a || 0) * 60 + (b || 0) }
const ids = (v: string | null | undefined) => String(v ?? '').split(',').map(s => s.trim()).filter(Boolean)
const HITOS = [3, 7, 14, 30, 50, 100]

type Cita = { id: string; child_id: string | null; appointment_date: string; appointment_time: string | null; service_type: string | null; specialist_id: string | null; modalidad: string | null; video_link: string | null; status: string | null; children: { name: string; parent_id: string | null } | null }

export async function GET(req: NextRequest) {
  const secreto = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || req.nextUrl.searchParams.get('secret')
  if (!process.env.CRON_SECRET || secreto !== process.env.CRON_SECRET) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const horaForzada = req.nextUrl.searchParams.get('hora')

  const { data: centros } = await supabaseAdmin.from('centros').select('id, name, pais, locale_default, status, paid_until, trial_ends_at').in('status', ['trial', 'active'])
  const enviados: Record<string, number> = {}
  const cuenta = (k: string, ok: boolean) => { if (ok) enviados[k] = (enviados[k] ?? 0) + 1 }

  for (const c of centros ?? []) {
    const en = c.locale_default === 'en'
    const L = (e: string, s: string) => (en ? e : s)
    const ahora = ahoraEn(ZONAS[String(c.pais ?? '').toUpperCase()] ?? 'America/Lima')
    const hora = horaForzada != null ? Number(horaForzada) : ahora.hora
    const hoy = ahora.fecha, manana = sumarDias(hoy, 1)

    const { data: citasRaw } = await supabaseAdmin.from('appointments')
      .select('id, child_id, appointment_date, appointment_time, service_type, specialist_id, modalidad, video_link, status, children(name, parent_id)')
      .eq('centro_id', c.id).in('appointment_date', [hoy, manana]).in('status', ['confirmed', 'pending'])
    const citas = (citasRaw ?? []) as unknown as Cita[]
    const deHoy = citas.filter(x => x.appointment_date === hoy).sort((a, b) => aMin(a.appointment_time) - aMin(b.appointment_time))

    // ── Cita en ~1 hora (cada corrida) ─────────────────────────────────────
    for (const x of deHoy) {
      const falta = aMin(x.appointment_time) - ahora.minutos
      if (horaForzada == null && (falta < 30 || falta > 90)) continue
      const n = x.children?.name ?? ''
      const h = String(x.appointment_time ?? '').slice(0, 5)
      const virtual = x.modalidad === 'virtual' && !!x.video_link
      const unirse = virtual ? [{ id: 'unirse', titulo: L('Join call', 'Unirse'), url: x.video_link! }] : []
      if (x.children?.parent_id) {
        const p: Push = {
          title: L(`${n}'s session starts at ${h}`, `La sesión de ${n} es a las ${h}`),
          body: virtual ? L('It is online. Tap "Join" when it is time.', 'Es virtual. Toca "Unirse" cuando sea la hora.') : L('See you soon at the center.', 'Te esperamos en el centro.'),
          url: '/padre?vista=miscitas', pose: 'corre', tag: `cita:${x.id}`, insistente: true, acciones: unirse,
        }
        cuenta('cita_1h', await enviarPushUnaVez(`cita1h:${x.id}:${x.children.parent_id}`, x.children.parent_id, p))
      }
      for (const uid of ids(x.specialist_id)) {
        cuenta('cita_1h', await enviarPushUnaVez(`cita1h:${x.id}:${uid}`, uid, {
          title: L(`Next up: ${n} at ${h}`, `Próxima sesión: ${n} a las ${h}`),
          body: `${x.service_type ?? L('Therapy', 'Terapia')} · ${virtual ? L('Online', 'Virtual') : L('In person', 'Presencial')}`,
          url: '/especialista?vista=agenda', pose: 'corre', tag: `cita:${x.id}`, acciones: unirse,
        }))
      }
    }

    // ── 07:00 · resumen del día para el equipo ────────────────────────────
    if (hora === 7) {
      const { data: equipo } = await supabaseAdmin.from('profiles').select('id, role').eq('centro_id', c.id).in('role', ['jefe', 'admin', 'secretaria', 'especialista', 'terapeuta'])
      const { count: solicitudes } = await supabaseAdmin.from('appointments').select('id', { count: 'exact', head: true })
        .eq('centro_id', c.id).eq('metadata->reprogramacion->>estado', 'solicitada')
      for (const u of equipo ?? []) {
        let p: Push | null = null
        if (u.role === 'especialista' || u.role === 'terapeuta') {
          const mias = deHoy.filter(x => ids(x.specialist_id).includes(u.id))
          if (mias.length) {
            const primera = mias[0]
            p = {
              title: mias.length === 1 ? L('You have 1 session today', 'Hoy tienes 1 sesión') : L(`You have ${mias.length} sessions today`, `Hoy tienes ${mias.length} sesiones`),
              body: L(`First one at ${String(primera.appointment_time).slice(0, 5)} with ${primera.children?.name ?? ''}. You've got this.`, `La primera es a las ${String(primera.appointment_time).slice(0, 5)} con ${primera.children?.name ?? ''}. ¡Tú puedes!`),
              url: '/especialista?vista=agenda', pose: 'laptop', tag: `resumen:${hoy}`,
            }
          }
        } else if (deHoy.length || solicitudes) {
          const panel = u.role === 'secretaria' ? '/secretaria' : '/admin'
          p = {
            title: L(`Good morning! ${deHoy.length} appointment${deHoy.length === 1 ? '' : 's'} today`, `¡Buenos días! Hoy hay ${deHoy.length} cita${deHoy.length === 1 ? '' : 's'}`),
            body: solicitudes
              ? L(`${solicitudes} reschedule request${solicitudes === 1 ? '' : 's'} waiting for you.`, `${solicitudes} solicitud${solicitudes === 1 ? '' : 'es'} de reprogramación esperan tu respuesta.`)
              : deHoy.length ? L(`First one at ${String(deHoy[0].appointment_time).slice(0, 5)}.`, `La primera es a las ${String(deHoy[0].appointment_time).slice(0, 5)}.`) : '',
            url: `${panel}?vista=agenda`, pose: 'saludo', tag: `resumen:${hoy}`,
          }
        }
        if (p) cuenta('resumen', await enviarPushUnaVez(`resumen:${hoy}:${u.id}`, u.id, p))
      }
    }

    // ── 09:00 · la suscripción o la prueba están por vencer ───────────────
    if (hora === 9) {
      const vence = String(c.status === 'trial' ? c.trial_ends_at ?? '' : c.paid_until ?? '').slice(0, 10)
      const dias = vence ? Math.round((new Date(`${vence}T12:00:00Z`).getTime() - new Date(`${hoy}T12:00:00Z`).getTime()) / 86_400_000) : null
      if (dias === 3 || dias === 1) {
        const { data: dueños } = await supabaseAdmin.from('profiles').select('id').eq('centro_id', c.id).in('role', ['jefe', 'admin'])
        const prueba = c.status === 'trial'
        for (const u of dueños ?? []) {
          cuenta('vence', await enviarPushUnaVez(`vence:${c.id}:${vence}:${dias}:${u.id}`, u.id, {
            title: prueba
              ? (dias === 1 ? L('Your free trial ends tomorrow', 'Tu prueba gratis termina mañana') : L('3 days left in your trial', 'Te quedan 3 días de prueba'))
              : (dias === 1 ? L('Your plan renews tomorrow', 'Tu plan se renueva mañana') : L('Your plan renews in 3 days', 'Tu plan se renueva en 3 días')),
            body: prueba ? L('Choose a plan so your team keeps working without pauses.', 'Elige un plan para que tu equipo siga sin pausas.') : L('Make sure your payment method is up to date.', 'Revisa que tu método de pago esté al día.'),
            url: prueba ? '/suscripcion?motivo=elegir' : '/admin', pose: 'pensando', tag: 'suscripcion',
          }))
        }
      }
    }

    // ── 19:00 · familias: cita de mañana y racha ──────────────────────────
    if (hora === 19) {
      for (const x of citas.filter(y => y.appointment_date === manana)) {
        const pid = x.children?.parent_id
        if (!pid) continue
        const n = x.children?.name ?? ''
        cuenta('manana', await enviarPushUnaVez(`manana:${x.id}`, pid, {
          title: L(`Tomorrow: ${n}'s session`, `Mañana: sesión de ${n}`),
          body: L(`${x.service_type ?? 'Therapy'} on ${diaCorto(manana, true)} at ${String(x.appointment_time).slice(0, 5)}. Can't make it? Reschedule from the app.`,
            `${x.service_type ?? 'Terapia'} el ${diaCorto(manana, false)} a las ${String(x.appointment_time).slice(0, 5)}. ¿No puedes? Reprograma desde la app.`),
          url: '/padre?vista=miscitas', pose: 'guino', tag: `cita:${x.id}`,
          acciones: [{ id: 'ver', titulo: L('See appointment', 'Ver cita'), url: '/padre?vista=miscitas' }],
        }))
      }

      const { data: ninos } = await supabaseAdmin.from('children').select('id, name, parent_id').eq('centro_id', c.id).not('parent_id', 'is', null)
      const porPadre = new Map<string, { ids: string[]; nombres: string[] }>()
      for (const k of ninos ?? []) {
        const g = porPadre.get(k.parent_id!) ?? { ids: [], nombres: [] }
        g.ids.push(k.id); g.nombres.push(k.name); porPadre.set(k.parent_id!, g)
      }
      for (const [pid, g] of porPadre) {
        const r = await rachaDe(g.ids, hoy)
        const n = g.nombres[0] ?? ''
        let p: Push | null = null
        if (r.hoy && HITOS.includes(r.dias)) {
          p = { title: L(`${r.dias}-day streak!`, `¡${r.dias} días seguidos!`), body: L(`${n} practiced ${r.dias} days in a row. That consistency shows.`, `${n} practicó ${r.dias} días seguidos. Esa constancia se nota.`), url: '/padre', pose: 'celebra', tag: 'racha' }
        } else if (!r.hoy && r.dias >= 1) {
          p = { title: L(`Don't lose your ${r.dias}-day streak`, `¡No pierdas tu racha de ${r.dias} día${r.dias === 1 ? '' : 's'}!`), body: L(`5 minutes with ${n} today keeps it alive.`, `5 minutos con ${n} hoy y la mantienes.`), url: '/padre?vista=programas', pose: 'corre', tag: 'racha' }
        } else if (!r.hoy) {
          const { count } = await supabaseAdmin.from('tareas_hogar').select('id', { count: 'exact', head: true }).in('child_id', g.ids).eq('completada', false).eq('activa', true)
          if (count) p = {
            title: L(`${n} has a mission waiting`, `${n} tiene una misión pendiente`),
            body: L(`${count} home activit${count === 1 ? 'y' : 'ies'} from the therapist. Start a new streak today.`, `${count} actividad${count === 1 ? '' : 'es'} para casa de su terapeuta. Empieza hoy una racha nueva.`),
            url: '/padre?vista=programas', pose: 'laptop', tag: 'racha',
          }
        }
        if (p) cuenta('racha', await enviarPushUnaVez(`racha:${hoy}:${pid}`, pid, p))
      }
    }
  }

  // Limpieza: los registros de más de 60 días ya no hacen falta
  await supabaseAdmin.from('push_enviados').delete().lt('created_at', new Date(Date.now() - 60 * 86_400_000).toISOString())
  return NextResponse.json({ ok: true, centros: centros?.length ?? 0, enviados })
}
