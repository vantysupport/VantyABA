// app/robots.ts → /robots.txt
// Permite indexar la web pública y bloquea API, paneles y enlaces privados.
import type { MetadataRoute } from 'next'
import { RUTAS_PRIVADAS, SEO_LOCALES, SITE_URL } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  const privadas = RUTAS_PRIVADAS.flatMap(r => SEO_LOCALES.map(l => `/${l}${r}`))
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', ...RUTAS_PRIVADAS, ...privadas],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
