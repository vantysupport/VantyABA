// robots.txt: indexar solo las páginas públicas; los paneles, la API y los flujos privados quedan fuera.
import type { MetadataRoute } from 'next'
import { SITIO } from '@/lib/seo'

const PRIVADAS = ['/admin', '/padre', '/especialista', '/secretaria', '/control', '/suscripcion', '/invitar', '/reservar',
  '/reset-password', '/mfa-required', '/auth', '/verificar', '/login']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', ...PRIVADAS.flatMap(p => [p, `/es${p}`, `/en${p}`])],
    }],
    sitemap: `${SITIO}/sitemap.xml`,
    host: SITIO,
  }
}
