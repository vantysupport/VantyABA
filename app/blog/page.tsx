// Blog de Vanty ABA: noticias, novedades del producto y recursos para centros y familias.

import Link from 'next/link'
import { Newspaper, Rss } from 'lucide-react'
import { localeServidor, metadatosPagina, SITIO, NOMBRE } from '@/lib/seo'
import { CATEGORIAS } from '@/lib/blog'
import { articulosPublicados } from '@/lib/blog-server'
import { BlogMarco, LlamadoVanty } from '@/components/blog/BlogMarco'
import { TarjetaArticulo, TarjetaDestacada } from '@/components/blog/Tarjetas'

export async function generateMetadata() {
  const en = (await localeServidor()) === 'en'
  return {
    ...metadatosPagina({
      ruta: '/blog', en,
      title: en ? 'Blog · Vanty ABA' : 'Blog · Vanty ABA',
      description: en
        ? 'News, product updates and practical resources for ABA and therapy centers and the families they serve.'
        : 'Noticias, novedades de la plataforma y recursos prácticos para centros ABA y de terapia, y para las familias que atienden.',
    }),
    alternates: {
      canonical: `${SITIO}/${en ? 'en' : 'es'}/blog`,
      languages: { es: `${SITIO}/es/blog`, en: `${SITIO}/en/blog`, 'x-default': `${SITIO}/es/blog` },
      types: { 'application/rss+xml': `${SITIO}/blog/rss.xml` },
    },
  }
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const en = (await localeServidor()) === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const loc = en ? 'en' : 'es'
  const { categoria } = await searchParams
  const todos = await articulosPublicados()
  const usadas = CATEGORIAS.filter(c => todos.some(a => a.categoria === c.id))
  const filtro = usadas.some(c => c.id === categoria) ? categoria : undefined
  const lista = filtro ? todos.filter(a => a.categoria === filtro) : todos
  // Destacado: el marcado como tal más reciente o, si no hay, el último publicado (solo sin filtro)
  const destacado = filtro ? null : (lista.find(a => a.destacado) ?? lista[0] ?? null)
  const resto = destacado ? lista.filter(a => a.id !== destacado.id) : lista
  const enlace = (slug: string) => `/${loc}/blog/${slug}`

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Blog', name: `Blog · ${NOMBRE}`, url: `${SITIO}/${loc}/blog`,
    inLanguage: en ? 'en' : 'es', publisher: { '@type': 'Organization', name: NOMBRE, logo: `${SITIO}/brand/vanty-logo-256.png` },
    blogPost: todos.slice(0, 20).map(a => ({ '@type': 'BlogPosting', headline: a.titulo, url: `${SITIO}${enlace(a.slug)}`, datePublished: a.publicado_en })),
  }

  return (
    <BlogMarco en={en}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      {/* Portada del blog */}
      <section className="relative overflow-hidden border-b border-v-border">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(48rem 24rem at 12% -10%, var(--v-glow-1), transparent 70%), radial-gradient(40rem 22rem at 95% 10%, var(--v-glow-1), transparent 70%)' }} />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-12 pt-14 sm:px-6 sm:pb-14 sm:pt-20 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-v-accent-soft px-3 py-1 text-xs font-semibold text-v-accent"><Newspaper size={13} /> Blog</p>
            <h1 className="v-headline mt-5 text-[2.6rem] leading-[1.05] sm:text-6xl">
              {L('News and ideas for ', 'Noticias e ideas para ')}<span className="v-brand-text">{L('therapy centers', 'centros de terapia')}</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-v-muted">
              {L('What’s new in Vanty ABA, practical guides for your team and resources to share with families.',
                'Lo nuevo de Vanty ABA, guías prácticas para tu equipo y recursos para compartir con las familias.')}
            </p>
          </div>
          <a href="/blog/rss.xml" className="inline-flex h-10 w-fit items-center gap-2 rounded-full border border-v-border bg-v-elevated px-4 text-sm font-medium text-v-muted shadow-v transition-colors hover:text-v-text">
            <Rss size={15} className="text-v-accent" /> {L('Subscribe via RSS', 'Suscribirse por RSS')}
          </a>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Categorías */}
        {usadas.length > 1 && (
          <nav aria-label={L('Categories', 'Categorías')} className="-mx-4 mb-10 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {[{ id: undefined, nombre: L('All', 'Todo') }, ...usadas.map(c => ({ id: c.id as string, nombre: en ? c.en : c.es }))].map(c => {
              const activo = filtro === c.id
              return (
                <Link key={c.id ?? 'todo'} href={c.id ? `/${loc}/blog?categoria=${c.id}` : `/${loc}/blog`} scroll={false} aria-current={activo ? 'page' : undefined}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${activo ? 'border-transparent bg-v-text text-v-bg' : 'border-v-border bg-v-elevated text-v-muted hover:border-v-accent/40 hover:text-v-text'}`}>
                  {c.nombre}
                </Link>
              )
            })}
          </nav>
        )}

        {lista.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/aria/poses/estudia.webp" alt="" className="h-44 w-auto drop-shadow-[0_18px_30px_rgba(0,60,140,0.18)]" />
            <h2 className="v-headline mt-6 text-2xl">{L('First articles coming soon', 'Muy pronto, los primeros artículos')}</h2>
            <p className="mt-2 text-v-muted">{L('ARIA is preparing news and guides for your center. Come back soon.', 'ARIA está preparando noticias y guías para tu centro. Vuelve pronto.')}</p>
          </div>
        ) : (
          <>
            {destacado && <TarjetaDestacada a={destacado} en={en} href={enlace(destacado.slug)} />}
            {resto.length > 0 && (
              <div className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${destacado ? 'mt-10' : ''}`}>
                {resto.map(a => <TarjetaArticulo key={a.id} a={a} en={en} href={enlace(a.slug)} />)}
              </div>
            )}
          </>
        )}
      </main>

      <LlamadoVanty en={en} />
    </BlogMarco>
  )
}
