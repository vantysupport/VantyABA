'use client'
// Fondo animado del hero: aurora de luces azules que se desplazan, un barrido de brillo
// y destellos que titilan. Se detiene si el usuario pidió reducir el movimiento.

import { motion, useReducedMotion } from 'motion/react'

const MANCHAS = [
  { c: 'rgba(1,171,252,0.55)', s: 620, x: '-8%', y: '-18%', dx: [0, 90, -40, 0], dy: [0, 50, 20, 0], d: 18 },
  { c: 'rgba(0,99,216,0.40)', s: 700, x: '62%', y: '-10%', dx: [0, -80, 30, 0], dy: [0, 60, -20, 0], d: 22 },
  { c: 'rgba(125,211,252,0.55)', s: 520, x: '30%', y: '35%', dx: [0, 60, -70, 0], dy: [0, -40, 30, 0], d: 20 },
  { c: 'rgba(56,189,248,0.35)', s: 460, x: '80%', y: '45%', dx: [0, -50, 40, 0], dy: [0, -30, 40, 0], d: 16 },
]

// Posiciones fijas (no aleatorias) para que el servidor y el navegador rendericen igual
const DESTELLOS = [
  [12, 22], [22, 58], [34, 14], [46, 40], [58, 18], [68, 62], [78, 26], [88, 48], [8, 72], [52, 76], [92, 12], [40, 64],
]

export function LucesHero() {
  const quieto = useReducedMotion()
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Base suave */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #eaf6ff 0%, #dcefff 55%, #b9dcff 100%)' }} />

      {/* Aurora */}
      {MANCHAS.map((m, i) => (
        <motion.div key={i} className="absolute rounded-full"
          style={{ left: m.x, top: m.y, width: m.s, height: m.s, background: `radial-gradient(circle, ${m.c} 0%, transparent 65%)`, filter: 'blur(40px)' }}
          animate={quieto ? undefined : { x: m.dx, y: m.dy, scale: [1, 1.12, 0.95, 1] }}
          transition={{ duration: m.d, repeat: Infinity, ease: 'easeInOut' }} />
      ))}

      {/* Haz de luz que barre en diagonal */}
      {!quieto && (
        <motion.div className="absolute -inset-y-1/4 w-1/3"
          style={{ background: 'linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)', filter: 'blur(24px)', rotate: '12deg' }}
          initial={{ left: '-40%' }} animate={{ left: ['-40%', '130%'] }}
          transition={{ duration: 7, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }} />
      )}

      {/* Halo blanco detrás del título */}
      <div className="absolute inset-x-0 top-0 h-[70%]" style={{ background: 'radial-gradient(46rem 20rem at 50% 30%, rgba(255,255,255,0.75), transparent 70%)' }} />

      {/* Destellos */}
      {DESTELLOS.map(([x, y], i) => (
        <motion.span key={i} className="absolute size-1 rounded-full bg-white"
          style={{ left: `${x}%`, top: `${y}%`, boxShadow: '0 0 12px 3px rgba(255,255,255,0.9), 0 0 24px 6px rgba(1,171,252,0.45)' }}
          animate={quieto ? { opacity: 0.6 } : { opacity: [0, 1, 0], scale: [0.6, 1.3, 0.6] }}
          transition={{ duration: 3 + (i % 4), repeat: Infinity, delay: i * 0.45, ease: 'easeInOut' }} />
      ))}

      {/* Rejilla muy sutil que se desvanece hacia abajo */}
      <div className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,99,216,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,99,216,0.07) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 20%, #000 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 20%, #000 20%, transparent 75%)',
        }} />
    </div>
  )
}
