'use client'

import { supabase } from '@/lib/supabase'

export class ControlError extends Error {
  constructor(public code: string, public status: number) {
    super(code)
  }
}

async function accessToken() {
  const { data } = await supabase.auth.getSession()
  if (data.session?.access_token) return data.session.access_token
  const refreshed = await supabase.auth.refreshSession().catch(() => null)
  return refreshed?.data.session?.access_token ?? ''
}

export async function callControl<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const token = await accessToken()
  if (!token) throw new ControlError('no_session', 401)
  const res = await fetch('/api/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...params }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new ControlError(json.error ?? 'error', res.status)
  return json as T
}

export type Plan = {
  id: string
  code: string
  name_es: string
  name_en: string
  price_pen: number
  precio_region: Partial<Record<'sudamerica' | 'norteamerica' | 'europa', number>>
  lemon_variant_mensual: string | null
  lemon_variant_anual: string | null
  max_professionals: number | null
  max_parents: number | null
  max_patients: number | null
  max_ai_reports: number | null
  max_aria_msgs_staff_day: number | null
  max_aria_msgs_parent_day: number | null
  max_parent_plans_month: number | null
  has_team_chat: boolean
  has_catalog: boolean
  has_financial_reports: boolean
  max_predictive_tokens: number | null
  extra_ai_pack_size: number
  extra_ai_pack_price_pen: number | null
  extra_parent_price_pen: number | null
  is_active: boolean
  sort_order: number
  max_storage_mb: number | null
  max_db_mb: number | null
}

export type CentroRow = {
  id: string
  name: string
  slug: string
  email: string | null
  logo_url: string | null
  status: 'trial' | 'pending_payment' | 'active' | 'suspended'
  trial_ends_at: string | null
  paid_until: string | null
  extra_parents: number
  created_at: string
  plan_id: string | null
  plans: Pick<Plan, 'code' | 'name_es' | 'price_pen' | 'max_professionals' | 'max_parents' | 'max_patients' | 'max_ai_reports' | 'max_predictive_tokens' | 'max_storage_mb' | 'max_db_mb' | 'has_team_chat' | 'has_catalog' | 'has_financial_reports'> | null
  limites: Partial<Record<'max_patients' | 'max_professionals' | 'max_parents' | 'max_storage_mb' | 'max_db_mb' | 'max_predictive_tokens' | 'max_ai_reports' | 'max_parent_plans_month' | 'max_aria_msgs_parent_day' | 'max_aria_msgs_staff_day', number>>
  comprasPendientes: number
  features: Record<string, boolean>
  uso: { archivos: number; datos: number; datosCalculadoAt: string | null }
  counts: { staff: number; parents: number; patients: number }
  ai: { report: { used: number; extra: number }; predictive: { used: number; extra: number } }
}

export type SecurityEvent = {
  id: string
  tipo: string
  nivel: 'bajo' | 'medio' | 'alto' | 'critico'
  descripcion: string
  ip_address: string | null
  metadata: Record<string, unknown> | null
  resuelto: boolean
  timestamp: string
}

export type AuditEntry = {
  seq: number
  created_at: string
  action: string
  resource_type: string | null
  description: string | null
  user_email: string | null
  user_role: string | null
  success: boolean
  ip_address: string | null
  hash: string | null
}

export type PlatformSettings = {
  maintenance: boolean
  maintenance_msg: string | null
  trial_days: number
  login_max_failures: number
  login_lockout_minutes: number
  features: Record<string, boolean>
  token_packs: { tokens: number; usd: number }[]
  lemon_variant_tokens: string | null
  app_android: AppAndroid
}

/** Última versión de la app de Android: la app avisa a quien tenga una más antigua y muestra las notas. */
export type AppAndroid = {
  version_code?: number
  version_name?: string
  notas?: string
  url_apk?: string
  obligatoria?: boolean
}
