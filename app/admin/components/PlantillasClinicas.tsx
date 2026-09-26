'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useI18n } from '@/lib/i18n-context'
import {
  Plus, Trash2, Edit2, Save, X, ChevronDown, ChevronUp,
  Loader2, FileText, ArrowLeft, Eye, LayoutTemplate, Calendar, User, Stethoscope, Lock, Check, FileDown,
  Type, AlignLeft, ListChecks, CircleDot, Hash, CheckSquare, Layers
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { useTheme } from '@/components/ThemeContext'
import { confirmar } from '@/components/ui/confirmar'

// ── Types ────────────────────────────────────────────────────────────────────
interface Field {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'radio' | 'date' | 'number' | 'checkbox'
  required: boolean
  placeholder?: string
  options?: string[]
  section?: string
}

interface Section {
  id: string
  title: string
  description?: string
}

interface Template {
  id: string
  name: string
  description: string | null
  category: string
  fields: Field[]
  sections?: Section[]
  is_active: boolean
  is_default: boolean
  created_at: string
}

interface TemplateResponse {
  id: string
  template_id: string
  child_id: string
  filled_by: string
  filler_name: string
  filler_role: string
  responses: Record<string, any>
  notes: string | null
  created_at: string
  clinical_templates?: { name: string; fields: Field[]; sections?: Section[] }
}

const FIELD_TYPES = [
  { id: 'text',     label: 'Texto corto', labelEn: 'Short text' },
  { id: 'textarea', label: 'Texto largo', labelEn: 'Long text' },
  { id: 'select',   label: 'Lista', labelEn: 'Dropdown' },
  { id: 'radio',    label: 'Opción única', labelEn: 'Single choice' },
  { id: 'date',     label: 'Fecha', labelEn: 'Date' },
  { id: 'number',   label: 'Número', labelEn: 'Number' },
  { id: 'checkbox', label: 'Casilla', labelEn: 'Checkbox' },
]

const CATEGORIES = [
  { id: 'historia_clinica',   label: 'Historia Clínica', labelEn: 'Clinical History' },
  { id: 'motivo_consulta',    label: 'Motivo de Consulta', labelEn: 'Reason for Consultation' },
  { id: 'seguimiento',        label: 'Seguimiento', labelEn: 'Follow-up' },
  { id: 'evaluacion_inicial', label: 'Evaluación Inicial', labelEn: 'Initial Evaluation' },
  { id: 'otro',               label: 'Otro', labelEn: 'Other' },
]

function uid() { return `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }

// ══════════════════════════════════════════════════════════════════════════════
// GESTOR DE PLANTILLAS — para Admin/Jefe
// ══════════════════════════════════════════════════════════════════════════════
export function GestorPlantillas({ isDark: isDarkProp }: { isDark?: boolean }) {
  const { t: tr, locale } = useI18n()
  const { isDark: isDarkCtx } = useTheme()
  const isDark = isDarkProp ?? isDarkCtx
  const toast = useToast()

  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState<'list' | 'create' | 'edit'>('list')
  const [editing, setEditing]     = useState<Template | null>(null)

  const cc = {
    card: 'bg-v-elevated border-v-border',
    txt1: 'text-v-text',
    txt3: 'text-v-subtle',
    hover: 'hover:bg-v-fill',
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('clinical_templates').select('*').order('created_at')
    setTemplates(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const deleteTemplate = async (id: string) => {
    if (!await confirmar(tr('auto.plantillasClinicas.eliminarEstaFichaEstaAccion'))) return
    await supabase.from('clinical_templates').delete().eq('id', id)
    toast.success(tr('auto.plantillasClinicas.fichaEliminada'))
    load()
  }

  const toggleActive = async (t: Template) => {
    await supabase.from('clinical_templates').update({ is_active: !t.is_active }).eq('id', t.id)
    setTemplates(prev => prev.map(tp => tp.id === t.id ? { ...tp, is_active: !tp.is_active } : tp))
    toast.success(t.is_active ? (locale === 'en' ? 'Form deactivated' : 'Ficha desactivada') : (locale === 'en' ? 'Form activated' : 'Ficha activada'))
  }

  if (view === 'create' || view === 'edit') {
    return (
      <FormBuilder
        isDark={isDark}
        template={editing || undefined}
        onSave={() => { setView('list'); setEditing(null); load() }}
        onCancel={() => { setView('list'); setEditing(null) }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className={`flex items-center gap-2.5 text-lg font-semibold tracking-tight ${cc.txt1}`}>
            <span className="grid size-9 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><LayoutTemplate size={17} /></span>
            {locale === 'en' ? 'Clinical Forms' : 'Fichas Clínicas'}
          </h3>
          <p className={`mt-1 text-sm ${cc.txt3}`}>{tr("admin.creaGestionaModelos")}</p>
        </div>
        <button onClick={() => { setEditing(null); setView('create') }}
          className="v-brand inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold sm:px-5">
          <Plus size={15} /> {locale === 'en' ? 'New form' : 'Nueva ficha'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-v-accent" /></div>
      ) : templates.length === 0 ? (
        <div className={`${cc.card} border rounded-v p-12 text-center`}>
          <LayoutTemplate size={40} className={`mx-auto mb-3 ${cc.txt3}`} />
          <p className={`font-bold text-sm ${cc.txt3}`}>{tr("admin.sinFichasCreadas")}</p>
          <p className={`text-xs mt-1 ${cc.txt3} opacity-60`}>{tr("admin.creaPrimeraFicha")}</p>
          <button onClick={() => setView('create')}
            className="v-brand mt-4 inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold">
            <Plus size={15} /> {locale === 'en' ? 'Create first form' : 'Crear primera ficha'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}
              className={`group ${cc.card} border rounded-v shadow-v transition-shadow hover:shadow-v-lg ${t.is_active ? '' : 'opacity-70'}`}>
              <div className="flex flex-wrap items-start gap-3 p-4 sm:flex-nowrap sm:items-center sm:gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent transition-transform group-hover:-rotate-6 group-hover:scale-105">
                  <FileText size={19} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-[15px] font-semibold tracking-tight ${cc.txt1}`}>{t.name}</p>
                    {t.is_default && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-v-accent-soft text-v-accent">{tr("admin.sistema")}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.is_active ? 'bg-v-success/15 text-v-success' : 'bg-v-fill text-v-subtle'}`}>
                      {t.is_active ? (locale === 'en' ? 'Active' : 'Activa') : (locale === 'en' ? 'Inactive' : 'Inactiva')}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${'bg-v-fill text-v-muted'}`}>
                      {(() => { const _c = CATEGORIES.find(c => c.id === t.category); return _c ? (locale === 'en' ? _c.labelEn : _c.label) : t.category })()}
                    </span>
                  </div>
                  {t.description && <p className={`text-xs mt-0.5 ${cc.txt3}`}>{t.description}</p>}
                  <p className={`text-[10px] mt-0.5 ${'text-v-subtle'}`}>
                    {t.fields?.length || 0} {locale === 'en' ? ((t.fields?.length || 0) !== 1 ? 'fields' : 'field') : ('campo' + ((t.fields?.length || 0) !== 1 ? 's' : ''))}
                    {t.sections?.length ? ` · ${t.sections.length} ${locale === 'en' ? (t.sections.length !== 1 ? 'sections' : 'section') : ('secci' + (t.sections.length !== 1 ? 'ones' : 'ón'))}` : ''}
                  </p>
                </div>
                <div className="ml-auto flex w-full shrink-0 items-center justify-end gap-1 border-t border-v-border pt-2 sm:ml-0 sm:w-auto sm:border-0 sm:pt-0">
                  <button onClick={() => toggleActive(t)} role="switch" aria-checked={t.is_active}
                    title={t.is_active ? (locale === 'en' ? 'Deactivate' : 'Desactivar') : (locale === 'en' ? 'Activate' : 'Activar')}
                    className={`relative mr-1 h-6 w-10 shrink-0 rounded-full transition-colors ${t.is_active ? 'bg-v-success' : 'bg-v-border'}`}>
                    <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      className={`absolute top-0.5 size-5 rounded-full bg-white shadow ${t.is_active ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                  <button onClick={() => { setEditing(t); setView('edit') }} title={locale === 'en' ? 'Edit' : 'Editar'}
                    className="grid size-9 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-accent-soft hover:text-v-accent">
                    <Edit2 size={15} />
                  </button>
                  {!t.is_default && (
                    <button onClick={() => deleteTemplate(t.id)} title={locale === 'en' ? 'Delete' : 'Eliminar'}
                      className="grid size-9 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-danger/10 hover:text-v-danger">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// FORM BUILDER — constructor estilo Google Forms
// ══════════════════════════════════════════════════════════════════════════════
function FormBuilder({ isDark, template, onSave, onCancel }: {
  isDark: boolean; template?: Template; onSave: () => void; onCancel: () => void
}) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const [name, setName]         = useState(template?.name || '')
  const [desc, setDesc]         = useState(template?.description || '')
  const [category, setCategory] = useState(template?.category || 'historia_clinica')
  const [sections, setSections] = useState<Section[]>(template?.sections || [])
  const [fields, setFields]     = useState<Field[]>(template?.fields || [])
  const [saving, setSaving]     = useState(false)
  const [preview, setPreview]   = useState(false)

  const cc = {
    card:  'bg-v-elevated border-v-border',
    muted: 'bg-v-fill border-v-border',
    txt1:  'text-v-text',
    txt3:  'text-v-subtle',
    input: 'bg-v-bg border-v-border text-v-text placeholder:text-v-subtle focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft',
  }
  const inputCls = `w-full px-3.5 py-2.5 rounded-v-sm text-sm border outline-none transition-shadow ${cc.input}`

  const addSection = () => setSections(prev => [...prev, { id: uid(), title: locale === 'en' ? 'New section' : 'Nueva sección', description: '' }])
  const updateSection = (id: string, patch: Partial<Section>) => setSections(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  const removeSection = (id: string) => { setSections(prev => prev.filter(s => s.id !== id)); setFields(prev => prev.map(f => f.section === id ? { ...f, section: undefined } : f)) }
  const addField = (sectionId?: string, type: Field['type'] = 'text') => setFields(prev => [...prev, { id: uid(), label: '', type, required: false, placeholder: '', section: sectionId, options: ['select', 'radio'].includes(type) ? [''] : undefined }])
  const updateField = (id: string, patch: Partial<Field>) => setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))
  const removeField = (id: string) => setFields(prev => prev.filter(f => f.id !== id))
  const moveField = (id: string, dir: -1 | 1) => {
    const arr = [...fields]; const idx = arr.findIndex(f => f.id === id); const target = idx + dir
    if (target < 0 || target >= arr.length) return
    ;[arr[idx], arr[target]] = [arr[target], arr[idx]]; setFields(arr)
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error(t('auto.plantillasClinicas.elNombreEsObligatorio')); return }
    const valid = fields.filter(f => f.label.trim())
    if (valid.length === 0) { toast.error(locale === 'en' ? 'Add at least one field' : 'Agrega al menos un campo'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = { name: name.trim(), description: desc.trim() || null, category, fields: valid, sections, is_active: true, updated_at: new Date().toISOString() }
      if (template?.id) {
        const { error } = await supabase.from('clinical_templates').update(payload).eq('id', template.id)
        if (error) throw error
        toast.success(t('auto.plantillasClinicas.fichaActualizada'))
      } else {
        const { error } = await supabase.from('clinical_templates').insert({ ...payload, created_by: user?.id })
        if (error) throw error
        toast.success(t('auto.plantillasClinicas.fichaCreada'))
      }
      onSave()
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  if (preview) return <FormPreview name={name} desc={desc} sections={sections} fields={fields} isDark={isDark} onBack={() => setPreview(false)} />

  const unsectioned = fields.filter(f => !f.section)
  const bySection = (sid: string) => fields.filter(f => f.section === sid)

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-[1_1_240px] items-center gap-3">
        <button onClick={onCancel} className="grid size-9 shrink-0 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-fill hover:text-v-text">
          <ArrowLeft size={17} />
        </button>
        <span className="v-brand grid size-10 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><LayoutTemplate size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className={`text-base font-semibold leading-tight tracking-tight sm:text-lg ${cc.txt1}`}>{template ? (locale === 'en' ? 'Edit form' : 'Editar ficha') : (locale === 'en' ? 'New clinical form' : 'Nueva ficha clínica')}</p>
          <p className={`text-xs ${cc.txt3}`}>{t("admin.disenaFormulario")}</p>
        </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
        <button onClick={() => setPreview(true)}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-v-border bg-v-elevated px-4 text-sm font-semibold text-v-muted shadow-v transition-colors hover:text-v-accent sm:flex-none">
          <Eye size={15} /> {locale === 'en' ? 'Preview' : 'Vista previa'}
        </button>
        <button onClick={handleSave} disabled={saving}
          className="v-brand inline-flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-5 text-sm font-semibold disabled:opacity-50 sm:flex-none">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? (locale === 'en' ? 'Saving...' : 'Guardando...') : (locale === 'en' ? 'Save form' : 'Guardar ficha')}
        </button>
        </div>
      </div>

      {/* Datos básicos */}
      <div className={`${cc.card} relative overflow-hidden border rounded-v p-4 shadow-v sm:p-6`}>
        <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-1" />
        <GrowText value={name} onChange={setName} placeholder={t("admin.phNombreFicha")}
          className="border-b border-transparent pb-1 text-xl font-semibold tracking-tight text-v-text transition-colors placeholder:text-v-subtle/70 focus:border-v-accent sm:text-2xl" />
        <GrowText value={desc} onChange={setDesc} placeholder={t("admin.phParaQueFicha")}
          className="mt-2 border-b border-transparent pb-1 text-sm text-v-muted transition-colors placeholder:text-v-subtle focus:border-v-accent" />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-v-subtle">{t("common.categoria")}:</span>
          {CATEGORIES.map(cat => {
            const on = category === cat.id
            return (
              <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${on ? 'bg-v-accent-soft text-v-accent ring-1 ring-v-accent/40' : 'bg-v-fill text-v-muted hover:text-v-text'}`}>
                {locale === 'en' ? cat.labelEn : cat.label}
              </button>
            )
          })}
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-v-subtle">
          <Lock size={11} /> {locale === 'en' ? 'Date, patient and specialist are added automatically to every form.' : 'Fecha, paciente y especialista se agregan solos a cada ficha.'}
        </p>
      </div>

      {/* Preguntas generales (sin sección) */}
      <BuilderBlock
        title={locale === 'en' ? 'General questions' : 'Preguntas generales'}
        subtitle={locale === 'en' ? 'Shown at the top of the form' : 'Aparecen al inicio de la ficha'}
        count={unsectioned.length}
        onAdd={type => addField(undefined, type)}>
        {unsectioned.map((field, i) => (
          <FieldEditor key={field.id} index={i + 1} field={field} isDark={isDark}
            onChange={p => updateField(field.id, p)}
            onDelete={() => removeField(field.id)}
            onMoveUp={() => moveField(field.id, -1)}
            onMoveDown={() => moveField(field.id, 1)} />
        ))}
      </BuilderBlock>

      {/* Secciones */}
      {sections.map((section, si) => (
        <BuilderBlock key={section.id}
          badge={`${locale === 'en' ? 'Section' : 'Sección'} ${si + 1}`}
          titleInput={
            <GrowText value={section.title} onChange={v => updateSection(section.id, { title: v })} placeholder={t("admin.phTituloSeccion")}
              className="border-b border-transparent pb-0.5 text-base font-semibold tracking-tight text-v-text transition-colors placeholder:text-v-subtle focus:border-v-accent sm:text-lg" />
          }
          subtitleInput={
            <GrowText value={section.description || ''} onChange={v => updateSection(section.id, { description: v })} placeholder={t("admin.phDescSeccion")}
              className="border-b border-transparent pb-0.5 text-sm text-v-muted transition-colors placeholder:text-v-subtle focus:border-v-accent" />
          }
          count={bySection(section.id).length}
          onAdd={type => addField(section.id, type)}
          onRemove={() => removeSection(section.id)}>
          {bySection(section.id).map((field, i) => (
            <FieldEditor key={field.id} index={i + 1} field={field} isDark={isDark}
              onChange={p => updateField(field.id, p)}
              onDelete={() => removeField(field.id)}
              onMoveUp={() => moveField(field.id, -1)}
              onMoveDown={() => moveField(field.id, 1)} />
          ))}
        </BuilderBlock>
      ))}

      {/* Agregar sección */}
      <button onClick={addSection}
        className="flex w-full items-center justify-center gap-1.5 rounded-v border border-dashed border-v-border py-4 text-sm font-semibold text-v-subtle transition-colors hover:border-v-accent/40 hover:bg-v-accent-soft hover:text-v-accent">
        <Layers size={15} /> {locale === 'en' ? 'Add section' : 'Agregar sección'}
      </button>
    </div>
  )
}

// Campo de texto sin caja que crece con el contenido (en celular el texto largo baja de línea, no se corta).
function GrowText({ value, onChange, placeholder, className = '' }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea ref={ref} rows={1} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value.replace(/\n/g, ' '))}
      onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
      className={`block w-full resize-none overflow-hidden bg-transparent leading-snug outline-none ${className}`} />
  )
}

// ── Bloque del constructor (preguntas generales o una sección) ─────────────────
const FIELD_ICON: Record<string, any> = {
  text: Type, textarea: AlignLeft, select: ListChecks, radio: CircleDot, date: Calendar, number: Hash, checkbox: CheckSquare,
}

function BuilderBlock({ title, subtitle, badge, titleInput, subtitleInput, count, onAdd, onRemove, children }: {
  title?: string; subtitle?: string; badge?: string; titleInput?: React.ReactNode; subtitleInput?: React.ReactNode
  count: number; onAdd: (type: Field['type']) => void; onRemove?: () => void; children: React.ReactNode
}) {
  const { locale } = useI18n()
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v">
      <div className="flex flex-wrap items-start gap-2 border-b border-v-border px-4 py-4 sm:flex-nowrap sm:gap-3 sm:px-5">
        <div className="min-w-0 flex-[1_1_220px] space-y-1">
          {badge && <span className="inline-flex rounded-full bg-v-accent-soft px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-v-accent">{badge}</span>}
          {titleInput ?? <p className="text-[15px] font-semibold tracking-tight text-v-text">{title}</p>}
          {subtitleInput ?? (subtitle && <p className="text-xs text-v-subtle">{subtitle}</p>)}
        </div>
        <span className="mt-1 shrink-0 rounded-full bg-v-fill px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-v-muted">
          {count} {locale === 'en' ? (count === 1 ? 'question' : 'questions') : (count === 1 ? 'pregunta' : 'preguntas')}
        </span>
        {onRemove && (
          <button onClick={onRemove} title={locale === 'en' ? 'Delete section' : 'Eliminar sección'}
            className="grid size-8 shrink-0 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-danger/10 hover:text-v-danger">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div className="space-y-3 bg-v-bg p-4">
        <AnimatePresence initial={false}>{children}</AnimatePresence>
        {/* Añadir pregunta por tipo, con un toque */}
        <div className={`rounded-v-sm border border-dashed border-v-border p-3 ${count === 0 ? 'py-5 text-center' : ''}`}>
          {count === 0 && <p className="mb-3 text-sm text-v-subtle">{locale === 'en' ? 'No questions yet — pick a type to add one:' : 'Sin preguntas todavía — elige un tipo para agregar:'}</p>}
          <div className={`flex flex-wrap gap-1.5 ${count === 0 ? 'justify-center' : ''}`}>
            {count > 0 && <span className="mr-1 self-center text-xs font-medium text-v-subtle">{locale === 'en' ? 'Add:' : 'Agregar:'}</span>}
            {FIELD_TYPES.map(ft => {
              const Icon = FIELD_ICON[ft.id]
              return (
                <button key={ft.id} type="button" onClick={() => onAdd(ft.id as Field['type'])}
                  className="inline-flex items-center gap-1.5 rounded-full border border-v-border bg-v-elevated px-3 py-1.5 text-xs font-semibold text-v-muted transition-colors hover:border-v-accent/40 hover:bg-v-accent-soft hover:text-v-accent">
                  <Icon size={13} /> {locale === 'en' ? ft.labelEn : ft.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Field Editor ──────────────────────────────────────────────────────────────
function FieldTypeMenu({ value, onChange }: { value: Field['type']; onChange: (t: Field['type']) => void }) {
  const { locale } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  const cur = FIELD_TYPES.find(f => f.id === value) ?? FIELD_TYPES[0]
  const CurIcon = FIELD_ICON[cur.id]
  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-v-border bg-v-elevated pl-3 pr-2 text-xs font-semibold text-v-text transition-colors hover:border-v-accent/40">
        <CurIcon size={14} className="text-v-accent" /> {locale === 'en' ? cur.labelEn : cur.label}
        <ChevronDown size={13} className={`text-v-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={{ duration: 0.14 }}
            className="absolute right-0 top-full z-40 mt-1.5 w-48 origin-top-right rounded-v-sm border border-v-border bg-v-elevated p-1 shadow-v-lg">
            {FIELD_TYPES.map(ft => {
              const Icon = FIELD_ICON[ft.id]
              const on = ft.id === value
              return (
                <button key={ft.id} type="button" onClick={() => { setOpen(false); onChange(ft.id as Field['type']) }}
                  className={`flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-sm transition-colors ${on ? 'bg-v-accent-soft font-semibold text-v-accent' : 'text-v-muted hover:bg-v-fill hover:text-v-text'}`}>
                  <Icon size={15} /> <span className="flex-1">{locale === 'en' ? ft.labelEn : ft.label}</span>
                  {on && <Check size={14} />}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FieldEditor({ field, index, onChange, onDelete, onMoveUp, onMoveDown }: {
  field: Field; index?: number; isDark: boolean
  onChange: (p: Partial<Field>) => void
  onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void
}) {
  const { t, locale } = useI18n()
  const hasOptions = ['select', 'radio'].includes(field.type)
  const preview: Record<string, string> = locale === 'en'
    ? { text: 'Short answer', textarea: 'Long answer', number: 'Number', date: 'dd/mm/yyyy', checkbox: 'Yes / No' }
    : { text: 'Respuesta corta', textarea: 'Respuesta larga', number: 'Número', date: 'dd/mm/aaaa', checkbox: 'Sí / No' }

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
      className="group rounded-v-sm border border-v-border bg-v-elevated shadow-v transition-shadow focus-within:border-v-accent/50 focus-within:ring-4 focus-within:ring-v-accent-soft">
      <div className="flex items-start gap-2.5 p-3 pb-3 sm:gap-3 sm:p-4">
        <div className="flex shrink-0 flex-col items-center gap-0.5 pt-1">
          <button onClick={onMoveUp} title={locale === 'en' ? 'Move up' : 'Subir'} className="grid size-5 place-items-center rounded text-v-subtle opacity-40 transition-opacity hover:bg-v-fill hover:text-v-accent group-hover:opacity-100"><ChevronUp size={13} /></button>
          <span className="grid size-6 place-items-center rounded-full bg-v-accent-soft text-[11px] font-bold text-v-accent">{index}</span>
          <button onClick={onMoveDown} title={locale === 'en' ? 'Move down' : 'Bajar'} className="grid size-5 place-items-center rounded text-v-subtle opacity-40 transition-opacity hover:bg-v-fill hover:text-v-accent group-hover:opacity-100"><ChevronDown size={13} /></button>
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-start gap-2">
            <GrowText value={field.label} onChange={v => onChange({ label: v })} placeholder={t("admin.phPreguntaCampo")}
              className="flex-[1_1_220px] border-b border-v-border pb-1.5 text-[15px] font-semibold text-v-text transition-colors placeholder:font-normal placeholder:text-v-subtle focus:border-v-accent" />
            <FieldTypeMenu value={field.type} onChange={newType => onChange({
              type: newType,
              options: ['select', 'radio'].includes(newType) && (!field.options || field.options.length === 0) ? [''] : field.options,
            })} />
          </div>

          {['text', 'textarea', 'number'].includes(field.type) && (
            <GrowText value={field.placeholder || ''} onChange={v => onChange({ placeholder: v })} placeholder={t("admin.phTextoAyuda")}
              className="text-xs text-v-muted placeholder:text-v-subtle" />
          )}

          {/* Vista de cómo se responde */}
          {!hasOptions && (
            <div className={`flex gap-2 rounded-v-sm border border-dashed border-v-border px-3 py-2 text-xs text-v-subtle ${field.type === 'textarea' ? 'min-h-14 items-start' : 'min-h-9 items-center'}`}>
              {(() => { const I = FIELD_ICON[field.type]; return <I size={12} className="mt-0.5 shrink-0" /> })()}
              <span className="line-clamp-3 min-w-0 [overflow-wrap:anywhere]">{field.type === 'checkbox' ? (field.placeholder || preview.checkbox) : (field.placeholder || preview[field.type])}</span>
            </div>
          )}

          {hasOptions && (
            <div className="space-y-1.5">
              {(field.options || []).map((opt, idx) => (
                <div key={idx} className="group/opt flex items-center gap-2">
                  {field.type === 'radio'
                    ? <span className="size-4 shrink-0 rounded-full border-2 border-v-border" />
                    : <span className="w-4 shrink-0 text-right text-xs tabular-nums text-v-subtle">{idx + 1}.</span>}
                  <input value={opt}
                    onChange={e => { const n = [...(field.options || [])]; n[idx] = e.target.value; onChange({ options: n }) }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); onChange({ options: [...(field.options || []), ''] }) }
                      if (e.key === 'Backspace' && opt === '' && (field.options || []).length > 1) onChange({ options: (field.options || []).filter((_, i) => i !== idx) })
                    }}
                    placeholder={locale === 'en' ? `Option ${idx + 1}` : `Opción ${idx + 1}`}
                    autoFocus={idx === (field.options || []).length - 1 && opt === ''}
                    className="flex-1 border-b border-transparent bg-transparent py-1 text-sm text-v-text outline-none transition-colors placeholder:text-v-subtle hover:border-v-border focus:border-v-accent" />
                  <button onClick={() => { const n = (field.options || []).filter((_, i) => i !== idx); onChange({ options: n.length > 0 ? n : [''] }) }}
                    className="grid size-6 place-items-center rounded-full text-v-subtle opacity-0 transition-opacity hover:bg-v-danger/10 hover:text-v-danger group-hover/opt:opacity-100">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button onClick={() => onChange({ options: [...(field.options || []), ''] })}
                className="ml-6 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-v-accent transition-colors hover:bg-v-accent-soft">
                <Plus size={12} /> {locale === 'en' ? 'Add option' : 'Añadir opción'}
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-v-border px-4 py-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-v-muted" title={t("admin.campoObligatorio")}>
          {locale === 'en' ? 'Required' : 'Obligatorio'}
          <button type="button" role="switch" aria-checked={field.required} onClick={() => onChange({ required: !field.required })}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${field.required ? 'bg-v-accent' : 'bg-v-border'}`}>
            <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              className={`absolute top-0.5 size-4 rounded-full bg-white shadow ${field.required ? 'right-0.5' : 'left-0.5'}`} />
          </button>
        </label>
        <span className="h-5 w-px bg-v-border" />
        <button onClick={onDelete} title={locale === 'en' ? 'Delete question' : 'Eliminar pregunta'}
          className="grid size-8 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-danger/10 hover:text-v-danger">
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  )
}

// ── Form Preview ──────────────────────────────────────────────────────────────
function FormPreview({ name, desc, sections, fields, isDark, onBack }: {
  name: string; desc: string; sections: Section[]; fields: Field[]; isDark: boolean; onBack: () => void
}) {
  const { t, locale } = useI18n()
  const cc = {
    card:  'bg-v-elevated border-v-border',
    txt1:  'text-v-text',
    txt3:  'text-v-subtle',
    input: 'bg-v-fill border-v-border text-v-muted',
  }
  const renderField = (f: Field) => (
    <div key={f.id}>
      <label className={`block text-xs font-bold mb-1.5 ${'text-v-muted'}`}>
        {f.label || (locale === 'en' ? '(No name)' : '(Sin nombre)')} {f.required && <span className="text-v-danger">*</span>}
      </label>
      {f.type === 'textarea' && <textarea rows={3} disabled placeholder={f.placeholder} className={`w-full px-3 py-2 rounded-v-sm text-sm border resize-none opacity-70 ${cc.input}`} />}
      {f.type === 'text' && <input type="text" disabled placeholder={f.placeholder} className={`w-full px-3 py-2 rounded-v-sm text-sm border opacity-70 ${cc.input}`} />}
      {f.type === 'number' && <input type="number" disabled className={`w-full px-3 py-2 rounded-v-sm text-sm border opacity-70 ${cc.input}`} />}
      {f.type === 'date' && <input type="date" disabled className={`w-full px-3 py-2 rounded-v-sm text-sm border opacity-70 ${cc.input}`} />}
      {f.type === 'select' && (
        <select disabled className={`w-full px-3 py-2 rounded-v-sm text-sm border opacity-70 ${cc.input}`}>
          <option>{t("common.seleccionar")}</option>
          {(f.options || []).map(o => <option key={o}>{o}</option>)}
        </select>
      )}
      {f.type === 'radio' && (
        <div className="flex flex-wrap gap-2">
          {(f.options || []).map(o => (
            <label key={o} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-v-sm text-xs border opacity-70 ${'border-v-border text-v-muted'}`}>
              <input type="radio" disabled /> {o}
            </label>
          ))}
        </div>
      )}
      {f.type === 'checkbox' && (
        <label className={`flex items-center gap-2 text-sm opacity-70 ${cc.txt1}`}>
          <input type="checkbox" disabled /> {f.placeholder || 'Sí'}
        </label>
      )}
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className={`p-2 rounded-v-sm ${'hover:bg-v-fill'}`}>
          <ArrowLeft size={16} className={cc.txt3} />
        </button>
        <p className={`font-bold text-sm ${cc.txt1}`}>{t("admin.vistaPreviaFicha")}</p>
      </div>
      <div className={`${cc.card} border rounded-v p-6 space-y-5`}>
        <div className={`pb-4 border-b ${'border-v-border'}`}>
          <p className={`font-bold text-lg ${cc.txt1}`}>{name || (locale === 'en' ? '(No name)' : '(Sin nombre)')}</p>
          {desc && <p className={`text-sm mt-1 ${cc.txt3}`}>{desc}</p>}
        </div>
        {fields.filter(f => !f.section).length > 0 && (
          <div className="space-y-4">{fields.filter(f => !f.section).map(renderField)}</div>
        )}
        {sections.map(section => {
          const sf = fields.filter(f => f.section === section.id)
          return (
            <div key={section.id} className={`rounded-v-sm p-4 border ${'bg-v-fill border-v-border'}`}>
              <p className={`font-bold text-sm mb-0.5 ${cc.txt1}`}>{section.title}</p>
              {section.description && <p className={`text-xs mb-3 ${cc.txt3}`}>{section.description}</p>}
              <div className="space-y-4">{sf.map(renderField)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// RELLENAR FICHA — para especialistas/terapeutas
// ══════════════════════════════════════════════════════════════════════════════
export function RellenarFicha({
  childId, childName, isDark: isDarkProp = false, onSaved
}: {
  childId: string; childName: string; isDark?: boolean; onSaved?: (responseId: string) => void
}) {
  const { t, locale } = useI18n()
  const { isDark: isDarkCtx } = useTheme()
  const isDark = isDarkProp ?? isDarkCtx
  const toast = useToast()

  const [templates, setTemplates]     = useState<Template[]>([])
  const [responses, setResponses]     = useState<TemplateResponse[]>([])
  const [selected, setSelected]       = useState<Template | null>(null)
  const [answers, setAnswers]         = useState<Record<string, any>>({})
  const [notes, setNotes]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [loading, setLoading]         = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ full_name: string; role: string } | null>(null)

  // Cargar perfil del especialista actual para mostrarlo en el header de la ficha
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', user.id)
          .maybeSingle()
        if (profile) setCurrentUser(profile as any)
      } catch { /* silencioso */ }
    })()
  }, [])

  const roleLabel = (r?: string) => {
    const map: Record<string, string> = locale === 'en'
      ? { jefe: 'Director', admin: 'Administrator', especialista: 'Specialist', terapeuta: 'Therapist', secretaria: 'Front desk' }
      : { jefe: 'Director(a)', admin: 'Administrador(a)', especialista: 'Especialista', terapeuta: 'Terapeuta', secretaria: 'Secretaría' }
    return map[r || ''] || r || (locale === 'en' ? 'Professional' : 'Profesional')
  }

  const fechaHoyFmt = new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const cc = {
    card:  'bg-v-elevated border-v-border',
    txt1:  'text-v-text',
    txt3:  'text-v-subtle',
    input: 'bg-v-bg border-v-border text-v-text placeholder:text-v-subtle focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft',
  }
  const inputCls = `w-full px-3.5 py-2.5 rounded-v-sm text-sm border outline-none transition-shadow ${cc.input}`

  const loadData = useCallback(async () => {
    const [{ data: tmpl }, { data: resp }] = await Promise.all([
      supabase.from('clinical_templates').select('*').eq('is_active', true).order('name'),
      supabase.from('clinical_template_responses')
        .select('*, clinical_templates(name,fields,sections)')
        .eq('child_id', childId)
        .order('created_at', { ascending: false }),
    ])
    setTemplates(tmpl || [])
    setResponses(resp || [])
    setLoading(false)
  }, [childId])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async () => {
    if (!selected) return
    const missing = selected.fields.filter(f => f.required && !answers[f.id] && answers[f.id] !== false)
    if (missing.length > 0) { toast.error(`Obligatorios: ${missing.map(f => f.label).join(', ')}`); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('full_name,role').eq('id', user!.id).single()
      const { data: inserted, error } = await supabase.from('clinical_template_responses').insert({
        template_id: selected.id, child_id: childId, filled_by: user!.id,
        filler_role: profile?.role || 'especialista', filler_name: profile?.full_name || 'Clínico',
        responses: answers, notes: notes.trim() || null,
      }).select('id').single()
      if (error) throw error
      toast.success(locale === 'en' ? 'Form saved' : 'Ficha guardada')
      // Actualizar el resumen clínico persistente del paciente de forma incremental.
      try {
        const nuevo = `${locale === 'en' ? 'New clinical form' : 'Nueva ficha clínica'} (${new Date().toLocaleDateString('es-PE')}): ${selected.name}\n${JSON.stringify(answers).slice(0, 1500)}${notes.trim() ? `\nNotas: ${notes.trim()}` : ''}`
        fetch('/api/patient-ai-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-locale': locale },
          body: JSON.stringify({ childId, action: 'update', newContent: nuevo, locale }),
        }).catch(() => {})
      } catch { /* no crítico */ }
      setAnswers({}); setNotes(''); setSelected(null)
      if (inserted?.id) onSaved?.(inserted.id)
      loadData()
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  const renderField = (field: Field) => (
    <div key={field.id}>
      <label className={`block text-xs font-bold mb-1.5 ${'text-v-muted'}`}>
        {field.label} {field.required && <span className="text-v-danger">*</span>}
      </label>
      {field.type === 'textarea' && <textarea rows={3} value={answers[field.id] || ''} placeholder={field.placeholder} onChange={e => setAnswers(p => ({ ...p, [field.id]: e.target.value }))} className={`${inputCls} resize-none`} />}
      {field.type === 'text'     && <input type="text"   value={answers[field.id] || ''} placeholder={field.placeholder} onChange={e => setAnswers(p => ({ ...p, [field.id]: e.target.value }))} className={inputCls} />}
      {field.type === 'number'   && <input type="number" value={answers[field.id] || ''} placeholder={field.placeholder} onChange={e => setAnswers(p => ({ ...p, [field.id]: e.target.value }))} className={inputCls} />}
      {field.type === 'date'     && <input type="date"   value={answers[field.id] || ''} onChange={e => setAnswers(p => ({ ...p, [field.id]: e.target.value }))} className={inputCls} />}
      {field.type === 'select'   && (
        <select value={answers[field.id] || ''} onChange={e => setAnswers(p => ({ ...p, [field.id]: e.target.value }))} className={`${inputCls} cursor-pointer`}>
          <option value="">{t("common.seleccionar")}</option>
          {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {field.type === 'radio' && (
        <div className="flex flex-wrap gap-2">
          {(field.options || []).map(o => (
            <button key={o} type="button" onClick={() => setAnswers(p => ({ ...p, [field.id]: o }))}
              className={`inline-flex items-center gap-2 rounded-v-sm border px-3.5 py-2 text-sm transition-all
                ${answers[field.id] === o ? 'border-v-accent/50 bg-v-accent-soft font-semibold text-v-accent ring-4 ring-v-accent-soft' : 'border-v-border bg-v-elevated text-v-muted hover:border-v-accent/30 hover:text-v-text'}`}>
              <span className={`grid size-4 place-items-center rounded-full border ${answers[field.id] === o ? 'border-transparent bg-v-accent text-white' : 'border-v-border'}`}>
                {answers[field.id] === o && <Check size={10} />}
              </span>
              {o}
            </button>
          ))}
        </div>
      )}
      {field.type === 'checkbox' && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!answers[field.id]} onChange={e => setAnswers(p => ({ ...p, [field.id]: e.target.checked }))} />
          <span className={`text-sm ${cc.txt1}`}>{field.placeholder || 'Sí'}</span>
        </label>
      )}
    </div>
  )

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-v-accent" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className={`flex items-center gap-2.5 text-lg font-semibold tracking-tight ${cc.txt1}`}>
            <span className="grid size-9 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><FileText size={17} /></span>
            {locale === 'en' ? 'Clinical Forms' : 'Fichas Clínicas'}
          </h3>
          <p className={`mt-1 text-sm ${cc.txt3}`}>{selected ? selected.name : (locale === 'en' ? `Forms of ${childName}` : `Fichas de ${childName}`)}</p>
        </div>
        {!selected && (
          <button onClick={() => setShowHistory(!showHistory)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-v-border bg-v-elevated px-4 text-xs font-semibold text-v-muted shadow-v transition-colors hover:text-v-accent">
            {showHistory ? (locale === 'en' ? 'New form' : 'Nueva ficha') : (locale === 'en' ? `History (${responses.length})` : `Historial (${responses.length})`)}
          </button>
        )}
        {selected && (
          <button onClick={() => { setSelected(null); setAnswers({}) }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-v-border bg-v-elevated px-4 text-xs font-semibold text-v-muted shadow-v transition-colors hover:text-v-accent">
            <ArrowLeft size={13} /> {locale === 'en' ? 'Change form' : 'Cambiar ficha'}
          </button>
        )}
      </div>

      {/* Historial */}
      {!selected && showHistory && (
        <div className="space-y-3">
          {responses.length === 0 ? (
            <div className={`${cc.card} border rounded-v p-8 text-center`}>
              <FileText size={28} className={`mx-auto mb-2 ${cc.txt3}`} />
              <p className={`text-sm font-bold ${cc.txt3}`}>{t("admin.sinFichasRegistradas")}</p>
            </div>
          ) : responses.map(r => <ResponseCard key={r.id} response={r} isDark={isDark} />)}
        </div>
      )}

      {/* Selector de plantilla */}
      {!selected && !showHistory && (
        templates.length === 0 ? (
          <div className={`${cc.card} border rounded-v p-10 text-center`}>
            <LayoutTemplate size={32} className={`mx-auto mb-3 ${cc.txt3}`} />
            <p className={`font-bold text-sm ${cc.txt3}`}>{t("admin.sinFichasDisponibles")}</p>
            <p className={`text-xs mt-1 opacity-70 ${cc.txt3}`}>{t("admin.adminCrearFichas")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {templates.map((t, i) => (
              <motion.button key={t.id} onClick={() => { setSelected(t); setAnswers({}) }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }} whileHover={{ y: -2 }}
                className={`group ${cc.card} border rounded-v p-4 text-left shadow-v transition-colors hover:border-v-accent/40`}>
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent transition-transform group-hover:-rotate-6 group-hover:scale-105">
                    <FileText size={19} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${cc.txt1}`}>{t.name}</p>
                    {t.description && <p className={`text-xs mt-0.5 ${cc.txt3} line-clamp-2`}>{t.description}</p>}
                    <p className={`text-[10px] mt-1 ${'text-v-subtle'}`}>
                      {t.fields?.length || 0} {locale === 'en' ? 'fields' : 'campos'}{t.sections?.length ? ` · ${t.sections.length} ${locale === 'en' ? 'sections' : 'secciones'}` : ''}
                    </p>
                  </div>
                  <ChevronDown size={16} className="-rotate-90 self-center text-v-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-v-accent" />
                </div>
              </motion.button>
            ))}
          </div>
        )
      )}

      {/* Rellenar ficha */}
      {selected && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${cc.card} border rounded-v p-6 shadow-v space-y-5`}>
          <div className={`pb-4 border-b ${'border-v-border'}`}>
            <p className={`text-lg font-semibold tracking-tight ${cc.txt1}`}>{selected.name}</p>
            {selected.description && <p className={`text-xs mt-0.5 ${cc.txt3}`}>{selected.description}</p>}
          </div>

          {/* ── Header automatizado: Fecha / Alumno / Especialista ─────────────── */}
          <div className="rounded-v-sm border border-v-border bg-v-bg p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="flex items-start gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-v-accent-soft text-v-accent"><Calendar size={14} /></span>
                <div className="min-w-0">
                  <p className={`text-[11px] font-medium ${cc.txt3}`}>{locale === 'en' ? 'Date' : 'Fecha'}</p>
                  <p className={`text-sm font-semibold capitalize ${cc.txt1}`}>{fechaHoyFmt}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-v-accent-soft text-v-accent"><User size={14} /></span>
                <div className="min-w-0">
                  <p className={`text-[11px] font-medium ${cc.txt3}`}>{locale === 'en' ? 'Student' : 'Alumno'}</p>
                  <p className={`text-sm font-semibold ${cc.txt1}`}>{childName}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-v-accent-soft text-v-accent"><Stethoscope size={14} /></span>
                <div className="min-w-0">
                <p className={`text-[11px] font-medium ${cc.txt3}`}>{locale === 'en' ? 'Specialist in charge' : 'Especialista a cargo'}</p>
                {currentUser ? (
                  <p className={`text-sm font-bold ${cc.txt1}`}>
                    {currentUser.full_name}
                    <span className={`ml-1.5 text-[10px] font-semibold ${cc.txt3}`}>· {roleLabel(currentUser.role)}</span>
                  </p>
                ) : (
                  <p className={`text-xs italic ${cc.txt3}`}>{t("common.cargando")}</p>
                )}
                </div>
              </div>
            </div>
            <p className={`mt-3 flex items-center gap-1.5 text-[11px] ${cc.txt3}`}><Lock size={11} />
              {locale === 'en' ? 'These fields are recorded automatically when saving the form.' : 'Estos campos se registran automáticamente al guardar la ficha.'}
            </p>
          </div>

          {selected.fields.filter(f => !f.section).length > 0 && (
            <div className="space-y-4">{selected.fields.filter(f => !f.section).map(renderField)}</div>
          )}
          {(selected.sections || []).map(section => {
            const sf = selected.fields.filter(f => f.section === section.id)
            if (sf.length === 0) return null
            return (
              <div key={section.id} className={`rounded-v-sm p-4 border ${'bg-v-fill border-v-border'}`}>
                <p className={`font-bold text-sm mb-0.5 ${cc.txt1}`}>{section.title}</p>
                {section.description && <p className={`text-xs mb-3 ${cc.txt3}`}>{section.description}</p>}
                <div className="space-y-4">{sf.map(renderField)}</div>
              </div>
            )
          })}
          <div>
            <label className={`block text-xs font-bold mb-1.5 ${cc.txt3}`}>{t("admin.observacionesAdicionales")}</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t("admin.phNotasClinico")} className={`${inputCls} resize-none`} />
          </div>
          <motion.button whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={saving}
            className="v-brand flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? (locale === 'en' ? 'Saving...' : 'Guardando...') : (locale === 'en' ? 'Save form' : 'Guardar ficha')}
          </motion.button>
        </motion.div>
      )}
    </div>
  )
}

// ── Response Card ─────────────────────────────────────────────────────────────
function ResponseCard({ response, isDark }: { response: TemplateResponse; isDark: boolean }) {
  const { t, locale } = useI18n()
  const [open, setOpen]           = useState(false)
  const [downloading, setDownloading] = useState(false)
  const template = (response as any).clinical_templates
  const fields: Field[]    = template?.fields || []
  const sections: Section[] = template?.sections || []
  const cc = {
    card: 'bg-v-elevated border-v-border',
    txt1: 'text-v-text',
    txt3: 'text-v-subtle',
  }
  const handleWord = async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/reporte-ficha-clinica', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ responseId: response.id }) })
      if (!res.ok) throw new Error(locale === 'en' ? 'Error generating document' : 'Error generando documento')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `Ficha_${template?.name || 'Clinica'}.docx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setDownloading(false) }
  }
  const val = (fid: string) => { const v = response.responses[fid]; if (v === undefined || v === null || v === '') return null; return typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v) }

  return (
    <div className={`${cc.card} border rounded-v overflow-hidden`}>
      <div className="p-4 flex items-center gap-3">
        <button onClick={() => setOpen(!open)} className="flex-1 flex items-center gap-3 text-left min-w-0">
          <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><FileText size={17} /></span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${cc.txt1}`}>{template?.name || 'Ficha'}</p>
            <p className={`text-xs ${cc.txt3}`}>{response.filler_name} · {new Date(response.created_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          {open ? <ChevronUp size={15} className={cc.txt3} /> : <ChevronDown size={15} className={cc.txt3} />}
        </button>
        <button onClick={handleWord} disabled={downloading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-v-accent/30 bg-v-accent-soft px-3.5 py-1.5 text-xs font-semibold text-v-accent transition-colors hover:bg-v-accent hover:text-white disabled:opacity-50">
          {downloading ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
          {downloading ? '...' : 'Word'}
        </button>
      </div>
      {open && (
        <div className={`p-4 pt-2 border-t space-y-3 ${'border-v-border'}`}>
          {fields.filter(f => !f.section).map(f => { const v = val(f.id); if (!v) return null; return <div key={f.id}><p className={`text-xs font-semibold mb-0.5 ${cc.txt3}`}>{f.label}</p><p className={`text-sm ${cc.txt1}`}>{v}</p></div> })}
          {sections.map(s => {
            const sf = fields.filter(f => f.section === s.id)
            if (!sf.some(f => val(f.id))) return null
            return (
              <div key={s.id} className={`rounded-v-sm p-3 border ${'bg-v-fill border-v-border'}`}>
                <p className={`text-xs font-bold mb-2 ${cc.txt1}`}>{s.title}</p>
                <div className="space-y-2">
                  {sf.map(f => { const v = val(f.id); if (!v) return null; return <div key={f.id}><p className={`text-xs font-semibold mb-0.5 ${cc.txt3}`}>{f.label}</p><p className={`text-sm ${cc.txt1}`}>{v}</p></div> })}
                </div>
              </div>
            )
          })}
          {response.notes && <div><p className={`text-xs font-semibold mb-0.5 ${cc.txt3}`}>{t("admin.observaciones")}</p><p className={`text-sm ${cc.txt1}`}>{response.notes}</p></div>}
        </div>
      )}
    </div>
  )
}
