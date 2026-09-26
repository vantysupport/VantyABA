import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller } from '@/lib/api-auth'

// Whether the calling parent is within their centro's parent-account limit (plan max_parents + purchased extra slots).
// Order is by account creation: the first N parents of the centro are in. Mirrors the enforce_padre_limit trigger.
export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller || caller.role !== 'padre') return NextResponse.json({ allowed: true })
  if (!caller.centroId) return NextResponse.json({ allowed: false, limit: 0 })

  const [{ data: centro }, { data: me }] = await Promise.all([
    supabaseAdmin.from('centros').select('extra_parents, plans(max_parents)').eq('id', caller.centroId).maybeSingle(),
    supabaseAdmin.from('profiles').select('created_at').eq('id', caller.id).maybeSingle(),
  ])
  const maxParents = (centro?.plans as unknown as { max_parents: number | null } | null)?.max_parents ?? null
  if (maxParents === null) return NextResponse.json({ allowed: true })

  const limit = maxParents + (centro?.extra_parents ?? 0)
  const { count } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'padre')
    .eq('centro_id', caller.centroId)
    .lt('created_at', me?.created_at ?? new Date().toISOString())
  const before = count ?? 0
  return NextResponse.json({ allowed: before < limit, limit, rank: before + 1 })
}
