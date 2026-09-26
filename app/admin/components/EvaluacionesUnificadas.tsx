'use client'

import { useI18n } from '@/lib/i18n-context'
import { useTranslatedForm } from '@/lib/form-translate'
import { toBCP47 } from '@/lib/i18n'

/**
 * =====================================================================
 * EVALUACIONES UNIFICADAS - Centro Clínico ABA
 * Fusiona Evaluaciones Clínicas (BRIEF2, ADOS2, WISC-V...) +
 * NeuroFormas (TDAH, TEA, Sensorial, Habilidades, Casa)
 * Con IA, envío a padres, análisis clínico profesional
 * =====================================================================
 */

import { useState, useEffect, createElement } from 'react'
import {
  Brain, Send, ChevronRight, ChevronLeft, CheckCircle2, X, Loader2,
  Sparkles, FileText, Plus, Eye, Clock, AlertTriangle, Search,
  Zap, MessageCircle, BarChart3, RefreshCw, BookOpen, Target, Heart,
  Activity, Star, ChevronDown, ChevronUp, Save, ClipboardList,
  Filter, Users, TrendingUp, Shield, Stethoscope, Home, Baby,
  CalendarDays, Lock, Unlock, Download, LayoutGrid, Puzzle, Gauge, Waves, ClipboardCheck, PenLine
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { TokensPrediccion, avisarTokens } from '@/components/TokensPrediccion'
import { ElegirModoLlenado, ChipModoLlenado, CostoToken, type ModoLlenado } from '@/components/ModoLlenado'

// ─── Mapeo categoría → ícono lucide + color clínico (no emojis) ─────────────
const CAT_ICON: Record<string, any> = {
  all: LayoutGrid, conductual: Target, familia: Home, clinico: Stethoscope,
  tea: Puzzle, tdah: Zap, habilidades: Activity, cognitivo: Gauge, sensorial: Waves,
}
const CAT_ACCENT: Record<string, string> = {}
const formIcon = (f: any) => CAT_ICON[f?.category] || FileText
const formAccent = (f: any) => CAT_ACCENT[f?.category] || '#0069db'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import {
  ALL_FORMS, FORM_CATEGORIES, type FormDefinition, type FormCategory
} from '../data/neurodivergentForms'
import {
  ANAMNESIS_DATA, ABA_DATA, ENTORNO_HOGAR_DATA, BRIEF2_DATA,
  ADOS2_DATA, VINELAND3_DATA, WISCV_DATA, BASC3_DATA, ABLLS_R_DATA
} from '../data/formConstants'
import { ANAMNESIS_DATA_EN, ABA_DATA_EN, ENTORNO_HOGAR_DATA_EN, BRIEF2_DATA_EN, ADOS2_DATA_EN, VINELAND3_DATA_EN, WISCV_DATA_EN, BASC3_DATA_EN, ABLLS_R_DATA_EN } from '../data/formConstants-en'
import { ALL_FORMS_EN } from '../data/neurodivergentForms-en'
import { calcularEdadNumerica } from '../utils/helpers'

// ─── CATEGORÍAS ORDENADAS POR ÁREA CLÍNICA ──────────────────────────────────
const UNIFIED_CATEGORIES = [
  { id: 'all',        label: 'Todas las plantillas', icon: '🗂️', color: 'bg-v-fill text-v-text border-v-border' },
  { id: 'conductual', label: 'ABA / Sesión',          icon: '🎯', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'familia',    label: 'Familia / Hogar',       icon: '🏠', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  { id: 'clinico',    label: 'Historia Clínica',      icon: '📋', color: 'bg-v-fill text-v-text border-v-border' },
  { id: 'tea',        label: 'TEA / Diagnóstico',     icon: '🧩', color: 'bg-v-accent-soft text-v-accent border-v-accent/30' },
  { id: 'tdah',       label: 'TDAH',                  icon: '⚡', color: 'bg-v-accent-soft text-v-accent border-v-accent/30' },
  { id: 'habilidades',label: 'Conducta Adaptativa',   icon: '🌟', color: 'bg-green-50 text-green-700 border-green-200' },
  { id: 'cognitivo',  label: 'Cognitivo / CI',        icon: '🧠', color: 'bg-v-accent-soft text-v-accent border-v-accent/30' },
  { id: 'sensorial',  label: 'Sensorial',             icon: '🌀', color: 'bg-teal-50 text-teal-700 border-teal-200' },
]

// ─── PLANTILLAS CLÍNICAS (simplificadas según feedback clínico) ────────────────
// Solo se mantienen las plantillas que SÍ se ejecutan en la plataforma.
// Las pruebas estandarizadas (ADOS-2, WISC, etc.) corren en sus propias plataformas;
// aquí solo se registran sus resultados.
const CLINICAL_FORMS = [
  // ── ÁREA ABA (Core del sistema) ──────────────────────────────────────────
  {
    id: 'aba', title: 'Sesión ABA', subtitle: 'Registro de sesión conductual',
    category: 'conductual', icon: '🎯', tags: ['ABA', 'Sesión', 'Conductual'],
    color: 'from-orange-500 to-red-600', estimatedMinutes: 15, targetRole: 'admin',
    description: 'Registro estructurado de sesión de Análisis Conductual Aplicado',
    formKey: 'aba', area: 'ABA'
  },
  {
    id: 'entorno_hogar', title: 'Entorno en el Hogar', subtitle: 'Observación del ambiente familiar',
    category: 'familia', icon: '🏠', tags: ['Hogar', 'Familia', 'Ambiente'],
    color: 'from-pink-500 to-rose-600', estimatedMinutes: 20, targetRole: 'both',
    description: 'Análisis del entorno familiar y su impacto en el desarrollo del niño',
    formKey: 'entorno_hogar', area: 'ABA'
  },
  // ── ÁREA CLÍNICA (Historia y datos del paciente) ──────────────────────────
  {
    id: 'anamnesis', title: 'Historia Clínica', subtitle: 'Datos relevantes del cliente y contexto familiar',
    category: 'clinico', icon: '📋', tags: ['Historia', 'Inicial', 'Completo'],
    color: 'from-slate-600 to-slate-800', estimatedMinutes: 30, targetRole: 'admin',
    description: 'Historia clínica completa del paciente, antecedentes familiares y desarrollo temprano',
    formKey: 'anamnesis', area: 'Clínico'
  },
  // ── ÁREA RESULTADOS (Registro de pruebas externas) ────────────────────────
  {
    id: 'ados2', title: 'ADOS-2', subtitle: 'Registro de resultados diagnósticos',
    category: 'tea', icon: '🔬', tags: ['TEA', 'ADOS', 'Diagnóstico'],
    color: 'from-v-brand-from to-v-brand-to', estimatedMinutes: 10, targetRole: 'admin',
    description: '⚠️ Corre en plataforma oficial ADOS-2. Aquí solo registrá los resultados y puntuaciones.',
    formKey: 'ados2', area: 'Resultados', externalPlatform: true
  },
  {
    id: 'vineland3', title: 'Vineland-3', subtitle: 'Registro de conducta adaptativa',
    category: 'habilidades', icon: '🌟', tags: ['Adaptativo', 'Vineland', 'Funcional'],
    color: 'from-green-500 to-emerald-600', estimatedMinutes: 10, targetRole: 'admin',
    description: '⚠️ Corre en plataforma oficial Vineland-3. Aquí solo registrá puntuaciones compuestas y perfil.',
    formKey: 'vineland3', area: 'Resultados', externalPlatform: true
  },
  {
    id: 'wiscv', title: 'WISC-V', subtitle: 'Registro de inteligencia (6-16 años)',
    category: 'cognitivo', icon: '📊', tags: ['CI', 'Inteligencia', 'WISC'],
    color: 'from-v-brand-from to-v-brand-to', estimatedMinutes: 10, targetRole: 'admin',
    description: '⚠️ Corre en plataforma oficial WISC-V. Aquí solo registrá IQ y percentiles.',
    formKey: 'wiscv', area: 'Resultados', externalPlatform: true
  },
  {
    id: 'basc3', title: 'BASC-3', subtitle: 'Registro de evaluación conductual',
    category: 'conductual', icon: '📈', tags: ['Conductual', 'BASC', 'Emocional'],
    color: 'from-amber-500 to-orange-600', estimatedMinutes: 10, targetRole: 'admin',
    description: '⚠️ Corre en plataforma oficial BASC-3. Aquí solo registrá T-scores y escalas.',
    formKey: 'basc3', area: 'Resultados', externalPlatform: true
  },
  {
    id: 'abllsr', title: 'ABLLS-R', subtitle: 'Evaluación de habilidades básicas del lenguaje y aprendizaje',
    category: 'habilidades', icon: '📚', tags: ['ABA', 'Lenguaje', 'Habilidades', 'TEA'],
    color: 'from-teal-500 to-v-brand-to', estimatedMinutes: 45, targetRole: 'admin',
    description: 'Assessment of Basic Language and Learning Skills - Revised. Evalúa habilidades de cooperación, lenguaje receptivo/expresivo, socialización, academia y AVD.',
    formKey: 'abllsr', area: 'Resultados', externalPlatform: false
  },
]

// Merge NeuroForms from neurodivergentForms.ts + Clinical forms
const CLINICAL_FORMS_EN: Record<string, { title: string; subtitle: string; description: string; tags: string[] }> = {
  aba: { title: 'ABA Session', subtitle: 'Behavioral session record', description: 'Structured Applied Behavior Analysis session record', tags: ['ABA', 'Session', 'Behavioral'] },
  entorno_hogar: { title: 'Home Environment', subtitle: 'Observation of the family environment', description: "Analysis of the family environment and its impact on the child's development", tags: ['Home', 'Family', 'Environment'] },
  anamnesis: { title: 'Clinical History', subtitle: 'Relevant client data and family context', description: 'Complete patient clinical history, family background and early development', tags: ['History', 'Initial', 'Complete'] },
  ados2: { title: 'ADOS-2', subtitle: 'Diagnostic results record', description: '⚠️ Runs on the official ADOS-2 platform. Here only record the results and scores.', tags: ['ASD', 'ADOS', 'Diagnostic'] },
  vineland3: { title: 'Vineland-3', subtitle: 'Adaptive behavior record', description: '⚠️ Runs on the official Vineland-3 platform. Here only record composite scores and profile.', tags: ['Adaptive', 'Vineland', 'Functional'] },
  wiscv: { title: 'WISC-V', subtitle: 'Intelligence record (6-16 years)', description: '⚠️ Runs on the official WISC-V platform. Here only record IQ and percentiles.', tags: ['IQ', 'Intelligence', 'WISC'] },
  basc3: { title: 'BASC-3', subtitle: 'Behavioral evaluation record', description: '⚠️ Runs on the official BASC-3 platform. Here only record T-scores and scales.', tags: ['Behavioral', 'BASC', 'Emotional'] },
  abllsr: { title: 'ABLLS-R', subtitle: 'Assessment of basic language and learning skills', description: 'Assessment of Basic Language and Learning Skills - Revised. Assesses cooperation, receptive/expressive language, socialization, academics and ADLs.', tags: ['ABA', 'Language', 'Skills', 'ASD'] },
}
// Traducción de tags para formularios clínicos (neurodivergentForms-en no siempre trae tags EN)
const TAGS_EN: Record<string, string> = {
  'Sesión': 'Session', 'Conductual': 'Behavioral', 'Hogar': 'Home', 'Familia': 'Family',
  'Ambiente': 'Environment', 'Historia': 'History', 'Inicial': 'Initial', 'Completo': 'Complete',
  'Diagnóstico': 'Diagnostic', 'Adaptativo': 'Adaptive', 'Funcional': 'Functional',
  'Inteligencia': 'Intelligence', 'Emocional': 'Emotional', 'Lenguaje': 'Language',
  'Habilidades': 'Skills', 'Cognitivo': 'Cognitive', 'Ejecutivo': 'Executive',
  'Atención': 'Attention', 'Inatención': 'Inattention', 'Hiperactividad': 'Hyperactivity',
  'Impulsividad': 'Impulsivity', 'Social': 'Social', 'Sensorial': 'Sensory',
  'Comunicación': 'Communication', 'Autonomía': 'Autonomy', 'Padres': 'Parents',
  'TEA': 'ASD', 'CI': 'IQ', 'TDAH': 'ADHD',
}
function dTitle(fm: any, loc: string) { if (loc !== 'en') return fm.title; if (fm.isClinicalForm) return (ALL_FORMS_EN.find((x: any) => x.id === fm.id)?.title) || fm.title; return CLINICAL_FORMS_EN[fm.id]?.title || fm.title }
function dSubtitle(fm: any, loc: string) { if (loc !== 'en') return fm.subtitle; if (fm.isClinicalForm) return (ALL_FORMS_EN.find((x: any) => x.id === fm.id)?.subtitle) || fm.subtitle; return CLINICAL_FORMS_EN[fm.id]?.subtitle || fm.subtitle }
function dDesc(fm: any, loc: string) { if (loc !== 'en') return fm.description; if (fm.isClinicalForm) return (ALL_FORMS_EN.find((x: any) => x.id === fm.id)?.description) || fm.description; return CLINICAL_FORMS_EN[fm.id]?.description || fm.description }
function dTags(fm: any, loc: string): string[] {
  const base: string[] = fm.tags || []
  if (loc !== 'en') return base
  if (fm.isClinicalForm) { const en = ALL_FORMS_EN.find((x: any) => x.id === fm.id)?.tags; if (en) return en }
  const fromMap = CLINICAL_FORMS_EN[fm.id]?.tags
  if (fromMap) return fromMap
  return base.map(t => TAGS_EN[t] || t)
}

const ALL_UNIFIED_FORMS = [
  ...CLINICAL_FORMS,
  ...ALL_FORMS.map((f: FormDefinition) => ({ ...f, formKey: null, isClinicalForm: true })),
]

// ─── QUESTION RENDERER ───────────────────────────────────────────────────────
const qInput = 'w-full rounded-v-sm border border-v-border bg-v-bg px-4 py-3 text-sm text-v-text outline-none transition-shadow placeholder:text-v-subtle focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft'

function QLabel({ q, extra }: { q: any; extra?: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="flex flex-wrap items-center gap-1.5 text-[15px] font-semibold leading-snug text-v-text">{q.label}{extra}</p>
      {q.helpText && <p className="mt-1 text-xs leading-relaxed text-v-subtle">{q.helpText}</p>}
    </div>
  )
}

function OptionPill({ on, onClick, children, full }: { on: boolean; onClick: () => void; children: React.ReactNode; full?: boolean }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onClick}
      className={`flex items-center gap-2 rounded-v-sm border px-3.5 py-2.5 text-left text-sm transition-all ${full ? 'w-full' : ''} ${on ? 'border-v-accent/50 bg-v-accent-soft font-semibold text-v-accent ring-4 ring-v-accent-soft' : 'border-v-border bg-v-elevated text-v-muted hover:border-v-accent/30 hover:text-v-text'}`}>
      <span className={`grid size-4 shrink-0 place-items-center rounded-full border transition-colors ${on ? 'border-transparent bg-v-accent text-white' : 'border-v-border'}`}>
        {on && <CheckCircle2 size={12} />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </motion.button>
  )
}

function QuestionRenderer({ question, value, onChange, manual = false }: any) {
  const { t, locale } = useI18n()
  // Modo manual (sin costo): lo que normalmente completa la IA o se calcula, lo escribe el profesional.
  if (manual && (question.aiGenerated || question.readonly) && (!question.type || ['textarea', 'text', 'number'].includes(question.type))) {
    const badge = <span className="inline-flex items-center gap-1 rounded-full bg-v-fill px-2 py-0.5 text-[10px] font-semibold text-v-muted"><PenLine size={10} /> {locale === 'en' ? 'Written by you' : 'Lo escribes tú'}</span>
    return (
      <div>
        <QLabel q={question} extra={badge} />
        {question.type === 'textarea'
          ? <textarea rows={3} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={question.placeholder}
              className={`${qInput} resize-y leading-relaxed`} />
          : <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={question.placeholder} className={qInput} />}
      </div>
    )
  }
  const freq = ['Nunca', 'Raramente', 'A veces', 'Frecuentemente', 'Casi siempre', 'Siempre']

  if (question.type === 'frequency' || question.type === 'radio') {
    const opts = question.options || freq
    return (
      <div>
        <QLabel q={question} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          {opts.map((opt: string) => <OptionPill key={opt} full on={value === opt} onClick={() => onChange(opt)}>{opt}</OptionPill>)}
        </div>
      </div>
    )
  }
  if (question.type === 'multiselect') {
    const selected: string[] = Array.isArray(value) ? value : []
    return (
      <div>
        <QLabel q={question} extra={<span className="text-xs font-normal text-v-subtle">· {selected.length > 0 ? `${selected.length} elegidas` : 'elige varias'}</span>} />
        <div className="flex flex-wrap gap-2">
          {(question.options || []).map((opt: string) => (
            <OptionPill key={opt} on={selected.includes(opt)}
              onClick={() => onChange(selected.includes(opt) ? selected.filter(x => x !== opt) : [...selected, opt])}>{opt}</OptionPill>
          ))}
        </div>
      </div>
    )
  }
  if (question.type === 'scale') {
    const scale = [1, 2, 3, 4, 5]
    const labels = question.scaleLabels || { min: 'Nunca/Leve', max: 'Siempre/Severo' }
    return (
      <div>
        <QLabel q={question} />
        <div className="inline-flex gap-1.5 rounded-full bg-v-fill p-1.5">
          {scale.map(n => (
            <motion.button key={n} type="button" whileTap={{ scale: 0.9 }} onClick={() => onChange(n)}
              className={`grid size-11 place-items-center rounded-full text-base font-semibold tabular-nums transition-all ${value === n ? 'v-brand' : 'text-v-muted hover:bg-v-elevated hover:text-v-text'}`}
              style={value === n ? { boxShadow: 'none' } : undefined}>{n}</motion.button>
          ))}
        </div>
        <div className="mt-1.5 flex max-w-[296px] justify-between px-1 text-[11px] text-v-subtle">
          <span>{labels.min}</span><span>{labels.max}</span>
        </div>
      </div>
    )
  }
  if (question.type === 'boolean') {
    return (
      <div>
        <QLabel q={question} />
        <div className="flex max-w-sm gap-2">
          {['Sí', 'No'].map(opt => {
            const on = value === opt
            return (
              <motion.button key={opt} type="button" whileTap={{ scale: 0.97 }} onClick={() => onChange(opt)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-semibold transition-all ${on
                  ? (opt === 'Sí' ? 'border-transparent bg-v-success/15 text-v-success ring-4 ring-v-success/10' : 'border-transparent bg-v-fill text-v-text ring-4 ring-v-fill')
                  : 'border-v-border bg-v-elevated text-v-muted hover:text-v-text'}`}>
                {opt === 'Sí' ? <CheckCircle2 size={15} /> : <X size={15} />} {opt}
              </motion.button>
            )
          })}
        </div>
      </div>
    )
  }
  if (question.type === 'textarea' && !question.aiGenerated) {
    return (
      <div>
        <QLabel q={question} />
        <textarea rows={3} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={question.placeholder}
          className={`${qInput} resize-y leading-relaxed`} />
      </div>
    )
  }
  if (question.type === 'select') {
    const opts: string[] = question.options || []
    // Pocas opciones → pastillas (un toque); muchas → lista desplegable
    if (opts.length > 0 && opts.length <= 6) {
      return (
        <div>
          <QLabel q={question} />
          <div className="flex flex-wrap gap-2">
            {opts.map(opt => <OptionPill key={opt} on={value === opt} onClick={() => onChange(opt)}>{opt}</OptionPill>)}
          </div>
        </div>
      )
    }
    return (
      <div>
        <QLabel q={question} />
        <select value={value || ''} onChange={e => onChange(e.target.value)} className={qInput}>
          <option value="">{t('common.seleccionar')}</option>
          {opts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    )
  }
  if (question.type === 'range') {
    const min = question.min || 1
    const max = question.max || 5
    const val = Number(value) || min
    const labels = question.labels || []
    const pct = max > min ? ((val - min) / (max - min)) * 100 : 0
    return (
      <div>
        <QLabel q={question} />
        <div className="rounded-v-sm border border-v-border bg-v-bg p-4">
          <div className="mb-3 flex items-center justify-between text-xs text-v-subtle">
            <span>{labels[0] || min}</span>
            <span className="v-brand-text text-2xl font-bold tabular-nums">{val}</span>
            <span>{labels[labels.length - 1] || max}</span>
          </div>
          <input type="range" min={min} max={max} step={1} value={val} onChange={e => onChange(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full accent-[var(--v-accent)]"
            style={{ background: `linear-gradient(90deg, var(--v-accent) ${pct}%, var(--v-fill) ${pct}%)` }} />
          {labels.length > 0 && labels[val - min] && (
            <p className="mt-3 rounded-full bg-v-accent-soft px-3 py-1.5 text-center text-xs font-semibold text-v-accent">{labels[val - min]}</p>
          )}
        </div>
      </div>
    )
  }
  if (question.type === 'date') {
    return (
      <div>
        <QLabel q={question} />
        <input type="date" value={value || ''} onChange={e => onChange(e.target.value)} className={`${qInput} max-w-xs`} />
      </div>
    )
  }
  // Campo generado por IA — se completa con "Analizar con IA"
  if (question.aiGenerated) {
    const hasValue = value && String(value).trim().length > 0
    const badge = <span className="inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-2 py-0.5 text-[10px] font-semibold text-v-accent"><Sparkles size={10} /> {t('evaluaciones.generadoIA')}</span>
    return (
      <div>
        <QLabel q={question} extra={badge} />
        {hasValue ? (
          question.type === 'textarea'
            ? <textarea rows={4} value={value} onChange={e => onChange(e.target.value)} className={`${qInput} resize-y border-v-accent/30 bg-v-accent-soft leading-relaxed`} />
            : <input type="text" value={value} onChange={e => onChange(e.target.value)} className={`${qInput} border-v-accent/30 bg-v-accent-soft`} />
        ) : (
          <div className="flex items-center gap-2.5 rounded-v-sm border border-dashed border-v-accent/30 bg-v-bg px-4 py-3 text-sm text-v-subtle">
            <Sparkles size={15} className="shrink-0 text-v-accent" />
            <span>{t(question.type === 'textarea' ? 'evaluaciones.seCompletara' : 'evaluaciones.seCompletara2')} <strong className="text-v-accent">{t('evaluaciones.analizarConIA2')}</strong></span>
          </div>
        )}
      </div>
    )
  }
  // Solo lectura — calculado automáticamente
  if (question.readonly) {
    const hasValue = value !== undefined && value !== null && String(value).trim().length > 0
    const badge = <span className="inline-flex items-center gap-1 rounded-full bg-v-fill px-2 py-0.5 text-[10px] font-semibold text-v-subtle"><Lock size={10} /> {t('evaluaciones.autoCalculado')}</span>
    return (
      <div>
        <QLabel q={question} extra={badge} />
        {hasValue
          ? <div className="rounded-v-sm bg-v-success/15 px-4 py-3 text-sm font-semibold text-v-success">{value}</div>
          : <div className="rounded-v-sm border border-dashed border-v-border px-4 py-3 text-sm text-v-subtle">{t('auto.evaluacionesUnificadas.seCalcularaConElAnalisis')}</div>}
      </div>
    )
  }
  // Texto / número
  return (
    <div>
      <QLabel q={question} />
      <input type={question.type === 'number' ? 'number' : 'text'} min={question.min} max={question.max}
        value={value || ''} onChange={e => onChange(e.target.value)} placeholder={question.placeholder}
        className={`${qInput} ${question.type === 'number' ? 'max-w-[200px] tabular-nums' : ''}`} />
    </div>
  )
}

// ─── HELPER: convierte string con guiones/saltos o array → array limpio ───────
function toArray(val: any): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.filter(Boolean)
  if (typeof val === 'string') {
    return val
      .split(/\n|;/)
      .map((s: string) => s.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean)
  }
  return []
}

// ─── AI ANALYSIS DISPLAY ─────────────────────────────────────────────────────
function AIAnalysisPanel({ analysis, editableMessage, onEditMessage, editableActividades, onEditActividades }: { analysis: any; editableMessage?: string; onEditMessage?: (v: string) => void; editableActividades?: string; onEditActividades?: (v: string) => void }) {
  const { t, locale } = useI18n()

  if (!analysis) return null
  const alertColors: Record<string, string> = {
    bajo: 'bg-v-success/15 border-v-success/30 text-v-success',
    moderado: 'bg-v-warning/15 border-v-warning/30 text-v-warning',
    alto: 'bg-v-danger/10 border-v-danger/30 text-v-danger',
  }
  const alertIconCfg: Record<string, any> = { bajo: CheckCircle2, moderado: AlertTriangle, alto: AlertTriangle }

  // Normalizar todos los campos que pueden venir como string o array
  const areasFortaleza    = toArray(analysis.areas_fortaleza)
  const areasTrabajo      = toArray(analysis.areas_trabajo)
  const recomendaciones   = toArray(analysis.recomendaciones)
  const indicadoresClave  = toArray(analysis.indicadores_clave)
  const formsRecomendados = toArray(analysis.formularios_recomendados)

  // Texto de análisis clínico — puede venir en distintas claves según el formulario
  const textoAnalisis =
    analysis.analisis_clinico ||
    analysis.analisis_ia ||
    analysis.analisis_vineland_ia ||
    analysis.analisis_diagnostico_ia ||
    analysis.analisis_basc_ia ||
    analysis.perfil_cognitivo_ia ||
    analysis.resumen_ejecutivo || ''

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 pb-2 border-b border-v-border">
        <div className="w-8 h-8 bg-gradient-to-br from-v-brand-from to-v-brand-to rounded-v-sm flex items-center justify-center">
          <Sparkles size={16} className="text-white" />
        </div>
        <h3 className="font-bold text-v-text" style={{ color: "var(--v-text)" }}>{t('evaluaciones.analisisIA')}</h3>
      </div>

      {/* Alert level */}
      {analysis.nivel_alerta && (
        <div className={`px-4 py-3 rounded-v-sm border-2 font-bold text-sm flex items-center gap-2 ${alertColors[analysis.nivel_alerta] || alertColors.bajo}`}>
          {(() => { const AI = alertIconCfg[analysis.nivel_alerta] || CheckCircle2; return <AI size={18} /> })()}
          Nivel de alerta: <span className="uppercase">{analysis.nivel_alerta}</span>
        </div>
      )}

      {/* Clinical analysis */}
      {textoAnalisis ? (
        <div className="bg-v-fill rounded-v-sm p-4 border border-v-border">
          <h4 className="text-xs font-bold text-v-muted mb-2">{t('evaluaciones.analisisClinico')}</h4>
          <p className="text-sm text-v-text leading-relaxed">{textoAnalisis}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Strengths */}
        {areasFortaleza.length > 0 && (
          <div className="bg-v-success/15 rounded-v-sm p-4 border border-v-success/30">
            <h4 className="text-xs font-bold text-v-success mb-2">💪 Fortalezas</h4>
            <ul className="space-y-1">
              {areasFortaleza.map((f: string, i: number) => (
                <li key={i} className="text-xs text-v-success font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-v-success rounded-full shrink-0" />{f}
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* Work areas */}
        {areasTrabajo.length > 0 && (
          <div className="bg-v-warning/15 rounded-v-sm p-4 border border-v-warning/30">
            <h4 className="text-xs font-bold text-v-warning mb-2">{t('evaluaciones.areasTrabajar')}</h4>
            <ul className="space-y-1">
              {areasTrabajo.map((f: string, i: number) => (
                <li key={i} className="text-xs text-v-warning font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-v-warning rounded-full shrink-0" />{f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recommendations */}
      {recomendaciones.length > 0 && (
        <div className="bg-v-accent-soft rounded-v-sm p-4 border border-v-accent/30">
          <h4 className="text-xs font-bold text-v-accent mb-2">💡 Recomendaciones</h4>
          <ul className="space-y-1.5">
            {recomendaciones.map((r: string, i: number) => (
              <li key={i} className="text-xs text-v-accent font-medium flex items-start gap-1.5">
                <span className="w-1.5 h-1.5 bg-sky-500 rounded-full shrink-0 mt-1" />{r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key indicators */}
      {indicadoresClave.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-v-muted mb-2">🔍 Indicadores Clave</h4>
          <div className="flex flex-wrap gap-2">
            {indicadoresClave.map((ind: string, i: number) => (
              <span key={i} className="px-3 py-1 bg-v-fill text-v-text rounded-full text-xs font-bold border border-v-border">{ind}</span>
            ))}
          </div>
        </div>
      )}

      {/* Next recommended forms */}
      {formsRecomendados.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-v-accent mb-2">{t('evaluaciones.proxEvals')}</h4>
          <div className="flex flex-wrap gap-2">
            {formsRecomendados.map((f: string, i: number) => (
              <span key={i} className="px-3 py-1.5 bg-v-accent-soft border border-v-accent/30 text-v-accent rounded-full text-xs font-bold">{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* Mensaje al padre/madre - editable */}
      {(analysis.mensaje_padres || editableMessage !== undefined) && (
        <div className="space-y-4">
          {/* Sección 1: Mensaje al padre */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-v p-5 border-2 border-v-warning/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-v-warning rounded-lg flex items-center justify-center">
                <MessageCircle size={14} className="text-white"/>
              </div>
              <h4 className="font-bold text-v-warning">{t('ui.mensajePadres')}</h4>
              <span className="ml-auto px-2 py-0.5 bg-v-warning/15 text-v-warning text-[10px] font-bold rounded-full border border-v-warning/30">✏️ Editable</span>
            </div>
            {onEditMessage ? (
              <textarea
                rows={4}
                value={editableMessage !== undefined ? editableMessage : (analysis.mensaje_padres || '')}
                onChange={e => onEditMessage(e.target.value)}
                className="w-full p-3 /80 border-2 border-v-warning/30 rounded-v-sm text-v-warning text-sm leading-relaxed resize-none outline-none focus:border-v-warning/30 transition-all font-medium mb-2" style={{ background: "var(--v-bg-elevated)" }}
                {...{placeholder: t('ui.edit_message')}}
              />
            ) : (
              <p className="text-v-warning text-sm leading-relaxed mb-3 italic">&quot;{editableMessage || analysis.mensaje_padres}&quot;</p>
            )}
            <p className="text-v-warning text-xs font-semibold bg-v-warning/15 rounded-v-sm px-3 py-2 border border-v-warning/30">
              {t('ui.approval_notice_parent')}
            </p>
          </div>

          {/* Sección 2: Actividad para casa */}
          {(analysis.actividades_casa || analysis.actividad_casa || editableActividades !== undefined) && (
            <div className="bg-gradient-to-br from-v-brand-from to-v-brand-to rounded-v p-5 border-2 border-v-accent/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-sky-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-bold">🏠</span>
                </div>
                <h4 className="font-bold text-v-accent">{t('ui.home_activity')}</h4>
                <span className="ml-auto px-2 py-0.5 bg-v-accent-soft text-v-accent text-[10px] font-bold rounded-full border border-v-accent/30">✏️ Editable</span>
              </div>
              {onEditActividades ? (
                <textarea
                  rows={5}
                  value={editableActividades !== undefined ? editableActividades : (analysis.actividades_casa || analysis.actividad_casa || '')}
                  onChange={e => onEditActividades(e.target.value)}
                  className="w-full p-3 /80 border-2 border-v-accent/30 rounded-v-sm text-v-accent text-sm leading-relaxed resize-none outline-none focus:border-v-accent transition-all font-medium" style={{ background: "var(--v-bg-elevated)" }}
                  {...{placeholder: t('ui.home_activity_desc')}}
                />
              ) : (
                <p className="text-v-accent text-sm leading-relaxed italic whitespace-pre-wrap">{editableActividades || analysis.actividades_casa || analysis.actividad_casa}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── SEND FORM MODAL ─────────────────────────────────────────────────────────
// ==============================================================================
// COMPONENTE: TARJETA DE FORMULARIO EN HISTORIAL CON BOTÓN "GENERAR REPORTE"
// ==============================================================================
function HistorialFormCard({ sf, onReportGenerated }: { sf: any; onReportGenerated: () => void | Promise<void>; key?: any }) {
  const { t, locale } = useI18n()
  const [generating, setGenerating] = useState(false)
  const toast = useToast()

  const handleGenerateReport = async () => {
    setGenerating(true)
    try {
      // Fetch the full responses from the DB (the list query only has metadata)
      const sourceTable = sf._source || 'form_responses'
      const isClinicalTable = ['anamnesis_completa', 'registro_aba', 'registro_entorno_hogar'].includes(sourceTable)
      const selectFields = isClinicalTable
        ? 'datos, ai_analysis, form_type, form_title'
        : 'responses, ai_analysis, form_type, form_title'
      const { data: fullRecord, error } = await supabase
        .from(sourceTable)
        .select(selectFields)
        .eq('id', sf.id)
        .maybeSingle()

      if (error) throw error

      const childName = (sf as any).children?.name || t('nav.pacientes')
      const reportData = {
        responses: fullRecord?.responses || fullRecord?.datos || {},
        ai_analysis: fullRecord?.ai_analysis,
      }
      // Mapear _source a form_type cuando la tabla clínica no tiene columna form_type
      const sourceToType: Record<string, string> = {
        registro_aba: 'aba',
        anamnesis_completa: 'anamnesis',
        registro_entorno_hogar: 'entorno_hogar',
      }
      const reportType = fullRecord?.form_type || sf.form_type ||
        sourceToType[sf._source || ''] || 'aba'
      const formTitle  = fullRecord?.form_title  || sf.form_title  || 'Formulario'

      // Call generate-report from browser (no serverless timeout issue)
      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({
          reportType,
          childName,
          reportData,
          evaluationId: sf.id,
          formTitle,
        }),
      })

      if (!res.ok) throw new Error(`Error ${res.status}`)
      const json = await res.json()
      if (!json.success || !json.fileData) throw new Error(json.error || 'Sin datos')

      // Save to reportes_generados
      const { error: insertError } = await supabase.from('reportes_generados').insert([{
        child_id:         sf.child_id,
        tipo_reporte:     reportType,
        titulo:           `${formTitle} - ${childName}`,
        nombre_archivo:   json.fileName,
        file_data:        json.fileData,
        mime_type:        json.mimeType,
        tamano_bytes:     Math.round((json.fileData.length * 3) / 4),
        fecha_generacion: new Date().toISOString(),
        generado_por:     'IA + Psicólogo',
        source_id:        sf.id,
      }])
      if (insertError) {
        console.error('❌ Error guardando reporte en BD:', insertError)
        toast.error((locale === 'en' ? 'Report downloaded but could not be saved to history: ' : 'Reporte descargado pero no se pudo guardar en historial: ') + insertError.message)
      }

      // Auto-download
      const byteChars = atob(json.fileData)
      const bytes = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
      const blob = new Blob([bytes], { type: json.mimeType })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = json.fileName
      document.body.appendChild(a); a.click()
      URL.revokeObjectURL(url); document.body.removeChild(a)

      toast.success(t('auto.evaluacionesUnificadas.reporteWordGeneradoYDescargado'))
      onReportGenerated()
    } catch (err: any) {
      console.error('Error generando reporte:', err)
      toast.error((locale === 'en' ? 'Error generating report: ' : 'Error al generar reporte: ') + (err.message || (locale === 'en' ? 'Try again' : 'Intenta de nuevo')))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className=" rounded-v border border-v-border shadow-sm p-5 hover:shadow-md transition-all" style={{ background: "var(--v-bg-elevated)" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-bold text-v-text text-sm truncate" style={{ color: "var(--v-text)" }}>
              {sf.form_title || sf.form_type || 'Formulario'}
            </p>
            {sf._source && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-v-fill text-v-muted border border-v-border whitespace-nowrap">
                {sf._source === 'anamnesis_completa' ? 'Anamnesis' :
                 sf._source === 'registro_aba' ? 'ABA' :
                 sf._source === 'registro_entorno_hogar' ? 'Hogar' : 'NeuroForma'}
              </span>
            )}
          </div>
          <p className="text-xs text-v-subtle flex items-center gap-1">
            <Baby size={10} /> {(sf as any).children?.name || t('nav.pacientes')} · {new Date(sf.created_at).toLocaleDateString(toBCP47(locale))}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          {sf.ai_analysis && (
            <span className="px-2 py-1 bg-v-accent-soft text-v-accent rounded-full text-[10px] font-bold border border-v-accent/30 flex items-center gap-1">
              <Sparkles size={9} /> Con IA
            </span>
          )}
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-v-brand-from to-v-brand-to hover:from-v-brand-from hover:to-v-brand-to text-white rounded-v-sm text-xs font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
          >
            {generating ? (
              <><Loader2 size={12} className="animate-spin" /> {t('common.generando')}</>
            ) : (
              <><Download size={12} /> {t('reportes.generar')}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function SendFormModal({ form, children, onSend, onClose }: any) {
  const { t, locale } = useI18n()

  const [childId, setChildId] = useState('')
  const [message, setMessage] = useState('')
  const [deadline, setDeadline] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!childId) { alert(t('ui.seleccionaPaciente2')); return }
    setSending(true)
    await onSend({ childId, message, deadline })
    setSending(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className=" rounded-v-lg p-8 w-full max-w-md shadow-2xl" style={{ background: "var(--v-bg-elevated)" }}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-xl text-v-text flex items-center gap-2" style={{ color: "var(--v-text)" }}>
            <Send size={20} className="text-v-accent" /> {t('common.enviarPadres')}
          </h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-v-fill"><X size={20} /></button>
        </div>

        <div className="bg-v-accent-soft rounded-v-sm p-4 mb-6 border border-v-accent/30">
          <p className="text-xs font-bold text-v-accent mb-1">{t('evaluaciones.titulo')}</p>
          <p className="font-bold text-v-accent">{dTitle(form, locale)}</p>
          <p className="text-xs text-v-accent mt-0.5">{form.estimatedMinutes} min aprox.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-v-subtle block mb-2">{t('evaluaciones.pacienteStar')}</label>
            <select value={childId} onChange={e => setChildId(e.target.value)}
              className="w-full p-4 bg-v-fill border-2 border-v-border rounded-v-sm text-sm font-bold outline-none focus:border-v-accent transition-all">
              <option value="">{t('ui.select_patient_option')}</option>
              {children.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.age ? ` (${c.age})` : ''}</option>)}
            </select>
            <p className="text-xs text-v-subtle mt-1.5">{t('evaluaciones.irABiblioteca')}</p>
          </div>
          <div>
            <label className="text-xs font-bold text-v-subtle block mb-2">{t('evaluaciones.mensaje')}</label>
            <textarea rows={3} value={message} onChange={e => setMessage(e.target.value)}
              {...{placeholder: t('ui.send_form_msg')}}
              className="w-full p-4 bg-v-fill border-2 border-v-border rounded-v-sm text-sm font-bold outline-none focus:border-v-accent transition-all resize-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-v-subtle block mb-2">{t('evaluaciones.fechaLimite2')}</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
              className="w-full p-4 bg-v-fill border-2 border-v-border rounded-v-sm text-sm font-bold outline-none focus:border-v-accent transition-all" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-4 text-v-subtle font-bold uppercase text-xs tracking-widest hover:bg-v-fill rounded-v-sm border-2 border-v-border transition-all">{t('common.cancelar')}</button>
            <button onClick={handleSend} disabled={sending || !childId}
              className="flex-[2] py-4 bg-gradient-to-r from-v-brand-from to-v-brand-to text-white rounded-v-sm font-bold text-sm shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {sending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── FORM FILL VIEW ─────────────────────────────────────────────────────────
function FormFillView({ form: formProp, children, onBack, toast, initialChildId, initialChildName }: any) {
  const { t, locale } = useI18n()
  // Formulario traducido en vivo cuando el idioma es inglés (con caché).
  const form = useTranslatedForm(formProp) || formProp

  const [currentStep, setCurrentStep] = useState(0)
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [selectedChild, setSelectedChild] = useState(initialChildId || '')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [editedMessage, setEditedMessage] = useState('')
  const [editedActividades, setEditedActividades] = useState('')
  const [isClinicalForm] = useState(!!(form as any).isClinicalForm)
  const [showSuccessScreen, setShowSuccessScreen] = useState(false)
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null)
  const [savedChildId, setSavedChildId] = useState<string>('')
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  // Cómo se llena: a mano (sin costo) o con apoyo de IA (1 token por análisis)
  const [modo, setModo] = useState<ModoLlenado | null>(null)

  // Get sections based on form type
  const getSections = () => {

    if (isClinicalForm) return (locale === 'en' ? (ALL_FORMS_EN.find((x: any) => x.id === form.id)?.sections || form.sections) : form.sections)
    const en = locale === 'en'
    const formDataMap: Record<string, any> = {
      anamnesis: en?ANAMNESIS_DATA_EN:ANAMNESIS_DATA, aba: en?ABA_DATA_EN:ABA_DATA, entorno_hogar: en?ENTORNO_HOGAR_DATA_EN:ENTORNO_HOGAR_DATA,
      brief2: en?BRIEF2_DATA_EN:BRIEF2_DATA, ados2: en?ADOS2_DATA_EN:ADOS2_DATA, vineland3: en?VINELAND3_DATA_EN:VINELAND3_DATA,
      wiscv: en?WISCV_DATA_EN:WISCV_DATA, basc3: en?BASC3_DATA_EN:BASC3_DATA, abllsr: en?ABLLS_R_DATA_EN:ABLLS_R_DATA
    }
    return formDataMap[form.formKey] || []
  }

  const sections = getSections()
  const totalSteps = sections.length
  const currentSection = sections[currentStep]
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0
  const answeredCount = Object.keys(responses).length

  const handleResponse = (id: string, value: any) => {
    setResponses(prev => ({ ...prev, [id]: value }))
  }

  const handleAnalyzeWithAI = async () => {
    if (isAnalyzing) return // Guard contra doble click
    setIsAnalyzing(true)
    try {
      const child = children.find((c: any) => c.id === selectedChild)

      if (isClinicalForm) {
        // NeuroForma - usa API específica
        const res = await fetch('/api/analyze-neurodivergent-form', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
          body: JSON.stringify({
            formType: form.id,
            formData: responses,
            childName: child?.name || t('nav.pacientes'),
            childAge: child?.age || calcularEdadNumerica(child?.birth_date) || 'N/E',
            diagnosis: child?.diagnosis || '',
            childId: selectedChild,
          }),
        })
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        const nfAnalysis = json.analysis || {}
        setResponses((prev: any) => ({ ...prev, ...nfAnalysis }))
        setAiAnalysis(nfAnalysis)
        setEditedMessage(nfAnalysis?.mensaje_padres || '')
        setEditedActividades(nfAnalysis?.actividades_casa || nfAnalysis?.actividad_casa || '')
      } else {
        const childName = child?.name || t('nav.pacientes')
        const childAge  = child?.age || calcularEdadNumerica(child?.birth_date) || 'N/E'
        const diagnosis = child?.diagnosis || ''

        let endpoint = '/api/analyze-neurodivergent-form'
        let payload: any = {
          formType:  form.formKey || form.id,
          formData:  responses,
          childName,
          childAge,
          diagnosis,
          childId: selectedChild,
        }

        if (form.formKey === 'entorno_hogar') {
          endpoint = '/api/generate-home-environment-report'
          payload = { ...responses, childName, childAge, diagnosis, childId: selectedChild }
        } else if (form.formKey === 'aba') {
          // Con registro ABC (antecedente/conducta/consecuencia) usamos el reporte de
          // sesión (mejor calidad, mapea directo a avances_observados/areas_dificultad/…).
          // Sin ABC, se usa el endpoint genérico y más abajo mapeamos sus claves a los
          // campos del formulario ABA para que SIEMPRE se llenen.
          if (responses.antecedente || responses.conducta || responses.consecuencia) {
            endpoint = '/api/generate-session-report'
            payload = { ...responses, childName, childAge, childId: selectedChild }
          }
        } else if (['brief2', 'ados2', 'vineland3', 'wiscv', 'basc3', 'abllsr'].includes(form.formKey)) {
          endpoint = '/api/analyze-professional-evaluation'
          payload = { evaluationType: form.formKey.toLowerCase(), childName, childAge, childId: selectedChild, responses }
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error || `Error ${res.status}`)
        // analyze-professional-evaluation devuelve el objeto directo (sin .analysis wrapper)
        // analyze-neurodivergent-form devuelve { analysis: { ... } }
        const rawAnalysis = json.analysis && typeof json.analysis === 'object' ? json.analysis : json
        console.log('🔬 rawAnalysis keys:', Object.keys(rawAnalysis))
        // Aplanar metricas al nivel raíz para que los campos del formulario los muestren
        const analysis: any = { ...rawAnalysis }
        if (rawAnalysis.metricas) {
          const m = rawAnalysis.metricas
          if (m.comunicacion !== undefined)      analysis.puntuacion_comunicacion      = m.comunicacion
          if (m.socializacion !== undefined)     analysis.puntuacion_socializacion     = m.socializacion
          if (m.vida_diaria !== undefined)       analysis.puntuacion_vida_diaria        = m.vida_diaria
          if (m.indice_global !== undefined)     analysis.indice_conducta_adaptativa   = m.indice_global
          if (m.inhibicion !== undefined)        analysis.inhibicion                   = m.inhibicion
          if (m.flexibilidad !== undefined)      analysis.flexibilidad                 = m.flexibilidad
          if (m.total !== undefined)             analysis.total_brief                  = m.total
          if (m.ci_total !== undefined)          analysis.ci_total                     = m.ci_total
          if (m.clasificacion !== undefined)     analysis.clasificacion_ci             = m.clasificacion
          if (m.icv !== undefined)               analysis.icv_total                    = m.icv
          if (m.ive !== undefined)               analysis.ive_total                    = m.ive
          if (m.irf !== undefined)               analysis.irf_total                    = m.irf
          if (m.imt !== undefined)               analysis.imt_total                    = m.imt
          if (m.ivp !== undefined)               analysis.ivp_total                    = m.ivp
          if (m.icv_percentil !== undefined)     analysis.icv_percentil                = m.icv_percentil
          if (m.ive_percentil !== undefined)     analysis.ive_percentil                = m.ive_percentil
          if (m.irf_percentil !== undefined)     analysis.irf_percentil                = m.irf_percentil
          if (m.imt_percentil !== undefined)     analysis.imt_percentil                = m.imt_percentil
          if (m.ivp_percentil !== undefined)     analysis.ivp_percentil                = m.ivp_percentil
          if (m.ci_percentil !== undefined)      analysis.ci_percentil                 = m.ci_percentil
          if (m.indice_sintomas !== undefined)   analysis.indice_sintomas_conductuales = m.indice_sintomas
          if (m.perfil_riesgo !== undefined)     analysis.perfil_riesgo                = m.perfil_riesgo
          if (m.severidad !== undefined)         analysis.nivel_severidad              = m.severidad
          if (m.afecto_social !== undefined)     analysis.puntuacion_total             = m.afecto_social
        }
        // Si es la Sesión ABA y el análisis vino del endpoint genérico (claves distintas),
        // mapear esas claves a los campos aiGenerated del formulario ABA para que se llenen.
        if (form.formKey === 'aba') {
          const join = (v: any) => Array.isArray(v) ? v.filter(Boolean).join(' • ') : v
          if (!analysis.avances_observados && (analysis.areas_fortaleza || analysis.analisis_clinico))
            analysis.avances_observados = join(analysis.areas_fortaleza) || analysis.analisis_clinico
          if (!analysis.areas_dificultad && (analysis.areas_trabajo || analysis.areas_dificultad_ia))
            analysis.areas_dificultad = join(analysis.areas_trabajo || analysis.areas_dificultad_ia)
          if (!analysis.observaciones_tecnicas && analysis.analisis_clinico)
            analysis.observaciones_tecnicas = analysis.analisis_clinico
          if (!analysis.recomendaciones_equipo && analysis.recomendaciones)
            analysis.recomendaciones_equipo = join(analysis.recomendaciones)
          if (!analysis.alertas_clinicas && analysis.nivel_alerta)
            analysis.alertas_clinicas = join(analysis.indicadores_clave) || `Nivel de alerta: ${analysis.nivel_alerta}`

          // Normalizar los enums al idioma actual para que el <select>/<radio> auto-seleccione
          // (si la IA devolvió el valor en el otro idioma, lo mapeamos a la opción del form).
          const mapEnum = (val: any, pairs: [string, string][]) => {
            if (!val) return val
            const v = String(val).trim().toLowerCase()
            for (const [es, en] of pairs) {
              if (v === es.toLowerCase() || v === en.toLowerCase()) return locale === 'en' ? en : es
            }
            return val
          }
          const PATRON: [string, string][] = [
            ['Aprendizaje rápido y generalización', 'Fast learning and generalization'],
            ['Aprendizaje gradual', 'Gradual learning'],
            ['Requiere repetición intensiva', 'Requires intensive repetition'],
            ['Dificultad para generalizar', 'Difficulty generalizing'],
            ['Aprendizaje inconsistente', 'Inconsistent learning'],
          ]
          const COORD: [string, string][] = [
            ['Urgente', 'Urgent'], ['Necesaria', 'Necessary'], ['Rutinaria', 'Routine'], ['No necesaria', 'Not necessary'],
          ]
          if (analysis.patron_aprendizaje) analysis.patron_aprendizaje = mapEnum(analysis.patron_aprendizaje, PATRON)
          if (analysis.coordinacion_familia) analysis.coordinacion_familia = mapEnum(analysis.coordinacion_familia, COORD)
          // "sin alertas" en el idioma correcto
          const sa = String(analysis.alertas_clinicas || '').trim().toLowerCase()
          if (sa === 'sin alertas clínicas significativas' || sa === 'no significant clinical alerts')
            analysis.alertas_clinicas = locale === 'en' ? 'No significant clinical alerts' : 'Sin alertas clínicas significativas'

          // Si tras todo el mapeo NINGÚN campo del ABA tiene contenido, el análisis
          // volvió vacío (problema puntual de la IA) → avisar claro en vez de "éxito".
          const abaKeys = ['avances_observados','areas_dificultad','observaciones_tecnicas','recomendaciones_equipo','patron_aprendizaje','alertas_clinicas','mensaje_padres']
          const hayContenido = abaKeys.some(k => analysis[k] && String(analysis[k]).trim())
          if (!hayContenido) {
            console.warn('🔬 análisis ABA vacío. Respuesta cruda:', json)
            throw new Error(locale === 'en'
              ? 'The AI returned an empty analysis. Please try again in a moment.'
              : 'La IA devolvió un análisis vacío. Vuelve a intentarlo en un momento.')
          }
        }
        console.log('🔬 análisis aplicado, claves:', Object.keys(analysis))
        // También mezclar con las respuestas del formulario para que aparezcan en los campos
        setResponses((prev: any) => ({ ...prev, ...analysis }))
        setAiAnalysis(analysis)
        setEditedMessage(analysis?.mensaje_padres || analysis?.informe_padres_vineland || analysis?.informe_padres_wisc || analysis?.informe_padres_basc || analysis?.informe_familia_ados || analysis?.informe_padres_entorno || analysis?.mensaje_padres_entorno || analysis?.informe_padres_ablls || analysis?.informe_padres || '')
        setEditedActividades(analysis?.actividades_casa || analysis?.actividad_casa || '')
      }
      toast.success(t('auto.evaluacionesUnificadas.analisisIaGenerado'))
      avisarTokens(false)
    } catch (err: any) {
      const m = String(err.message || '')
      if (/tokens/i.test(m)) avisarTokens(true)
      const isQuota = /Cuota|429|RESOURCE_EXHAUSTED|límite|limit|solicitada|exhaust/i.test(m)
      if (/tokens/i.test(m)) toast.error(m) // sin tokens de análisis del centro
      else toast.error(isQuota
        ? (locale === 'en'
            ? '⏳ ARIA reached its AI usage limit. The evaluation analysis sends a large request (full clinical context), so it hits the daily limit sooner than the chat. Try again in a few minutes or tomorrow.'
            : '⏳ ARIA alcanzó su límite de uso de IA. El análisis de evaluación envía una solicitud grande (todo el contexto clínico), por eso llega al tope diario antes que el chat. Intenta en unos minutos o mañana.')
        : (locale === 'en' ? 'Analysis error: ' : 'Error en análisis: ') + err.message
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!selectedChild) { toast.error(t('auto.evaluacionesUnificadas.seleccionaUnPaciente')); return }
    if (answeredCount < 2) { toast.error(locale === 'en' ? 'Answer at least 2 questions' : 'Responde al menos 2 preguntas'); return }
    setIsSaving(true)
    try {
      const table = isClinicalForm ? 'form_responses' : (
        form.formKey === 'anamnesis' ? 'anamnesis_completa' :
        form.formKey === 'aba' ? 'registro_aba' :
        form.formKey === 'entorno_hogar' ? 'registro_entorno_hogar' : 'form_responses'
      )

      // Build insert payload — form_title may not exist in all clinical tables yet
      // The migration below adds it; until then we store it only in form_responses
      const now = new Date().toISOString()
      const insertPayload: any = { child_id: selectedChild }

      if (isClinicalForm) {
        // form_responses: tiene form_type, form_title, responses, ai_analysis, created_at
        insertPayload.form_type  = form.formKey || form.id
        insertPayload.form_title = form.title
        insertPayload.responses  = responses
        insertPayload.ai_analysis = aiAnalysis
        insertPayload.created_at  = now
      } else if (table === 'anamnesis_completa') {
        // anamnesis_completa: child_id, datos, fecha_creacion, form_title, creado_por
        insertPayload.datos          = responses
        insertPayload.fecha_creacion = now
        insertPayload.form_title     = form.title
      } else if (table === 'registro_aba') {
        // registro_aba: child_id, fecha_sesion, datos, form_title
        insertPayload.datos        = responses
        insertPayload.fecha_sesion = responses['fecha_sesion'] || now.split('T')[0]
        insertPayload.form_title   = form.title
      } else if (table === 'registro_entorno_hogar') {
        // registro_entorno_hogar: child_id, fecha_visita, datos, created_at, form_title
        insertPayload.datos        = responses
        insertPayload.fecha_visita = responses['fecha_visita'] || now
        insertPayload.created_at   = now
        insertPayload.form_title   = form.title
      } else {
        // form_responses fallback
        insertPayload.form_type   = form.formKey || form.id
        insertPayload.form_title  = form.title
        insertPayload.responses   = responses
        insertPayload.ai_analysis = aiAnalysis
        insertPayload.created_at  = now
      }

      const { data: savedRecord } = await supabase.from(table).insert([insertPayload]).select().single()

      // Guardado exitoso - mostrar pantalla de éxito con botón de reporte
      setSavedRecordId((savedRecord as any)?.id || null)
      setSavedChildId(selectedChild)
      setShowSuccessScreen(true)
      toast.success(t('auto.evaluacionesUnificadas.formularioGuardadoCorrectamente'))

      // Actualizar el RESUMEN CLÍNICO persistente del paciente de forma incremental
      // (barato: la IA solo lee el resumen actual + este registro nuevo, no todo el expediente).
      try {
        const a: any = aiAnalysis || {}
        const nuevo = [
          `Nuevo registro (${new Date().toLocaleDateString('es-PE')}): ${form.title}`,
          a.avances_observados && `Avances: ${a.avances_observados}`,
          a.areas_dificultad && `Áreas de dificultad: ${a.areas_dificultad}`,
          a.patron_aprendizaje && `Patrón de aprendizaje: ${a.patron_aprendizaje}`,
          a.analisis_clinico && `Análisis: ${a.analisis_clinico}`,
          a.recomendaciones_equipo && `Recomendaciones: ${Array.isArray(a.recomendaciones_equipo) ? a.recomendaciones_equipo.join('; ') : a.recomendaciones_equipo}`,
          (!a.avances_observados && !a.analisis_clinico) && `Datos: ${JSON.stringify(responses).slice(0, 1500)}`,
        ].filter(Boolean).join('\n')
        if (nuevo && selectedChild) {
          fetch('/api/patient-ai-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-locale': locale },
            body: JSON.stringify({ childId: selectedChild, action: 'update', newContent: nuevo, locale }),
          }).catch(() => {})   // fire-and-forget: no bloquea el guardado
        }
      } catch { /* no crítico */ }

      // Queue AI-generated parent message for admin approval (if it exists)
      if (aiAnalysis?.mensaje_padres) {
        const { data: child } = await supabase.from('children').select('parent_id').eq('id', selectedChild).single()
        if ((child as any)?.parent_id) {
          await fetch('/api/admin/parent-messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
            body: JSON.stringify({
              child_id: selectedChild,
              parent_id: (child as any).parent_id,
              source: isClinicalForm ? 'neuroforma' : 'evaluacion',
              source_title: form.title,
              ai_message: editedMessage || aiAnalysis.mensaje_padres,
              actividades_casa: editedActividades || aiAnalysis.actividades_casa || aiAnalysis.actividad_casa,
              ai_analysis: aiAnalysis,
              session_data: { form_type: form.formKey || form.id, responses },
            }),
          }).catch(e => console.error('Error queueing message:', e))
        }
      }
      // No llamamos onBack() aquí - la pantalla de éxito permite al usuario descargar el reporte
    } catch (err: any) {
      toast.error((locale === 'en' ? 'Error saving: ' : 'Error al guardar: ') + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // ── PANTALLA DE ÉXITO CON BOTÓN DE REPORTE ──────────────────────────────
  if (showSuccessScreen) {
    const handleGenerateAndDownload = async () => {
      setIsGeneratingReport(true)
      try {
        const child = children.find((c: any) => c.id === savedChildId) as any
        const childName = child?.name || 'Paciente'
        const childAge  = child?.age  || calcularEdadNumerica(child?.birth_date)
        const reportType = isClinicalForm ? (form.id || 'neuroforma') : (form.formKey || form.id)

        const res = await fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
          body: JSON.stringify({
            reportType,
            childName,
            childAge,
            reportData: { responses, ai_analysis: aiAnalysis },
            evaluationId: savedRecordId || '',
            formTitle: form.title,
          }),
        })
        const json = await res.json()
        if (!json.success || !json.fileData) throw new Error(json.error || 'Sin datos')

        // Guardar en reportes_generados
        await supabase.from('reportes_generados').insert([{
          child_id:         savedChildId,
          tipo_reporte:     reportType,
          titulo:           `${dTitle(form, locale)} - ${childName}`,
          nombre_archivo:   json.fileName,
          file_data:        json.fileData,
          mime_type:        json.mimeType,
          tamano_bytes:     Math.round((json.fileData.length * 3) / 4),
          fecha_generacion: new Date().toISOString(),
          generado_por:     'IA + Psicólogo',
          source_id:        savedRecordId,
        }])

        // Descargar automáticamente
        const byteChars = atob(json.fileData)
        const bytes = new Uint8Array(byteChars.length)
        for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
        const blob = new Blob([bytes], { type: json.mimeType })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href = url; a.download = json.fileName
        document.body.appendChild(a); a.click()
        URL.revokeObjectURL(url); document.body.removeChild(a)

        toast.success(t('auto.evaluacionesUnificadas.reporteWordDescargado'))
      } catch (err: any) {
        toast.error((locale === 'en' ? 'Error generating report: ' : 'Error generando reporte: ') + (err.message || (locale === 'en' ? 'Try again' : 'Intenta de nuevo')))
      } finally {
        setIsGeneratingReport(false)
      }
    }

    return (
      <div className="v-scope flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8">
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          className="grid size-20 place-items-center rounded-full bg-v-success/15">
          <CheckCircle2 size={40} className="text-v-success" />
        </motion.span>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-v-text mb-2" style={{ color: "var(--v-text)" }}>{t('evaluaciones.formGuardado')}</h2>
          <p className="text-v-muted font-medium">{dTitle(form, locale)}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
          <button
            onClick={handleGenerateAndDownload}
            disabled={isGeneratingReport}
            className="v-brand flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGeneratingReport ? (
              <><Loader2 size={18} className="animate-spin" /> {t("common.generandoReporte")}</>
            ) : (
              <><Download size={18} /> {t("evaluaciones.genDescarga")} <CostoToken claro /></>
            )}
          </button>
          <button
            onClick={onBack}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-v-border py-3.5 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill hover:text-v-text"
          >
            <ChevronLeft size={18} /> {locale === 'en' ? 'Back' : 'Volver'}
          </button>
        </div>
        {aiAnalysis && (
          <p className="text-xs text-v-accent font-bold flex items-center gap-1">
            <Sparkles size={12} /> {locale === 'en' ? 'AI analysis available — it will be included in the report' : 'Análisis IA disponible — se incluirá en el reporte'}
          </p>
        )}
      </div>
    )
  }

  if (!currentSection) return null

  if (!modo) return (
    <ElegirModoLlenado titulo={dTitle(form, locale)} subtitulo={dSubtitle(form, locale)}
      icono={createElement(formIcon(form), { size: 17 })} onElegir={setModo} onBack={onBack} />
  )

  const questions = currentSection.questions || currentSection.items || []
  const isAnswered = (v: any) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
  const sectionState = (sec: any) => {
    const qs = sec.questions || sec.items || []
    const n = qs.filter((q: any) => isAnswered(responses[q.id])).length
    return { n, total: qs.length }
  }
  const pacienteNombre = initialChildName || children.find((c: any) => c.id === selectedChild)?.name
  const esUltimo = currentStep === totalSteps - 1
  const mostrarIA = modo === 'ia' && (esUltimo || (form.formKey === 'aba' && currentStep >= 5))
  const irA = (i: number) => { setCurrentStep(i); document.getElementById('form-fill-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const circ = 2 * Math.PI * 16

  return (
    <div id="form-fill-top" className="v-scope flex min-h-full flex-col bg-v-bg">
      {/* ── Barra superior ── */}
      <div className="sticky top-0 z-20 shrink-0 border-b border-v-border bg-v-elevated/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="group inline-flex items-center gap-1 rounded-full py-1.5 pl-2 pr-3 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill hover:text-v-text">
            <ChevronLeft size={17} className="transition-transform group-hover:-translate-x-0.5" /> {locale === 'en' ? 'Back' : 'Volver'}
          </button>
          <span className="h-6 w-px bg-v-border" />
          <span className="grid size-9 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent">{createElement(formIcon(form), { size: 17 })}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-v-text">{dTitle(form, locale)}</p>
            <p className="truncate text-xs text-v-subtle">{dSubtitle(form, locale)}</p>
          </div>
          <ChipModoLlenado modo={modo} onCambiar={setModo} />
          {initialChildId ? (
            <span className="hidden items-center gap-1.5 rounded-full bg-v-accent-soft px-3 py-1.5 text-xs font-semibold text-v-accent sm:inline-flex">
              <Users size={13} /> {pacienteNombre || '—'}
            </span>
          ) : (
            <select value={selectedChild} onChange={e => setSelectedChild(e.target.value)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold outline-none ${selectedChild ? 'border-v-accent/30 bg-v-accent-soft text-v-accent' : 'border-v-warning/40 bg-v-warning/10 text-v-warning'}`}>
              <option value="">{t('evaluaciones.selecPac')}</option>
              {children.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {/* Progreso en anillo */}
          <div className="relative size-10 shrink-0" title={`${Math.round(progress)}%`}>
            <svg viewBox="0 0 40 40" className="size-10 -rotate-90">
              <circle cx="20" cy="20" r="16" fill="none" stroke="var(--v-fill)" strokeWidth="4" />
              <motion.circle cx="20" cy="20" r="16" fill="none" stroke="var(--v-accent)" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={circ} animate={{ strokeDashoffset: circ * (1 - progress / 100) }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-[10px] font-bold tabular-nums text-v-text">{currentStep + 1}/{totalSteps}</span>
          </div>
        </div>
      </div>

      <div className="flex-1">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[240px_1fr]">
          {/* ── Índice de secciones ── */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-v border border-v-border bg-v-elevated p-2 shadow-v">
              <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-v-subtle">{locale === 'en' ? 'Sections' : 'Secciones'}</p>
              {sections.map((sec: any, i: number) => {
                const st = sectionState(sec)
                const on = i === currentStep
                const done = st.total > 0 && st.n === st.total
                return (
                  <button key={i} onClick={() => irA(i)}
                    className={`relative flex w-full items-center gap-2.5 rounded-v-sm px-3 py-2 text-left text-[13px] transition-colors ${on ? 'text-v-accent' : 'text-v-muted hover:bg-v-fill hover:text-v-text'}`}>
                    {on && <motion.span layoutId="form-section" className="absolute inset-0 rounded-v-sm bg-v-accent-soft" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                    <span className={`relative grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${done ? 'bg-v-success text-white' : on ? 'bg-v-accent text-white' : st.n > 0 ? 'bg-v-accent-soft text-v-accent' : 'bg-v-fill text-v-subtle'}`}>
                      {done ? <CheckCircle2 size={11} /> : i + 1}
                    </span>
                    <span className={`relative line-clamp-2 flex-1 ${on ? 'font-semibold' : ''}`}>{String(sec.title || sec.section || '').replace(/^\d+\.\s*/, '')}</span>
                  </button>
                )
              })}
            </div>
          </aside>

          <div className="min-w-0 space-y-5">
            {/* ── Sección actual ── */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.section key={currentStep} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
                className="overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v">
                <div className="flex items-start gap-3 border-b border-v-border px-6 py-5">
                  <span className="v-brand grid size-9 shrink-0 place-items-center rounded-[30%] text-sm font-bold" style={{ boxShadow: 'none' }}>{currentStep + 1}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold leading-tight tracking-tight text-v-text">{String(currentSection.title || currentSection.section || '').replace(/^\d+\.\s*/, '')}</h3>
                    {(currentSection.description || currentSection.subtitle) && <p className="mt-1 text-sm text-v-muted">{currentSection.description || currentSection.subtitle}</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-v-fill px-2.5 py-1 text-[11px] font-semibold tabular-nums text-v-muted">
                    {sectionState(currentSection).n}/{questions.length}
                  </span>
                </div>
                <div className="divide-y divide-v-border">
                  {questions.map((q: any, qi: number) => (
                    <div key={q.id} className="relative px-6 py-5">
                      {isAnswered(responses[q.id]) && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-5 top-5 text-v-success"><CheckCircle2 size={16} /></motion.span>
                      )}
                      <div className="pr-6">
                        <span className="mb-1 block text-[11px] font-semibold tabular-nums text-v-subtle">{locale === 'en' ? 'Question' : 'Pregunta'} {qi + 1}</span>
                        <QuestionRenderer question={q} value={responses[q.id]} manual={modo === 'manual'} onChange={(val: any) => handleResponse(q.id, val)} />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.section>
            </AnimatePresence>

            {/* ── Navegación entre secciones ── */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-v border border-v-border bg-v-elevated px-4 py-3 shadow-v">
              <div className="contents">
          <button onClick={() => irA(currentStep - 1)} disabled={currentStep === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-v-border px-4 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill hover:text-v-text disabled:opacity-40">
            <ChevronLeft size={16} /> {locale === 'en' ? 'Previous' : 'Anterior'}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {mostrarIA && (
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleAnalyzeWithAI} disabled={isAnalyzing || answeredCount < 3}
                title={answeredCount < 3 ? (locale === 'en' ? 'Answer at least 3 questions' : 'Responde al menos 3 preguntas') : undefined}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-v-accent/40 bg-v-accent-soft px-4 text-sm font-semibold text-v-accent transition-opacity disabled:opacity-40">
                {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isAnalyzing ? (locale === 'en' ? 'Analyzing…' : 'Analizando…') : (locale === 'en' ? 'Analyze with AI' : 'Analizar con IA')}
                {!isAnalyzing && <CostoToken />}
              </motion.button>
            )}
            {esUltimo ? (
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={isSaving || !selectedChild}
                title={!selectedChild ? t('evaluaciones.selecPac') : undefined}
                className="v-brand inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-40">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {t('auto.evaluacionesUnificadas.guardar')}
              </motion.button>
            ) : (
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => irA(currentStep + 1)}
                className="v-brand inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-sm font-semibold">
                {locale === 'en' ? 'Next' : 'Siguiente'} <ChevronRight size={16} />
              </motion.button>
            )}
          </div>
        </div>
      </div>
            {/* ── Análisis de IA ── */}
            {aiAnalysis && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-v border border-v-accent/30 bg-v-elevated p-6 shadow-v">
                <AIAnalysisPanel analysis={aiAnalysis} editableMessage={editedMessage} onEditMessage={setEditedMessage} editableActividades={editedActividades} onEditActividades={setEditedActividades} />
              </motion.div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

// ─── FORM CARD ───────────────────────────────────────────────────────────────
function FormCard({ form, onStart, onSend, index = 0 }: any) {
  const { t, locale } = useI18n()
  const isExternal = (form as any).externalPlatform
  const isPro = form.formKey
  const isParent = form.targetRole === 'parent' || form.targetRole === 'both'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 9) * 0.03, type: 'spring', stiffness: 220, damping: 24 }}
      whileHover={{ y: -3 }}
      className="group flex flex-col rounded-v border border-v-border bg-v-elevated p-5 shadow-v transition-shadow hover:shadow-v-lg">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
          {createElement(formIcon(form), { size: 19 })}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-v-text">{dTitle(form, locale)}</h3>
          <p className="mt-0.5 truncate text-xs text-v-subtle">{dSubtitle(form, locale)}</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {isParent && <span className="inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-2 py-0.5 text-[10px] font-semibold text-v-accent"><Users size={10} /> {locale === 'en' ? 'Parents' : 'Padres'}</span>}
        {isExternal && <span className="inline-flex items-center gap-1 rounded-full bg-v-warning/15 px-2 py-0.5 text-[10px] font-semibold text-v-warning"><Lock size={10} /> {locale === 'en' ? 'External' : 'Externa'}</span>}
        {isPro && !isExternal && <span className="inline-flex items-center gap-1 rounded-full bg-v-success/15 px-2 py-0.5 text-[10px] font-semibold text-v-success"><Sparkles size={10} /> PRO</span>}
        <span className="inline-flex items-center gap-1 rounded-full bg-v-fill px-2 py-0.5 text-[10px] font-semibold text-v-muted"><Clock size={10} /> {form.estimatedMinutes} min</span>
      </div>

      <p className="mb-4 line-clamp-2 flex-1 text-sm leading-relaxed text-v-muted">{dDesc(form, locale)}</p>

      <div className="mb-4 flex flex-wrap gap-1">
        {dTags(form, locale).slice(0, 3).map((tag: string) => (
          <span key={tag} className="rounded-full border border-v-border px-2 py-0.5 text-[10px] text-v-subtle">{tag}</span>
        ))}
      </div>

      <div className="flex gap-2">
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => onStart(form)}
          className="v-brand flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold" style={{ boxShadow: 'none' }}>
          <FileText size={14} /> {t('evaluaciones.completar')}
        </motion.button>
        {isParent && (
          <button onClick={() => onSend(form)} title={t('evaluaciones.enviarPadres')}
            className="grid size-10 place-items-center rounded-full border border-v-border text-v-muted transition-colors hover:border-v-accent/40 hover:bg-v-accent-soft hover:text-v-accent">
            <Send size={15} />
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function EvaluacionesUnificadas({ initialChildId, initialChildName }: { initialChildId?: string; initialChildName?: string } = {}) {
  const toast = useToast()
  const { t, locale } = useI18n()
  const [activeTab, setActiveTab] = useState<'biblioteca' | 'enviados' | 'historial'>('biblioteca')
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedChild, setSelectedChild] = useState(initialChildId || '')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedForm, setSelectedForm] = useState<any>(null)
  const [children, setChildren] = useState<any[]>([])
  const [parents, setParents] = useState<any[]>([])
  const [sentForms, setSentForms] = useState<any[]>([])
  const [savedForms, setSavedForms] = useState<any[]>([])
  const [sendFormModal, setSendFormModal] = useState<any>(null)
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // initialChildId ya se usa como valor inicial del estado
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [childrenRes, parentsRes, sentRes, formResponsesRes, anamnesisRes, abaRes, entornoRes] = await Promise.all([
      supabase.from('children').select('id, name, age, birth_date, diagnosis').order('name'),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'padre'),
      supabase.from('parent_forms').select('*, profiles(full_name, email)').order('created_at', { ascending: false }),
      supabase.from('form_responses').select('id, form_type, form_title, ai_analysis, created_at, child_id, children(name)').order('created_at', { ascending: false }).limit(30),
      supabase.from('anamnesis_completa').select('id, form_title, created_at, child_id, children(name)').order('created_at', { ascending: false }).limit(10),
      supabase.from('registro_aba').select('id, form_title, datos, child_id, fecha_sesion, children(name)').order('fecha_sesion', { ascending: false }).limit(10),
      supabase.from('registro_entorno_hogar').select('id, form_title, datos, child_id, fecha_visita, created_at, children(name)').order('fecha_visita', { ascending: false }).limit(10),
    ])
    if (childrenRes.data) setChildren(childrenRes.data)
    if (parentsRes.data) setParents(parentsRes.data)
    if (sentRes.data) setSentForms(sentRes.data)

    // Merge all saved form sources into one unified historial
    const allSaved = [
      ...(formResponsesRes.data || []),
      ...(anamnesisRes.data || []).map((r: any) => ({ ...r, _source: 'anamnesis_completa', form_title: r.form_title || 'Historia Clínica (Anamnesis)' })),
      ...(abaRes.data || []).map((r: any) => ({ ...r, _source: 'registro_aba', form_title: r.form_title || 'Sesión ABA' })),
      ...(entornoRes.data || []).map((r: any) => ({ ...r, _source: 'registro_entorno_hogar', form_title: r.form_title || 'Entorno del Hogar' })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    setSavedForms(allSaved)
    setLoading(false)
  }

  const handleSendForm = async (form: any, { childId, message, deadline }: any) => {
    try {
      // Derive parent_id from child record
      const { data: child } = await supabase.from('children').select('parent_id').eq('id', childId).maybeSingle()
      const parentId = (child as any)?.parent_id || null

      const res = await fetch('/api/admin/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({
          parent_id: parentId,
          child_id: childId,
          form_type: form.id,
          form_title: form.title,
          form_description: form.description,
          message_to_parent: message,
          deadline,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(t('auto.evaluacionesUnificadas.formularioEnviado'))
      loadData()
    } catch (err: any) {
      toast.error((locale === 'en' ? 'Error sending: ' : 'Error al enviar: ') + err.message)
    }
  }

  // Filter forms
  const filteredForms = ALL_UNIFIED_FORMS.filter(form => {
    if (activeCategory !== 'all' && form.category !== activeCategory) return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return form.title.toLowerCase().includes(term) ||
        form.subtitle.toLowerCase().includes(term) ||
        form.description.toLowerCase().includes(term) ||
        form.tags?.some((t: string) => t.toLowerCase().includes(term))
    }
    return true
  })

  // If filling a form
  if (selectedForm) {
    return <FormFillView form={selectedForm} children={children} onBack={() => setSelectedForm(null)} toast={toast} initialChildId={initialChildId} initialChildName={initialChildName} />
  }

  const stats = {
    total: ALL_UNIFIED_FORMS.length,
    neuro: ALL_FORMS.length,
    clinical: CLINICAL_FORMS.length,
    sent: sentForms.length,
    pending: sentForms.filter(f => f.status === 'pending').length,
    completed: sentForms.filter(f => f.status === 'completed').length,
  }

  const TABS = [
    { key: 'biblioteca', label: t('evaluaciones.biblioteca'), count: stats.total, Icon: LayoutGrid },
    { key: 'enviados',   label: t('evaluaciones.enviados'),   count: stats.sent, Icon: Send },
    { key: 'historial',  label: t('evaluaciones.historial'),  count: savedForms.length, Icon: ClipboardList },
  ] as const
  const catLabel = (id: string, fallback: string) => ({ all: t('evaluaciones.catTodas'), conductual: t('evaluaciones.catABA'), familia: t('evaluaciones.catFamilia'), clinico: t('evaluaciones.catClinico'), tea: t('evaluaciones.catTEA'), tdah: t('evaluaciones.catTDAH'), habilidades: t('evaluaciones.catAdaptativa'), cognitivo: t('evaluaciones.catCognitivo'), sensorial: t('evaluaciones.catSensorial') } as Record<string, string>)[id] || fallback

  return (
    <div className="v-scope space-y-5 pb-8">
      <TokensPrediccion />
      {/* ── Resumen — mismo ícono que la pestaña (portapapeles con check) ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: locale === 'en' ? 'Forms' : 'Formularios', value: stats.total, Icon: ClipboardCheck, tone: 'bg-v-accent-soft text-v-accent' },
          { label: t('evaluaciones.enviados_stat'), value: stats.sent, Icon: Send, tone: 'bg-v-accent-soft text-v-accent' },
          { label: locale === 'en' ? 'Pending' : 'Pendientes', value: stats.pending, Icon: Clock, tone: 'bg-v-warning/15 text-v-warning' },
          { label: locale === 'en' ? 'Completed' : 'Completados', value: stats.completed, Icon: CheckCircle2, tone: 'bg-v-success/15 text-v-success' },
        ].map(({ label, value, Icon, tone }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, type: 'spring', stiffness: 220, damping: 24 }} whileHover={{ y: -3 }}
            className="group rounded-v border border-v-border bg-v-elevated p-4 shadow-v">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium text-v-muted">{label}</p>
              <span className={`grid size-9 place-items-center rounded-[30%] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${tone}`}><Icon size={16} /></span>
            </div>
            <p className="mt-1 text-3xl font-bold leading-none tracking-tight tabular-nums text-v-text">{value}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Pestañas ── */}
      <div className="flex rounded-full bg-v-fill p-1">
        {TABS.map(({ key, label, count, Icon }) => {
          const on = activeTab === key
          return (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-semibold transition-colors ${on ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
              {on && <motion.span layoutId="eval-tab" className="absolute inset-0 rounded-full bg-v-elevated shadow-v" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <Icon size={15} className="relative" />
              <span className="relative">{label}</span>
              <span className={`relative rounded-full px-2 py-0.5 text-[10px] font-bold ${on ? 'bg-v-accent-soft text-v-accent' : 'bg-v-border text-v-subtle'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── BIBLIOTECA TAB ── */}
      {activeTab === 'biblioteca' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 rounded-full border border-v-border bg-v-elevated px-4 py-2.5 shadow-v transition-shadow focus-within:border-v-accent/50 focus-within:ring-4 focus-within:ring-v-accent-soft">
            <Search size={16} className="shrink-0 text-v-subtle" />
            <input type="text" placeholder={t('ui.search_form')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent text-sm text-v-text outline-none placeholder:text-v-subtle" />
            {searchTerm && <button onClick={() => setSearchTerm('')} className="text-v-subtle hover:text-v-text"><X size={14} /></button>}
          </div>

          <div className="flex flex-wrap gap-2">
            {UNIFIED_CATEGORIES.map(cat => {
              const CatIcon = CAT_ICON[cat.id] || LayoutGrid
              const on = activeCategory === cat.id
              const n = cat.id === 'all' ? ALL_UNIFIED_FORMS.length : ALL_UNIFIED_FORMS.filter(f => f.category === cat.id).length
              return (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${on ? 'border-v-accent/40 bg-v-accent-soft text-v-accent' : 'border-v-border bg-v-elevated text-v-muted hover:text-v-text hover:shadow-v'}`}>
                  <CatIcon size={13} />
                  {catLabel(cat.id, cat.label)}
                  <span className={`text-[10px] ${on ? 'text-v-accent/70' : 'text-v-subtle'}`}>{n}</span>
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredForms.map((form, i) => (
              <FormCard key={form.id} index={i} form={form}
                onStart={(f: any) => setSelectedForm(f)}
                onSend={(f: any) => setSendFormModal(f)} />
            ))}
          </div>

          {filteredForms.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-v border border-dashed border-v-border py-16 text-center">
              <span className="mb-3 grid size-14 place-items-center rounded-full bg-v-fill"><Search size={24} className="text-v-subtle" /></span>
              <p className="font-semibold text-v-text">{t('evaluaciones.noFormularios')}</p>
              <p className="mt-1 text-xs text-v-subtle">{t('evaluaciones.otroBusqueda')}</p>
            </div>
          )}
        </div>
      )}

      {/* ── ENVIADOS TAB ── */}
      {activeTab === 'enviados' && (
        <div className="space-y-3">
          {sentForms.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-v border border-dashed border-v-border py-16 text-center">
              <span className="mb-3 grid size-14 place-items-center rounded-full bg-v-fill"><Send size={22} className="text-v-subtle" /></span>
              <p className="font-bold text-v-subtle">{t('ui.no_forms_sent')}</p>
              <p className="text-xs text-v-subtle mt-1">{t('evaluaciones.irBiblioteca2')}</p>
            </div>
          ) : sentForms.map(sf => (
            <div key={sf.id} className="rounded-v border border-v-border bg-v-elevated shadow-v overflow-hidden">
              <div className="flex items-center gap-4 p-5 cursor-pointer hover:bg-v-fill transition-all"
                onClick={() => setExpandedResponse(expandedResponse === sf.id ? null : sf.id)}>
                <span className={`grid size-10 shrink-0 place-items-center rounded-[30%] ${sf.status === 'completed' ? 'bg-v-success/15 text-v-success' : 'bg-v-warning/15 text-v-warning'}`}>
                  {sf.status === 'completed' ? <CheckCircle2 size={17} /> : <Clock size={17} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="font-bold text-v-text text-sm truncate" style={{ color: "var(--v-text)" }}>{sf.form_title}</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase inline-flex items-center gap-1 ${sf.status === 'completed' ? 'bg-v-success/15 text-v-success border-v-success/30' : 'bg-v-warning/15 text-v-warning border-v-warning/30'}`}>
                      {sf.status === 'completed' ? <><CheckCircle2 size={10} /> {t('evaluaciones.completado')}</> : <><Clock size={10} /> {t('evaluaciones.pendiente')}</>}
                    </span>
                  </div>
                  <p className="text-xs text-v-subtle font-medium">Para: {sf.profiles?.full_name || sf.profiles?.email}</p>
                  <p className="text-xs text-v-subtle mt-0.5">{new Date(sf.created_at).toLocaleDateString(toBCP47(locale))}</p>
                </div>
                {expandedResponse === sf.id ? <ChevronUp size={16} className="text-v-subtle" /> : <ChevronDown size={16} className="text-v-subtle" />}
              </div>
              {expandedResponse === sf.id && sf.status === 'completed' && sf.responses && (
                <div className="border-t border-v-border bg-v-fill p-5">
                  <h4 className="text-xs font-bold text-v-subtle mb-3">{t("evaluaciones.respuestas")}</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {Object.entries(sf.responses).map(([k, v]) => (
                      <div key={k} className=" rounded-v-sm p-3 border border-v-border" style={{ background: "var(--v-bg-elevated)" }}>
                        <p className="text-xs font-bold text-v-subtle">{k}</p>
                        <p className="text-sm font-medium text-v-text mt-0.5">{Array.isArray(v) ? (v as string[]).join(', ') : String(v)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── HISTORIAL TAB ── */}
      {activeTab === 'historial' && (
        <div className="space-y-3">
          {savedForms.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-v border border-dashed border-v-border py-16 text-center">
              <span className="mb-3 grid size-14 place-items-center rounded-full bg-v-fill"><ClipboardList size={22} className="text-v-subtle" /></span>
              <p className="font-bold text-v-subtle">{t("evaluaciones.sinFormsGuardados")}</p>
            </div>
          ) : savedForms.map(sf => (
            <HistorialFormCard
              key={`${sf._source || 'form_responses'}-${sf.id}`}
              sf={sf}
              onReportGenerated={loadData}
            />
          ))}
        </div>
      )}

      {/* Send modal */}
      {sendFormModal && (
        <SendFormModal
          form={sendFormModal}
          children={children}
          onSend={(data: any) => handleSendForm(sendFormModal, data)}
          onClose={() => setSendFormModal(null)}
        />
      )}
    </div>
  )
}
