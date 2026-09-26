// lib/seo.ts
// Datos compartidos de SEO: URL pública del sitio, idiomas y páginas indexables.
// Lo usan app/sitemap.ts, app/robots.ts y la metadata del layout raíz.

export const SEO_LOCALES = ['es', 'en'] as const
export type SeoLocale = (typeof SEO_LOCALES)[number]
export const SEO_DEFAULT_LOCALE: SeoLocale = 'es'

/** URL pública sin barra final (NEXT_PUBLIC_SITE_URL o el dominio de producción). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://vantyaba.com').replace(/\/+$/, '')

/** Páginas públicas que Google debe indexar (rutas lógicas, sin prefijo de idioma). */
export const PAGINAS_PUBLICAS: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' | 'yearly' }[] = [
  { path: '/',             priority: 1.0, changeFrequency: 'weekly' },
  { path: '/precios',      priority: 0.9, changeFrequency: 'weekly' },
  { path: '/crear-centro', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/login',        priority: 0.5, changeFrequency: 'yearly' },
  { path: '/privacidad',   priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terminos',     priority: 0.3, changeFrequency: 'yearly' },
]

/** Raíces privadas: nunca deben aparecer en buscadores. */
export const RUTAS_PRIVADAS = [
  '/admin', '/secretaria', '/padre', '/especialista', '/control', '/suscripcion',
  '/invitar', '/reservar', '/verificar', '/reset-password', '/mfa-required', '/auth',
]

export function esIndexable(path: string): boolean {
  return PAGINAS_PUBLICAS.some(p => p.path === path)
}

/** URL absoluta de una ruta lógica en un idioma: ('/precios','en') → https://…/en/precios */
export function urlLocalizada(path: string, locale: SeoLocale): string {
  return `${SITE_URL}/${locale}${path === '/' ? '' : path}`
}

/** Mapa hreflang de una ruta: es, en y x-default (español). */
export function alternativasIdioma(path: string): Record<string, string> {
  return {
    es: urlLocalizada(path, 'es'),
    en: urlLocalizada(path, 'en'),
    'x-default': urlLocalizada(path, SEO_DEFAULT_LOCALE),
  }
}
