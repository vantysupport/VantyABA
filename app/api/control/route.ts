import { NextRequest, NextResponse } from 'next/server'
import { AUDIENCIAS, POSES, destinatarios, enviarCampana } from '@/lib/campanas'
import { acreditarCompra } from '@/lib/cobros-plataforma'
import { fasePago } from '@/lib/estado-centro'
import { tasasCambio } from '@/lib/precios-server'
import { REGIONES, precioCiclo, precioMensual, regionDePais, type PrecioRegion } from '@/lib/precios'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { requireProgramador } from '@/lib/require-programador'
import { logAuditEvent } from '@/lib/audit-log'
import { eliminarCentro } from '@/lib/eliminar-centro'
import { lemonConfigurado, variantesDeLaTienda, type VarianteLemon } from '@/lib/lemon'

// Vanty platform console API.
//  • GET  → public-safe platform status (maintenance + global module switches). Logged-in consumers only (proxy).
//  • POST 'log_error' → anyone (errors happen before login).
//  • POST everything else → role 'programador' with a verified second factor (see lib/require-programador.ts).
// Every mutating action is written to the tamper-evident audit_log.

export type FeaturesConfig = Record<string, boolean>

type Body = Record<string, unknown> & { action?: string }

const PLAN_FIELDS = [
  'name_es', 'name_en', 'price_pen', 'max_professionals', 'max_parents', 'max_patients', 'max_ai_reports',
  'max_aria_msgs_staff_day', 'max_aria_msgs_parent_day', 'max_parent_plans_month', 'has_team_chat', 'has_catalog', 'has_financial_reports',
  'max_predictive_tokens', 'extra_ai_pack_size', 'extra_ai_pack_price_pen', 'extra_parent_price_pen', 'is_active', 'sort_order',
  'max_storage_mb', 'max_db_mb', 'precio_region', 'lemon_variant_mensual', 'lemon_variant_anual',
] as const
const PLAN_BOOLEANS = new Set(['has_team_chat', 'has_catalog', 'has_financial_reports', 'is_active'])
const PLAN_TEXT = new Set(['name_es', 'name_en'])
const PLAN_PRICES = new Set(['price_pen', 'extra_ai_pack_price_pen', 'extra_parent_price_pen'])

function cleanPlan(input: unknown): Record<string, unknown> {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of PLAN_FIELDS) {
    if (!(k in src)) continue
    const v = src[k]
    if (k === 'precio_region') {
      // { sudamerica, norteamerica, europa }: precio mensual en la moneda de cada región
      const obj = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
      const limpio: Record<string, number> = {}
      for (const r of ['sudamerica', 'norteamerica', 'europa']) {
        const n = Number(obj[r])
        if (obj[r] !== null && obj[r] !== '' && Number.isFinite(n) && n > 0) limpio[r] = Math.round(n * 100) / 100
      }
      out[k] = limpio
      continue
    }
    if (k === 'lemon_variant_mensual' || k === 'lemon_variant_anual') {
      // ID numérico de la variante en Lemon Squeezy (vacío = sin configurar)
      const id = String(v ?? '').trim()
      out[k] = /^\d{1,12}$/.test(id) ? id : null
      continue
    }
    if (PLAN_BOOLEANS.has(k)) out[k] = !!v
    else if (PLAN_TEXT.has(k)) out[k] = String(v ?? '').trim().slice(0, 60)
    else if (PLAN_PRICES.has(k)) out[k] = v === null || v === '' ? null : Math.max(0, Math.round(Number(v) * 100) / 100)
    else out[k] = v === null || v === '' ? null : Math.max(0, Math.floor(Number(v)))
    if (typeof out[k] === 'number' && !Number.isFinite(out[k] as number)) delete out[k]
  }
  return out
}

const str = (v: unknown, max = 300) => String(v ?? '').trim().slice(0, max)
const int = (v: unknown, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(Number(v) || 0)))
const uuid = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null)

// Plan flags from the pricing tiers → the sidebar module keys they gate.
const PLAN_GATES: Record<string, string[]> = {
  has_team_chat: ['chat_especialistas'],
  has_catalog: ['recursos_tienda'],
  // Pagos va junto a Reportes financieros (plan Clinic y superiores)
  has_financial_reports: ['reportes_financieros', 'pagos'],
}
// Cerebro IA completo (aprender, biblioteca, estadísticas) solo en el plan Fundador: es la base
// curada que comparten todas las clínicas. Los planes públicos solo consultan la CIE-11.
const SOLO_FUNDADOR = ['cerebro_aprender', 'cerebro_biblioteca']

export async function GET() {
  const { data } = await supabaseAdmin.from('platform_settings').select('maintenance, maintenance_msg, features').eq('id', 1).maybeSingle()
  const features: FeaturesConfig = { ...((data?.features as FeaturesConfig) ?? {}) }

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims() // firma verificada localmente
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub as string } : null
  if (user) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('centros(status, features, plans(code, has_team_chat, has_catalog, has_financial_reports))')
      .eq('id', user.id)
      .maybeSingle()
    const centro = profile?.centros as unknown as { features: Record<string, boolean> | null; plans: Record<string, boolean | string> | null } | null
    const plan = centro?.plans
    if (plan) {
      for (const [flag, keys] of Object.entries(PLAN_GATES)) {
        if (!plan[flag]) for (const key of keys) features[key] = false
      }
      if (plan.code !== 'fundador') for (const key of SOLO_FUNDADOR) features[key] = false
    }
    // Funciones apagadas para este centro desde /control
    for (const [key, on] of Object.entries(centro?.features ?? {})) {
      if (on === false) features[key] = false
    }
  }

  return NextResponse.json({
    maintenance: !!data?.maintenance,
    maintenance_msg: data?.maintenance_msg ?? '',
    features,
  })
}

export async function POST(req: NextRequest) {
  let body: Body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }
  const action = body.action

  if (action === 'log_error') {
    const message = str(body.message, 500)
    const detail = str(body.detail, 4000)
    if (message || detail) {
      await supabaseAdmin.from('error_logs').insert({
        message, detail, source: str(body.source, 100), url: str(body.url, 300), user_email: str(body.user_email, 200),
      })
    }
    return NextResponse.json({ ok: true })
  }

  const auth = await requireProgramador(req)
  if (!auth.ok) return NextResponse.json({ error: auth.code }, { status: auth.status })

  const audit = (description: string, metadata: Record<string, unknown> = {}) =>
    logAuditEvent({ action: 'update', resource_type: 'config', userId: auth.userId, userEmail: auth.email, userRole: 'programador', description, metadata, req })

  switch (action) {
    // ── Notificaciones manuales (push + campana) ─────────────────────────────
    case 'campanas_list': {
      const [{ data: campanas }, { data: centros }] = await Promise.all([
        supabaseAdmin.from('campanas_notificacion').select('*, centros(name)').order('created_at', { ascending: false }).limit(50),
        supabaseAdmin.from('centros').select('id, name').order('name'),
      ])
      return NextResponse.json({ campanas: campanas ?? [], centros: centros ?? [] })
    }
    case 'campana_alcance': {
      const audiencia = Array.isArray(body.audiencia) ? (body.audiencia as unknown[]).filter((a): a is string => typeof a === 'string') : []
      const centroId = typeof body.centro_id === 'string' && body.centro_id ? body.centro_id : null
      const personas = await destinatarios(audiencia, centroId)
      const conPush = personas.length
        ? (await supabaseAdmin.from('push_subscriptions').select('user_id').in('user_id', personas.slice(0, 5000).map(p => p.id))).data?.length ?? 0
        : 0
      return NextResponse.json({ total: personas.length, conPush })
    }
    case 'campana_crear': {
      const titulo = str(body.titulo, 80)
      const cuerpo = str(body.cuerpo, 240)
      const pose = POSES.includes(body.pose as never) ? String(body.pose) : 'saludo'
      const audiencia = Array.isArray(body.audiencia) ? (body.audiencia as unknown[]).filter((a): a is string => typeof a === 'string' && a in AUDIENCIAS) : []
      const centroId = typeof body.centro_id === 'string' && body.centro_id ? body.centro_id : null
      const cuando = typeof body.programada_para === 'string' && !isNaN(Date.parse(body.programada_para)) ? new Date(body.programada_para) : new Date()
      if (!titulo || !cuerpo || !audiencia.length) return NextResponse.json({ error: 'datos_incompletos' }, { status: 400 })
      const { data: c, error } = await supabaseAdmin.from('campanas_notificacion').insert({
        titulo, cuerpo, pose, audiencia, centro_id: centroId, programada_para: cuando.toISOString(), creada_por: auth.userId,
      }).select('id').single()
      if (error || !c) return NextResponse.json({ error: 'no_guardada' }, { status: 500 })
      await audit(`Notificación "${titulo}" para ${audiencia.join(', ')}`, { campana_id: c.id })
      // Si la hora ya llegó (o es "ahora"), se envía de inmediato
      const resultado = cuando.getTime() <= Date.now() + 30_000 ? await enviarCampana(c.id) : null
      return NextResponse.json({ ok: true, id: c.id, enviada: !!resultado, ...(resultado ?? {}) })
    }
    case 'campana_cancelar': {
      const id = typeof body.id === 'string' ? body.id : ''
      await supabaseAdmin.from('campanas_notificacion').update({ estado: 'cancelada' }).eq('id', id).eq('estado', 'programada')
      return NextResponse.json({ ok: true })
    }
    case 'overview': {
      const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0)
      const [{ data: centros }, { count: patients }, { count: users }, { count: openAlerts }, { count: comprasPendientes }, { data: extrasMes }] = await Promise.all([
        supabaseAdmin.from('centros').select('id, name, logo_url, status, trial_ends_at, paid_until, created_at, pais, ciclo_facturacion, plans(name_es, precio_region)').order('created_at', { ascending: false }),
        supabaseAdmin.from('children').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('alertas_seguridad').select('id', { count: 'exact', head: true }).eq('resuelto', false).in('nivel', ['alto', 'critico']),
        supabaseAdmin.from('compras_tokens').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        // Compras de tokens / extras pagadas este mes (hoy manuales; con Paddle llegarán por webhook)
        supabaseAdmin.from('compras_tokens').select('precio_usd').eq('estado', 'pagada').gte('pagada_at', inicioMes.toISOString()),
      ])
      const extras = (extrasMes ?? []).reduce((a, x) => a + Number(x.precio_usd || 0), 0)
      const byStatus: Record<string, number> = { trial: 0, pending_payment: 0, active: 0, suspended: 0 }
      // MRR en USD: precio de la región de cada centro (anual prorrateado a 12 meses), euros convertidos a dólares
      let mrr = 0
      const tasas = await tasasCambio()
      let trialsEndingSoon = 0
      const soon = Date.now() + 7 * 86_400_000
      // Lo que requiere atención del programador
      type Item = { id: string; name: string; plan: string | null; fecha: string | null }
      const atencion: { pendientes: Item[]; pruebas: Item[]; vencidos: Item[] } = { pendientes: [], pruebas: [], vencidos: [] }
      let pagando = 0
      for (const c of centros ?? []) {
        const planNombre = (c.plans as unknown as { name_es: string } | null)?.name_es ?? null
        const item = { id: c.id, name: c.name, logo: c.logo_url ?? null, plan: planNombre }
        if (c.status === 'pending_payment') atencion.pendientes.push({ ...item, fecha: c.created_at })
        if (c.status === 'trial' && c.trial_ends_at && new Date(c.trial_ends_at).getTime() < soon) atencion.pruebas.push({ ...item, fecha: c.trial_ends_at })
        const fase = fasePago(c).fase
        if (c.status === 'active' && (fase === 'gracia' || fase === 'vencido')) atencion.vencidos.push({ ...item, fecha: c.paid_until })
        if (c.status === 'active') pagando++
        byStatus[c.status] = (byStatus[c.status] ?? 0) + 1
        const plan = c.plans as unknown as { precio_region: PrecioRegion } | null
        const region = regionDePais(c.pais)
        const mensual = plan ? precioMensual(plan.precio_region, region) : null
        if (c.status === 'active' && mensual != null) {
          const porMes = c.ciclo_facturacion === 'anual' ? precioCiclo(mensual, 'anual') / 12 : mensual
          mrr += REGIONES[region].moneda === 'EUR' ? porMes / (tasas.EUR || 0.92) : porMes
        }
        if (c.status === 'trial' && c.trial_ends_at && new Date(c.trial_ends_at).getTime() < soon) trialsEndingSoon++
      }
      const recientes = (centros ?? []).slice(0, 5).map(c => ({
        id: c.id, name: c.name, logo: c.logo_url ?? null, status: c.status, created_at: c.created_at, plan: (c.plans as unknown as { name_es: string } | null)?.name_es ?? null,
      }))
      return NextResponse.json({
        byStatus, mrr, trialsEndingSoon, patients: patients ?? 0, users: users ?? 0, openAlerts: openAlerts ?? 0,
        total: centros?.length ?? 0, pagando, atencion, recientes, comprasPendientes: comprasPendientes ?? 0,
        extras, extrasCompras: extrasMes?.length ?? 0,
      })
    }

    case 'list_centros': {
      const period = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
      const [{ data: centros, error }, { data: profiles }, { data: children }, { data: usage }, { data: balance }] = await Promise.all([
        supabaseAdmin.from('centros').select('id, name, slug, email, logo_url, status, trial_ends_at, paid_until, extra_parents, created_at, plan_id, limites, features, uso_datos_bytes, uso_calculado_at, plans(code, name_es, price_pen, max_professionals, max_parents, max_patients, max_ai_reports, max_predictive_tokens, max_storage_mb, max_db_mb, max_parent_plans_month, max_aria_msgs_parent_day, max_aria_msgs_staff_day, has_team_chat, has_catalog, has_financial_reports)').order('created_at', { ascending: false }),
        supabaseAdmin.from('profiles').select('centro_id, role'),
        supabaseAdmin.from('children').select('centro_id'),
        supabaseAdmin.from('ai_usage').select('centro_id, kind, used').eq('period_start', period),
        supabaseAdmin.from('ai_balance').select('centro_id, kind, extra_remaining'),
      ])
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      // Archivos por centro (suma de tamaños registrados)
      const [{ data: docs }, { data: adj }] = await Promise.all([
        supabaseAdmin.from('patient_documents').select('centro_id, file_size').not('file_size', 'is', null),
        supabaseAdmin.from('chat_familias').select('centro_id, file_size').not('file_size', 'is', null),
      ])
      const archivos: Record<string, number> = {}
      for (const r of [...(docs ?? []), ...(adj ?? [])] as { centro_id: string; file_size: number }[]) archivos[r.centro_id] = (archivos[r.centro_id] ?? 0) + Number(r.file_size || 0)
      const { data: pendientes } = await supabaseAdmin.from('compras_tokens').select('centro_id').eq('estado', 'pendiente')
      const rows = (centros ?? []).map(c => {
        const staff = (profiles ?? []).filter(p => p.centro_id === c.id && p.role !== 'padre').length
        const parents = (profiles ?? []).filter(p => p.centro_id === c.id && p.role === 'padre').length
        const patients = (children ?? []).filter(ch => ch.centro_id === c.id).length
        const used = (kind: string) => (usage ?? []).find(u => u.centro_id === c.id && u.kind === kind)?.used ?? 0
        const extra = (kind: string) => (balance ?? []).find(b => b.centro_id === c.id && b.kind === kind)?.extra_remaining ?? 0
        return {
          ...c,
          comprasPendientes: (pendientes ?? []).filter(pd => pd.centro_id === c.id).length,
          uso: { archivos: archivos[c.id] ?? 0, datos: Number(c.uso_datos_bytes || 0), datosCalculadoAt: c.uso_calculado_at },
          counts: { staff, parents, patients },
          ai: { report: { used: used('report'), extra: extra('report') }, predictive: { used: used('predictive'), extra: extra('predictive') } },
        }
      })
      return NextResponse.json({ centros: rows })
    }

    case 'centro_events': {
      const centroId = uuid(body.centro_id)
      if (!centroId) return NextResponse.json({ error: 'invalid_centro' }, { status: 400 })
      const [{ data: events }, { data: topups }] = await Promise.all([
        supabaseAdmin.from('subscription_events').select('*, plans(name_es)').eq('centro_id', centroId).order('created_at', { ascending: false }).limit(100),
        supabaseAdmin.from('token_topups').select('*').eq('centro_id', centroId).order('created_at', { ascending: false }).limit(100),
      ])
      return NextResponse.json({ events: events ?? [], topups: topups ?? [] })
    }

    case 'confirm_payment': {
      const centroId = uuid(body.centro_id)
      const planId = uuid(body.plan_id)
      const months = int(body.months, 1, 24)
      if (!centroId || !planId) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      const { data: centro } = await supabaseAdmin.from('centros').select('paid_until').eq('id', centroId).maybeSingle()
      if (!centro) return NextResponse.json({ error: 'not_found' }, { status: 404 })
      const today = new Date()
      const base = centro.paid_until && new Date(centro.paid_until) > today ? new Date(centro.paid_until) : today
      base.setMonth(base.getMonth() + months)
      const paidUntil = base.toISOString().slice(0, 10)
      const amount = body.amount_pen === '' || body.amount_pen == null ? null : Math.max(0, Number(body.amount_pen))
      const { error } = await supabaseAdmin.from('centros').update({ status: 'active', plan_id: planId, paid_until: paidUntil }).eq('id', centroId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await supabaseAdmin.from('subscription_events').insert({
        centro_id: centroId, event: 'payment_confirmed', plan_id: planId, amount_pen: amount,
        reference: str(body.reference, 120) || null, note: `${months} mes(es) · hasta ${paidUntil}`, actor_id: auth.userId,
      })
      await audit('Pago confirmado y plan activado', { centroId, planId, months, amount, paidUntil })
      return NextResponse.json({ ok: true, paid_until: paidUntil })
    }

    case 'set_centro_status': {
      const centroId = uuid(body.centro_id)
      const status = str(body.status, 20)
      if (!centroId || !['active', 'suspended'].includes(status)) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      const { error } = await supabaseAdmin.from('centros').update({ status }).eq('id', centroId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await supabaseAdmin.from('subscription_events').insert({
        centro_id: centroId, event: status === 'suspended' ? 'suspended' : 'reactivated', note: str(body.note, 300) || null, actor_id: auth.userId,
      })
      await audit(`Centro ${status === 'suspended' ? 'suspendido' : 'reactivado'}`, { centroId })
      return NextResponse.json({ ok: true })
    }

    case 'delete_centro': {
      // Borra el centro con toda su información y las cuentas (correos) de su equipo y sus familias.
      // Se exige escribir el nombre exacto del centro, como en la confirmación del panel.
      const centroId = uuid(body.centro_id)
      if (!centroId) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      const { data: centro } = await supabaseAdmin.from('centros').select('id, name, logo_url').eq('id', centroId).maybeSingle()
      if (!centro) return NextResponse.json({ error: 'not_found' }, { status: 404 })
      if (str(body.confirm_name, 200) !== (centro.name ?? '').trim()) return NextResponse.json({ error: 'name_mismatch' }, { status: 400 })

      const r = await eliminarCentro(centroId, { operador: auth.userId })
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === 'has_programador' ? 409 : 500 })
      await audit('Centro eliminado', { centroId, name: centro.name, cuentas: r.cuentas, pacientes: r.pacientes, resultado: r.resultado, cuentasFallidas: r.cuentasFallidas })
      return NextResponse.json({ ok: true, cuentas: r.cuentas, cuentas_fallidas: r.cuentasFallidas, pacientes: r.pacientes })
    }

    case 'extend_trial': {
      const centroId = uuid(body.centro_id)
      const days = int(body.days, 1, 90)
      if (!centroId) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      const { data: centro } = await supabaseAdmin.from('centros').select('trial_ends_at').eq('id', centroId).maybeSingle()
      if (!centro) return NextResponse.json({ error: 'not_found' }, { status: 404 })
      const from = centro.trial_ends_at && new Date(centro.trial_ends_at) > new Date() ? new Date(centro.trial_ends_at) : new Date()
      const trialEndsAt = new Date(from.getTime() + days * 86_400_000).toISOString()
      await supabaseAdmin.from('centros').update({ trial_ends_at: trialEndsAt, status: 'trial' }).eq('id', centroId)
      await supabaseAdmin.from('subscription_events').insert({ centro_id: centroId, event: 'trial_extended', note: `+${days} días`, actor_id: auth.userId })
      await audit('Prueba extendida', { centroId, days })
      return NextResponse.json({ ok: true, trial_ends_at: trialEndsAt })
    }

    case 'set_trial_days': {
      // Fija los días de prueba que le QUEDAN (0 = termina la prueba ahora)
      const centroId = uuid(body.centro_id)
      const days = int(body.days, 0, 365)
      if (!centroId) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      const trialEndsAt = new Date(Date.now() + days * 86_400_000).toISOString()
      const { error } = await supabaseAdmin.from('centros').update({ trial_ends_at: trialEndsAt, status: 'trial' }).eq('id', centroId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await supabaseAdmin.from('subscription_events').insert({ centro_id: centroId, event: 'trial_extended', note: days === 0 ? 'Prueba terminada' : `Quedan ${days} días`, actor_id: auth.userId })
      await audit('Días de prueba fijados', { centroId, days })
      return NextResponse.json({ ok: true, trial_ends_at: trialEndsAt })
    }

    case 'set_centro_plan': {
      // Cambia el plan sin registrar un pago (p. ej. cortesía o corrección)
      const centroId = uuid(body.centro_id)
      const planId = uuid(body.plan_id)
      if (!centroId || !planId) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      const { error } = await supabaseAdmin.from('centros').update({ plan_id: planId }).eq('id', centroId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await supabaseAdmin.from('subscription_events').insert({ centro_id: centroId, event: 'plan_changed', plan_id: planId, note: str(body.note, 200) || null, actor_id: auth.userId })
      await audit('Plan del centro cambiado', { centroId, planId })
      return NextResponse.json({ ok: true })
    }

    case 'set_centro_limits': {
      // Límites propios del centro; un valor vacío vuelve a usar el del plan
      const centroId = uuid(body.centro_id)
      if (!centroId) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      const src = (body.limites && typeof body.limites === 'object' ? body.limites : {}) as Record<string, unknown>
      const limites: Record<string, number> = {}
      for (const k of ['max_patients', 'max_professionals', 'max_parents', 'max_storage_mb', 'max_db_mb', 'max_predictive_tokens', 'max_ai_reports', 'max_parent_plans_month', 'max_aria_msgs_parent_day', 'max_aria_msgs_staff_day']) {
        const v = src[k]
        if (v === '' || v == null) continue
        const n = Math.floor(Number(v))
        if (Number.isFinite(n) && n >= 0 && n <= 10_000_000) limites[k] = n
      }
      const { error } = await supabaseAdmin.from('centros').update({ limites }).eq('id', centroId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await audit('Límites propios del centro', { centroId, limites })
      return NextResponse.json({ ok: true })
    }

    case 'set_centro_features': {
      // Funciones activas para este centro (false = apagada solo para él)
      const centroId = uuid(body.centro_id)
      if (!centroId) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      const src = (body.features && typeof body.features === 'object' ? body.features : {}) as Record<string, unknown>
      const features: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(src)) if (/^[a-z_]{2,40}$/.test(k) && v === false) features[k] = false
      const { error } = await supabaseAdmin.from('centros').update({ features }).eq('id', centroId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await audit('Funciones del centro', { centroId, features })
      return NextResponse.json({ ok: true })
    }

    case 'refresh_centro_usage': {
      const centroId = uuid(body.centro_id)
      if (!centroId) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      const { data, error } = await supabaseAdmin.rpc('actualizar_uso_centro', { p_centro: centroId })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, datos: Number(data || 0) })
    }

    case 'list_compras_tokens': {
      // Compras de tokens (todas o de un centro)
      const centroId = uuid(body.centro_id)
      let q = supabaseAdmin.from('compras_tokens').select('*, centros(name), familia:profiles!compras_tokens_para_usuario_fkey(full_name, email)').order('created_at', { ascending: false }).limit(200)
      if (centroId) q = q.eq('centro_id', centroId)
      if (body.pendientes) q = q.eq('estado', 'pendiente')
      const { data, error } = await q
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ compras: data ?? [] })
    }

    case 'confirm_compra_tokens': {
      // Pago recibido a mano: se suman los tokens (misma lógica que el webhook de la pasarela)
      const compraId = uuid(body.id)
      if (!compraId) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      const r = await acreditarCompra(compraId, { actor: auth.userId, referencia: str(body.referencia, 120) || null })
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === 'not_found' ? 404 : r.error === 'already_processed' ? 409 : 500 })
      await audit('Compra de tokens confirmada', { compraId })
      return NextResponse.json({ ok: true })
    }

    case 'cancel_compra_tokens': {
      const compraId = uuid(body.id)
      if (!compraId) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      const { error } = await supabaseAdmin.from('compras_tokens').update({ estado: 'cancelada', confirmada_por: auth.userId }).eq('id', compraId).eq('estado', 'pendiente')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await audit('Compra de tokens cancelada', { compraId })
      return NextResponse.json({ ok: true })
    }

    case 'grant_topup': {
      const centroId = uuid(body.centro_id)
      const kind = str(body.kind, 20)
      const amount = Math.trunc(Number(body.amount))
      if (!centroId || !['report', 'predictive', 'parent_slot'].includes(kind) || !amount || Math.abs(amount) > 10_000) {
        return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      }
      const price = body.price_pen === '' || body.price_pen == null ? null : Math.max(0, Number(body.price_pen))
      const { error } = await supabaseAdmin.rpc('grant_ai_topup', {
        p_centro: centroId, p_kind: kind, p_amount: amount, p_price: price, p_note: str(body.note, 200) || null, p_actor: auth.userId,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await audit('Recarga de tokens / cupos', { centroId, kind, amount, price })
      return NextResponse.json({ ok: true })
    }

    case 'list_plans': {
      const { data, error } = await supabaseAdmin.from('plans').select('*').order('sort_order')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ plans: data ?? [] })
    }

    case 'update_plan': {
      const planId = uuid(body.id)
      const patch = cleanPlan(body.plan)
      if (!planId || Object.keys(patch).length === 0) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      const { data: before } = await supabaseAdmin.from('plans').select('*').eq('id', planId).maybeSingle()
      const { error } = await supabaseAdmin.from('plans').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', planId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await audit('Plan editado', { planId, before, patch })
      return NextResponse.json({ ok: true })
    }

    case 'create_plan': {
      const code = str(body.code, 30).toLowerCase().replace(/[^a-z0-9_-]/g, '')
      const plan = cleanPlan(body.plan)
      if (!code || !plan.name_es || !plan.name_en) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      const { data, error } = await supabaseAdmin.from('plans').insert({ code, ...plan }).select('id').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await audit('Plan creado', { code, plan })
      return NextResponse.json({ ok: true, id: data.id })
    }

    case 'get_settings': {
      const { data } = await supabaseAdmin.from('platform_settings').select('*').eq('id', 1).maybeSingle()
      return NextResponse.json({ settings: data })
    }

    case 'set_settings': {
      const s = (body.settings && typeof body.settings === 'object' ? body.settings : {}) as Record<string, unknown>
      const patch: Record<string, unknown> = {}
      if ('maintenance' in s) patch.maintenance = !!s.maintenance
      if ('maintenance_msg' in s) patch.maintenance_msg = str(s.maintenance_msg, 300)
      if ('trial_days' in s) patch.trial_days = int(s.trial_days, 0, 90)
      if ('login_max_failures' in s) patch.login_max_failures = int(s.login_max_failures, 3, 20)
      if ('login_lockout_minutes' in s) patch.login_lockout_minutes = int(s.login_lockout_minutes, 1, 1440)
      if ('features' in s && s.features && typeof s.features === 'object') {
        patch.features = Object.fromEntries(Object.entries(s.features as Record<string, unknown>).map(([k, v]) => [k.slice(0, 60), !!v]))
      }
      if ('token_packs' in s && Array.isArray(s.token_packs)) {
        patch.token_packs = (s.token_packs as { tokens?: unknown; usd?: unknown }[])
          .map(pk => ({ tokens: int(pk?.tokens, 1, 10000), usd: Math.max(0, Math.round(Number(pk?.usd) * 100) / 100) }))
          .filter(pk => pk.tokens > 0 && Number.isFinite(pk.usd))
          .slice(0, 6)
      }
      if ('lemon_variant_tokens' in s) {
        const id = String(s.lemon_variant_tokens ?? '').trim()
        patch.lemon_variant_tokens = /^\d{1,12}$/.test(id) ? id : null
      }
      if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      const { error } = await supabaseAdmin.from('platform_settings').update({ ...patch, updated_at: new Date().toISOString(), updated_by: auth.userId }).eq('id', 1)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await audit('Configuración de plataforma', { patch })
      return NextResponse.json({ ok: true })
    }

    case 'lemon_sync_variantes': {
      // Trae los IDs de variante desde Lemon Squeezy y los asocia por nombre:
      // producto (Starter / Professional / Clinic / Créditos de IA) y variante (región × ciclo).
      if (!lemonConfigurado()) return NextResponse.json({ error: 'lemon_no_configurado' }, { status: 400 })
      let variantes: VarianteLemon[]
      try { variantes = await variantesDeLaTienda() } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'lemon_error' }, { status: 502 })
      }
      const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
      const REGION_CICLO: Record<string, [string, 'mensual' | 'anual']> = {
        'plan mensual': ['sudamerica', 'mensual'], 'plan anual': ['sudamerica', 'anual'],
        'monthly plan': ['norteamerica', 'mensual'], 'annual plan': ['norteamerica', 'anual'],
        'cuota mensual': ['europa', 'mensual'], 'cuota anual': ['europa', 'anual'],
      }
      const publicadas = variantes.filter(v => v.estado !== 'draft')
      const { data: planes } = await supabaseAdmin.from('plans').select('id, code')
      const resumen: Record<string, Record<string, Record<string, string>>> = {}
      const faltan: string[] = []
      for (const plan of planes ?? []) {
        const delPlan = publicadas.filter(v => norm(v.producto).includes(plan.code))
        if (!delPlan.length) continue
        const regiones: Record<string, Record<string, string>> = {}
        for (const v of delPlan) {
          const rc = REGION_CICLO[norm(v.nombre)]
          if (rc) (regiones[rc[0]] ??= {})[rc[1]] = v.id
        }
        for (const [nombre, [r, c]] of Object.entries(REGION_CICLO)) if (!regiones[r]?.[c]) faltan.push(`${plan.code}: ${nombre}`)
        const base = regiones.sudamerica ?? {}
        const { error } = await supabaseAdmin.from('plans').update({
          lemon_variantes: regiones,
          ...(base.mensual ? { lemon_variant_mensual: base.mensual } : {}),
          ...(base.anual ? { lemon_variant_anual: base.anual } : {}),
        }).eq('id', plan.id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        resumen[plan.code] = regiones
      }
      const deTokens = publicadas.filter(v => /credito|token/.test(norm(v.producto)))
      const tokens = deTokens.find(v => v.estado === 'published') ?? deTokens[0]
      if (tokens) await supabaseAdmin.from('platform_settings').update({ lemon_variant_tokens: tokens.id, updated_at: new Date().toISOString(), updated_by: auth.userId }).eq('id', 1)
      else faltan.push('créditos de IA')
      await audit('Variantes de Lemon Squeezy sincronizadas', { resumen, tokens: tokens?.id ?? null, faltan })
      return NextResponse.json({ ok: true, resumen, tokens: tokens?.id ?? null, faltan, total: variantes.length })
    }

    case 'security_events': {
      let q = supabaseAdmin.from('alertas_seguridad').select('*').order('timestamp', { ascending: false }).limit(200)
      if (body.unresolved) q = q.eq('resuelto', false)
      if (typeof body.nivel === 'string' && body.nivel) q = q.eq('nivel', body.nivel)
      const { data, error } = await q
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ events: data ?? [] })
    }

    case 'resolve_event': {
      const id = uuid(body.id)
      if (!id) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      await supabaseAdmin.from('alertas_seguridad').update({ resuelto: true, resuelto_por: auth.userId, resuelto_at: new Date().toISOString() }).eq('id', id)
      await audit('Alerta de seguridad resuelta', { id })
      return NextResponse.json({ ok: true })
    }

    case 'audit_log': {
      const { data, error } = await supabaseAdmin
        .from('audit_log')
        .select('seq, created_at, action, resource_type, description, user_email, user_role, centro_id, success, ip_address, hash')
        .order('seq', { ascending: false })
        .limit(200)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ entries: data ?? [] })
    }

    case 'audit_verify': {
      const { data, error } = await supabaseAdmin.rpc('audit_log_verify')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      const row = Array.isArray(data) ? data[0] : data
      return NextResponse.json({ checked: row?.checked ?? 0, first_broken_seq: row?.first_broken_seq ?? null })
    }

    case 'get_errors': {
      const { data, error } = await supabaseAdmin.from('error_logs').select('*').order('created_at', { ascending: false }).limit(200)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ errors: data ?? [] })
    }

    case 'delete_errors': {
      const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map(uuid).filter((x): x is string => !!x).slice(0, 500) : []
      if (ids.length === 0) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      await supabaseAdmin.from('error_logs').delete().in('id', ids)
      await audit('Errores borrados (grupo)', { n: ids.length })
      return NextResponse.json({ ok: true })
    }

    case 'clear_errors': {
      await supabaseAdmin.from('error_logs').delete().not('id', 'is', null)
      await audit('Errores borrados')
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
  }
}
