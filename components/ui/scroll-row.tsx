'use client'
// Fila con desplazamiento horizontal para pestañas que no caben (p. ej. con la ventana a media pantalla):
// flechas que aparecen solo si hay más contenido, degradado en el borde, barra delgada,
// rueda del mouse en horizontal y el elemento activo siempre a la vista.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function ScrollRow({ children, className = '', activeKey }: { children: ReactNode; className?: string; activeKey?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [izq, setIzq] = useState(false)
  const [der, setDer] = useState(false)

  const medir = useCallback(() => {
    const el = ref.current
    if (!el) return
    setIzq(el.scrollLeft > 4)
    setDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    // Rueda vertical → desplazamiento horizontal (solo si hay algo que desplazar)
    const rueda = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()
      el.scrollBy({ left: e.deltaY, behavior: 'auto' })
    }
    el.addEventListener('wheel', rueda, { passive: false })
    return () => { ro.disconnect(); el.removeEventListener('wheel', rueda) }
  }, [medir])

  // Lleva el elemento activo (marcado con data-active) a la vista
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [activeKey])

  const mover = (dir: 1 | -1) => {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: 'smooth' })
  }

  const flecha = 'absolute top-1/2 z-[2] grid size-7 -translate-y-1/2 place-items-center rounded-full border border-v-border bg-v-elevated text-v-muted shadow-v transition-colors hover:text-v-accent'
  return (
    <div className={`relative ${className}`}>
      <div ref={ref} onScroll={medir}
        className="overflow-x-auto [scrollbar-color:var(--v-border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-v-border [&::-webkit-scrollbar]:h-1">
        {children}
      </div>
      {izq && (
        <>
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-10 bg-gradient-to-r from-v-elevated to-transparent" />
          <button type="button" onClick={() => mover(-1)} aria-label="Anterior" className={`${flecha} left-0.5`}><ChevronLeft size={15} /></button>
        </>
      )}
      {der && (
        <>
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-10 bg-gradient-to-l from-v-elevated to-transparent" />
          <button type="button" onClick={() => mover(1)} aria-label="Siguiente" className={`${flecha} right-0.5`}><ChevronRight size={15} /></button>
        </>
      )}
    </div>
  )
}
