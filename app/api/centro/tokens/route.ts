// Tokens de análisis predictivo del centro que llama.
//  GET  → saldo del mes, paquetes a la venta y últimas compras.
//  POST { pack } → el director pide un paquete. Queda "pendiente" hasta que se confirme el pago
//        (hoy a mano desde /control; luego lo hará la pasarela de pago).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, unauthorized, forbidden } from '@/lib/api-auth'
import { checkoutCompraTokens, limpiarComprasAbandonadas } from '@/lib/cobros-plataforma'
import { appBaseUrl } from '@/lib/auth-emails'
import { getLocaleFromRequest } from '@/lib/lang'

export const dynamic = 'force-dynamic'

type Pack = { tokens: number; usd: number }

async function paquetes(): Promise<Pack[]> {
  const { data } = await supabaseAdmin.from('platform_settings').select('token_packs').eq('id', 1).maybeSingle()
  const raw = (data?.token_packs ?? []) as Pack[]
  return raw.filter(p => Number(p?.tokens) > 0 && Number(p?.usd) >= 0).map(p => ({ tokens: Math.floor(Number(p.tokens)), usd: Math.round(Number(p.usd) * 100) / 100 }))
}

export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  const [{ data: estado }, packs, { data: compras }] = await Promise.all([
    supabaseAdmin.rpc('ai_quota_estado', { p_centro: caller.centroId, p_kind: 'predictive' }),
    paquetes(),
    supabaseAdmin.from('compras_tokens').select('id, tokens, precio_usd, estado, created_at, pagada_at').eq('centro_id', caller.centroId).order('created_at', { ascending: false }).limit(10),
  ])
  return NextResponse.json({ estado, packs, compras: compras ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.admins)) return forbidden()
  const body = await req.json().catch(() => ({}))
  const packs = await paquetes()
  const pack = packs[Math.floor(Number(body.pack))]
  if (!pack) return NextResponse.json({ error: 'Paquete no válido' }, { status: 400 })

  // Evita acumular pedidos repetidos: máximo 3 pendientes por centro (los checkouts vencidos no cuentan)
  await limpiarComprasAbandonadas({ centro_id: caller.centroId! })
  const { count } = await supabaseAdmin.from('compras_tokens').select('id', { count: 'exact', head: true }).eq('centro_id', caller.centroId).eq('estado', 'pendiente')
  if ((count ?? 0) >= 3) return NextResponse.json({ error: 'Ya tienes compras pendientes de pago. Espera su confirmación.' }, { status: 409 })

  const { data, error } = await supabaseAdmin.from('compras_tokens').insert({
    centro_id: caller.centroId, kind: 'predictive', tokens: pack.tokens, precio_usd: pack.usd,
    estado: 'pendiente', proveedor: 'manual', solicitada_por: caller.id,
  }).select('id, tokens, precio_usd, estado, created_at').single()
  if (error || !data) return NextResponse.json({ error: 'No se pudo registrar la compra' }, { status: 500 })
  // Con la pasarela configurada se paga al momento; si no, se confirma a mano desde /control
  const locale = getLocaleFromRequest(req)
  let checkoutUrl: string | null = null
  try {
    checkoutUrl = await checkoutCompraTokens({
      compraId: data.id, precioUsd: Number(data.precio_usd), tokens: data.tokens, email: caller.email,
      redirectUrl: `${appBaseUrl() ?? req.nextUrl.origin}/${locale}/admin?compra=ok`,
      descripcion: locale === 'en' ? `${data.tokens} predictive analysis token(s)` : `${data.tokens} token(s) de análisis predictivo`, locale,
    })
  } catch (e) { console.error('[tokens centro] checkout', e) }
  return NextResponse.json({ compra: data, checkoutUrl })
}
