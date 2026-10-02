'use client'
// Inicio del portal de familias — mismo lenguaje visual que el Inicio del admin:
// tarjetas v-*, un ícono y un tono por concepto, números animados y sin emojis.

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTraducir } from '@/lib/use-traducir'
import {
  CalendarDays, CalendarCheck, Clock, CheckCircle2, XCircle, RefreshCw,
  TrendingUp, Target, Activity, ChevronRight, ArrowRight,
  Sparkles, AlertCircle, Users, BookOpen, Lightbulb, Hand,
  Smile, Meh, Frown, Heart, Trophy, X, MessageCircle, Brain, Loader2, Lock, Flame,
} from 'lucide-react'
import { AnimatePresence, animate, motion } from 'motion/react'

interface Props {
  child: any
  onChangeView: (view: string) => void
  refreshTrigger: number
  onCancelAppointment: (cita: { id: string; appointment_date: string; appointment_time: string | null; service_type?: string | null }, reschedule: boolean) => void
}

// ─── Conceptos: un ícono y un tono cada uno, iguales en toda la página ─────────
const CONCEPT = {
  sesiones:  { icon: CalendarCheck, tone: 'bg-v-success/15 text-v-success' },
  objetivos: { icon: Trophy,        tone: 'bg-v-success/15 text-v-success' },
  horas:     { icon: Clock,         tone: 'bg-v-accent-soft text-v-accent' },
  dominio:   { icon: Target,        tone: 'bg-v-warning/15 text-v-warning' },
  citas:     { icon: CalendarDays,  tone: 'bg-v-accent-soft text-v-accent' },
  aria:      { icon: Sparkles,      tone: 'bg-v-accent-soft text-v-accent' },
  mensajes:  { icon: MessageCircle, tone: 'bg-v-accent-soft text-v-accent' },
  programas: { icon: Target,        tone: 'bg-v-accent-soft text-v-accent' },
  progreso:  { icon: TrendingUp,    tone: 'bg-v-success/15 text-v-success' },
} as const
type Concepto = keyof typeof CONCEPT

const AREA_ICON: Record<string, any> = {
  comunicacion: MessageCircle, conducta: Target, cognitivo: Brain, social: Users,
  autonomia: Sparkles, academico: BookOpen, sensorial: Hand, imitacion: Activity,
}

const cardClass = 'rounded-v border border-v-border bg-v-elevated shadow-v'

function formatTime(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function calcAge(birthDate: string) {
  if (!birthDate) return 0
  const today = new Date(), birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
  return age
}

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const controls = animate(0, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1], onUpdate: v => setDisplay(Math.round(v)) })
    return () => controls.stop()
  }, [value])
  return <>{display}</>
}

function Section({ index = 0, className = '', children }: { index?: number; className?: string; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, type: 'spring', stiffness: 180, damping: 24 }}
      className={`${cardClass} flex flex-col ${className}`}>
      {children}
    </motion.section>
  )
}

function SectionHeader({ concept, title, badge, children }: { concept: Concepto; title: string; badge?: React.ReactNode; children?: React.ReactNode }) {
  const { icon: Icon, tone } = CONCEPT[concept]
  return (
    <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`grid size-8 shrink-0 place-items-center rounded-[30%] ${tone}`}><Icon size={15} /></span>
        <p className="truncate text-[15px] font-semibold tracking-tight text-v-text">{title}</p>
        {badge}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, text, action, onAction }: any) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-9 text-center">
      <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="grid size-12 place-items-center rounded-full bg-v-fill">
        <Icon size={20} className="text-v-subtle" />
      </motion.span>
      {title && <p className="mt-3 text-sm font-semibold text-v-text">{title}</p>}
      <p className="mt-1 max-w-xs text-sm text-v-muted">{text}</p>
      {action && (
        <button onClick={onAction} className="mt-4 inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-3.5 py-1.5 text-xs font-semibold text-v-accent transition-transform hover:scale-105 active:scale-95">
          {action} <ArrowRight size={12} />
        </button>
      )}
    </div>
  )
}

function KPI({ index, label, value, sufijo, sub, concept, onClick }: { index: number; label: string; value: number | null; sufijo?: string; sub: string; concept: Concepto; onClick?: () => void }) {
  const { icon: Icon, tone } = CONCEPT[concept]
  return (
    <motion.button type="button" onClick={onClick} disabled={!onClick}
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, type: 'spring', stiffness: 220, damping: 24 }}
      whileHover={onClick ? { y: -3 } : undefined} whileTap={onClick ? { scale: 0.98 } : undefined}
      className={`group ${cardClass} p-4 text-left disabled:cursor-default sm:p-5`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-v-muted">{label}</p>
        <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${tone}`}><Icon size={16} /></span>
      </div>
      <p className="mt-1 text-3xl font-bold leading-none tracking-tight tabular-nums text-v-text">
        {value === null ? '—' : <><CountUp value={value} />{sufijo}</>}
      </p>
      <p className="mt-1.5 truncate text-xs text-v-subtle">{sub}</p>
    </motion.button>
  )
}

function Ring({ pct, size = 76 }: { pct: number; size?: number }) {
  const r = size / 2 - 6
  const circ = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id="padre-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--v-brand-from)" />
            <stop offset="100%" stopColor="var(--v-brand-to)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--v-fill)" strokeWidth="6" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#padre-ring)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ} initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ * (1 - Math.min(100, pct) / 100) }}
          transition={{ delay: 0.3, duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums text-v-text">{Math.round(pct)}%</span>
    </div>
  )
}

function Barra({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="font-medium text-v-muted">{label}</span>
        <span className="font-semibold tabular-nums text-v-text">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-v-fill">
        <motion.div className={`h-full rounded-full ${tone}`} initial={{ width: 0 }} animate={{ width: `${value}%` }}
          transition={{ delay: 0.3, duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
      </div>
    </div>
  )
}

// ─── Celebración de logro ─────────────────────────────────────────────────────
function GoalCelebration({ childName, goalsAchieved, onClose }: { childName: string; goalsAchieved: number; onClose: () => void }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  useEffect(() => { const tm = setTimeout(onClose, 6000); return () => clearTimeout(tm) }, [onClose])
  return (
    <motion.div className="v-scope fixed inset-0 z-[9999] grid place-items-center bg-[#081426]/55 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="relative w-full max-w-sm overflow-hidden rounded-v-lg border border-v-border bg-v-elevated p-8 text-center shadow-v-lg">
        <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-1" />
        <button onClick={onClose} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-v-muted hover:bg-v-fill"><X size={16} /></button>
        <motion.span initial={{ rotate: -12, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.1 }}
          className="mx-auto grid size-20 place-items-center rounded-full bg-v-success/15 text-v-success"><Trophy size={38} /></motion.span>
        <h2 className="v-headline mt-4 text-2xl text-v-text">{en ? 'Great achievement!' : '¡Gran logro!'}</h2>
        <p className="mt-2 text-sm leading-relaxed text-v-muted">
          <strong className="text-v-text">{childName}</strong>{' '}
          {en ? `has mastered ${goalsAchieved} goal${goalsAchieved !== 1 ? 's' : ''} (80% or more).` : `ya domina ${goalsAchieved} objetivo${goalsAchieved !== 1 ? 's' : ''} (80% o más).`}
        </p>
      </motion.div>
    </motion.div>
  )
}

// ─── Chequeo de bienestar mensual ─────────────────────────────────────────────
// Clave para que el Asistente IA abra la conversación de apoyo con lo que escribió el padre
export const ARIA_APOYO_KEY = 'vanty_aria_apoyo'

function WellbeingSurvey({ childName, childId, parentId, onClose, onAria }: { childName: string; childId: string; parentId: string; onClose: () => void; onAria?: () => void }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const [answered, setAnswered] = useState<'bien' | 'regular' | 'dificil' | null>(null)
  const [selectedMood, setSelectedMood] = useState<'bien' | 'regular' | 'dificil' | null>(null)
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)
  const nombre = (childName || '').split(' ')[0] || (en ? 'your child' : 'tu peque')
  const options = [
    { Icon: Smile, mood: 'bien' as const, titulo: en ? 'Good' : 'Bien', sub: en ? 'With energy to keep going' : 'Con energía para seguir',
      tone: 'text-v-success', fondo: 'bg-v-success/10', ring: 'ring-v-success', cara: 'bg-v-success/15' },
    { Icon: Meh, mood: 'regular' as const, titulo: en ? 'So-so' : 'Regular', sub: en ? 'A bit tired' : 'Algo cansado/a',
      tone: 'text-v-warning', fondo: 'bg-v-warning/10', ring: 'ring-v-warning', cara: 'bg-v-warning/15' },
    { Icon: Frown, mood: 'dificil' as const, titulo: en ? 'Hard' : 'Difícil', sub: en ? 'I need more support' : 'Necesito más apoyo',
      tone: 'text-v-danger', fondo: 'bg-v-danger/10', ring: 'ring-v-danger', cara: 'bg-v-danger/10' },
  ]

  const persistir = async (mood: 'bien' | 'regular' | 'dificil', notaTexto?: string) => {
    if (!parentId || !childId) return
    setSaving(true)
    try {
      await fetch('/api/parent-wellbeing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: parentId, child_id: childId, mood, nota: notaTexto || null }),
      })
    } catch { /* silencioso: no romper la experiencia si falla */ }
    finally { setSaving(false) }
  }
  const terminar = (mood: 'bien' | 'regular' | 'dificil') => { setAnswered(mood); setTimeout(onClose, mood === 'dificil' ? 6000 : 3200) }
  const elegir = async (mood: 'bien' | 'regular' | 'dificil') => {
    setSelectedMood(mood)
    if (mood === 'dificil') return // espera la nota opcional
    await persistir(mood); terminar(mood)
  }

  const cierre = answered === 'bien'
    ? { Icon: Heart, tone: 'bg-v-success/15 text-v-success', t: en ? 'We love to hear that!' : '¡Qué bueno saberlo!', s: en ? `Your energy makes a difference for ${nombre}.` : `Tu energía hace la diferencia para ${nombre}.` }
    : answered === 'regular'
      ? { Icon: Heart, tone: 'bg-v-warning/15 text-v-warning', t: en ? 'Thanks for telling us' : 'Gracias por contarnos', s: en ? 'Remember to rest too; small breaks help the whole family.' : 'Recuerda descansar también; las pausas ayudan a toda la familia.' }
      : { Icon: Heart, tone: 'bg-v-accent-soft text-v-accent', t: en ? 'You are not alone' : 'No estás solo/a', s: en ? 'Your therapist will reach out. You can also write to the team now.' : 'Tu terapeuta se pondrá en contacto. También puedes escribirle al equipo ahora.' }

  return (
    <motion.div className="v-scope fixed inset-0 z-[9998] flex items-end justify-center bg-[#081426]/45 p-3 backdrop-blur-md sm:items-center sm:p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="bienestar-titulo"
        initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="w-full max-w-lg overflow-hidden rounded-v-lg border border-v-border bg-v-elevated shadow-v-lg">
        {/* Encabezado con ARIA */}
        <div className="relative overflow-hidden px-6 pb-5 pt-6" style={{ background: 'radial-gradient(28rem 12rem at 0% 0%, var(--v-glow-1), transparent 70%)' }}>
          <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
          <button onClick={onClose} aria-label={en ? 'Close' : 'Cerrar'} className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full bg-v-elevated/80 text-v-muted backdrop-blur transition-colors hover:bg-v-fill hover:text-v-text"><X size={16} /></button>
          <div className="flex items-end gap-4 pr-10">
            <motion.span initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 18 }}
              className="relative block h-24 w-20 shrink-0">
              <img src="/aria/poses/contenta.webp" alt="" draggable={false} className="absolute inset-0 size-full select-none object-contain" style={{ height: '100%' }} />
            </motion.span>
            <div className="min-w-0 pb-1">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-v-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-v-accent"><Heart size={11} /> {en ? 'Monthly check-in' : 'Chequeo mensual'}</p>
              <h3 id="bienestar-titulo" className="v-headline mt-2 text-[1.45rem] leading-tight text-v-text">{en ? 'How are you?' : '¿Cómo estás tú?'}</h3>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {!answered ? (
            <motion.div key="pregunta" exit={{ opacity: 0, y: -8 }} className="px-6 pb-6">
              <p className="text-sm leading-relaxed text-v-muted">
                {en ? <>Supporting <strong className="text-v-text">{nombre}</strong> is important work, and you matter too. How have you felt this week?</>
                    : <>Acompañar a <strong className="text-v-text">{nombre}</strong> es un trabajo importante, y tú también importas. ¿Cómo te has sentido esta semana?</>}
              </p>
              <div className="mt-4 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2.5">
                {options.map(({ Icon, mood, titulo, sub, tone, fondo, ring, cara }, i) => {
                  const on = selectedMood === mood
                  return (
                    <motion.button key={mood} type="button" onClick={() => elegir(mood)} disabled={saving}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.06, type: 'spring', stiffness: 260, damping: 22 }}
                      whileHover={{ y: -3 }} whileTap={{ scale: 0.96 }}
                      className={`flex flex-col items-center gap-2 rounded-v border px-2 py-4 text-center transition-colors disabled:opacity-60 ${on ? `border-transparent ${fondo} ring-2 ${ring}` : 'border-v-border hover:bg-v-fill'}`}>
                      <motion.span animate={on ? { scale: [1, 1.18, 1], rotate: [0, -8, 0] } : { scale: 1 }} transition={{ duration: 0.45 }}
                        className={`grid size-12 place-items-center rounded-full ${cara} ${tone}`}>
                        {saving && on ? <Loader2 size={22} className="animate-spin" /> : <Icon size={26} strokeWidth={2} />}
                      </motion.span>
                      <span className={`text-sm font-semibold ${tone}`}>{titulo}</span>
                      <span className="text-[11px] leading-snug text-v-muted">{sub}</span>
                    </motion.button>
                  )
                })}
              </div>

              <AnimatePresence>
                {selectedMood === 'dificil' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-5 flex items-start gap-2.5 rounded-v-sm bg-v-accent-soft/60 p-3">
                      <span className="relative block size-9 shrink-0 overflow-hidden rounded-full"><img src="/aria-avatar.webp" alt="" className="absolute inset-0 size-full object-cover" style={{ height: '100%' }} /></span>
                      <p className="text-sm leading-relaxed text-v-text">{en ? 'I’m here for you. Tell me what’s going on and we’ll talk it through together.' : 'Estoy aquí para ti. Cuéntame qué está pasando y lo conversamos juntos.'}</p>
                    </div>
                    <p className="mt-3 text-sm font-medium text-v-text">{en ? 'What is being hardest? (optional)' : '¿Qué está siendo lo más difícil? (opcional)'}</p>
                    <textarea value={nota} onChange={e => setNota(e.target.value)} rows={3} maxLength={500} autoFocus
                      placeholder={en ? 'Write it in your own words…' : 'Escríbelo con tus palabras…'}
                      className="mt-2 w-full resize-none rounded-v-sm border border-v-border bg-v-bg px-3.5 py-2.5 text-sm text-v-text outline-none placeholder:text-v-subtle focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft" />
                    <p className="mt-1 text-right text-[11px] tabular-nums text-v-subtle">{nota.length}/500</p>
                    <button onClick={async () => {
                        const texto = nota.trim()
                        await persistir('dificil', texto || undefined)
                        // ARIA abre la conversación de apoyo con lo que escribió el padre
                        const mensaje = texto
                          ? (en ? `This week is being hard for me and I need support. ${texto}` : `Esta semana está siendo difícil para mí y necesito apoyo. ${texto}`)
                          : (en ? 'This week is being hard for me and I need emotional support.' : 'Esta semana está siendo difícil para mí y necesito apoyo emocional.')
                        try { sessionStorage.setItem(ARIA_APOYO_KEY, mensaje) } catch { /* sin storage */ }
                        onClose(); onAria?.()
                      }} disabled={saving}
                      className="v-brand mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-60">
                      {saving ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />} {en ? 'Talk with ARIA' : 'Hablar con ARIA'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-v-border pt-4">
                <p className="flex items-center gap-1.5 text-[11px] text-v-subtle"><Lock size={11} /> {en ? 'Your answer is confidential' : 'Tu respuesta es confidencial'}</p>
                <button onClick={onClose} className="rounded-full px-3 py-1.5 text-xs font-semibold text-v-muted transition-colors hover:bg-v-fill hover:text-v-text">{en ? 'Not now' : 'Ahora no'}</button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="gracias" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="px-6 pb-7 text-center">
              <motion.span initial={{ scale: 0.4, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                className={`mx-auto grid size-14 place-items-center rounded-full ${cierre.tone}`}><cierre.Icon size={26} /></motion.span>
              <p className="mt-3 text-lg font-semibold text-v-text">{cierre.t}</p>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-v-muted">{cierre.s}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function HomeViewInnovative({ child, onChangeView, refreshTrigger, onCancelAppointment }: Props) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [nextAppt, setNextAppt] = useState<any>(null)
  const [stats, setStats] = useState({ sessions: 0, goalsAchieved: 0, hoursTotal: 0, monthSessions: 0, masteryRate: 0, totalGoals: 0 })
  const [loading, setLoading] = useState(true)
  const [parentMessages, setParentMessages] = useState<any[]>([])
  const [showCelebration, setShowCelebration] = useState(false)
  const [prevGoals, setPrevGoals] = useState(-1)
  const [showWellbeing, setShowWellbeing] = useState(false)
  // Racha de práctica en casa (días seguidos con actividad)
  const [racha, setRacha] = useState<{ dias: number; hoy: boolean; semana: { fecha: string; hecho: boolean }[] } | null>(null)
  useEffect(() => {
    if (!child?.id) return
    const d = new Date()
    const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    fetch(`/api/padre/racha?child_id=${child.id}&hoy=${hoy}`).then(r => r.ok ? r.json() : null).then(setRacha).catch(() => {})
  }, [child?.id, refreshTrigger])
  const [prediccion, setPrediccion] = useState<any>(null)
  const [programas, setProgramas] = useState<any[]>([])
  const [verTodosProg, setVerTodosProg] = useState(false)
  const [gcalConnected, setGcalConnected] = useState<boolean | null>(null)
  const [gcalBannerDismissed, setGcalBannerDismissed] = useState(false)

  useEffect(() => {
    try { if (sessionStorage.getItem('gcal_banner_dismissed')) { setGcalBannerDismissed(true); return } } catch { /* sin storage */ }
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.id) return
        const res = await fetch(`/api/google-calendar?action=status&userId=${session.user.id}`)
        const data = await res.json()
        setGcalConnected(!!data.connected)
      } catch { /* banner opcional */ }
    })()
  }, [])

  // Chequeo de bienestar: una vez al mes, a los 18 s de entrar
  useEffect(() => {
    if (!child?.id) return
    const key = `wellbeing_shown_${new Date().getFullYear()}_${new Date().getMonth()}`
    try { if (localStorage.getItem(key)) return } catch { return }
    const timer = setTimeout(() => { setShowWellbeing(true); try { localStorage.setItem(key, '1') } catch { /* */ } }, 18000)
    return () => clearTimeout(timer)
  }, [child?.id])

  const loadData = useCallback(async () => {
    if (!child?.id) return
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const [{ data: appts }, { data: completadas }, { data: msgs }, { data: parentMsgs }, { data: pred }] = await Promise.all([
      supabase.from('appointments').select('*').eq('child_id', child.id).gte('appointment_date', today).neq('status', 'cancelled').neq('status', 'completed')
        .order('appointment_date', { ascending: true }).order('appointment_time', { ascending: true }).limit(1),
      supabase.from('appointments').select('id, appointment_date').eq('child_id', child.id).in('status', ['completed', 'realizada', 'completada']),
      child.parent_id
        ? supabase.from('notifications').select('*').eq('user_id', child.parent_id).eq('is_read', false).order('created_at', { ascending: false }).limit(5)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('parent_messages').select('*').eq('child_id', child.id).order('created_at', { ascending: false }).limit(5).then((r: any) => (r.error ? { data: [] } : r)),
      supabase.from('predicciones_ia').select('*').eq('child_id', child.id).maybeSingle(),
    ])
    setNextAppt(appts?.[0] || null)
    setParentMessages([...(msgs || []), ...(parentMsgs || [])].slice(0, 4))
    setPrediccion(pred || null)

    // Estadísticas con la API (usa service_role: objetivos y sesiones tienen RLS estricta)
    let api: any = null
    try {
      const res = await fetch(`/api/padre/stats?child_id=${child.id}`, { cache: 'no-store' })
      if (res.ok) api = await res.json()
    } catch { /* se muestran ceros */ }

    const totalSess = api?.totalSesiones > 0 ? api.totalSesiones : (completadas?.length || 0)
    const achieved = api?.goalsAchieved ?? 0
    setProgramas((api?.programas || []).filter((p: any) => p.estado !== 'dominado' && p.fase_actual !== 'dominado'))
    setPrevGoals(prev => {
      if (prev !== -1 && achieved > prev && achieved > 0) setShowCelebration(true)
      return achieved
    })
    const mes = today.slice(0, 7)
    setStats({
      sessions: totalSess,
      goalsAchieved: achieved,
      totalGoals: api?.totalGoals ?? 0,
      masteryRate: api?.masteryRate ?? 0,
      hoursTotal: api?.hoursTotal ?? 0,
      monthSessions: (completadas || []).filter((a: any) => (a.appointment_date || '').startsWith(mes)).length,
    })
    setLoading(false)
  }, [child?.id, child?.parent_id])

  useEffect(() => { loadData() }, [loadData, refreshTrigger])

  const age = child ? calcAge(child.birth_date) : 0
  const firstName = child?.name?.split(' ')[0] || L('your child', 'tu hijo/a')
  const ahora = new Date()
  const h = ahora.getHours()
  const saludo = h < 12 ? L('Good morning', 'Buenos días') : h < 19 ? L('Good afternoon', 'Buenas tardes') : L('Good evening', 'Buenas noches')
  const diaStr = ahora.toLocaleDateString(toBCP47(locale), { weekday: 'long', day: 'numeric', month: 'long' })
  const textoPrediccion = prediccion?.prediccion_30d ||
    (prediccion?.analisis_ia as string | undefined)?.split('\n\n')
      .find((b: string) => b.trim() && !/^\*\*[^*]+\*\*$/.test(b.trim()))
      ?.replace(/\*\*(.*?)\*\*/g, '$1').trim()
  const progVisibles = verTodosProg ? programas : programas.slice(0, 5)
  // Nombres y áreas los escribe el equipo (en español): se traducen si la app está en inglés
  const tr = useTraducir(programas.flatMap((p: any) => [p.nombre || p.titulo, p.area]))
  // Cuántas tarjetas opcionales hay: si el total es impar, la última ocupa todo el ancho
  const hayResumen = !loading && !!textoPrediccion
  const hayMensajes = parentMessages.length > 0
  const extras = (hayResumen ? 1 : 0) + (hayMensajes ? 1 : 0)
  const ancho = 'lg:col-span-2'
  const estadoProg = (e: string) => {
    const k = (e || 'activo').toLowerCase()
    if (k === 'completado') return { txt: L('Completed', 'Completado'), tone: 'bg-v-success/15 text-v-success' }
    if (k.startsWith('interven')) return { txt: L('In intervention', 'En intervención'), tone: 'bg-v-warning/15 text-v-warning' }
    return { txt: L('In progress', 'En curso'), tone: 'bg-v-accent-soft text-v-accent' }
  }
  const acciones = [
    { Icon: Sparkles, label: L('Ask ARIA', 'Preguntar a ARIA'), view: 'chat' },
    { Icon: Heart, label: L('Practice at home', 'Practicar en casa'), view: 'engagement' },
    { Icon: CalendarDays, label: L('My appointments', 'Mis citas'), view: 'miscitas' },
  ]

  return (
    <div className="v-scope space-y-4 pb-6 md:space-y-5">
      <AnimatePresence>
        {showCelebration && <GoalCelebration childName={child?.name || firstName} goalsAchieved={stats.goalsAchieved} onClose={() => setShowCelebration(false)} />}
        {showWellbeing && child?.id && child?.parent_id && (
          <WellbeingSurvey childName={child.name} childId={child.id} parentId={child.parent_id} onClose={() => setShowWellbeing(false)} onAria={() => onChangeView('chat')} />
        )}
      </AnimatePresence>

      {/* ── Google Calendar ── */}
      <AnimatePresence>
        {gcalConnected === false && !gcalBannerDismissed && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className={`relative overflow-hidden ${cardClass} flex items-center gap-3.5 py-3 pl-3 pr-2 sm:pl-4`}>
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(26rem 8rem at 0% 50%, var(--v-glow-1), transparent 70%)' }} />
            {/* Mini calendario con el día de hoy */}
            <div aria-hidden className="relative w-11 shrink-0 overflow-hidden rounded-[12px] border border-v-border bg-v-elevated text-center shadow-v">
              <p className="v-brand py-0.5 text-[9px] font-bold uppercase tracking-wider">{new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', { month: 'short' }).replace('.', '')}</p>
              <p className="py-0.5 text-lg font-bold leading-tight text-v-text">{new Date().getDate()}</p>
            </div>
            <div className="relative min-w-0 flex-1">
              <p className="text-sm font-semibold text-v-text" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {L('Sync your appointments with Google Calendar', 'Sincroniza tus citas con Google Calendar')}
              </p>
              <p className="text-xs text-v-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {L('They will appear on your phone with automatic reminders.', 'Aparecerán en tu celular con recordatorios automáticos.')}
              </p>
            </div>
            <button onClick={() => onChangeView('miscitas')} className="v-brand relative inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-4 text-xs font-semibold">
              {L('Connect', 'Conectar')} <ChevronRight size={14} className="hidden sm:block" />
            </button>
            <button onClick={() => { try { sessionStorage.setItem('gcal_banner_dismissed', '1') } catch { /* */ } setGcalBannerDismissed(true) }}
              aria-label={L('Close', 'Cerrar')} className="relative grid size-8 shrink-0 place-items-center rounded-full text-v-muted hover:bg-v-fill"><X size={15} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HERO ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }}
        className={`relative overflow-hidden ${cardClass}`}>
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(40rem 14rem at 0% 0%, var(--v-glow-1), transparent 70%)' }} />
        <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
        <div className="relative flex items-center gap-5 p-5 sm:p-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-v-muted first-letter:uppercase">{saludo} · {diaStr}</p>
            <h2 className="v-headline mt-1 text-[1.6rem] leading-tight text-v-text sm:text-[1.9rem]">
              {L('This is how ', 'Así va ')}<span className="v-brand-text">{firstName}</span>{L(' is doing', '')}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {racha && (
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => onChangeView('engagement')}
                  title={racha.dias ? L('Days in a row practicing at home', 'Días seguidos practicando en casa') : L('Practice today to start a streak', 'Practica hoy para empezar una racha')}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${racha.dias ? 'bg-v-warning/15 text-v-warning' : 'bg-v-fill text-v-muted'}`}>
                  <motion.span animate={racha.hoy ? { scale: [1, 1.25, 1] } : {}} transition={{ duration: 0.6, delay: 0.4 }} className="inline-flex">
                    <Flame size={13} fill={racha.dias ? 'currentColor' : 'none'} />
                  </motion.span>
                  {racha.dias
                    ? L(`${racha.dias}-day streak`, `Racha de ${racha.dias} día${racha.dias === 1 ? '' : 's'}`)
                    : L('Start your streak', 'Empieza tu racha')}
                  <span className="flex gap-0.5" aria-hidden>
                    {racha.semana.map(d => <span key={d.fecha} className={`size-1.5 rounded-full ${d.hecho ? 'bg-v-warning' : 'bg-current opacity-25'}`} />)}
                  </span>
                </motion.button>
              )}
              <span className="rounded-full bg-v-fill px-3 py-1 text-xs font-semibold text-v-muted">{age} {L(age === 1 ? 'year' : 'years', age === 1 ? 'año' : 'años')}</span>
              {child?.diagnosis && <span className="rounded-full bg-v-fill px-3 py-1 text-xs font-semibold text-v-muted">{child.diagnosis}</span>}
              {stats.sessions > 0 ? (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${CONCEPT.sesiones.tone}`}>
                  <CalendarCheck size={12} /> {stats.sessions} {L(stats.sessions === 1 ? 'session done' : 'sessions done', stats.sessions === 1 ? 'sesión realizada' : 'sesiones realizadas')}
                </span>
              ) : (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${CONCEPT.citas.tone}`}>
                  <CalendarDays size={12} /> {nextAppt ? L('Starting soon', 'Empieza pronto') : L('No sessions yet', 'Aún sin sesiones')}
                </span>
              )}
            </div>
          </div>
          <div className="hidden flex-col items-center gap-1 sm:flex">
            <Ring pct={stats.masteryRate} />
            <p className="text-[11px] font-medium text-v-subtle">{L('Goal mastery', 'Dominio')}</p>
          </div>
        </div>
        <div className="relative flex gap-2 overflow-x-auto border-t border-v-border px-5 py-3 sm:px-6" style={{ scrollbarWidth: 'none' }}>
          {acciones.map(({ Icon, label, view }) => (
            <motion.button key={view} whileTap={{ scale: 0.96 }} onClick={() => onChangeView(view)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-v-fill px-3.5 py-2 text-xs font-semibold text-v-text transition-colors hover:bg-v-accent-soft hover:text-v-accent">
              <Icon size={14} /> {label}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <KPI index={0} concept="sesiones" label={L('Sessions', 'Sesiones')} value={loading ? null : stats.sessions}
          sub={stats.monthSessions > 0 ? L(`+${stats.monthSessions} this month`, `+${stats.monthSessions} este mes`) : stats.sessions === 0 ? L('None yet', 'Aún ninguna') : L('Done so far', 'Realizadas hasta hoy')}
          onClick={() => onChangeView('miscitas')} />
        <KPI index={1} concept="objetivos" label={L('Goals achieved', 'Objetivos logrados')} value={loading ? null : stats.goalsAchieved}
          sub={stats.totalGoals ? L(`of ${stats.totalGoals} · mastery ≥80%`, `de ${stats.totalGoals} · dominio ≥80%`) : L('Mastery ≥80%', 'Dominio ≥80%')}
          onClick={() => onChangeView('programas')} />
        <KPI index={2} concept="horas" label={L('Therapy hours', 'Horas de terapia')} value={loading || stats.hoursTotal <= 0 ? null : stats.hoursTotal} sufijo="h"
          sub={stats.hoursTotal > 0 ? L(`~${Math.round(stats.hoursTotal / Math.max(stats.sessions, 1) * 10) / 10}h per session`, `~${Math.round(stats.hoursTotal / Math.max(stats.sessions, 1) * 10) / 10}h por sesión`) : L('When there are sessions', 'Cuando haya sesiones')} />
        <KPI index={3} concept="dominio" label={L('Mastery', 'Dominio')} value={loading ? null : stats.masteryRate} sufijo="%"
          sub={L('Average of goals', 'Promedio de objetivos')} onClick={() => onChangeView('programas')} />
      </div>

      {/* ── Tarjetas por filas: cada fila empareja dos tarjetas de la misma altura ── */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        {/* Próxima sesión */}
        <Section index={5}>
          <SectionHeader concept="citas" title={L('Next session', 'Próxima sesión')}>
            <button onClick={() => onChangeView('miscitas')} className="inline-flex items-center gap-1 text-xs font-semibold text-v-accent hover:underline">{L('See all', 'Ver todas')} <ArrowRight size={12} /></button>
          </SectionHeader>
          {loading ? (
            <div className="px-5 pb-5"><div className="h-20 animate-pulse rounded-v-sm bg-v-fill" /></div>
          ) : nextAppt ? (() => {
            const [y, m, d] = String(nextAppt.appointment_date).split('-').map(Number)
            const fecha = new Date(y, m - 1, d)
            const confirmada = nextAppt.status === 'confirmed'
            const repro = nextAppt.metadata?.reprogramacion?.estado === 'solicitada' ? nextAppt.metadata.reprogramacion : null
            return (
              <div className="px-5 pb-5">
                <div className="flex items-center gap-4 rounded-v-sm bg-v-fill p-4">
                  <div className="v-brand grid w-16 shrink-0 place-items-center rounded-v-sm py-2.5 text-center">
                    <p className="text-2xl font-bold leading-none tabular-nums">{d}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase opacity-85">{fecha.toLocaleDateString(toBCP47(locale), { month: 'short' }).replace('.', '')}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${confirmada ? 'bg-v-success/15 text-v-success' : 'bg-v-warning/15 text-v-warning'}`}>
                      {confirmada ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />} {confirmada ? L('Confirmed', 'Confirmada') : L('Pending confirmation', 'Por confirmar')}
                    </span>
                    <p className="mt-1 truncate text-[15px] font-semibold text-v-text">{nextAppt.service_type || L('ABA therapy', 'Terapia ABA')}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-v-muted first-letter:uppercase">
                      <Clock size={12} /> {fecha.toLocaleDateString(toBCP47(locale), { weekday: 'long' })} · {formatTime(nextAppt.appointment_time)}
                    </p>
                  </div>
                </div>
                {repro ? (
                  <p className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-v-accent-soft px-3 py-2 text-xs font-semibold text-v-accent">
                    <RefreshCw size={12} /> {L('Change requested for', 'Cambio solicitado para el')} {repro.fecha}{repro.hora ? ` · ${repro.hora}` : ''}
                  </p>
                ) : (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => onCancelAppointment(nextAppt, true)} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-v-accent-soft text-xs font-semibold text-v-accent transition-transform active:scale-95">
                    <RefreshCw size={13} /> {L('Reschedule', 'Reprogramar')}
                  </button>
                  <button onClick={() => onCancelAppointment(nextAppt, false)} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-v-danger/10 text-xs font-semibold text-v-danger transition-transform active:scale-95">
                    <XCircle size={13} /> {L('Cancel', 'Cancelar')}
                  </button>
                </div>
                )}
              </div>
            )
          })() : (
            <EmptyState icon={CalendarDays} title={L('No appointments scheduled', 'No hay citas programadas')}
              text={L('Consistency is key. Contact the center to book the next one.', 'La constancia es clave. Contacta al centro para agendar la próxima.')}
              action={L('See my appointments', 'Ver mis citas')} onAction={() => onChangeView('miscitas')} />
          )}
        </Section>

        {/* ¿En qué está trabajando? */}
        <Section index={5}>
          <SectionHeader concept="programas" title={L(`What is ${firstName} working on?`, `¿En qué está trabajando ${firstName}?`)}
            badge={programas.length > 0 ? <span className="rounded-full bg-v-accent-soft px-2 py-0.5 text-[10px] font-bold text-v-accent">{programas.length}</span> : undefined} />
          {programas.length > 0 ? (
            <>
              <ul className="space-y-1 px-3">
                {progVisibles.map((prog: any, i: number) => {
                  const AIcon = AREA_ICON[(prog.area || '').toLowerCase()] || Lightbulb
                  const est = estadoProg(prog.estado)
                  return (
                    <motion.li key={prog.id || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i }}>
                      <button onClick={() => onChangeView('programas')}
                        className="group flex w-full items-center gap-3 rounded-v-sm px-2.5 py-2.5 text-left transition-colors hover:bg-v-fill">
                        <span className="grid size-9 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><AIcon size={16} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-v-text">{tr(prog.nombre || prog.titulo) || L('Program', 'Programa')}</span>
                          {prog.area && <span className="block truncate text-xs text-v-subtle">{tr(prog.area)}</span>}
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${est.tone}`}>{est.txt}</span>
                        <ChevronRight size={15} className="shrink-0 text-v-subtle transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </motion.li>
                  )
                })}
              </ul>
              <div className="mt-auto flex flex-col gap-2 p-4 pt-2 sm:flex-row">
                {programas.length > 5 && (
                  <button onClick={() => setVerTodosProg(v => !v)} className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-full bg-v-fill text-xs sm:w-auto sm:flex-1 font-semibold text-v-text hover:bg-v-accent-soft hover:text-v-accent">
                    {verTodosProg ? L('Show less', 'Ver menos') : L(`See all ${programas.length}`, `Ver los ${programas.length}`)}
                  </button>
                )}
                <button onClick={() => onChangeView('chat')} className="inline-flex h-10 w-full shrink-0 px-4 sm:w-auto sm:flex-1 items-center justify-center gap-1.5 rounded-full bg-v-accent-soft text-xs font-semibold text-v-accent transition-transform active:scale-95">
                  <Sparkles size={13} /> {L('Ask ARIA how to practice them', 'Pregúntale a ARIA cómo practicarlos')}
                </button>
              </div>
            </>
          ) : (
            <EmptyState icon={Target} text={loading ? L('Loading…', 'Cargando…') : L('The team has not assigned programs yet.', 'El equipo aún no asignó programas.')} />
          )}
        </Section>

        {/* Progreso general */}
        <Section index={6} className={extras === 0 ? ancho : ''}>
          <SectionHeader concept="progreso" title={L('Overall progress', 'Progreso general')}>
            {stats.goalsAchieved > 0 && (
              <button onClick={() => setShowCelebration(true)} className="inline-flex items-center gap-1 rounded-full bg-v-success/15 px-2.5 py-1 text-[11px] font-semibold text-v-success transition-transform hover:scale-105">
                <Trophy size={12} /> {L('See achievement', 'Ver logro')}
              </button>
            )}
          </SectionHeader>
          {stats.sessions === 0 ? (
            <EmptyState icon={TrendingUp} title={L('Progress will show here', 'El progreso aparecerá aquí')}
              text={L('After the first sessions you will see advances and achieved goals.', 'Después de las primeras sesiones verás los avances y objetivos logrados.')} />
          ) : (
            <div className={`space-y-4 px-5 pb-5 ${extras === 0 ? 'lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0' : ''}`}>
              <Barra label={L('Goal mastery', 'Dominio de objetivos')} value={stats.masteryRate} tone="bg-v-success" />
              <Barra label={L('Attendance this month', 'Asistencia este mes')} value={Math.min(100, stats.monthSessions * 25)} tone="v-brand" />
              <Barra label={L('Therapy hours (goal 20h)', 'Horas de terapia (meta 20 h)')} value={Math.min(100, Math.round(stats.hoursTotal / 20 * 100))} tone="bg-v-warning" />
              {stats.masteryRate >= 80 && (
                <div className="flex items-start gap-3 rounded-v-sm bg-v-success/10 p-3.5 lg:col-span-3">
                  <Trophy size={17} className="mt-0.5 shrink-0 text-v-success" />
                  <p className="text-xs leading-relaxed text-v-text">
                    <strong className="text-v-success">{L('Outstanding performance.', 'Rendimiento excepcional.')}</strong>{' '}
                    {L(`${firstName} masters goals with ${stats.masteryRate}% success.`, `${firstName} domina sus objetivos con ${stats.masteryRate}% de éxito.`)}
                  </p>
                </div>
              )}
            </div>
          )}
        </Section>
        {/* Resumen de ARIA */}
        {hayResumen && (
          <Section index={7}>
            <SectionHeader concept="aria" title={L(`How is ${firstName} doing?`, `¿Cómo va ${firstName}?`)}
              badge={prediccion?.confianza > 0 ? <span className="rounded-full bg-v-accent-soft px-2 py-0.5 text-[10px] font-bold text-v-accent">{prediccion.confianza}% {L('confidence', 'confianza')}</span> : undefined} />
            <div className="px-5 pb-5">
              <p className="text-sm leading-relaxed text-v-text">{textoPrediccion}</p>
              {prediccion?.areas_fortaleza?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {prediccion.areas_fortaleza.slice(0, 3).map((a: string, i: number) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-v-success/15 px-2.5 py-1 text-[11px] font-semibold text-v-success"><CheckCircle2 size={11} /> {a}</span>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] text-v-subtle">{L('Summary by ARIA, the center’s assistant', 'Resumen de ARIA, la asistente del centro')}</p>
            </div>
          </Section>
        )}

        {/* Mensajes del terapeuta */}
        {hayMensajes && (
          <Section index={8} className={extras === 2 ? ancho : ''}>
            <SectionHeader concept="mensajes" title={L('Messages from the team', 'Mensajes del equipo')}
              badge={<span className="rounded-full bg-v-accent-soft px-2 py-0.5 text-[10px] font-bold text-v-accent">{parentMessages.length}</span>} />
            <ul className="divide-y divide-v-border px-5">
              {parentMessages.map((msg: any, i: number) => (
                <li key={msg.id || i} className="py-3">
                  <p className="text-[11px] text-v-subtle">{msg.created_at ? new Date(msg.created_at).toLocaleDateString(toBCP47(locale), { dateStyle: 'medium' }) : ''}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-v-text">{msg.title || msg.subject || msg.source_title || L('Message from your therapist', 'Mensaje de tu terapeuta')}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-v-muted">{msg.body || msg.message || msg.content || msg.ai_message || ''}</p>
                </li>
              ))}
            </ul>
            <div className="p-4 pt-2">
              <button onClick={() => onChangeView('chat-familias')} className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-v-fill text-xs font-semibold text-v-text transition-colors hover:bg-v-accent-soft hover:text-v-accent">
                <MessageCircle size={13} /> {L('Open chat', 'Abrir chat')}
              </button>
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
