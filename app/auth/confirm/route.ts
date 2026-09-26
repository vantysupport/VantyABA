import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'

// Email links (recovery, signup confirmation, invite, magic link, email change) land here with a token_hash.
// Verifying server-side avoids the PKCE code-verifier, so a link works even when opened in another browser or device.
const TYPES: EmailOtpType[] = ['recovery', 'signup', 'invite', 'magiclink', 'email', 'email_change']

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const locale = req.cookies.get('vanty_locale')?.value === 'en' ? 'en' : 'es'
  const to = (path: string) => NextResponse.redirect(new URL(`/${locale}${path}`, url.origin))

  if (!tokenHash || !type || !TYPES.includes(type)) return to('/login?error=invalid_link')

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error) return to('/reset-password?expired=1')

  // Recovery and invites both need the user to choose a password next.
  if (type === 'recovery' || type === 'invite') return to('/reset-password')
  return to('/auth/callback')
}
