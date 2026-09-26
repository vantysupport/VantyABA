'use client'
// Funciones complementarias en formato "bento": cada tarjeta con una mini ilustración animada.

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Video, Bell, Stethoscope, ShieldCheck, Languages, Smartphone, Mail, Search, Lock, Mic, type LucideIcon } from 'lucide-react'

const ease = [0.22, 1, 0.36, 1] as const

function Tarjeta({ Icon, t, d, children, className = '', delay = 0 }: { Icon: LucideIcon; t: string; d: string; children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.6, delay, ease }}
      whileHover={{ y: -4 }}
      className={`group relative flex flex-col overflow-hidden rounded-[26px] border border-v-border bg-v-bg p-5 transition-shadow duration-300 hover:shadow-v-lg ${className}`}>
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" style={{ background: 'radial-gradient(circle, rgba(1,171,252,0.35), transparent 70%)' }} />
      <div className="relative flex min-h-[132px] flex-1 items-center justify-center">{children}</div>
      <div className="relative mt-4 flex items-start gap-3">
        <span className="v-brand grid size-9 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><Icon size={16} /></span>
        <div>
          <h3 className="font-semibold">{t}</h3>
          <p className="mt-0.5 text-[13px] leading-snug text-v-muted">{d}</p>
        </div>
      </div>
    </motion.div>
  )
}

// Rota entre valores cada `ms`
function useRotar(n: number, ms: number) {
  const quieto = useReducedMotion()
  const [i, setI] = useState(0)
  useEffect(() => {
    if (quieto) return
    const t = setInterval(() => setI(x => (x + 1) % n), ms)
    return () => clearInterval(t)
  }, [n, ms, quieto])
  return i
}

function Llamada({ en }: { en: boolean }) {
  const [seg, setSeg] = useState(724)
  useEffect(() => { const t = setInterval(() => setSeg(s => s + 1), 1000); return () => clearInterval(t) }, [])
  const mm = String(Math.floor(seg / 60)).padStart(2, '0'), ss = String(seg % 60).padStart(2, '0')
  return (
    <div className="w-full max-w-[340px] rounded-[18px] bg-[#0b1b33] p-2.5 shadow-v-lg">
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2">
        {[{ n: L2(en, 'Therapist', 'Terapeuta'), c: 'from-sky-400 to-blue-600', i: 'T' }, { n: L2(en, 'Family', 'Familia'), c: 'from-emerald-400 to-teal-600', i: 'F' }].map((p, k) => (
          <div key={p.n} className="relative grid aspect-video place-items-center rounded-[12px] bg-white/5">
            <span className={`grid size-9 place-items-center rounded-full bg-gradient-to-br ${p.c} text-sm font-bold text-white`}>{p.i}</span>
            {k === 0 && <motion.span className="absolute inset-0 rounded-[12px] ring-2 ring-sky-400" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.6, repeat: Infinity }} />}
            <span className="absolute bottom-1 left-1.5 text-[9px] text-white/70">{p.n}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-white/80">
        <span className="inline-flex items-center gap-1"><span className="size-1.5 animate-pulse rounded-full bg-red-500" /> {L2(en, 'Live', 'En curso')} · {mm}:{ss}</span>
        <span className="inline-flex gap-1.5"><Mic size={11} /><Video size={11} /></span>
      </div>
    </div>
  )
}

const L2 = (en: boolean, e: string, s: string) => (en ? e : s)

function Avisos({ en }: { en: boolean }) {
  const items = [
    { t: L2(en, 'Appointment tomorrow', 'Cita de mañana'), d: L2(en, 'Wed 30 · 10:30 · In person', 'Mié 30 · 10:30 · Presencial') },
    { t: L2(en, 'Session confirmed', 'Sesión confirmada'), d: L2(en, 'Online · link included', 'Virtual · con link incluido') },
    { t: L2(en, 'Session summary', 'Resumen de la sesión'), d: L2(en, 'Sofía got 9 of 10 right', 'Sofía acertó 9 de 10') },
  ]
  const i = useRotar(items.length, 2200)
  return (
    <div className="relative h-[120px] w-full max-w-[260px]">
      {items.map((x, k) => {
        const pos = (k - i + items.length) % items.length // 0 al frente
        return (
          <motion.div key={x.t} animate={{ y: pos * 14, scale: 1 - pos * 0.06, opacity: pos === 2 ? 0.5 : 1, zIndex: 3 - pos }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="absolute inset-x-0 top-4 flex items-center gap-2.5 rounded-[14px] border border-v-border bg-v-elevated p-2.5 shadow-v">
            <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-v-accent-soft text-v-accent"><Mail size={14} /></span>
            <div className="min-w-0"><p className="text-[12px] font-semibold">{x.t}</p><p className="truncate text-[11px] text-v-muted">{x.d}</p></div>
          </motion.div>
        )
      })}
    </div>
  )
}

function Buscador({ en }: { en: boolean }) {
  const res = [
    { c: '6A02', n: L2(en, 'Autism spectrum disorder', 'Trastorno del espectro autista') },
    { c: '6A05', n: L2(en, 'ADHD', 'TDAH') },
    { c: '6A01', n: L2(en, 'Language development disorder', 'Trastorno del desarrollo del lenguaje') },
  ]
  const i = useRotar(res.length, 2600)
  return (
    <div className="w-full max-w-[280px]">
      <div className="flex items-center gap-2 rounded-full border border-v-border bg-v-elevated px-3 py-2 text-[12px] text-v-muted shadow-v"><Search size={13} /> {L2(en, 'Search diagnosis…', 'Buscar diagnóstico…')}</div>
      <AnimatePresence mode="wait">
        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          className="mt-2 flex items-center gap-2 rounded-[14px] border border-v-border bg-v-elevated p-2.5 shadow-v">
          <span className="rounded-lg bg-v-accent-soft px-2 py-1 text-[11px] font-bold tabular-nums text-v-accent">{res[i].c}</span>
          <span className="truncate text-[12px] font-medium">{res[i].n}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Escudo({ en }: { en: boolean }) {
  const quieto = useReducedMotion()
  return (
    <div className="relative grid place-items-center">
      {!quieto && [0, 1].map(k => (
        <motion.span key={k} aria-hidden className="absolute size-20 rounded-full border-2 border-v-accent/30" animate={{ scale: [1, 1.6], opacity: [0.7, 0] }} transition={{ duration: 2.4, repeat: Infinity, delay: k * 1.2 }} />
      ))}
      <span className="v-brand relative grid size-16 place-items-center rounded-[22px]" style={{ boxShadow: '0 12px 30px -10px rgba(10,132,255,0.6)' }}><ShieldCheck size={30} /></span>
      <span className="absolute -bottom-7 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-v-success/15 px-2.5 py-1 text-[11px] font-semibold text-v-success"><Lock size={11} /> {L2(en, '2FA enabled', '2FA activado')}</span>
    </div>
  )
}

function Idiomas() {
  const saludos = [{ l: 'ES', t: 'Hola, soy ARIA' }, { l: 'EN', t: "Hi, I'm ARIA" }]
  const i = useRotar(2, 2000)
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative grid grid-cols-[repeat(2,minmax(0,1fr))] rounded-full bg-v-fill p-1 text-[12px] font-bold">
        {saludos.map((s, k) => (
          <span key={s.l} className={`relative z-[1] px-4 py-1.5 text-center transition-colors ${k === i ? 'text-v-text' : 'text-v-muted'}`}>
            {k === i && <motion.span layoutId="idioma-pill" className="absolute inset-0 -z-[1] rounded-full bg-v-elevated shadow-v" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
            {s.l}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Image src="/aria/pose-1.webp" alt="" width={34} height={34} style={{ width: 34, height: 34 }} className="rounded-full bg-v-accent-soft object-contain p-0.5" />
        <AnimatePresence mode="wait">
          <motion.span key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="rounded-[14px] rounded-tl-sm border border-v-border bg-v-elevated px-3 py-1.5 text-[13px] font-semibold shadow-v">{saludos[i].t}</motion.span>
        </AnimatePresence>
      </div>
    </div>
  )
}

function AppInstalable({ en }: { en: boolean }) {
  const quieto = useReducedMotion()
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2, ease }}
      className="w-full max-w-[340px] rounded-[22px] border border-v-border bg-v-elevated p-4 shadow-v-lg">
      <div className="flex items-center gap-3">
        <Image src="/brand/vanty-logo-96.png" alt="" width={48} height={48} style={{ width: 48, height: 48 }} className="shrink-0 rounded-[13px]" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">{L2(en, 'Install Vanty ABA', 'Instalar Vanty ABA')}</p>
          <p className="text-[12px] text-v-muted">{L2(en, 'On your home screen, like any app', 'En tu pantalla de inicio, como cualquier app')}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {['iPhone', 'Android'].map(x => <span key={x} className="rounded-full bg-v-fill px-3 py-1 text-[12px] font-semibold text-v-muted">{x}</span>)}
      </div>
      <motion.div animate={quieto ? undefined : { scale: [1, 1.03, 1] }} transition={{ duration: 2, repeat: Infinity }}
        className="v-brand mt-3.5 rounded-full py-2.5 text-center text-[14px] font-semibold">{L2(en, 'Install', 'Instalar')}</motion.div>
    </motion.div>
  )
}

export function ExtrasBento({ en }: { en: boolean }) {
  const L = (e: string, s: string) => (en ? e : s)
  return (
    <div className="grid gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(4,minmax(0,1fr))]">
      <Tarjeta Icon={Video} t={L('Video calls', 'Videollamadas')} d={L('Online sessions with a link created automatically.', 'Sesiones virtuales con link creado automáticamente.')} className="md:col-span-2">
        <Llamada en={en} />
      </Tarjeta>
      <Tarjeta Icon={Bell} t={L('Notifications', 'Notificaciones')} d={L('Email reminders and summaries so no session is missed.', 'Recordatorios y resúmenes por correo para no perder ninguna sesión.')} delay={0.05}>
        <Avisos en={en} />
      </Tarjeta>
      <Tarjeta Icon={Stethoscope} t={L('ICD-11', 'CIE-11')} d={L('Quick WHO ICD-11 diagnosis search with codes.', 'Búsqueda rápida en la CIE-11 de la OMS, con códigos.')} delay={0.1}>
        <Buscador en={en} />
      </Tarjeta>
      <Tarjeta Icon={ShieldCheck} t={L('Clinical-grade security', 'Seguridad clínica')} d={L('Data isolated per center, 2FA and audit trail.', 'Datos aislados por centro, 2FA y auditoría.')} delay={0.15}>
        <Escudo en={en} />
      </Tarjeta>
      <Tarjeta Icon={Languages} t={L('Spanish and English', 'Español e inglés')} d={L('The whole platform, emails included.', 'Toda la plataforma, correos incluidos.')} delay={0.2}>
        <Idiomas />
      </Tarjeta>
      <Tarjeta Icon={Smartphone} t={L('Installable app', 'App instalable')} d={L('On iPhone and Android, no app store needed.', 'En iPhone y Android, sin tienda de apps.')} className="md:col-span-2 lg:col-span-2" delay={0.25}>
        <AppInstalable en={en} />
      </Tarjeta>
    </div>
  )
}
