import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { borrarSiHuerfana } from '@/lib/cuenta-huerfana'

// Lo llama /auth/callback tras entrar con Google/Microsoft. Si la cuenta se acaba de crear sola y no
// pertenece a ningún centro, se borra para no dejar a la persona en un panel vacío con su correo
// ocupado. Solo actúa sobre la cuenta dueña del token.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ error: 'no_session' }, { status: 401 })
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return NextResponse.json({ error: 'no_session' }, { status: 401 })
  const borrada = await borrarSiHuerfana(data.user.id)
  return NextResponse.json({ borrada })
}
