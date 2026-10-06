// Tarjetas de artículos del blog: la destacada (grande, horizontal) y la normal de la cuadrícula.

import Link from 'next/link'
import { ArrowUpRight, Clock } from 'lucide-react'
import { fechaLarga, minutosLectura, nombreCategoria, type Articulo } from '@/lib/blog'

export type ArticuloLista = Pick<Articulo, 'id' | 'slug' | 'titulo' | 'resumen' | 'portada_url' | 'portada_alt' | 'categoria' | 'autor_nombre' | 'destacado' | 'publicado_en' | 'contenido' | 'updated_at'>

/** Portada del artículo, o una de marca con ARIA si no tiene foto. */
export function Portada({ a, className = '', grande = false }: { a: Pick<ArticuloLista, 'portada_url' | 'titulo'> & { portada_alt?: string | null }; className?: string; grande?: boolean }) {
  if (a.portada_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.portada_url} alt={a.portada_alt || a.titulo} loading={grande ? 'eager' : 'lazy'} className={`size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] ${className}`} />
  }
  return (
    <div className={`v-brand relative grid size-full place-items-center overflow-hidden ${className}`}>
      <div aria-hidden className="absolute -left-10 -top-16 size-56 rounded-full bg-white/15 blur-2xl" />
      <div aria-hidden className="absolute -bottom-20 -right-8 size-64 rounded-full bg-[#01abfc]/40 blur-3xl" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/aria/poses/explica.webp" alt="" className={`relative h-[78%] w-auto drop-shadow-[0_18px_30px_rgba(0,30,90,0.35)] transition-transform duration-700 ease-out group-hover:-translate-y-1 ${grande ? '' : 'max-h-44'}`} />
    </div>
  )
}

function Meta({ a, en }: { a: ArticuloLista; en: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-v-subtle">
      <span>{fechaLarga(a.publicado_en, en)}</span>
      <span aria-hidden>·</span>
      <span className="inline-flex items-center gap-1"><Clock size={12} /> {minutosLectura(a.contenido)} min {en ? 'read' : 'de lectura'}</span>
    </p>
  )
}

export function Categoria({ id, en, sobreFoto = false }: { id: string; en: boolean; sobreFoto?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${sobreFoto ? 'bg-white/90 text-[#0063d8] shadow-sm backdrop-blur' : 'bg-v-accent-soft text-v-accent'}`}>
      {nombreCategoria(id, en)}
    </span>
  )
}

export function TarjetaDestacada({ a, en, href }: { a: ArticuloLista; en: boolean; href: string }) {
  return (
    <Link href={href} className="group grid overflow-hidden rounded-[28px] border border-v-border bg-v-elevated shadow-v transition-all duration-300 hover:-translate-y-0.5 hover:shadow-v-lg lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="relative aspect-[16/10] overflow-hidden lg:aspect-[4/3]">
        <Portada a={a} grande />
        <div className="absolute left-4 top-4"><Categoria id={a.categoria} en={en} sobreFoto /></div>
      </div>
      <div className="flex flex-col justify-center p-6 sm:p-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-v-accent">{en ? 'Featured' : 'Destacado'}</p>
        <h2 className="v-headline mt-3 text-[1.75rem] leading-[1.15] text-v-text sm:text-[2.15rem]">{a.titulo}</h2>
        {a.resumen && <p className="mt-4 line-clamp-4 text-[15px] leading-relaxed text-v-muted">{a.resumen}</p>}
        <div className="mt-6 flex items-center justify-between gap-4">
          <Meta a={a} en={en} />
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-v-accent-soft text-v-accent transition-all duration-300 group-hover:bg-v-accent group-hover:text-white">
            <ArrowUpRight size={19} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}

export function TarjetaArticulo({ a, en, href }: { a: ArticuloLista; en: boolean; href: string }) {
  return (
    <Link href={href} className="group flex w-full flex-col overflow-hidden rounded-v-lg border border-v-border bg-v-elevated shadow-v transition-all duration-300 hover:-translate-y-1 hover:shadow-v-lg">
      <div className="relative aspect-[16/10] overflow-hidden">
        <Portada a={a} />
        <div className="absolute left-3.5 top-3.5"><Categoria id={a.categoria} en={en} sobreFoto /></div>
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="text-lg font-semibold leading-snug tracking-tight text-v-text transition-colors group-hover:text-v-accent">{a.titulo}</h3>
        {a.resumen && <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-v-muted">{a.resumen}</p>}
        <div className="mt-auto pt-5"><Meta a={a} en={en} /></div>
      </div>
    </Link>
  )
}
