'use client'

// Catálogo de terapias del centro: lo que ven los padres tras la evaluación inicial.
// La IA usa estos datos (sobre todo "¿Por qué llevarla?") para recomendar terapias.

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n-context'
import { useCurrency } from '@/components/CurrencyContext'
import {
  Sparkles, Plus, Pencil, Trash2, Save, X, Image as ImageIcon, Loader2, Clock, Upload, Eye, EyeOff, Palette,
  Wifi, MapPin, Layers, Search, Lightbulb, HeartHandshake,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useToast } from '@/components/Toast'

type Terapia = {
  id: string
  nombre: string
  descripcion: string | null
  por_que: string | null
  imagen_url: string | null
  precio: number | null
  moneda: string
  duracion: string | null
  modalidad: string
  categoria: string | null
  color_tema: string
  activo: boolean
  orden: number
}

const VACIA: Partial<Terapia> = {
  nombre: '', descripcion: '', por_que: '', imagen_url: '', precio: null, moneda: 'PEN', duracion: '', modalidad: 'presencial', categoria: '', orden: 0, color_tema: 'blue',
}

const MODALIDADES: { id: string; label: string; labelEn: string; icon: any }[] = [
  { id: 'presencial', label: 'Presencial', labelEn: 'In-person', icon: MapPin },
  { id: 'online',     label: 'Online',     labelEn: 'Online',    icon: Wifi },
  { id: 'mixta',      label: 'Mixta',      labelEn: 'Hybrid',    icon: Layers },
]
const modLabel = (id: string, locale: string) => { const m = MODALIDADES.find(x => x.id === id); return m ? (locale === 'en' ? m.labelEn : m.label) : id }

// Color de cada tarjeta (lo elige el centro): acento sólido + degradado suave para la portada
const COLORES: Record<string, { accent: string; from: string; to: string; es: string; en: string }> = {
  blue:    { accent: '#0069db', from: '#0069db', to: '#01abfc', es: 'Azul',      en: 'Blue' },
  cyan:    { accent: '#0891b2', from: '#06b6d4', to: '#22d3ee', es: 'Cian',      en: 'Cyan' },
  indigo:  { accent: '#4f46e5', from: '#6366f1', to: '#3b82f6', es: 'Índigo',    en: 'Indigo' },
  purple:  { accent: '#9333ea', from: '#a855f7', to: '#d946ef', es: 'Púrpura',   en: 'Purple' },
  pink:    { accent: '#db2777', from: '#ec4899', to: '#f43f5e', es: 'Rosa',      en: 'Pink' },
  rose:    { accent: '#e11d48', from: '#f43f5e', to: '#ef4444', es: 'Coral',     en: 'Coral' },
  orange:  { accent: '#ea580c', from: '#f97316', to: '#ef4444', es: 'Naranja',   en: 'Orange' },
  amber:   { accent: '#d97706', from: '#f59e0b', to: '#f97316', es: 'Ámbar',     en: 'Amber' },
  emerald: { accent: '#059669', from: '#10b981', to: '#14b8a6', es: 'Esmeralda', en: 'Emerald' },
  slate:   { accent: '#475569', from: '#64748b', to: '#334155', es: 'Gris',      en: 'Gray' },
}
const colorDe = (key?: string | null) => COLORES[key || 'blue'] || COLORES.blue
const inputCls = 'w-full rounded-v-sm border border-v-border bg-v-bg px-3.5 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none transition-shadow placeholder:text-v-subtle focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft'

export default function CatalogoTerapiasView() {
  const { t, locale } = useI18n()
  const toast = useToast()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const [terapias, setTerapias] = useState<Terapia[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Terapia> | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [filtroCat, setFiltroCat] = useState<string>('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/terapias-catalogo?all=1')
      const data = await res.json()
      if (data.ok) setTerapias(data.terapias)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!editing?.nombre?.trim()) { toast.error(t('auto.catalogoTerapiasView.nombreObligatorio')); return }
    setSaving(true)
    try {
      const res = await fetch('/api/terapias-catalogo', { method: editing.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
      const d = await res.json()
      if (!d.ok) throw new Error(d.error)
      toast.success(editing.id ? L('Therapy updated', 'Terapia actualizada') : L('Therapy added to the catalog', 'Terapia agregada al catálogo'))
      setEditing(null)
      await cargar()
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  const eliminar = async (id: string) => {
    const res = await fetch(`/api/terapias-catalogo?id=${id}&force=1`, { method: 'DELETE' })
    if (!res.ok) { toast.error(L('Could not delete', 'No se pudo eliminar')); return }
    toast.success(L('Therapy deleted', 'Terapia eliminada'))
    cargar()
  }

  const toggleActivo = async (tp: Terapia) => {
    setTerapias(prev => prev.map(x => x.id === tp.id ? { ...x, activo: !x.activo } : x))
    const res = await fetch('/api/terapias-catalogo', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tp.id, activo: !tp.activo }) })
    if (!res.ok) { setTerapias(prev => prev.map(x => x.id === tp.id ? { ...x, activo: tp.activo } : x)); toast.error(L('Could not update', 'No se pudo actualizar')) }
  }

  const subirImagen = async (file: File) => {
    if (!file) return
    setUploading(true)
    try {
      // Endpoint server-side: crea el bucket si falta y sube con service_role
      const fd = new FormData()
      fd.append('file', file); fd.append('folder', 'terapias')
      const res = await fetch('/api/admin/upload-imagen', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || L('Could not upload the image', 'No se pudo subir la imagen'))
      setEditing(ed => ({ ...ed!, imagen_url: data.url }))
    } catch (e: any) { toast.error(e.message) }
    finally { setUploading(false) }
  }

  const norm = (x?: string | null) => (x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const categorias = Array.from(new Set(terapias.map(x => x.categoria).filter(Boolean) as string[])).sort()
  const filtradas = terapias.filter(x => {
    const q = norm(search)
    return (!q || norm(x.nombre).includes(q) || norm(x.descripcion).includes(q) || norm(x.categoria).includes(q)) && (!filtroCat || x.categoria === filtroCat)
  })
  const visibles = terapias.filter(x => x.activo).length

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-v-accent" size={28} /></div>

  return (
    <div className="v-scope space-y-4 md:space-y-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="v-brand grid size-11 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><HeartHandshake size={20} /></span>
        <div className="min-w-0 flex-[1_1_260px]">
          <h2 className="v-headline text-xl text-v-text">{t('admin.catalogoTerapias')}</h2>
          <p className="text-xs text-v-subtle">{L('What parents see after the initial evaluation. AI uses it to recommend the best fit for each case.', 'Lo que ven los padres tras la evaluación inicial. La IA lo usa para recomendar lo más adecuado en cada caso.')}</p>
        </div>
        <button onClick={() => setEditing({ ...VACIA })} className="v-brand inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold sm:w-auto">
          <Plus size={16} /> {L('New therapy', 'Nueva terapia')}
        </button>
      </div>

      {/* Búsqueda y categorías */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-[1_1_240px]">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-v-subtle" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('admin.phBuscarTerapia')}
              className="h-10 w-full rounded-full border border-v-border bg-v-elevated pl-10 pr-4 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none placeholder:text-v-subtle focus:border-v-accent" />
          </div>
          <span className="rounded-full bg-v-fill px-3 py-2 text-xs font-semibold text-v-muted">
            {terapias.length} {terapias.length === 1 ? L('therapy', 'terapia') : L('therapies', 'terapias')} · {visibles} {L('visible', 'visibles')}
          </span>
        </div>
        {categorias.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {['', ...categorias].map(c => (
              <button key={c || 'todas'} onClick={() => setFiltroCat(c)}
                className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition-colors ${filtroCat === c ? 'border-v-accent/40 bg-v-accent-soft text-v-accent' : 'border-v-border bg-v-elevated text-v-muted hover:text-v-text'}`}>
                {c || t('recursos.todas')}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center rounded-v border border-dashed border-v-border bg-v-elevated px-6 py-16 text-center">
          <span className="mb-3 grid size-14 place-items-center rounded-full bg-v-accent-soft text-v-accent"><Sparkles size={24} /></span>
          <p className="text-sm font-semibold text-v-text">{terapias.length === 0 ? L('No therapies in the catalog yet', 'Aún no hay terapias en el catálogo') : L('No results with those filters', 'Sin resultados con esos filtros')}</p>
          <p className="mt-1 text-xs text-v-subtle">{terapias.length === 0 ? L('Add the first one so parents can see it.', 'Agregá la primera para que los padres la vean.') : L('Adjust the search or the category.', 'Ajustá la búsqueda o la categoría.')}</p>
          {terapias.length === 0 && (
            <button onClick={() => setEditing({ ...VACIA })} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-v-accent-soft px-4 text-xs font-semibold text-v-accent hover:bg-v-accent hover:text-white">
              <Plus size={14} /> {L('Add therapy', 'Agregar terapia')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtradas.map((tp, i) => (
            <TerapiaCard key={tp.id} t={tp} index={i} onEdit={() => setEditing(tp)} onDelete={() => eliminar(tp.id)} onToggle={() => toggleActivo(tp)} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <EditorModal editing={editing} setEditing={setEditing} saving={saving} uploading={uploading}
            onSubirImagen={subirImagen} onGuardar={guardar} onClose={() => setEditing(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// TARJETA
// ═════════════════════════════════════════════════════════════════════════
function TerapiaCard({ t, index = 0, preview = false, onEdit, onDelete, onToggle }: { t: Terapia; index?: number; preview?: boolean; onEdit: () => void; onDelete: () => void; onToggle: () => void; key?: any }) {
  const { t: tr, locale } = useI18n()
  const { fmt } = useCurrency()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const c = colorDe(t.color_tema)
  const ModIcon = MODALIDADES.find(m => m.id === t.modalidad)?.icon || MapPin
  const [conf, setConf] = useState(false)

  return (
    <motion.article layout={!preview} initial={preview ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 9) * 0.03 }}
      className={`group flex flex-col overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v transition-shadow hover:shadow-v-lg ${!t.activo ? 'opacity-60' : ''}`}>
      <div className="relative aspect-[16/9] overflow-hidden" style={{ backgroundImage: `linear-gradient(135deg, ${c.from}, ${c.to})` }}>
        {t.imagen_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.imagen_url} alt={t.nombre} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <span className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[30%] bg-white/20 text-white backdrop-blur-sm"><Sparkles size={24} /></span>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {t.categoria && <span className="rounded-full bg-v-elevated/95 px-2.5 py-1 text-[11px] font-semibold shadow-v" style={{ color: c.accent }}>{t.categoria}</span>}
          {!t.activo && <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm"><EyeOff size={11} /> {L('Hidden', 'Oculta')}</span>}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h4 className="text-base font-semibold leading-snug tracking-tight text-v-text [overflow-wrap:anywhere]">{t.nombre}</h4>
        {t.descripcion && <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-v-muted">{t.descripcion}</p>}
        {t.por_que && (
          <div className="mt-3 rounded-v-sm p-3" style={{ background: `${c.accent}12` }}>
            <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold" style={{ color: c.accent }}><Lightbulb size={12} /> {L('Why choose it?', '¿Por qué llevarla?')}</p>
            <p className="line-clamp-3 text-xs leading-relaxed text-v-text">{t.por_que}</p>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {t.duracion && <span className="inline-flex items-center gap-1 rounded-full bg-v-fill px-2.5 py-1 text-[11px] font-medium text-v-muted"><Clock size={11} /> {t.duracion}</span>}
          <span className="inline-flex items-center gap-1 rounded-full bg-v-fill px-2.5 py-1 text-[11px] font-medium text-v-muted"><ModIcon size={11} /> {modLabel(t.modalidad, locale)}</span>
        </div>
        <div className="mt-auto flex items-end gap-2 border-t border-v-border pt-3" style={{ marginTop: '0.875rem' }}>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-v-subtle">{L('Investment', 'Inversión')}</p>
            {t.precio != null
              ? <p className="v-headline text-xl tabular-nums" style={{ color: c.accent }}>{fmt(Number(t.precio), 0)}</p>
              : <p className="text-sm font-semibold text-v-muted">{tr('admin.aConsultar')}</p>}
          </div>
          {!preview && (
            <div className="flex shrink-0 gap-0.5">
              <button onClick={onToggle} title={t.activo ? L('Hide', 'Ocultar') : L('Show', 'Mostrar')}
                className={`grid size-8 place-items-center rounded-full transition-colors ${t.activo ? 'text-v-success hover:bg-v-success/15' : 'text-v-subtle hover:bg-v-fill'}`}>{t.activo ? <Eye size={15} /> : <EyeOff size={15} />}</button>
              <button onClick={onEdit} title={tr('common.editar')} className="grid size-8 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text"><Pencil size={14} /></button>
              <button onClick={() => setConf(x => !x)} title={tr('common.eliminar')} className={`grid size-8 place-items-center rounded-full transition-colors ${conf ? 'bg-v-danger/10 text-v-danger' : 'text-v-muted hover:bg-v-danger/10 hover:text-v-danger'}`}><Trash2 size={14} /></button>
            </div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {conf && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-t border-v-border bg-v-danger/10 px-4 py-2.5">
              <p className="min-w-0 flex-1 text-xs text-v-danger">{L('Remove this therapy from the catalog?', '¿Quitar esta terapia del catálogo?')}</p>
              <button onClick={() => setConf(false)} className="h-8 rounded-full px-3 text-xs font-semibold text-v-muted hover:bg-v-fill">{L('Cancel', 'Cancelar')}</button>
              <button onClick={() => { setConf(false); onDelete() }} className="h-8 rounded-full bg-v-danger px-3.5 text-xs font-semibold text-white">{tr('common.eliminar')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// EDITOR (formulario + vista previa en vivo)
// ═════════════════════════════════════════════════════════════════════════
function EditorModal({ editing, setEditing, saving, uploading, onSubirImagen, onGuardar, onClose }: any) {
  const { t: tr, locale } = useI18n()
  const { symbol } = useCurrency()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const set = (k: string, v: any) => setEditing({ ...editing, [k]: v })

  return (
    <motion.div className="v-scope fixed inset-0 z-50 flex items-end justify-center bg-[#081426]/50 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-v-lg bg-v-elevated shadow-v-lg sm:rounded-v-lg">
        <div className="flex items-center gap-3 border-b border-v-border px-5 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-[30%] text-white" style={{ backgroundImage: `linear-gradient(135deg, ${colorDe(editing.color_tema).from}, ${colorDe(editing.color_tema).to})` }}><Sparkles size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold tracking-tight text-v-text">{editing.id ? L('Edit therapy', 'Editar terapia') : L('New therapy', 'Nueva terapia')}</p>
            <p className="text-xs text-v-subtle">{L('The preview shows how parents will see it', 'La vista previa muestra cómo la verán los padres')}</p>
          </div>
          <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-fill hover:text-v-text"><X size={17} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <Field label={L('Name *', 'Nombre *')}>
                <input value={editing.nombre || ''} onChange={e => set('nombre', e.target.value)} className={`${inputCls} h-11`} placeholder={L('E.g. ABA therapy', 'Ej: Terapia ABA')} />
              </Field>

              <Field label={L('Image', 'Imagen')}>
                <div className="flex items-start gap-3">
                  <div className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-v-sm border border-dashed border-v-border bg-v-bg">
                    {editing.imagen_url ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={editing.imagen_url} alt="" className="size-full object-cover" />
                        <button onClick={() => set('imagen_url', '')} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white"><X size={12} /></button>
                      </>
                    ) : <ImageIcon size={26} className="text-v-subtle" />}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-v-accent-soft px-4 text-xs font-semibold text-v-accent transition-colors hover:bg-v-accent hover:text-white">
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {uploading ? L('Uploading…', 'Subiendo…') : L('Upload image', 'Subir imagen')}
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onSubirImagen(e.target.files[0])} />
                    </label>
                    <input value={editing.imagen_url || ''} onChange={e => set('imagen_url', e.target.value)} placeholder={tr('admin.phUrlImagen')} className={`${inputCls} h-9 text-xs`} />
                    <p className="text-[11px] text-v-subtle">{L('Landscape image, at least 600×400 px.', 'Imagen horizontal, mínimo 600×400 px.')}</p>
                  </div>
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={L('Category', 'Categoría')}>
                  <input value={editing.categoria || ''} onChange={e => set('categoria', e.target.value)} placeholder={tr('admin.phCatTerapia')} className={`${inputCls} h-11`} />
                </Field>
                <Field label={L('Modality', 'Modalidad')}>
                  <div className="flex rounded-full bg-v-fill p-1">
                    {MODALIDADES.map(m => {
                      const on = editing.modalidad === m.id
                      return (
                        <button key={m.id} type="button" onClick={() => set('modalidad', m.id)}
                          className={`flex flex-1 items-center justify-center gap-1 rounded-full py-2 text-xs font-semibold transition-all ${on ? 'bg-v-elevated text-v-accent shadow-v' : 'text-v-muted hover:text-v-text'}`}>
                          <m.icon size={13} /> {locale === 'en' ? m.labelEn : m.label}
                        </button>
                      )
                    })}
                  </div>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`${L('Price', 'Precio')} (${symbol})`} hint={L('Leave empty to show "Ask us".', 'Dejalo vacío para mostrar "A consultar".')}>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-v-subtle">{symbol}</span>
                    <input type="number" inputMode="decimal" step="0.01" value={editing.precio ?? ''} onChange={e => set('precio', e.target.value === '' ? null : Number(e.target.value))}
                      placeholder="0.00" className={`${inputCls} h-11 pl-10 font-semibold tabular-nums`} />
                  </div>
                </Field>
                <Field label={L('Duration', 'Duración')}>
                  <input value={editing.duracion || ''} onChange={e => set('duracion', e.target.value)} placeholder={tr('admin.phSesiones')} className={`${inputCls} h-11`} />
                </Field>
              </div>

              <Field label={L('Description', 'Descripción')}>
                <textarea value={editing.descripcion || ''} onChange={e => set('descripcion', e.target.value)} rows={3} placeholder={tr('admin.phQueHace')} className={`${inputCls} resize-none py-2.5 leading-relaxed`} />
              </Field>

              <Field label={L('Why choose it?', '¿Por qué llevarla?')} hint={L('AI reads this text to decide when to recommend this therapy. Be specific about who it helps.', 'La IA lee este texto para decidir cuándo recomendar esta terapia. Sé específico sobre a quién ayuda.')}>
                <textarea value={editing.por_que || ''} onChange={e => set('por_que', e.target.value)} rows={3} placeholder={tr('admin.phBeneficios')} className={`${inputCls} resize-none py-2.5 leading-relaxed`} />
              </Field>

              <Field label={L('Card color', 'Color de la tarjeta')}>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(COLORES).map(([key, col]) => {
                    const on = (editing.color_tema || 'blue') === key
                    return (
                      <button key={key} type="button" onClick={() => set('color_tema', key)} title={locale === 'en' ? col.en : col.es}
                        className="size-9 rounded-full transition-transform hover:scale-110"
                        style={{ backgroundImage: `linear-gradient(135deg, ${col.from}, ${col.to})`, boxShadow: on ? `0 0 0 2px var(--v-bg-elevated), 0 0 0 4px ${col.accent}` : undefined }} />
                    )
                  })}
                </div>
              </Field>
            </div>

            {/* Vista previa */}
            <div className="lg:sticky lg:top-0 lg:self-start">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-v-muted"><Palette size={13} /> {L('Preview', 'Vista previa')}</p>
              <TerapiaCard preview t={{
                id: 'preview', nombre: editing.nombre || L('Therapy name', 'Nombre de la terapia'), descripcion: editing.descripcion || null,
                por_que: editing.por_que || null, imagen_url: editing.imagen_url || null, precio: editing.precio ?? null, moneda: editing.moneda || 'PEN',
                duracion: editing.duracion || null, modalidad: editing.modalidad || 'presencial', categoria: editing.categoria || null,
                color_tema: editing.color_tema || 'blue', activo: true, orden: 0,
              }} onEdit={() => {}} onDelete={() => {}} onToggle={() => {}} />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-v-border px-5 py-4 sm:flex-row sm:justify-end">
          <button onClick={onClose} className="h-11 rounded-full px-5 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill">{L('Cancel', 'Cancelar')}</button>
          <button onClick={onGuardar} disabled={saving} className="v-brand inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {L('Save therapy', 'Guardar terapia')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-v-muted">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] text-v-subtle">{hint}</p>}
    </div>
  )
}
