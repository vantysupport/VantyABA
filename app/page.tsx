// Portada pública de Vanty ABA: presenta la plataforma y sus planes. El login vive en /login.
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase-server'
import { contextoPrecios } from '@/lib/precios-server'
import type { PlanPublico } from '@/components/ui/planes-precios'
import Landing from '@/components/landing/Landing'
import { localeServidor } from '@/lib/locale-server'
import { SITE_URL, urlLocalizada } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const en = (await localeServidor()) === 'en'
  const title = en ? 'Vanty ABA · Clinic and family, connected' : 'Vanty ABA · La clínica y la familia, conectadas'
  const description = en
    ? 'AI-powered ABA clinical platform: scheduling, programs, assessments, reports and a portal for families. Your whole center in one place.'
    : 'Plataforma clínica ABA con IA: agenda, programas, evaluaciones, informes y un portal para las familias. Todo tu centro en un solo lugar.'
  const ogDescription = en
    ? 'Scheduling, ABA programs, assessments, ARIA (clinical AI) and a family portal in one place.'
    : 'Agenda, programas ABA, evaluaciones, ARIA (IA clínica) y portal de familias en un solo lugar.'
  return {
    title,
    description,
    openGraph: {
      title,
      description: ogDescription,
      type: 'website',
      siteName: 'Vanty ABA',
      url: urlLocalizada('/', en ? 'en' : 'es'),
      locale: en ? 'en_US' : 'es_PE',
      images: ['/landing/analitica.webp'],
    },
    twitter: { card: 'summary_large_image', title, description: ogDescription, images: ['/landing/analitica.webp'] },
  }
}

// Datos estructurados (schema.org) para que Google entienda qué es Vanty ABA
function jsonLd(en: boolean) {
  const url = urlLocalizada('/', en ? 'en' : 'es')
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Vanty ABA',
        url: SITE_URL,
        logo: `${SITE_URL}/icons/icon-512x512.png`,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'Vanty ABA',
        url: SITE_URL,
        inLanguage: ['es', 'en'],
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'Vanty ABA',
        url,
        applicationCategory: 'HealthApplication',
        operatingSystem: 'Web, Android, iOS',
        inLanguage: en ? 'en' : 'es',
        description: en
          ? 'Clinical management platform for ABA, neuropsychology and child development therapy centers: records, scheduling, AI reports and a family portal.'
          : 'Plataforma de gestión clínica para centros de terapia ABA, neuropsicología y desarrollo infantil: expedientes, agenda, informes con IA y portal para familias.',
        publisher: { '@id': `${SITE_URL}/#organization` },
        offers: { '@type': 'Offer', url: urlLocalizada('/precios', en ? 'en' : 'es'), category: 'subscription' },
      },
    ],
  }
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
  const en = (await localeServidor()) === 'en'
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(en)).replace(/</g, '\\u003c') }} />
      <Landing planes={(data ?? []) as PlanPublico[]} contexto={contexto} />
    </>
  )
}
