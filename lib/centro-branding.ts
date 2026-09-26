import 'server-only'
// Branding (name, logo, fiscal/contact data) of the center that owns a record.
// Multi-tenant: every document, message and prompt must show the data of ITS
// center, never a global value. Resolution order:
//   1. explicit centroId
//   2. children.centro_id for childId
//   3. the signed-in user's profiles.centro_id
// Falls back to the platform name when nothing resolves. Never throws.

import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { PLATFORM_NAME } from '@/lib/branding'

export type CentroBranding = {
  id: string | null
  name: string
  logoUrl: string | null
  ruc: string | null
  direccion: string | null
  telefono: string | null
  /** Digits only (with country code), for tel:/wa.me links. Empty when no phone. */
  telefonoDigitos: string
  email: string | null
}

export const PLATFORM_BRANDING: CentroBranding = {
  id: null,
  name: PLATFORM_NAME,
  logoUrl: null,
  ruc: null,
  direccion: null,
  telefono: null,
  telefonoDigitos: '',
  email: null,
}

const clean = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s : null
}

const loadCentro = cache(async (centroId: string): Promise<CentroBranding> => {
  try {
    const { data } = await supabaseAdmin
      .from('centros')
      .select('id, name, logo_url, ruc, direccion, telefono, email')
      .eq('id', centroId)
      .maybeSingle()
    if (!data) return PLATFORM_BRANDING
    const telefono = clean(data.telefono)
    return {
      id: data.id ?? centroId,
      name: clean(data.name) ?? PLATFORM_NAME,
      logoUrl: clean(data.logo_url),
      ruc: clean(data.ruc),
      direccion: clean(data.direccion),
      telefono,
      telefonoDigitos: (telefono ?? '').replace(/\D/g, ''),
      email: clean(data.email),
    }
  } catch {
    return PLATFORM_BRANDING
  }
})

const centroIdForChild = cache(async (childId: string): Promise<string | null> => {
  try {
    const { data } = await supabaseAdmin.from('children').select('centro_id').eq('id', childId).maybeSingle()
    return (data?.centro_id as string | null) ?? null
  } catch {
    return null
  }
})

const centroIdForSessionUser = cache(async (): Promise<string | null> => {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabaseAdmin.from('profiles').select('centro_id').eq('id', user.id).maybeSingle()
    return (data?.centro_id as string | null) ?? null
  } catch {
    return null
  }
})

export async function getCentroBranding(
  opts?: { centroId?: string | null; childId?: string | null },
): Promise<CentroBranding> {
  try {
    let id = opts?.centroId ?? null
    if (!id && opts?.childId) id = await centroIdForChild(opts.childId)
    if (!id) id = await centroIdForSessionUser()
    if (!id) return PLATFORM_BRANDING
    return await loadCentro(id)
  } catch {
    return PLATFORM_BRANDING
  }
}
