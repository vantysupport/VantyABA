// Currency of the caller's center (centros.currency). GET is public-safe (PEN without a session); POST is center admins only.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { normalizeCurrency } from '@/lib/currency'

async function callerCentro() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('role, centro_id, centros(currency)').eq('id', user.id).maybeSingle()
  return data as { role: string | null; centro_id: string | null; centros: { currency: string } | null } | null
}

export async function GET() {
  const profile = await callerCentro().catch(() => null)
  return NextResponse.json({ moneda: normalizeCurrency(profile?.centros?.currency) })
}

export async function POST(req: NextRequest) {
  const profile = await callerCentro()
  if (!profile?.centro_id || !['jefe', 'admin'].includes(profile.role ?? '')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const moneda = normalizeCurrency(body?.moneda)
  const { error } = await supabaseAdmin.from('centros').update({ currency: moneda }).eq('id', profile.centro_id)
  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  return NextResponse.json({ ok: true, moneda })
}
