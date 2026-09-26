import { createClient } from '@/lib/supabase-server'
import { contextoPrecios } from '@/lib/precios-server'
import type { PlanPublico } from '@/components/ui/planes-precios'
import PricingView from './pricing-view'

export default async function PreciosPage({ searchParams }: { searchParams: Promise<{ pais?: string }> }) {
  const { pais } = await searchParams
  const supabase = await createClient()
  const [{ data }, contexto] = await Promise.all([
    supabase
      .from('plans')
      .select('id, code, name_es, name_en, precio_region, max_professionals, max_parents, max_patients, max_ai_reports, max_aria_msgs_staff_day, max_aria_msgs_parent_day, has_team_chat, has_catalog, has_financial_reports, max_predictive_tokens')
      .eq('is_active', true)
      .order('sort_order'),
    contextoPrecios(pais),
  ])
  return <PricingView plans={(data ?? []) as PlanPublico[]} contexto={contexto} />
}
