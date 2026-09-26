'use client'
// Botones del hero con animación: el principal con brillo que lo recorre, halo que late y
// flecha que avanza al pasar el mouse; el secundario se eleva con un borde luminoso.

import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'

const MotionLink = motion.create(Link)

export function BotonPrincipal({ href, children }: { href: string; children: React.ReactNode }) {
  const quieto = useReducedMotion()
  return (
    <div className="relative">
      {/* Halo que late detrás del botón */}
      {!quieto && (
        <motion.span aria-hidden className="absolute inset-0 rounded-full bg-[#0a84ff]"
          style={{ filter: 'blur(18px)' }}
          animate={{ opacity: [0.25, 0.55, 0.25], scale: [0.92, 1.06, 0.92] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }} />
      )}
      <MotionLink href={href} initial="reposo" whileHover="hover" whileTap={{ scale: 0.96 }}
        variants={{ reposo: { y: 0 }, hover: { y: -3 } }} transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        className="v-brand relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full px-7 text-[15px] font-semibold">
        {/* Brillo que recorre el botón */}
        {!quieto && (
          <motion.span aria-hidden className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)' }}
            initial={{ left: '-40%' }} animate={{ left: ['-40%', '140%'] }}
            transition={{ duration: 1.3, repeat: Infinity, repeatDelay: 2.4, ease: 'easeInOut' }} />
        )}
        <span className="relative">{children}</span>
        <motion.span className="relative" variants={{ reposo: { x: 0 }, hover: { x: 4 } }}>
          <ArrowRight size={17} />
        </motion.span>
      </MotionLink>
    </div>
  )
}

export function BotonSecundario({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button type="button" onClick={onClick} whileHover={{ y: -3 }} whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-full border border-v-border bg-v-elevated px-7 text-[15px] font-semibold text-v-text shadow-v transition-[border-color,box-shadow] duration-300 hover:border-v-accent/50 hover:shadow-[0_10px_30px_-10px_rgba(10,132,255,0.45)]">
      {children}
    </motion.button>
  )
}
