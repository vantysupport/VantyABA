// Checkout de la suscripción del centro (Lemon Squeezy). Solo el dueño (jefe/admin).
//  POST { plan, ciclo } → { url } del checkout, con el precio de la región del centro.
//  GET → { portal } enlace al portal del cliente (cambiar tarjeta, facturas, cancelar).
//  PUT → sincroniza la suscripción con Lemon (respaldo del webhook).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, unauthorized, forbidden } from '@/lib/api-auth'
import { crearCheckout, lemonConfigurado, portalSuscripcion, suscripcionesPorEmail } from '@/lib/lemon'
import { aplicarSuscripcion, centavosPlan } from '@/lib/cobros-plataforma'
import { detectarPais } from '@/lib/precios-server'
import { appBaseUrl } from '@/lib/auth-emails'
import { getLocaleFromRequest } from '@/lib/lang'
import { regionDePais, type PrecioRegion } from '@/lib/precios'

export const dynamic = 'force-dynamic'
const DUENOS = ['jefe', 'admin']

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!caller.centroId || !DUENOS.includes(caller.role)) return forbidden()
  if (!lemonConfigurado()) return NextResponse.json({ error: 'pasarela_no_configurada' }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const ciclo = body?.ciclo === 'anual' ? 'anual' : 'mensual'
  const code = typeof body?.plan === 'string' ? body.plan : ''
  const [{ data: plan }, { data: centro }] = await Promise.all([
    supabaseAdmin.from('plans').select('id, code, name_es, name_en, precio_region, lemon_variant_mensual, lemon_variant_anual, lemon_variantes').eq('code', code).eq('is_active', true).maybeSingle(),
    supabaseAdmin.from('centros').select('id, name, email, pais, lemon_subscription_id, lemon_estado').eq('id', caller.centroId).maybeSingle(),
  ])
  if (!plan || !centro) return NextResponse.json({ error: 'plan_invalido' }, { status: 400 })
  // Con una suscripción vigente, los cambios se hacen desde el portal del cliente
  if (centro.lemon_subscription_id && ['active', 'on_trial', 'past_due'].includes(centro.lemon_estado ?? '')) {
    return NextResponse.json({ error: 'ya_suscrito' }, { status: 409 })
  }
  const pais = centro.pais ?? await detectarPais()
  // Variante de la región del centro (su precio base es el que Lemon rotula en el checkout); si falta, la general
  const porRegion = (plan.lemon_variantes ?? {}) as Record<string, { mensual?: string; anual?: string }>
  const region = regionDePais(pais)
  const varianteRegion = porRegion[region]?.[ciclo]
  const variante = varianteRegion || (ciclo === 'anual' ? plan.lemon_variant_anual : plan.lemon_variant_mensual)
  if (!variante) return NextResponse.json({ error: 'variante_no_configurada' }, { status: 503 })

  if (!centro.pais && pais) await supabaseAdmin.from('centros').update({ pais }).eq('id', centro.id)
  const centavos = await centavosPlan(plan.precio_region as PrecioRegion, pais, ciclo)
  if (centavos == null) return NextResponse.json({ error: 'sin_precio' }, { status: 400 })

  const locale = getLocaleFromRequest(req)
  const base = appBaseUrl() ?? req.nextUrl.origin
  try {
    const url = await crearCheckout({
      variantId: variante,
      // Europa con su propia variante: se cobra el precio fijo en USD de la variante (evita recalcular con el cambio del día)
      centavos: region === 'europa' && varianteRegion ? null : centavos,
      email: centro.email ?? caller.email,
      nombre: centro.name,
      custom: { tipo: 'suscripcion', centro_id: centro.id, plan_id: plan.id, ciclo },
      redirectUrl: `${base}/${locale}/suscripcion?pago=ok`,
      locale,
      descripcion: `${locale === 'en' ? plan.name_en : plan.name_es} · ${ciclo === 'anual' ? (locale === 'en' ? 'yearly' : 'anual') : (locale === 'en' ? 'monthly' : 'mensual')} · ${centro.name}`,
    })
    return NextResponse.json({ url })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'checkout_error' }, { status: 502 })
  }
}

export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!caller.centroId || !DUENOS.includes(caller.role)) return forbidden()
  if (!lemonConfigurado()) return NextResponse.json({ portal: null })
  const { data: centro } = await supabaseAdmin.from('centros').select('lemon_subscription_id').eq('id', caller.centroId).maybeSingle()
  if (!centro?.lemon_subscription_id) return NextResponse.json({ portal: null })
  try {
    return NextResponse.json({ portal: await portalSuscripcion(centro.lemon_subscription_id) })
  } catch {
    return NextResponse.json({ portal: null })
  }
}

// PUT → sincroniza con Lemon la suscripción del centro (respaldo si el webhook aún no llegó o no puede llegar, p. ej. en local).
export async function PUT(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!caller.centroId || !DUENOS.includes(caller.role)) return forbidden()
  if (!lemonConfigurado()) return NextResponse.json({ ok: false })
  const { data: centro } = await supabaseAdmin.from('centros').select('id, email').eq('id', caller.centroId).maybeSingle()
  if (!centro) return NextResponse.json({ ok: false })

  // Variantes que corresponden a nuestros planes
  const { data: planes } = await supabaseAdmin.from('plans').select('lemon_variant_mensual, lemon_variant_anual, lemon_variantes')
  const nuestras = new Set((planes ?? []).flatMap(p => [
    p.lemon_variant_mensual, p.lemon_variant_anual,
    ...Object.values((p.lemon_variantes ?? {}) as Record<string, { mensual?: string; anual?: string }>).flatMap(v => [v?.mensual, v?.anual]),
  ]).filter(Boolean) as string[])

  const correos = [...new Set([centro.email, caller.email].filter(Boolean) as string[])]
  try {
    for (const correo of correos) {
      const subs = (await suscripcionesPorEmail(correo)).filter(s => nuestras.has(String(s.attributes.variant_id)))
      const sub = subs[0]
      if (!sub) continue
      // Nunca se toma una suscripción que ya pertenece a otro centro
      const { data: otro } = await supabaseAdmin.from('centros').select('id').eq('lemon_subscription_id', sub.id).neq('id', centro.id).maybeSingle()
      if (otro) continue
      await aplicarSuscripcion(centro.id, sub.id, sub.attributes, { evento: 'sync' })
      return NextResponse.json({ ok: true, estado: sub.attributes.status })
    }
    return NextResponse.json({ ok: false })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'sync_error' })
  }
}
