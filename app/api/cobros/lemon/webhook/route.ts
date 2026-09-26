// Webhook de Lemon Squeezy. Configurar en Lemon: Settings → Webhooks → URL
//   https://<dominio>/api/cobros/lemon/webhook   (mismo "signing secret" que LEMONSQUEEZY_WEBHOOK_SECRET)
// Eventos: order_created, subscription_created, subscription_updated, subscription_cancelled,
//          subscription_resumed, subscription_expired, subscription_paused, subscription_unpaused.
// Cada aviso se guarda en pagos_eventos (hash del cuerpo único) para no procesarlo dos veces.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { firmaValida, hashCuerpo } from '@/lib/lemon'
import { acreditarCompra, aplicarSuscripcion } from '@/lib/cobros-plataforma'

export const dynamic = 'force-dynamic'

type Payload = {
  meta?: { event_name?: string; custom_data?: Record<string, string> | null; test_mode?: boolean }
  data?: { type?: string; id?: string; attributes?: Record<string, unknown> }
}

export async function POST(req: NextRequest) {
  const cuerpo = await req.text()
  if (!firmaValida(cuerpo, req.headers.get('x-signature'))) {
    return NextResponse.json({ error: 'firma_invalida' }, { status: 401 })
  }
  let p: Payload
  try { p = JSON.parse(cuerpo) } catch { return NextResponse.json({ error: 'json' }, { status: 400 }) }

  const evento = p.meta?.event_name ?? 'desconocido'
  const custom = p.meta?.custom_data ?? {}
  const centroId = typeof custom.centro_id === 'string' ? custom.centro_id : null

  // Idempotencia: el mismo aviso (mismo cuerpo) solo se procesa una vez
  const { data: registro, error: dup } = await supabaseAdmin.from('pagos_eventos')
    .insert({ proveedor: 'lemonsqueezy', evento, firma: hashCuerpo(cuerpo), centro_id: centroId, payload: p })
    .select('id').maybeSingle()
  if (dup) return NextResponse.json({ ok: true, duplicado: true })

  try {
    const a = p.data?.attributes ?? {}

    // ── Compra única (paquete de tokens) ──
    if (evento === 'order_created' && custom.tipo === 'tokens' && custom.compra_id) {
      if (a.status === 'paid') {
        const r = await acreditarCompra(custom.compra_id, { actor: null, referencia: String(a.identifier ?? p.data?.id ?? ''), proveedor: 'lemonsqueezy' })
        if (!r.ok && r.error !== 'already_processed') throw new Error(r.error)
      }
    }

    // ── Suscripción del centro ──
    if (p.data?.type === 'subscriptions' && centroId && p.data.id) {
      await aplicarSuscripcion(centroId, p.data.id, a, { planId: custom.plan_id, ciclo: custom.ciclo, evento, prueba: !!p.meta?.test_mode })
    }

    if (registro?.id) await supabaseAdmin.from('pagos_eventos').update({ procesado: true }).eq('id', registro.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[lemon webhook]', evento, msg)
    // 500: Lemon reintenta el aviso más tarde; se borra el registro para que el reintento se procese
    if (registro?.id) await supabaseAdmin.from('pagos_eventos').delete().eq('id', registro.id)
    return NextResponse.json({ error: 'no_procesado' }, { status: 500 })
  }
}
