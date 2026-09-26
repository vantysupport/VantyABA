// SEO: URL pública del sitio, metadatos por página con versiones ES/EN (hreflang) y datos estructurados.

import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'

/** Dominio público. En producción se toma de NEXT_PUBLIC_SITE_URL. */
export const SITIO = (process.env.NEXT_PUBLIC_SITE_URL && !process.env.NEXT_PUBLIC_SITE_URL.includes('localhost')
  ? process.env.NEXT_PUBLIC_SITE_URL : 'https://vanty.xyz').replace(/\/$/, '').replace(/^http:\/\//, 'https://')

export const NOMBRE = 'Vanty ABA'

/** Idioma de la página que se está generando (el proxy lo fija según el prefijo /es o /en). */
export async function localeServidor(): Promise<'es' | 'en'> {
  const h = (await headers()).get('x-vanty-locale')
  if (h === 'en' || h === 'es') return h
  return (await cookies()).get('vanty_locale')?.value === 'en' ? 'en' : 'es'
}

/** Metadatos de una página pública con canonical propio y alternativas por idioma. `ruta` sin prefijo, p. ej. '/precios'. */
export function metadatosPagina(o: { ruta: string; en: boolean; title: string; description: string; imagen?: string; indexar?: boolean }): Metadata {
  const r = o.ruta === '/' ? '' : o.ruta
  const url = `${SITIO}/${o.en ? 'en' : 'es'}${r}`
  const imagen = o.imagen ?? `/images/og-${o.en ? 'en' : 'es'}.jpg`
  return {
    title: o.title,
    description: o.description,
    alternates: {
      canonical: url,
      languages: { es: `${SITIO}/es${r}`, en: `${SITIO}/en${r}`, 'x-default': `${SITIO}/es${r}` },
    },
    openGraph: {
      title: o.title, description: o.description, url, siteName: NOMBRE, type: 'website',
      locale: o.en ? 'en_US' : 'es_PE', alternateLocale: o.en ? ['es_PE'] : ['en_US'],
      images: [{ url: imagen, width: 1200, height: 630, alt: NOMBRE }],
    },
    twitter: { card: 'summary_large_image', title: o.title, description: o.description, images: [imagen] },
    robots: o.indexar === false ? { index: false, follow: false } : { index: true, follow: true },
  }
}
