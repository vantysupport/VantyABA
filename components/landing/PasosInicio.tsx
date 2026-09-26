'use client'
// "En marcha en tres pasos": línea de tiempo con nodos numerados, una línea que se llena al
// aparecer y, en cada paso, una mini muestra de lo que ocurre en Vanty ABA.

import Image from 'next/image'
import { motion } from 'motion/react'
import { Building2, Users, MessageCircle, Copy, CheckCircle2, Sparkles, type LucideIcon } from 'lucide-react'

const ease = [0.22, 1, 0.36, 1] as const

export function PasosInicio({ en }: { en: boolean }) {
  const L = (e: string, s: string) => (en ? e : s)
  const pasos: { Icon: LucideIcon; t: string; d: string; muestra: React.ReactNode }[] = [
    {
      Icon: Building2, t: L('Create your center', 'Crea tu centro'),
      d: L('Name, logo and language. Your free trial starts right away, no card needed.', 'Nombre, logo e idioma. Tu prueba gratis empieza de inmediato, sin tarjeta.'),
      muestra: (
        <div className="flex items-center gap-2.5">
          <Image src="/brand/vanty-logo-96.png" alt="" width={32} height={32} style={{ width: 32, height: 32 }} className="rounded-[9px]" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">{L('Your center', 'Tu centro')}</p>
            <p className="text-[11px] text-v-muted">{L('Free trial · 14 days', 'Prueba gratis · 14 días')}</p>
          </div>
          <span className="rounded-full bg-v-success/15 px-2 py-0.5 text-[10px] font-semibold text-v-success">{L('Active', 'Activo')}</span>
        </div>
      ),
    },
    {
      Icon: Users, t: L('Invite your team and families', 'Invita al equipo y a las familias'),
      d: L('Send an invitation link by email or WhatsApp; each person gets their own panel.', 'Envía un enlace de invitación por correo o WhatsApp; cada persona recibe su propio panel.'),
      muestra: (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate rounded-full bg-v-bg px-3 py-1.5 text-[11px] text-v-muted">vantyaba.com/invitar/k3Xc…</div>
          <span className="v-brand inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold" style={{ boxShadow: 'none' }}><Copy size={11} /> {L('Copy', 'Copiar')}</span>
        </div>
      ),
    },
    {
      Icon: MessageCircle, t: L('Work connected', 'Trabajen conectados'),
      d: L('Sessions, progress and messages reach each family, with ARIA helping at every step.', 'Sesiones, progreso y mensajes llegan a cada familia, con ARIA ayudando en cada paso.'),
      muestra: (
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-v-success/15 text-v-success"><CheckCircle2 size={15} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">{L('Session shared', 'Sesión compartida')}</p>
            <p className="truncate text-[11px] text-v-muted">{L('The family can already see it', 'La familia ya puede verla')}</p>
          </div>
          <Sparkles size={14} className="shrink-0 text-v-accent" />
        </div>
      ),
    },
  ]

  return (
    <div className="relative">
      {/* Línea que une los pasos (escritorio) */}
      <div aria-hidden className="absolute left-[16.66%] right-[16.66%] top-7 hidden h-[3px] overflow-hidden rounded-full bg-v-accent-soft md:block">
        <motion.div className="v-brand h-full origin-left rounded-full" style={{ boxShadow: 'none' }}
          initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 1.4, ease }} />
      </div>
      {/* Línea vertical (celular) */}
      <div aria-hidden className="absolute bottom-10 left-7 top-7 w-[3px] overflow-hidden rounded-full bg-v-accent-soft md:hidden">
        <motion.div className="v-brand h-full origin-top rounded-full" style={{ boxShadow: 'none' }}
          initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ duration: 1.4, ease }} />
      </div>

      <ol className="relative grid gap-8 md:grid-cols-[repeat(3,minmax(0,1fr))] md:gap-6">
        {pasos.map((p, i) => (
          <motion.li key={p.t} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.25 + i * 0.3, ease }}
            className="flex gap-4 md:flex-col md:items-center md:text-center">
            {/* Nodo numerado */}
            <span className="relative grid size-14 shrink-0 place-items-center">
              <motion.span aria-hidden className="absolute inset-0 rounded-full bg-v-accent/20"
                initial={{ scale: 0.6, opacity: 0 }} whileInView={{ scale: 1.35, opacity: [0, 0.8, 0] }} viewport={{ once: true }}
                transition={{ duration: 1.2, delay: 0.4 + i * 0.3 }} />
              <span className="v-brand relative grid size-14 place-items-center rounded-full text-xl font-bold ring-[6px] ring-v-bg">{i + 1}</span>
            </span>
            <div className="flex min-w-0 flex-1 flex-col md:mt-5 md:w-full">
              <h3 className="flex items-center gap-2 text-lg font-semibold md:justify-center"><p.Icon size={18} className="text-v-accent" /> {p.t}</h3>
              <p className="mx-auto mt-1.5 max-w-xs text-[15px] leading-relaxed text-v-muted md:mb-4">{p.d}</p>
              <div className="mx-auto mt-4 w-full max-w-[300px] rounded-[18px] md:mt-auto border border-v-border bg-v-elevated p-3 text-left shadow-v">{p.muestra}</div>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  )
}
