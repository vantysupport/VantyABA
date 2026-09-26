'use client'
// Campo de especialidad con sugerencias propias (reemplaza al <datalist> nativo,
// que cada navegador dibuja a su manera y a veces fuera de lugar).

import { useMemo, useState, type KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Briefcase } from 'lucide-react'

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export default function EspecialidadInput({ value, onChange, sugerencias, placeholder, className = '', wrapperClassName = '', autoFocus, onKeyDown }: {
  value: string
  onChange: (v: string) => void
  sugerencias: string[]
  placeholder?: string
  className?: string
  wrapperClassName?: string
  autoFocus?: boolean
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(-1)

  const opciones = useMemo(() => {
    const q = normalizar(value)
    return sugerencias.filter(s => { const n = normalizar(s); return n !== q && (!q || n.includes(q)) }).slice(0, 8)
  }, [sugerencias, value])
  const visible = abierto && opciones.length > 0

  const elegir = (v: string) => { onChange(v); setAbierto(false); setActivo(-1) }

  const teclas = (e: KeyboardEvent<HTMLInputElement>) => {
    if (visible && e.key === 'ArrowDown') { e.preventDefault(); setActivo(i => (i + 1) % opciones.length); return }
    if (visible && e.key === 'ArrowUp') { e.preventDefault(); setActivo(i => (i <= 0 ? opciones.length - 1 : i - 1)); return }
    if (visible && e.key === 'Enter' && activo >= 0) { e.preventDefault(); elegir(opciones[activo]); return }
    if (visible && e.key === 'Escape') { e.preventDefault(); setAbierto(false); return }
    onKeyDown?.(e)
  }

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input type="text" value={value} autoFocus={autoFocus} placeholder={placeholder} autoComplete="off"
        role="combobox" aria-expanded={visible} aria-autocomplete="list"
        onChange={e => { onChange(e.target.value); setAbierto(true); setActivo(-1) }}
        onFocus={() => setAbierto(true)} onBlur={() => setAbierto(false)} onKeyDown={teclas}
        className={className} />
      <AnimatePresence>
        {visible && (
          <motion.ul role="listbox" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-56 overflow-y-auto rounded-v-sm border border-v-border bg-v-elevated p-1 shadow-v-lg">
            {opciones.map((op, i) => (
              <li key={op} role="option" aria-selected={i === activo}>
                {/* onMouseDown para elegir antes de que el blur cierre la lista */}
                <button type="button" onMouseDown={e => { e.preventDefault(); elegir(op) }} onMouseEnter={() => setActivo(i)}
                  className={`flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm transition-colors ${i === activo ? 'bg-v-accent-soft text-v-accent' : 'text-v-text'}`}>
                  <Briefcase size={13} className={i === activo ? 'text-v-accent' : 'text-v-subtle'} />
                  <span className="truncate">{op}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
