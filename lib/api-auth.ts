import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'

// Tenant-aware authorization for API routes. Service-role queries bypass RLS, so every route must scope by the caller's centro itself.

export type ApiCaller = { id: string; email: string | null; role: string; centroId: string | null }

export const ROLES = {
  admins: ['jefe', 'admin'],
  billing: ['jefe', 'admin', 'secretaria'],
  clinical: ['jefe', 'admin', 'especialista', 'terapeuta'],
  staff: ['jefe', 'admin', 'especialista', 'terapeuta', 'secretaria'],
} as const

/** Bearer token first (most client fetches), then the cookie session (links opened in a new tab). */
export async function getApiCaller(req: Request): Promise<ApiCaller | null> {
  let userId: string | null = null
  let email: string | null = null

  // getClaims verifica la firma del JWT localmente (claves ES256 del proyecto, en caché): evita un viaje
  // al servidor de Auth por cada llamada a la API. Un token vencido o con firma inválida no pasa.
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (token) {
    const { data } = await supabaseAdmin.auth.getClaims(token)
    userId = (data?.claims?.sub as string | undefined) ?? null
    email = (data?.claims?.email as string | undefined) ?? null
  }
  if (!userId) {
    const supabase = await createClient()
    const { data } = await supabase.auth.getClaims()
    userId = (data?.claims?.sub as string | undefined) ?? null
    email = (data?.claims?.email as string | undefined) ?? null
  }
  if (!userId) return null

  const { data: profile } = await supabaseAdmin.from('profiles').select('role, centro_id').eq('id', userId).maybeSingle()
  if (!profile?.role) return null
  return { id: userId, email, role: profile.role, centroId: profile.centro_id ?? null }
}

export function hasRole(caller: ApiCaller | null, roles: readonly string[]): caller is ApiCaller & { centroId: string } {
  return !!caller && !!caller.centroId && roles.includes(caller.role)
}

/** Staff of the child's centro, or the child's own parent. */
export async function canAccessChild(caller: ApiCaller, childId: string | null | undefined): Promise<boolean> {
  if (!childId) return false
  const { data } = await supabaseAdmin.from('children').select('centro_id, parent_id').eq('id', childId).maybeSingle()
  if (!data) return false
  if (data.parent_id === caller.id) return true
  return (ROLES.staff as readonly string[]).includes(caller.role) && !!caller.centroId && data.centro_id === caller.centroId
}

/** For by-id lookups on tenant tables: true only when the row belongs to the caller's centro. */
export async function rowInCentro(table: string, id: string | null | undefined, centroId: string | null, idColumn = 'id'): Promise<boolean> {
  if (!id || !centroId) return false
  const { data } = await supabaseAdmin.from(table).select('centro_id').eq(idColumn, id).maybeSingle()
  return !!data && data.centro_id === centroId
}

export const unauthorized = () => NextResponse.json({ error: 'unauthorized' }, { status: 401 })
export const forbidden = () => NextResponse.json({ error: 'forbidden' }, { status: 403 })
// Same response for "doesn't exist" and "not yours", so ids can't be probed across centros.
export const notFound = () => NextResponse.json({ error: 'not_found' }, { status: 404 })
