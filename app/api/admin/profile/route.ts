import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES } from '@/lib/api-auth'

// WhatsApp number of an admin of the caller's own center.
export async function GET(req: Request) {
  const caller = await getApiCaller(req)
  if (!hasRole(caller, ROLES.staff)) return NextResponse.json({ phone: null }, { status: 403 })

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('phone')
    .in('role', ['admin', 'jefe'])
    .eq('centro_id', caller.centroId)
    .not('phone', 'is', null)
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ phone: data?.phone ?? null })
}
