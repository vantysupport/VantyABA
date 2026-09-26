import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, unauthorized, forbidden } from '@/lib/api-auth'
export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  const isPlatform = caller.role === 'programador'
  if (!isPlatform && !hasRole(caller, ROLES.admins)) return forbidden()
  const url = process.env.WSP_SERVICE_URL
  const secret = process.env.WSP_SERVICE_SECRET
  if (!url || !secret) return NextResponse.json({ error: 'Servicio no configurado' }, { status: 503 })
  try {
    const body = await req.json()
    // Center admins may only send the test message to their own phone (the number is shared by all centros).
    if (!isPlatform) {
      const { data: me } = await supabaseAdmin.from('profiles').select('phone').eq('id', caller.id).maybeSingle()
      const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '')
      if (!me?.phone || !digits(body?.to) || digits(body?.to) !== digits(me.phone)) return forbidden()
    }
    const res = await fetch(`${url}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-service-secret': secret },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })
    return NextResponse.json(await res.json(), { status: res.ok ? 200 : res.status })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 503 })
  }
}
