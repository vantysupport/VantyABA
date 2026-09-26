// Tokens de IA del padre que llama.
//  GET  → cuota y tokens comprados (Practicar en casa por mes, ARIA por día), paquetes y compras recientes.
//  POST { tipo: 'practica' | 'aria', pack } → pide un paquete; queda "pendiente" hasta que se confirme el pago en /control.
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, unauthorized, forbidden } from '@/lib/api-auth'
import { checkoutCompraTokens, limpiarComprasAbandonadas } from '@/lib/cobros-plataforma'
import { appBaseUrl } from '@/lib/auth-emails'
import { getLocaleFromRequest } from '@/lib/lang'
import { estadoTokensPadre } from '@/lib/tokens-padres'

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
  if (caller.role !== 'padre') return forbidden()
  const [estado, packs, { data: compras }] = await Promise.all([
    estadoTokensPadre(caller.id, caller.centroId),
    paquetes(),
    supabaseAdmin.from('compras_tokens').select('id, kind, tokens, precio_usd, estado, created_at')
      .eq('para_usuario', caller.id).order('created_at', { ascending: false }).limit(5),
  ])
  return NextResponse.json({ ...estado, packs, compras: compras ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (caller.role !== 'padre' || !caller.centroId) return forbidden()
  const body = await req.json().catch(() => ({}))
  const tipo = body?.tipo === 'aria' ? 'aria' : body?.tipo === 'practica' ? 'practica' : null
  const packs = await paquetes()
  const pack = packs[Math.floor(Number(body?.pack))]
  if (!tipo || !pack) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })

  // Evita acumular pedidos: máximo 2 pendientes por familia (los checkouts vencidos no cuentan)
  await limpiarComprasAbandonadas({ para_usuario: caller.id })
  const { count } = await supabaseAdmin.from('compras_tokens').select('id', { count: 'exact', head: true }).eq('para_usuario', caller.id).eq('estado', 'pendiente')
  if ((count ?? 0) >= 2) return NextResponse.json({ error: 'pendientes' }, { status: 409 })

  const { data, error } = await supabaseAdmin.from('compras_tokens').insert({
    centro_id: caller.centroId, para_usuario: caller.id, kind: tipo === 'aria' ? 'padre_aria' : 'padre_practica',
    tokens: pack.tokens, precio_usd: pack.usd, estado: 'pendiente', proveedor: 'manual', solicitada_por: caller.id,
  }).select('id, kind, tokens, precio_usd, estado, created_at').single()
  if (error || !data) return NextResponse.json({ error: 'no_guardado' }, { status: 500 })
  const locale = getLocaleFromRequest(req)
  let checkoutUrl: string | null = null
  try {
    checkoutUrl = await checkoutCompraTokens({
      compraId: data.id, precioUsd: Number(data.precio_usd), tokens: data.tokens, email: caller.email,
      redirectUrl: `${appBaseUrl() ?? req.nextUrl.origin}/${locale}/padre?compra=ok`,
      descripcion: tipo === 'aria'
        ? (locale === 'en' ? `${data.tokens} ARIA message token(s)` : `${data.tokens} token(s) de mensajes con ARIA`)
        : (locale === 'en' ? `${data.tokens} home practice token(s)` : `${data.tokens} token(s) de práctica en casa`),
      locale,
    })
  } catch (e) { console.error('[tokens padre] checkout', e) }
  return NextResponse.json({ compra: data, checkoutUrl })
}
