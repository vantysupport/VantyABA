// Cobros de la plataforma (suscripciones de centros y compras de tokens). No confundir con lib/pagos.ts (pagos de pacientes).
import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { REGIONES, precioCiclo, precioMensual, regionDePais, type Ciclo, type PrecioRegion } from '@/lib/precios'
import { tasasCambio } from '@/lib/precios-server'
import { avisarEquipo, avisarFamilia } from '@/lib/avisos'

export type ResultadoAcreditar = { ok: true } | { ok: false; error: 'not_found' | 'already_processed' | string }

/**
 * Marca una compra de tokens como pagada y suma los tokens (al padre o al centro).
 * La usan la confirmación manual de /control y el webhook de la pasarela. Idempotente: solo actúa si sigue "pendiente".
 */
export async function acreditarCompra(compraId: string, opts: { actor: string | null; referencia?: string | null; proveedor?: string }): Promise<ResultadoAcreditar> {
  const { data: compra } = await supabaseAdmin.from('compras_tokens').select('*').eq('id', compraId).maybeSingle()
  if (!compra) return { ok: false, error: 'not_found' }
  if (compra.estado !== 'pendiente') return { ok: false, error: 'already_processed' }
  // Se marca primero (solo si sigue pendiente) para no sumar dos veces
  const { data: marcada } = await supabaseAdmin.from('compras_tokens')
    .update({
      estado: 'pagada', pagada_at: new Date().toISOString(), confirmada_por: opts.actor,
      referencia: opts.referencia || compra.referencia, ...(opts.proveedor ? { proveedor: opts.proveedor } : {}),
    })
    .eq('id', compraId).eq('estado', 'pendiente').select('id').maybeSingle()
  if (!marcada) return { ok: false, error: 'already_processed' }

  const esPadre = typeof compra.kind === 'string' && compra.kind.startsWith('padre_')
  let error: { message: string } | null = null
  if (esPadre) {
    const { data: ok, error: e } = await supabaseAdmin.rpc('mover_tokens_padre', {
      p_user: compra.para_usuario, p_centro: compra.centro_id, p_tipo: compra.kind === 'padre_aria' ? 'aria' : 'practica', p_delta: compra.tokens,
    })
    error = e ?? (ok === true ? null : { message: 'no_se_sumaron' })
  } else {
    const { error: e } = await supabaseAdmin.rpc('grant_ai_topup', {
      p_centro: compra.centro_id, p_kind: compra.kind, p_amount: compra.tokens, p_price: null,
      p_note: `Compra de ${compra.tokens} token(s) · US$ ${Number(compra.precio_usd).toFixed(2)}`, p_actor: opts.actor,
    })
    error = e
  }
  if (error) {
    await supabaseAdmin.from('compras_tokens').update({ estado: 'pendiente', pagada_at: null, confirmada_por: null }).eq('id', compraId)
    return { ok: false, error: error.message }
  }

  // Aviso de compra acreditada
  const n = Number(compra.tokens)
  if (esPadre) {
    const aria = compra.kind === 'padre_aria'
    await avisarFamilia({
      parentId: compra.para_usuario, centroId: compra.centro_id, type: 'compra_tokens',
      title: { es: 'Compra confirmada', en: 'Purchase confirmed' },
      message: {
        es: `Se sumaron ${n} ${aria ? 'mensajes de ARIA' : 'tokens de práctica'} a tu cuenta.`,
        en: `${n} ${aria ? 'ARIA messages' : 'practice tokens'} were added to your account.`,
      },
      metadata: { compra_id: compraId },
    })
  } else {
    await avisarEquipo({
      centroId: compra.centro_id, roles: ['jefe', 'admin'], tipo: 'compra_tokens',
      titulo: { es: 'Compra de tokens confirmada', en: 'Token purchase confirmed' },
      mensaje: {
        es: `Se sumaron ${n} token(s) al centro · US$ ${Number(compra.precio_usd).toFixed(2)}.`,
        en: `${n} token(s) were added to the center · US$ ${Number(compra.precio_usd).toFixed(2)}.`,
      },
      metadata: { compra_id: compraId },
    })
  }
  return { ok: true }
}

/** Precio a cobrar (USD, en centavos) de un plan para un centro, según su región y ciclo. Europa se cobra en su equivalente en USD. */
export async function centavosPlan(precios: PrecioRegion | null, pais: string | null, ciclo: Ciclo): Promise<number | null> {
  const region = regionDePais(pais)
  const mensual = precioMensual(precios, region)
  if (mensual == null) return null
  let total = precioCiclo(mensual, ciclo)
  if (REGIONES[region].moneda === 'EUR') {
    const tasas = await tasasCambio()
    total = total / (tasas.EUR || 0.92)
  }
  return Math.round(total * 100)
}

/**
 * Checkout de Lemon para una compra de tokens ya registrada como "pendiente".
 * Devuelve null si la pasarela no está configurada (la compra queda para confirmar a mano en /control).
 */
export async function checkoutCompraTokens(opts: {
  compraId: string; precioUsd: number; tokens: number; email: string | null; redirectUrl: string; descripcion: string; locale?: 'es' | 'en'
}): Promise<string | null> {
  const { lemonConfigurado, crearCheckout } = await import('@/lib/lemon')
  if (!lemonConfigurado()) return null
  const { data: ajustes } = await supabaseAdmin.from('platform_settings').select('lemon_variant_tokens').eq('id', 1).maybeSingle()
  const variante = ajustes?.lemon_variant_tokens
  if (!variante) return null
  const url = await crearCheckout({
    variantId: variante,
    centavos: Math.round(opts.precioUsd * 100),
    email: opts.email,
    custom: { tipo: 'tokens', compra_id: opts.compraId },
    redirectUrl: opts.redirectUrl,
    descripcion: opts.descripcion,
    locale: opts.locale,
  })
  await supabaseAdmin.from('compras_tokens').update({ proveedor: 'lemonsqueezy' }).eq('id', opts.compraId)
  return url
}

/** Las compras pendientes con la pasarela cuyo checkout ya venció (2 h) se dan por abandonadas. */
export async function limpiarComprasAbandonadas(filtro: { centro_id?: string; para_usuario?: string }) {
  let q = supabaseAdmin.from('compras_tokens').update({ estado: 'cancelada' })
    .eq('estado', 'pendiente').eq('proveedor', 'lemonsqueezy').lt('created_at', new Date(Date.now() - 2 * 3600_000).toISOString())
  if (filtro.centro_id) q = q.eq('centro_id', filtro.centro_id)
  if (filtro.para_usuario) q = q.eq('para_usuario', filtro.para_usuario)
  await q
}

type SubAttrs = Record<string, unknown>
const SUB_ACTIVOS = new Set(['active', 'on_trial', 'past_due'])

/**
 * Aplica al centro el estado de una suscripción de Lemon (webhook o sincronización).
 * `planId` / `ciclo`: si no vienen en custom_data, se deducen de la variante contratada.
 */
export async function aplicarSuscripcion(centroId: string, subId: string, a: SubAttrs, extra: { planId?: string | null; ciclo?: string | null; evento?: string; prueba?: boolean }) {
  let planId = extra.planId ?? null
  let ciclo = extra.ciclo ?? null
  if ((!planId || !ciclo) && a.variant_id != null) {
    const v = String(a.variant_id)
    const { data: planes } = await supabaseAdmin.from('plans').select('id, lemon_variant_mensual, lemon_variant_anual, lemon_variantes')
    for (const pl of planes ?? []) {
      const regiones = Object.values((pl.lemon_variantes ?? {}) as Record<string, { mensual?: string; anual?: string }>)
      const esAnual = pl.lemon_variant_anual === v || regiones.some(r => r?.anual === v)
      const esMensual = pl.lemon_variant_mensual === v || regiones.some(r => r?.mensual === v)
      if (esAnual || esMensual) { planId = planId ?? pl.id; ciclo = ciclo ?? (esAnual ? 'anual' : 'mensual'); break }
    }
  }
  const estado = String(a.status ?? '')
  const renueva = typeof a.renews_at === 'string' ? a.renews_at : null
  const termina = typeof a.ends_at === 'string' ? a.ends_at : null
  const cambios: Record<string, unknown> = {
    lemon_subscription_id: subId, lemon_customer_id: a.customer_id != null ? String(a.customer_id) : null,
    lemon_estado: estado, updated_at: new Date().toISOString(),
  }
  if (planId) cambios.plan_id = planId
  if (ciclo === 'anual' || ciclo === 'mensual') cambios.ciclo_facturacion = ciclo
  if (SUB_ACTIVOS.has(estado)) {
    cambios.status = 'active'
    // past_due: no se adelanta la fecha; al pasar paid_until el centro entra en gracia y luego se bloquea
    if (estado !== 'past_due' && renueva) cambios.paid_until = renueva
  } else if (estado === 'cancelled') {
    if (termina) cambios.paid_until = termina // sigue activa hasta el final del periodo pagado
  } else if (estado === 'expired' || estado === 'unpaid') {
    cambios.paid_until = termina ?? new Date().toISOString()
  }
  const { data: antes } = await supabaseAdmin.from('centros').select('status, lemon_estado, paid_until').eq('id', centroId).maybeSingle()
  const { error } = await supabaseAdmin.from('centros').update(cambios).eq('id', centroId)
  if (error) throw new Error(error.message)

  // Historial: solo cuando algo cambió de verdad
  const nuevoPago = SUB_ACTIVOS.has(estado) && estado !== 'past_due' && (antes?.status !== 'active' || (renueva && antes?.paid_until !== renueva))
  const ev = nuevoPago ? 'payment_confirmed' : estado === 'expired' && antes?.lemon_estado !== 'expired' ? 'suspended' : null
  if (ev) {
    await supabaseAdmin.from('subscription_events').insert({
      centro_id: centroId, event: ev, plan_id: planId, reference: subId,
      note: `Lemon Squeezy · ${extra.evento ?? 'sync'} · ${estado}${extra.prueba ? ' · prueba' : ''}`,
    })
    const hasta = (renueva ?? termina ?? '').slice(0, 10)
    await avisarEquipo({
      centroId, roles: ['jefe', 'admin'], tipo: ev === 'payment_confirmed' ? 'pago_suscripcion' : 'suscripcion_suspendida', prioridad: 1,
      titulo: ev === 'payment_confirmed'
        ? { es: 'Pago de suscripción recibido', en: 'Subscription payment received' }
        : { es: 'Suscripción vencida', en: 'Subscription expired' },
      mensaje: ev === 'payment_confirmed'
        ? { es: `Tu plan está activo${hasta ? ` hasta el ${hasta}` : ''}.`, en: `Your plan is active${hasta ? ` until ${hasta}` : ''}.` }
        : { es: 'No se registró el pago. Elige un plan para seguir usando Vanty.', en: 'No payment was recorded. Choose a plan to keep using Vanty.' },
      metadata: { subscription_id: subId },
    })
  }
}
