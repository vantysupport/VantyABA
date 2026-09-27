// app/api/session/release/route.ts
// Libera la "sesión única" de forma inmediata al cerrar la pestaña.
// Se invoca con navigator.sendBeacon (fiable en unload). Limpia por TOKEN
// (active_session_id), así no necesita auth: el token es un uuid secreto.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    let sessionId = ''
    try {
      const body = await req.json()
      sessionId = (body?.sessionId as string) || ''
    } catch { /* cuerpo vacío */ }

    if (!sessionId) return NextResponse.json({ ok: false }, { status: 400 })

    // No se borra el identificador: se marca la sesión como inactiva (fecha antigua). Así otro dispositivo
    // puede tomarla de inmediato, pero si la persona vuelve a esta misma pestaña (el navegador también
    // dispara "pagehide" al ocultarla o congelarla) su latido la sigue reconociendo y no la expulsa.
    await supabaseAdmin
      .from('profiles')
      .update({ active_session_at: new Date(0).toISOString() })
      .eq('active_session_id', sessionId)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
