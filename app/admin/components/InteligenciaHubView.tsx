'use client'
import { TokensPrediccion, avisarTokens } from '@/components/TokensPrediccion'
import { useCentroBranding } from '@/components/CentroBrandingContext'

import { useI18n } from '@/lib/i18n-context'
import { AnimatePresence, motion } from 'motion/react'
import { adminFetch } from '@/lib/admin-fetch'
// app/admin/components/InteligenciaHubView.tsx
// 🧠 Hub de Inteligencia Artificial — Predicciones + Seguridad + Engagement Padres

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart,
} from 'recharts'
import {
  Brain, Shield, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle, RefreshCw, Users, Target,
  Lock, Eye, BarChart3, Zap, ArrowUp, ArrowDown,
  ChevronRight, ChevronLeft, Activity, Sparkles, Clock, Star, Heart,
  MessageCircle, BookOpen, Award, UserCheck, FileText, Search, Trophy, ClipboardList, ChevronDown, Stethoscope, Lightbulb, Bell, Check, Download, SlidersHorizontal, Ban, ExternalLink, Trash2
} from 'lucide-react'

type Tab = 'predicciones' | 'seguridad' | 'patrones' | 'objetivos' | 'reportes'

interface Paciente { id: string; name: string; nombre?: string; diagnosis: string }

interface Prediccion {
  prediccion_30d: number
  prediccion_90d: number
  confianza: number
  tendencia: 'positiva' | 'negativa' | 'estable'
  areas_riesgo: string[]
  areas_fortaleza: string[]
  analisis_ia: string | null
  ultimo_logro: number
  sesiones_analizadas: number
  data_points: { sesion: number; logro: number }[]
}
interface Benchmark {
  scoreGlobal: number
  nivelCompetitivo: string
  centralReachScore: number
  ventaja: number
  metricas: Record<string, { valor: number; score: number; benchmark: { label: string; optimo: number; bueno: number } }>
  analisisEstrategico: string | null
  totalPacientes: number
  totalSesiones: number
}
interface Seguridad {
  scoreSeguridad: number
  totalAccesos: number
  alertasActivas: number
  alertasCriticas: number
  exportacionesTotal: number
  accesosPorRol: Record<string, number>
  actividadHoras: number[]
  estado: 'seguro' | 'alerta' | 'critico'
}

// ─── Helpers visuales ────────────────────────────────────────────────────────
function ScoreRing({ score, size = 80, color }: { score: number; size?: number; color: string }) {
  const { t, locale } = useI18n()

  const r = size / 2 - 8
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={size * 0.22} fontWeight="bold"
        style={{ transform: 'rotate(90deg)', transformOrigin: `${size/2}px ${size/2}px` }}>
        {score}
      </text>
    </svg>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-v-success/15 text-v-success border-v-success/30/30',
    red: 'bg-red-500/15 text-v-danger border-v-danger/30/30',
    yellow: 'bg-v-warning/15 text-v-warning border-v-warning/30/30',
    blue: 'bg-sky-500/15 text-v-accent border-v-accent/30',
    purple: 'bg-sky-500/15 text-v-accent border-v-accent/30',
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colors[color] || colors.blue}`}>
      {label}
    </span>
  )
}

// ─── Mini Barra de Progreso ──────────────────────────────────────────────────
function ProgressBar({ value, max = 100, color = 'blue' }: { value: number; max?: number; color?: string }) {

  const pct = Math.min(100, (value / max) * 100)
  const colors: Record<string, string> = {
    blue: 'bg-sky-500', green: 'bg-v-success', red: 'bg-red-500',
    yellow: 'bg-v-warning', purple: 'bg-sky-500', gray: 'bg-slate-400'
  }
  return (
    <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: 'var(--v-fill)' }}>
      <div className={`h-full rounded-full transition-all duration-700 ${colors[color] || colors.blue}`}
        style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Sparkline con Recharts ──────────────────────────────────────────────────
function Sparkline({ data, color = '#0069db' }: { data: number[]; color?: string }) {
  const { t, locale } = useI18n()
  if (!data || data.length < 2) return <span className="text-xs text-v-subtle">{t('common.sinDatos')}</span>
  const pts = data.map((v, i) => ({ i, v }))
  return (
    <ResponsiveContainer width={100} height={36}>
      <LineChart data={pts} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
        <ReferenceLine y={90} stroke="#10b981" strokeDasharray="3 2" strokeWidth={1} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Gráfico de líneas de progreso ABA (para analytics) ──────────────────────
function LineChartProgreso({ sesiones, criterio = 90, color = '#0069db', titulo = '' }: {

  sesiones: { fecha: string; porcentaje_exito: number; fase?: string }[]
  criterio?: number
  color?: string
  titulo?: string
}) {
  const { t, locale } = useI18n()
  if (!sesiones || sesiones.length < 2) return (
    <div className="flex items-center justify-center h-24 rounded-v-sm border" style={{ borderColor: 'var(--v-border)', background: 'var(--v-fill)' }}>
      <p className="text-xs" style={{ color: 'var(--v-text-tertiary)' }}>{t('ui.few_sessions')}</p>
    </div>
  )

  const data = sesiones.map((s, i) => ({
    n: i + 1,
    pct: s.porcentaje_exito,
    fecha: s.fecha?.slice(5) || '',
  }))

  return (
    <div className="w-full">
      {titulo && <p className="text-xs font-bold mb-1" style={{ color: 'var(--v-text-secondary)' }}>{titulo}</p>}
      <ResponsiveContainer width="100%" height={130}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 18, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--v-border)" />
          <XAxis dataKey="n" tick={{ fontSize: 9, fill: 'var(--v-text-tertiary)' }}
            ticks={Array.from({length: Math.ceil(data.length / 10) + 1}, (_, i) => (i + 1) * 10).filter((t: number) => t <= data.length + 10).concat([1]).sort((a: number, b: number) => a - b)}
            interval={0}
            label={{ value: 'Sesión', position: 'insideBottom', offset: -6, fontSize: 9, fill: 'var(--v-text-tertiary)' }}
          />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 90, 100]} tick={{ fontSize: 9, fill: 'var(--v-text-tertiary)' }} tickFormatter={(v: any) => `${v}%`} />
          <Tooltip
            contentStyle={{ background: 'var(--v-bg-elevated)', border: '1px solid var(--v-border)', borderRadius: 10, fontSize: 11 }}
            formatter={(v: any) => [`${v}%`, 'Logro']}
          />
          <ReferenceLine y={criterio} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1.5} />
          <Area type="monotone" dataKey="pct" fill={`${color}18`} stroke="none" />
          <Line type="monotone" dataKey="pct" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRAMA CARD — colapsable
// ═══════════════════════════════════════════════════════════════════════════════
const FASE_NOMBRE: Record<string, [string, string]> = {
  linea_base: ['Baseline', 'Línea base'], intervencion: ['Intervention', 'Intervención'],
  mantenimiento: ['Maintenance', 'Mantenimiento'], dominado: ['Mastered', 'Dominado'], generalizacion: ['Generalization', 'Generalización'],
}
const nombreFase = (v: string, locale: string) => {
  const f = FASE_NOMBRE[String(v || '').toLowerCase()]
  return f ? f[locale === 'en' ? 0 : 1] : String(v || '').replace(/_/g, ' ')
}

const sinEmoji = (x: any) => String(x || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '').replace(/\s{2,}/g, ' ').trim()

function ProgramaCard({ prog, t, locale }: { prog: any; t: any; locale: string }) {
  const [open, setOpen] = useState(true)
  const logrado = !!prog.criterio_logrado
  const enMeta = prog.ultimo_porcentaje >= prog.criterio_dominio
  const tone = logrado ? 'bg-v-success/15 text-v-success' : enMeta ? 'bg-v-accent-soft text-v-accent' : 'bg-v-warning/15 text-v-warning'
  const slope = Number(prog.tendencia_slope) || 0
  const Trend = slope > 0 ? TrendingUp : slope < 0 ? TrendingDown : Minus
  const trendTone = slope > 0 ? 'text-v-success' : slope < 0 ? 'text-v-danger' : 'text-v-subtle'
  const trendLabel = slope > 0 ? (locale === 'en' ? 'Rising' : 'Creciente') : slope < 0 ? (locale === 'en' ? 'Falling' : 'Decreciente') : (locale === 'en' ? 'Stable' : 'Estable')
  const estadoTxt = sinEmoji(prog.estado_general).toLowerCase()

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`v-scope overflow-hidden rounded-v border bg-v-elevated shadow-v transition-colors ${open ? 'border-v-accent/25' : 'border-v-border'}`}>
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-v-fill sm:px-5">
        <span className={`grid size-10 shrink-0 place-items-center rounded-[30%] ${tone}`}>{logrado ? <Trophy size={18} /> : <ClipboardList size={18} />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug tracking-tight text-v-text [overflow-wrap:anywhere]">{sinEmoji(prog.nombre || prog.titulo) || 'Sin nombre'}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-v-subtle">{sinEmoji(prog.objetivo || prog.objetivo_lp || prog.descripcion || prog.area)}</p>
          {estadoTxt && <span className={`mt-2 inline-flex max-w-full rounded-full px-2.5 py-1 text-[11px] font-semibold first-letter:uppercase sm:hidden ${tone}`}>{estadoTxt}</span>}
        </div>
        {estadoTxt && <span className={`hidden max-w-[45%] shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold first-letter:uppercase sm:inline-flex ${tone}`}>{estadoTxt}</span>}
        <span className={`grid size-7 shrink-0 place-items-center rounded-full transition-all ${open ? 'rotate-180 bg-v-accent-soft text-v-accent' : 'text-v-subtle'}`}><ChevronDown size={15} /></span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="space-y-4 border-t border-v-border bg-v-bg p-4 sm:p-5">
              {prog.total_sesiones > 0 ? (
                <>
                  <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 sm:gap-3">
                    <div className="rounded-v-sm border border-v-border bg-v-elevated p-3 text-center">
                      <p className="truncate text-[11px] text-v-subtle">{locale === 'en' ? 'Last session' : 'Última sesión'}</p>
                      <p className={`mt-0.5 text-lg font-bold tabular-nums sm:text-xl ${enMeta ? 'text-v-success' : 'text-v-text'}`}>{prog.ultimo_porcentaje}%</p>
                    </div>
                    <div className="rounded-v-sm border border-v-border bg-v-elevated p-3 text-center">
                      <p className="truncate text-[11px] text-v-subtle">{locale === 'en' ? 'Average' : 'Media'}</p>
                      <p className="mt-0.5 text-lg font-bold tabular-nums text-v-text sm:text-xl">{prog.media}%</p>
                    </div>
                    <div className="rounded-v-sm border border-v-border bg-v-elevated p-3 text-center">
                      <p className="truncate text-[11px] text-v-subtle">{locale === 'en' ? 'Trend' : 'Tendencia'}</p>
                      <p className={`mt-1 inline-flex max-w-full items-center justify-center gap-1 text-xs font-semibold sm:text-sm ${trendTone}`}><Trend size={14} className="shrink-0" /> <span className="truncate">{trendLabel}</span></p>
                    </div>
                  </div>

                  {prog.sets?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-v-subtle">{locale === 'en' ? 'Phases / sets' : 'Fases / sets'}</p>
                      {prog.sets.map((set: any) => (
                        <div key={set.nombre} className="flex items-center gap-2 rounded-v-sm border border-v-border bg-v-elevated px-3 py-2.5 sm:gap-3">
                          <span className={`size-2 shrink-0 rounded-full ${set.criterio_logrado ? 'bg-v-success' : 'bg-v-warning'}`} />
                          <span className="min-w-0 flex-1 text-sm font-medium capitalize text-v-text [overflow-wrap:anywhere]">{nombreFase(set.nombre, locale)}</span>
                          <span className="shrink-0 text-xs tabular-nums text-v-subtle"><span className="hidden sm:inline">{locale === 'en' ? 'avg' : 'media'} </span>{set.media}%</span>
                          {set.criterio_logrado
                            ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-v-success/15 px-2 py-0.5 text-[11px] font-semibold text-v-success"><Trophy size={11} /> {locale === 'en' ? 'Achieved' : 'Logrado'}</span>
                            : <span className="shrink-0 rounded-full bg-v-warning/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-v-warning">{set.ultimo_pct}%</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-v-muted">
                    <Trend size={13} className={trendTone} />
                    <span className="font-semibold text-v-text">{String(prog.tendencia_descripcion || '').replace(/(linea_base|intervencion|mantenimiento|dominado|generalizacion)/gi, m => nombreFase(m, locale).toLowerCase())}</span>
                    <span className="text-v-subtle">· {prog.total_sesiones} {locale === 'en' ? 'sessions' : 'sesiones'}</span>
                  </p>
                </>
              ) : (
                <p className="py-3 text-center text-sm text-v-subtle">{t('hub.sinSesionesReg')}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Selector de paciente con buscador (reemplaza el <select> nativo) ─────────
function PacientePicker({ pacientes, value, onChange, placeholder }: {
  pacientes: Paciente[]; value: Paciente | null; onChange: (p: Paciente | null) => void; placeholder: string
}) {
  const { locale } = useI18n()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])
  const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const lista = pacientes.filter(p => !q || norm(p.name || '').includes(norm(q)))
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(o => !o); setQ('') }}
        className={`flex w-full items-center gap-3 rounded-v-sm border bg-v-bg px-3 py-2.5 text-left transition-shadow ${open ? 'border-v-accent/50 ring-4 ring-v-accent-soft' : 'border-v-border hover:border-v-accent/30'}`}>
        {value ? (
          <>
            <span className="v-brand grid size-9 shrink-0 place-items-center rounded-[30%] text-sm font-semibold" style={{ boxShadow: 'none' }}>{value.name.charAt(0).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-v-text">{value.name}</span>
              <span className="block truncate text-xs text-v-subtle">{value.diagnosis || (locale === 'en' ? 'No diagnosis' : 'Sin diagnóstico')}</span>
            </span>
          </>
        ) : (
          <>
            <span className="grid size-9 shrink-0 place-items-center rounded-[30%] bg-v-fill text-v-subtle"><Users size={16} /></span>
            <span className="flex-1 text-sm text-v-subtle">{placeholder}</span>
          </>
        )}
        <ChevronDown size={16} className={`shrink-0 text-v-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.14 }}
            className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v-lg">
            <div className="border-b border-v-border p-2">
              <div className="flex items-center gap-2 rounded-full bg-v-bg px-3 py-2">
                <Search size={14} className="shrink-0 text-v-subtle" />
                <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={locale === 'en' ? 'Search patient…' : 'Buscar paciente…'}
                  className="min-w-0 flex-1 bg-transparent text-sm text-v-text outline-none placeholder:text-v-subtle" />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto p-1.5" style={{ scrollbarWidth: 'thin' }}>
              {lista.length === 0 && <p className="px-3 py-6 text-center text-sm text-v-subtle">{locale === 'en' ? 'No matches' : 'Sin resultados'}</p>}
              {lista.map(p => {
                const on = value?.id === p.id
                return (
                  <button key={p.id} type="button" onClick={() => { onChange(p); setOpen(false) }}
                    className={`flex w-full items-center gap-3 rounded-v-sm px-2.5 py-2 text-left transition-colors ${on ? 'bg-v-accent-soft' : 'hover:bg-v-fill'}`}>
                    <span className={`grid size-8 shrink-0 place-items-center rounded-[30%] text-xs font-semibold ${on ? 'v-brand' : 'bg-v-accent-soft text-v-accent'}`} style={on ? { boxShadow: 'none' } : undefined}>
                      {(p.name || '?').charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-medium ${on ? 'text-v-accent' : 'text-v-text'}`}>{p.name}</span>
                      <span className="block truncate text-xs text-v-subtle">{p.diagnosis || (locale === 'en' ? 'No diagnosis' : 'Sin diagnóstico')}</span>
                    </span>
                    {on && <CheckCircle size={15} className="shrink-0 text-v-accent" />}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PREDICCIONES
// ═══════════════════════════════════════════════════════════════════════════════
function TabPredicciones({ pacientes }: { pacientes: Paciente[] }) {
    const { t, locale } = useI18n()

    const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null)
  const [prediccion, setPrediccion] = useState<Prediccion | null>(null)
  const [loading, setLoading] = useState(false)
  const [showMobileDetail, setShowMobileDetail] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const pacientesFiltrados = pacientes.filter(p => {
    if (!busqueda.trim()) return true
    const q = busqueda.trim().toLowerCase()
    return (p.name || p.nombre || '').toLowerCase().includes(q)
      || (p.diagnosis || '').toLowerCase().includes(q)
  })

  const generarPrediccion = async (p: Paciente) => {
    setSelectedPaciente(p)
    setLoading(true)
    setPrediccion(null)
    setShowMobileDetail(true)
    try {
      const res = await fetch('/api/agente-prediccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ locale: localStorage.getItem('vanty_locale') || 'es', childId: p.id, childName: p.name, semanas: 12 })
      })
      const data = await res.json()
      if (res.status === 402 && data?.code === 'quota_exhausted') {
        // Sin tokens: se abre la compra en vez de un análisis vacío
        setPrediccion(null); setShowMobileDetail(false); setSelectedPaciente(null)
        avisarTokens(true)
      } else {
        setPrediccion(data)
        avisarTokens(false)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const tendenciaIcon = prediccion?.tendencia === 'positiva' ? <TrendingUp size={16} className="text-v-success" />
    : prediccion?.tendencia === 'negativa' ? <TrendingDown size={16} className="text-v-danger" />
    : <Minus size={16} className="text-v-subtle" />

  const tendenciaColor = prediccion?.tendencia === 'positiva' ? 'green'
    : prediccion?.tendencia === 'negativa' ? 'red' : 'blue'

  return (
    <div className="overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v">

      {/* ── MÓVIL: Vista detalle (aparece encima de la lista) ── */}
      {showMobileDetail && (
        <div className="lg:hidden flex flex-col" style={{ minHeight: 'calc(100vh - 260px)' }}>
          {/* Barra superior con botón volver */}
          <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--v-border)', background: 'var(--v-fill)' }}>
            <button
              onClick={() => { setShowMobileDetail(false); setSelectedPaciente(null); setPrediccion(null) }}
              className="flex items-center gap-1.5 text-xs font-bold text-v-accent active:text-v-accent transition-colors"
            >
              <ChevronLeft size={16} /> Pacientes
            </button>
            {selectedPaciente && (
              <span className="text-xs font-bold truncate ml-1" style={{ color: 'var(--v-text)' }}>
                · {selectedPaciente.name}
              </span>
            )}
          </div>
          {/* Panel resultados móvil */}
          <div className="flex-1 overflow-y-auto">
            
        {!selectedPaciente && !loading && (
          <div className="flex flex-col items-center justify-center h-full p-12 text-center" style={{ minHeight: '200px' }}>
            <Brain size={48} className="text-v-subtle mb-4" style={{ opacity: 0.4 }} />
            <p className="font-bold text-base" style={{ color: 'var(--v-text-tertiary)' }}>{t("hub.selecPacienteMsg")}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--v-text-tertiary)', opacity: 0.6 }}>{t("hub.iaAnalizara")}</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-full p-12 text-center" style={{ minHeight: '200px' }}>
            <div className="w-12 h-12 border-4 border-v-accent/30 border-t-sky-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="font-medium" style={{ color: 'var(--v-text-secondary)' }}>{t('hub.analizandoPatrones')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--v-text-tertiary)' }}>{t('ui.calculating')}</p>
          </div>
        )}

        {prediccion && !loading && selectedPaciente && (
          <div className="p-4 md:p-5 space-y-4">
            {/* Header paciente */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-v border border-v-border bg-v-elevated p-5 shadow-v">
              <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
              <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(30rem 10rem at 0% 0%, var(--v-glow-1), transparent 70%)' }} />
              <div className="relative flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="v-brand grid size-12 shrink-0 place-items-center rounded-[30%] text-lg font-semibold" style={{ boxShadow: 'none' }}>{selectedPaciente.name.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0">
                  <p className="text-xs font-medium text-v-accent">{t('hub.analisPorPrograma')}</p>
                  <h3 className="truncate text-lg font-semibold tracking-tight text-v-text md:text-xl">{selectedPaciente.name}</h3>
                  <p className="text-sm text-v-muted">
                    {(prediccion as any).programas_analizados || 0} {locale === 'en' ? 'programs' : 'programas'} · {(prediccion as any).total_sesiones_unificado ?? (prediccion as any).analisis_por_programa?.reduce((a: number, p: any) => a + p.total_sesiones, 0) ?? 0} {locale === 'en' ? 'total sessions' : 'sesiones totales'}
                  </p>
                  </div>
                </div>
                <div className="flex-shrink-0 rounded-v-sm bg-v-success/15 px-3 py-2 text-center">
                  <p className="text-[10px] text-v-success/80">{t('ui.criteria')}</p>
                  <p className="text-sm font-bold text-v-success">≥{(prediccion as any).analisis_por_programa?.[0]?.criterio_dominio ?? 90}%</p>
                  <p className="text-[10px] text-v-success/80">{t('auto.inteligenciaHubView.sesionesConsecutivas')}</p>
                </div>
              </div>
            </motion.div>

            {/* Sin programas */}
            {((prediccion as any).programas_analizados === 0) && (
              <div className="rounded-v-sm p-6 text-center border-2 border-dashed" style={{ borderColor: "var(--v-border)", background: "var(--v-fill)" }}>
                <p className="font-bold text-sm mb-1" style={{ color: "var(--v-text)" }}>{t("hub.sinProgramasDatos")}</p>
                <p className="text-xs" style={{ color: "var(--v-text-tertiary)" }}>{(prediccion as any).mensaje || 'Crea programas ABA en la ficha del paciente y registra al menos una sesión para generar análisis.'}</p>
              </div>
            )}

            {/* Por programa — colapsables */}
            {((prediccion as any).analisis_por_programa || []).map((prog: any) => (
              <ProgramaCard key={prog.programa_id} prog={prog} t={t} locale={locale} />
            ))}

            {/* Análisis IA general */}
            {(prediccion as any).resumen_general && (
              <ResumenIACard texto={(prediccion as any).resumen_general}
                titulo={t('hub.analisisClinicoAnalista')}
                subtitulo={locale === 'en' ? 'Clinical reading of all programs' : 'Lectura clínica de todos los programas'} />
            )}
          </div>
        )}

          </div>
        </div>
      )}

      {/* ── MÓVIL: Lista de pacientes (se oculta cuando hay detalle) ── */}
      {!showMobileDetail && (
        <div className="lg:hidden flex flex-col">
          <div className="px-4 py-3.5 border-b flex-shrink-0" style={{ borderColor: 'var(--v-border)', background: 'var(--v-fill)' }}>
            <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-v-text">
              <span className="grid size-7 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Users size={14} /></span> {t('ui.generarPrediccion2')}
            </h3>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--v-text-tertiary)' }}>{t('hub.iaAnalizara')}</p>
            <div className="relative mt-2.5">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--v-text-tertiary)' }} />
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder={t("hub.buscarPaciente")}
                className="w-full rounded-full border border-v-border bg-v-elevated py-2 pl-8 pr-3 text-sm text-v-text outline-none placeholder:text-v-subtle focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft"
              />
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            
          {pacientesFiltrados.length === 0 && (
            <p className="p-4 text-sm text-center" style={{ color: 'var(--v-text-tertiary)' }}>{busqueda ? 'Sin resultados' : t('ui.no_patients')}</p>
          )}
          {pacientesFiltrados.map(p => (
            <button key={p.id} onClick={() => generarPrediccion(p)}
              className={`group mx-2 my-0.5 flex w-[calc(100%-1rem)] items-center gap-3 rounded-v-sm px-2.5 py-2.5 text-left transition-colors ${selectedPaciente?.id === p.id ? 'bg-v-accent-soft' : 'hover:bg-v-elevated'}`}>
              <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] text-sm font-semibold ${selectedPaciente?.id === p.id ? 'v-brand' : 'bg-v-accent-soft text-v-accent'}`}
                style={selectedPaciente?.id === p.id ? { boxShadow: 'none' } : undefined}>
                {(p.name || p.nombre || '?').charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${selectedPaciente?.id === p.id ? 'text-v-accent' : 'text-v-text'}`}>{p.name}</p>
                <p className="truncate text-xs text-v-subtle">{p.diagnosis || (locale === 'en' ? 'No diagnosis' : 'Sin diagnóstico')}</p>
              </div>
              <ChevronRight size={14} className={`shrink-0 transition-all ${selectedPaciente?.id === p.id ? 'text-v-accent' : 'text-v-subtle opacity-0 group-hover:opacity-100'} lg:group-hover:translate-x-0.5`} />
            </button>
          ))}

          </div>
        </div>
      )}

      {/* ── DESKTOP: Layout lado a lado ── */}
      <div className="hidden lg:flex min-h-0 gap-0" style={{ height: 'calc(100dvh - 250px)', minHeight: 480 }}>

        {/* Lista de pacientes — panel fijo izquierdo */}
        <div className="w-64 flex-shrink-0 flex flex-col border-r" style={{ borderColor: 'var(--v-border)', background: 'var(--v-fill)' }}>
          <div className="px-4 py-3.5 border-b flex-shrink-0" style={{ borderColor: 'var(--v-border)' }}>
            <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--v-text)' }}>
              <Users size={15} className="text-v-accent" /> {t('ui.generarPrediccion2')}
            </h3>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--v-text-tertiary)' }}>{t('hub.iaAnalizara')}</p>
            <div className="relative mt-2.5">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--v-text-tertiary)' }} />
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder={t("hub.buscarPaciente")}
                className="w-full rounded-full border border-v-border bg-v-elevated py-2 pl-8 pr-3 text-sm text-v-text outline-none placeholder:text-v-subtle focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            
          {pacientesFiltrados.length === 0 && (
            <p className="p-4 text-sm text-center" style={{ color: 'var(--v-text-tertiary)' }}>{busqueda ? 'Sin resultados' : t('ui.no_patients')}</p>
          )}
          {pacientesFiltrados.map(p => (
            <button key={p.id} onClick={() => generarPrediccion(p)}
              className={`group mx-2 my-0.5 flex w-[calc(100%-1rem)] items-center gap-3 rounded-v-sm px-2.5 py-2.5 text-left transition-colors ${selectedPaciente?.id === p.id ? 'bg-v-accent-soft' : 'hover:bg-v-elevated'}`}>
              <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] text-sm font-semibold ${selectedPaciente?.id === p.id ? 'v-brand' : 'bg-v-accent-soft text-v-accent'}`}
                style={selectedPaciente?.id === p.id ? { boxShadow: 'none' } : undefined}>
                {(p.name || p.nombre || '?').charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${selectedPaciente?.id === p.id ? 'text-v-accent' : 'text-v-text'}`}>{p.name}</p>
                <p className="truncate text-xs text-v-subtle">{p.diagnosis || (locale === 'en' ? 'No diagnosis' : 'Sin diagnóstico')}</p>
              </div>
              <ChevronRight size={14} className={`shrink-0 transition-all ${selectedPaciente?.id === p.id ? 'text-v-accent' : 'text-v-subtle opacity-0 group-hover:opacity-100'} lg:group-hover:translate-x-0.5`} />
            </button>
          ))}

          </div>
        </div>

        {/* Panel de predicciones — scrollable derecho */}
        <div className="flex-1 overflow-y-auto min-h-0">
          
        {!selectedPaciente && !loading && (
          <div className="flex flex-col items-center justify-center h-full p-12 text-center" style={{ minHeight: '200px' }}>
            <Brain size={48} className="text-v-subtle mb-4" style={{ opacity: 0.4 }} />
            <p className="font-bold text-base" style={{ color: 'var(--v-text-tertiary)' }}>{t("hub.selecPacienteMsg")}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--v-text-tertiary)', opacity: 0.6 }}>{t("hub.iaAnalizara")}</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-full p-12 text-center" style={{ minHeight: '200px' }}>
            <div className="w-12 h-12 border-4 border-v-accent/30 border-t-sky-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="font-medium" style={{ color: 'var(--v-text-secondary)' }}>{t('hub.analizandoPatrones')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--v-text-tertiary)' }}>{t('ui.calculating')}</p>
          </div>
        )}

        {prediccion && !loading && selectedPaciente && (
          <div className="p-4 md:p-5 space-y-4">
            {/* Header paciente */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-v border border-v-border bg-v-elevated p-5 shadow-v">
              <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
              <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(30rem 10rem at 0% 0%, var(--v-glow-1), transparent 70%)' }} />
              <div className="relative flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="v-brand grid size-12 shrink-0 place-items-center rounded-[30%] text-lg font-semibold" style={{ boxShadow: 'none' }}>{selectedPaciente.name.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0">
                  <p className="text-xs font-medium text-v-accent">{t('hub.analisPorPrograma')}</p>
                  <h3 className="truncate text-lg font-semibold tracking-tight text-v-text md:text-xl">{selectedPaciente.name}</h3>
                  <p className="text-sm text-v-muted">
                    {(prediccion as any).programas_analizados || 0} {locale === 'en' ? 'programs' : 'programas'} · {(prediccion as any).total_sesiones_unificado ?? (prediccion as any).analisis_por_programa?.reduce((a: number, p: any) => a + p.total_sesiones, 0) ?? 0} {locale === 'en' ? 'total sessions' : 'sesiones totales'}
                  </p>
                  </div>
                </div>
                <div className="flex-shrink-0 rounded-v-sm bg-v-success/15 px-3 py-2 text-center">
                  <p className="text-[10px] text-v-success/80">{t('ui.criteria')}</p>
                  <p className="text-sm font-bold text-v-success">≥{(prediccion as any).analisis_por_programa?.[0]?.criterio_dominio ?? 90}%</p>
                  <p className="text-[10px] text-v-success/80">{t('auto.inteligenciaHubView.sesionesConsecutivas')}</p>
                </div>
              </div>
            </motion.div>

            {/* Sin programas */}
            {((prediccion as any).programas_analizados === 0) && (
              <div className="rounded-v-sm p-6 text-center border-2 border-dashed" style={{ borderColor: "var(--v-border)", background: "var(--v-fill)" }}>
                <p className="font-bold text-sm mb-1" style={{ color: "var(--v-text)" }}>{t("hub.sinProgramasDatos")}</p>
                <p className="text-xs" style={{ color: "var(--v-text-tertiary)" }}>{(prediccion as any).mensaje || 'Crea programas ABA en la ficha del paciente y registra al menos una sesión para generar análisis.'}</p>
              </div>
            )}

            {/* Por programa — colapsables */}
            {((prediccion as any).analisis_por_programa || []).map((prog: any) => (
              <ProgramaCard key={prog.programa_id} prog={prog} t={t} locale={locale} />
            ))}

            {/* Análisis IA general */}
            {(prediccion as any).resumen_general && (
              <ResumenIACard texto={(prediccion as any).resumen_general}
                titulo={t('hub.analisisClinicoAnalista')}
                subtitulo={locale === 'en' ? 'Clinical reading of all programs' : 'Lectura clínica de todos los programas'} />
            )}
          </div>
        )}

        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: SEGURIDAD
// ═══════════════════════════════════════════════════════════════════════════════
function TabSeguridad() {
  const { t, locale } = useI18n()
  const [datos, setDatos] = useState<Seguridad | null>(null)
  const [alertas, setAlertas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [res1, res2] = await Promise.all([
        fetch('/api/agente-guardian?tipo=resumen&dias=7'),
        fetch('/api/agente-guardian?tipo=alertas&dias=30')
      ])
      const d1 = await res1.json()
      const d2 = await res2.json()
      setDatos(d1)
      setAlertas(d2.alertas || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const estadoColor = datos?.estado === 'seguro' ? 'emerald' : datos?.estado === 'alerta' ? 'amber' : 'red'
  const scoreColor = (datos?.scoreSeguridad || 0) >= 80 ? '#10b981' : (datos?.scoreSeguridad || 0) >= 60 ? '#f59e0b' : '#ef4444'

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-10 h-10 border-4 border-v-accent/30 border-t-sky-600 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Score header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-1  rounded-v border border-v-border p-5 flex flex-col items-center justify-center" style={{ background: "var(--v-bg-elevated)" }}>
          <div className="relative">
            <ScoreRing score={datos?.scoreSeguridad || 0} size={100} color={scoreColor} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold" style={{ color: scoreColor }}>{datos?.scoreSeguridad}</span>
            </div>
          </div>
          <p className="text-xs font-bold text-v-muted uppercase mt-2">{t("hub.scoreSeguridad")}</p>
          <Badge label={datos?.estado || 'desconocido'} color={estadoColor} />
        </div>

        {[
          { icon: Eye, label: 'Accesos (7d)', value: datos?.totalAccesos || 0, color: 'blue' },
          { icon: AlertTriangle, label: 'Alertas activas', value: datos?.alertasActivas || 0, color: (datos?.alertasActivas || 0) > 0 ? 'red' : 'green' },
          { icon: Shield, label: 'Exportaciones', value: datos?.exportacionesTotal || 0, color: 'purple' },
        ].map(m => (
          <div key={m.label} className=" rounded-v border border-v-border p-5 flex flex-col justify-between" style={{ background: "var(--v-bg-elevated)" }}>
            <div className={`w-10 h-10 rounded-v-sm flex items-center justify-center mb-3 ${
              m.color === 'blue' ? 'bg-v-accent-soft' : m.color === 'red' ? 'bg-v-danger/10' : m.color === 'green' ? 'bg-v-success/15' : 'bg-v-accent-soft'
            }`}>
              <m.icon size={18} className={
                m.color === 'blue' ? 'text-v-accent' : m.color === 'red' ? 'text-v-danger' : m.color === 'green' ? 'text-v-success' : 'text-v-accent'
              } />
            </div>
            <p className={`text-3xl font-bold ${
              m.color === 'blue' ? 'text-v-accent' : m.color === 'red' ? 'text-v-danger' : m.color === 'green' ? 'text-v-success' : 'text-v-accent'
            }`}>{m.value}</p>
            <p className="text-xs text-v-subtle font-medium mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Accesos por rol */}
      {datos?.accesosPorRol && Object.keys(datos.accesosPorRol).length > 0 && (
        <div className=" rounded-v border border-v-border p-5" style={{ background: "var(--v-bg-elevated)" }}>
          <h4 className="font-bold text-v-text text-sm mb-4 flex items-center gap-2">
            <Users size={14} className="text-v-accent" /> Accesos por Rol (últimos 7 días)
          </h4>
          <div className="space-y-3">
            {Object.entries(datos.accesosPorRol).map(([rol, count]) => {
              const total = Object.values(datos.accesosPorRol).reduce((a: number, b: unknown) => a + (b as number), 0)
              const pct = Math.round(((count as number) / total) * 100)
              return (
                <div key={rol}>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-v-muted capitalize">{rol}</span>
                    <span className="text-v-subtle">{count} accesos ({pct}%)</span>
                  </div>
                  <ProgressBar value={pct} color="blue" />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Alertas activas */}
      <div className=" rounded-v border border-v-border overflow-hidden" style={{ background: "var(--v-bg-elevated)" }}>
        <div className="p-4 border-b border-v-border flex items-center justify-between">
          <h4 className="font-bold text-v-text text-sm flex items-center gap-2">
            <AlertTriangle size={14} className="text-v-warning" /> Alertas de Seguridad
          </h4>
          <button onClick={cargar} className="text-xs text-v-accent hover:text-v-accent font-bold flex items-center gap-1">
            <RefreshCw size={11} /> Actualizar
          </button>
        </div>
        {alertas.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle size={32} className="text-v-success mx-auto mb-2" />
            <p className="text-v-muted font-medium text-sm">{t('auto.inteligenciaHubView.sinAlertasActivasSistemaSeguro')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {alertas.map((a, i) => (
              <div key={i} className={`p-4 flex gap-3 ${a.nivel === 'critico' ? 'bg-v-danger/10' : 'bg-v-warning/15/30'}`}>
                <div className={`w-8 h-8 rounded-v-sm flex items-center justify-center flex-shrink-0 ${a.nivel === 'critico' ? 'bg-v-danger/10' : 'bg-v-warning/15'}`}>
                  <AlertTriangle size={14} className={a.nivel === 'critico' ? 'text-v-danger' : 'text-v-warning'} />
                </div>
                <div>
                  <p className="font-bold text-sm text-v-text" style={{ color: "var(--v-text)" }}>{a.tipo?.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-v-muted mt-0.5">{a.descripcion}</p>
                  <p className="text-[10px] text-v-subtle mt-1">{new Date(a.timestamp).toLocaleString('es')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: COMPETITIVIDAD
// ═══════════════════════════════════════════════════════════════════════════════
function TabCompetitividad() {
  const { name: centroNombre } = useCentroBranding()
  const { t, locale } = useI18n()

  const [datos, setDatos] = useState<Benchmark | null>(null)
  const [loading, setLoading] = useState(true)
  const [dias, setDias] = useState(30)

  const cargar = useCallback(async (d = dias) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/benchmark?dias=${d}`)
      setDatos(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [dias])

  useEffect(() => { cargar() }, [cargar])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-10 h-10 border-4 border-v-accent/30 border-t-sky-600 rounded-full animate-spin" />
    </div>
  )

  if (!datos) return null

  const scoreColor = datos.scoreGlobal >= 80 ? '#10b981' : datos.scoreGlobal >= 65 ? '#0069db' : datos.scoreGlobal >= 50 ? '#f59e0b' : '#ef4444'
  const ventajaPositiva = datos.ventaja > 0

  return (
    <div className="space-y-5">
      {/* Header competitivo */}
      <div className="bg-gradient-to-br from-v-brand-from via-sky-600 to-v-brand-to rounded-v p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-v-accent text-xs font-bold mb-1">{t("hub.scoreCompetitivo")}</p>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-bold">{datos.scoreGlobal}</span>
              <span className="text-v-accent text-lg mb-1">/100</span>
            </div>
            <p className="text-v-accent font-bold mt-1">{datos.nivelCompetitivo}</p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-v-sm font-bold text-sm mb-2 ${ventajaPositiva ? 'bg-v-success/20 text-v-success' : 'bg-red-500/20 text-v-danger'}`}>
              {ventajaPositiva ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              {Math.abs(datos.ventaja)} pts vs Central Reach
            </div>
            <p className="text-v-accent text-xs">Central Reach: {datos.centralReachScore}/100</p>
            <p className="text-v-accent text-xs mt-1">{datos.totalPacientes} pacientes · {datos.totalSesiones} sesiones</p>
          </div>
        </div>

        {/* Mini comparativa visual */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-v-accent w-28">{centroNombre}</span>
            <div className="flex-1 bg-v-elevated/20 rounded-full h-2.5 overflow-hidden">
              <div className="h-full rounded-full bg-v-elevated transition-all duration-700" style={{ width: `${datos.scoreGlobal}%` }} />
            </div>
            <span className="text-white font-bold w-8">{datos.scoreGlobal}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-v-accent w-28">Central Reach</span>
            <div className="flex-1 bg-v-elevated/20 rounded-full h-2.5 overflow-hidden">
              <div className="h-full rounded-full bg-sky-300 transition-all duration-700" style={{ width: `${datos.centralReachScore}%` }} />
            </div>
            <span className="text-v-accent font-bold w-8">{datos.centralReachScore}</span>
          </div>
        </div>
      </div>

      {/* Métricas detalladas */}
      <div className=" rounded-v border border-v-border overflow-hidden" style={{ background: "var(--v-bg-elevated)" }}>
        <div className="p-4 border-b border-v-border flex items-center justify-between">
          <h4 className="font-bold text-v-text text-sm flex items-center gap-2">
            <BarChart3 size={14} className="text-v-accent" /> Métricas vs Estándares de Industria
          </h4>
          <div className="flex gap-1.5">
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => { setDias(d); cargar(d) }}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-v-sm transition-colors ${dias === d ? 'bg-v-accent text-white' : 'bg-v-fill text-v-muted hover:bg-v-fill'}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {Object.entries(datos.metricas).map(([key, m]: [string, any]) => {
            const score = Math.round(m.score)
            const scoreColor = score >= 75 ? 'green' : score >= 50 ? 'yellow' : 'red'
            return (
              <div key={key} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-bold text-v-text truncate">{m.benchmark.label}</p>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <span className="text-sm font-bold text-v-text" style={{ color: "var(--v-text)" }}>{m.valor}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        scoreColor === 'green' ? 'bg-v-success/15 text-v-success' :
                        scoreColor === 'yellow' ? 'bg-v-warning/15 text-v-warning' : 'bg-v-danger/10 text-v-danger'
                      }`}>{score}%</span>
                    </div>
                  </div>
                  <ProgressBar value={score} color={scoreColor === 'green' ? 'green' : scoreColor === 'yellow' ? 'yellow' : 'red'} />
                  <p className="text-[10px] text-v-subtle mt-1">Óptimo: {m.benchmark.optimo} · Bueno: {m.benchmark.bueno}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Análisis estratégico IA */}
      {datos.analisisEstrategico && (
        <div className=" rounded-v border border-v-border p-5" style={{ background: "var(--v-bg-elevated)" }}>
          <p className="text-xs font-bold text-v-muted mb-3 flex items-center gap-1.5">
            <Sparkles size={12} className="text-v-accent" /> ANÁLISIS ESTRATÉGICO IA
          </p>
          <div className="text-sm text-v-text leading-relaxed whitespace-pre-wrap">
            {datos.analisisEstrategico}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PATRONES ABA (CAPA 1) — Rediseño neuropsicológico profesional
// ═══════════════════════════════════════════════════════════════════════════════
// accent = color principal, usado en borde izq, número, badge
// bg/border son suficientemente ligeros para light mode
const PATRON_CONFIG: Record<string, {
  label: string; labelEn: string; Icon: any; accent: string; lightBg: string; lightBorder: string; lightText: string; darkBg: string; darkBorder: string; darkText: string
}> = {
  regresion:     { label: 'Regresión Conductual',         labelEn: 'Behavioral Regression', Icon: TrendingDown, accent: '#ef4444', lightBg: '#fef2f2', lightBorder: '#fecaca', lightText: '#b91c1c', darkBg: 'rgba(239,68,68,0.12)',  darkBorder: 'rgba(239,68,68,0.3)',  darkText: '#fca5a5' },
  estancamiento: { label: 'Estancamiento de Aprendizaje', labelEn: 'Learning Plateau',      Icon: Minus,        accent: '#f59e0b', lightBg: '#fffbeb', lightBorder: '#fde68a', lightText: '#b45309', darkBg: 'rgba(245,158,11,0.12)', darkBorder: 'rgba(245,158,11,0.3)', darkText: '#fcd34d' },
  aceleracion:   { label: 'Aceleración del Logro',        labelEn: 'Achievement Acceleration', Icon: TrendingUp, accent: '#10b981', lightBg: '#f0fdf4', lightBorder: '#a7f3d0', lightText: '#047857', darkBg: 'rgba(16,185,129,0.12)', darkBorder: 'rgba(16,185,129,0.3)', darkText: '#6ee7b7' },
  inconsistencia:{ label: 'Variabilidad Alta',            labelEn: 'High Variability',      Icon: Activity,     accent: '#0891b2', lightBg: '#ecfeff', lightBorder: '#a5f3fc', lightText: '#0e7490', darkBg: 'rgba(8,145,178,0.12)',  darkBorder: 'rgba(8,145,178,0.3)',  darkText: '#67e8f9' },
  dominio:       { label: 'Criterio de Dominio',          labelEn: 'Mastery Criterion',     Icon: Award,        accent: '#0069db', lightBg: '#f0f9ff', lightBorder: '#bae6fd', lightText: '#075985', darkBg: 'rgba(2,132,199,0.12)',  darkBorder: 'rgba(2,132,199,0.3)',  darkText: '#7dd3fc' },
}

function PatronCard({ p, index, defaultOpen = false }: { p: any; index: number; defaultOpen?: boolean; key?: any }) {
  const { locale } = useI18n()
  const cfg = PATRON_CONFIG[p.tipo] || PATRON_CONFIG.estancamiento
  const cfgLabel = locale === 'en' ? cfg.labelEn : cfg.label
  const delta = Math.round((Number(p.valor_actual) || 0) - (Number(p.valor_anterior) || 0))
  const [open, setOpen] = useState<boolean>(defaultOpen)
  const deltaTone = delta < 0 ? 'bg-v-danger/10 text-v-danger' : delta > 0 ? 'bg-v-success/15 text-v-success' : 'bg-v-fill text-v-muted'
  const DeltaIcon = delta < 0 ? TrendingDown : delta > 0 ? TrendingUp : Minus
  const conf = Math.round(Number(p.confianza) || 0)
  const PI = cfg.Icon

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 6) * 0.04 }}
      className="relative overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: cfg.accent }} />
      <button onClick={() => setOpen(o => !o)} className="flex w-full flex-wrap items-center gap-3 py-4 pl-5 pr-4 text-left transition-colors hover:bg-v-fill">
        <span className="grid size-10 shrink-0 place-items-center rounded-[30%]" style={{ background: `${cfg.accent}1a`, color: cfg.accent }}><PI size={18} /></span>
        <div className="min-w-0 flex-[1_1_200px]">
          <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: `${cfg.accent}14`, color: cfg.accent }}>{cfgLabel}</span>
          <p className="mt-1 truncate text-[15px] font-semibold tracking-tight text-v-text">{p.area}</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${deltaTone}`}>
            <DeltaIcon size={13} /> {delta > 0 ? '+' : ''}{delta}%
          </span>
          <span className="hidden items-center gap-2 rounded-full bg-v-fill px-2.5 py-1 sm:inline-flex" title={locale === 'en' ? 'How sure the AI is about this pattern' : 'Qué tan segura está la IA de este patrón'}>
            <span className="text-[11px] text-v-subtle">{locale === 'en' ? 'Confidence' : 'Confianza'}</span>
            <span className="h-1.5 w-10 overflow-hidden rounded-full bg-v-border">
              <motion.span className="block h-full rounded-full" style={{ background: cfg.accent }} initial={{ width: 0 }} animate={{ width: `${conf}%` }} transition={{ duration: 0.8 }} />
            </span>
            <span className="text-xs font-semibold tabular-nums text-v-text">{conf}%</span>
          </span>
          <span className={`grid size-8 place-items-center rounded-full transition-all ${open ? 'rotate-180 bg-v-accent-soft text-v-accent' : 'text-v-subtle'}`}><ChevronDown size={16} /></span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="space-y-3 border-t border-v-border bg-v-bg py-4 pl-5 pr-4">
              {/* Antes → ahora */}
              <div className="flex flex-wrap items-center gap-3 rounded-v-sm border border-v-border bg-v-elevated p-3">
                <div className="text-center">
                  <p className="text-[11px] text-v-subtle">{locale === 'en' ? 'Before' : 'Antes'}</p>
                  <p className="text-xl font-bold tabular-nums text-v-muted">{p.valor_anterior}%</p>
                </div>
                <ChevronRight size={18} className="text-v-subtle" />
                <div className="text-center">
                  <p className="text-[11px] text-v-subtle">{locale === 'en' ? 'Now' : 'Ahora'}</p>
                  <p className="text-xl font-bold tabular-nums" style={{ color: cfg.accent }}>{p.valor_actual}%</p>
                </div>
                <div className="min-w-[140px] flex-1">
                  <div className="relative h-2 overflow-hidden rounded-full bg-v-fill">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-v-border" style={{ width: `${Math.min(100, Number(p.valor_anterior) || 0)}%` }} />
                    <motion.span className="absolute inset-y-0 left-0 rounded-full" style={{ background: cfg.accent }}
                      initial={{ width: `${Math.min(100, Number(p.valor_anterior) || 0)}%` }} animate={{ width: `${Math.min(100, Number(p.valor_actual) || 0)}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${deltaTone}`}><DeltaIcon size={13} /> {delta > 0 ? '+' : ''}{delta} pts</span>
              </div>

              <p className="text-sm leading-relaxed text-v-muted [overflow-wrap:anywhere]">{p.descripcion}</p>

              <div className="flex items-start gap-2.5 rounded-v-sm border border-v-accent/20 bg-v-accent-soft p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-v-elevated text-v-accent"><Lightbulb size={14} /></span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-v-accent">{locale === 'en' ? 'Suggested action' : 'Acción sugerida'}</p>
                  <p className="text-sm leading-relaxed text-v-text">{p.accion_sugerida}</p>
                </div>
              </div>

              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-v-subtle">
                <span>{locale === 'en' ? 'Based on' : 'Basado en'} <strong className="font-semibold text-v-muted">{p.sesiones_involucradas} {locale === 'en' ? 'sessions' : 'sesiones'}</strong></span>
                <span>· {p.semanas_detectado} {locale === 'en' ? 'wks of monitoring' : 'sem. de monitoreo'}</span>
                <span className="sm:hidden">· {locale === 'en' ? 'Confidence' : 'Confianza'} {conf}%</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Negritas **…** (y limpia asteriscos sueltos que deja la IA)
function RenderMD({ text }: { text: string }) {
  const parts = String(text || '').split(/\*\*(.+?)\*\*/g)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <strong key={i} className="font-semibold text-v-text">{part}</strong>
          : <span key={i}>{part.replace(/\*\*/g, '')}</span>
      )}
    </>
  )
}

const SECTION_CFG = [
  { keys: ['ESTADO CLÍNICO', 'ESTADO CLINICO', 'ESTADO GENERAL', 'CLINICAL STATUS'],     Icon: Stethoscope,   tone: 'bg-v-success/15 text-v-success',  dot: 'bg-v-success' },
  { keys: ['POR PROGRAMA', 'BY INTERVENTION', 'BY PROGRAM'],                          Icon: ClipboardList, tone: 'bg-v-accent-soft text-v-accent',  dot: 'bg-v-accent' },
  { keys: ['MONITOREO', 'MONITORING', 'PRÓXIMOS PASOS', 'NEXT STEPS'],                Icon: TrendingUp,    tone: 'bg-v-success/15 text-v-success',  dot: 'bg-v-success' },
  { keys: ['FAMILIA', 'FAMILY'],                                                       Icon: Heart,         tone: 'bg-v-accent-soft text-v-accent',  dot: 'bg-v-accent' },
  { keys: ['PRIORIDADES', 'PRIORIT'],                                                  Icon: Target,        tone: 'bg-v-danger/10 text-v-danger',    dot: 'bg-v-danger' },
  { keys: ['INTERPRETACI', 'INTERPRETATION'],                                   Icon: Brain,      tone: 'bg-v-accent-soft text-v-accent',  dot: 'bg-v-accent' },
  { keys: ['HIPÓTESIS', 'HIPOTESIS', 'HYPOTHES'],                               Icon: Lightbulb,  tone: 'bg-v-warning/15 text-v-warning',  dot: 'bg-v-warning' },
  { keys: ['ANÁLISIS FUNCIONAL', 'ANALISIS FUNCIONAL', 'FUNCTIONAL'],           Icon: Activity,   tone: 'bg-v-accent-soft text-v-accent',  dot: 'bg-v-accent' },
  { keys: ['INDICACIONES', 'INTERVENCI', 'RECOMENDACI', 'RECOMMEND', 'TREATMENT'], Icon: Target,  tone: 'bg-v-danger/10 text-v-danger',    dot: 'bg-v-danger' },
  { keys: ['PRONÓSTICO', 'PRONOSTICO', 'CRITERIOS DE AVANCE', 'PROGNOSIS'],     Icon: TrendingUp, tone: 'bg-v-success/15 text-v-success',  dot: 'bg-v-success' },
  { keys: ['SEÑAL POSITIVA', 'FORTALEZA', 'STRENGTH'],                          Icon: Trophy,     tone: 'bg-v-success/15 text-v-success',  dot: 'bg-v-success' },
] as const

function getSectionCfg(text: string) {
  const upper = text.toUpperCase()
  return SECTION_CFG.find(s => (s.keys as readonly string[]).some(k => upper.includes(k))) || null
}

type MdBlock = { type: 'p' | 'ol' | 'ul'; items: string[] }
type MdSection = { label: string; blocks: MdBlock[] }

// Convierte el markdown de la IA (### títulos, ---, **negritas**, listas) en secciones.
function parseInforme(texto: string) {
  const meta: { k: string; v: string }[] = []
  const sections: MdSection[] = []
  let titulo = ''
  let cur: MdSection = { label: '', blocks: [] }
  let para: string[] = []
  const flush = () => { if (para.length) { cur.blocks.push({ type: 'p', items: [para.join(' ')] }); para = [] } }
  const pushItem = (type: 'ol' | 'ul', txt: string) => {
    flush()
    const last = cur.blocks[cur.blocks.length - 1]
    if (last && last.type === type) last.items.push(txt)
    else cur.blocks.push({ type, items: [txt] })
  }

  for (const raw of String(texto || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) { flush(); continue }
    if (/^([-*_])\1{2,}$/.test(line)) { flush(); continue }
    const h = line.match(/^#{1,6}\s+(.+)$/) || line.match(/^\*\*([^*]{3,90})\*\*:?$/)
    if (h) {
      flush()
      const label = h[1].replace(/\*\*/g, '').replace(/:\s*$/, '').trim()
      if (!titulo && sections.length === 0 && cur.blocks.length === 0 && /^(INFORME|REPORT|CLINICAL REPORT)/i.test(label)) { titulo = label; continue }
      if (cur.label || cur.blocks.length) sections.push(cur)
      cur = { label, blocks: [] }
      continue
    }
    const inl = line.match(/^\*\*([A-ZÁÉÍÓÚÑÜ0-9][A-ZÁÉÍÓÚÑÜ0-9 ,/()&\-–—]{5,90})\*\*:?\s+(.+)$/)
    if (inl) {
      flush()
      if (cur.label || cur.blocks.length) sections.push(cur)
      cur = { label: inl[1].trim(), blocks: [] }
      para.push(inl[2])
      continue
    }
    const kv = !cur.label && (line.match(/^\*\*([^*]{2,40}?):\*\*\s*(.+)$/) || line.match(/^\*\*([^*]{2,40})\*\*:\s*(.+)$/))
    if (kv) { flush(); meta.push({ k: kv[1].trim(), v: kv[2].replace(/\*\*/g, '').trim() }); continue }
    const ol = line.match(/^(\d+)[.)]\s+(.+)$/)
    if (ol) { pushItem('ol', ol[2]); continue }
    const ul = line.match(/^[-•▸*]\s+(.+)$/)
    if (ul) { pushItem('ul', ul[1]); continue }
    para.push(line)
  }
  flush()
  if (cur.label || cur.blocks.length) sections.push(cur)
  return { titulo, meta, sections }
}

// "ANÁLISIS DE PATRONES ABA" → "Análisis de patrones ABA" (respeta siglas cortas)
const aOracion = (x: string) => x === x.toUpperCase()
  ? x.toLowerCase().replace(/(^|[^a-záéíóúñ])(aba|tea|tdah|ablls-?r)(?![a-záéíóúñ])/gi, (_m, pre, sig) => pre + sig.toUpperCase()).replace(/^./, c => c.toUpperCase())
  : x

function ResumenIACard({ texto, titulo: tituloProp, subtitulo }: { texto: string; titulo?: string; subtitulo?: string }) {
  const { t, locale } = useI18n()
  const { titulo, meta, sections } = parseInforme(texto)

  return (
    <div className="v-scope overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v">
      {/* Encabezado */}
      <div className="relative flex flex-wrap items-center gap-3 border-b border-v-border px-5 py-4 sm:px-6">
        <span aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" style={{ boxShadow: 'none' }} />
        <span className="v-brand grid size-10 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><Brain size={18} /></span>
        <div className="min-w-0 flex-[1_1_200px]">
          <p className="text-[15px] font-semibold tracking-tight text-v-text">{tituloProp ? aOracion(tituloProp.replace(/\s*[—–-]\s*.*$/, '')) : t('hub.informeNeuro')}</p>
          <p className="text-xs text-v-subtle">{subtitulo ? subtitulo : titulo ? aOracion(titulo.replace(/^INFORME CL[ÍI]NICO\s*[–—-]\s*/i, '')) : t('hub.analisisSupervision')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-2.5 py-1 text-[11px] font-semibold text-v-accent"><Sparkles size={11} /> IA</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-v-fill px-2.5 py-1 text-[11px] font-semibold text-v-muted"><Lock size={11} /> {locale === 'en' ? 'Confidential' : 'Confidencial'}</span>
        </div>
      </div>

      {/* Datos del informe (Paciente, Periodo…) */}
      {meta.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-v-border bg-v-bg px-5 py-3 sm:px-6">
          {meta.map(m => (
            <span key={m.k} className="inline-flex max-w-full items-baseline gap-1.5 rounded-full border border-v-border bg-v-elevated px-3 py-1 text-xs">
              <span className="shrink-0 text-v-subtle">{m.k}</span>
              <span className="min-w-0 truncate font-semibold text-v-text">{m.v}</span>
            </span>
          ))}
        </div>
      )}

      {/* Secciones */}
      <div className="divide-y divide-v-border">
        {sections.map((sec, si) => {
          const cfg = getSectionCfg(sec.label)
          const Icon = cfg?.Icon || FileText
          const tone = cfg?.tone || 'bg-v-fill text-v-muted'
          const dot = cfg?.dot || 'bg-v-subtle'
          return (
            <motion.section key={si} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(si, 6) * 0.05 }}
              className="px-5 py-5 sm:px-6">
              {sec.label && (
                <h4 className="mb-3 flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-v-text">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-[30%] ${tone}`}><Icon size={16} /></span>
                  {aOracion(sec.label)}
                </h4>
              )}
              <div className="space-y-3 text-sm leading-relaxed text-v-muted sm:pl-[42px]">
                {sec.blocks.map((bl, bi) => {
                  if (bl.type === 'p') return <p key={bi} className="[overflow-wrap:anywhere]"><RenderMD text={bl.items[0]} /></p>
                  if (bl.type === 'ol') return (
                    <ol key={bi} className="space-y-2.5">
                      {bl.items.map((it, ii) => (
                        <li key={ii} className="flex items-start gap-3">
                          <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${tone}`}>{ii + 1}</span>
                          <p className="min-w-0 flex-1 [overflow-wrap:anywhere]"><RenderMD text={it} /></p>
                        </li>
                      ))}
                    </ol>
                  )
                  return (
                    <ul key={bi} className="space-y-2">
                      {bl.items.map((it, ii) => {
                        const m = it.match(/^\*\*(.+?)\*\*[:\s]*(.*)$/)
                        if (m) return (
                          <li key={ii} className="rounded-v-sm border border-v-border bg-v-bg px-3.5 py-3">
                            <p className="flex items-start gap-2 font-semibold text-v-text [overflow-wrap:anywhere]"><span className={`mt-2 size-1.5 shrink-0 rounded-full ${dot}`} />{m[1].replace(/:$/, '')}</p>
                            {m[2] && <p className="mt-1 pl-3.5 [overflow-wrap:anywhere]"><RenderMD text={m[2]} /></p>}
                          </li>
                        )
                        return (
                          <li key={ii} className="flex items-start gap-2.5">
                            <span className={`mt-2 size-1.5 shrink-0 rounded-full ${dot}`} />
                            <p className="min-w-0 flex-1 [overflow-wrap:anywhere]"><RenderMD text={it} /></p>
                          </li>
                        )
                      })}
                    </ul>
                  )
                })}
              </div>
            </motion.section>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-v-border bg-v-bg px-5 py-3 text-[11px] text-v-subtle sm:px-6">
        <p>{t('hub.generadoAnalista')}</p>
        <p>{new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
      </div>
    </div>
  )
}


function TabPatrones({ pacientes }: { pacientes: Paciente[] }) {
  const { t, locale } = useI18n()
  const [selected, setSelected] = useState<Paciente | null>(null)
  const [resultado, setResultado] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const analizar = async () => {
    if (!selected) return
    setLoading(true); setError(''); setResultado(null)
    try {
      const res = await fetch('/api/agente-patrones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ locale: localStorage.getItem('vanty_locale') || 'es', childId: selected.id, childName: selected.name }),
      })
      const json = await res.json()
      if (res.status === 402 && json.code === 'quota_exhausted') avisarTokens(true)
      if (json.error) throw new Error(json.error)
      setResultado(json)
      avisarTokens(false)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const urgentes = resultado?.patrones?.filter((p: any) => p.tipo === 'regresion' || p.tipo === 'estancamiento') || []
  const positivos = resultado?.patrones?.filter((p: any) => p.tipo === 'aceleracion' || p.tipo === 'dominio') || []
  const otros = resultado?.patrones?.filter((p: any) => p.tipo === 'inconsistencia') || []

  return (
    <div className="space-y-5">
      {/* Header informativo */}
      <div className="relative overflow-hidden rounded-v border border-v-border bg-v-elevated p-5 shadow-v">
        <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
        <div className="mb-2 flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Activity size={18} /></span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-tight text-v-text">{t("hub.detectorPatrones")}</p>
            <p className="text-xs text-v-subtle">{t("hub.analisisRegresiones")}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-v-border pt-3">
          {[
            { Icon: TrendingDown, label: 'Regresión',     labelEn: 'Regression',    color: '#ef4444' },
            { Icon: Minus,        label: 'Estancamiento',  labelEn: 'Plateau',       color: '#f59e0b' },
            { Icon: TrendingUp,   label: 'Aceleración',    labelEn: 'Acceleration',  color: '#10b981' },
            { Icon: Activity,     label: 'Variabilidad',   labelEn: 'Variability',   color: '#0891b2' },
            { Icon: Award,        label: 'Dominio',        labelEn: 'Mastery',       color: '#0069db' },
          ].map(item => (
            <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full bg-v-fill px-2.5 py-1 text-[11px] font-medium text-v-muted">
              <item.Icon size={12} style={{ color: item.color }} />
              {locale === 'en' ? item.labelEn : item.label}
            </span>
          ))}
        </div>
      </div>

      {/* Selector + botón */}
      <div className="relative z-10 space-y-4 rounded-v border border-v-border bg-v-elevated p-5 shadow-v">
        <div>
          <label className="mb-2 block text-xs font-semibold text-v-muted">
            {t('auto.inteligenciaHubView.seleccionaPaciente')}
          </label>
          <PacientePicker pacientes={pacientes} value={selected} onChange={setSelected} placeholder={t('auto.inteligenciaHubView.seleccionarPaciente')} />
        </div>
        <motion.button whileTap={{ scale: 0.98 }} onClick={analizar} disabled={!selected || loading}
          className="v-brand flex h-12 w-full items-center justify-center gap-2.5 rounded-full text-sm font-semibold transition-opacity disabled:opacity-40 disabled:shadow-none">
          {loading
            ? <><RefreshCw size={15} className="animate-spin" /> {t("hub.analizandoHistorial")}</>
            : <><Activity size={15} /> {t("hub.detectarPatrones")}</>}
        </motion.button>
        {error && (
          <div className="rounded-v-sm px-4 py-3 text-xs font-medium"
            style={{ background: 'var(--v-fill)', color: 'var(--v-text-secondary)', border: '1px solid var(--v-border)', borderLeft: '1px solid #ef4444' }}>
            {error}
          </div>
        )}
      </div>

      {/* Resultados */}
      {resultado && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: locale === 'en' ? 'Sessions analyzed' : 'Sesiones analizadas', val: resultado.sesiones_analizadas || 0, color: '#0069db', Icon: FileText },
              { label: locale === 'en' ? 'Patterns detected' : 'Patrones detectados', val: resultado.patrones?.length || 0,   color: '#0891b2', Icon: Search },
              { label: locale === 'en' ? 'Need attention' : 'Requieren atención',  val: resultado.patrones_urgentes || 0,   color: resultado.patrones_urgentes > 0 ? '#ef4444' : '#10b981', Icon: resultado.patrones_urgentes > 0 ? AlertTriangle : CheckCircle },
            ].map(m => (
              <motion.div key={m.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }}
                className="group rounded-v border border-v-border bg-v-elevated p-4 shadow-v">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium leading-tight text-v-muted">{m.label}</p>
                  <span className="grid size-9 shrink-0 place-items-center rounded-[30%] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
                    style={{ background: `${m.color}1a`, color: m.color }}><m.Icon size={16} /></span>
                </div>
                <p className="mt-1 text-3xl font-bold leading-none tracking-tight tabular-nums text-v-text">{m.val}</p>
              </motion.div>
            ))}
          </div>

          {/* Sin patrones */}
          {resultado.patrones?.length === 0 && (
            <div className="rounded-v p-8 text-center border"
              style={{ background: 'var(--v-fill)', borderColor: 'var(--v-border)' }}>
              <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-v-success/15 text-v-success"><CheckCircle size={22} /></span>
              <p className="font-bold text-sm mb-1" style={{ color: '#10b981' }}>{t("hub.progresoEstable")}</p>
              <p className="text-xs" style={{ color: 'var(--v-text-tertiary)' }}>
                {resultado.resumen || (locale === 'en' ? `No problematic patterns in ${resultado.sesiones_analizadas} sessions.` : `Sin patrones problemáticos en ${resultado.sesiones_analizadas} sesiones.`)}
              </p>
            </div>
          )}

          {/* Patrones urgentes — primero abierto, resto colapsado */}
          {urgentes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 pt-1">
                <span className="grid size-7 place-items-center rounded-full bg-v-danger/10 text-v-danger"><AlertTriangle size={14} /></span>
                <p className="text-sm font-semibold text-v-text">
                  {t('auto.inteligenciaHubView.requierenAtencionInmediata', { v1: String(urgentes.length) })}
                </p>
              </div>
              {urgentes.map((p: any, i: number) => <PatronCard key={i} p={p} index={i} defaultOpen={i === 0} />)}
            </div>
          )}

          {/* Patrones positivos — todos colapsados (info celebratoria, no urgente) */}
          {positivos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 pt-1">
                <span className="grid size-7 place-items-center rounded-full bg-v-success/15 text-v-success"><Trophy size={14} /></span>
                <p className="text-sm font-semibold text-v-text">
                  {t('auto.inteligenciaHubView.logrosClinicos', { v1: String(positivos.length) })}
                </p>
              </div>
              {positivos.map((p: any, i: number) => <PatronCard key={i} p={p} index={i} defaultOpen={false} />)}
            </div>
          )}

          {/* Otros — todos colapsados */}
          {otros.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 pt-1">
                <span className="grid size-7 place-items-center rounded-full bg-v-accent-soft text-v-accent"><Activity size={14} /></span>
                <p className="text-sm font-semibold text-v-text">
                  Otras Observaciones ({otros.length})
                </p>
              </div>
              {otros.map((p: any, i: number) => <PatronCard key={i} p={p} index={i} defaultOpen={false} />)}
            </div>
          )}

          {/* Informe Clínico IA */}
          {(resultado.analisis_ia || resultado.resumen) && resultado.patrones?.length > 0 && (
            <ResumenIACard texto={resultado.analisis_ia || resultado.resumen} />
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: OBJETIVOS ADAPTATIVOS (CAPA 1)
// ═══════════════════════════════════════════════════════════════════════════════
// Mapea la prioridad (viene de la IA en ES: alta/media/baja) a etiqueta según idioma
function prioridadLabel(p: string, locale: string): string {
  const v = String(p || '').toLowerCase()
  if (locale === 'en') {
    if (v === 'alta' || v === 'high') return 'High'
    if (v === 'media' || v === 'medium') return 'Medium'
    if (v === 'baja' || v === 'low') return 'Low'
  }
  return p
}

// Mapea el estado de evaluación de dominio a etiqueta legible según idioma
function estadoLabel(e: string, locale: string): string {
  const v = String(e || '').toLowerCase()
  const map: Record<string, string> = {
    listo_para_avanzar: locale === 'en' ? 'ready to advance' : 'listo para avanzar',
    mantener: locale === 'en' ? 'maintain' : 'mantener',
    necesita_ajuste: locale === 'en' ? 'needs adjustment' : 'necesita ajuste',
  }
  return map[v] || String(e || '').replace(/_/g, ' ')
}

function TabObjetivos({ pacientes }: { pacientes: Paciente[] }) {
  const { t, locale } = useI18n()

  const [selected, setSelected] = useState<Paciente | null>(null)
  const [resultado, setResultado] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [accion, setAccion] = useState<'generar' | 'ajustar' | 'evaluar_dominio'>('generar')
  const [error, setError] = useState('')

  const ejecutar = async () => {
    if (!selected) return
    setLoading(true); setError(''); setResultado(null)
    try {
      const res = await fetch('/api/agente-objetivos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ locale: localStorage.getItem('vanty_locale') || 'es', childId: selected.id, childName: selected.name, accion }),
      })
      const json = await res.json()
      if (res.status === 402 && json.code === 'quota_exhausted') avisarTokens(true)
      if (json.error) throw new Error(json.error)
      setResultado(json)
      avisarTokens(false)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const ACCIONES = [
    { val: 'generar' as const, Icon: Sparkles, label: locale === 'en' ? 'Generate new' : 'Generar nuevos',
      desc: locale === 'en' ? 'New goals based on current progress' : 'Objetivos nuevos según el progreso actual' },
    { val: 'ajustar' as const, Icon: SlidersHorizontal, label: locale === 'en' ? 'Adjust existing' : 'Ajustar existentes',
      desc: locale === 'en' ? 'What to change in active programs' : 'Qué cambiar en los programas activos' },
    { val: 'evaluar_dominio' as const, Icon: Trophy, label: locale === 'en' ? 'Evaluate mastery' : 'Evaluar dominio',
      desc: locale === 'en' ? 'Which programs are ready to advance' : 'Qué programas están listos para avanzar' },
  ]
  const PRIO_TONE: Record<string, { pill: string; bar: string }> = {
    alta:  { pill: 'bg-v-danger/10 text-v-danger', bar: 'bg-v-danger' },
    media: { pill: 'bg-v-warning/15 text-v-warning', bar: 'bg-v-warning' },
    baja:  { pill: 'bg-v-accent-soft text-v-accent', bar: 'bg-v-accent' },
  }
  const ESTADO_TONE: Record<string, { pill: string; bar: string; Icon: any }> = {
    listo_para_avanzar: { pill: 'bg-v-success/15 text-v-success', bar: 'bg-v-success', Icon: Trophy },
    necesita_ajuste:    { pill: 'bg-v-danger/10 text-v-danger', bar: 'bg-v-danger', Icon: AlertTriangle },
  }
  // La IA escribe "SD: … R: … Consecuencia: …" en un solo párrafo: lo separamos en filas legibles.
  const partesDescripcion = (txt: string): { k: string; v: string }[] | null => {
    const re = /(?:^|\s)(SD|R|Consecuencia|Consequence)\s*:\s*/g
    const marks = [...String(txt || '').matchAll(re)]
    if (marks.length < 2) return null
    return marks.map((m, i) => ({
      k: m[1] === 'SD' ? (locale === 'en' ? 'Instruction (SD)' : 'Instrucción (SD)') : m[1] === 'R' ? (locale === 'en' ? 'Expected response' : 'Respuesta esperada') : (locale === 'en' ? 'Consequence' : 'Consecuencia'),
      v: txt.slice((m.index ?? 0) + m[0].length, i + 1 < marks.length ? marks[i + 1].index : undefined).trim().replace(/\.$/, ''),
    }))
  }
  const cardCls = 'relative overflow-hidden rounded-v border border-v-border bg-v-elevated p-4 pl-5 shadow-v sm:p-5 sm:pl-6'
  const r = resultado?.resultado || {}
  const nObjetivos = (r.objetivos_sugeridos?.length || 0) + (r.ajustes?.length || 0) + (r.evaluaciones?.length || 0)

  return (
    <div className="space-y-4">
      {/* ── Generador ── */}
      <div className="rounded-v border border-v-border bg-v-elevated p-4 shadow-v sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="v-brand grid size-10 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><Target size={18} /></span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-tight text-v-text">{locale === 'en' ? 'Adaptive goals' : 'Objetivos adaptativos'}</p>
            <p className="text-xs text-v-subtle">{t('hub.generaAjustaObjetivos')}</p>
          </div>
        </div>

        <p className="mb-1.5 text-xs font-semibold text-v-muted">{locale === 'en' ? 'Patient' : 'Paciente'}</p>
        <PacientePicker pacientes={pacientes} value={selected} onChange={setSelected} placeholder={t('hub.selecPaciente')} />

        <p className="mb-1.5 mt-4 text-xs font-semibold text-v-muted">{locale === 'en' ? 'What do you want to do?' : '¿Qué querés hacer?'}</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {ACCIONES.map(({ val, Icon, label, desc }) => {
            const on = accion === val
            return (
              <button key={val} onClick={() => setAccion(val)}
                className={`flex items-center gap-3 rounded-v-sm border p-3 text-left transition-all ${on ? 'border-v-accent bg-v-accent-soft ring-1 ring-v-accent' : 'border-v-border bg-v-elevated hover:border-v-accent/40'}`}>
                <span className={`grid size-10 shrink-0 place-items-center rounded-[30%] transition-colors ${on ? 'bg-v-accent text-white' : 'bg-v-fill text-v-muted'}`}><Icon size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${on ? 'text-v-accent' : 'text-v-text'}`}>{label}</span>
                  <span className="block text-xs leading-snug text-v-subtle">{desc}</span>
                </span>
                <span className={`grid size-5 shrink-0 place-items-center rounded-full border transition-colors ${on ? 'border-v-accent bg-v-accent text-white' : 'border-v-border'}`}>{on && <Check size={12} strokeWidth={3} />}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-xs text-v-subtle">
            {selected ? `${ACCIONES.find(x => x.val === accion)?.label} · ${selected.name}` : (locale === 'en' ? 'Choose a patient to continue.' : 'Elegí un paciente para continuar.')}
          </p>
          <button onClick={ejecutar} disabled={!selected || loading}
            className="v-brand inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-50">
            {loading ? <><RefreshCw size={15} className="animate-spin" /> {t('common.procesando')}</> : <><Sparkles size={15} /> {t('hub.ejecutar')}</>}
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-start gap-2.5 rounded-v-sm bg-v-danger/10 px-3.5 py-3 text-sm text-v-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /><p className="min-w-0 [overflow-wrap:anywhere]">{error}</p>
          </div>
        )}
      </div>

      {/* ── Resultados ── */}
      {resultado && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
            <p className="text-sm font-semibold text-v-text">
              {nObjetivos} {accion === 'generar' ? (locale === 'en' ? 'suggested goals' : 'objetivos sugeridos') : accion === 'ajustar' ? (locale === 'en' ? 'suggested adjustments' : 'ajustes sugeridos') : (locale === 'en' ? 'programs evaluated' : 'programas evaluados')}
            </p>
            <p className="text-xs text-v-subtle">
              {locale === 'en' ? 'Based on' : 'Basado en'} {resultado.programas_analizados || 0} {locale === 'en' ? 'programs' : 'programas'} · {resultado.patrones_considerados || 0} {locale === 'en' ? 'patterns' : 'patrones'}
            </p>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {/* generar */}
            {(r.objetivos_sugeridos || []).map((obj: any, i: number) => {
              const tone = PRIO_TONE[String(obj.prioridad || '').toLowerCase()] || PRIO_TONE.baja
              const partes = partesDescripcion(obj.descripcion)
              return (
                <motion.div key={`g${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }} className={cardCls}>
                  <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} />
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    {obj.area && <span className="rounded-full bg-v-fill px-2.5 py-0.5 text-[11px] font-semibold text-v-muted">{obj.area}</span>}
                    {obj.prioridad && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${tone.pill}`}>{prioridadLabel(obj.prioridad, locale)}</span>}
                  </div>
                  <p className="text-[15px] font-semibold leading-snug tracking-tight text-v-text [overflow-wrap:anywhere]">{obj.titulo}</p>
                  {partes ? (
                    <dl className="mt-3 space-y-2">
                      {partes.map(pt => (
                        <div key={pt.k} className="grid gap-0.5 sm:grid-cols-[150px_1fr] sm:gap-3">
                          <dt className="text-xs font-semibold text-v-subtle">{pt.k}</dt>
                          <dd className="text-sm leading-relaxed text-v-muted [overflow-wrap:anywhere]">{pt.v}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : obj.descripcion && <p className="mt-2 text-sm leading-relaxed text-v-muted [overflow-wrap:anywhere]">{obj.descripcion}</p>}
                  {(obj.criterio_dominio || obj.metodologia) && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {obj.criterio_dominio && (
                        <div className="rounded-v-sm border border-v-border bg-v-bg p-3">
                          <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-v-success"><CheckCircle size={12} /> {locale === 'en' ? 'Mastery criterion' : 'Criterio de dominio'}</p>
                          <p className="text-xs leading-relaxed text-v-text [overflow-wrap:anywhere]">{obj.criterio_dominio}</p>
                        </div>
                      )}
                      {obj.metodologia && (
                        <div className="rounded-v-sm border border-v-border bg-v-bg p-3">
                          <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-v-accent"><ClipboardList size={12} /> {locale === 'en' ? 'Method' : 'Método'}</p>
                          <p className="text-xs leading-relaxed text-v-text [overflow-wrap:anywhere]">{obj.metodologia}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {obj.justificacion_clinica && (
                    <div className="mt-3 flex items-start gap-2.5 rounded-v-sm bg-v-accent-soft px-3.5 py-2.5">
                      <Lightbulb size={15} className="mt-0.5 shrink-0 text-v-accent" />
                      <p className="text-xs leading-relaxed text-v-text [overflow-wrap:anywhere]"><span className="font-semibold text-v-accent">{locale === 'en' ? 'Why: ' : 'Por qué: '}</span>{obj.justificacion_clinica}</p>
                    </div>
                  )}
                </motion.div>
              )
            })}

            {/* ajustar */}
            {(r.ajustes || []).map((obj: any, i: number) => (
              <motion.div key={`a${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }} className={cardCls}>
                <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-v-accent" />
                <p className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-v-text"><SlidersHorizontal size={15} className="shrink-0 text-v-accent" /> {obj.area}</p>
                <dl className="mt-3 space-y-2">
                  <div className="grid gap-0.5 sm:grid-cols-[120px_1fr] sm:gap-3">
                    <dt className="text-xs font-semibold text-v-subtle">{locale === 'en' ? 'What to adjust' : 'Qué ajustar'}</dt>
                    <dd className="text-sm leading-relaxed text-v-muted [overflow-wrap:anywhere]">{obj.que_ajustar}</dd>
                  </div>
                  <div className="grid gap-0.5 sm:grid-cols-[120px_1fr] sm:gap-3">
                    <dt className="text-xs font-semibold text-v-subtle">{locale === 'en' ? 'How' : 'Cómo'}</dt>
                    <dd className="text-sm leading-relaxed text-v-muted [overflow-wrap:anywhere]">{obj.como_ajustar}</dd>
                  </div>
                </dl>
                {obj.meta_4_semanas && (
                  <div className="mt-3 flex items-start gap-2.5 rounded-v-sm bg-v-accent-soft px-3.5 py-2.5">
                    <Target size={15} className="mt-0.5 shrink-0 text-v-accent" />
                    <p className="text-xs leading-relaxed text-v-text [overflow-wrap:anywhere]"><span className="font-semibold text-v-accent">{locale === 'en' ? '4-week goal: ' : 'Meta a 4 semanas: '}</span>{obj.meta_4_semanas}</p>
                  </div>
                )}
              </motion.div>
            ))}

            {/* evaluar_dominio */}
            {(r.evaluaciones || []).map((obj: any, i: number) => {
              const tone = ESTADO_TONE[obj.estado] || { pill: 'bg-v-fill text-v-muted', bar: 'bg-v-border', Icon: Clock }
              return (
                <motion.div key={`e${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }} className={cardCls}>
                  <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} />
                  <div className="flex flex-wrap items-start gap-2">
                    <p className="min-w-0 flex-[1_1_200px] text-[15px] font-semibold leading-snug tracking-tight text-v-text [overflow-wrap:anywhere]">{obj.programa}</p>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone.pill}`}><tone.Icon size={11} /> {estadoLabel(obj.estado, locale)}</span>
                  </div>
                  {obj.accion && <p className="mt-2 text-sm leading-relaxed text-v-text [overflow-wrap:anywhere]"><span className="font-semibold">{locale === 'en' ? 'Action: ' : 'Acción: '}</span>{obj.accion}</p>}
                  {obj.justificacion && <p className="mt-1 text-sm leading-relaxed text-v-muted [overflow-wrap:anywhere]">{obj.justificacion}</p>}
                  {obj.siguiente_paso && (
                    <div className="mt-3 flex items-start gap-2.5 rounded-v-sm bg-v-accent-soft px-3.5 py-2.5">
                      <ChevronRight size={15} className="mt-0.5 shrink-0 text-v-accent" />
                      <p className="text-xs leading-relaxed text-v-text [overflow-wrap:anywhere]"><span className="font-semibold text-v-accent">{locale === 'en' ? 'Next step: ' : 'Siguiente paso: '}</span>{obj.siguiente_paso}</p>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>

          {/* texto_libre: el JSON no se pudo parsear */}
          {r.texto_libre && (
            <div className="rounded-v border border-v-border bg-v-elevated p-4 shadow-v">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-v-warning"><AlertTriangle size={13} /> {t('auto.inteligenciaHubView.respuestaSinFormatoElModelo')}</p>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-v-sm bg-v-bg p-3 font-sans text-xs leading-relaxed text-v-muted">{r.texto_libre}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type DocEmitido = {
  codigo_doc: string
  child_id: string | null
  tipo: string
  tipo_label: string
  paciente_nombre: string | null
  paciente_iniciales: string | null
  fecha_emision: string
  especialista: string | null
  valido: boolean
  file_name: string | null
  metadata: any
  notas: string | null
}

function TabReportes({ pacientes }: { pacientes: Paciente[] }) {
  const { t, locale } = useI18n()

  const [selected, setSelected] = useState<Paciente | null>(null)
  const [tipo, setTipo] = useState<'padres' | 'seguro' | 'comparativo'>('padres')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // ── Historial de documentos emitidos ───────────────────────────────────
  const [docs, setDocs] = useState<DocEmitido[]>([])
  const [stats, setStats] = useState<{ total_validos: number; total_invalidos: number; por_tipo: Record<string, number> } | null>(null)
  const [filterTipo, setFilterTipo] = useState<string>('')
  const [filterValido, setFilterValido] = useState<'' | '1' | '0'>('')
  const [filterQ, setFilterQ] = useState('')
  const [filterChildId, setFilterChildId] = useState<string>('')
  const [loadingDocs, setLoadingDocs] = useState(false)

  const cargarDocs = async () => {
    setLoadingDocs(true)
    try {
      const params = new URLSearchParams()
      if (filterChildId) params.set('child_id', filterChildId)
      if (filterTipo)    params.set('tipo', filterTipo)
      if (filterValido)  params.set('valido', filterValido)
      if (filterQ)       params.set('q', filterQ)
      const res = await fetch(`/api/admin/documentos-emitidos?${params.toString()}`)
      const json = await res.json()
      if (json.ok) {
        setDocs(json.documentos)
        setStats(json.stats)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingDocs(false)
    }
  }

  useEffect(() => { cargarDocs() }, [filterTipo, filterValido, filterChildId])

  const [invalidando, setInvalidando] = useState<{ codigo: string; motivo: string } | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [accionError, setAccionError] = useState('')

  const invalidar = async (codigoDoc: string, motivo: string) => {
    setAccionError('')
    try {
      const res = await fetch('/api/admin/documentos-emitidos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo_doc: codigoDoc, motivo: motivo.trim() || 'Reemitido' }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Error al invalidar')
      setInvalidando(null)
      await cargarDocs()
    } catch (e: any) { setAccionError(e.message) }
  }

  const eliminar = async (codigoDoc: string) => {
    setAccionError('')
    try {
      const res = await fetch(`/api/admin/documentos-emitidos?codigo_doc=${encodeURIComponent(codigoDoc)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Error al eliminar')
      setConfirmDel(null)
      await cargarDocs()
    } catch (e: any) { setAccionError(e.message) }
  }

  const generar = async () => {
    if (!selected) return
    setLoading(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/reporte-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ locale: localStorage.getItem('vanty_locale') || 'es', childId: selected.id, tipo }),
      })
      if (!res.ok) {
        const err = await res.json()
        if (res.status === 402 && err.code === 'quota_exhausted') avisarTokens(true)
        throw new Error(err.error || 'Error generando reporte')
      }
      avisarTokens(false)
      // Descargar el .docx directamente
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const cd = res.headers.get('content-disposition') || ''
      const match = cd.match(/filename="([^"]+)"/)
      a.download = match?.[1] || `Reporte_${tipo}_${selected.name}.docx`
      a.href = url
      a.click()
      URL.revokeObjectURL(url)
      setSuccess(`${t('docs.reporteDescargado')}: ${a.download}`)
      // Refrescar el historial de documentos emitidos
      setTimeout(() => cargarDocs(), 600)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const tipoInfo = {
    padres:      { label: t('docs.tPadresLabel'),      desc: t('docs.tPadresDesc'),      Icon: Users },
    seguro:      { label: t('docs.tClinicoLabel'),     desc: t('docs.tClinicoDesc'),     Icon: Stethoscope },
    comparativo: { label: t('docs.tComparativoLabel'), desc: t('docs.tComparativoDesc'), Icon: BarChart3 },
  }
  const DOC_ICON: Record<string, any> = {
    informe_clinico: Stethoscope, reporte_seguro: Stethoscope, reporte_padres: Users,
    reporte_comparativo: BarChart3, sesion_aba: ClipboardList,
  }
  const errorAmigable = (e: string) => /GROQ_API_KEY/i.test(e)
    ? (locale === 'en'
        ? 'The AI service is not configured on this server (missing GROQ_API_KEY), so the report text cannot be written. Add the key and restart the server.'
        : 'El servicio de IA no está configurado en este servidor (falta GROQ_API_KEY), por eso no se puede redactar el reporte. Agregá la clave y reiniciá el servidor.')
    : e
  const fieldCls = 'h-10 w-full rounded-full border border-v-border bg-v-elevated px-4 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none transition-colors focus:border-v-accent'

  return (
    <div className="space-y-4">
      {/* ── Generador ── */}
      <div className="rounded-v border border-v-border bg-v-elevated p-4 shadow-v sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="v-brand grid size-10 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><FileText size={18} /></span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-tight text-v-text">{locale === 'en' ? 'Generate Word report' : 'Generar reporte Word'}</p>
            <p className="text-xs text-v-subtle">{t('docs.capa2Desc')}</p>
          </div>
        </div>

        <p className="mb-1.5 text-xs font-semibold text-v-muted">{t('docs.paciente')}</p>
        <PacientePicker pacientes={pacientes} value={selected} onChange={setSelected} placeholder={t('docs.seleccionar')} />

        <p className="mb-1.5 mt-4 text-xs font-semibold text-v-muted">{t('hub.tipoReporte')}</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {(Object.entries(tipoInfo) as [typeof tipo, typeof tipoInfo['padres']][]).map(([k, v]) => {
            const on = tipo === k
            return (
              <button key={k} onClick={() => setTipo(k)}
                className={`relative flex items-center gap-3 rounded-v-sm border p-3 text-left transition-all ${on ? 'border-v-accent bg-v-accent-soft ring-1 ring-v-accent' : 'border-v-border bg-v-elevated hover:border-v-accent/40'}`}>
                <span className={`grid size-10 shrink-0 place-items-center rounded-[30%] transition-colors ${on ? 'bg-v-accent text-white' : 'bg-v-fill text-v-muted'}`}><v.Icon size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${on ? 'text-v-accent' : 'text-v-text'}`}>{v.label}</span>
                  <span className="block text-xs leading-snug text-v-subtle">{v.desc}</span>
                </span>
                <span className={`grid size-5 shrink-0 place-items-center rounded-full border transition-colors ${on ? 'border-v-accent bg-v-accent text-white' : 'border-v-border'}`}>{on && <Check size={12} strokeWidth={3} />}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-xs text-v-subtle">
            {selected
              ? (locale === 'en' ? `${tipoInfo[tipo].label} for ${selected.name}` : `${tipoInfo[tipo].label} de ${selected.name}`)
              : (locale === 'en' ? 'Choose a patient to continue.' : 'Elegí un paciente para continuar.')}
          </p>
          <button onClick={generar} disabled={!selected || loading}
            className="v-brand inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-50">
            {loading
              ? <><RefreshCw size={15} className="animate-spin" /> {t('docs.generandoWord')}</>
              : <><Download size={15} /> {t('docs.generarDescargar')}</>}
          </button>
        </div>

        <AnimatePresence>
          {(error || success) && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`mt-3 flex items-start gap-2.5 rounded-v-sm px-3.5 py-3 text-sm ${error ? 'bg-v-danger/10 text-v-danger' : 'bg-v-success/15 text-v-success'}`}>
              {error ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle size={16} className="mt-0.5 shrink-0" />}
              <p className="min-w-0 leading-relaxed [overflow-wrap:anywhere]">{error ? errorAmigable(error) : success}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Historial de documentos emitidos ── */}
      <div className="rounded-v border border-v-border bg-v-elevated p-4 shadow-v sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><BookOpen size={18} /></span>
          <div className="min-w-0 flex-[1_1_220px]">
            <p className="text-[15px] font-semibold tracking-tight text-v-text">{t('docs.historialTitulo')}</p>
            <p className="text-xs text-v-subtle">{t('docs.historialDesc')}</p>
          </div>
          {stats && (
            <div className="flex gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-v-success/15 px-2.5 py-1 text-xs font-semibold text-v-success"><CheckCircle size={12} /> {stats.total_validos} {t('docs.validos')}</span>
              {stats.total_invalidos > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-v-warning/15 px-2.5 py-1 text-xs font-semibold text-v-warning"><Ban size={12} /> {stats.total_invalidos} {t('docs.invalidados')}</span>
              )}
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-v-subtle" />
            <input type="text" placeholder={t('docs.buscarCodigoPac')} value={filterQ}
              onChange={e => setFilterQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') cargarDocs() }}
              className={`${fieldCls} pl-10 placeholder:text-v-subtle`} />
          </div>
          <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className={fieldCls}>
            <option value="">{t('docs.todosTipos')}</option>
            <option value="informe_clinico">{t('docs.tClinicoLabel')}</option>
            <option value="reporte_padres">{t('docs.tPadresLabel')}</option>
            <option value="reporte_comparativo">{t('docs.tComparativoLabel')}</option>
            <option value="reporte_seguro">{t('reportes.paraSeguro')}</option>
            <option value="anamnesis_inicial">{t('evaluaciones.historiaClinica')}</option>
            <option value="anamnesis_legacy">{t('evaluaciones.historiaClinica')}</option>
            <option value="sesion_aba">{t('evaluaciones.sesionAba')}</option>
            <option value="ficha_clinica">{t('evaluaciones.formularioClinico')}</option>
          </select>
          <select value={filterValido} onChange={e => setFilterValido(e.target.value as any)} className={fieldCls}>
            <option value="">{t('docs.todosEstados')}</option>
            <option value="1">{t('docs.soloValidos')}</option>
            <option value="0">{t('docs.soloInvalidados')}</option>
          </select>
        </div>

        {accionError && <p className="mb-3 rounded-v-sm bg-v-danger/10 px-3 py-2 text-sm text-v-danger">{accionError}</p>}

        {/* Lista */}
        {loadingDocs && docs.length === 0 ? (
          <div className="flex justify-center py-10"><RefreshCw size={22} className="animate-spin text-v-accent" /></div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center rounded-v-sm border border-dashed border-v-border py-10 text-center">
            <FileText size={22} className="mb-2 text-v-subtle" />
            <p className="text-sm text-v-subtle">{t('docs.sinDocs')}</p>
          </div>
        ) : (
          <div className="divide-y divide-v-border overflow-hidden rounded-v-sm border border-v-border">
            {docs.map(d => {
              const fecha = new Date(d.fecha_emision)
              const DI = DOC_ICON[d.tipo] || FileText
              const inv = invalidando?.codigo === d.codigo_doc
              const del = confirmDel === d.codigo_doc
              return (
                <div key={d.codigo_doc} className={`px-3.5 py-3 transition-colors ${d.valido ? 'hover:bg-v-fill' : 'bg-v-fill/60'}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] ${d.valido ? 'bg-v-accent-soft text-v-accent' : 'bg-v-fill text-v-subtle'}`}><DI size={16} /></span>
                    <div className="min-w-0 flex-[1_1_220px]">
                      <p className={`truncate text-sm font-semibold ${d.valido ? 'text-v-text' : 'text-v-muted line-through decoration-v-subtle/60'}`}>{d.tipo_label}</p>
                      <p className="truncate text-xs text-v-subtle">
                        <span className="font-mono text-v-accent">{d.codigo_doc}</span>
                        {' · '}{d.paciente_nombre || d.paciente_iniciales || '—'}
                        {' · '}{fecha.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}, {fecha.toLocaleTimeString(locale === 'en' ? 'en-US' : 'es-PE', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      {d.valido
                        ? <span className="mr-1 inline-flex items-center gap-1 rounded-full bg-v-success/15 px-2.5 py-0.5 text-[11px] font-semibold text-v-success"><CheckCircle size={11} /> {t('docs.valido')}</span>
                        : <span className="mr-1 inline-flex items-center gap-1 rounded-full bg-v-warning/15 px-2.5 py-0.5 text-[11px] font-semibold text-v-warning" title={d.notas || ''}><Ban size={11} /> {t('docs.invalidado')}</span>}
                      <a href={`/verificar/${encodeURIComponent(d.codigo_doc)}`} target="_blank" rel="noopener noreferrer" title={t('docs.verTitle')}
                        className="grid size-8 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-accent-soft hover:text-v-accent"><ExternalLink size={15} /></a>
                      {d.valido && (
                        <button onClick={() => { setConfirmDel(null); setInvalidando(inv ? null : { codigo: d.codigo_doc, motivo: '' }) }} title={t('docs.invalidarTitle')}
                          className={`grid size-8 place-items-center rounded-full transition-colors ${inv ? 'bg-v-warning/15 text-v-warning' : 'text-v-muted hover:bg-v-warning/15 hover:text-v-warning'}`}><Ban size={15} /></button>
                      )}
                      <button onClick={() => { setInvalidando(null); setConfirmDel(del ? null : d.codigo_doc) }} title={t('docs.eliminarTitle')}
                        className={`grid size-8 place-items-center rounded-full transition-colors ${del ? 'bg-v-danger/10 text-v-danger' : 'text-v-muted hover:bg-v-danger/10 hover:text-v-danger'}`}><Trash2 size={15} /></button>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {(inv || del) && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                        {inv ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-v-sm bg-v-warning/10 p-3">
                            <input autoFocus value={invalidando!.motivo} onChange={e => setInvalidando({ codigo: d.codigo_doc, motivo: e.target.value })}
                              onKeyDown={e => { if (e.key === 'Enter') invalidar(d.codigo_doc, invalidando!.motivo) }}
                              placeholder={locale === 'en' ? 'Reason (optional), e.g. reissued' : 'Motivo (opcional), p. ej. reemitido'}
                              className="h-9 min-w-0 flex-[1_1_200px] rounded-full border border-v-border bg-v-elevated px-3.5 text-sm text-v-text outline-none focus:border-v-warning" />
                            <button onClick={() => setInvalidando(null)} className="h-9 rounded-full px-3.5 text-sm font-semibold text-v-muted hover:bg-v-fill">{locale === 'en' ? 'Cancel' : 'Cancelar'}</button>
                            <button onClick={() => invalidar(d.codigo_doc, invalidando!.motivo)} className="h-9 rounded-full bg-v-warning px-4 text-sm font-semibold text-white">{t('docs.invalidar')}</button>
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-v-sm bg-v-danger/10 p-3">
                            <p className="min-w-0 flex-[1_1_240px] text-xs leading-relaxed text-v-danger">
                              {locale === 'en'
                                ? 'Delete permanently? The printed QR will show "invalid code". To just mark it obsolete, use Invalidate.'
                                : '¿Eliminar para siempre? El QR ya impreso mostrará "código no válido". Si solo querés marcarlo como obsoleto, usá Invalidar.'}
                            </p>
                            <button onClick={() => setConfirmDel(null)} className="h-9 rounded-full px-3.5 text-sm font-semibold text-v-muted hover:bg-v-fill">{locale === 'en' ? 'Cancel' : 'Cancelar'}</button>
                            <button onClick={() => eliminar(d.codigo_doc)} className="h-9 rounded-full bg-v-danger px-4 text-sm font-semibold text-white">{t('docs.eliminar')}</button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )}

        {docs.length > 0 && <p className="mt-3 text-center text-[11px] text-v-subtle">{t('docs.mostrando', { n: String(docs.length) })}</p>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function InteligenciaHubView({ enabledTabs }: { enabledTabs?: Record<string, boolean> } = {}) {
  const { t, locale } = useI18n()
  const [tab, setTab] = useState<Tab>('predicciones')
  const [pacientes, setPacientes] = useState<Paciente[]>([])

  useEffect(() => {
    // Usar API server-side que bypassa RLS de Supabase
    adminFetch('/api/admin/children')
      .then(r => r.json())
      .then(json => {
        const data = json.data || []
        setPacientes(data.map((r: any) => ({
          id: r.id,
          name: r.name || r.nombre || 'Sin nombre',
          diagnosis: r.diagnosis || r.diagnostico || '',
        })))
      })
      .catch(e => console.error('Error cargando pacientes Hub IA:', e))
  }, [])

  const tabs = ([
    { id: 'predicciones' as Tab, icon: Brain, label: t('hub.predicciones'), color: 'blue', featureKey: 'intel_predicciones' },
    { id: 'patrones' as Tab, icon: Activity, label: t('hub.tabPatrones'), color: 'violet', featureKey: 'intel_patrones' },
    { id: 'objetivos' as Tab, icon: Target, label: t('hub.tabObjetivos'), color: 'amber', featureKey: 'intel_objetivos' },
    { id: 'reportes' as Tab, icon: BookOpen, label: t('hub.tabReportes'), color: 'teal', featureKey: 'intel_reportes' },
  ] as const).filter(t => !enabledTabs || enabledTabs[t.featureKey] !== false)

  return (
    <div className="v-scope space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <span className="v-brand grid size-11 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><Zap size={20} /></span>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-v-text sm:text-xl">{t('hub.hubInteligencia')}</h1>
          <p className="text-xs text-v-subtle sm:text-sm">{t('auto.inteligenciaHubView.6AgentesIaPrediccionesPatrones')}</p>
        </div>
      </motion.div>

      {/* Pestañas */}
      <div className="flex gap-1 overflow-x-auto rounded-full bg-v-fill p-1" style={{ scrollbarWidth: 'none' }}>
        {tabs.map(tab_ => {
          const on = tab === tab_.id
          const corto = tab_.id === 'patrones' ? (locale === 'en' ? 'Patterns' : 'Patrones') : tab_.id === 'objetivos' ? (locale === 'en' ? 'Goals' : 'Objetivos') : tab_.id === 'reportes' ? (locale === 'en' ? 'Reports' : 'Reportes') : tab_.label
          return (
            <button key={tab_.id} onClick={() => setTab(tab_.id)}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors sm:flex-1 sm:justify-center ${on ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
              {on && <motion.span layoutId="hub-tab" className="absolute inset-0 rounded-full bg-v-elevated shadow-v" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <tab_.icon size={15} className="relative" />
              <span className="relative hidden sm:inline">{tab_.label}</span>
              <span className="relative sm:hidden">{corto}</span>
            </button>
          )
        })}
      </div>

      {/* Tokens de análisis: los usan Predicciones, Patrones, Objetivos y Reportes */}
      <TokensPrediccion />

      {/* Tab Content */}
      {tab === 'predicciones' && (
        <div className="flex-1 min-h-0">
          <TabPredicciones pacientes={pacientes} />
        </div>
      )}
      {tab === 'patrones' && <TabPatrones pacientes={pacientes} />}
      {tab === 'objetivos' && <TabObjetivos pacientes={pacientes} />}
      {tab === 'reportes' && <TabReportes pacientes={pacientes} />}
      {tab === 'seguridad' && (!enabledTabs || enabledTabs['intel_seguridad'] !== false) && <TabSeguridad />}
    </div>
  )
}
