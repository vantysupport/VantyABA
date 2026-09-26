'use client'
// Selector desplegable con el estilo Vanty (reemplaza al <select> nativo): búsqueda, iniciales,
// descripción opcional, teclado (flechas / Enter / Escape) y cierre al hacer clic fuera.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown, Search } from 'lucide-react'

export type OpcionSelector = { value: string; label: string; sub?: string; icon?: React.ReactNode }

export function SelectorV({ value, onChange, opciones, placeholder, buscar, en = false }: {
  value: string
  onChange: (v: string) => void
  opciones: OpcionSelector[]
  placeholder?: string
  /** Muestra el buscador (por defecto, con más de 6 opciones) */
  buscar?: boolean
  en?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [q, setQ] = useState('')
  const [activo, setActivo] = useState(0)
  const raiz = useRef<HTMLDivElement>(null)
  const idLista = useId()
  const actual = opciones.find(o => o.value === value)
  const conBuscador = buscar ?? opciones.length > 6

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? opciones.filter(o => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(t)) : opciones
  }, [opciones, q])

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  const abrir = () => {
    setQ('')
    setActivo(Math.max(0, opciones.findIndex(o => o.value === value)))
    setAbierto(true)
  }
  const elegir = (v: string) => { onChange(v); setAbierto(false) }

  const teclado = (e: React.KeyboardEvent) => {
    if (!abierto) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir() }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); setAbierto(false) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActivo(i => Math.min(visibles.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter' && visibles[activo]) { e.preventDefault(); elegir(visibles[activo].value) }
  }

  const inicial = (o: OpcionSelector) => o.icon ?? (
    <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${o.value ? 'v-brand' : 'bg-v-fill text-v-muted'}`} style={{ boxShadow: 'none' }}>
      {o.value ? o.label.charAt(0).toUpperCase() : '—'}
    </span>
  )

  return (
    <div ref={raiz} className="relative" onKeyDown={teclado}>
      <button type="button" onClick={() => (abierto ? setAbierto(false) : abrir())}
        aria-haspopup="listbox" aria-expanded={abierto} aria-controls={idLista}
        className={`flex h-12 w-full items-center gap-2.5 rounded-v-sm border bg-v-bg px-2.5 text-left transition-shadow ${abierto ? 'border-v-accent/50 ring-4 ring-v-accent-soft' : 'border-v-border hover:border-v-accent/30'}`}>
        {actual ? inicial(actual) : null}
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-medium ${actual ? 'text-v-text' : 'text-v-subtle'}`} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {actual?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown size={16} className={`shrink-0 text-v-subtle transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {abierto && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-v-sm border border-v-border bg-v-elevated shadow-v-lg">
            {conBuscador && (
              <div className="flex items-center gap-2 border-b border-v-border px-3">
                <Search size={14} className="shrink-0 text-v-subtle" />
                <input autoFocus value={q} onChange={e => { setQ(e.target.value); setActivo(0) }}
                  placeholder={en ? 'Search…' : 'Buscar…'} className="h-10 w-full bg-transparent text-sm text-v-text outline-none placeholder:text-v-subtle" />
              </div>
            )}
            <ul id={idLista} role="listbox" className="max-h-64 overflow-y-auto p-1.5">
              {visibles.length === 0 && <li className="px-3 py-4 text-center text-sm text-v-muted">{en ? 'No results' : 'Sin resultados'}</li>}
              {visibles.map((o, i) => {
                const sel = o.value === value
                return (
                  <li key={o.value || '__vacio'} role="option" aria-selected={sel}
                    onMouseEnter={() => setActivo(i)} onClick={() => elegir(o.value)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-2 transition-colors ${i === activo ? 'bg-v-fill' : ''}`}>
                    {inicial(o)}
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${sel ? 'font-semibold text-v-accent' : 'font-medium text-v-text'}`} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>
                      {o.sub && <span className="block text-xs text-v-subtle" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.sub}</span>}
                    </span>
                    {sel && <Check size={15} className="shrink-0 text-v-accent" />}
                  </li>
                )
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
