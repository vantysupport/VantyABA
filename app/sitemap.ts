// app/sitemap.ts → /sitemap.xml
// Lista las páginas públicas en español e inglés, con sus alternativas hreflang.
import type { MetadataRoute } from 'next'
import { PAGINAS_PUBLICAS, SEO_LOCALES, alternativasIdioma, urlLocalizada } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return PAGINAS_PUBLICAS.flatMap(({ path, priority, changeFrequency }) =>
    SEO_LOCALES.map(locale => ({
      url: urlLocalizada(path, locale),
      lastModified,
      changeFrequency,
      priority,
      alternates: { languages: alternativasIdioma(path) },
    })),
  )
}
