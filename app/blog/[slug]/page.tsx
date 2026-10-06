// Artículo del blog de Vanty ABA.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowUp, Clock, ListOrdered } from 'lucide-react'
import { localeServidor, SITIO, NOMBRE } from '@/lib/seo'
import { fechaLarga, indiceDe, minutosLectura, nombreCategoria } from '@/lib/blog'
import { articuloPorSlug, articulosPublicados } from '@/lib/blog-server'
import { BlogMarco, LlamadoVanty } from '@/components/blog/BlogMarco'
import { Contenido } from '@/components/blog/Contenido'
import { Categoria, Portada, TarjetaArticulo } from '@/components/blog/Tarjetas'
import { BarraLectura, Compartir } from '@/components/blog/Interaccion'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const a = await articuloPorSlug(slug)
  if (!a) return { title: 'Blog · Vanty ABA', robots: { index: false } }
  const en = (await localeServidor()) === 'en'
  const titulo = a.seo_titulo || `${a.titulo} · Blog Vanty ABA`
  const descripcion = a.seo_descripcion || a.resumen || a.contenido.slice(0, 160)
  const url = `${SITIO}/${en ? 'en' : 'es'}/blog/${a.slug}`
  const imagen = a.portada_url || `/images/og-${en ? 'en' : 'es'}.jpg`
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: url, languages: { es: `${SITIO}/es/blog/${a.slug}`, en: `${SITIO}/en/blog/${a.slug}`, 'x-default': `${SITIO}/es/blog/${a.slug}` } },
    openGraph: {
      type: 'article', title: titulo, description: descripcion, url, siteName: NOMBRE, locale: en ? 'en_US' : 'es_PE',
      publishedTime: a.publicado_en ?? undefined, modifiedTime: a.updated_at, authors: [a.autor_nombre], tags: a.etiquetas,
      images: [{ url: imagen, width: 1200, height: 630, alt: a.portada_alt || a.titulo }],
    },
    twitter: { card: 'summary_large_image', title: titulo, description: descripcion, images: [imagen] },
  }
}

export default async function ArticuloPage({ params }: Props) {
  const { slug } = await params
  const [a, todos, locale] = await Promise.all([articuloPorSlug(slug), articulosPublicados(30), localeServidor()])
  if (!a) notFound()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const loc = en ? 'en' : 'es'
  const url = `${SITIO}/${loc}/blog/${a.slug}`
  const indice = indiceDe(a.contenido)
  const otros = todos.filter(x => x.id !== a.id)
  const relacionados = [...otros.filter(x => x.categoria === a.categoria), ...otros.filter(x => x.categoria !== a.categoria)].slice(0, 3)
  const iniciales = a.autor_nombre.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting', headline: a.titulo, description: a.resumen || undefined, url, mainEntityOfPage: url,
        image: a.portada_url ? [a.portada_url] : [`${SITIO}/images/og-${loc}.jpg`],
        datePublished: a.publicado_en, dateModified: a.updated_at, inLanguage: loc,
        articleSection: nombreCategoria(a.categoria, en), keywords: a.etiquetas.join(', ') || undefined,
        wordCount: a.contenido.split(/\s+/).filter(Boolean).length,
        author: { '@type': 'Organization', name: a.autor_nombre, url: SITIO },
        publisher: { '@type': 'Organization', name: NOMBRE, logo: { '@type': 'ImageObject', url: `${SITIO}/brand/vanty-logo-256.png` } },
      },
      {
        '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: NOMBRE, item: `${SITIO}/${loc}` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITIO}/${loc}/blog` },
          { '@type': 'ListItem', position: 3, name: a.titulo, item: url },
        ],
      },
    ],
  }

  return (
    <BlogMarco en={en}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <BarraLectura />

      <article id="articulo">
        {/* Cabecera del artículo */}
        <header className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(46rem 22rem at 50% -12%, var(--v-glow-1), transparent 70%)' }} />
          <div className="relative mx-auto max-w-3xl px-4 pt-10 text-center sm:px-6 sm:pt-14">
            <nav aria-label={L('Breadcrumb', 'Ruta')} className="flex items-center justify-center gap-2 text-sm text-v-subtle">
              <Link href={`/${loc}/blog`} className="inline-flex items-center gap-1 font-medium text-v-muted transition-colors hover:text-v-accent"><ArrowLeft size={14} /> Blog</Link>
              <span aria-hidden>/</span>
              <Link href={`/${loc}/blog?categoria=${a.categoria}`} className="hover:text-v-text">{nombreCategoria(a.categoria, en)}</Link>
            </nav>
            <div className="mt-6"><Categoria id={a.categoria} en={en} /></div>
            <h1 className="v-headline mt-5 text-balance text-[2.15rem] leading-[1.08] sm:text-[3.25rem]">{a.titulo}</h1>
            {a.resumen && <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-v-muted sm:text-xl">{a.resumen}</p>}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
              <div className="flex items-center gap-3 text-left">
                <span className="v-brand grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white">{iniciales || 'V'}</span>
                <span>
                  <span className="block text-sm font-semibold text-v-text">{a.autor_nombre}</span>
                  <span className="flex items-center gap-1.5 text-xs text-v-subtle">
                    <time dateTime={a.publicado_en ?? undefined}>{fechaLarga(a.publicado_en, en)}</time>
                    <span aria-hidden>·</span>
                    <Clock size={12} /> {minutosLectura(a.contenido)} min {L('read', 'de lectura')}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Portada */}
        <div className="mx-auto mt-10 max-w-5xl px-4 sm:px-6">
          <div className="group aspect-[16/9] overflow-hidden rounded-[28px] border border-v-border bg-v-fill shadow-v-lg sm:aspect-[2/1]">
            <Portada a={a} grande />
          </div>
          {a.portada_url && a.portada_alt && <p className="mt-3 text-center text-sm text-v-subtle">{a.portada_alt}</p>}
        </div>

        {/* Cuerpo + índice */}
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[13rem_minmax(0,44rem)_13rem] lg:justify-center">
          {/* Compartir (lateral en escritorio) */}
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-v-subtle">{L('Share', 'Compartir')}</p>
              <Compartir url={url} titulo={a.titulo} en={en} />
            </div>
          </aside>

          <div className="min-w-0">
            {indice.length >= 2 && (
              <details className="group mb-8 rounded-v border border-v-border bg-v-elevated shadow-v lg:hidden">
                <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3.5 text-sm font-semibold text-v-text [&::-webkit-details-marker]:hidden">
                  <span className="grid size-8 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><ListOrdered size={15} /></span>
                  <span className="flex-1">{L('In this article', 'En este artículo')}</span>
                </summary>
                <ol className="space-y-1 border-t border-v-border p-3 text-sm">
                  {indice.map(s => <li key={s.id}><a href={`#${s.id}`} className="block rounded-v-sm px-2.5 py-1.5 text-v-muted hover:bg-v-fill hover:text-v-text">{s.texto}</a></li>)}
                </ol>
              </details>
            )}

            <Contenido texto={a.contenido} />

            {a.etiquetas.length > 0 && (
              <div className="mt-12 flex flex-wrap gap-2">
                {a.etiquetas.map(t => <span key={t} className="rounded-full border border-v-border bg-v-elevated px-3 py-1 text-xs font-medium text-v-muted">#{t}</span>)}
              </div>
            )}

            <div className="mt-10 flex flex-col gap-4 border-t border-v-border pt-8 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-v-text">{L('Found it useful? Share it', '¿Te sirvió? Compártelo')}</p>
              <Compartir url={url} titulo={a.titulo} en={en} />
            </div>
          </div>

          {/* Índice (lateral en escritorio) */}
          <aside className="hidden lg:block">
            {indice.length >= 2 && (
              <nav aria-label={L('In this article', 'En este artículo')} className="sticky top-28">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-v-subtle">{L('In this article', 'En este artículo')}</p>
                <ol className="space-y-0.5 border-l border-v-border">
                  {indice.map(s => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-sm leading-snug text-v-muted transition-colors hover:border-v-accent hover:text-v-text">{s.texto}</a>
                    </li>
                  ))}
                </ol>
                <a href="#arriba" className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-v-subtle hover:text-v-text"><ArrowUp size={13} /> {L('Back to top', 'Volver arriba')}</a>
              </nav>
            )}
          </aside>
        </div>
      </article>

      {/* Más artículos */}
      {relacionados.length > 0 && (
        <section className="border-t border-v-border bg-v-elevated/60 px-4 py-14 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between gap-4">
              <h2 className="v-headline text-3xl">{L('Keep reading', 'Sigue leyendo')}</h2>
              <Link href={`/${loc}/blog`} className="text-sm font-semibold text-v-accent hover:underline">{L('All articles', 'Ver todos')}</Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relacionados.map(r => <TarjetaArticulo key={r.id} a={r} en={en} href={`/${loc}/blog/${r.slug}`} />)}
            </div>
          </div>
        </section>
      )}

      <div className="pt-14"><LlamadoVanty en={en} /></div>
    </BlogMarco>
  )
}
