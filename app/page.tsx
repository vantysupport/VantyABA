// Portada pública de Vanty ABA: presenta la plataforma y sus planes. El login vive en /login.
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase-server'
import { contextoPrecios } from '@/lib/precios-server'
import type { PlanPublico } from '@/components/ui/planes-precios'
import Landing from '@/components/landing/Landing'
import { preguntasFaq } from '@/components/landing/preguntas'
import { SITIO, NOMBRE, localeServidor, metadatosPagina } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const en = (await localeServidor()) === 'en'
  return metadatosPagina({
    ruta: '/', en,
    title: en ? 'Vanty ABA · ABA clinic software with AI and a family portal' : 'Vanty ABA · Software para centros ABA con IA y portal para familias',
    description: en
      ? 'Clinical platform for ABA and therapy centers: scheduling, ABA programs, evaluations, AI reports with ARIA and a portal where families follow their child’s progress.'
      : 'Plataforma clínica para centros ABA y de terapia: agenda, programas ABA, evaluaciones, informes con IA (ARIA) y un portal donde las familias siguen el progreso de su hijo/a.',
  })
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
      <DatosEstructurados en={en} planes={(data ?? []) as PlanPublico[]} />
      <Landing planes={(data ?? []) as PlanPublico[]} contexto={contexto} />
    </>
  )
}

/** JSON-LD para Google: la organización, el software con sus precios y las preguntas frecuentes (resultados enriquecidos). */
function DatosEstructurados({ en, planes }: { en: boolean; planes: PlanPublico[] }) {
  const L = (e: string, es: string) => (en ? e : es)
  const url = `${SITIO}/${en ? 'en' : 'es'}`
  const precios = planes.flatMap(p => Object.values((p as { precio_region?: Record<string, number> }).precio_region ?? {})).filter(n => typeof n === 'number' && n > 0)
  const grafo = [
    {
      '@type': 'Organization', '@id': `${SITIO}/#organizacion`, name: NOMBRE, url: SITIO, logo: `${SITIO}/brand/vanty-logo-256.png`,
      email: 'vantysupport@gmail.com',
      sameAs: ['https://www.facebook.com/61587764677406', 'https://www.instagram.com/vantyaba/', 'https://www.tiktok.com/@vantyaba'],
    },
    { '@type': 'WebSite', '@id': `${SITIO}/#sitio`, url: SITIO, name: NOMBRE, inLanguage: ['es', 'en'], publisher: { '@id': `${SITIO}/#organizacion` } },
    {
      '@type': 'SoftwareApplication', name: NOMBRE, url, applicationCategory: 'HealthApplication', applicationSubCategory: 'Practice management',
      operatingSystem: 'Web, Android, iOS',
      description: L('Clinical management platform for ABA and therapy centers with AI and a family portal.', 'Plataforma de gestión clínica para centros ABA y de terapia, con IA y portal para familias.'),
      image: `${SITIO}/images/og-image.jpg`,
      publisher: { '@id': `${SITIO}/#organizacion` },
      ...(precios.length ? { offers: { '@type': 'AggregateOffer', priceCurrency: 'USD', lowPrice: Math.min(...precios), highPrice: Math.max(...precios), offerCount: planes.length } } : {}),
    },
    {
      '@type': 'FAQPage', inLanguage: en ? 'en' : 'es',
      mainEntity: preguntasFaq(L).map(p => ({ '@type': 'Question', name: p.q, acceptedAnswer: { '@type': 'Answer', text: p.a } })),
    },
  ]
  return (
    <script type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': grafo }).replace(/</g, String.fromCharCode(92) + 'u003c') }} />
  )
}
