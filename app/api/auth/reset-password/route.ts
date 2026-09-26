import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { appBaseUrl, authMailConfigured, sendRecoveryEmail } from '@/lib/auth-emails'

// Public: always answers the same way so it can't be used to discover which emails have accounts.
// Abuse is bounded by the API rate limit in proxy.ts.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const email = String(body?.email ?? '').trim().toLowerCase()
  const locale = body?.locale === 'en' ? 'en' : 'es'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 })

  const siteUrl = appBaseUrl()
  if (!siteUrl) {
    console.error('[reset-password] NEXT_PUBLIC_SITE_URL is not set; refusing to build links from the request host')
    return NextResponse.json({ success: true })
  }
  try {
    if (authMailConfigured()) {
      await sendRecoveryEmail(email, siteUrl, locale)
    } else {
      // Fallback until Gmail SMTP is configured: Supabase's own (unbranded) mailer.
      await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/auth/callback?type=recovery` })
    }
  } catch (e) {
    console.error('[reset-password]', e)
  }
  return NextResponse.json({ success: true })
}
