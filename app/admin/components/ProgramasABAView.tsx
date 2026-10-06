'use client'

import { useI18n } from '@/lib/i18n-context'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import GraficoProgramaABA from '@/components/graficos/GraficoProgramaABA'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend, Cell, PieChart, Pie, ComposedChart, Area
} from 'recharts'
import {
  Plus, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  Target, BarChart3, BarChart2, Edit3, CheckCircle2, AlertTriangle, Clock,
  Loader2, X, Save, Activity, Zap, Brain, BookOpen, ArrowRight, Trash2, Search,
  MessageCircle, Users, Sparkles, Hand, ClipboardList, Trophy, Bell, FileDown,
  ChartLine, ChartColumnBig, ChartBarStacked, ChartPie, ListChecks, Layers, Pin, StickyNote, House
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useToast } from '@/components/Toast'
import { confirmar } from '@/components/ui/confirmar'

// ── Tipo de gráfico por programa (guardado en estado) ─────────────────────────
type TipoGrafico = 'lineas' | 'barras' | 'histograma' | 'pie'

const TIPOS_GRAFICO_PROGRAMA = [
  { id: 'lineas'    as TipoGrafico, emoji: '📈', label: 'Líneas' },
  { id: 'barras'    as TipoGrafico, emoji: '📊', label: 'Barras' },
  { id: 'histograma'as TipoGrafico, emoji: '🗂️', label: 'Histograma' },
  { id: 'pie'       as TipoGrafico, emoji: '🥧', label: 'Pie' },
]

function colorPorPct(pct: number) {
  if (pct >= 90) return '#1fae6b'
  if (pct >= 70) return '#0069db'
  if (pct >= 45) return '#f59e0b'
  return '#ef4444'
}

// ── Colores por área ────────────────────────────────────────────────────────
const AREA_COLOR: Record<string, { dot: string }> = {
  comunicacion: { dot: '#3d6eaa' },
  conducta:     { dot: '#aa4a4a' },
  cognitivo:    { dot: '#6a4aaa' },
  social:       { dot: '#2e8a60' },
  autonomia:    { dot: '#9a7020' },
  academico:    { dot: '#3a7aaa' },
  sensorial:    { dot: '#aa5a80' },
}

const AREA_CONFIG: Record<string, { color: string; bg: string; label: string; emoji: string; Icon: any; accent: string }> = {
  comunicacion: { color: 'text-sky-700 dark:text-sky-300',     bg: 'bg-sky-50 dark:bg-sky-900/25 border-sky-200 dark:border-sky-800',         label: 'Comunicación',   emoji: '💬', Icon: MessageCircle, accent: '#0069db' },
  conducta:     { color: 'text-rose-700 dark:text-rose-300',   bg: 'bg-rose-50 dark:bg-rose-900/25 border-rose-200 dark:border-rose-800',     label: 'Conducta',       emoji: '🎯', Icon: Target,        accent: '#e11d48' },
  cognitivo:    { color: 'text-cyan-700 dark:text-cyan-300',   bg: 'bg-cyan-50 dark:bg-cyan-900/25 border-cyan-200 dark:border-cyan-800',     label: 'Cognitivo',      emoji: '🧠', Icon: Brain,         accent: '#0891b2' },
  social:       { color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/25 border-emerald-200 dark:border-emerald-800', label: 'Social', emoji: '👥', Icon: Users,    accent: '#1fae6b' },
  autonomia:    { color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/25 border-amber-200 dark:border-amber-800', label: 'Autonomía',    emoji: '🌟', Icon: Sparkles,      accent: '#d97706' },
  academico:    { color: 'text-sky-700 dark:text-sky-300',   bg: 'bg-sky-50 dark:bg-sky-900/25 border-sky-200 dark:border-sky-800',     label: 'Académico',      emoji: '📚', Icon: BookOpen,      accent: '#0069db' },
  sensorial:    { color: 'text-pink-700 dark:text-pink-300',   bg: 'bg-pink-50 dark:bg-pink-900/25 border-pink-200 dark:border-pink-800',     label: 'Sensorial',      emoji: '✋', Icon: Hand,          accent: '#db2777' },
}

const stripEmoji = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, '').trim()

function SectionTitle({ icon: Icon, children, extra }: { icon: any; children: string; extra?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Icon size={14} /></span>
      <p className="text-sm font-semibold tracking-tight text-v-text">{stripEmoji(children)}</p>
      {extra}
    </div>
  )
}

// Estado de un set: pastilla + menú propio (el <select> nativo no respeta el diseño y su clic expandía la fila).
const ESTADOS_SET = [
  { value: 'pendiente',   key: 'programas.pendiente',  Icon: Clock,      tone: 'bg-v-fill text-v-muted' },
  { value: 'en_progreso', key: 'programas.enProgreso', Icon: TrendingUp, tone: 'bg-v-accent-soft text-v-accent' },
  { value: 'dominado',    key: 'programas.dominado',   Icon: Trophy,     tone: 'bg-v-success/15 text-v-success' },
] as const

function EstadoSetMenu({ estado, onChange }: { estado: string; onChange: (v: string) => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const actual = ESTADOS_SET.find(e => e.value === estado) ?? ESTADOS_SET[0]

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-2 text-xs font-semibold transition-shadow hover:shadow-v ${actual.tone}`}>
        <actual.Icon size={12} />
        {t(actual.key)}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-full z-40 mt-1.5 w-48 origin-top-right overflow-hidden rounded-v-sm border border-v-border bg-v-elevated p-1 shadow-v-lg">
            {ESTADOS_SET.map(e => {
              const sel = e.value === actual.value
              return (
                <button key={e.value} type="button" role="menuitemradio" aria-checked={sel}
                  onClick={() => { setOpen(false); if (!sel) onChange(e.value) }}
                  className={`flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-sm transition-colors ${sel ? 'bg-v-fill font-semibold text-v-text' : 'text-v-muted hover:bg-v-fill hover:text-v-text'}`}>
                  <span className={`grid size-6 place-items-center rounded-full ${e.tone}`}><e.Icon size={12} /></span>
                  <span className="flex-1">{t(e.key)}</span>
                  {sel && <CheckCircle2 size={14} className="text-v-accent" />}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Removed 'seguimiento' — mantenimiento covers it
const FASE_COLORS: Record<string, string> = {
  linea_base: '#94a3b8', intervencion: '#0069db',
  mantenimiento: '#10b981',
}


export default function ProgramasABAView({ childId, childName }: { childId: string; childName: string }) {
  const toast = useToast()
  const { t, locale } = useI18n()

  const FASE_LABELS: Record<string, string> = {
    linea_base:    'Baseline',
    intervencion:  t('programas.intervencion'),
    mantenimiento: t('programas.mantenimiento'),
  }
  const CHART_TIPO_LABELS: Record<string, string> = {
    lineas:     t('reportes.lineas'),
    barras:     t('reportes.barras'),
    histograma: t('reportes.histograma'),
    pie:        t('reportes.pie'),
  }

  const AREA_LABELS: Record<string, string> = {
    comunicacion: t('programas.areaComunicacion') || 'Communication',
    conducta:     t('programas.areaConducca') || 'Behavior',
    cognitivo:    t('programas.areaCognitivo') || 'Cognitive',
    social:       t('programas.areaSocial') || 'Social',
    autonomia:    t('programas.areaAutonomia') || 'Autonomy',
    academico:    t('programas.areaAcademico') || 'Academic',
    sensorial:    t('programas.areaSensorial') || 'Sensory',
  }

  const [programas, setProgramas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCrear, setShowCrear] = useState(false)
  const [descargandoWord, setDescargandoWord] = useState(false)
  const [programaActivo, setProgramaActivo] = useState<any>(null)
  const [showRegistrarSesion, setShowRegistrarSesion] = useState(false)
  const [loadingModal, setLoadingModal] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const [alertasDescartadas, setAlertasDescartadas] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`aba_alertas_desc_${childId}`) || '[]')) }
    catch { return new Set() }
  })

  // Clave estable de cada alerta (antes era la posición en la lista: al cambiar la lista volvían a salir)
  const claveAlerta = (a: any) => String(a?.id || a?.tipo || '')
  // Descartar = resolverla en la base marcada como descartada: no vuelve mientras la situación siga igual
  const descartarAlertas = (lista: any[]) => {
    const keys = lista.map(claveAlerta).filter(Boolean)
    setAlertasDescartadas(prev => {
      const next = new Set([...prev, ...keys])
      try { localStorage.setItem(`aba_alertas_desc_${childId}`, JSON.stringify([...next])) } catch { /* sin storage */ }
      return next
    })
    const ids = lista.map(a => a?.id).filter(Boolean)
    if (ids.length) supabase.from('agente_alertas').update({ resuelta: true, metadata: { descartada: true } }).in('id', ids).then(() => {})
  }
  const descartarAlerta = (a: any) => descartarAlertas([a])
  const descartarTodas = () => descartarAlertas(aiAnalysis?.alertas || [])

  // Llevar al programa de la alerta (desde aquí o desde el dashboard): scroll y resaltado
  const irAPrograma = useCallback((programaId?: string | null) => {
    if (!programaId) return
    const el = document.getElementById(`programa-${programaId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.animate([{ boxShadow: '0 0 0 3px var(--v-accent)' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 2200, easing: 'ease-out' })
  }, [])
  const [filtroArea, setFiltroArea] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState<string>('')
  const [customAreaLabels, setCustomAreaLabels] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('aba_custom_area_labels') || '{}') } catch { return {} }
  })
  const [editingArea, setEditingArea] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  // Tipo de gráfico por programa: { [programaId]: TipoGrafico }
  const [tiposGrafico, setTiposGrafico] = useState<Record<string, TipoGrafico>>({})

  function setTipoGrafico(programaId: string, tipo: TipoGrafico) {
    setTiposGrafico(prev => ({ ...prev, [programaId]: tipo }))
  }

  function getAreaLabel(area: string) {
    return customAreaLabels[area] || AREA_LABELS[area] || AREA_CONFIG[area]?.label || area
  }

  function startEditArea(area: string, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingArea(area)
    setEditingValue(getAreaLabel(area))
  }

  function saveAreaLabel(area: string) {
    const trimmed = editingValue.trim()
    if (trimmed) {
      const updated = { ...customAreaLabels, [area]: trimmed }
      setCustomAreaLabels(updated)
      localStorage.setItem('aba_custom_area_labels', JSON.stringify(updated))
    }
    setEditingArea(null)
  }

  function resetAreaLabel(area: string, e: React.MouseEvent) {
    e.stopPropagation()
    const updated = { ...customAreaLabels }
    delete updated[area]
    setCustomAreaLabels(updated)
    localStorage.setItem('aba_custom_area_labels', JSON.stringify(updated))
  }

  const loadProgramas = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/programas-aba?child_id=${childId}&t=${Date.now()}`, { cache: 'no-store' })
      const json = await res.json()
      setProgramas(json.data || [])
    } catch { toast.error(t('auto.programasABAView.errorCargandoProgramas')) }
    finally { setLoading(false) }
  }, [childId])

  useEffect(() => { loadProgramas() }, [loadProgramas])

  // Viene de una alerta del dashboard: abrir directo en ese programa cuando ya cargaron
  useEffect(() => {
    if (loading || programas.length === 0) return
    let id: string | null = null
    try { id = sessionStorage.getItem('vanty_ir_programa'); sessionStorage.removeItem('vanty_ir_programa') } catch { /* sin storage */ }
    if (id) setTimeout(() => irAPrograma(id), 150)
  }, [loading, programas.length, irAPrograma])

  // Descargar reporte de programas en Word (explicativo para la familia)
  const descargarProgramasWord = async () => {
    if (descargandoWord) return
    setDescargandoWord(true)
    try {
      const res = await fetch('/api/reporte-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': locale },
        body: JSON.stringify({ childId, tipo: 'programas', locale }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'No se pudo generar el documento')
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') || ''
      const m = cd.match(/filename="?([^"]+)"?/)
      const fileName = m ? m[1] : `Programas_${childName.replace(/\s+/g, '_')}.docx`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(t('auto.programasABAView.documentoDescargado'))
    } catch (e: any) {
      toast.error(e?.message || 'Error al generar el documento')
    } finally {
      setDescargandoWord(false)
    }
  }

  // Análisis proactivo del agente al cargar
  useEffect(() => {
    if (!childId) return
    setLoadingAI(true)
    fetch(`/api/agente/chat?action=analisis_proactivo&child_id=${childId}`)
      .then(r => r.json())
      .then(data => setAiAnalysis(data))
      .catch(() => {})
      .finally(() => setLoadingAI(false))
  }, [childId])

  const areas = ['todos', ...Object.keys(AREA_CONFIG)]
  const programasFiltrados = (() => {
    let lista = filtroArea === 'todos' ? programas : programas.filter((p: any) => p.area === filtroArea)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      lista = lista.filter((p: any) => (p.nombre || '').toLowerCase().includes(q) || (p.descripcion || '').toLowerCase().includes(q))
    }
    return lista
  })()

  // Helper: criterio alcanzado por 2 vías
  //   1) Cálculo automático: las últimas N sesiones del set activo >= criterio
  //   2) Decisión del especialista: TODOS los SETs del programa marcados como 'dominado'
  //      (si hay sets definidos; un solo set dominado no basta si quedan otros pendientes)
  const programaCriterioAlcanzado = (p: any) => {
    // Override manual a nivel programa
    if (['dominado', 'logrado', 'criterio_alcanzado'].includes(String(p.estado || '').toLowerCase())) return true

    const todasSesiones = (p.sesiones_datos_aba || []).sort((a: any, b: any) => (a.fecha || '').localeCompare(b.fecha || ''))
    const crit = p.criterio_dominio_pct || 90
    const critSesiones = p.criterio_sesiones_consecutivas || 2
    const sets = Array.isArray(p.objetivos_cp) ? p.objetivos_cp : []

    // ¿Un SET concreto está alcanzado? (estado manual O últimas N sesiones del set >= criterio)
    const setAlcanzado = (o: any) => {
      if (o.estado === 'dominado') return true
      const label = o.numero_set != null ? `Set ${o.numero_set}` : (o.descripcion || '')
      const ses = todasSesiones.filter((s: any) => String(s.set ?? '') === label)
      if (ses.length < critSesiones) return false
      return ses.slice(-critSesiones).every((s: any) => (s.porcentaje_exito ?? 0) >= crit)
    }

    // Si el programa tiene SETs definidos → solo está alcanzado si TODOS lo están.
    // (un set en progreso = programa NO alcanzado todavía)
    if (sets.length > 0) {
      return sets.every(setAlcanzado)
    }

    // Sin sets definidos → criterio automático sobre todas las sesiones
    if (todasSesiones.length < critSesiones) return false
    const last = todasSesiones.slice(-critSesiones)
    return last.every((s: any) => (s.porcentaje_exito ?? 0) >= crit)
  }

  // Un programa cuenta como "Criterio alcanzado" si:
  //   - su estado oficial es 'dominado', O
  //   - cumple la lógica automática (sesiones o sets manuales)
  // "En curso" = el resto.
  const esCriterioAlcanzado = (p: any) => p.estado === 'dominado' || programaCriterioAlcanzado(p)
  const programasCriterioAuto = programasFiltrados.filter(esCriterioAlcanzado)
  const programasEnCurso = programasFiltrados.filter((p: any) => !esCriterioAlcanzado(p))

  const stats = {
    activos: programas.filter(p => p.estado === 'activo').length,
    dominados: programas.filter(p => p.estado === 'dominado' || programaCriterioAlcanzado(p)).length,
    enIntervencion: programas.filter(p => p.fase_actual === 'intervencion' || p.fase_actual === 'linea_base').length,
    alertas: aiAnalysis?.alertas?.length || 0,
  }

  const STAT_CFG = [
    { label: t('programas.activos'),        value: stats.activos,        Icon: ClipboardList, tone: 'bg-v-accent-soft text-v-accent' },
    { label: t('programas.dominados'),       value: stats.dominados,      Icon: Trophy,        tone: 'bg-v-success/15 text-v-success' },
    { label: t('programas.enIntervencion'),  value: stats.enIntervencion, Icon: TrendingUp,    tone: 'bg-v-accent-soft text-v-accent' },
    { label: t('programas.alertasIA'),       value: stats.alertas,        Icon: Bell,          tone: 'bg-v-warning/15 text-v-warning' },
  ]

  return (
    <div className="v-scope pb-10">
      {/* ── Header ── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><ClipboardList size={18} /></span>
          <div>
            <h2 className="text-lg font-semibold leading-tight tracking-tight text-v-text">{t('programas.titulo')}</h2>
            <p className="text-xs text-v-subtle">{t('programas.registroConductual')} · {childName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Descargar reporte de programas en Word (para enviar a la familia) */}
          <button onClick={descargarProgramasWord} disabled={descargandoWord || programas.length === 0}
            title={t("programas.descargarWordTitle")}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-v-border bg-v-elevated px-4 text-sm font-semibold text-v-muted shadow-v transition-colors hover:text-v-accent disabled:opacity-50">
            {descargandoWord
              ? <><Loader2 size={15} className="animate-spin" /> {t("common.generando")}</>
              : <><FileDown size={15} /> {t("programas.descargarWord")}</>}
          </button>

          <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowCrear(true)}
            className="v-brand inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold">
            <Plus size={15} /> {t('programas.nuevo')}
          </motion.button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {STAT_CFG.map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, type: 'spring', stiffness: 220, damping: 24 }}
            whileHover={{ y: -3 }}
            className="group rounded-v border border-v-border bg-v-elevated p-4 shadow-v">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium text-v-muted">{s.label}</p>
              <span className={`grid size-9 place-items-center rounded-[30%] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${s.tone}`}>
                <s.Icon size={16} />
              </span>
            </div>
            <p className="mt-1 text-3xl font-bold leading-none tracking-tight tabular-nums text-v-text">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Alertas IA ── */}
      {loadingAI && (
        <div className="mb-4 flex items-center gap-3 rounded-v border border-v-border bg-v-elevated p-3.5 shadow-v">
          <Loader2 size={14} className="animate-spin text-v-accent" />
          <p className="text-xs font-medium text-v-muted">{t('dashboard.ariAnalizando')}</p>
        </div>
      )}
      {aiAnalysis && aiAnalysis.alertas?.length > 0 && (() => {
        const alertasVisibles = aiAnalysis.alertas.filter((a: any) => !alertasDescartadas.has(claveAlerta(a)))
        if (alertasVisibles.length === 0) return null
        return (
          <div className="space-y-2 mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-v-text">
                <Sparkles size={13} className="text-v-accent" /> Análisis ARIA
              </p>
              <button onClick={descartarTodas}
                className="rounded-full px-3 py-1 text-[11px] font-semibold text-v-subtle transition-colors hover:bg-v-fill hover:text-v-text">
                Descartar todas
              </button>
            </div>
            {aiAnalysis.resumen && (
              <div className="rounded-v border border-v-border bg-v-elevated p-4 shadow-v">
                <p className="text-sm leading-relaxed text-v-muted">{aiAnalysis.resumen}</p>
              </div>
            )}
            {alertasVisibles.map((alerta: any) => (
              <AlertaCard key={claveAlerta(alerta)} alerta={alerta} onDescartar={() => descartarAlerta(alerta)}
                onAbrir={alerta.programa_id ? () => irAPrograma(alerta.programa_id) : undefined} />
            ))}
          </div>
        )
      })()}

      {/* ── Filtros por área ── */}
      <div className="mb-4 flex flex-wrap gap-2">
        {areas.map(area => {
          const isActive = filtroArea === area
          const isEditing = editingArea === area
          const activeStyle = { background: 'var(--v-accent-soft)', color: 'var(--v-accent)', border: '1px solid color-mix(in srgb, var(--v-accent) 35%, transparent)' }
          const inactiveStyle = { background: 'var(--v-bg-elevated)', color: 'var(--v-text-secondary)', border: '1px solid var(--v-border)' }

          if (area === 'todos') {
            return (
              <button key={area} onClick={() => setFiltroArea(area)}
                className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all"
                style={isActive ? activeStyle : inactiveStyle}>
                {t('programas.todos')}
              </button>
            )
          }

          if (isEditing) {
            return (
              <span key={area} className="flex items-center gap-1 overflow-hidden rounded-full"
                style={{ border: '1.5px solid var(--v-accent)', background: 'var(--v-bg-elevated)' }}>
                <input
                  autoFocus
                  value={editingValue}
                  onChange={e => setEditingValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveAreaLabel(area)
                    if (e.key === 'Escape') setEditingArea(null)
                  }}
                  onBlur={() => saveAreaLabel(area)}
                  className="px-2 py-1 text-xs font-semibold outline-none w-24"
                  style={{ background: 'transparent', color: 'var(--text-primary)' }}
                />
                <button
                  onMouseDown={e => { e.preventDefault(); saveAreaLabel(area) }}
                  className="pr-2 text-xs font-bold"
                  style={{ color: 'var(--text-primary)' }}>✓</button>
              </span>
            )
          }

          return (
            <span key={area} className="group relative flex cursor-pointer items-center gap-1 rounded-full text-xs font-semibold transition-all hover:shadow-v"
              style={isActive ? activeStyle : inactiveStyle}
              onClick={() => setFiltroArea(area)}>
              <span className="flex items-center gap-1.5 py-1.5 pl-3.5">
                {AREA_CONFIG[area]?.Icon && (() => { const AI = AREA_CONFIG[area].Icon; return <AI size={13} /> })()}
                {getAreaLabel(area)}
              </span>
              <button
                title={t("programas.renombrarEtiqueta")}
                onMouseDown={e => { e.stopPropagation(); startEditArea(area, e) }}
                className="pr-2 py-1.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-[10px]"
                style={{ color: isActive ? 'var(--card)' : 'var(--text-muted)' }}>
                ✏️
              </button>
              {customAreaLabels[area] && (
                <button
                  title={t("programas.restablecerNombre")}
                  onMouseDown={e => resetAreaLabel(area, e)}
                  className="pr-1.5 py-1.5 opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity text-[10px]"
                  style={{ color: isActive ? 'var(--card)' : 'var(--text-muted)' }}>
                  ↺
                </button>
              )}
            </span>
          )
        })}
      </div>

      {/* Buscador */}
      <div className="mb-4 flex items-center gap-2.5 rounded-full border border-v-border bg-v-elevated px-4 py-2.5 shadow-v transition-shadow focus-within:border-v-accent/50 focus-within:ring-4 focus-within:ring-v-accent-soft">
        <Search size={15} className="shrink-0 text-v-subtle" />
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder={t("programas.buscarPrograma")}
          className="flex-1 bg-transparent text-sm text-v-text outline-none placeholder:text-v-subtle"
        />
        {busqueda && (
          <button onClick={() => setBusqueda('')} style={{ color: 'var(--text-muted)' }}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* Lista de programas */}
      {loading ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <Loader2 className="animate-spin text-v-accent" size={26} />
          <p className="text-sm" style={{color:"var(--text-muted)"}}>{t('programas.sinProgramas')}</p>
        </div>
      ) : programasFiltrados.length === 0 ? (
        <div className="rounded-v border border-dashed border-v-border bg-v-elevated p-14 text-center">
          <span className="mx-auto mb-4 grid size-14 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><ClipboardList size={26} /></span>
          <p className="mb-1 font-semibold text-v-text">{busqueda ? `Sin resultados para "${busqueda}"` : (t('programas.sinProgramas') + (filtroArea !== 'todos' ? ` ${t('programas.enArea').replace('{area}', getAreaLabel(filtroArea))}` : ''))}</p>
          <p className="text-xs" style={{color:"var(--text-muted)",opacity:0.6}}>{!busqueda && t('programas.creaElPrimero').replace('{nombre}', childName)}</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Programas en curso */}
          {programasEnCurso.length > 0 && (
            <div className="space-y-4">
              {programasEnCurso.map((prog: any) => (
            <div key={prog.id} id={`programa-${prog.id}`} className="scroll-mt-24 rounded-v">
            <ProgramaCard
              programa={prog}
              loadingModal={loadingModal}
              onRegistrarSesion={async () => {
                setLoadingModal(true)
                try {
                  const res = await fetch(`/api/programas-aba?child_id=${childId}&t=${Date.now()}`, { cache: 'no-store' })
                  const json = await res.json()
                  const fresh = (json.data || []).find((p: any) => p.id === prog.id) || prog
                  setProgramaActivo(fresh)
                } catch {
                  setProgramaActivo(prog)
                } finally {
                  setLoadingModal(false)
                  setShowRegistrarSesion(true)
                }
              }}
              onReload={loadProgramas}
              onDeleteSesion={(sesionId: string) => {
                setProgramas(prev => prev.map(p => p.id !== prog.id ? p : {
                  ...p,
                  sesiones_datos_aba: (p.sesiones_datos_aba || []).filter((s: any) => s.id !== sesionId)
                }))
              }}
              tipoGrafico={tiposGrafico[prog.id] || 'lineas'}
              onChangeTipoGrafico={(tipo: TipoGrafico) => setTipoGrafico(prog.id, tipo)}
            />
            </div>
          ))}
            </div>
          )}

          {/* Criterio alcanzado automaticamente */}
          {programasCriterioAuto.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1" style={{ background: 'var(--card-border)' }} />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-v-success/15 px-3 py-1 text-[11px] font-semibold text-v-success">
                  <Trophy size={12} /> {t('programas.criterioAlcanzado')} — {programasCriterioAuto.length} programa{programasCriterioAuto.length !== 1 ? 's' : ''}
                </span>
                <div className="h-px flex-1" style={{ background: 'var(--card-border)' }} />
              </div>
              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                Estos programas cumplen el criterio de dominio (por sesiones consecutivas o por decisión del especialista).
              </p>
              <div className="space-y-4 opacity-80">
                {programasCriterioAuto.map((prog: any) => (
            <div key={prog.id} id={`programa-${prog.id}`} className="scroll-mt-24 rounded-v">
            <ProgramaCard
              programa={prog}
              loadingModal={loadingModal}
              onRegistrarSesion={async () => {
                setLoadingModal(true)
                try {
                  const res = await fetch(`/api/programas-aba?child_id=${childId}&t=${Date.now()}`, { cache: 'no-store' })
                  const json = await res.json()
                  const fresh = (json.data || []).find((p: any) => p.id === prog.id) || prog
                  setProgramaActivo(fresh)
                } catch {
                  setProgramaActivo(prog)
                } finally {
                  setLoadingModal(false)
                  setShowRegistrarSesion(true)
                }
              }}
              onReload={loadProgramas}
              onDeleteSesion={(sesionId: string) => {
                setProgramas(prev => prev.map(p => p.id !== prog.id ? p : {
                  ...p,
                  sesiones_datos_aba: (p.sesiones_datos_aba || []).filter((s: any) => s.id !== sesionId)
                }))
              }}
              tipoGrafico={tiposGrafico[prog.id] || 'lineas'}
              onChangeTipoGrafico={(tipo: TipoGrafico) => setTipoGrafico(prog.id, tipo)}
            />
            </div>
          ))}
              </div>
            </div>
          )}

          {/* Sección "Programas logrados" fusionada en "Criterio alcanzado" arriba */}

        </div>
      )}

      {/* Modales */}
      {showCrear && (
        <CrearProgramaModal
          childId={childId}
          onClose={() => setShowCrear(false)}
          onCreated={() => { setShowCrear(false); loadProgramas() }}
        />
      )}
      {showRegistrarSesion && programaActivo && (
        <RegistrarSesionModal
          programa={programaActivo}
          childId={childId}
          onClose={() => { setShowRegistrarSesion(false); setProgramaActivo(null) }}
          onSaved={() => { setShowRegistrarSesion(false); setProgramaActivo(null); loadProgramas() }}
        />
      )}
    </div>
  )
}

// ── Tarjeta de alerta IA ─────────────────────────────────────────────────────
function AlertaCard({ alerta, onDescartar, onAbrir }: { alerta: any; key?: any; onDescartar?: () => void; onAbrir?: () => void }) {
  const { t } = useI18n()
  const cfg: Record<string, { tone: string; Icon: any }> = {
    alta:  { tone: 'bg-v-danger/10 text-v-danger',   Icon: AlertTriangle },
    media: { tone: 'bg-v-warning/15 text-v-warning', Icon: Bell },
    baja:  { tone: 'bg-v-accent-soft text-v-accent', Icon: Sparkles },
  }
  const c = cfg[alerta.prioridad] || cfg.media
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      onClick={onAbrir} role={onAbrir ? 'button' : undefined}
      className={`rounded-v border border-v-border bg-v-elevated p-4 shadow-v ${onAbrir ? 'cursor-pointer transition-colors hover:border-v-accent/40' : ''}`}>
      <div className="mb-1 flex items-start gap-2.5">
        <span className={`grid size-7 shrink-0 place-items-center rounded-full ${c.tone}`}><c.Icon size={13} /></span>
        <p className="flex-1 pt-1 text-sm font-semibold text-v-text">{alerta.titulo}</p>
        {onDescartar && (
          <button onClick={e => { e.stopPropagation(); onDescartar() }}
            className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)', background: 'transparent' }}
            title={t("dashboard.descartarAlerta")}>
            <X size={12} />
          </button>
        )}
      </div>
      <p className="pl-[38px] text-xs leading-relaxed text-v-muted">{alerta.mensaje}</p>
    </motion.div>
  )
}

// ── Tarjeta de programa con gráfica ─────────────────────────────────────────

// Componente separado para la mini gráfica — resuelve el problema de ancho en móvil
function MiniChart({ chartData, minSlots, criterio }: { chartData: any[]; minSlots: number; criterio: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width)
      }
    })
    ro.observe(containerRef.current)
    setWidth(containerRef.current.offsetWidth)
    return () => ro.disconnect()
  }, [])

  // FIX clínico: separar la mini-línea por set para que NO conecte sesiones
  // de sets diferentes. Cada set es un nivel independiente — unirlos con una
  // sola curva sugiere "regresión" engañosa al ojo cuando solo se cambió de set.
  // Genera una columna distinta por set: pct_<setKey>
  const setKeys: string[] = []
  for (const d of chartData) {
    if (d.pct !== null && d.set != null && !setKeys.includes(d.set)) setKeys.push(d.set)
  }
  // Si no hay info de set, fallback al pct único (un solo trazo)
  const usePerSet = setKeys.length > 0
  const dataConSets = usePerSet
    ? chartData.map((d: any) => {
        const row: any = { sesion: d.sesion }
        for (const sk of setKeys) row[`pct_${sk}`] = d.set === sk ? d.pct : null
        return row
      })
    : chartData

  // Paleta consistente entre sets (mismo orden que el gráfico grande)
  const colors = ['#0069db', '#01abfc', '#7c8cf8', '#1fae6b', '#f59e0b', '#0e7490']

  return (
    <div ref={containerRef} className="mt-3 h-16 w-full rounded-v-sm bg-v-bg/60" style={{ overflow: 'hidden' }}>
      {width > 0 && (
        <LineChart width={width} height={64} data={dataConSets} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <XAxis dataKey="sesion" type="number" domain={[0, minSlots + 1]} hide />
          <YAxis domain={[0, 100]} hide width={0} />
          {usePerSet
            ? setKeys.map((sk, i) => (
                <Line key={sk} type="monotone" dataKey={`pct_${sk}`} stroke={colors[i % colors.length]} strokeWidth={2.25} dot={false} connectNulls={false} />
              ))
            : <Line type="monotone" dataKey="pct" stroke="#0069db" strokeWidth={2.25} dot={false} connectNulls={false} />
          }
          <ReferenceLine y={criterio} stroke="#1fae6b" strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.7} />
        </LineChart>
      )}
    </div>
  )
}


// Componente para el gráfico de detalle — un solo ResponsiveContainer, sin overlay
function DetailChart({ chartData, chartHeight, minSlots, programa, segments, mergedSegments, segColorMap, dividers, crit, faseLabel }: any) {
  const { t } = useI18n()
  const margin = { top: 24, right: 16, bottom: 20, left: 4 }
  const YAXIS_W = 40

  // Use mergedSegments if available (fixes non-contiguous Set 1 showing as separate line)
  const lineSegments: any[] = mergedSegments ?? segments.map((seg: any, si: number) => ({
    key: `${seg.fase}||${seg.set}`,
    label: seg.label,
    fase: seg.fase,
    set: seg.set,
    indices: new Set(Array.from({ length: seg.endIdx - seg.startIdx + 1 }, (_: any, k: number) => seg.startIdx + k)),
    color: segColorMap[si],
  }))

  // Calcular divisores de SET (no de fase) — posición absoluta en número de sesión
  // Un divisor de set ocurre cuando el campo "set" cambia entre dos puntos consecutivos con datos
  const setDividers: { x: number; label: string; nextColor: string; isFirst?: boolean }[] = []
  const realPoints = chartData.filter((d: any) => d.pct !== null)

  // Etiqueta del primer set al inicio de la gráfica (anclada al borde izquierdo)
  if (realPoints.length > 0 && realPoints[0].set) {
    const firstSet = realPoints[0].set
    const firstSeg = lineSegments.find((s: any) => s.set === firstSet)
    setDividers.push({
      x: 0,
      label: firstSet,
      nextColor: firstSeg ? firstSeg.color : '#0069db',
      isFirst: true,
    })
  }

  for (let i = 1; i < realPoints.length; i++) {
    const prevSet = realPoints[i - 1].set ?? '__none__'
    const currSet = realPoints[i].set ?? '__none__'
    if (prevSet !== currSet) {
      // La línea va entre la sesión i-1 y la sesión i (ambas en 1-based)
      const xPos = (realPoints[i - 1].sesion + realPoints[i].sesion) / 2
      const mseg = lineSegments.find((s: any) => s.set === currSet || (!s.set && currSet === '__none__'))
      setDividers.push({
        x: xPos,
        label: realPoints[i].set || '',
        nextColor: mseg ? mseg.color : '#0069db',
      })
    }
  }

  // Divisores de fase (cuando cambia la fase pero NO el set — línea más suave)
  const faseDividers: number[] = []
  for (let i = 1; i < realPoints.length; i++) {
    const prevSet = realPoints[i - 1].set ?? '__none__'
    const currSet = realPoints[i].set ?? '__none__'
    const prevFase = realPoints[i - 1].fase
    const currFase = realPoints[i].fase
    if (prevSet === currSet && prevFase !== currFase) {
      faseDividers.push((realPoints[i - 1].sesion + realPoints[i].sesion) / 2)
    }
  }

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <LineChart data={chartData} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
        <XAxis
          dataKey="sesion"
          type="number"
          domain={[0, minSlots + 1]}
          ticks={Array.from({ length: minSlots }, (_: any, i: number) => i + 1)}
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          interval={Math.max(0, Math.floor(minSlots / 10) - 1)}
          label={{ value: t('programas.sesion'), position: 'insideBottom', offset: -8, fontSize: 10, fill: 'var(--text-muted)' }}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickFormatter={(v: number) => `${v}%`}
          width={YAXIS_W}
        />
        <Tooltip
          formatter={(value: any) => [`${value}%`, 'Éxito']}
          labelFormatter={(label: any) => {
            const d = chartData.find((p: any) => p.sesion === label)
            if (!d) return `Sesión ${label}`
            const segIdx = segments.findIndex((s: any) => (label - 1) >= s.startIdx && (label - 1) <= s.endIdx)
            const segName = segIdx >= 0 ? segments[segIdx].label : ''
            return `Sesión ${label} · ${d.fecha}${segName ? ` · ${segName}` : ''}`
          }}
          contentStyle={{ borderRadius: '10px', fontSize: '11px', border: '1px solid var(--card-border)', background: 'var(--card)' }}
        />
        {/* Líneas verticales de cambio de SET — punteadas gruesas estilo ABA */}
        {setDividers.map((div: any, i: number) => (
          <ReferenceLine
            key={`setdiv-${i}`}
            x={div.x}
            stroke={div.isFirst ? 'transparent' : '#94a3b8'}
            strokeWidth={2}
            strokeDasharray="6 4"
            label={{
              value: div.label,
              position: div.isFirst ? 'insideTopLeft' : 'insideTopRight',
              fontSize: 9,
              fill: div.nextColor,
              fontWeight: 700,
            }}
          />
        ))}
        {/* Líneas verticales de cambio de FASE (dentro del mismo set) — más suaves */}
        {faseDividers.map((x: number, i: number) => (
          <ReferenceLine key={`fasediv-${i}`} x={x} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" />
        ))}
        {/* Línea horizontal de criterio de dominio */}
        <ReferenceLine y={programa.criterio_dominio_pct} stroke="#10b981" strokeDasharray="6 3" strokeWidth={2} />
        {/* Una línea por set (merged) con su color — Set 1 agrupa todos sus puntos aunque no sean contiguos */}
        {lineSegments.map((seg: any, si: number) => {
          const color = seg.color
          return (
            <Line
              key={`seg_${si}`}
              type="linear"
              dataKey={(d: any) => {
                const idx = chartData.indexOf(d)
                return seg.indices.has(idx) ? d.pct : null
              }}
              stroke={color}
              strokeWidth={2.5}
              dot={(props: any) => {
                const { cx, cy, index } = props
                if (!seg.indices.has(index)) return <g key={index} />
                const dotColor = (chartData[index]?.pct ?? 0) >= crit ? '#1fae6b' : color
                return <circle key={index} cx={cx} cy={cy} r={4} fill={dotColor} stroke="white" strokeWidth={1.5} />
              }}
              connectNulls={false}
              isAnimationActive={false}
              legendType="none"
            />
          )
        })}
      </LineChart>
    </ResponsiveContainer>
  )
}

// Orden numérico de sets: "Set 1" antes que "Set 2"; sin set al final.
function setNumOrder(k: string | null | undefined): number {
  const s = k ?? '__none__'
  const m = String(s).match(/(\d+)/)
  if (m) return parseInt(m[1], 10)
  return s === '__none__' ? 9999 : 9998
}

// Auto-crecer los <textarea> del procedimiento del set para que el contenido
// no quede cortado ni apretado. Sirve tanto al montar (valores ya cargados,
// vía ref) como al escribir (onInput). Se limita para no crecer sin fin.
function autoGrowTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 260) + 'px'
}

function ProgramaCard({ programa, onRegistrarSesion, onReload, onDeleteSesion, tipoGrafico = 'lineas', onChangeTipoGrafico, loadingModal }: any) {
  const { t, locale } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [detalle, setDetalle] = useState<any>(null)
  const toast = useToast()
  const [editingTitulo, setEditingTitulo] = useState(false)
  const [tempTitulo, setTempTitulo] = useState(programa.titulo)
  const [localTitulo, setLocalTitulo] = useState(programa.titulo)
  const [editingObjetivo, setEditingObjetivo] = useState(false)
  const [tempObjetivo, setTempObjetivo] = useState(programa.objetivo_lp || '')
  const [localObjetivo, setLocalObjetivo] = useState(programa.objetivo_lp || '')
  const [editingArea, setEditingArea] = useState(false)
  const [localArea, setLocalArea] = useState(programa.area || 'comunicacion')
  const [editingFase, setEditingFase] = useState(false)
  const [localFase, setLocalFase] = useState(programa.fase_actual || 'intervencion')
  const [showAgregarSet, setShowAgregarSet] = useState(false)
  const [nuevoSet, setNuevoSet] = useState({ descripcion: '', materiales: '', sd_estimulo: '', unidad_positiva: '', unidad_negativa: '', reforzadores: '', correction_errores: '', generalizacion: t('programas.defaultGeneralizacion'), notas: '' })
  const [savingSet, setSavingSet] = useState(false)
  const [setsAbiertos, setSetsAbiertos] = useState<Record<string, boolean>>({})
  const [setExpandidoId, setSetExpandidoId] = useState<string | null>(null)
  const [editandoSetId, setEditandoSetId] = useState<string | null>(null)
  const [editSetForm, setEditSetForm] = useState<any>({})
  const [savingEditSet, setSavingEditSet] = useState(false)
  const [descargandoSetId, setDescargandoSetId] = useState<string | null>(null)

  // Descargar la guía de ejercicio para casa de un set específico
  const descargarGuiaSet = async (objetivoId: string) => {
    if (descargandoSetId) return
    setDescargandoSetId(objetivoId)
    try {
      const res = await fetch('/api/reporte-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': locale },
        body: JSON.stringify({ tipo: 'set', objetivoId, locale }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'No se pudo generar la guía')
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') || ''
      const m = cd.match(/filename="?([^"]+)"?/)
      const fileName = m ? m[1] : `Guia_Casa.docx`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = fileName
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      toast.success(t('auto.programasABAView.guiaDescargada'))
    } catch (e: any) {
      toast.error(e?.message || 'Error al generar la guía')
    } finally {
      setDescargandoSetId(null)
    }
  }

  const saveField = async (field: string, value: string, onSuccess?: () => void) => {
    const res = await fetch('/api/programas-aba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'actualizar_programa', programa_id: programa.id, updates: { [field]: value } }),
    })
    const json = await res.json()
    if (json.error) { toast.error(json.error); return }
    onSuccess?.()
    toast.success(t('auto.programasABAView.actualizado'))
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!editingArea && !editingFase) return
    const close = () => { setEditingArea(false); setEditingFase(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [editingArea, editingFase])

  const saveTitulo = async (nuevo: string) => {
    setEditingTitulo(false)
    const trimmed = nuevo.trim()
    if (!trimmed || trimmed === localTitulo) { setTempTitulo(localTitulo); return }
    setLocalTitulo(trimmed)
    const res = await fetch('/api/programas-aba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'actualizar_programa', programa_id: programa.id, updates: { titulo: trimmed } }),
    })
    const json = await res.json()
    if (json.error) { toast.error(json.error); setLocalTitulo(programa.titulo); setTempTitulo(programa.titulo); return }
    toast.success(t('auto.programasABAView.tituloActualizado'))
  }

  const saveObjetivo = async (nuevo: string) => {
    setEditingObjetivo(false)
    const trimmed = nuevo.trim()
    if (trimmed === localObjetivo) { setTempObjetivo(localObjetivo); return }
    setLocalObjetivo(trimmed)
    const res = await fetch('/api/programas-aba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'actualizar_programa', programa_id: programa.id, updates: { objetivo_lp: trimmed } }),
    })
    const json = await res.json()
    if (json.error) { toast.error(json.error); setLocalObjetivo(programa.objetivo_lp || ''); setTempObjetivo(programa.objetivo_lp || ''); return }
    toast.success(t('auto.programasABAView.objetivoActualizado'))
  }

  const area = AREA_CONFIG[programa.area] || { ...AREA_CONFIG.comunicacion, Icon: ClipboardList, label: programa.area || '' }
  // Use detalle (fresh from API) when available, fallback to prop — this ensures the
  // chart reflects deletions/additions without needing a full page reload
  const sesiones = [...((detalle ?? programa).sesiones_datos_aba || [])].sort((a: any, b: any) => (a.fecha || '').localeCompare(b.fecha || ''))

  // ── Agrupar por set: calcular stats SOLO del set más reciente activo ──
  // El set activo es el último set que tiene al menos una sesión registrada
  const setsConSesiones = Array.from(new Set(sesiones.map((s: any) => s.set ?? '__none__')))
  const setActivo = setsConSesiones[setsConSesiones.length - 1] ?? '__none__'
  const sesionesSetActivo = sesiones.filter((s: any) => (s.set ?? '__none__') === setActivo)

  // Calcular tendencia local — solo sobre el set activo
  const recientes = sesionesSetActivo.slice(-5).map((s: any) => s.porcentaje_exito).filter(Boolean)
  const promedio = recientes.length > 0 ? recientes.reduce((a: number, b: number) => a + b, 0) / recientes.length : 0
  const ultimoPct = sesionesSetActivo[sesionesSetActivo.length - 1]?.porcentaje_exito ?? null
  const anterior = sesionesSetActivo[sesionesSetActivo.length - 2]?.porcentaje_exito ?? null
  const tendencia = ultimoPct !== null && anterior !== null
    ? ultimoPct > anterior + 3 ? 'up' : ultimoPct < anterior - 3 ? 'down' : 'stable'
    : 'stable'

  // ── Check for criterion: 2 vías ──
  //   1) TODOS los sets del programa marcados como 'dominado' (decisión clínica completa)
  //   2) Cálculo automático sobre sesiones del set activo
  const crit = programa.criterio_dominio_pct || 90
  const critSesiones = programa.criterio_sesiones_consecutivas || 2
  const setsArr = Array.isArray(programa.objetivos_cp) ? programa.objetivos_cp : []
  const todosSetsDominados = setsArr.length > 0 && setsArr.every((o: any) => o.estado === 'dominado')
  const criterioAlcanzado = todosSetsDominados || (() => {
    if (sesionesSetActivo.length < critSesiones) return false
    const last = sesionesSetActivo.slice(-critSesiones)
    return last.every((s: any) => (s.porcentaje_exito ?? 0) >= crit)
  })()
  // Check if 1 away (one session at criterion, one needed)
  const unaFalta = !criterioAlcanzado && critSesiones >= 2 && sesionesSetActivo.length >= 1 && (() => {
    const last = sesionesSetActivo.slice(-(critSesiones - 1))
    return last.length === critSesiones - 1 && last.every((s: any) => (s.porcentaje_exito ?? 0) >= crit)
  })()

  const fetchDetalle = async () => {
    setLoadingDetalle(true)
    try {
      const res = await fetch(`/api/programas-aba?id=${programa.id}&t=${Date.now()}`, { cache: 'no-store' })
      const json = await res.json()
      setDetalle(json.data || programa)
    } catch {
      setDetalle(programa)
    }
    finally { setLoadingDetalle(false) }
  }

  const loadDetalle = async () => {
    if (detalle) { setExpanded(!expanded); return }
    setExpanded(true)
    await fetchDetalle()
  }

  // Preparar datos para la gráfica — agrupar por set para que sesiones del mismo set queden contiguas
  const setOrder: string[] = []
  sesiones.forEach((s: any) => {
    const k = s.set ?? '__none__'
    if (!setOrder.includes(k)) setOrder.push(k)
  })
  // Ordenar los sets por su número (Set 1 antes que Set 2), no por aparición.
  setOrder.sort((a, b) => setNumOrder(a) - setNumOrder(b))
  const sesionesOrdenadas = [...sesiones].sort((a: any, b: any) => {
    const ai = setOrder.indexOf(a.set ?? '__none__')
    const bi = setOrder.indexOf(b.set ?? '__none__')
    if (ai !== bi) return ai - bi
    return (a.fecha || '').localeCompare(b.fecha || '')
  })
  const chartDataRaw = sesionesOrdenadas.map((s: any, i: number) => ({
    sesion: i + 1,
    pct: s.porcentaje_exito,
    fase: s.fase,
    fecha: s.fecha,
    set: s.set ?? null,
  }))
  // Pad to minimum 10 slots so the X axis always shows at least S1–S10
  const minSlots = Math.max(10, chartDataRaw.length)
  const chartData = [
    ...chartDataRaw,
    ...Array.from({ length: minSlots - chartDataRaw.length }, (_, i) => ({
      sesion: chartDataRaw.length + i + 1,
      pct: null as any,
      fase: null,
      fecha: null,
      set: null,
    }))
  ]

  // Detectar cambios de fase para líneas verticales
  const cambiosFase: number[] = []
  for (let i = 1; i < chartData.length; i++) {
    if (chartData[i].fase !== chartData[i - 1].fase) cambiosFase.push(i + 1)
  }

  const faseLabel: Record<string, string> = {
    linea_base: 'Baseline', intervencion: t('programas.intervencion'),
    mantenimiento: t('programas.mantenimiento'),
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 26 }}
      className={`v-scope overflow-hidden rounded-v border bg-v-elevated shadow-v transition-shadow hover:shadow-v-lg ${expanded ? 'border-v-accent/30' : 'border-v-border'}`}>
      {/* Header */}
      <div className="cursor-pointer p-4 sm:p-5" onClick={loadDetalle}>
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent">
            {(() => { const AI = area.Icon; return <AI size={18} /> })()}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {editingTitulo ? (
                <input
                  autoFocus
                  value={tempTitulo}
                  onChange={e => setTempTitulo(e.target.value)}
                  onBlur={() => saveTitulo(tempTitulo)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') { setTempTitulo(localTitulo); setEditingTitulo(false) }
                  }}
                  onClick={e => e.stopPropagation()}
                  className="font-bold text-sm rounded-lg px-2 py-0.5 outline-none border-2 border-sky-400"
                  style={{ color: 'var(--text-primary)', background: 'var(--input-bg)', minWidth: '160px', maxWidth: '260px' }}
                />
              ) : (
                <h3 className="flex items-center gap-1.5 text-[15px] font-semibold leading-snug tracking-tight text-v-text">
                  {localTitulo}
                  <button
                    title={t("programas.editarTitulo")}
                    onClick={e => { e.stopPropagation(); setTempTitulo(localTitulo); setEditingTitulo(true) }}
                    className="flex items-center justify-center w-5 h-5 rounded-md opacity-40 hover:opacity-100 hover:bg-sky-100 transition-all shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Edit3 size={11} />
                  </button>
                </h3>
              )}
              {/* Area tag — editable */}
              <div className="relative">
                <button
                  onClick={e => { e.stopPropagation(); setEditingArea(v => !v); setEditingFase(false) }}
                  title={t("programas.cambiarArea")}
                  className="flex items-center gap-1 rounded-full bg-v-fill px-2.5 py-0.5 text-[10px] font-semibold text-v-muted transition-colors hover:bg-v-accent-soft hover:text-v-accent">
                  {AREA_CONFIG[localArea]?.Icon && (() => { const AI = AREA_CONFIG[localArea].Icon; return <AI size={11} /> })()}
                  {(() => { const _k = 'areaAba.' + localArea; const _v = t(_k); return _v === _k ? localArea : _v })()}
                </button>
                {editingArea && (
                  <div className="absolute top-6 left-0 z-50 rounded-2xl shadow-xl py-1 min-w-[160px]"
                    style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}
                    onClick={e => e.stopPropagation()}>
                    {Object.entries(AREA_CONFIG).map(([key, cfg]) => (
                      <button key={key}
                        onClick={() => {
                          setLocalArea(key)
                          setEditingArea(false)
                          saveField('area', key)
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-left hover:bg-[var(--muted-bg)] transition-colors ${key === localArea ? 'font-bold' : ''}`}
                        style={{ color: key === localArea ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {(() => { const AI = cfg.Icon; return <AI size={13} style={{ color: cfg.accent }} /> })()}
                        {cfg.label}
                        {key === localArea && <span className="ml-auto text-sky-500">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fase tag — editable */}
              <div className="relative">
                <button
                  onClick={e => { e.stopPropagation(); setEditingFase(v => !v); setEditingArea(false) }}
                  title={t("programas.cambiarFase")}
                  className="hover:opacity-80 transition-all">
                  <FaseTag fase={localFase} />
                </button>
                {editingFase && (
                  <div className="absolute top-6 left-0 z-50 rounded-2xl shadow-xl py-1 min-w-[160px]"
                    style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}
                    onClick={e => e.stopPropagation()}>
                    {[
                      { key: 'linea_base', label: 'Baseline' },
                      { key: 'intervencion', label: t('fase.intervencion') },
                      { key: 'mantenimiento', label: t('fase.mantenimiento') },
                      { key: 'dominado', label: t('fase.dominado') },
                    ].map(({ key, label }) => (
                      <button key={key}
                        onClick={() => {
                          setLocalFase(key)
                          setEditingFase(false)
                          saveField('fase_actual', key)
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-left hover:bg-[var(--muted-bg)] transition-colors`}
                        style={{ color: key === localFase ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: key === localFase ? 800 : 600 }}>
                        {label}
                        {key === localFase && <span className="ml-auto text-sky-500">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {criterioAlcanzado && (
                <span className="inline-flex items-center gap-1 rounded-full bg-v-success/15 px-2.5 py-0.5 text-[10px] font-semibold text-v-success">
                  <Trophy size={11} /> {t('programas.criterioAlcanzado')}
                </span>
              )}
              {unaFalta && (
                <span className="inline-flex items-center gap-1 rounded-full bg-v-warning/15 px-2.5 py-0.5 text-[10px] font-semibold text-v-warning">
                  <Zap size={11} /> ¡Vas bien! Falta 1 sesión
                </span>
              )}
            </div>
            {editingObjetivo ? (
              <textarea
                autoFocus
                value={tempObjetivo}
                onChange={e => setTempObjetivo(e.target.value)}
                onBlur={() => saveObjetivo(tempObjetivo)}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setTempObjetivo(localObjetivo); setEditingObjetivo(false) }
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (e.target as HTMLTextAreaElement).blur()
                }}
                onClick={e => e.stopPropagation()}
                rows={3}
                placeholder={t("programas.objetivoLargoPlazo")}
                className="w-full text-xs rounded-lg px-2 py-1 mt-1 outline-none border-2 border-sky-400 resize-y"
                style={{ color: 'var(--text-primary)', background: 'var(--input-bg)', minHeight: '52px' }}
              />
            ) : (
              <p className="mt-1 flex items-start gap-1.5 text-xs text-v-subtle">
                <span className="line-clamp-2">
                  {localObjetivo || <span className="italic opacity-70">{t("programas.sinObjetivoLP")}</span>}
                </span>
                <button
                  title={t("programas.editarObjetivoLP")}
                  onClick={e => { e.stopPropagation(); setTempObjetivo(localObjetivo); setEditingObjetivo(true) }}
                  className="flex items-center justify-center w-5 h-5 rounded-md opacity-40 hover:opacity-100 hover:bg-sky-100 transition-all shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Edit3 size={11} />
                </button>
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {/* Total de sesiones (todos los sets) */}
              <span className="text-xs flex items-center gap-1" style={{color:"var(--text-muted)"}}>
                <BarChart3 size={10} /> {sesiones.length} {t('programas.sesiones')} {t('programas.totales')}
              </span>
              {/* % e indicador SOLO del set activo (no del programa) */}
              {ultimoPct !== null && (
                <span className="text-xs font-bold flex items-center gap-1" title={`Última sesión del ${setActivo !== '__none__' ? setActivo : 'set activo'}`}>
                  {tendencia === 'up' && <TrendingUp size={12} className="text-v-success" />}
                  {tendencia === 'down' && <TrendingDown size={12} className="text-v-danger" />}
                  {tendencia === 'stable' && <Minus size={12} className="text-v-subtle" />}
                  <span className={tendencia === 'up' ? 'text-v-success' : tendencia === 'down' ? 'text-v-danger' : 'text-v-muted'}>
                    {ultimoPct.toFixed(0)}%
                  </span>
                  {setActivo !== '__none__' && (
                    <span className="text-[10px] font-semibold ml-0.5" style={{color:"var(--text-muted)"}}>
                      {t('programas.enSet2')} {setActivo}
                    </span>
                  )}
                </span>
              )}
              <span className="text-xs" style={{color:"var(--text-muted)"}}>
                {t('programas.criterio')}: {programa.criterio_dominio_pct}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end sm:justify-start mt-1 sm:mt-0">
            <button onClick={e => { e.stopPropagation(); onRegistrarSesion() }}
              disabled={loadingModal}
              className="v-brand inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-transform active:scale-95 disabled:opacity-60" style={{ boxShadow: 'none' }}>
              {loadingModal ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              <span className="hidden sm:inline">{t('programas.agregarSesion')}</span>
              <span className="sm:hidden">+ {t('programas.sesiones') || 'Sesión'}</span>
            </button>
            <button
              onClick={async (e) => {
                e.stopPropagation()
                if (!await confirmar(t('auto.programasABAView.eliminarElProgramaYTodas', { v1: String(programa.titulo) }))) return
                const res = await fetch('/api/programas-aba', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'eliminar_programa', programa_id: programa.id }),
                })
                const json = await res.json()
                if (json.error) { alert(json.error); return }
                window.location.reload()
              }}
              className="grid size-8 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-danger/10 hover:text-v-danger"
              title={t("programas.eliminarPrograma")}
            >
              <Trash2 size={14} />
            </button>
            <span className={`grid size-8 place-items-center rounded-full transition-all ${expanded ? 'rotate-180 bg-v-accent-soft text-v-accent' : 'text-v-subtle'}`}>
              <ChevronDown size={16} />
            </span>
          </div>
        </div>

        {/* Mini gráfica */}
        {sesiones.length >= 2 && (
          <MiniChart chartData={chartData} minSlots={minSlots} criterio={programa.criterio_dominio_pct} />
        )}
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div className="space-y-5 border-t border-v-border bg-v-bg p-5">
          {loadingDetalle ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-v-accent" size={24} />
            </div>
          ) : detalle ? (
            <>
              {/* Gráfica completa con selector de tipo */}
              {chartData.length >= 2 && (
                <div>
                  {/* Header con selector de tipo */}
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <SectionTitle icon={ChartLine}>{t('programas.graficaProgreso')}</SectionTitle>
                    {/* Selector de tipo */}
                    <div className="inline-flex rounded-full bg-v-fill p-1">
                      {([
                        { id: 'lineas'     as const, label: t('reportes.lineas'),     Icon: ChartLine },
                        { id: 'barras'     as const, label: t('reportes.barras'),     Icon: ChartColumnBig },
                        { id: 'histograma' as const, label: t('reportes.histograma'), Icon: ChartBarStacked },
                        { id: 'pie'        as const, label: t('reportes.pie'),        Icon: ChartPie },
                      ] as const).map(opt => (
                        <button key={opt.id} onClick={() => onChangeTipoGrafico(opt.id)}
                          title={opt.label}
                          className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${tipoGrafico === opt.id ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
                          {tipoGrafico === opt.id && (
                            <motion.span layoutId={`chart-type-${programa.id}`} className="absolute inset-0 rounded-full bg-v-elevated shadow-v"
                              transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                          )}
                          <opt.Icon size={14} className="relative" />
                          <span className="relative hidden sm:inline">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-v overflow-hidden" style={{ background: 'var(--v-bg-elevated)', border: '1px solid var(--v-border)', boxShadow: 'var(--v-shadow)' }}>

                    {/* ── ABA Phase Chart — segmentos con líneas verticales y labels ── */}
                    {tipoGrafico === 'lineas' && (() => {
                      // Build segments usando índices ABSOLUTOS de chartData (no de realData)
                      type Seg = { label: string; fase: string; set: string | null; startIdx: number; endIdx: number }
                      const segments: Seg[] = []
                      if (chartData.length > 0) {
                        let segStart = -1
                        let curKey = ''
                        for (let i = 0; i < chartData.length; i++) {
                          const d = chartData[i]
                          if (d.pct === null) {
                            // fin de datos reales — cerrar segmento abierto
                            if (segStart >= 0) {
                              const prev = chartData[i - 1]
                              segments.push({ label: prev.set || faseLabel[prev.fase] || prev.fase, fase: prev.fase, set: prev.set, startIdx: segStart, endIdx: i - 1 })
                              segStart = -1; curKey = ''
                            }
                            continue
                          }
                          const key = `${d.fase}||${d.set}`
                          if (key !== curKey) {
                            if (segStart >= 0) {
                              const prev = chartData[i - 1]
                              segments.push({ label: prev.set || faseLabel[prev.fase] || prev.fase, fase: prev.fase, set: prev.set, startIdx: segStart, endIdx: i - 1 })
                            }
                            segStart = i; curKey = key
                          }
                          // último punto
                          if (i === chartData.length - 1 && segStart >= 0) {
                            segments.push({ label: d.set || faseLabel[d.fase] || d.fase, fase: d.fase, set: d.set, startIdx: segStart, endIdx: i })
                          }
                        }
                      }

                      // Color palette — stable by unique fase||set key so Set 1 always = same color
                      const segColors = ['#0069db', '#01abfc', '#7c8cf8', '#1fae6b', '#f59e0b', '#0e7490']
                      // Color estable por SET (Set 1 siempre el mismo color, etc.)
                      const uniqueSets: string[] = []
                      segments.forEach(seg => {
                        const k = seg.set ?? '__none__'
                        if (!uniqueSets.includes(k)) uniqueSets.push(k)
                      })
                      const segColorMap = segments.map(seg =>
                        segColors[uniqueSets.indexOf(seg.set ?? '__none__') % segColors.length]
                      )

                      // UNA sola línea por SET: agrupa TODOS los puntos del set aunque cambien de
                      // fase, para que el progreso del set se vea continuo. El cambio de fase se
                      // marca con un divisor vertical fino, sin romper la línea.
                      type MergedSeg = { key: string; label: string; fase: string; set: string | null; indices: Set<number>; color: string }
                      const mergedMap = new Map<string, MergedSeg>()
                      segments.forEach((seg) => {
                        const k = seg.set ?? '__none__'
                        if (!mergedMap.has(k)) {
                          mergedMap.set(k, { key: k, label: seg.label, fase: seg.fase, set: seg.set, indices: new Set(), color: segColors[uniqueSets.indexOf(k) % segColors.length] })
                        }
                        const ms = mergedMap.get(k)!
                        for (let idx = seg.startIdx; idx <= seg.endIdx; idx++) ms.indices.add(idx)
                      })
                      const mergedSegments = Array.from(mergedMap.values())

                      // Divider x-positions — endIdx is 0-based, sesion is 1-based
                      const dividers = segments.slice(0, -1).map(seg => seg.endIdx + 2)

                      // Build per-point color: dot color matches its segment
                      const dotColorByIdx = chartData.map((_: any, i: number) => {
                        const segIdx = segments.findIndex(s => i >= s.startIdx && i <= s.endIdx)
                        return segIdx >= 0 ? segColorMap[segIdx] : '#0069db'
                      })

                      const chartHeight = 260

                      return (
                        <div>
                          {/* ── Main chart — un solo LineChart con divisores y labels internos ── */}
                          <DetailChart
                            chartData={chartData}
                            chartHeight={chartHeight}
                            minSlots={minSlots}
                            programa={programa}
                            segments={segments}
                            mergedSegments={mergedSegments}
                            segColorMap={segColorMap}
                            dividers={dividers}
                            crit={crit}
                            faseLabel={faseLabel}
                          />

                          {/* ── Legend — deduplicated by fase||set key ── */}
                          <div className="flex flex-wrap gap-3 px-4 pb-3 pt-1">
                            {mergedSegments.map((seg) => {
                              const color = seg.color
                              return (
                              <span key={seg.key} className="flex items-center gap-1 text-[10px] font-bold" style={{ color }}>
                                <span className="w-4 border-t-2 inline-block" style={{ borderColor: color }} />
                                {seg.label}
                              </span>
                              )
                            })}
                            <span className="flex items-center gap-1 text-[10px] font-bold text-v-success">
                              <span className="w-4 border-t-2 border-dashed border-v-success/30 inline-block" />
                              {t('programas.criterio')} {programa.criterio_dominio_pct}%
                            </span>
                          </div>
                        </div>
                      )
                    })()}

                    {/* ── Barras con divisores de fase/set ── */}
                    {tipoGrafico === 'barras' && (() => {
                      // Build segments same as lineas
                      type Seg = { label: string; fase: string; set: string | null; startIdx: number; endIdx: number }
                      const segs: Seg[] = []
                      const realDataB = chartData.filter((d: any) => d.pct !== null)
                      if (realDataB.length > 0) {
                        let sStart = 0
                        let curK = `${realDataB[0].fase}||${realDataB[0].set}`
                        for (let i = 1; i <= realDataB.length; i++) {
                          const k = i < realDataB.length ? `${realDataB[i].fase}||${realDataB[i].set}` : null
                          if (k !== curK) {
                            const prev = realDataB[sStart]
                            segs.push({ label: prev.set || (faseLabel[prev.fase] || prev.fase), fase: prev.fase, set: prev.set, startIdx: sStart, endIdx: i - 1 })
                            if (i < realDataB.length) { curK = k!; sStart = i }
                          }
                        }
                      }
                      const total = realDataB.length
                      const segColors = ['#0069db', '#01abfc', '#7c8cf8', '#1fae6b', '#f59e0b', '#0e7490']
                      const uniqueBarKeys: string[] = []
                      segs.forEach(seg => { const k = `${seg.fase}||${seg.set}`; if (!uniqueBarKeys.includes(k)) uniqueBarKeys.push(k) })
                      const barColorMap = segs.map(seg => segColors[uniqueBarKeys.indexOf(`${seg.fase}||${seg.set}`) % segColors.length])
                      const dividers = segs.slice(0, -1).map(s => s.endIdx + 2)

                      return (
                        <div>
                          {segs.length > 1 && (
                            <div className="flex" style={{ paddingLeft: '44px', paddingRight: '16px' }}>
                              {segs.map((seg, i) => {
                                const width = ((seg.endIdx - seg.startIdx + 1) / total) * 100
                                const color = barColorMap[i]
                                return (
                                  <div key={i} className="flex flex-col items-center justify-end pb-1 border-r last:border-r-0"
                                    style={{ width: `${width}%`, minWidth: '28px', borderColor: '#cbd5e1' }}>
                                    <span className="text-[10px] font-bold truncate px-1 text-center w-full" style={{ color }}>{seg.label}</span>
                                    <span className="text-[9px] font-semibold text-v-subtle truncate px-1 text-center w-full">
                                      {seg.set ? (faseLabel[seg.fase] || seg.fase) : ''}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 24, left: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--v-border)" vertical={false} />
                              <XAxis dataKey="sesion"
                                type="number"
                                domain={[0, minSlots + 1]}
                                ticks={Array.from({ length: minSlots }, (_, i) => i + 1)}
                                tick={{ fontSize: 10, fill: 'var(--v-text-tertiary)' }}
                                interval={Math.max(0, Math.floor(minSlots / 10) - 1)}
                                label={{ value: t('programas.sesion'), position: 'insideBottom', offset: -10, fontSize: 10, fill: 'var(--v-text-tertiary)' }} />
                              <YAxis domain={[0, 100]} ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]} tick={{ fontSize: 10, fill: 'var(--v-text-tertiary)' }} tickFormatter={(v: any) => `${v}%`} width={40} />
                              <Tooltip
                                formatter={(value: any) => [`${value}%`, 'Éxito']}
                                labelFormatter={(label) => { const d = chartData[label - 1]; return d ? `Sesión ${label} · ${d.fecha}${d.set ? ` · ${d.set}` : ''}` : `Sesión ${label}` }}
                                contentStyle={{ borderRadius: '10px', fontSize: '11px', border: '1px solid var(--v-border)', background: 'var(--v-bg-elevated)' }}
                              />
                              {dividers.map((x, i) => <ReferenceLine key={`bd-${i}`} x={x} stroke="#64748b" strokeWidth={2} strokeDasharray="6 4" />)}
                              <ReferenceLine y={programa.criterio_dominio_pct} stroke="#10b981" strokeDasharray="6 3" strokeWidth={2} />
                              <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                {chartData.map((entry: any, index: number) => (
                                  <Cell key={index} fill={
                                    entry.pct >= programa.criterio_dominio_pct ? '#1fae6b'
                                    : entry.pct >= 70 ? '#0069db'
                                    : entry.pct >= 45 ? '#D97706' : '#DC2626'
                                  } />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )
                    })()}

                    {/* ── Histograma de distribución ── */}
                    {tipoGrafico === 'histograma' && (() => {
                      const critPct = programa.criterio_dominio_pct
                      const histData = [
                        { rango: '0-25%',        count: chartData.filter((d: any) => d.pct < 26).length,                    color: '#DC2626' },
                        { rango: '26-50%',       count: chartData.filter((d: any) => d.pct >= 26 && d.pct < 51).length,     color: '#D97706' },
                        { rango: '51-75%',       count: chartData.filter((d: any) => d.pct >= 51 && d.pct < 76).length,     color: '#0069db' },
                        { rango: '76-89%',       count: chartData.filter((d: any) => d.pct >= 76 && d.pct < critPct).length, color: '#0891B2' },
                        { rango: `${critPct}%+`, count: chartData.filter((d: any) => d.pct >= critPct).length,              color: '#1fae6b' },
                      ]
                      const maxCount = Math.max(...histData.map(h => h.count), 1)
                      return (
                        <div className="p-4">
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={histData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--v-border)" vertical={false} />
                              <XAxis dataKey="rango" tick={{ fontSize: 11, fill: 'var(--v-text-tertiary)' }} />
                              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--v-text-tertiary)' }}
                                label={{ value: 'Sesiones', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'var(--v-text-tertiary)' }} />
                              <Tooltip
                                formatter={(v: any) => [`${v} sesiones`, 'Cantidad']}
                                contentStyle={{ borderRadius: '10px', fontSize: '11px', border: '1px solid var(--v-border)', background: 'var(--v-bg-elevated)' }}
                              />
                              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={60}>
                                {histData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )
                    })()}

                    {/* ── Pie chart mejorado ── */}
                    {tipoGrafico === 'pie' && (() => {
                      const critPct = programa.criterio_dominio_pct
                      const realPie = chartData.filter((d: any) => d.pct !== null)
                      const pieRaw = [
                        { name: `≥${critPct}% · Criterio`,      value: realPie.filter((d: any) => d.pct >= critPct).length,               color: '#1fae6b', tone: 'bg-v-success/10' },
                        { name: `70–${critPct - 1}% · Cerca`,    value: realPie.filter((d: any) => d.pct >= 70 && d.pct < critPct).length, color: '#0069db', tone: 'bg-v-accent-soft' },
                        { name: '45–69% · En proceso',           value: realPie.filter((d: any) => d.pct >= 45 && d.pct < 70).length,      color: '#f59e0b', tone: 'bg-v-warning/10' },
                        { name: '<45% · Inicial',                value: realPie.filter((d: any) => d.pct < 45).length,                     color: '#e5484d', tone: 'bg-v-danger/10' },
                      ].filter(p => p.value > 0)
                      const total = realPie.length
                      const pct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0
                      const logradas = pieRaw.find(p => p.color === '#1fae6b')?.value ?? 0

                      return (
                        <div className="flex flex-col items-center gap-5 p-5 sm:flex-row">
                          {/* Donut de tamaño fijo, total en el centro */}
                          <div className="relative size-[200px] shrink-0">
                            <PieChart width={200} height={200}>
                              <Pie data={pieRaw} dataKey="value" nameKey="name"
                                cx={100} cy={100} innerRadius={62} outerRadius={92}
                                paddingAngle={pieRaw.length > 1 ? 3 : 0} cornerRadius={6}
                                stroke="none" isAnimationActive>
                                {pieRaw.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                              </Pie>
                              <Tooltip
                                formatter={(v: any, name: any) => [`${v} sesiones (${pct(v)}%)`, name]}
                                contentStyle={{ borderRadius: '12px', fontSize: '11px', border: '1px solid var(--v-border)', background: 'var(--v-bg-elevated)', color: 'var(--v-text)' }}
                              />
                            </PieChart>
                            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                              <div>
                                <p className="text-3xl font-bold leading-none tabular-nums text-v-text">{pct(logradas)}%</p>
                                <p className="mt-1 text-[11px] text-v-subtle">en criterio</p>
                                <p className="text-[11px] text-v-subtle">{total} sesiones</p>
                              </div>
                            </div>
                          </div>

                          {/* Leyenda */}
                          <div className="grid w-full flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                            {pieRaw.map((p, i) => (
                              <motion.div key={p.name} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                className={`flex items-center gap-3 rounded-v-sm p-3 ${p.tone}`}>
                                <span className="size-3 shrink-0 rounded-full" style={{ background: p.color }} />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-v-text">{p.value} sesion{p.value === 1 ? '' : 'es'}</p>
                                  <p className="truncate text-[11px] text-v-muted">{p.name}</p>
                                </div>
                                <span className="text-sm font-bold tabular-nums" style={{ color: p.color }}>{pct(p.value)}%</span>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* Sets / Objetivos CP */}
              <div>
                <SectionTitle icon={Layers}>{t('programas.setsObjetivos')}</SectionTitle>
                {detalle.objetivos_cp?.length > 0 && (
                  <div className="space-y-2">
                    {[...detalle.objetivos_cp].sort((a: any, b: any) => (a.numero_set ?? 0) - (b.numero_set ?? 0)).map((obj: any) => (
                      <div key={obj.id} className="space-y-0">
                      <div className={`flex cursor-pointer select-none flex-wrap items-center gap-x-3 gap-y-2 rounded-v-sm border bg-v-elevated p-3 text-sm transition-colors hover:border-v-accent/30 ${
                        setExpandidoId === obj.id ? 'border-v-accent/40' : 'border-v-border'
                      }`} onClick={() => setSetExpandidoId(prev => prev === obj.id ? null : obj.id)}>
                        <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                          obj.estado === 'dominado' ? 'bg-v-success text-white' : obj.estado === 'en_progreso' ? 'v-brand' : 'bg-v-fill text-v-muted'
                        }`} style={{ boxShadow: 'none' }}>
                          {obj.estado === 'dominado' ? <Trophy size={12} /> : obj.numero_set}
                        </span>
                        {obj._editando ? (
                          <input
                            autoFocus
                            defaultValue={obj.descripcion}
                            onBlur={async (e) => {
                              const nueva = e.target.value.trim()
                              if (!nueva || nueva === obj.descripcion) {
                                setDetalle((prev: any) => prev ? {
                                  ...prev,
                                  objetivos_cp: prev.objetivos_cp.map((o: any) => o.id === obj.id ? { ...o, _editando: false } : o)
                                } : prev)
                                return
                              }
                              const res = await fetch('/api/programas-aba', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'actualizar_objetivo', objetivo_id: obj.id, descripcion: nueva }),
                              })
                              const json = await res.json()
                              if (json.error) { toast.error(json.error); return }
                              toast.success(t('auto.programasABAView.setActualizado'))
                              fetchDetalle()
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                            className="flex-1 text-sm font-medium bg-v-elevated border border-v-accent/30 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-sky-300 text-v-text"
                          />
                        ) : (
                          <span className="flex-1 basis-40 font-medium text-v-text">{obj.descripcion}</span>
                        )}
                        <div className="flex items-center gap-2 ml-auto shrink-0">
                        <button
                          onClick={() => setDetalle((prev: any) => prev ? {
                            ...prev,
                            objetivos_cp: prev.objetivos_cp.map((o: any) => o.id === obj.id ? { ...o, _editando: !o._editando } : o)
                          } : prev)}
                          className="p-1 text-v-subtle hover:text-v-accent transition-all shrink-0"
                          title={t("programas.editarDescripcion")}
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (!await confirmar(t('auto.programasABAView.eliminarElSetEstoTambien', { v1: String(obj.numero_set), v2: String(obj.descripcion) }))) return
                            const res = await fetch('/api/programas-aba', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'eliminar_set', objetivo_id: obj.id }),
                            })
                            const json = await res.json()
                            if (json.error) { toast.error(json.error); return }
                            toast.success(t('auto.programasABAView.setEliminado'))
                            setSetExpandidoId(prev => prev === obj.id ? null : prev)
                            setDetalle((prev: any) => prev ? {
                              ...prev,
                              objetivos_cp: prev.objetivos_cp.filter((o: any) => o.id !== obj.id),
                              sesiones_datos_aba: (prev.sesiones_datos_aba || []).filter((s: any) => s.objetivo_cp_id !== obj.id),
                            } : prev)
                            fetchDetalle()
                          }}
                          className="p-1 text-v-subtle hover:text-v-danger transition-all shrink-0"
                          title={t("programas.eliminarSet")}
                        >
                          <Trash2 size={12} />
                        </button>
                        <EstadoSetMenu
                          estado={obj.estado || 'pendiente'}
                          onChange={async (nuevoEstado) => {
                            const res = await fetch('/api/programas-aba', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'actualizar_objetivo', objetivo_id: obj.id, estado: nuevoEstado }),
                            })
                            const json = await res.json()
                            if (json.error) { toast.error(json.error); return }
                            toast.success(`Set ${obj.numero_set} → ${nuevoEstado === 'dominado' ? t('programas.dominado') : nuevoEstado === 'en_progreso' ? t('programas.enProgreso') : t('programas.pendiente')}`)
                            // Recargar detalle completo para que el gráfico refleje el nuevo estado
                            fetchDetalle()
                          }}
                        />
                        </div>
                      </div>
                      {setExpandidoId === obj.id && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="mx-3 mb-1 space-y-2 rounded-b-v-sm border border-t-0 border-v-border bg-v-bg p-3.5 text-sm leading-relaxed text-v-muted [&_.font-bold]:text-v-text" onClick={e => e.stopPropagation()}>
                          <div className="mb-1 flex items-center justify-between">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-v-accent"><Pin size={12} /> {stripEmoji(t('programas.procedimientoSet'))}</p>
                            {editandoSetId !== obj.id && (
                              <div className="flex items-center gap-1">
                                {/* Descargar guía de ejercicio para casa (para enviar a la familia) */}
                                <button
                                  onClick={() => descargarGuiaSet(obj.id)}
                                  disabled={descargandoSetId === obj.id}
                                  title={t("programas.guiaCasaTitle")}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-v-success hover:bg-v-success/15 transition-colors disabled:opacity-50">
                                  {descargandoSetId === obj.id
                                    ? <><Loader2 size={10} className="animate-spin" /> {t("common.generando")}</>
                                    : <><BookOpen size={10} /> {t("programas.guiaCasa")}</>}
                                </button>
                                <button
                                  onClick={() => { setEditandoSetId(obj.id); setEditSetForm({ descripcion: obj.descripcion || '', materiales: obj.materiales || '', sd_estimulo: obj.sd_estimulo || '', unidad_positiva: obj.unidad_positiva || '', unidad_negativa: obj.unidad_negativa || '', reforzadores: obj.reforzadores || obj.ayudas || '', correction_errores: obj.correction_errores || '', generalizacion: obj.generalizacion || '', notas: obj.notas || '' }) }}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-v-accent hover:bg-v-accent-soft transition-colors">
                                  <Edit3 size={10} /> {t('common.editar')}
                                </button>
                              </div>
                            )}
                          </div>

                          {editandoSetId === obj.id ? (
                            <div className="space-y-2">
                              {[
                                { key: 'materiales',        label: t('programas.matLabel'),         placeholder: t('programas.phMaterialesNec') },
                                { key: 'sd_estimulo',       label: t('programas.sdCorto'),                 placeholder: t('programas.phSd') },
                                { key: 'unidad_positiva',   label: t('programas.unidadPosCorto'),           placeholder: t('programas.phUnidadPos') },
                                { key: 'unidad_negativa',   label: t('programas.unidadNegCorto'),           placeholder: t('programas.phUnidadNeg') },
                                { key: 'reforzadores',      label: t('programas.ayudas'),            placeholder: t('programas.phAyudasCorto') },
                                { key: 'correction_errores',label: t('programas.correccion'),         placeholder: t('programas.phCorrigeError') },
                                { key: 'generalizacion',    label: t('programas.generalizacion'),    placeholder: t('programas.phGeneralizar') },
                                { key: 'notas',             label: t('programas.notasLabel'),              placeholder: t('programas.obsSet') },
                              ].map(({ key, label, placeholder }) => (
                                <div key={key}>
                                  <label className="block text-[11px] font-bold text-v-accent mb-1">{label}</label>
                                  <textarea
                                    value={editSetForm[key] || ''}
                                    ref={autoGrowTextarea}
                                    onChange={e => setEditSetForm((f: any) => ({ ...f, [key]: e.target.value }))}
                                    onInput={e => autoGrowTextarea(e.currentTarget)}
                                    rows={2}
                                    placeholder={placeholder}
                                    className="w-full rounded-lg text-sm leading-relaxed resize-none outline-none transition-all focus:border-v-accent"
                                    style={{ background: 'var(--v-bg)', border: '1.5px solid var(--v-border)', color: 'var(--v-text)', padding: '10px 12px', minHeight: '52px' }}
                                  />
                                </div>
                              ))}
                              <div className="flex gap-2 pt-1">
                                <button onClick={() => setEditandoSetId(null)}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-bold text-v-muted border border-v-border hover:bg-v-fill">
                                  {t('common.cancelar')}
                                </button>
                                <button
                                  disabled={savingEditSet}
                                  onClick={async () => {
                                    setSavingEditSet(true)
                                    try {
                                      const res = await fetch('/api/programas-aba', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ action: 'actualizar_objetivo', objetivo_id: obj.id, ...editSetForm }),
                                      })
                                      const json = await res.json()
                                      if (json.error) throw new Error(json.error)
                                      onReload()
                                      setEditandoSetId(null)
                                    } catch (e: any) {
                                      alert('Error al guardar: ' + e.message)
                                    } finally {
                                      setSavingEditSet(false)
                                    }
                                  }}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-v-accent text-white hover:bg-v-accent-hover disabled:opacity-40 flex items-center justify-center gap-1">
                                  {savingEditSet ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                                  {savingEditSet ? t('common.guardando') : t('common.guardar')}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {!obj.materiales && !obj.sd_estimulo && !obj.unidad_positiva && !obj.unidad_negativa && !obj.reforzadores && !obj.ayudas && !obj.correction_errores && !obj.generalizacion && !obj.notas && (
                                <p className="text-v-subtle italic">{t("programas.sinProcedimiento")}</p>
                              )}
                              {obj.materiales && <p><span className="font-bold">{t('programas.matLabel')}:</span> {obj.materiales}</p>}
                              {obj.sd_estimulo && <p><span className="font-bold">{t('programas.sdCorto')}:</span> {obj.sd_estimulo}</p>}
                              {obj.unidad_positiva && <p><span className="font-bold">{t('programas.unidadPosCorto')}:</span> {obj.unidad_positiva}</p>}
                              {obj.unidad_negativa && <p><span className="font-bold">{t('programas.unidadNegCorto')}:</span> {obj.unidad_negativa}</p>}
                              {(obj.reforzadores || obj.ayudas) && <p><span className="font-bold">{t('programas.ayudas')}:</span> {obj.reforzadores || obj.ayudas}</p>}
                              {obj.correction_errores && <p><span className="font-bold">{t('programas.correccion')}:</span> {obj.correction_errores}</p>}
                              {obj.generalizacion && <p><span className="font-bold">{t('programas.generalizacion')}:</span> {obj.generalizacion}</p>}
                              {obj.notas && <p className="whitespace-pre-line"><span className="font-bold">{t('programas.notasLabel')}:</span> {obj.notas}</p>}
                            </>
                          )}
                        </motion.div>
                      )}
                      </div>
                    ))}
                  </div>
                )}
                  {/* Agregar set adicional */}
                  <button
                    onClick={() => setShowAgregarSet(true)}
                    className="mt-2 w-full py-2 border-2 border-dashed border-[var(--v-border)] rounded-v-sm text-xs font-bold text-v-subtle hover:border-v-accent/30 hover:text-v-accent transition-all"
                  >
                    {t('programas.agregarSet')}
                  </button>

                  {/* Modal Agregar Set */}
                  {showAgregarSet && (
                    <div className="v-scope fixed inset-0 z-50 flex items-end justify-center bg-[#081426]/50 p-4 backdrop-blur-sm sm:items-center">
                      <div className="rounded-v-lg bg-[var(--v-bg-elevated)] w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
                        <div className="p-6">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg" style={{color:'var(--v-text)'}}>{t('programas.nuevoSet')}</h3>
                            <button onClick={() => setShowAgregarSet(false)} className="p-2 rounded-full hover:bg-[var(--v-fill)]"><X size={18} /></button>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-bold text-v-muted block mb-1">{t('programas.descripcionSet')}</label>
                              <input value={nuevoSet.descripcion} onChange={e => setNuevoSet(s => ({...s, descripcion: e.target.value}))}
                                placeholder={t("programas.phSetDesc")}
                                className="w-full rounded-v-sm text-sm font-bold outline-none" style={{ background: 'var(--v-bg)', border: '1.5px solid var(--v-border)', color: 'var(--v-text)', padding: '10px 14px' }} />
                            </div>
                            {[
                              { key: 'materiales',       label: t('programas.matLabel'),                   placeholder: t('programas.materialesSetNec') },
                              { key: 'sd_estimulo',      label: t('programas.sdEstimuloFull'), placeholder: t('programas.phSdInicia') },
                              { key: 'unidad_positiva',  label: t('programas.unidadPos'),              placeholder: t('programas.phUnidadPos') },
                              { key: 'unidad_negativa',  label: t('programas.unidadNeg'),             placeholder: t('programas.phUnidadNeg') },
                              { key: 'reforzadores',     label: t('programas.ayudas'),                      placeholder: t('programas.phAyudasLargo') },
                              { key: 'correction_errores', label: t('programas.correccionFull'),         placeholder: t('programas.phCorrigeIncorrecta') },
                              { key: 'generalizacion',   label: t('programas.generalizacion'),              placeholder: t('programas.phGeneralizarFull') },
                              { key: 'notas',            label: t('programas.notasLabel'),                        placeholder: t('programas.obsSet') },
                            ].map(({ key, label, placeholder }) => (
                              <div key={key}>
                                <label className="text-xs font-bold text-v-muted block mb-1.5">{label}</label>
                                <textarea value={(nuevoSet as any)[key]}
                                  ref={autoGrowTextarea}
                                  onChange={e => setNuevoSet(s => ({...s, [key]: e.target.value}))}
                                  onInput={e => autoGrowTextarea(e.currentTarget)}
                                  rows={2} placeholder={placeholder}
                                  className="w-full rounded-v-sm text-sm leading-relaxed resize-none outline-none transition-all focus:border-v-accent" style={{ background: 'var(--v-bg)', border: '1.5px solid var(--v-border)', color: 'var(--v-text)', padding: '10px 14px', minHeight: '52px' }} />
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-3 mt-5">
                            <button onClick={() => setShowAgregarSet(false)}
                              className="flex-1 py-3 text-v-muted font-bold border-2 border-v-border rounded-v-sm hover:bg-[var(--v-fill)]">
                              {t('common.cancelar')}
                            </button>
                            <button disabled={!nuevoSet.descripcion.trim() || savingSet}
                              onClick={async () => {
                                setSavingSet(true)
                                try {
                                  const res = await fetch('/api/programas-aba', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'agregar_set', programa_id: programa.id, descripcion: nuevoSet.descripcion.trim(), materiales: nuevoSet.materiales, sd_estimulo: nuevoSet.sd_estimulo, unidad_positiva: nuevoSet.unidad_positiva, unidad_negativa: nuevoSet.unidad_negativa, reforzadores: nuevoSet.reforzadores, correction_errores: nuevoSet.correction_errores, generalizacion: nuevoSet.generalizacion, notas: nuevoSet.notas }),
                                  })
                                  const json = await res.json()
                                  if (json.error) { toast.error(json.error); return }
                                  toast.success(t('auto.programasABAView.setAgregado'))
                                  setShowAgregarSet(false)
                                  setNuevoSet({ descripcion: '', materiales: '', sd_estimulo: '', unidad_positiva: '', unidad_negativa: '', reforzadores: '', correction_errores: '', generalizacion: t('programas.defaultGeneralizacion'), notas: '' })
                                  fetchDetalle()
                                } finally { setSavingSet(false) }
                              }}
                              className="flex-[2] py-3 bg-v-accent text-white rounded-v-sm font-bold text-sm hover:bg-v-accent-hover disabled:opacity-50 flex items-center justify-center gap-2">
                              {savingSet ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                              {savingSet ? t('common.guardando') : t('programas.crearSet')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
              </div>

              {/* Últimas sesiones */}
              {detalle.sesiones_datos_aba?.length > 0 && (
                <div>
                  <SectionTitle icon={ListChecks}>{t('programas.ultimasSesiones')}</SectionTitle>
                  <div className="space-y-2">
                    {(() => {
                      const ordenadas = [...detalle.sesiones_datos_aba].sort((a: any, b: any) => {
                        const an = setNumOrder(a.set), bn = setNumOrder(b.set)
                        if (an !== bn) return an - bn
                        return (a.fecha || '').localeCompare(b.fecha || '')
                      })
                      const grupos: { set: string; sesiones: any[] }[] = []
                      for (const ses of ordenadas) {
                        const k = ses.set || '—'
                        const g = grupos.find(x => x.set === k)
                        if (g) g.sesiones.push(ses); else grupos.push({ set: k, sesiones: [ses] })
                      }
                      const ultimo = grupos[grupos.length - 1]?.set
                      return grupos.map(g => {
                        const abierto = setsAbiertos[g.set] ?? g.set === ultimo
                        const last = g.sesiones[g.sesiones.length - 1]
                        const lastPct = last?.porcentaje_exito != null ? Math.round(Number(last.porcentaje_exito)) : null
                        return (
                          <div key={g.set} className="overflow-hidden rounded-v-sm border border-v-border bg-v-elevated">
                            <button onClick={() => setSetsAbiertos(prev => ({ ...prev, [g.set]: !abierto }))}
                              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-v-fill">
                              <span className="rounded-full bg-v-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-v-accent">{g.set}</span>
                              <span className="text-xs text-v-muted">{g.sesiones.length} {t('programas.sesiones')}</span>
                              {lastPct !== null && (
                                <span className={`text-xs font-semibold tabular-nums ${lastPct >= (programa.criterio_dominio_pct ?? 80) ? 'text-v-success' : lastPct >= 60 ? 'text-v-warning' : 'text-v-danger'}`}>
                                  {lastPct}%
                                </span>
                              )}
                              <span className="ml-auto text-[11px] text-v-subtle">{last?.fecha}</span>
                              <ChevronDown size={15} className={`text-v-subtle transition-transform ${abierto ? 'rotate-180' : ''}`} />
                            </button>
                            {abierto && (
                            <div className="space-y-1 border-t border-v-border p-2">
                    {g.sesiones.map((s: any) => (
                      <SesionRow
                        key={s.id}
                        s={s}
                        programa={programa}
                        onDelete={async () => {
                          if (!await confirmar(t('auto.programasABAView.eliminarEstaSesion'))) return
                          const res = await fetch('/api/programas-aba', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'eliminar_sesion', sesion_id: s.id }),
                          })
                          const json = await res.json()
                          if (json.error) { toast.error(json.error); return }
                          toast.success(t('auto.programasABAView.sesionEliminada'))
                          onDeleteSesion?.(s.id)
                          setDetalle((prev: any) => {
                            const base = prev ?? programa
                            return {
                              ...base,
                              sesiones_datos_aba: (base.sesiones_datos_aba || []).filter((x: any) => x.id !== s.id)
                            }
                          })
                        }}
                        onDateChange={async (nuevaFecha: string) => {
                          const res = await fetch('/api/programas-aba', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'actualizar_sesion_fecha', sesion_id: s.id, fecha: nuevaFecha }),
                          })
                          const json = await res.json()
                          if (json.error) { toast.error(json.error); return }
                          toast.success(t('auto.programasABAView.fechaActualizada'))
                          setDetalle((prev: any) => {
                            const base = prev ?? programa
                            return {
                              ...base,
                              sesiones_datos_aba: (base.sesiones_datos_aba || []).map((x: any) =>
                                x.id === s.id ? { ...x, fecha: nuevaFecha } : x
                              )
                            }
                          })
                        }}
                        onPctChange={async (pct: number, correctas: number, totales: number) => {
                          const res = await fetch('/api/programas-aba', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'editar_sesion',
                              sesion_id: s.id,
                              updates: { respuestas_correctas: correctas, oportunidades_totales: totales },
                            }),
                          })
                          const json = await res.json()
                          if (json.error) { toast.error(json.error); return }
                          toast.success(t('auto.programasABAView.porcentajeActualizado'))
                          setDetalle((prev: any) => {
                            const base = prev ?? programa
                            return {
                              ...base,
                              sesiones_datos_aba: (base.sesiones_datos_aba || []).map((x: any) =>
                                x.id === s.id
                                  ? { ...x, porcentaje_exito: pct, respuestas_correctas: correctas, oportunidades_totales: totales, respuestas_incorrectas: Math.max(0, totales - correctas) }
                                  : x
                              )
                            }
                          })
                        }}
                        onSetChange={async (nuevoSet: string) => {
                          const res = await fetch('/api/programas-aba', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'editar_sesion',
                              sesion_id: s.id,
                              updates: { set: nuevoSet },
                            }),
                          })
                          const json = await res.json()
                          if (json.error) { toast.error(json.error); return }
                          toast.success(`Set cambiado a ${nuevoSet}`)
                          setDetalle((prev: any) => {
                            const base = prev ?? programa
                            return {
                              ...base,
                              sesiones_datos_aba: (base.sesiones_datos_aba || []).map((x: any) =>
                                x.id === s.id ? { ...x, set: nuevoSet } : x
                              )
                            }
                          })
                        }}
                        onFaseChange={async (nuevaFase: string) => {
                          const res = await fetch('/api/programas-aba', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'editar_sesion',
                              sesion_id: s.id,
                              updates: { fase: nuevaFase },
                            }),
                          })
                          const json = await res.json()
                          if (json.error) { toast.error(json.error); return }
                          const labelMap: Record<string, string> = {
                            linea_base: 'Baseline',
                            intervencion: t('fase.intervencion'),
                            mantenimiento: t('fase.mantenimiento'),
                            dominado: t('fase.dominado'),
                          }
                          toast.success(t('programas.faseCambiada', { fase: labelMap[nuevaFase] || nuevaFase }))
                          setDetalle((prev: any) => {
                            const base = prev ?? programa
                            return {
                              ...base,
                              sesiones_datos_aba: (base.sesiones_datos_aba || []).map((x: any) =>
                                x.id === s.id ? { ...x, fase: nuevaFase } : x
                              )
                            }
                          })
                        }}
                      />
                    ))}
                            </div>
                            )}
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              )}

              {/* Detalles del procedimiento */}
              {(detalle.sd_estimulo || detalle.unidad_positiva || detalle.unidad_negativa || detalle.reforzadores || detalle.materiales || detalle.correction_errores) && (
                <div>
                  <SectionTitle icon={Pin}>{t('programas.procedimiento')}</SectionTitle>
                  <div className="space-y-2 rounded-v-sm border border-v-border bg-v-elevated p-4 text-sm leading-relaxed text-v-muted [&_.font-bold]:text-v-text">
                    {detalle.sd_estimulo && <p><span className="font-bold">{t('programas.sdCorto')}:</span> {detalle.sd_estimulo}</p>}
                    {detalle.unidad_positiva && <p><span className="font-bold">{t('programas.unidadPosCorto')}:</span> {detalle.unidad_positiva}</p>}
                    {detalle.unidad_negativa && <p><span className="font-bold">{t('programas.unidadNegCorto')}:</span> {detalle.unidad_negativa}</p>}
                    {(detalle.reforzadores || detalle.ayudas) && <p><span className="font-bold">{t('programas.ayudas')}:</span> {detalle.reforzadores || detalle.ayudas}</p>}
                    {detalle.correction_errores && <p><span className="font-bold">{t('programas.correccion')}</span> {detalle.correction_errores}</p>}
                    {detalle.reforzadores && <p><span className="font-bold">{t("programas.reforzadoresColon")}</span> {detalle.reforzadores}</p>}
                    {detalle.materiales && <p><span className="font-bold">{t("programas.materialesColon")}</span> {detalle.materiales}</p>}
                  </div>
                </div>
              )}
              {/* Notas del programa — se capturan al crear el programa (paso 3) */}
              {detalle.notas_programa && (
                <div>
                  <SectionTitle icon={StickyNote}>{t('programas.notasProg')}</SectionTitle>
                  <div className="whitespace-pre-line rounded-v-sm border border-v-border bg-v-elevated p-4 text-sm leading-relaxed text-v-muted">
                    {detalle.notas_programa}
                  </div>
                </div>
              )}
              {/* Práctica en casa del padre */}
              <PracticaCasaPanel programaId={programa.id} programaNombre={programa.titulo} objetivos={detalle?.objetivos_cp || []} />

            </>
          ) : null}
        </div>
      )}
    </motion.div>
  )
}

// ── Panel de práctica en casa registrada por el padre ──────────────────────────
function PracticaCasaPanel({ programaId, programaNombre, objetivos = [] }: { programaId: string; programaNombre: string; objetivos?: any[] }) {
  const { t } = useI18n()
  const [registros, setRegistros] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const desde = new Date()
        desde.setDate(desde.getDate() - 56)
        const { data, error: sbError } = await supabase
          .from('programa_practica_casa')
          .select('fecha, objetivo_id')
          .eq('programa_id', programaId)
          .gte('fecha', desde.toISOString().split('T')[0])
          .order('fecha', { ascending: false })
        if (sbError) throw new Error(sbError.message)
        // Cualquier registro existente = practicado ese día
        setRegistros((data || []).map((r: any) => ({ ...r, practicado: true })))
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [programaId])

  // Agrupar por semana (lun-dom)
  const weeks: { label: string; days: { fecha: string; practicado: boolean; label: string; objetivoId?: string }[] }[] = []
  const hoy = new Date()

  for (let w = 0; w < 4; w++) {
    const dias: { fecha: string; practicado: boolean; label: string; objetivoId?: string }[] = []
    for (let d = 6; d >= 0; d--) {
      const date = new Date(hoy)
      date.setDate(hoy.getDate() - w * 7 - d)
      const fechaStr = date.toISOString().split('T')[0]
      const reg = registros.find((r: any) => r.fecha === fechaStr)
      dias.push({
        fecha: fechaStr,
        practicado: !!reg,
        label: ['D','L','M','X','J','V','S'][date.getDay()],
        objetivoId: reg?.objetivo_id || undefined,
      })
    }
    const semanaLabel = w === 0 ? 'Esta semana' : w === 1 ? 'Semana pasada' : `Hace ${w} semanas`
    const count = dias.filter(d => d.practicado).length
    weeks.push({ label: `${semanaLabel} · ${count}/7 días`, days: dias })
  }

  const totalDias = registros.length
  const adherencia = totalDias > 0 ? Math.round((totalDias / 56) * 100) : 0

  const adherenciaLabel = adherencia >= 70 ? t('programas.adhBuena') : adherencia >= 40 ? t('programas.adhModerada') : t('programas.adhBaja')

  return (
    <div>
      <SectionTitle icon={House} extra={!loading && (
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${adherencia >= 70 ? 'bg-v-success/15 text-v-success' : adherencia >= 40 ? 'bg-v-warning/15 text-v-warning' : 'bg-v-danger/10 text-v-danger'}`}>
          {adherenciaLabel} · {adherencia}%
        </span>
      )}>{t('programas.practicaCasa')}</SectionTitle>

      {loading ? (
        <div className="flex items-center gap-2 py-3">
          <Loader2 size={14} className="animate-spin" style={{ color: 'var(--v-text-tertiary)' }} />
          <span className="text-xs" style={{ color: 'var(--v-text-tertiary)' }}>{t("programas.cargandoRegistros")}</span>
        </div>
      ) : error ? (
        <div className="rounded-v p-4 text-center" style={{ background: 'var(--v-bg-elevated)', border: '1px solid #fca5a5' }}>
          <p className="text-xs font-medium text-v-danger">{t('programas.errorCargar')}: {error}</p>
          <p className="text-[10px] text-v-danger mt-1">Tabla: programa_practica_casa · ID: {programaId?.slice(0,8)}...</p>
        </div>
      ) : registros.length === 0 ? (
        <div className="rounded-v p-4 text-center" style={{ background: 'var(--v-bg-elevated)', border: '1px solid var(--v-border)', boxShadow: 'var(--v-shadow)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--v-text-tertiary)' }}>
            {t('programas.sinPracticaCasa')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {weeks.map((week, wi) => (
            <div key={wi} className="rounded-v p-3" style={{ background: 'var(--v-bg-elevated)', border: '1px solid var(--v-border)', boxShadow: 'var(--v-shadow)' }}>
              <p className="text-[10px] font-bold mb-2.5" style={{ color: 'var(--v-text-tertiary)' }}>{week.label}</p>
              <div className="overflow-x-auto">
              <div className="grid grid-cols-7 gap-1 min-w-[280px]">
                {week.days.map((day, di) => {
                  const obj = day.objetivoId ? objetivos.find((o: any) => o.id === day.objetivoId) : null
                  return (
                    <div key={di} className="flex flex-col items-center gap-1">
                      <span className="text-[9px] font-bold" style={{ color: 'var(--v-text-tertiary)' }}>{day.label}</span>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{
                          background: day.practicado ? 'rgba(5,150,105,0.15)' : 'var(--v-fill)',
                          border: `1.5px solid ${day.practicado ? '#1fae6b' : 'var(--v-border)'}`,
                        }}>
                        {day.practicado
                          ? <CheckCircle2 size={14} color="#1fae6b" />
                          : <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--v-border)', display: 'block' }} />
                        }
                      </div>
                      {obj && (
                        <span className="text-[8px] font-bold text-center leading-tight" style={{ color: '#1fae6b' }}>
                          Set {obj.numero_set}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Fila de sesión con edición de fecha inline ────────────────────────────────
function SesionRow({ s, programa, onDelete, onDateChange, onPctChange, onSetChange, onFaseChange }: {
  s: any; programa: any; onDelete: () => void; onDateChange: (fecha: string) => void; onPctChange: (pct: number, correctas: number, totales: number) => void; onSetChange: (nuevoSet: string) => void; onFaseChange?: (nuevaFase: string) => void
}) {
  const { t } = useI18n()
  const [editingDate, setEditingDate] = useState(false)
  const [tempDate, setTempDate] = useState(s.fecha)
  const [editingPct, setEditingPct] = useState(false)
  const [tempCorrectas, setTempCorrectas] = useState(String(s.respuestas_correctas ?? ''))
  const [tempTotales, setTempTotales] = useState(String(s.oportunidades_totales ?? ''))
  const [editingSet, setEditingSet] = useState(false)
  const [editingFase, setEditingFase] = useState(false)
  const fasesDisponibles: { value: string; label: string }[] = [
    { value: 'linea_base',    label: 'Baseline' },
    { value: 'intervencion',  label: t('fase.intervencion') },
    { value: 'mantenimiento', label: t('fase.mantenimiento') },
    { value: 'dominado',      label: t('fase.dominado') },
  ]
  const availableSets: string[] = [...(programa.objetivos_cp || [])].sort((a: any, b: any) => (a.numero_set ?? 0) - (b.numero_set ?? 0)).map((o: any) =>
    o.numero_set ? `Set ${o.numero_set}` : o.descripcion
  )

  const commitPct = () => {
    setEditingPct(false)
    const c = parseInt(tempCorrectas)
    const t = parseInt(tempTotales)
    if (!isNaN(c) && !isNaN(t) && t > 0) {
      onPctChange(Math.round((c / t) * 100), c, t)
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-v-sm p-3 border border-[var(--v-border)] bg-[var(--v-bg-elevated)] text-xs flex-wrap">
      {/* Fecha: click para editar */}
      {editingDate ? (
        <input
          type="date"
          autoFocus
          value={tempDate}
          onChange={e => setTempDate(e.target.value)}
          onBlur={() => {
            setEditingDate(false)
            if (tempDate && tempDate !== s.fecha) onDateChange(tempDate)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') { setTempDate(s.fecha); setEditingDate(false) }
          }}
          className="w-32 rounded-lg px-2 py-0.5 text-xs font-bold outline-none border-2 border-v-accent"
          style={{ background: 'var(--v-bg)', color: 'var(--v-text)' }}
        />
      ) : (
        <button
          onClick={() => { setTempDate(s.fecha); setEditingDate(true) }}
          className="w-20 shrink-0 text-left text-v-subtle hover:text-v-accent hover:underline transition-colors"
          title={t("programas.editarFecha")}
        >
          {s.fecha}
        </button>
      )}
      {/* Fase badge — click to change */}
      {editingFase && onFaseChange ? (
        <div className="flex items-center gap-1 flex-wrap">
          {fasesDisponibles.map(f => (
            <button
              key={f.value}
              onClick={() => { setEditingFase(false); if (f.value !== s.fase) onFaseChange(f.value) }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                f.value === s.fase
                  ? 'bg-v-accent text-white border-v-accent'
                  : 'bg-v-elevated text-v-muted border-v-border hover:bg-v-accent-soft hover:border-v-accent/30'
              }`}
            >{f.label}</button>
          ))}
          <button onClick={() => setEditingFase(false)} className="text-v-subtle hover:text-v-muted text-[10px] px-1">✕</button>
        </div>
      ) : (
        <button
          onClick={() => onFaseChange && setEditingFase(true)}
          title={onFaseChange ? 'Clic para cambiar la fase' : undefined}
          className={onFaseChange ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}
        >
          <FaseTag fase={s.fase} small />
        </button>
      )}
      {/* Set badge — click to change */}
      {editingSet ? (
        <div className="flex items-center gap-1 flex-wrap">
          {availableSets.map(setLabel => (
            <button
              key={setLabel}
              onClick={() => { setEditingSet(false); if (setLabel !== s.set) onSetChange(setLabel) }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                setLabel === s.set
                  ? 'bg-v-accent text-white border-v-accent'
                  : 'bg-v-elevated text-v-accent border-v-accent/30 hover:bg-v-accent-soft'
              }`}
            >{setLabel}</button>
          ))}
          <button onClick={() => setEditingSet(false)} className="text-v-subtle hover:text-v-muted text-[10px] px-1">✕</button>
        </div>
      ) : (
        <button
          onClick={() => setEditingSet(true)}
          title={t("programas.cambiarSet")}
          className="text-v-accent font-semibold text-[10px] bg-v-accent-soft px-1.5 py-0.5 rounded-md hover:bg-v-accent-soft transition-colors"
        >
          {s.set || <span className="text-v-subtle">set?</span>}
        </button>
      )}
      {s.porcentaje_exito !== null && (
        editingPct ? (
          // El commit sucede al salir del GRUPO completo (no al pasar de un
          // cuadro al otro). Si el foco sigue dentro del <span>, no cerramos;
          // así se puede editar el segundo cuadro sin que el primero lo cierre.
          <span
            className="flex items-center gap-1"
            onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) commitPct() }}
          >
            <input
              type="number" min={0} max={s.oportunidades_totales || 999} autoFocus
              value={tempCorrectas}
              onChange={e => setTempCorrectas(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitPct(); if (e.key === 'Escape') setEditingPct(false) }}
              className="w-10 rounded-md px-1 py-0.5 text-xs font-bold outline-none border-2 border-v-accent text-center"
              style={{ background: 'var(--v-bg)', color: 'var(--v-text)' }}
              title={t("programas.respuestasCorrectas")}
            />
            <span className="text-v-subtle">/</span>
            <input
              type="number" min={1}
              value={tempTotales}
              onChange={e => setTempTotales(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitPct(); if (e.key === 'Escape') setEditingPct(false) }}
              className="w-10 rounded-md px-1 py-0.5 text-xs font-bold outline-none border-2 border-v-accent text-center"
              style={{ background: 'var(--v-bg)', color: 'var(--v-text)' }}
              title={t("programas.oportunidadesTotales")}
            />
          </span>
        ) : (
          <button
            onClick={() => { setTempCorrectas(String(s.respuestas_correctas ?? '')); setTempTotales(String(s.oportunidades_totales ?? '')); setEditingPct(true) }}
            title={t("programas.clicEditar")}
            className={`font-bold hover:underline transition-colors ${
              s.porcentaje_exito >= programa.criterio_dominio_pct ? 'text-v-success' :
              s.porcentaje_exito >= 70 ? 'text-v-warning' : 'text-v-danger'
            }`}
          >{s.porcentaje_exito}%</button>
        )
      )}
      {s.oportunidades_totales > 0 && (
        <span className="text-v-subtle">{s.respuestas_correctas}/{s.oportunidades_totales}</span>
      )}
      {s.notas && <span className="text-v-subtle italic flex-1 truncate">{s.notas}</span>}
      <button
        onClick={onDelete}
        className="ml-auto p-1 text-v-subtle hover:text-v-danger shrink-0"
        title={t("programas.eliminarSesion")}
      >
        <X size={13} />
      </button>
    </div>
  )
}

function FaseTag({ fase, small }: { fase: string; small?: boolean }) {
  const { t } = useI18n()
  const labels: Record<string, { label: string; tone: string }> = {
    linea_base:    { label: 'Baseline',                    tone: 'bg-v-fill text-v-muted' },
    intervencion:  { label: t('fase.intervencion'),        tone: 'bg-v-accent-soft text-v-accent' },
    mantenimiento: { label: t('programas.mantenimiento'),  tone: 'bg-v-success/15 text-v-success' },
    dominado:      { label: t('fase.dominado'),            tone: 'bg-v-success/15 text-v-success' },
  }
  const cfg = labels[fase] || { label: fase, tone: 'bg-v-fill text-v-muted' }
  return (
    <span className={`rounded-full font-semibold ${cfg.tone} ${small ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-0.5 text-[10px]'}`}>
      {cfg.label}
    </span>
  )
}

// ── Piezas comunes de los modales (Vanty) ───────────────────────────────────
const mInput = 'w-full rounded-v-sm border border-v-border bg-v-bg px-3.5 py-2.5 text-sm text-v-text outline-none transition-shadow placeholder:text-v-subtle focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft'

function ModalShell({ icon: Icon, title, subtitle, onClose, maxW = 'max-w-lg', children, footer }: {
  icon: any; title: string; subtitle?: React.ReactNode; onClose: () => void; maxW?: string; children: React.ReactNode; footer: React.ReactNode
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="v-scope fixed inset-0 z-50 flex items-end justify-center bg-[#081426]/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={e => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full ${maxW} flex-col overflow-hidden rounded-t-v-lg border border-v-border bg-v-elevated shadow-v-lg sm:rounded-v-lg`}>
        <div className="flex items-start gap-3 px-6 pb-4 pt-5">
          <span className="v-brand grid size-10 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><Icon size={19} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold leading-tight tracking-tight text-v-text">{title}</h3>
            {subtitle && <div className="mt-0.5 truncate text-sm text-v-subtle">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-fill hover:text-v-text"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-2" style={{ scrollbarWidth: 'thin' }}>{children}</div>
        <div className="flex gap-3 border-t border-v-border bg-v-elevated px-6 py-4">{footer}</div>
      </motion.div>
    </motion.div>
  )
}

function MField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 flex items-baseline gap-1.5 text-xs font-semibold leading-tight text-v-muted">
        {stripEmoji(label)}{hint && <span className="font-normal text-v-subtle">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-full bg-v-fill p-1">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`relative flex-1 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${value === o.value ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
          {value === o.value && <motion.span layoutId={`seg-${options.map(x => x.value).join('')}`} className="absolute inset-0 rounded-full bg-v-elevated shadow-v" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

function NumberStepper({ value, onChange, min = 0, max = 100, suffix }: { value: number; onChange: (v: number) => void; min?: number; max?: number; suffix?: string }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  return (
    <div className="flex items-center rounded-full border border-v-border bg-v-bg p-1">
      <button type="button" onClick={() => onChange(clamp(value - 1))} className="grid size-8 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text"><Minus size={14} /></button>
      <div className="flex flex-1 items-baseline justify-center gap-0.5">
        <input type="number" min={min} max={max} value={value} onChange={e => onChange(clamp(Number(e.target.value) || 0))}
          className="w-12 bg-transparent text-center text-base font-semibold tabular-nums text-v-text outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
        {suffix && <span className="text-xs text-v-subtle">{suffix}</span>}
      </div>
      <button type="button" onClick={() => onChange(clamp(value + 1))} className="grid size-8 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text"><Plus size={14} /></button>
    </div>
  )
}

// ── Modal: Registrar Sesión ──────────────────────────────────────────────────
function RegistrarSesionModal({ programa, childId, onClose, onSaved }: any) {
  const { t } = useI18n()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const lastSet = [...(programa.sesiones_datos_aba || [])]
    .sort((a: any, b: any) => (a.fecha || '').localeCompare(b.fecha || ''))
    .at(-1)?.set ?? ''
  const [form, setForm] = useState({
    fase: programa.fase_actual === 'linea_base' ? 'linea_base' : (programa.fase_actual || 'intervencion'),
    oportunidades_totales: '',
    respuestas_correctas: '',
    set_activo: lastSet,
    notas: '',
    fecha: new Date().toISOString().split('T')[0],
  })

  const pct = form.oportunidades_totales && form.respuestas_correctas
    ? ((Number(form.respuestas_correctas) / Number(form.oportunidades_totales)) * 100).toFixed(1)
    : null

  const crit = programa.criterio_dominio_pct || 90
  const critSesiones = programa.criterio_sesiones_consecutivas || 2

  // Check recent sessions for criterion progress (sorted by date)
  const sesiones = [...(programa.sesiones_datos_aba || [])].sort((a: any, b: any) => (a.fecha || "").localeCompare(b.fecha || ""))
  const recentAtCrit = sesiones.slice(-critSesiones + 1).filter((s: any) => (s.porcentaje_exito ?? 0) >= crit).length
  const currentPctNum = pct ? Number(pct) : null
  const meetsThisSession = currentPctNum !== null && currentPctNum >= crit

  let criterioMsg = null
  if (pct) {
    if (meetsThisSession && recentAtCrit >= critSesiones - 1) {
      criterioMsg = { type: 'success', msg: t('programas.criterioToast', { n: String(critSesiones), pct: String(crit) }) }
    } else if (meetsThisSession && critSesiones > 1) {
      const remaining = critSesiones - 1 - recentAtCrit
      if (remaining === 1) criterioMsg = { type: 'close', msg: `⚡ ¡Vas muy bien! Falta 1 sesión más al ${crit}% para dominar` }
      else criterioMsg = { type: 'progress', msg: `👍 Buen trabajo, sigue así` }
    }
  }

  const handleSave = async () => {
    if (!form.oportunidades_totales) {
      toast.error(t('auto.programasABAView.ingresaOportunidadesTotales'))
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/programas-aba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({
          action: 'registrar_sesion',
          sesion: {
            programa_id: programa.id,
            child_id: childId,
            fecha: form.fecha,
            fase: form.fase,
            oportunidades_totales: Number(form.oportunidades_totales) || 0,
            respuestas_correctas: Number(form.respuestas_correctas) || 0,
            respuestas_incorrectas: Math.max(0, Number(form.oportunidades_totales) - Number(form.respuestas_correctas)),
            set: form.set_activo.trim() || null,
            notas: form.notas,
          },
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(t('auto.programasABAView.sesionRegistrada'))
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally { setSaving(false) }
  }

  // Fetch sets for this program
  const sets = [...(programa.objetivos_cp || [])].sort((a: any, b: any) => (a.numero_set ?? 0) - (b.numero_set ?? 0))

  const setKeys = sets.map((s: any) => (s.numero_set ? `Set ${s.numero_set}` : s.descripcion))
  const [otroSet, setOtroSet] = useState(!!form.set_activo && !setKeys.includes(form.set_activo))
  const pctNum = pct ? Number(pct) : null
  const pctTone = pctNum === null ? '' : pctNum >= crit ? 'text-v-success' : pctNum >= 70 ? 'text-v-warning' : 'text-v-danger'
  const ringColor = pctNum === null ? 'var(--v-border)' : pctNum >= crit ? 'var(--v-success)' : pctNum >= 70 ? 'var(--v-warning)' : 'var(--v-danger)'
  const circ = 2 * Math.PI * 34

  return (
    <ModalShell icon={ClipboardList} title={t('programas.registrarSesion')} subtitle={programa.titulo} onClose={onClose} maxW="max-w-md"
      footer={<>
        <button onClick={onClose} className="flex-1 rounded-full border border-v-border py-3 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill">
          {t('common.cancelar')}
        </button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving}
          className="v-brand flex flex-[2] items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? t('common.guardando') : t('programas.guardarSesion')}
        </motion.button>
      </>}>
      <div className="space-y-5 pb-3">
        <div className="grid grid-cols-2 gap-3">
          <MField label={t('common.fecha')}>
            <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} className={mInput} />
          </MField>
          <MField label={t('ui.phase')}>
            <select value={form.fase} onChange={e => setForm(f => ({ ...f, fase: e.target.value }))} className={mInput}>
              <option value="linea_base">{t('programas.lineaBase')}</option>
              <option value="intervencion">{t('ui.intervention')}</option>
              <option value="mantenimiento">{t('programas.mantenimiento')}</option>
            </select>
          </MField>
        </div>

        {/* % de éxito con anillo en vivo */}
        <div className="rounded-v border border-v-border bg-v-bg p-4">
          <div className="flex items-center gap-4">
            <div className="relative size-[84px] shrink-0">
              <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
                <circle cx="42" cy="42" r="34" fill="none" stroke="var(--v-fill)" strokeWidth="8" />
                <motion.circle cx="42" cy="42" r="34" fill="none" stroke={ringColor} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={circ} animate={{ strokeDashoffset: circ * (1 - Math.min(100, pctNum ?? 0) / 100) }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
              </svg>
              <span className={`absolute inset-0 grid place-items-center text-lg font-bold tabular-nums ${pctTone || 'text-v-subtle'}`}>
                {pctNum === null ? '—' : `${Math.round(pctNum)}%`}
              </span>
            </div>
            <div className="grid flex-1 grid-cols-2 items-end gap-2.5">
              <MField label={t('ui.correct_responses')}>
                <input type="number" min="0" value={form.respuestas_correctas} placeholder="8"
                  onChange={e => setForm(f => ({ ...f, respuestas_correctas: e.target.value }))}
                  className={`${mInput} text-center text-lg font-semibold tabular-nums`} />
              </MField>
              <MField label={t('ui.total_opportunities')}>
                <input type="number" min="0" value={form.oportunidades_totales} placeholder="10"
                  onChange={e => setForm(f => ({ ...f, oportunidades_totales: e.target.value }))}
                  className={`${mInput} text-center text-lg font-semibold tabular-nums`} />
              </MField>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-v-subtle">Criterio: {crit}% en {critSesiones} sesiones seguidas</p>
          <AnimatePresence>
            {criterioMsg && (
              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className={`mt-2 flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  criterioMsg.type === 'success' ? 'bg-v-success/15 text-v-success' : criterioMsg.type === 'close' ? 'bg-v-warning/15 text-v-warning' : 'bg-v-fill text-v-muted'
                }`}>
                {criterioMsg.type === 'success' ? <Trophy size={13} /> : criterioMsg.type === 'close' ? <Zap size={13} /> : <TrendingUp size={13} />}
                {stripEmoji(criterioMsg.msg)}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Set activo */}
        {sets.length > 0 && (
          <MField label={t('programas.setActivo')}>
            <div className="space-y-1.5">
              {sets.map((s: any) => {
                const setKey = s.numero_set ? `Set ${s.numero_set}` : s.descripcion
                const isActive = !otroSet && form.set_activo === setKey
                return (
                  <button key={s.id} type="button" onClick={() => { setOtroSet(false); setForm(f => ({ ...f, set_activo: setKey })) }}
                    title={s.descripcion || undefined}
                    className={`flex w-full items-center gap-3 rounded-v-sm border p-2.5 text-left transition-all ${isActive ? 'border-v-accent/50 bg-v-accent-soft ring-4 ring-v-accent-soft' : 'border-v-border bg-v-elevated hover:border-v-accent/30'}`}>
                    <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${isActive ? 'v-brand' : s.estado === 'dominado' ? 'bg-v-success/15 text-v-success' : 'bg-v-fill text-v-muted'}`} style={{ boxShadow: 'none' }}>
                      {s.estado === 'dominado' && !isActive ? <Trophy size={12} /> : (s.numero_set ?? '•')}
                    </span>
                    <span className={`line-clamp-2 flex-1 text-sm ${isActive ? 'font-semibold text-v-accent' : 'text-v-text'}`}>{s.descripcion || setKey}</span>
                    {isActive && <CheckCircle2 size={16} className="shrink-0 text-v-accent" />}
                  </button>
                )
              })}
              {otroSet ? (
                <input autoFocus value={form.set_activo} onChange={e => setForm(f => ({ ...f, set_activo: e.target.value }))}
                  placeholder={t('programas.phSetNivel')} className={mInput} />
              ) : (
                <button type="button" onClick={() => { setOtroSet(true); setForm(f => ({ ...f, set_activo: '' })) }}
                  className="text-xs font-semibold text-v-accent hover:underline">+ Otro set / nivel</button>
              )}
            </div>
          </MField>
        )}

        <MField label={t('programas.notasLabel')}>
          <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
            rows={2} placeholder={t('ui.session_observations')} className={`${mInput} resize-none`} />
        </MField>
      </div>
    </ModalShell>
  )
}

// ── Modal: Crear Programa ────────────────────────────────────────────────────
function CrearProgramaModal({ childId, onClose, onCreated }: any) {
  const { t } = useI18n()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    titulo: '', area: '', area_tags: [] as string[], objetivo_lp: '',
    sd_estimulo: '', correction_errores: '', reforzadores: '', materiales: '',
    unidad_positiva: '', unidad_negativa: '', generalizacion: t('programas.defaultGeneralizacion'),
    total_unidades: '10u.', notas_programa: '', drive_url: '',
    tipo_medicion: 'porcentaje', criterio_dominio_pct: 90, criterio_sesiones_consecutivas: 2,
    fase_actual: 'intervencion',
  })
  const [objetivos, setObjetivos] = useState([{ descripcion: '', materiales: '', sd_estimulo: '', unidad_positiva: '', unidad_negativa: '', reforzadores: '', correction_errores: '', generalizacion: t('programas.defaultGeneralizacion'), notas: '' }])
  const [setExpandido, setSetExpandido] = useState<number | null>(0)

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const toggleAreaTag = (tag: string) => {
    setForm(f => ({
      ...f,
      area_tags: f.area_tags.includes(tag) ? f.area_tags.filter(t => t !== tag) : [...f.area_tags, tag]
    }))
  }

  const handleSave = async () => {
    if (!form.titulo || !form.objetivo_lp || !form.area) { toast.error(t('auto.programasABAView.tituloAreaYObjetivoSon')); return }
    setSaving(true)
    try {
      const res = await fetch('/api/programas-aba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({
          action: 'crear_programa',
          programa: (({ correction_errores, sd_estimulo, unidad_positiva, unidad_negativa, reforzadores, materiales, generalizacion, ...rest }) => ({
            ...rest, child_id: childId, ayudas: reforzadores, // backward compat
          }))(form),
          objetivos: objetivos
            .map((o, i) => ({ ...o, descripcion: o.descripcion.trim() || `Set ${i + 1}` }))
            .filter(o => o.descripcion),
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(t('auto.programasABAView.programaCreado'))
      onCreated()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const AREA_TAG_OPTIONS = Object.entries(AREA_CONFIG).map(([k, v]) => ({ key: k, ...v }))

  const PASOS = [t('programas.paso1Info'), t('programas.paso2Sets'), t('programas.paso3Proc')].map(x => stripEmoji(x).replace(/^(Paso|Step)\s*\d+\s*[·:.-]?\s*/i, ''))
  const paso1Listo = !!(form.titulo && form.objetivo_lp && form.area)
  const nuevoSet = { descripcion: '', materiales: '', sd_estimulo: '', unidad_positiva: '', unidad_negativa: '', reforzadores: '', correction_errores: '', generalizacion: t('programas.defaultGeneralizacion'), notas: '' }

  return (
    <ModalShell icon={ClipboardList} title={t('programas.nuevoPrograma')} onClose={onClose}
      subtitle={
        <div className="mt-2 flex items-center gap-2">
          {PASOS.map((label, i) => {
            const n = i + 1
            const done = n < step, current = n === step
            return (
              <button key={n} type="button" disabled={n > 1 && !paso1Listo} onClick={() => setStep(n)}
                className="flex min-w-0 items-center gap-1.5 disabled:cursor-not-allowed">
                <span className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-colors ${current ? 'v-brand' : done ? 'bg-v-success text-white' : 'bg-v-fill text-v-subtle'}`} style={{ boxShadow: 'none' }}>
                  {done ? <CheckCircle2 size={11} /> : n}
                </span>
                <span className={`truncate text-xs ${current ? 'font-semibold text-v-text' : 'text-v-subtle'}`}>{label}</span>
                {n < 3 && <span className="mx-0.5 h-px w-4 shrink-0 bg-v-border" />}
              </button>
            )
          })}
        </div>
      }
      footer={<>
        {step > 1 && (
          <button onClick={() => setStep(s => s - 1)} className="flex-1 rounded-full border border-v-border py-3 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill">
            ← {t('common.atras') === 'common.atras' ? 'Atrás' : t('common.atras')}
          </button>
        )}
        {step < 3 ? (
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setStep(s => s + 1)} disabled={!paso1Listo}
            className="v-brand flex flex-[2] items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold disabled:opacity-40 disabled:shadow-none">
            {t('programas.siguiente')} <ArrowRight size={16} />
          </motion.button>
        ) : (
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving}
            className="v-brand flex flex-[2] items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {saving ? t('programas.creando') : t('programas.crearPrograma')}
          </motion.button>
        )}
      </>}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="space-y-4 pb-3">
          {step === 1 && (
            <>
              <MField label={`${t('programas.area')} *`}>
                <input value={form.area} onChange={e => set('area', e.target.value)} placeholder={t('programas.phArea')} className={mInput} />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {AREA_TAG_OPTIONS.map(o => {
                    const on = form.area.trim().toLowerCase() === o.label.toLowerCase()
                    return (
                      <button key={o.key} type="button" onClick={() => set('area', o.label)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${on ? 'bg-v-accent-soft text-v-accent ring-1 ring-v-accent/40' : 'bg-v-fill text-v-muted hover:text-v-text'}`}>
                        <o.Icon size={11} /> {o.label}
                      </button>
                    )
                  })}
                </div>
              </MField>
              <MField label={`${t('programas.nombrePrograma')} *`}>
                <input value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder={t('programas.placeholderNombre')} className={mInput} />
              </MField>
              <MField label={t('programas.objetivoLargoPlazo')}>
                <textarea value={form.objetivo_lp} onChange={e => set('objetivo_lp', e.target.value)} rows={4}
                  placeholder={t('ui.mastery_criterion')} className={`${mInput} resize-y leading-relaxed`} />
              </MField>
              <MField label={t('programas.faseInicial')}>
                <Segmented value={form.fase_actual as 'linea_base' | 'intervencion' | 'mantenimiento'} onChange={v => set('fase_actual', v)}
                  options={[
                    { value: 'linea_base', label: t('programas.lineaBase') },
                    { value: 'intervencion', label: t('programas.intervencion') },
                    { value: 'mantenimiento', label: t('programas.mantenimiento') },
                  ]} />
              </MField>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-v-muted">{t('programas.definePasos')}</p>
              {objetivos.map((obj, i) => {
                const abierto = setExpandido === i
                return (
                  <div key={i} className={`overflow-hidden rounded-v border bg-v-elevated transition-colors ${abierto ? 'border-v-accent/40' : 'border-v-border'}`}>
                    <div className="flex cursor-pointer items-center gap-2.5 p-3 transition-colors hover:bg-v-fill" onClick={() => setSetExpandido(abierto ? null : i)}>
                      <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${abierto ? 'v-brand' : 'bg-v-fill text-v-muted'}`} style={{ boxShadow: 'none' }}>{i + 1}</span>
                      <input value={obj.descripcion} onClick={e => e.stopPropagation()}
                        onChange={e => { const u = [...objetivos]; u[i] = { ...u[i], descripcion: e.target.value }; setObjetivos(u) }}
                        placeholder={`Set ${i + 1}: describe el objetivo`}
                        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-v-text outline-none placeholder:font-normal placeholder:text-v-subtle" />
                      {objetivos.length > 1 && (
                        <button onClick={e => { e.stopPropagation(); setObjetivos(objetivos.filter((_, j) => j !== i)) }}
                          className="grid size-7 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-danger/10 hover:text-v-danger"><Trash2 size={13} /></button>
                      )}
                      <ChevronDown size={16} className={`shrink-0 text-v-subtle transition-transform ${abierto ? 'rotate-180' : ''}`} />
                    </div>
                    <AnimatePresence initial={false}>
                      {abierto && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                          <div className="grid gap-3 border-t border-v-border bg-v-bg p-3 sm:grid-cols-2">
                            {([
                              { key: 'sd_estimulo',        label: t('programas.sdEstimuloFull'),  placeholder: t('programas.phSd') },
                              { key: 'materiales',         label: t('programas.matLabel'),        placeholder: t('programas.materialesSet') },
                              { key: 'unidad_positiva',    label: t('programas.unidadPos'),       placeholder: t('programas.phUnidadPos') },
                              { key: 'unidad_negativa',    label: t('programas.unidadNeg'),       placeholder: t('programas.phUnidadNeg') },
                              { key: 'reforzadores',       label: t('programas.ayudas'),          placeholder: t('programas.phAyudasCorto') },
                              { key: 'correction_errores', label: t('programas.correccionFull'),  placeholder: t('programas.phCorrigeIncorrecta') },
                              { key: 'generalizacion',     label: t('programas.generalizacion'),  placeholder: t('programas.phGeneralizar') },
                              { key: 'notas',              label: t('programas.notasLabel'),      placeholder: t('programas.obsSet') },
                            ] as { key: string; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
                              <MField key={key} label={label}>
                                <textarea value={(obj as any)[key] ?? ''} ref={autoGrowTextarea}
                                  onChange={e => { const u = [...objetivos]; u[i] = { ...u[i], [key]: e.target.value }; setObjetivos(u) }}
                                  onInput={e => autoGrowTextarea(e.currentTarget)}
                                  rows={2} placeholder={placeholder} className={`${mInput} resize-none bg-v-elevated leading-relaxed`} />
                              </MField>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
              <button onClick={() => { setObjetivos([...objetivos, { ...nuevoSet }]); setSetExpandido(objetivos.length) }}
                className="flex w-full items-center justify-center gap-1.5 rounded-v-sm border border-dashed border-v-border py-3 text-sm font-semibold text-v-subtle transition-colors hover:border-v-accent/40 hover:text-v-accent">
                <Plus size={15} /> {stripEmoji(t('programas.agregarSet')).replace(/^\+\s*/, '')}
              </button>
              <div className="grid grid-cols-2 gap-3 rounded-v border border-v-border bg-v-bg p-4">
                <MField label={t('programas.criterioDominio')}>
                  <NumberStepper value={form.criterio_dominio_pct} onChange={v => set('criterio_dominio_pct', v)} min={0} max={100} suffix="%" />
                </MField>
                <MField label={t('programas.criterioSesiones')}>
                  <NumberStepper value={form.criterio_sesiones_consecutivas} onChange={v => set('criterio_sesiones_consecutivas', v)} min={1} max={10} />
                </MField>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <MField label={t('programas.generalizacion')}>
                <textarea value={form.generalizacion} onChange={e => set('generalizacion', e.target.value)} rows={3}
                  placeholder={t('programas.phGeneralizarFull')} className={`${mInput} resize-none leading-relaxed`} />
              </MField>
              <MField label={t('programas.notasProg')}>
                <textarea value={form.notas_programa} onChange={e => set('notas_programa', e.target.value)} rows={3}
                  placeholder={t('programas.phObsPrograma')} className={`${mInput} resize-none leading-relaxed`} />
              </MField>
              <MField label="Total de unidades" hint="(por sesión)">
                <input value={form.total_unidades} onChange={e => set('total_unidades', e.target.value)} placeholder="10u." className={mInput} />
              </MField>
              {/* Resumen antes de crear */}
              <div className="rounded-v border border-v-border bg-v-bg p-4">
                <p className="mb-2 text-xs font-semibold text-v-muted">Resumen</p>
                <p className="text-sm font-semibold text-v-text">{form.titulo}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-v-fill px-2.5 py-0.5 text-[11px] font-semibold text-v-muted">{form.area}</span>
                  <FaseTag fase={form.fase_actual} />
                  <span className="rounded-full bg-v-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-v-accent">{objetivos.length} set{objetivos.length === 1 ? '' : 's'}</span>
                  <span className="rounded-full bg-v-success/15 px-2.5 py-0.5 text-[11px] font-semibold text-v-success">{form.criterio_dominio_pct}% × {form.criterio_sesiones_consecutivas}</span>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </ModalShell>
  )
}
