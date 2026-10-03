'use client'
// app/padre/components/ParentFormsView.tsx
// Recursos adicionales de la familia: formularios que envía el equipo, materiales, tienda y documentos.

import { useI18n } from '@/lib/i18n-context'
import { useTranslatedForm } from '@/lib/form-translate'
import { toBCP47 } from '@/lib/i18n'
import { useTraducir } from '@/lib/use-traducir'
import { useState, useEffect } from 'react'
import {
  FileText, CheckCircle2, Check, Clock, ChevronRight, ChevronLeft, X, Loader2, AlertCircle, BookOpen,
  Link as LinkIcon, Eye, Play, Image as ImageIcon, Music, Sparkles, Bell, FolderOpen, ShoppingBag,
  ClipboardList, ClipboardCheck, Send,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import StoreView from './StoreView'
import DocumentosView from '@/app/admin/components/DocumentosView'
import { useTheme } from '@/components/ThemeContext'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { useSinPagos } from '@/lib/modo-app'

const cardClass = 'rounded-v border border-v-border bg-v-elevated shadow-v'
const qInput = 'w-full rounded-v-sm border border-v-border bg-v-bg px-4 py-3 text-sm text-v-text outline-none transition-shadow placeholder:text-v-subtle focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft'

// ─── Formulario para la familia (paso a paso) ──────────────────────────────────
function ParentFormRenderer({ form, onSubmit, onClose }: { form: any; onSubmit: (r: any) => Promise<void> | void; onClose: () => void }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [formDefRaw, setFormDef] = useState<any>(null)
  const formDef = useTranslatedForm(formDefRaw) || formDefRaw // traducido en vivo en inglés (con caché)
  const [formError, setFormError] = useState(false)

  useEffect(() => {
    Promise.all([
      import('@/app/admin/data/neurodivergentForms'), import('@/app/admin/data/neurodivergentForms-en'),
      import('@/app/admin/data/newFormConstants'), import('@/app/admin/data/newFormConstants-en'),
      import('@/app/admin/data/formConstants'), import('@/app/admin/data/formConstants-en'),
    ]).then(([neuroMod, neuroEnMod, newMod, newEnMod, formMod, formEnMod]) => {
      const found = (en ? neuroEnMod.ALL_FORMS_EN : neuroMod.ALL_FORMS).find((f: any) => f.id === form.form_type)
      if (found) { setFormDef(found); return }
      const def = (id: string, es: string, enT: string, dEs: string, dEn: string, secEs: any, secEn: any) =>
        ({ id, title: en ? enT : es, description: en ? dEn : dEs, sections: en ? secEn : secEs })
      const mapa: Record<string, any> = {
        objetivo_iep: def('objetivo_iep', 'Objetivo IEP', 'IEP Goal', 'Plan de educación individualizado', 'Individualized education plan', newMod.OBJETIVO_IEP_DATA, newEnMod.OBJETIVO_IEP_DATA_EN),
        nota_sesion: def('nota_sesion', 'Nota de sesión', 'Session note', 'Registro de sesión clínica', 'Clinical session record', newMod.NOTA_SESION_DATA, newEnMod.NOTA_SESION_DATA_EN),
        informe_mensual: def('informe_mensual', 'Informe mensual de progreso', 'Monthly progress report', 'Evaluación mensual del progreso', 'Monthly progress assessment', newMod.INFORME_MENSUAL_DATA, newEnMod.INFORME_MENSUAL_DATA_EN),
        registro_conductual: def('registro_conductual', 'Registro conductual ABC', 'ABC behavior record', 'Análisis funcional de conducta', 'Functional behavior analysis', newMod.REGISTRO_CONDUCTUAL_ABC_DATA, newEnMod.REGISTRO_CONDUCTUAL_ABC_DATA_EN),
        anamnesis: def('anamnesis', 'Historia clínica', 'Clinical history', 'Anamnesis e historia del desarrollo', 'Anamnesis and developmental history', formMod.ANAMNESIS_DATA, formEnMod.ANAMNESIS_DATA_EN),
        aba: def('aba', 'Sesión ABA', 'ABA session', 'Registro de sesión de terapia ABA', 'ABA therapy session record', formMod.ABA_DATA, formEnMod.ABA_DATA_EN),
        entorno_hogar: def('entorno_hogar', 'Evaluación del entorno del hogar', 'Home environment assessment', 'Evaluación del ambiente familiar', 'Assessment of the family environment', formMod.ENTORNO_HOGAR_DATA, formEnMod.ENTORNO_HOGAR_DATA_EN),
        brief2: def('brief2', 'Evaluación BRIEF-2', 'BRIEF-2 assessment', 'Funciones ejecutivas', 'Executive functions', formMod.BRIEF2_DATA, formEnMod.BRIEF2_DATA_EN),
        ados2: def('ados2', 'Evaluación ADOS-2', 'ADOS-2 assessment', 'Diagnóstico del autismo', 'Autism diagnosis', formMod.ADOS2_DATA, formEnMod.ADOS2_DATA_EN),
        vineland3: def('vineland3', 'Evaluación Vineland-3', 'Vineland-3 assessment', 'Conducta adaptativa', 'Adaptive behavior', formMod.VINELAND3_DATA, formEnMod.VINELAND3_DATA_EN),
        wiscv: def('wiscv', 'Evaluación WISC-V', 'WISC-V assessment', 'Escala de inteligencia', 'Intelligence scale', formMod.WISCV_DATA, formEnMod.WISCV_DATA_EN),
        basc3: def('basc3', 'Evaluación BASC-3', 'BASC-3 assessment', 'Sistema conductual', 'Behavioral system', formMod.BASC3_DATA, formEnMod.BASC3_DATA_EN),
      }
      if (mapa[form.form_type]) { setFormDef(mapa[form.form_type]); return }
      console.warn(`form_type "${form.form_type}" no encontrado en ningún catálogo`)
      setFormError(true)
    }).catch(() => setFormError(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.form_type, en])

  const answer = (id: string, v: any) => setResponses(p => ({ ...p, [id]: v }))
  const enviar = async () => { setSubmitting(true); try { await onSubmit(responses) } finally { setSubmitting(false) } }

  const marco = (children: React.ReactNode) => (
    <motion.div className="v-scope fixed inset-0 z-[150] flex items-end justify-center bg-[#081426]/50 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-v-lg border border-v-border bg-v-elevated shadow-v-lg sm:rounded-v-lg">
        {children}
      </motion.div>
    </motion.div>
  )

  if (formError) return marco(
      <div className="p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-v-warning/15 text-v-warning"><AlertCircle size={26} /></span>
        <p className="mt-3 text-base font-semibold text-v-text">{L('Form not available', 'Formulario no disponible')}</p>
        <p className="mt-1 text-sm text-v-muted">{L('Ask the team to send it again.', 'Pide al equipo que lo vuelva a enviar.')}</p>
        <button onClick={onClose} className="mt-5 h-10 rounded-full bg-v-fill px-5 text-sm font-semibold text-v-text">{L('Close', 'Cerrar')}</button>
      </div>
  )
  if (!formDef) return marco(<div className="grid place-items-center p-12"><Loader2 className="animate-spin text-v-accent" size={26} /></div>)

  const section = formDef.sections[step]
  const total = formDef.sections.length
  const ultimo = step === total - 1
  const pct = ((step + 1) / total) * 100
  const opcion = (on: boolean) => `rounded-v-sm border px-4 py-3 text-left text-sm font-medium transition-all ${on ? 'border-transparent bg-v-accent-soft text-v-accent ring-4 ring-v-accent-soft' : 'border-v-border bg-v-bg text-v-text hover:border-v-accent/40'}`

  return marco(
    <>
      <div className="relative shrink-0 border-b border-v-border px-5 pb-4 pt-5">
        <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
        <button onClick={onClose} aria-label={L('Close', 'Cerrar')} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-v-muted hover:bg-v-fill"><X size={17} /></button>
        <div className="flex items-center gap-3 pr-10">
          <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><ClipboardList size={18} /></span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-v-text">{formDef.title}</p>
            <p className="truncate text-xs text-v-muted">{form.message_to_parent || formDef.description}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px] font-semibold text-v-muted">
          <span>{L(`Step ${step + 1} of ${total}`, `Paso ${step + 1} de ${total}`)}</span><span className="tabular-nums text-v-accent">{Math.round(pct)}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-v-fill"><motion.div className="v-brand h-full rounded-full" animate={{ width: `${pct}%` }} /></div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div>
          <p className="text-lg font-semibold tracking-tight text-v-text">{section.title}</p>
          {section.description && <p className="mt-1 text-sm text-v-muted">{section.description}</p>}
        </div>
        {section.questions.map((q: any) => (
          <div key={q.id}>
            <p className="mb-2.5 text-sm font-semibold text-v-text">{q.label}</p>
            {(q.type === 'select' || q.type === 'frequency') && (
              <div className="grid gap-2">{(q.options || []).map((o: string) => <button key={o} type="button" onClick={() => answer(q.id, o)} className={opcion(responses[q.id] === o)}>{o}</button>)}</div>
            )}
            {q.type === 'multiselect' && (
              <div className="flex flex-wrap gap-2">
                {(q.options || []).map((o: string) => {
                  const sel: string[] = Array.isArray(responses[q.id]) ? responses[q.id] : []
                  return <button key={o} type="button" onClick={() => answer(q.id, sel.includes(o) ? sel.filter(x => x !== o) : [...sel, o])} className={opcion(sel.includes(o))}>{o}</button>
                })}
              </div>
            )}
            {q.type === 'textarea' && <textarea rows={4} value={responses[q.id] || ''} onChange={e => answer(q.id, e.target.value)} placeholder={q.placeholder} className={`${qInput} resize-none`} />}
            {(q.type === 'text' || q.type === 'number') && <input type={q.type} value={responses[q.id] || ''} onChange={e => answer(q.id, e.target.value)} placeholder={q.placeholder} className={qInput} />}
            {q.type === 'boolean' && (
              <div className="grid grid-cols-2 gap-2">
                {[['Sí', L('Yes', 'Sí')], ['No', 'No']].map(([v, label]) => <button key={v} type="button" onClick={() => answer(q.id, v)} className={opcion(responses[q.id] === v)}>{label}</button>)}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-v-border p-4">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-v-border px-4 text-sm font-semibold text-v-muted hover:bg-v-fill">
            <ChevronLeft size={16} /> {L('Back', 'Atrás')}
          </button>
        )}
        {!ultimo ? (
          <button onClick={() => setStep(s => s + 1)} className="v-brand inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold">
            {L('Continue', 'Continuar')} <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={enviar} disabled={submitting} className="v-brand inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-60">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {submitting ? L('Sending…', 'Enviando…') : L('Send answers', 'Enviar respuestas')}
          </button>
        )}
      </div>
    </>
  )
}

// ─── Material de apoyo ─────────────────────────────────────────────────────────
function ResourceCard({ resource, index, tr }: { resource: any; index: number; tr: (t?: string) => string }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [verVideo, setVerVideo] = useState(false)
  const tipos: Record<string, { Icon: any; tone: string; es: string; en: string }> = {
    video: { Icon: Play, tone: 'bg-v-danger/10 text-v-danger', es: 'Video', en: 'Video' },
    pdf: { Icon: FileText, tone: 'bg-v-accent-soft text-v-accent', es: 'PDF', en: 'PDF' },
    link: { Icon: LinkIcon, tone: 'bg-v-accent-soft text-v-accent', es: 'Enlace', en: 'Link' },
    image: { Icon: ImageIcon, tone: 'bg-v-success/15 text-v-success', es: 'Imagen', en: 'Image' },
    document: { Icon: BookOpen, tone: 'bg-v-warning/15 text-v-warning', es: 'Documento', en: 'Document' },
    audio: { Icon: Music, tone: 'bg-v-accent-soft text-v-accent', es: 'Audio', en: 'Audio' },
  }
  const tipo = tipos[resource.resource_type] || tipos.link
  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * index }}
        className={`${cardClass} group flex items-start gap-3.5 p-4 transition-colors hover:border-v-accent/40`}>
        <span className={`grid size-11 shrink-0 place-items-center rounded-[30%] transition-transform group-hover:scale-105 ${tipo.tone}`}><tipo.Icon size={19} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tipo.tone}`}>{en ? tipo.en : tipo.es}</span>
            {resource.is_global && <span className="rounded-full bg-v-fill px-2 py-0.5 text-[10px] font-semibold text-v-muted">{L('For all families', 'Para todas las familias')}</span>}
          </div>
          <p className="mt-1.5 text-sm font-semibold leading-snug text-v-text">{tr(resource.title)}</p>
          {resource.description && <p className="mt-0.5 line-clamp-2 text-xs text-v-muted">{tr(resource.description)}</p>}
          {resource.url && (
            <button onClick={() => resource.resource_type === 'video' ? setVerVideo(true) : window.open(resource.url, '_blank')}
              className="v-brand mt-3 inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold">
              {resource.resource_type === 'video' ? <Play size={12} /> : <Eye size={12} />}
              {resource.resource_type === 'video' ? L('Watch video', 'Ver video') : resource.resource_type === 'pdf' ? L('Open PDF', 'Abrir PDF') : L('Open', 'Abrir')}
            </button>
          )}
        </div>
      </motion.div>
      <AnimatePresence>
        {verVideo && (
          <motion.div className="fixed inset-0 z-[150] grid place-items-center bg-black/85 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setVerVideo(false)}>
            <div className="w-full max-w-3xl" onClick={e => e.stopPropagation()}>
              <div className="mb-3 flex items-center gap-3">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{tr(resource.title)}</p>
                <button onClick={() => setVerVideo(false)} aria-label={L('Close', 'Cerrar')} className="grid size-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"><X size={18} /></button>
              </div>
              <div className="relative aspect-video overflow-hidden rounded-v bg-black">
                <iframe src={resource.url} className="absolute inset-0 size-full" style={{ height: '100%' }} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen title={resource.title} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Vista principal ──────────────────────────────────────────────────────────
function ParentFormsResourcesView({ profile, selectedChild, onFormsLoaded, initialTab }: { profile: any; selectedChild: any; onFormsLoaded?: (count: number) => void; initialTab?: 'forms' | 'resources' | 'store' | 'documentos' }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const bcp = toBCP47(locale)
  const { isDark } = useTheme()
  const toast = useToast()
  const app = useSinPagos()
  const [activeTab, setActiveTab] = useState<'forms' | 'resources' | 'store' | 'documentos'>(initialTab || 'forms')
  const [pendingForms, setPendingForms] = useState<any[]>([])
  const [expiredForms, setExpiredForms] = useState<any[]>([])
  const [completedForms, setCompletedForms] = useState<any[]>([])
  const [resources, setResources] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeForm, setActiveForm] = useState<any>(null)

  const loadData = async () => {
    if (!profile?.id) return
    try {
      const { data } = await supabase.from('parent_forms').select('*').eq('parent_id', profile.id).order('created_at', { ascending: false })
      // Los chequeos de bienestar no son formularios (se guardaban aquí antes)
      const forms = (data || []).filter((f: any) => f.form_type !== 'wellbeing')
      const today = new Date().toISOString().split('T')[0]
      const pending = forms.filter(f => ['pending', 'assigned', 'enviado'].includes(f.status) && !(f.deadline && f.deadline < today))
      const expired = forms.filter(f => f.status !== 'completed' && f.deadline && f.deadline < today)
      setPendingForms(pending); setExpiredForms(expired); setCompletedForms(forms.filter(f => f.status === 'completed'))
      // Marcar vencidos en la base para que el contador no los cuente
      const vencidos = expired.filter(f => f.status === 'pending')
      if (vencidos.length) await supabase.from('parent_forms').update({ status: 'expired' }).in('id', vencidos.map((f: any) => f.id))
      onFormsLoaded?.(pending.length)

      const res = await fetch(`/api/admin/resources?parent_id=${profile.id}`)
      const json = await res.json()
      if (!json.error) setResources(json.data || [])
    } catch (err) {
      console.error('Error loading:', err)
    } finally { setIsLoading(false) }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // detectar formularios nuevos
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const handleSubmitForm = async (formId: string, responses: any) => {
    const form = pendingForms.find(f => f.id === formId)
    await fetch('/api/admin/forms', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-locale': locale },
      body: JSON.stringify({ id: formId, status: 'completed', responses, completed_at: new Date().toISOString() }),
    })
    if (form) {
      // Análisis y reporte para que el equipo lo revise
      fetch('/api/analyze-parent-form-submission', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-locale': locale },
        body: JSON.stringify({ formId, formType: form.form_type, formTitle: form.form_title, responses, childId: form.child_id, parentId: form.parent_id || profile?.id }),
      }).catch(e => console.error('Error generating report:', e))
    }
    setActiveForm(null)
    toast.success(L('Form sent! The therapy team will review it soon.', '¡Formulario enviado! El equipo terapéutico lo revisará pronto.'))
    loadData()
  }

  const tr = useTraducir([
    ...pendingForms.map(f => f.form_title), ...completedForms.map(f => f.form_title), ...expiredForms.map(f => f.form_title),
    ...pendingForms.map(f => f.message_to_parent), ...resources.flatMap(r => [r.title, r.description]),
  ])

  // En la app instalada desde Google Play no hay tienda (su política de pagos)
  const tabs = [
    { id: 'forms' as const, label: L('Forms', 'Formularios'), Icon: ClipboardCheck, badge: pendingForms.length, alerta: true },
    { id: 'resources' as const, label: L('Materials', 'Materiales'), Icon: BookOpen, badge: resources.length, alerta: false },
    { id: 'store' as const, label: L('Store', 'Tienda'), Icon: ShoppingBag, badge: 0, alerta: false },
    { id: 'documentos' as const, label: L('Documents', 'Documentos'), Icon: FolderOpen, badge: 0, alerta: false },
  ].filter(t => !(app && t.id === 'store'))
  const fecha = (d?: string) => d ? new Date(d).toLocaleDateString(bcp, { day: 'numeric', month: 'short', year: 'numeric' }) : null
  const Titulo = ({ Icon, tone, texto }: { Icon: any; tone: string; texto: string }) => (
    <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-v-text"><span className={`grid size-6 place-items-center rounded-full ${tone}`}><Icon size={12} /></span>{texto}</p>
  )

  return (
    <div className="v-scope space-y-4 pb-8 md:space-y-5">
      {/* Encabezado */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }} className={`relative overflow-hidden ${cardClass}`}>
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(40rem 14rem at 0% 0%, var(--v-glow-1), transparent 70%)' }} />
        <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-v-muted">{L('Extra resources', 'Recursos adicionales')}</p>
            <h2 className="v-headline mt-1 text-[1.5rem] leading-tight text-v-text sm:text-[1.8rem]">{L('Forms and ', 'Formularios y ')}<span className="v-brand-text">{L('materials', 'materiales')}</span></h2>
            <p className="mt-2 text-sm text-v-muted">{L('Everything the therapy team shares with your family.', 'Todo lo que el equipo de terapia comparte con tu familia.')}</p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2">
            <div className={`rounded-v-sm px-4 py-3 text-center ${pendingForms.length ? 'bg-v-warning/15' : 'bg-v-fill'}`}><p className={`text-2xl font-bold leading-none tabular-nums ${pendingForms.length ? 'text-v-warning' : 'text-v-text'}`}>{pendingForms.length}</p><p className="mt-1 text-[11px] font-medium text-v-muted">{L('Pending', 'Pendientes')}</p></div>
            <div className="rounded-v-sm bg-v-accent-soft px-4 py-3 text-center"><p className="text-2xl font-bold leading-none tabular-nums text-v-accent">{resources.length}</p><p className="mt-1 text-[11px] font-medium text-v-muted">{L('Materials', 'Materiales')}</p></div>
          </div>
        </div>
      </motion.div>

      {/* Pestañas */}
      <div className="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-1 rounded-v bg-v-fill p-1 sm:flex sm:w-fit sm:rounded-full">
        {tabs.map(({ id, label, Icon, badge, alerta }) => {
          const on = activeTab === id
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`relative flex min-w-0 flex-col items-center gap-1 rounded-v-sm px-1 py-2 text-[11px] font-semibold transition-colors sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-4 sm:text-sm ${on ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
              {on && <motion.span layoutId="recursos-padre-tab" transition={{ type: 'spring', stiffness: 400, damping: 32 }} className="absolute inset-0 rounded-v-sm bg-v-elevated shadow-v sm:rounded-full" />}
              <Icon size={16} className="relative" /><span className="relative max-w-full truncate">{label}</span>
              {badge > 0 && <span className={`absolute right-1.5 top-1 rounded-full px-1.5 py-0.5 text-[10px] sm:relative sm:right-auto sm:top-auto font-bold tabular-nums ${alerta ? 'bg-v-danger text-white' : 'bg-v-accent-soft text-v-accent'}`}>{badge}</span>}
            </button>
          )
        })}
      </div>

      {isLoading && activeTab !== 'store' && activeTab !== 'documentos' ? (
        <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-v-accent" size={26} /></div>
      ) : activeTab === 'forms' ? (
        <div className="space-y-6">
          {pendingForms.length > 0 && (
            <section>
              <Titulo Icon={Bell} tone="bg-v-warning/15 text-v-warning" texto={L(`To complete (${pendingForms.length})`, `Por completar (${pendingForms.length})`)} />
              <div className="grid gap-3 sm:grid-cols-2">
                {pendingForms.map((form, i) => (
                  <motion.div key={form.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }} className={`${cardClass} flex flex-col border-v-warning/40 p-4`}>
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-warning/15 text-v-warning"><ClipboardList size={18} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug text-v-text">{tr(form.form_title)}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-v-warning/15 px-2 py-0.5 text-[10px] font-semibold text-v-warning">{L('Pending', 'Pendiente')}</span>
                          {form.deadline && <span className="inline-flex items-center gap-1 rounded-full bg-v-danger/10 px-2 py-0.5 text-[10px] font-semibold text-v-danger"><Clock size={10} /> {L('Until', 'Hasta')} {fecha(form.deadline)}</span>}
                        </div>
                      </div>
                    </div>
                    {form.message_to_parent && (
                      <p className="mt-3 flex items-start gap-2 rounded-v-sm bg-v-accent-soft/60 p-3 text-xs leading-relaxed text-v-text"><Sparkles size={13} className="mt-0.5 shrink-0 text-v-accent" /> {tr(form.message_to_parent)}</p>
                    )}
                    <button onClick={() => setActiveForm(form)} className="v-brand mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold">
                      <FileText size={15} /> {L('Fill in form', 'Completar formulario')}
                    </button>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {completedForms.length > 0 && (
            <section>
              <Titulo Icon={Check} tone="bg-v-success/15 text-v-success" texto={L(`Completed (${completedForms.length})`, `Completados (${completedForms.length})`)} />
              <div className="grid gap-2 sm:grid-cols-2">
                {completedForms.map(form => (
                  <div key={form.id} className={`${cardClass} flex items-center gap-3 p-3.5`}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-v-success/15 text-v-success"><CheckCircle2 size={17} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-v-text">{tr(form.form_title)}</p>
                      <p className="text-xs text-v-subtle">{form.completed_at ? L(`Sent ${fecha(form.completed_at)}`, `Enviado el ${fecha(form.completed_at)}`) : L('Sent', 'Enviado')}</p>
                    </div>
                    <span className="rounded-full bg-v-success/15 px-2 py-0.5 text-[10px] font-semibold text-v-success">{L('Done', 'Listo')}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {expiredForms.length > 0 && (
            <section>
              <Titulo Icon={AlertCircle} tone="bg-v-fill text-v-muted" texto={L(`Expired (${expiredForms.length})`, `Vencidos (${expiredForms.length})`)} />
              <div className="grid gap-2 sm:grid-cols-2">
                {expiredForms.map(form => (
                  <div key={form.id} className={`${cardClass} flex items-center gap-3 p-3.5 opacity-70`}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-v-fill text-v-muted"><Clock size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-v-muted">{tr(form.form_title)}</p>
                      <p className="text-xs text-v-subtle">{form.deadline ? L(`Expired ${fecha(form.deadline)}`, `Venció el ${fecha(form.deadline)}`) : L('No longer available', 'Ya no está disponible')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {pendingForms.length === 0 && completedForms.length === 0 && expiredForms.length === 0 && (
            <div className={`${cardClass} px-6 py-12 text-center`}>
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-v-fill"><ClipboardList size={20} className="text-v-subtle" /></span>
              <p className="mt-3 text-sm font-semibold text-v-text">{L('No forms yet', 'Aún no hay formularios')}</p>
              <p className="mt-1 text-xs text-v-muted">{L('When the team sends you one, it will appear here.', 'Cuando el equipo te envíe uno, aparecerá aquí.')}</p>
            </div>
          )}
        </div>
      ) : activeTab === 'resources' ? (
        resources.length === 0 ? (
          <div className={`${cardClass} px-6 py-12 text-center`}>
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-v-fill"><BookOpen size={20} className="text-v-subtle" /></span>
            <p className="mt-3 text-sm font-semibold text-v-text">{L('No materials yet', 'Aún no hay materiales')}</p>
            <p className="mt-1 text-xs text-v-muted">{L('Videos, guides and links from the team will appear here.', 'Aquí aparecerán videos, guías y enlaces del equipo.')}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">{resources.map((r, i) => <ResourceCard key={r.id} resource={r} index={i} tr={tr} />)}</div>
        )
      ) : activeTab === 'store' && !app ? (
        <StoreView profile={profile} />
      ) : selectedChild ? (
        <DocumentosView childId={selectedChild.id} childName={selectedChild.name} currentRole="padre" isDark={isDark} />
      ) : (
        <div className={`${cardClass} px-6 py-12 text-center`}>
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-v-accent-soft text-v-accent"><FolderOpen size={20} /></span>
          <p className="mt-3 text-sm font-semibold text-v-text">{L('Select a child', 'Selecciona a tu hijo/a')}</p>
          <p className="mt-1 text-xs text-v-muted">{L('To see their documents.', 'Para ver sus documentos.')}</p>
        </div>
      )}

      <AnimatePresence>
        {activeForm && <ParentFormRenderer form={activeForm} onSubmit={r => handleSubmitForm(activeForm.id, r)} onClose={() => setActiveForm(null)} />}
      </AnimatePresence>
    </div>
  )
}

export default ParentFormsResourcesView
