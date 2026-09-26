import { NextRequest, NextResponse } from 'next/server'
import { getApiCaller, hasRole, ROLES, unauthorized, forbidden } from '@/lib/api-auth'
export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.admins) && caller.role !== 'programador') return forbidden()
  const url = process.env.WSP_SERVICE_URL
  const secret = process.env.WSP_SERVICE_SECRET
  if (!url || !secret) return NextResponse.json({ unconfigured: true })
  try {
    const res = await fetch(`${url}/status`, {
      headers: { 'x-service-secret': secret },
      signal: AbortSignal.timeout(5000),
    })
    return NextResponse.json(await res.json())
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message, connected: false }, { status: 503 })
  }
}
