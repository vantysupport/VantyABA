'use client'
// app/padre/components/ForestTimer.tsx
// "Modo Bosque" — temporizador de práctica inspirado en Forest: mientras practican, crece un árbol.
// Una sola escena 3D por vista (Tree3D, cargada solo en el navegador); las miniaturas del
// selector de especies son ilustraciones SVG para no abrir varios contextos WebGL a la vez.

import { useState, useEffect, useRef } from 'react'
import { useI18n } from '@/lib/i18n-context'
import dynamic from 'next/dynamic'
import { AnimatePresence, animate, motion } from 'motion/react'
import {
  Play, Pause, X, RotateCcw, Minus, Plus, Trees, Sprout, BarChart3, Flame, Clock, Trophy, Target, Leaf,
} from 'lucide-react'
import { confirmar } from '@/components/ui/confirmar'

const cargando = () => <div className="size-full animate-pulse rounded-full bg-white/10" />
const SingleTree3D = dynamic(() => import('./Tree3D').then(m => m.SingleTree3D), { ssr: false, loading: cargando })
const Forest3D = dynamic(() => import('./Tree3D').then(m => m.Forest3D), { ssr: false, loading: cargando })

type Phase = 'idle' | 'running' | 'paused' | 'done'
type Species = 'pino' | 'manzano' | 'cerezo' | 'roble'
type LogItem = { t: number; dur: number; sp: Species; ok: boolean }

const DURACIONES = [5, 10, 15, 20, 30]
const SPECIES: { id: Species; es: string; en: string }[] = [
  { id: 'pino', es: 'Pino', en: 'Pine' },
  { id: 'manzano', es: 'Manzano', en: 'Apple' },
  { id: 'cerezo', es: 'Cerezo', en: 'Cherry' },
  { id: 'roble', es: 'Roble', en: 'Oak' },
]
const cardClass = 'rounded-v border border-v-border bg-v-elevated shadow-v'

// ── Persistencia (por niño, en este equipo) ────────────────────────────────────
const lsLog = (c: string) => `forest_log_${c}`
const lsSpecies = (c: string) => `forest_species_${c}`
function loadLog(c: string): LogItem[] { try { return JSON.parse(localStorage.getItem(lsLog(c)) || '[]') } catch { return [] } }
function saveLog(c: string, log: LogItem[]) { try { localStorage.setItem(lsLog(c), JSON.stringify(log.slice(-500))) } catch { /* sin storage */ } }
const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }
const fmt = (secs: number) => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`

// ── Miniaturas SVG de cada especie ─────────────────────────────────────────────
function MiniArbol({ sp }: { sp: Species }) {
  const tronco = <rect x="28" y="42" width="8" height="14" rx="2" fill="#7a5230" />
  const suelo = <ellipse cx="32" cy="57" rx="18" ry="3.5" fill="#000" opacity=".12" />
  return (
    <svg viewBox="0 0 64 64" className="size-full">
      {suelo}{tronco}
      {sp === 'pino' && <>
        <path d="M32 6 L48 30 H16 Z" fill="#4e9d52" /><path d="M32 16 L51 42 H13 Z" fill="#3f8a47" /><path d="M32 6 L40 18 H24 Z" fill="#62b066" />
      </>}
      {sp === 'manzano' && <>
        <circle cx="32" cy="26" r="17" fill="#6cc24a" /><circle cx="22" cy="31" r="10" fill="#5bb23c" /><circle cx="42" cy="31" r="10" fill="#5bb23c" />
        {[[24, 22], [38, 20], [30, 33], [42, 33], [20, 32]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.8" fill="#e23a2f" />)}
      </>}
      {sp === 'cerezo' && <>
        <circle cx="32" cy="26" r="17" fill="#f9a8d4" /><circle cx="22" cy="31" r="10" fill="#f472b6" /><circle cx="42" cy="31" r="10" fill="#fbcfe8" />
        {[[25, 21], [37, 22], [31, 31], [41, 33], [21, 33], [33, 15]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.2" fill="#fff5fb" />)}
      </>}
      {sp === 'roble' && <>
        <ellipse cx="32" cy="28" rx="22" ry="15" fill="#7cab46" /><ellipse cx="22" cy="24" rx="11" ry="9" fill="#8bbb52" /><ellipse cx="42" cy="25" rx="11" ry="9" fill="#6f9d3e" />
      </>}
    </svg>
  )
}

function CountUp({ value }: { value: number }) {
  const [v, setV] = useState(0)
  useEffect(() => { const c = animate(0, value, { duration: 1, ease: [0.22, 1, 0.36, 1], onUpdate: x => setV(Math.round(x)) }); return () => c.stop() }, [value])
  return <>{v}</>
}

// ══════════════════════════════════════════════════════════════════════════════
export default function ForestTimer({ childId }: { childId: string }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [view, setView] = useState<'plantar' | 'bosque' | 'stats'>('plantar')
  const [phase, setPhase] = useState<Phase>('idle')
  const [species, setSpecies] = useState<Species>('pino')
  const [durStr, setDurStr] = useState('10')
  const [secStr, setSecStr] = useState('00')
  const durMin = Math.min(180, Math.max(0, parseInt(durStr || '0', 10) || 0))
  const durSec = Math.min(59, Math.max(0, parseInt(secStr || '0', 10) || 0))
  const totalSecs = durMin * 60 + durSec
  const [remaining, setRemaining] = useState(600)
  const [total, setTotal] = useState(600)
  const [log, setLog] = useState<LogItem[]>([])
  const [bosqueFiltro, setBosqueFiltro] = useState<'hoy' | 'semana' | 'todo'>('todo')
  const endsAtRef = useRef(0)
  const wakeRef = useRef<any>(null)

  useEffect(() => {
    setLog(loadLog(childId))
    try { const sp = localStorage.getItem(lsSpecies(childId)) as Species | null; if (sp && SPECIES.some(s => s.id === sp)) setSpecies(sp) } catch { /* */ }
  }, [childId])

  const addLog = (item: LogItem) => setLog(prev => { const next = [...prev, item]; saveLog(childId, next); return next })
  const pickSpecies = (sp: Species) => { setSpecies(sp); try { localStorage.setItem(lsSpecies(childId), sp) } catch { /* */ } }

  // Mantener la pantalla encendida mientras el árbol crece (si el navegador lo permite)
  useEffect(() => {
    if (phase !== 'running') { wakeRef.current?.release?.().catch?.(() => {}); wakeRef.current = null; return }
    (navigator as any).wakeLock?.request?.('screen').then((l: any) => { wakeRef.current = l }).catch(() => {})
  }, [phase])

  // Tick con marcas de tiempo (exacto aunque el teléfono se bloquee)
  useEffect(() => {
    if (phase !== 'running') return
    const iv = setInterval(() => {
      const left = Math.max(0, Math.round((endsAtRef.current - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        setPhase('done')
        addLog({ t: Date.now(), dur: total, sp: species, ok: true })
        try { navigator.vibrate?.([120, 60, 120]) } catch { /* */ }
      }
    }, 500)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, childId, species, total])

  const start = () => {
    if (totalSecs < 1) return
    setTotal(totalSecs); setRemaining(totalSecs)
    endsAtRef.current = Date.now() + totalSecs * 1000
    setPhase('running')
  }
  const pause = () => setPhase('paused')
  const resume = () => { endsAtRef.current = Date.now() + remaining * 1000; setPhase('running') }
  const giveUp = async () => {
    if (!(await confirmar(L('If you give up, the tree withers. Give up?', 'Si se rinden, el árbol se marchita. ¿Rendirse?'), { confirmar: L('Give up', 'Rendirse'), peligro: true }))) return
    const elapsed = total - remaining
    if (elapsed >= 30) addLog({ t: Date.now(), dur: elapsed, sp: species, ok: false })
    setPhase('idle'); setRemaining(totalSecs); setTotal(totalSecs)
  }
  const reset = () => { setPhase('idle'); setRemaining(totalSecs); setTotal(totalSecs) }
  const setDuracion = (secs: number) => { setDurStr(String(Math.floor(secs / 60))); setSecStr(String(secs % 60).padStart(2, '0')) }

  const g = phase === 'idle' ? 0 : phase === 'done' ? 1 : Math.min(1, Math.max(0, 1 - remaining / total))
  const heroGrow = phase === 'idle' || phase === 'done' ? 1 : g
  const heroAnimate = phase !== 'paused' // en pausa la escena se congela; si no, gira y respira
  const nombreSp = (sp: Species) => { const s = SPECIES.find(x => x.id === sp)!; return en ? s.en : s.es }

  const frase = phase === 'idle' ? L('Plant a tree while you practice together', 'Planten un árbol mientras practican juntos')
    : phase === 'paused' ? L('The little tree is waiting…', 'El arbolito los espera…')
    : phase === 'done' ? L('You did it!', '¡Lo lograron!')
    : g < 0.3 ? L('The seed is planted!', '¡Acaban de plantar la semilla!')
    : g < 0.65 ? L('The little tree trusts you', 'El arbolito confía en ustedes')
    : L('Almost there! Don’t give up', '¡Ya casi! No se rindan')

  // ── Datos para Mi bosque / Estadísticas ──
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
  const filtered = [...log].reverse().filter(it => bosqueFiltro === 'todo' ? true : bosqueFiltro === 'hoy' ? it.t >= startOfDay.getTime() : it.t >= Date.now() - 7 * 86400_000)
  const oks = log.filter(l => l.ok)
  const totalMin = Math.round(oks.reduce((a, l) => a + l.dur, 0) / 60)
  const exito = log.length ? Math.round((oks.length / log.length) * 100) : 0
  const streak = (() => { const days = new Set(oks.map(l => dayKey(l.t))); let n = 0; const d = new Date(); while (days.has(dayKey(d.getTime()))) { n++; d.setDate(d.getDate() - 1) } return n })()
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0)
    const end = d.getTime() + 86400_000
    return {
      label: d.toLocaleDateString(en ? 'en-US' : 'es-PE', { weekday: 'short' }).replace('.', '').slice(0, 3),
      mins: Math.round(oks.filter(l => l.t >= d.getTime() && l.t < end).reduce((a, l) => a + l.dur, 0) / 60),
      today: i === 6,
    }
  })
  const maxBar = Math.max(10, ...last7.map(b => b.mins))
  const r = 47, circ = 2 * Math.PI * r

  const tabs = [
    { id: 'plantar' as const, label: L('Plant', 'Plantar'), Icon: Sprout },
    { id: 'bosque' as const, label: L('My forest', 'Mi bosque'), Icon: Trees },
    { id: 'stats' as const, label: L('Stats', 'Estadísticas'), Icon: BarChart3 },
  ]

  return (
    <div className="v-scope space-y-4">
      {/* Pestañas internas */}
      <div className="mx-auto flex max-w-md rounded-full bg-v-fill p-1">
        {tabs.map(({ id, label, Icon }) => {
          const on = view === id
          return (
            <button key={id} onClick={() => setView(id)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-colors ${on ? 'text-v-success' : 'text-v-muted hover:text-v-text'}`}>
              {on && <motion.span layoutId="bosque-tab" transition={{ type: 'spring', stiffness: 400, damping: 32 }} className="absolute inset-0 rounded-full bg-v-elevated shadow-v" />}
              <Icon size={14} className="relative" /> <span className="relative">{label}</span>
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {/* ══ PLANTAR ══ */}
        {view === 'plantar' && (
          <motion.div key="plantar" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
            className={`${cardClass} grid overflow-hidden md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]`}>
            {/* Escena */}
            <div className="relative flex flex-col items-center justify-center overflow-hidden px-5 pb-6 pt-7"
              style={{ background: 'linear-gradient(180deg,#cfeee0 0%,#a9dcc0 55%,#7cc39b 100%)' }}>
              <motion.span className="pointer-events-none absolute left-[12%] top-8 h-6 w-16 rounded-full bg-white/60 blur-[1px]" animate={{ x: [0, 18, 0] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
              <motion.span className="pointer-events-none absolute right-[14%] top-16 h-5 w-12 rounded-full bg-white/50 blur-[1px]" animate={{ x: [0, -14, 0] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }} />
              <AnimatePresence mode="wait">
                <motion.p key={frase} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="relative text-center text-sm font-semibold text-emerald-950/80">{frase}</motion.p>
              </AnimatePresence>
              <div className="relative mt-3 aspect-square w-full max-w-[290px]">
                {/* Anillo de progreso alrededor del árbol */}
                <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full -rotate-90">
                  <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="2.2" />
                  {phase !== 'idle' && (
                    <motion.circle cx="50" cy="50" r={r} fill="none" stroke={phase === 'done' ? '#15803d' : '#ffffff'} strokeWidth="2.6" strokeLinecap="round"
                      strokeDasharray={circ} animate={{ strokeDashoffset: circ * (1 - g) }} transition={{ ease: 'linear', duration: 0.5 }} />
                  )}
                </svg>
                <motion.div className="absolute inset-[6%]" animate={phase === 'done' ? { scale: [0.9, 1.06, 1] } : { scale: 1 }} transition={{ duration: 0.7 }}>
                  <SingleTree3D species={species} grow={heroGrow} done={phase === 'done'} animate={heroAnimate} />
                </motion.div>
              </div>
              <p className={`relative mt-2 font-bold tabular-nums tracking-wide text-emerald-950 ${phase === 'idle' ? 'text-3xl opacity-70' : 'text-5xl'}`}>
                {fmt(phase === 'idle' ? totalSecs : remaining)}
              </p>
              {phase === 'running' && <p className="relative mt-1 text-xs font-medium text-emerald-950/60">{L('If you give up, the tree withers', 'Si se rinden, el árbol se marchita')}</p>}
            </div>

            {/* Controles */}
            <div className="flex flex-col gap-5 p-5 sm:p-6">
              {phase === 'idle' ? (
                <>
                  <div>
                    <p className="text-[15px] font-semibold tracking-tight text-v-text">{L('Choose your tree', 'Elige su árbol')}</p>
                    <div className="mt-3 grid grid-cols-[repeat(4,minmax(0,1fr))] gap-2">
                      {SPECIES.map(s => {
                        const on = species === s.id
                        return (
                          <motion.button key={s.id} whileTap={{ scale: 0.95 }} onClick={() => pickSpecies(s.id)}
                            className={`relative flex flex-col items-center gap-1 rounded-v-sm border p-2 transition-colors ${on ? 'border-transparent bg-v-success/10' : 'border-v-border hover:bg-v-fill'}`}>
                            {on && <motion.span layoutId="bosque-especie" transition={{ type: 'spring', stiffness: 420, damping: 32 }} className="absolute inset-0 rounded-v-sm ring-2 ring-v-success" />}
                            <span className="relative size-12"><MiniArbol sp={s.id} /></span>
                            <span className={`relative text-[11px] font-semibold ${on ? 'text-v-success' : 'text-v-muted'}`}>{en ? s.en : s.es}</span>
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-[15px] font-semibold tracking-tight text-v-text">{L('How long will you practice?', '¿Cuánto van a practicar?')}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {DURACIONES.map(m => {
                        const on = durMin === m && durSec === 0
                        return (
                          <button key={m} onClick={() => { setDuracion(m * 60); setRemaining(m * 60); setTotal(m * 60) }}
                            className={`h-9 rounded-full px-4 text-sm font-semibold transition-colors ${on ? 'bg-v-success text-white' : 'bg-v-fill text-v-text hover:bg-v-success/10 hover:text-v-success'}`}>
                            {m} min
                          </button>
                        )
                      })}
                    </div>
                    <div className="mt-3 flex items-center gap-2 rounded-v-sm bg-v-fill p-2">
                      <button aria-label={L('Minus 10 seconds', 'Restar 10 segundos')} onClick={() => setDuracion(Math.max(5, totalSecs - 10))}
                        className="grid size-10 shrink-0 place-items-center rounded-full bg-v-elevated text-v-text shadow-v active:scale-95"><Minus size={15} /></button>
                      <div className="flex flex-1 items-center justify-center gap-1 text-2xl font-bold tabular-nums text-v-text">
                        <input type="text" inputMode="numeric" value={durStr} aria-label={L('Minutes', 'Minutos')}
                          onChange={e => setDurStr(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} onFocus={e => e.target.select()}
                          className="w-14 rounded-md bg-transparent text-right outline-none focus:bg-v-elevated" />
                        <span className="text-v-subtle">:</span>
                        <input type="text" inputMode="numeric" value={secStr} aria-label={L('Seconds', 'Segundos')}
                          onChange={e => setSecStr(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} onFocus={e => e.target.select()}
                          onBlur={() => setSecStr(String(durSec).padStart(2, '0'))}
                          className="w-14 rounded-md bg-transparent outline-none focus:bg-v-elevated" />
                      </div>
                      <button aria-label={L('Plus 10 seconds', 'Sumar 10 segundos')} onClick={() => setDuracion(Math.min(10800, totalSecs + 10))}
                        className="grid size-10 shrink-0 place-items-center rounded-full bg-v-elevated text-v-text shadow-v active:scale-95"><Plus size={15} /></button>
                    </div>
                    <p className="mt-1.5 text-center text-[11px] text-v-subtle">{L('minutes : seconds', 'minutos : segundos')}</p>
                  </div>

                  <motion.button whileTap={{ scale: 0.97 }} onClick={start} disabled={totalSecs < 1}
                    className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-full bg-v-success text-sm font-semibold text-white shadow-v transition-opacity disabled:opacity-50">
                    <Sprout size={17} /> {L(`Plant a ${nombreSp(species).toLowerCase()}`, `Plantar un ${nombreSp(species).toLowerCase()}`)}
                  </motion.button>
                </>
              ) : phase === 'done' ? (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="my-auto text-center">
                  <motion.span initial={{ rotate: -15, scale: 0.5 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 12 }}
                    className="mx-auto grid size-16 place-items-center rounded-full bg-v-success/15 text-v-success"><Trophy size={30} /></motion.span>
                  <p className="v-headline mt-4 text-2xl text-v-text">{L('Tree planted!', '¡Árbol plantado!')}</p>
                  <p className="mt-1 text-sm text-v-muted">{L(`A ${nombreSp(species).toLowerCase()} now grows in your forest.`, `Un ${nombreSp(species).toLowerCase()} ya crece en su bosque.`)} · {total < 60 ? `${total} s` : `${Math.round(total / 60)} min`}</p>
                  <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                    <button onClick={reset} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-v-success text-sm font-semibold text-white"><RotateCcw size={15} /> {L('Plant another', 'Plantar otro')}</button>
                    <button onClick={() => { reset(); setView('bosque') }} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-v-fill text-sm font-semibold text-v-text"><Trees size={15} /> {L('See my forest', 'Ver mi bosque')}</button>
                  </div>
                </motion.div>
              ) : (
                <div className="my-auto space-y-5">
                  <div className="text-center">
                    <p className="text-sm text-v-muted">{L('Growing', 'Creciendo')}</p>
                    <p className="v-headline text-2xl text-v-text">{nombreSp(species)}</p>
                  </div>
                  <div>
                    <div className="mb-1.5 flex justify-between text-xs font-medium text-v-muted">
                      <span>{L('Progress', 'Progreso')}</span><span className="tabular-nums text-v-text">{Math.round(g * 100)}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-v-fill">
                      <motion.div className="h-full rounded-full bg-v-success" animate={{ width: `${g * 100}%` }} transition={{ ease: 'linear', duration: 0.5 }} />
                    </div>
                    <div className="mt-3 grid grid-cols-[repeat(4,minmax(0,1fr))] gap-1 text-center text-[10px] font-medium text-v-subtle">
                      {[L('Seed', 'Semilla'), L('Sprout', 'Brote'), L('Sapling', 'Arbolito'), L('Tree', 'Árbol')].map((e, i) => (
                        <span key={e} className={g >= [0, 0.1, 0.32, 0.62][i] ? 'font-semibold text-v-success' : ''}>{e}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {phase === 'running'
                      ? <button onClick={pause} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-v-fill text-sm font-semibold text-v-text"><Pause size={15} /> {L('Pause', 'Pausa')}</button>
                      : <button onClick={resume} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-v-success text-sm font-semibold text-white"><Play size={15} /> {L('Continue', 'Continuar')}</button>}
                    <button onClick={giveUp} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-v-danger/10 text-sm font-semibold text-v-danger"><X size={15} /> {L('Give up', 'Rendirse')}</button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ══ MI BOSQUE ══ */}
        {view === 'bosque' && (
          <motion.div key="bosque" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
            className={`${cardClass} overflow-hidden`}>
            <div className="flex flex-wrap items-center gap-3 px-5 pb-3 pt-5">
              <span className="grid size-8 place-items-center rounded-[30%] bg-v-success/15 text-v-success"><Trees size={15} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold tracking-tight text-v-text">{L('Your forest', 'Su bosque')}</p>
                <p className="text-xs text-v-muted">{oks.length} {L(oks.length === 1 ? 'tree planted' : 'trees planted', oks.length === 1 ? 'árbol plantado' : 'árboles plantados')} · {log.length - oks.length} {L('withered', log.length - oks.length === 1 ? 'marchito' : 'marchitos')}</p>
              </div>
              <div className="flex rounded-full bg-v-fill p-1">
                {(['hoy', 'semana', 'todo'] as const).map(f => (
                  <button key={f} onClick={() => setBosqueFiltro(f)}
                    className={`relative rounded-full px-3 py-1 text-xs font-semibold ${bosqueFiltro === f ? 'text-v-success' : 'text-v-muted'}`}>
                    {bosqueFiltro === f && <motion.span layoutId="bosque-filtro" className="absolute inset-0 rounded-full bg-v-elevated shadow-v" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}
                    <span className="relative">{f === 'hoy' ? L('Today', 'Hoy') : f === 'semana' ? L('7 days', '7 días') : L('All', 'Todo')}</span>
                  </button>
                ))}
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center px-6 pb-10 pt-6 text-center">
                <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 opacity-40">{(['pino', 'manzano', 'cerezo'] as Species[]).map(s => <span key={s} className="size-12"><MiniArbol sp={s} /></span>)}</div>
                <p className="mt-4 text-sm font-semibold text-v-text">{L('No trees here yet', 'Aún no hay árboles aquí')}</p>
                <p className="mt-1 text-xs text-v-muted">{L('Plant the first one by practicing together.', '¡Planten el primero practicando juntos!')}</p>
                <button onClick={() => setView('plantar')} className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-v-success px-5 text-sm font-semibold text-white"><Sprout size={15} /> {L('Plant', 'Plantar')}</button>
              </div>
            ) : (
              <div className="mx-4 mb-4 h-[min(70vw,420px)] overflow-hidden rounded-v-sm" style={{ background: 'linear-gradient(180deg,#d7f1e2 0%,#a9dcc0 100%)' }}>
                <Forest3D items={filtered.map(it => ({ species: it.sp, ok: it.ok }))} />
              </div>
            )}
          </motion.div>
        )}

        {/* ══ ESTADÍSTICAS ══ */}
        {view === 'stats' && (
          <motion.div key="stats" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { v: totalMin, sufijo: '', l: L('Minutes practiced', 'Minutos de práctica'), Icon: Clock, tone: 'bg-v-accent-soft text-v-accent' },
                { v: oks.length, sufijo: '', l: L('Trees', 'Árboles'), Icon: Leaf, tone: 'bg-v-success/15 text-v-success' },
                { v: streak, sufijo: '', l: L('Day streak', 'Racha de días'), Icon: Flame, tone: 'bg-v-warning/15 text-v-warning' },
                { v: exito, sufijo: '%', l: L('Success', 'Éxito'), Icon: Target, tone: 'bg-v-success/15 text-v-success' },
              ].map(({ v, sufijo, l, Icon, tone }, i) => (
                <motion.div key={l} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, type: 'spring', stiffness: 220, damping: 24 }}
                  className={`${cardClass} p-4`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-v-muted">{l}</p>
                    <span className={`grid size-8 shrink-0 place-items-center rounded-[30%] ${tone}`}><Icon size={15} /></span>
                  </div>
                  <p className="mt-1 text-3xl font-bold leading-none tabular-nums text-v-text"><CountUp value={v} />{sufijo}</p>
                </motion.div>
              ))}
            </div>
            <section className={`${cardClass} p-5`}>
              <p className="text-[15px] font-semibold tracking-tight text-v-text">{L('Minutes in the last 7 days', 'Minutos en los últimos 7 días')}</p>
              <div className="mt-4 flex h-40 items-end gap-2 sm:gap-3">
                {last7.map((b, i) => (
                  <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <span className={`text-[11px] font-semibold tabular-nums ${b.mins > 0 ? 'text-v-muted' : 'text-transparent'}`}>{b.mins}</span>
                    <motion.div className={`w-full max-w-10 rounded-t-lg rounded-b-sm ${b.today ? 'bg-v-success' : 'bg-v-success/25 group-hover:bg-v-success/40'}`}
                      initial={{ height: 4 }} animate={{ height: Math.max(4, (b.mins / maxBar) * 110) }} transition={{ delay: 0.1 + i * 0.05, type: 'spring', stiffness: 140, damping: 18 }} />
                    <span className={`text-[11px] capitalize ${b.today ? 'font-semibold text-v-success' : 'text-v-subtle'}`}>{b.label}</span>
                  </div>
                ))}
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
