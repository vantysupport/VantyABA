import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { clientIp, logSecurityEvent } from '@/lib/security-events'

export type ProgramadorAuth =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; status: 401 | 403; code: 'no_session' | 'forbidden' | 'mfa_required' }

function jwtAal(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return typeof payload.aal === 'string' ? payload.aal : null
  } catch {
    return null
  }
}

// The platform console controls billing and every tenant, so it requires a verified second factor (aal2), not just the role.
export async function requireProgramador(req: Request): Promise<ProgramadorAuth> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return { ok: false, status: 401, code: 'no_session' }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  const user = data?.user
  if (error || !user) return { ok: false, status: 401, code: 'no_session' }

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const ip = clientIp(req.headers)
  if (profile?.role !== 'programador') {
    await logSecurityEvent({ tipo: 'forbidden_access', nivel: 'alto', descripcion: 'Acceso denegado a la consola de programador', userId: user.id, ip })
    return { ok: false, status: 403, code: 'forbidden' }
  }

  // getUser() already verified the token signature, so reading its aal claim is safe.
  if (jwtAal(token) !== 'aal2') {
    await logSecurityEvent({ tipo: 'mfa_missing_programador', nivel: 'medio', descripcion: 'Programador sin segundo factor verificado', userId: user.id, ip })
    return { ok: false, status: 403, code: 'mfa_required' }
  }

  return { ok: true, userId: user.id, email: user.email ?? null }
}
