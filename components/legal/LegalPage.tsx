// components/legal/LegalPage.tsx
// Plantilla común de las páginas legales (privacidad, términos): portada con resumen,
// índice (lateral fijo en escritorio, desplegable en celular) y secciones numeradas.
// Componente de servidor: sin hooks.

import Link from 'next/link'
import { ArrowRight, ArrowUp, ChevronDown, ListOrdered } from 'lucide-react'
import { VantyLogo } from '@/components/ui/vanty-logo'

export type SeccionLegal = { id: string; Icon: any; title: string; body: React.ReactNode }

export function Lista({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <ul className="mt-3 space-y-2.5">
      {items.map(([t, d], i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-v-accent" />
          <span>{t && <strong className="font-semibold text-v-text">{t} </strong>}{d}</span>
        </li>
      ))}
    </ul>
  )
}

export function Destacado({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded-v-sm border-l-2 border-v-accent bg-v-accent-soft/50 px-4 py-3 text-v-text">{children}</p>
}

export default function LegalPage({ en, EyebrowIcon, titleA, titleB, intro, sellos, updated, resumen, secciones, otro }: {
  en: boolean
  EyebrowIcon: any
  titleA: string
  titleB: string
  intro: string
  sellos?: [any, string][]
  updated: string
  resumen: { titulo: string; items: [any, string, string][] }
  secciones: SeccionLegal[]
  otro: { href: string; label: string }
}) {
  const L = (e: string, s: string) => (en ? e : s)
  const P = 'Vanty ABA'

  const indice = (
    <ol className="grid gap-0.5">
      {secciones.map((s, i) => (
        <li key={s.id}>
          <a href={`#${s.id}`} className="group flex items-center gap-2.5 rounded-v-sm px-2.5 py-2 text-sm text-v-muted transition-colors hover:bg-v-fill hover:text-v-text">
            <span className="w-5 shrink-0 text-right text-xs tabular-nums text-v-subtle group-hover:text-v-accent">{i + 1}</span>
            <span className="leading-snug">{s.title}</span>
          </a>
        </li>
      ))}
    </ol>
  )

  return (
    // Contenedor con scroll propio: html/body usan overflow-x hidden y eso anula `sticky`.
    <div className="v-scope h-dvh overflow-y-auto scroll-smooth bg-v-bg text-v-muted">
      <header id="top" className="sticky top-0 z-20 border-b border-v-border bg-v-elevated/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Vanty ABA" className="text-v-text"><VantyLogo size={32} /></Link>
          <Link href={otro.href} className="inline-flex items-center gap-1 text-sm font-medium text-v-accent hover:underline">{otro.label} <ArrowRight size={14} /></Link>
        </div>
      </header>

      {/* Portada */}
      <div className="relative overflow-hidden border-b border-v-border">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(50rem 22rem at 10% 0%, var(--v-glow-1), transparent 70%)' }} />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-v-accent-soft px-3 py-1 text-xs font-semibold text-v-accent"><EyebrowIcon size={13} /> Legal</p>
            <h1 className="v-headline mt-4 text-[2.1rem] leading-tight text-v-text sm:text-5xl">{titleA}<span className="v-brand-text">{titleB}</span></h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed sm:text-base">{intro}</p>
            {sellos && (
              <div className="mt-6 flex flex-wrap items-center gap-2">
                {sellos.map(([I, t]) => <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-v-border bg-v-elevated px-3 py-1.5 text-xs font-semibold text-v-text shadow-v"><I size={13} className="text-v-accent" /> {t}</span>)}
              </div>
            )}
            <p className="mt-6 text-xs text-v-subtle">{updated}</p>
          </div>

          {/* Resumen: llena el espacio y da la lectura rápida */}
          <aside className="rounded-v-lg border border-v-border bg-v-elevated/90 p-5 shadow-v-lg backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-v-subtle">{resumen.titulo}</p>
            <ul className="mt-3 space-y-3.5">
              {resumen.items.map(([I, t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><I size={16} /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-v-text">{t}</span>
                    <span className="block text-xs leading-snug text-v-muted">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        {/* Índice: desplegable en celular, lateral fijo en escritorio */}
        <details className="group rounded-v border border-v-border bg-v-elevated shadow-v lg:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3.5 text-sm font-semibold text-v-text [&::-webkit-details-marker]:hidden">
            <span className="grid size-8 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><ListOrdered size={15} /></span>
            <span className="flex-1">{L('Contents', 'Contenido')} <span className="font-normal text-v-subtle">· {secciones.length} {L('sections', 'secciones')}</span></span>
            <ChevronDown size={17} className="text-v-subtle transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-v-border p-2">{indice}</div>
        </details>
        <nav aria-label={L('Table of contents', 'Índice de contenidos')} className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
          <p className="mb-3 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-v-subtle">{L('Contents', 'Contenido')}</p>
          {indice}
        </nav>

        <main className="min-w-0 space-y-4">
          {secciones.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-20 rounded-v border border-v-border bg-v-elevated p-5 text-[15px] leading-relaxed shadow-v sm:p-7 [&_p+p]:mt-3">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><s.Icon size={18} /></span>
                <h2 className="text-lg font-semibold tracking-tight text-v-text sm:text-xl"><span className="mr-1.5 text-v-subtle">{i + 1}.</span>{s.title}</h2>
              </div>
              {s.body}
            </section>
          ))}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-v-border pt-6 text-xs text-v-subtle">
            <p>© {new Date().getFullYear()} {P} · {L('All rights reserved', 'Todos los derechos reservados')}</p>
            <div className="flex items-center gap-4">
              <Link href={otro.href} className="font-semibold text-v-accent hover:underline">{otro.label}</Link>
              <a href="#top" className="inline-flex items-center gap-1 font-semibold text-v-muted hover:text-v-text"><ArrowUp size={13} /> {L('Back to top', 'Volver arriba')}</a>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}
