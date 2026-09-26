import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { forbidden, unauthorized } from '@/lib/api-auth'

// Signed-in auth user (Bearer or cookie). getApiCaller can't be used: a brand-new OAuth user has no profile yet.
async function authUserId(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (token) {
    const { data } = await supabaseAdmin.auth.getClaims(token)
    if (data?.claims?.sub) return data.claims.sub as string
  }
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return (data?.claims?.sub as string | undefined) ?? null
}

export async function GET(req: NextRequest) {
  // Only the signed-in user's own role; never another user's, and never create a profile for someone else.
  const selfId = await authUserId(req)
  if (!selfId) return unauthorized()
  const uid = req.nextUrl.searchParams.get('uid') || selfId
  if (uid !== selfId) return forbidden()

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', uid)
    .single()

  if (!profile) {
    // Nuevo usuario OAuth — crear perfil padre
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(uid)
    if (userData?.user) {
      await supabaseAdmin.from('profiles').insert([{
        id: uid,
        email: userData.user.email,
        full_name: userData.user.user_metadata?.full_name || userData.user.email?.split('@')[0] || 'Usuario',
        role: 'padre',
        is_active: true,
      }])
    }
    return NextResponse.json({ role: 'padre' })
  }

  return NextResponse.json({ role: profile.role })
}
