// Suscripción del centro del CALLER: estado (prueba / pago) y elección o renovación de plan.
// Queda fuera del bloqueo de centros inactivos del proxy (es justo lo que un centro vencido necesita usar).
// El pago se confirma a mano desde /control: elegir plan deja el centro en 'pending_payment'.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, unauthorized, forbidden } from '@/lib/api-auth'
import { fasePago, motivoBloqueo } from '@/lib/estado-centro'
import { contextoPrecios } from '@/lib/precios-server'
import { REGIONES, equivalenteLocal, precioMensual, type PrecioRegion } from '@/lib/precios'
import { esEncargadoDelCentro } from '@/lib/eliminar-centro'

export const dynamic = 'force-dynamic'

const DUENOS = ['jefe', 'admin']

export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!caller.centroId) return forbidden()

  const [{ data: centro }, { data: planes }] = await Promise.all([
    supabaseAdmin.from('centros').select('name, status, trial_ends_at, paid_until, plan_id, pais, ciclo_facturacion, lemon_subscription_id, lemon_estado').eq('id', caller.centroId).maybeSingle(),
    supabaseAdmin.from('plans')
      .select('id, code, name_es, name_en, precio_region, max_patients, max_professionals, max_parents, max_ai_reports, has_team_chat, has_catalog, has_financial_reports')
      .eq('is_active', true).order('sort_order'),
  ])
  if (!centro) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const pago = fasePago(centro)
  // Precio según la región del centro (país guardado al crearlo o, si falta, el detectado ahora)
  const ctx = await contextoPrecios(centro.pais)
  const moneda = REGIONES[ctx.region].moneda
  const conPrecio = (planes || []).map(p => {
    const mensual = precioMensual(p.precio_region as PrecioRegion, ctx.region)
    return { ...p, precio: mensual, local: mensual != null ? equivalenteLocal(mensual, moneda, ctx.monedaLocal, ctx.tasas) : null }
  })
  return NextResponse.json({
    centro: centro.name,
    status: centro.status,
    trialEndsAt: centro.trial_ends_at,
    paidUntil: centro.paid_until,
    planId: centro.plan_id,
    rol: caller.role,
    esDueno: DUENOS.includes(caller.role),
    // Persona encargada (quien creó el centro): la única que puede cancelar la suscripción o eliminar el centro
    esEncargado: await esEncargadoDelCentro(caller.id, caller.centroId),
    suscripcion: centro.lemon_subscription_id ? { estado: centro.lemon_estado ?? null } : null,
    bloqueo: motivoBloqueo(centro),
    pago,
    planes: conPrecio,
    moneda,
    monedaLocal: ctx.monedaLocal,
    ciclo: centro.ciclo_facturacion ?? 'mensual',
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!caller.centroId || !DUENOS.includes(caller.role)) return forbidden()

  const body = await req.json().catch(() => ({}))
  const code = typeof body?.plan === 'string' ? body.plan : ''
  const ciclo = body?.ciclo === 'anual' ? 'anual' : 'mensual'
  const { data: plan } = await supabaseAdmin.from('plans').select('id, name_es').eq('code', code).eq('is_active', true).maybeSingle()
  if (!plan) return NextResponse.json({ error: 'plan_invalido' }, { status: 400 })

  const { data: centro } = await supabaseAdmin.from('centros').select('status, paid_until').eq('id', caller.centroId).maybeSingle()
  // Un centro activo y al día cambia de plan desde /control; aquí solo prueba vencida o pago vencido
  if (!centro || (centro.status === 'active' && fasePago(centro).fase !== 'vencido')) return NextResponse.json({ error: 'no_aplica' }, { status: 409 })

  const renovacion = centro.status === 'active'
  const { error } = await supabaseAdmin.from('centros')
    .update({ plan_id: plan.id, status: 'pending_payment', ciclo_facturacion: ciclo, updated_at: new Date().toISOString() })
    .eq('id', caller.centroId)
  if (error) return NextResponse.json({ error: 'no_guardado' }, { status: 500 })

  await supabaseAdmin.from('subscription_events').insert({
    centro_id: caller.centroId, event: 'plan_requested', plan_id: plan.id,
    note: `${renovacion ? 'Renovación · ' : ''}${plan.name_es} · ${ciclo}`, actor_id: caller.id,
  })
  return NextResponse.json({ ok: true })
}
