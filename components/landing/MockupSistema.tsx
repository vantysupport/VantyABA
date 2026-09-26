'use client'
// Maqueta del sistema para el hero, fiel a las pantallas reales de Vanty ABA: la ficha de un
// paciente en Programas ABA (centro con plan Clinic) y el Inicio del portal de familias en el celular.
// Se dibuja a tamaño real (1180 px) y se escala al ancho disponible. Pacientes ficticios.

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { motion } from 'motion/react'
import {
  Home, CalendarDays, Users, Zap, Stethoscope, DollarSign, BarChart3, BookOpen, MessageCircle, KeyRound, User,
  Bell, Plus, Search, ChevronRight, ChevronDown, Trash2, Info, ClipboardList, ClipboardCheck, FileSearch, History,
  FileText, FolderOpen, Award, Pencil, CalendarCheck, Target, Clock, Heart, Sparkles, Maximize2, Moon,
} from 'lucide-react'

const ease = [0.22, 1, 0.36, 1] as const
const ANCHO = 1180

function Escalado({ ancho, children, className = '' }: { ancho: number; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(1)
  const [alto, setAlto] = useState<number | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => {
      const escala = el.clientWidth / ancho
      setK(escala)
      const hijo = el.firstElementChild as HTMLElement | null
      if (hijo) setAlto(hijo.offsetHeight * escala)
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ancho])
  return (
    <div ref={ref} className={`overflow-hidden ${className}`} style={{ height: alto ?? undefined }}>
      <div style={{ width: ancho, transform: `scale(${k})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  )
}

// Curva de progreso de un programa con la línea de criterio punteada
function Curva({ puntos, delay }: { puntos: number[]; delay: number }) {
  const d = puntos.map((y, i) => `${i === 0 ? 'M' : 'L'} ${40 + i * (560 / (puntos.length - 1))} ${70 - y * 0.6}`).join(' ')
  return (
    <svg viewBox="0 0 640 76" className="h-[64px] w-full" preserveAspectRatio="none" aria-hidden>
      <line x1="0" x2="640" y1={70 - 90 * 0.6} y2={70 - 90 * 0.6} stroke="currentColor" className="text-v-subtle" strokeDasharray="4 5" />
      <motion.path d={d} fill="none" stroke="#0a84ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay, duration: 1.4, ease }} />
    </svg>
  )
}

export function MockupSistema({ en, celular = true }: { en: boolean; celular?: boolean }) {
  const L = (e: string, s: string) => (en ? e : s)
  const nav = [
    { Icon: Home, t: L('Home', 'Inicio') },
    { Icon: CalendarDays, t: L('Schedule', 'Agenda') },
    { Icon: Users, t: L('Patients', 'Pacientes'), on: true },
    { Icon: Zap, t: L('Predictive analysis', 'Análisis Predictivo') },
    { Icon: Stethoscope, t: 'CIE-11' },
    { Icon: DollarSign, t: L('Payments', 'Pagos') },
    { Icon: BarChart3, t: L('Financial reports', 'Reportes Financieros') },
    { Icon: BookOpen, t: L('Extra resources', 'Recursos Adicionales') },
    { Icon: MessageCircle, t: L('Team chat', 'Chat Equipo') },
  ]
  const pacientes = [
    { n: 'Emma Castillo', d: L('ASD 1 · 6 yrs', 'TEA 1 · 6 años') },
    { n: 'Lucas Fernández', d: L('Language delay · 4 yrs', 'Retraso del lenguaje · 4 años') },
    { n: 'Mateo Gutiérrez', d: L('ASD Level 2 · 5 yrs', 'TEA Nivel 2 · 5 años') },
    { n: 'Sofía Ramírez', d: L('ASD Level 1 · 7 yrs', 'TEA Nivel 1 · 7 años'), on: true },
    { n: 'Thiago Vargas', d: L('Evaluation · 8 yrs', 'Evaluación · 8 años') },
    { n: 'Valentina Rojas', d: L('ADHD · 9 yrs', 'TDAH · 9 años') },
  ]
  const tabs = [
    { Icon: Info, t: L('General info', 'Información general') },
    { Icon: ClipboardList, t: L('ABA programs', 'Programas ABA'), on: true },
    { Icon: ClipboardCheck, t: L('Evaluations', 'Evaluaciones') },
    { Icon: FileSearch, t: L('Initial evaluation', 'Evaluación Inicial') },
    { Icon: History, t: L('History', 'Historial') },
    { Icon: FileText, t: L('Forms', 'Fichas') },
    { Icon: FolderOpen, t: L('Documents', 'Documentos') },
  ]
  const programas = [
    {
      t: L('C3. Ask for help using words', 'C3. Pedir ayuda con palabras'), cat: L('COMMUNICATION', 'COMUNICACIÓN'),
      estado: { t: L('Mastered ✓', 'Dominado ✓'), c: 'bg-v-success/15 text-v-success' }, criterio: true,
      obj: L('The student will ask for help with a full sentence in 9 of 10 opportunities.', 'La estudiante pedirá ayuda con una frase completa en 9 de 10 oportunidades.'),
      stats: [L('12 total sessions', '12 sesiones totales'), '95%', L('in Set 3', 'en Set 3'), L('Criterion: 90%', 'Criterio: 90%')],
      puntos: [35, 48, 55, 62, 70, 78, 84, 88, 93, 95],
    },
    {
      t: L('A2. Follow two-step instructions', 'A2. Seguir instrucciones de dos pasos'), cat: L('ATTENTION', 'ATENCIÓN Y SEGUIMIENTO'),
      estado: { t: L('Intervention', 'Intervención'), c: 'bg-v-accent-soft text-v-accent' }, criterio: false,
      obj: L('The student will follow two-step instructions without prompts in 8 of 10 trials.', 'La estudiante seguirá instrucciones de dos pasos sin apoyo en 8 de 10 ensayos.'),
      stats: [L('8 total sessions', '8 sesiones totales'), '70%', L('in Set 2', 'en Set 2'), L('Criterion: 90%', 'Criterio: 90%')],
      puntos: [20, 32, 30, 45, 52, 58, 64, 70],
    },
  ]

  return (
    <div className="relative">
      {/* ── Panel del centro: Pacientes › Programas ABA ── */}
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15, ease }}
        className={`overflow-hidden rounded-[18px] border border-v-border bg-v-bg ${celular ? 'shadow-[0_40px_100px_-30px_rgba(0,60,160,0.45)]' : ''}`}>
        <Escalado ancho={ANCHO}>
          <div className="v-scope flex h-[640px] bg-v-bg text-v-text">
            {/* Barra lateral (plan Clinic) */}
            <aside className="flex w-[220px] shrink-0 flex-col border-r border-v-border bg-v-elevated p-3">
              <div className="flex items-center gap-2.5 px-1.5 py-1">
                <Image src="/brand/vanty-logo-96.png" alt="" width={40} height={40} className="size-10 rounded-[12px]" />
                <div>
                  <p className="text-[13px] font-semibold">{L('Your center', 'Tu centro')}</p>
                  <span className="rounded-full bg-v-accent-soft px-2 py-0.5 text-[10px] font-semibold text-v-accent">{L('Director', 'Jefe')}</span>
                </div>
              </div>
              <div className="mt-4 space-y-0.5">
                {nav.map(n => (
                  <div key={n.t} className={`flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-[13px] font-medium ${n.on ? 'v-brand' : 'text-v-muted'}`} style={n.on ? { boxShadow: 'none' } : undefined}>
                    <n.Icon size={16} /> {n.t}
                  </div>
                ))}
              </div>
              <p className="mt-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-v-subtle">{L('System', 'Sistema')}</p>
              <div className="mt-1 space-y-0.5">
                {[{ Icon: KeyRound, t: L('Users', 'Usuarios') }, { Icon: User, t: L('My profile', 'Mi Perfil') }].map(n => (
                  <div key={n.t} className="flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-[13px] font-medium text-v-muted"><n.Icon size={16} /> {n.t}</div>
                ))}
              </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              {/* Encabezado */}
              <header className="flex items-center justify-between border-b border-v-border bg-v-elevated px-6 py-3">
                <div>
                  <p className="text-[17px] font-semibold">{L('Patients', 'Pacientes')}</p>
                  <p className="text-[11px] text-v-muted">{L('Your center · Management', 'Tu centro · Gestión Integral')}</p>
                </div>
                <div className="flex items-center gap-2 text-v-muted">
                  <Maximize2 size={15} />
                  <span className="rounded-full bg-v-fill p-0.5 text-[11px] font-semibold text-v-text"><span className="inline-block rounded-full bg-v-elevated px-2.5 py-1 shadow-v">{en ? 'EN' : 'ES'}</span><span className="px-2.5 text-v-muted">{en ? 'ES' : 'EN'}</span></span>
                  <span className="grid size-8 place-items-center rounded-full bg-v-fill"><Moon size={14} /></span>
                  <Bell size={16} />
                </div>
              </header>

              <div className="flex min-h-0 flex-1">
                {/* Lista de pacientes */}
                <div className="w-[260px] shrink-0 border-r border-v-border bg-v-elevated p-3">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-2 text-[14px] font-semibold">{L('Patients', 'Pacientes')} <span className="rounded-full bg-v-accent-soft px-2 py-0.5 text-[11px] font-bold text-v-accent">48</span></p>
                    <span className="v-brand grid size-8 place-items-center rounded-full" style={{ boxShadow: 'none' }}><Plus size={15} /></span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 rounded-full border border-v-border bg-v-bg px-3 py-2 text-[12px] text-v-subtle"><Search size={13} /> {L('Search by name…', 'Buscar por nombre…')}</div>
                  <div className="mt-2.5 space-y-1">
                    {pacientes.map(p => (
                      <div key={p.n} className={`flex items-center gap-2.5 rounded-[12px] px-2 py-2 ${p.on ? 'bg-v-accent-soft' : ''}`}>
                        <span className={`grid size-8 shrink-0 place-items-center rounded-[10px] text-[12px] font-bold ${p.on ? 'v-brand' : 'bg-v-accent-soft text-v-accent'}`} style={p.on ? { boxShadow: 'none' } : undefined}>{p.n.charAt(0)}</span>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-[12px] font-semibold ${p.on ? 'text-v-accent' : ''}`}>{p.n}</p>
                          <p className="truncate text-[10px] text-v-muted">{p.d}</p>
                        </div>
                        {p.on && <ChevronRight size={13} className="text-v-accent" />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ficha del paciente */}
                <div className="min-w-0 flex-1 px-5 pt-4">
                  <div className="flex items-center gap-3">
                    <span className="v-brand grid size-12 place-items-center rounded-[14px] text-[18px] font-bold" style={{ boxShadow: 'none' }}>S</span>
                    <div>
                      <p className="text-[19px] font-semibold">Sofía Ramírez</p>
                      <p className="mt-0.5 flex items-center gap-2 text-[11px] text-v-muted"><span className="rounded-full bg-v-accent-soft px-2 py-0.5 font-semibold text-v-accent">{L('ASD Level 1', 'TEA Nivel 1')}</span> {L('7 years', '7 años')}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-3 border-b border-v-border text-[10.5px]">
                    {tabs.map(tb => (
                      <span key={tb.t} className={`flex items-center gap-1.5 whitespace-nowrap pb-2 ${tb.on ? 'border-b-2 border-v-accent font-semibold text-v-accent' : 'text-v-muted'}`}><tb.Icon size={12} /> {tb.t}</span>
                    ))}
                  </div>

                  <div className="mt-3 space-y-3">
                    {programas.map((pr, i) => (
                      <motion.div key={pr.t} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.15, ease }}
                        className="rounded-[18px] border border-v-border bg-v-elevated p-3.5 shadow-v">
                        <div className="flex items-start gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-v-accent-soft text-v-accent"><ClipboardList size={16} /></span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-[13px] font-semibold">{pr.t}</p>
                              <Pencil size={11} className="text-v-subtle" />
                              <span className="rounded-full bg-v-fill px-2 py-0.5 text-[9px] font-semibold text-v-muted">{pr.cat}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${pr.estado.c}`}>{pr.estado.t}</span>
                              {pr.criterio && <span className="inline-flex items-center gap-1 rounded-full bg-v-success/15 px-2 py-0.5 text-[9px] font-semibold text-v-success"><Award size={10} /> {L('Criterion met', 'Criterio alcanzado')}</span>}
                            </div>
                            <p className="mt-1 text-[11px] text-v-muted">{pr.obj}</p>
                            <p className="mt-1 flex items-center gap-3 text-[10px] text-v-muted">
                              <span>{pr.stats[0]}</span><span>— <b className="text-v-text">{pr.stats[1]}</b> {pr.stats[2]}</span><span>{pr.stats[3]}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="v-brand inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ boxShadow: 'none' }}><Plus size={11} /> {L('Session', 'Sesión')}</span>
                            <Trash2 size={13} className="text-v-subtle" />
                            <ChevronDown size={14} className="text-v-subtle" />
                          </div>
                        </div>
                        <div className="mt-2 rounded-[12px] bg-v-bg px-2"><Curva puntos={pr.puntos} delay={0.8 + i * 0.25} /></div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Escalado>
      </motion.div>

      {/* ── Portal de familias en el celular ── */}
      {celular && (
      <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.7, ease }}
        className="absolute -bottom-8 -right-3 w-[34%] max-w-[230px] sm:-right-6">
        <div className="overflow-hidden rounded-[28px] border-[5px] border-[#0b1b33] bg-v-bg shadow-[0_30px_70px_-20px_rgba(0,40,110,0.6)]">
          <Escalado ancho={300}>
            <div className="v-scope bg-v-bg p-3 text-v-text">
              <div className="flex items-center justify-between">
                <div><p className="text-[15px] font-semibold">{L('Home', 'Inicio')}</p><p className="text-[10px] text-v-muted">{L('Your center · Family portal', 'Tu centro · Portal Familias')}</p></div>
                <Bell size={15} className="text-v-muted" />
              </div>
              <div className="mt-2 flex items-center gap-2 text-[10px] text-v-muted">
                {L('Viewing:', 'Viendo a:')}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-v-accent/40 bg-v-accent-soft px-2 py-1 font-semibold text-v-accent"><span className="v-brand grid size-4 place-items-center rounded-full text-[8px]" style={{ boxShadow: 'none' }}>S</span> Sofía</span>
              </div>
              <div className="relative mt-2.5 overflow-hidden rounded-[18px] border border-v-border bg-v-elevated p-3 shadow-v">
                <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-v-muted">{L('Good morning', 'Buenos días')}</p>
                    <p className="text-[18px] font-bold leading-tight">{L('This is how ', 'Así va ')}<span className="v-brand-text">Sofía</span></p>
                  </div>
                  <div className="relative grid size-14 place-items-center">
                    <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" className="stroke-v-fill" strokeWidth="3.5" />
                      <motion.circle cx="18" cy="18" r="15" fill="none" stroke="#0a84ff" strokeWidth="3.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 0.72 }} transition={{ delay: 1.3, duration: 1.2, ease }} /></svg>
                    <span className="text-[12px] font-bold">72%</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5 rounded-full bg-v-fill px-2.5 py-1.5 text-[10px] font-semibold"><Sparkles size={11} className="text-v-accent" /> {L('Ask ARIA', 'Preguntar a ARIA')}</div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[{ Icon: CalendarCheck, t: L('Sessions', 'Sesiones'), v: '12' }, { Icon: Target, t: L('Mastery', 'Dominio'), v: '72%' }].map(k => (
                  <div key={k.t} className="rounded-[14px] border border-v-border bg-v-elevated p-2.5">
                    <p className="flex items-center justify-between text-[10px] text-v-muted">{k.t} <k.Icon size={12} className="text-v-accent" /></p>
                    <p className="mt-0.5 text-[18px] font-bold">{k.v}</p>
                  </div>
                ))}
              </div>
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.8, type: 'spring', stiffness: 260, damping: 18 }}
                className="mt-2 rounded-[14px] border border-v-border bg-v-elevated p-2.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold"><Clock size={12} className="text-v-accent" /> {L('Next session', 'Próxima sesión')}</p>
                <p className="mt-0.5 text-[10px] text-v-muted">{L('Wed 30 · 11:00 · Online', 'Mié 30 · 11:00 · Virtual')}</p>
              </motion.div>
              <div className="mt-2 grid grid-cols-4 gap-1 rounded-[16px] border border-v-border bg-v-elevated py-1.5 text-v-subtle">
                {[Home, CalendarDays, Heart, MessageCircle].map((I, i) => <span key={i} className={`grid place-items-center py-1 ${i === 0 ? 'text-v-accent' : ''}`}><I size={15} /></span>)}
              </div>
            </div>
          </Escalado>
        </div>
      </motion.div>
      )}
    </div>
  )
}
