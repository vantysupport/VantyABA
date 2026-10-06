// Marco de las páginas del blog: cabecera fija con la navegación del sitio y pie con redes y datos legales.
// Va dentro de un contenedor con scroll propio (como las páginas legales) para que el índice del artículo
// pueda quedar fijo al bajar: html/body usan overflow-x hidden y eso anula `sticky`.

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { VantyLogo } from '@/components/ui/vanty-logo'
import LocaleSelector from '@/app/components/LocaleSelector'
import { lineaLegal } from '@/lib/empresa'

const REDES = [
  { n: 'Instagram', href: 'https://www.instagram.com/vantyaba/', d: 'M12 2.2c3.2 0 3.58 0 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s0 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58 0-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s0-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zm0 3.24a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z' },
  { n: 'Facebook', href: 'https://www.facebook.com/61587764677406', d: 'M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.33-.04-1.57-.14-2.88-.14C11.9 2 10 3.66 10 6.7v2.8H7v4h3V22h4v-8.5z' },
  { n: 'TikTok', href: 'https://www.tiktok.com/@vantyaba', d: 'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.3 0 .59.04.86.13V9.4a6.34 6.34 0 0 0-5.4 10.78A6.34 6.34 0 0 0 15.82 15.7V8.73a8.16 8.16 0 0 0 4.77 1.52V6.8a4.85 4.85 0 0 1-1-.1z' },
]

export function BlogMarco({ en, children }: { en: boolean; children: React.ReactNode }) {
  const L = (e: string, s: string) => (en ? e : s)
  const loc = en ? 'en' : 'es'
  const links = [
    { href: `/${loc}`, label: L('Home', 'Inicio') },
    { href: `/${loc}#funciones`, label: L('Features', 'Funciones') },
    { href: `/${loc}/precios`, label: L('Pricing', 'Precios') },
    { href: `/${loc}/blog`, label: 'Blog', activo: true },
  ]
  return (
    <div id="arriba" className="v-scope h-dvh overflow-y-auto overflow-x-clip scroll-smooth bg-v-bg text-v-text">
      <header className="sticky top-0 z-30 border-b border-v-border bg-v-elevated/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href={`/${loc}`} aria-label="Vanty ABA"><VantyLogo size={32} /></Link>
          <div className="ml-6 hidden items-center gap-1 md:flex">
            {links.map(l => (
              <Link key={l.href} href={l.href} aria-current={l.activo ? 'page' : undefined}
                className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${l.activo ? 'bg-v-accent-soft text-v-accent' : 'text-v-muted hover:bg-v-fill hover:text-v-text'}`}>{l.label}</Link>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block"><LocaleSelector /></div>
            <Link href={`/${loc}/crear-centro`} className="v-brand inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold">
              {L('Start free', 'Empieza gratis')} <ArrowRight size={15} className="hidden sm:block" />
            </Link>
          </div>
        </nav>
      </header>

      {children}

      <footer className="border-t border-v-border bg-v-elevated px-4 pb-8 pt-12 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <VantyLogo size={30} />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-v-muted">{L('Clinical management for therapy centers, connected with every family.', 'Gestión clínica para centros de terapia, conectada con cada familia.')}</p>
            <div className="mt-5 flex gap-2.5">
              {REDES.map(r => (
                <a key={r.n} href={r.href} target="_blank" rel="noopener noreferrer" aria-label={r.n} title={r.n}
                  className="grid size-10 place-items-center rounded-full border border-v-border bg-v-bg text-v-muted transition-all hover:-translate-y-0.5 hover:border-v-accent/40 hover:text-v-accent hover:shadow-v">
                  <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden><path d={r.d} /></svg>
                </a>
              ))}
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm text-v-muted">
            {links.map(l => <li key={l.href}><Link href={l.href} className="hover:text-v-text">{l.label}</Link></li>)}
            <li><Link href={`/${loc}/privacidad`} className="hover:text-v-text">{L('Privacy', 'Privacidad')}</Link></li>
            <li><Link href={`/${loc}/terminos`} className="hover:text-v-text">{L('Terms', 'Términos')}</Link></li>
            <li><a href="/blog/rss.xml" className="hover:text-v-text">RSS</a></li>
          </ul>
        </div>
        <div className="mx-auto mt-10 max-w-6xl space-y-1 border-t border-v-border pt-6 text-xs text-v-subtle">
          <p>© {new Date().getFullYear()} Vanty ABA · {L('All rights reserved.', 'Todos los derechos reservados.')}</p>
          <p>{lineaLegal(en)}</p>
        </div>
      </footer>
    </div>
  )
}

/** Banda final que invita a probar Vanty (se repite en el índice y en cada artículo). */
export function LlamadoVanty({ en }: { en: boolean }) {
  const L = (e: string, s: string) => (en ? e : s)
  const loc = en ? 'en' : 'es'
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="v-brand relative overflow-hidden rounded-[32px] px-6 py-12 text-white sm:px-12 sm:py-14">
        <div className="relative z-[1] max-w-xl">
          <h2 className="v-headline text-3xl text-white sm:text-4xl">{L('Bring your clinic and your families together', 'Une a tu clínica con sus familias')}</h2>
          <p className="mt-3 text-lg text-white/85">{L('Schedule, ABA programs, AI reports with ARIA and a portal for every family.', 'Agenda, programas ABA, informes con IA (ARIA) y un portal para cada familia.')}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href={`/${loc}/crear-centro`} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-[15px] font-semibold text-[#0063d8]">{L('Create my center', 'Crear mi centro')} <ArrowRight size={17} /></Link>
            <Link href={`/${loc}/precios`} className="inline-flex h-12 items-center justify-center rounded-full border border-white/40 px-7 text-[15px] font-semibold text-white hover:bg-white/10">{L('See pricing', 'Ver precios')}</Link>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/aria/poses/lee.webp" alt="" width={240} height={240} className="pointer-events-none absolute -bottom-4 right-4 hidden h-auto w-52 drop-shadow-[0_20px_40px_rgba(0,30,90,0.4)] md:block lg:right-16 lg:w-60" />
      </div>
    </section>
  )
}
