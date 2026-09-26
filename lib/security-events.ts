import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'

export type SecurityEventType =
  | 'login_failed'
  | 'login_locked'
  | 'login_blocked_attempt'
  | 'mfa_missing_programador'
  | 'forbidden_access'
  | 'suspended_centro_access'
  | 'programador_action'

export type SecurityLevel = 'bajo' | 'medio' | 'alto' | 'critico'

type SecurityEvent = {
  tipo: SecurityEventType
  nivel: SecurityLevel
  descripcion: string
  userId?: string | null
  centroId?: string | null
  ip?: string | null
  metadata?: Record<string, unknown>
}

export async function logSecurityEvent(e: SecurityEvent): Promise<void> {
  const { error } = await supabaseAdmin.from('alertas_seguridad').insert({
    tipo: e.tipo,
    nivel: e.nivel,
    descripcion: e.descripcion.slice(0, 500),
    user_id: e.userId ?? null,
    centro_id: e.centroId ?? null,
    ip_address: e.ip ?? null,
    metadata: e.metadata ?? {},
  })
  if (error) console.warn('[security-events]', error.message)
}

export function clientIp(headers: Headers): string | null {
  const raw = headers.get('x-forwarded-for') || headers.get('x-real-ip') || headers.get('cf-connecting-ip')
  return raw ? raw.split(',')[0].trim() : null
}

async function loginPolicy() {
  const { data } = await supabaseAdmin
    .from('platform_settings')
    .select('login_max_failures, login_lockout_minutes')
    .eq('id', 1)
    .maybeSingle()
  return { max: data?.login_max_failures ?? 5, minutes: data?.login_lockout_minutes ?? 15 }
}

// Failures are counted per email and per IP so one attacker can't spray many accounts and one account can't be hammered from many IPs undetected.
async function recentFailures(email: string, ip: string | null, minutes: number) {
  const since = new Date(Date.now() - minutes * 60_000).toISOString()
  const byEmail = supabaseAdmin
    .from('alertas_seguridad')
    .select('id', { count: 'exact', head: true })
    .eq('tipo', 'login_failed')
    .gte('timestamp', since)
    .eq('metadata->>email', email)
  const byIp = ip
    ? supabaseAdmin
        .from('alertas_seguridad')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', 'login_failed')
        .gte('timestamp', since)
        .eq('ip_address', ip)
    : null
  const [e, i] = await Promise.all([byEmail, byIp])
  return Math.max(e.count ?? 0, i?.count ?? 0)
}

export async function isLoginLocked(email: string, ip: string | null) {
  const { max, minutes } = await loginPolicy()
  const failures = await recentFailures(email, ip, minutes)
  return { locked: failures >= max, minutes }
}

export async function recordLoginFailure(email: string, ip: string | null) {
  const { max, minutes } = await loginPolicy()
  await logSecurityEvent({ tipo: 'login_failed', nivel: 'bajo', descripcion: 'Intento de inicio de sesión fallido', ip, metadata: { email } })
  const failures = await recentFailures(email, ip, minutes)
  if (failures === max) {
    await logSecurityEvent({
      tipo: 'login_locked',
      nivel: 'alto',
      descripcion: `Bloqueo temporal por ${max} intentos fallidos en ${minutes} min (posible fuerza bruta)`,
      ip,
      metadata: { email, failures },
    })
  }
}
