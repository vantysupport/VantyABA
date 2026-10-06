// Feed RSS del blog (vanty.xyz/blog/rss.xml) para lectores de noticias y agregadores.
import { SITIO, NOMBRE } from '@/lib/seo'
import { nombreCategoria } from '@/lib/blog'
import { articulosPublicados } from '@/lib/blog-server'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function GET() {
  const articulos = await articulosPublicados(40)
  const items = articulos.map(a => {
    const url = `${SITIO}/es/blog/${a.slug}`
    return `    <item>
      <title>${esc(a.titulo)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(a.publicado_en ?? Date.now()).toUTCString()}</pubDate>
      <category>${esc(nombreCategoria(a.categoria, false))}</category>
      <description>${esc(a.resumen)}</description>${a.portada_url ? `\n      <enclosure url="${esc(a.portada_url)}" type="image/${/\.png$/i.test(a.portada_url) ? 'png' : /\.webp$/i.test(a.portada_url) ? 'webp' : 'jpeg'}" length="0" />` : ''}
    </item>`
  }).join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog · ${NOMBRE}</title>
    <link>${SITIO}/es/blog</link>
    <atom:link href="${SITIO}/blog/rss.xml" rel="self" type="application/rss+xml" />
    <description>Noticias, novedades de la plataforma y recursos para centros ABA y de terapia.</description>
    <language>es</language>
${items}
  </channel>
</rss>`
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=600' } })
}
