// Despacha las notificaciones programadas desde /control cuya hora ya llegó.
// La llama pg_cron (Supabase) cada 5 minutos con Authorization: Bearer CRON_SECRET.
import { NextRequest, NextResponse } from 'next/server'
import { procesarCampanasPendientes } from '@/lib/campanas'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secreto = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!process.env.CRON_SECRET || secreto !== process.env.CRON_SECRET) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const enviadas = await procesarCampanasPendientes()
  return NextResponse.json({ ok: true, enviadas })
}
