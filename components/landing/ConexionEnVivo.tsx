'use client'
// ARIA como puente entre el centro y cada familia: ARIA al centro, la clínica y la casa a los lados
// con lo que ARIA hace por cada uno, y sus capacidades debajo.

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Building2, Users } from 'lucide-react'

const ease = [0.22, 1, 0.36, 1] as const

// Haz de luz que sale de ARIA hacia un lado
function Haz({ hacia }: { hacia: 'izq' | 'der' }) {
  const quieto = useReducedMotion()
  return (
    <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-v-accent-soft">
      {!quieto && (
        <motion.span className="absolute inset-y-0 w-10 rounded-full"
          style={{ background: 'linear-gradient(90deg, transparent, #01abfc, #0063d8, transparent)', boxShadow: '0 0 14px 2px rgba(1,171,252,0.6)' }}
          animate={{ left: hacia === 'der' ? ['-30%', '110%'] : ['110%', '-30%'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.3 }} />
      )}
    </div>
  )
}

// Aviso de ARIA sobre una foto: uno a la vez, rotando (entra, se queda y da paso al siguiente)
function AvisosAria({ avisos, desfase }: { avisos: { pose: number; t: string; s: string }[]; desfase: number }) {
  const quieto = useReducedMotion()
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (quieto) { setVisible(true); return }
    let intervalo: ReturnType<typeof setInterval> | undefined
    const inicio = setTimeout(() => {
      setVisible(true)
      intervalo = setInterval(() => setIdx(n => (n + 1) % avisos.length), 3400)
    }, 600 + desfase)
    return () => { clearTimeout(inicio); if (intervalo) clearInterval(intervalo) }
  }, [avisos.length, desfase, quieto])
  const a = avisos[idx]
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex sm:bottom-4 sm:left-4">
      <AnimatePresence mode="wait">
        {visible && (
          <motion.div key={idx} initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="flex max-w-[92%] items-center gap-2 rounded-[16px] border border-white/70 bg-white/85 py-1.5 pl-1.5 pr-3 shadow-v backdrop-blur-md sm:max-w-[80%]">
            <Image src={`/aria/pose-${a.pose}.webp`} alt="" width={28} height={28} style={{ width: 28, height: 28 }} className="shrink-0 rounded-full bg-v-accent-soft object-contain p-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-v-accent">{a.s}</p>
              <p className="text-[12px] font-medium leading-tight text-[#0b1b33]">{a.t}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ConexionEnVivo({ en }: { en: boolean }) {
  const L = (e: string, s: string) => (en ? e : s)
  const quieto = useReducedMotion()
  const lados = [
    {
      Icon: Building2, tono: 'v-brand', titulo: L('For your team', 'Para tu equipo'), img: '/landing/equipo-app.webp',
      alt: L("Therapist showing a family their child's progress in Vanty ABA", 'Terapeuta mostrando a una familia el progreso de su hijo en Vanty ABA'),
      avisos: [
        { pose: 8, s: 'ARIA', t: L('Report ready in 2 minutes', 'Informe listo en 2 minutos') },
        { pose: 4, s: 'ARIA', t: L('I suggest 3 new goals for Sofía', 'Sugiero 3 objetivos nuevos para Sofía') },
        { pose: 10, s: 'ARIA', t: L('Sofía\'s progress: +15% this month', 'Progreso de Sofía: +15% este mes') },
        { pose: 1, s: 'ARIA', t: L('Session summary sent to the family', 'Resumen de la sesión enviado a la familia') },
      ],
    },
    {
      Icon: Users, tono: 'v-brand', titulo: L('For each family', 'Para cada familia'), img: '/landing/familia-app.webp',
      alt: L('Family showing their child\'s progress in the Vanty ABA app', 'Familia mostrando el progreso de su hija en la app de Vanty ABA'),
      avisos: [
        { pose: 7, s: 'ARIA', t: L('Sofía mastered a new goal!', '¡Sofía logró un objetivo nuevo!') },
        { pose: 3, s: 'ARIA', t: L('Try this game at home today', 'Practiquen hoy este juego en casa') },
        { pose: 5, s: 'ARIA', t: L('Tomorrow\'s session is at 11:00', 'La sesión de mañana es a las 11:00') },
        { pose: 2, s: 'ARIA', t: L('New message from the therapist', 'Nuevo mensaje de la terapeuta') },
      ],
    },
  ]
  const capacidades = [
    { pose: 8, t: L('Writes clinical reports', 'Redacta informes clínicos'), d: L('From session data, in minutes.', 'A partir de los datos de cada sesión, en minutos.') },
    { pose: 4, t: L('Suggests and predicts', 'Sugiere y predice'), d: L('Goals, patterns and progress forecasts.', 'Objetivos, patrones y proyección de avances.') },
    { pose: 7, t: L('Guides families at home', 'Guía a las familias en casa'), d: L('Activities and advice in plain language.', 'Actividades y consejos en lenguaje claro.') },
    { pose: 10, t: L('Always available', 'Siempre disponible'), d: L('Answers 24/7 with your center\'s knowledge.', 'Responde 24/7 con el conocimiento clínico.') },
  ]

  return (
    <div>
      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_240px_minmax(0,1fr)] lg:gap-0">
        {lados.map((lado, i) => (
          <motion.div key={lado.titulo} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, delay: i * 0.15, ease }} className={i === 1 ? 'lg:order-3' : 'lg:order-1'}>
            <div className="mb-3 flex items-center gap-2.5">
              <span className={`grid size-9 place-items-center rounded-[30%] ${lado.tono}`} style={lado.tono === 'v-brand' ? { boxShadow: 'none' } : undefined}><lado.Icon size={17} /></span>
              <h3 className="text-lg font-semibold">{lado.titulo}</h3>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-v-border shadow-v-lg">
              <Image src={lado.img} alt={lado.alt} fill quality={90} sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
              <AvisosAria avisos={lado.avisos} desfase={i * 1700} />
            </div>
          </motion.div>
        ))}

        {/* ARIA al centro, conectando ambos lados. En escritorio el pt-12 compensa el título de cada foto
            (size-9 + mb-3) para que ARIA y los haces queden a la altura del centro de las fotos. */}
        <div className="relative order-first flex items-center justify-center pb-8 pt-1 lg:order-2 lg:pb-0 lg:pt-12">
          <div className="relative grid size-[132px] place-items-center lg:size-[150px]">
            {/* Haces: del borde de cada foto al anillo de ARIA */}
            <div aria-hidden className="absolute right-full top-1/2 hidden w-[45px] -translate-y-1/2 lg:block"><Haz hacia="izq" /></div>
            <div aria-hidden className="absolute left-full top-1/2 hidden w-[45px] -translate-y-1/2 lg:block"><Haz hacia="der" /></div>

            <span aria-hidden className="absolute inset-0 rounded-full border border-v-accent/20 bg-white/60 shadow-v backdrop-blur-sm" />
            <span aria-hidden className="absolute inset-3 rounded-full" style={{ background: 'radial-gradient(circle, rgba(1,171,252,0.28), transparent 70%)' }} />
            {!quieto && [0, 1].map(k => (
              <motion.span key={k} aria-hidden className="absolute inset-0 rounded-full border-2 border-v-accent/30"
                style={{ willChange: 'transform, opacity' }}
                initial={{ scale: 1, opacity: 0 }}
                animate={{ scale: [1, 1.35], opacity: [0.6, 0] }} transition={{ duration: 2.4, repeat: Infinity, delay: k * 1.2, ease: 'easeOut' }} />
            ))}

            {/* Sombra en el piso: se achica cuando ARIA sube (más barata que un drop-shadow animado) */}
            <motion.span aria-hidden className="absolute bottom-[14px] h-2.5 w-16 rounded-full bg-[#0b3d91]/25 blur-[3px]"
              animate={quieto ? undefined : { scaleX: [1, 0.78, 1], opacity: [0.9, 0.55, 0.9] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} />
            <motion.div className="relative -mt-2" style={{ willChange: 'transform' }}
              animate={quieto ? undefined : { y: [0, -8, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
              <Image src="/aria/aria-conecta.webp" alt="ARIA" width={180} height={180} priority={false}
                className="size-[108px] object-contain lg:size-[126px]" />
            </motion.div>

            {/* Etiqueta debajo del círculo, sin tapar a ARIA */}
            <span className="v-brand absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-full px-3.5 py-1 text-xs font-bold tracking-wide" style={{ boxShadow: 'none' }}>ARIA</span>
          </div>
        </div>
      </div>

      {/* Lo que hace ARIA */}
      <div className="mt-10 grid gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(4,minmax(0,1fr))]">
        {capacidades.map((c, i) => (
          <motion.div key={c.t} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, ease }}
            whileHover={{ y: -4 }}
            className="group relative overflow-hidden rounded-[22px] border border-v-border bg-v-elevated p-4 pr-20 shadow-v">
            <h3 className="text-[15px] font-semibold">{c.t}</h3>
            <p className="mt-1 text-[13px] leading-snug text-v-muted">{c.d}</p>
            <Image src={`/aria/pose-${c.pose}.webp`} alt="" width={80} height={80}
              style={{ width: 72, height: 'auto' }} className="absolute -bottom-2 right-1 transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-3" />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
