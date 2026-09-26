import { createClient } from '@/lib/supabase-server'
import { contextoPrecios } from '@/lib/precios-server'
import type { PlanPublico } from '@/components/ui/planes-precios'
import PricingView from './pricing-view'
import type { Metadata } from 'next'
import { localeServidor } from '@/lib/locale-server'

export async function generateMetadata(): Promise<Metadata> {
  const en = (await localeServidor()) === 'en'
  const title = en ? 'Pricing · Vanty ABA' : 'Precios · Vanty ABA'
  const description = en
    ? 'Plans for ABA and child development therapy centers: scheduling, clinical records, AI reports and a family portal. Start with a free trial.'
    : 'Planes para centros de terapia ABA y desarrollo infantil: agenda, expedientes, informes con IA y portal para familias. Empieza con una prueba gratuita.'
  return { title, description, openGraph: { title, description, images: ['/images/og-image.jpg'] } }
}

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
