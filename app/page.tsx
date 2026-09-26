// Portada pública de Vanty ABA: presenta la plataforma y sus planes. El login vive en /login.
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase-server'
import { contextoPrecios } from '@/lib/precios-server'
import type { PlanPublico } from '@/components/ui/planes-precios'
import Landing from '@/components/landing/Landing'

export const metadata: Metadata = {
  title: 'Vanty ABA · La clínica y la familia, conectadas',
  description: 'Plataforma clínica ABA con IA: agenda, programas, evaluaciones, informes y un portal para las familias. Todo tu centro en un solo lugar.',
  openGraph: {
    title: 'Vanty ABA · La clínica y la familia, conectadas',
    description: 'Agenda, programas ABA, evaluaciones, ARIA (IA clínica) y portal de familias en un solo lugar.',
    images: ['/landing/analitica.webp'],
  },
}

export default async function Home({ searchParams }: { searchParams: Promise<{ pais?: string }> }) {
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
  return <Landing planes={(data ?? []) as PlanPublico[]} contexto={contexto} />
}
