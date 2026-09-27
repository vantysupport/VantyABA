'use client'
// Vitrina de funciones: lista a la izquierda y una sola imagen que cambia con fundido a la derecha.
// Avanza sola (con barra de progreso), se pausa al pasar el mouse y se puede elegir con clic.

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, type LucideIcon } from 'lucide-react'

// pos: encuadre (object-position) para fotos verticales, que se recortan en el recuadro horizontal
export type Funcion = { img: string; pos?: string; Icon: LucideIcon; t: string; corto: string; d: string; puntos: string[] }

const DURACION = 6500

export function FuncionesShowcase({ funciones }: { funciones: Funcion[] }) {
  const quieto = useReducedMotion()
  const [activa, setActiva] = useState(0)
  const [pausa, setPausa] = useState(false)
  const [visible, setVisible] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  // Solo avanza cuando la sección está en pantalla
  useEffect(() => {
    const el = raiz.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const corriendo = visible && !pausa && !quieto
  useEffect(() => {
    if (!corriendo) return
    const t = setTimeout(() => setActiva(a => (a + 1) % funciones.length), DURACION)
    return () => clearTimeout(t)
  }, [activa, corriendo, funciones.length])

  const f = funciones[activa]

  return (
    <div ref={raiz} onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)}>
      {/* Pestañas en celular */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden" style={{ scrollbarWidth: 'none' }}>
        {funciones.map((x, i) => (
          <button key={x.t} onClick={() => setActiva(i)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${i === activa ? 'v-brand' : 'border border-v-border bg-v-elevated text-v-muted'}`}
            style={i === activa ? { boxShadow: 'none' } : undefined}>
            <x.Icon size={15} /> {x.corto}
          </button>
        ))}
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] lg:gap-10">
        {/* Lista (escritorio) */}
        <div className="hidden flex-col gap-2 lg:flex">
          {funciones.map((x, i) => {
            const on = i === activa
            return (
              <button key={x.t} onClick={() => setActiva(i)} aria-expanded={on}
                className={`relative overflow-hidden rounded-[22px] border p-5 text-left transition-colors ${on ? 'border-v-accent/30 bg-v-elevated shadow-v' : 'border-transparent hover:bg-v-elevated/60'}`}>
                <div className="flex items-center gap-3">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-[30%] transition-colors ${on ? 'v-brand' : 'bg-v-fill text-v-muted'}`} style={on ? { boxShadow: 'none' } : undefined}><x.Icon size={18} /></span>
                  <h3 className={`text-lg font-semibold transition-colors ${on ? 'text-v-text' : 'text-v-muted'}`}>{x.t}</h3>
                </div>
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                      <p className="mt-3 text-[15px] leading-relaxed text-v-muted">{x.d}</p>
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {x.puntos.map(p => (
                          <li key={p} className="inline-flex items-center gap-1.5 rounded-full bg-v-accent-soft px-3 py-1 text-xs font-semibold text-v-accent"><Check size={12} /> {p}</li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* Barra de progreso del avance automático */}
                {on && (
                  <span className="absolute inset-x-5 bottom-0 h-[3px] overflow-hidden rounded-full bg-v-fill">
                    <motion.span key={`${activa}-${corriendo}`} className="v-brand block h-full rounded-full" style={{ boxShadow: 'none' }}
                      initial={{ width: '0%' }} animate={{ width: corriendo ? '100%' : '0%' }} transition={{ duration: corriendo ? DURACION / 1000 : 0, ease: 'linear' }} />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Imagen que cambia */}
        <div className="relative min-h-[260px] overflow-hidden rounded-[30px] border border-v-border bg-v-fill shadow-v-lg sm:min-h-[380px] lg:min-h-[520px]">
          <AnimatePresence initial={false}>
            <motion.div key={f.img} className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
              <Image src={f.img} alt={f.t} fill quality={90} sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" style={f.pos ? { objectPosition: f.pos } : undefined} />
            </motion.div>
          </AnimatePresence>
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-transparent" />
          {/* Etiqueta flotante */}
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-5 sm:left-5">
            <AnimatePresence mode="wait">
              <motion.div key={f.t} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4 }}
                className="inline-flex max-w-full items-center gap-2.5 rounded-[16px] border border-white/60 bg-white/85 py-2 pl-2 pr-4 shadow-v backdrop-blur-md">
                <span className="v-brand grid size-9 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><f.Icon size={16} /></span>
                <span className="text-sm font-semibold text-[#0b1b33]">{f.t}</span>
              </motion.div>
            </AnimatePresence>
          </div>
          {/* Indicadores */}
          <div className="absolute right-4 top-4 flex gap-1.5">
            {funciones.map((x, i) => (
              <button key={x.t} onClick={() => setActiva(i)} aria-label={x.t}
                className={`h-1.5 rounded-full transition-all ${i === activa ? 'w-6 bg-white' : 'w-1.5 bg-white/55'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Descripción en celular */}
      <AnimatePresence mode="wait">
        <motion.div key={f.t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 lg:hidden">
          <p className="text-[15px] leading-relaxed text-v-muted">{f.d}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {f.puntos.map(p => <li key={p} className="inline-flex items-center gap-1.5 rounded-full bg-v-accent-soft px-3 py-1 text-xs font-semibold text-v-accent"><Check size={12} /> {p}</li>)}
          </ul>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
