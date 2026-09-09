// app/api/centro/moneda/route.ts
// Moneda global del centro (fila única en centro_config). GET público (solo lee
// el código); POST guarda (lo usa el admin desde Configuración).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeCurrency } from '@/lib/currency'

export async function GET() {
  try {
    const { data } = await supabaseAdmin.from('centro_config').select('moneda').eq('id', 1).maybeSingle()
    return NextResponse.json({ moneda: normalizeCurrency((data as any)?.moneda) })
  } catch {
    return NextResponse.json({ moneda: 'PEN' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const moneda = normalizeCurrency(body?.moneda)
    const { error } = await supabaseAdmin
      .from('centro_config')
      .upsert({ id: 1, moneda, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) throw error
    return NextResponse.json({ ok: true, moneda })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === 'production' ? 'Error' : e.message }, { status: 500 })
  }
}
