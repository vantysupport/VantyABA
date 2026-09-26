import { createClient } from '@/lib/supabase-server'
import { contextoPrecios } from '@/lib/precios-server'
import type { PlanPublico } from '@/components/ui/planes-precios'
import PricingView from './pricing-view'
import type { Metadata } from 'next'
import { localeServidor, metadatosPagina } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const en = (await localeServidor()) === 'en'
  return metadatosPagina({
    ruta: '/precios', en,
    title: en ? 'Pricing · Vanty ABA' : 'Precios · Vanty ABA',
    description: en
      ? 'Vanty ABA plans for ABA and therapy centers: Starter, Professional and Clinic. Monthly or yearly with 2 months free, with a free trial.'
      : 'Planes de Vanty ABA para centros ABA y de terapia: Starter, Professional y Clinic. Mensual o anual con 2 meses gratis, con prueba gratuita.',
  })
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
