// Branding of the CALLER's center (name, logo, contact). Public-safe: without a
// session it returns the platform fallback; it never accepts a centro id from
// the request, so it cannot leak another center's data.

import { NextResponse } from 'next/server'
import { getCentroBranding } from '@/lib/centro-branding'

export const dynamic = 'force-dynamic'

export async function GET() {
  const branding = await getCentroBranding()
  return NextResponse.json(branding, { headers: { 'Cache-Control': 'private, no-store' } })
}
