// lib/calendar-integration.ts
// Integración con Google Calendar y Microsoft Calendar (Outlook)
// Se activa automáticamente según el provider con que inició sesión el padre

import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, rowInCentro, ROLES, unauthorized, forbidden, notFound, type ApiCaller } from '@/lib/api-auth'

// ─── Authorization for /api/google-calendar and /api/microsoft-calendar ───────
// Tokens live on profiles; a user may only connect/read/revoke their own calendar. Server-to-server
// calls (appointment routes syncing someone else's calendar) must send internalApiHeaders().

function hmac(purpose: string, value: string): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createHmac('sha256', key).update(`${purpose}:${value}`).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

/** Headers for internal server-to-server calls (calendar routes, /api/push). The value is an HMAC of the service-role key, so it never leaves the server in plaintext. */
export function internalApiHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', 'x-vanty-internal': hmac('calendar-internal', 'v1') }
}

export function isInternalApiCall(req: Request): boolean {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return false
  const h = req.headers.get('x-vanty-internal') || ''
  return !!h && safeEqual(h, hmac('calendar-internal', 'v1'))
}

const STATE_TTL_MS = 60 * 60 * 1000

/** OAuth `state` bound to the user who started the flow, so a callback can't attach tokens to someone else's profile. */
export function signOAuthState(userId: string, role: string): string {
  const safeRole = role.replace(/[^a-z_]/gi, '') || 'admin'
  const payload = `${userId}:${safeRole}:${Date.now()}`
  return `${payload}:${hmac('oauth-state', payload)}`
}

export function verifyOAuthState(state: string): { userId: string; role: string } | null {
  const parts = state.split(':')
  if (parts.length !== 4) return null
  const [userId, role, ts, sig] = parts
  if (!userId || !safeEqual(sig, hmac('oauth-state', `${userId}:${role}:${ts}`))) return null
  if (!(Date.now() - Number(ts) < STATE_TTL_MS)) return null
  return { userId, role }
}

/**
 * Caller for calendar GET actions. `targetUserId` defaults to the caller; reading another user's status
 * is only for staff of the same centro; `selfOnly` actions (connect/disconnect) never touch another user.
 */
export async function authorizeCalendarGet(
  req: Request, targetUserId: string | null, selfOnly: boolean,
): Promise<{ error: NextResponse } | { caller: ApiCaller; userId: string }> {
  const caller = await getApiCaller(req)
  if (!caller) return { error: unauthorized() }
  const userId = targetUserId || caller.id
  if (userId !== caller.id) {
    if (selfOnly) return { error: forbidden() }
    if (!hasRole(caller, ROLES.staff) || !(await rowInCentro('profiles', userId, caller.centroId))) return { error: notFound() }
  }
  return { caller, userId }
}

/**
 * Gate for calendar POST actions: internal calls (signed header) or staff acting on a calendar owner of their
 * own centro. In both cases the appointment/child being synced must belong to the calendar owner's centro.
 */
export async function authorizeCalendarPost(
  req: Request, userId: string | null | undefined, opts: { appointmentId?: string | null; childId?: string | null },
): Promise<NextResponse | null> {
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (!isInternalApiCall(req)) {
    const caller = await getApiCaller(req)
    if (!caller) return unauthorized()
    if (!hasRole(caller, ROLES.staff)) return forbidden()
    if (userId !== caller.id && !(await rowInCentro('profiles', userId, caller.centroId))) return notFound()
  }
  const { data: owner } = await supabaseAdmin.from('profiles').select('centro_id').eq('id', userId).maybeSingle()
  const ownerCentro = owner?.centro_id ?? null
  if (!ownerCentro) return notFound()
  if (opts.appointmentId && !(await rowInCentro('appointments', opts.appointmentId, ownerCentro))) return notFound()
  if (opts.childId && !(await rowInCentro('children', opts.childId, ownerCentro))) return notFound()
  return null
}

export type CalendarProvider = 'google' | 'microsoft' | 'none'

/** Detectar qué calendario tiene el usuario según su sesión OAuth */
export async function detectCalendarProvider(userId: string): Promise<CalendarProvider> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await sb.auth.getSession()
  const provider = data.session?.user?.app_metadata?.provider
  if (provider === 'google') return 'google'
  if (provider === 'azure') return 'microsoft'
  return 'none'
}

/** Enviar recordatorio de cita al Google Calendar del usuario */
export async function addGoogleCalendarEvent(params: {
  accessToken: string
  title: string
  description: string
  startDateTime: string   // ISO 8601
  endDateTime: string     // ISO 8601
  attendeeEmail?: string
}): Promise<{ ok: boolean; eventId?: string; error?: string }> {
  try {
    const body = {
      summary: params.title,
      description: params.description,
      start: { dateTime: params.startDateTime, timeZone: 'America/Lima' },
      end:   { dateTime: params.endDateTime,   timeZone: 'America/Lima' },
      reminders: { useDefault: false, overrides: [
        { method: 'popup',  minutes: 60 },
        { method: 'email',  minutes: 1440 },
      ]},
      ...(params.attendeeEmail ? {
        attendees: [{ email: params.attendeeEmail }],
      } : {}),
    }

    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )

    if (!res.ok) {
      const err = await res.json()
      return { ok: false, error: err.error?.message || 'Error Google Calendar' }
    }

    const data = await res.json()
    return { ok: true, eventId: data.id }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

/** Enviar recordatorio al Microsoft Calendar (Outlook) */
export async function addMicrosoftCalendarEvent(params: {
  accessToken: string
  title: string
  description: string
  startDateTime: string
  endDateTime: string
  attendeeEmail?: string
}): Promise<{ ok: boolean; eventId?: string; error?: string }> {
  try {
    const body: any = {
      subject: params.title,
      body: { contentType: 'HTML', content: params.description },
      start: { dateTime: params.startDateTime, timeZone: 'SA Pacific Standard Time' },
      end:   { dateTime: params.endDateTime,   timeZone: 'SA Pacific Standard Time' },
      isReminderOn: true,
      reminderMinutesBeforeStart: 60,
    }
    if (params.attendeeEmail) {
      body.attendees = [{ emailAddress: { address: params.attendeeEmail }, type: 'required' }]
    }

    const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json()
      return { ok: false, error: err.error?.message || 'Error Microsoft Calendar' }
    }

    const data = await res.json()
    return { ok: true, eventId: data.id }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

/** Helper unificado — detecta el provider y agrega el evento al calendario correcto */
export async function addCalendarReminder(params: {
  userId: string
  accessToken: string
  provider: CalendarProvider
  citaId: string
  pacienteNombre: string
  terapeutaNombre: string
  fecha: string   // YYYY-MM-DD
  hora: string    // HH:MM
  duracionMin?: number
  /** Name of the patient's center (getCentroBranding({ childId }).name). */
  centroNombre: string
}): Promise<void> {
  const start = `${params.fecha}T${params.hora}:00`
  const durMin = params.duracionMin ?? 60
  const endH = new Date(new Date(`${params.fecha}T${params.hora}`).getTime() + durMin * 60000)
  const end = endH.toISOString().replace('Z', '')

  const title = `🧩 Sesión ABA — ${params.pacienteNombre}`
  const desc  = `Sesión de terapia con ${params.terapeutaNombre}.<br/>Centro: ${params.centroNombre}`

  if (params.provider === 'google') {
    await addGoogleCalendarEvent({ accessToken: params.accessToken, title, description: desc, startDateTime: start, endDateTime: end })
  } else if (params.provider === 'microsoft') {
    await addMicrosoftCalendarEvent({ accessToken: params.accessToken, title, description: desc, startDateTime: start, endDateTime: end })
  }
}
