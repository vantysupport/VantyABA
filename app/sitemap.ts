// sitemap.xml: páginas públicas en español e inglés, cada una enlazada con su versión en el otro idioma.
import type { MetadataRoute } from 'next'
import { SITIO } from '@/lib/seo'

const PAGINAS: { ruta: string; prioridad: number; frecuencia: 'weekly' | 'monthly' | 'yearly' }[] = [
  { ruta: '', prioridad: 1, frecuencia: 'weekly' },
  { ruta: '/precios', prioridad: 0.9, frecuencia: 'weekly' },
  { ruta: '/crear-centro', prioridad: 0.8, frecuencia: 'monthly' },
  { ruta: '/privacidad', prioridad: 0.3, frecuencia: 'yearly' },
  { ruta: '/terminos', prioridad: 0.3, frecuencia: 'yearly' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const ahora = new Date()
  return PAGINAS.flatMap(p => (['es', 'en'] as const).map(loc => ({
    url: `${SITIO}/${loc}${p.ruta}`,
    lastModified: ahora,
    changeFrequency: p.frecuencia,
    // Redondeo a un decimal: restar 0.1 en coma flotante deja valores como 0.7000000000000001
    priority: loc === 'es' ? p.prioridad : Math.round(Math.max(0.1, p.prioridad - 0.1) * 10) / 10,
    alternates: { languages: { es: `${SITIO}/es${p.ruta}`, en: `${SITIO}/en${p.ruta}` } },
  })))
}
