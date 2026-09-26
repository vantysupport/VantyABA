'use client'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'

import { useState, useEffect, useCallback } from 'react'
import {
  BookOpen, Plus, Trash2, Send, Globe, User, Video, FileText, Link as LinkIcon, Image as ImageIcon, Music,
  X, Loader2, RefreshCw, Search, Pencil, ExternalLink, Library, Users, Tags, Check, ChevronDown, Play,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

// Un color por tipo de recurso (tokens Vanty)
const RESOURCE_TYPES = [
  { id: 'video',    label: 'Video',      labelEn: 'Video',     icon: Video,     tone: 'bg-v-danger/10 text-v-danger',   grad: 'from-rose-500/15 to-rose-500/5',       hint: 'YouTube, Vimeo o un enlace de video', hintEn: 'YouTube, Vimeo or a video link' },
  { id: 'pdf',      label: 'PDF / Doc',  labelEn: 'PDF / Doc', icon: FileText,  tone: 'bg-v-accent-soft text-v-accent', grad: 'from-sky-500/15 to-sky-500/5',         hint: 'Enlace a un PDF o documento (Google Drive, etc.)', hintEn: 'Link to a PDF or document (Google Drive, etc.)' },
  { id: 'link',     label: 'Enlace web', labelEn: 'Web link',  icon: LinkIcon,  tone: 'bg-v-accent-soft text-v-accent', grad: 'from-cyan-500/15 to-cyan-500/5',       hint: 'Cualquier página web útil', hintEn: 'Any useful web page' },
  { id: 'image',    label: 'Imagen',     labelEn: 'Image',     icon: ImageIcon, tone: 'bg-v-success/15 text-v-success', grad: 'from-emerald-500/15 to-emerald-500/5', hint: 'Enlace directo a una imagen', hintEn: 'Direct link to an image' },
  { id: 'document', label: 'Material',   labelEn: 'Material',  icon: BookOpen,  tone: 'bg-v-warning/15 text-v-warning', grad: 'from-amber-500/15 to-amber-500/5',     hint: 'Guías, artículos, materiales', hintEn: 'Guides, articles, materials' },
  { id: 'audio',    label: 'Audio',      labelEn: 'Audio',     icon: Music,     tone: 'bg-v-accent-soft text-v-accent', grad: 'from-indigo-500/15 to-indigo-500/5',   hint: 'Podcast, meditación, música', hintEn: 'Podcast, meditation, music' },
]

const RESOURCE_TAGS = ['TDAH', 'TEA', 'Sensorial', 'Lenguaje', 'Conducta', 'Social', 'Familia', 'Relajación', 'Juego', 'Rutinas', 'Emociones', 'Escuela', 'ABA', 'PECS']

// Etiqueta EN para mostrar (el valor guardado sigue siendo el de RESOURCE_TAGS)
const TAG_EN: Record<string, string> = {
  'TDAH': 'ADHD', 'TEA': 'ASD', 'Sensorial': 'Sensory', 'Lenguaje': 'Language', 'Conducta': 'Behavior', 'Social': 'Social', 'Familia': 'Family',
  'Relajación': 'Relaxation', 'Juego': 'Play', 'Rutinas': 'Routines', 'Emociones': 'Emotions', 'Escuela': 'School', 'ABA': 'ABA', 'PECS': 'PECS',
}
const tagLabel = (tag: string, locale: string) => (locale === 'en' ? (TAG_EN[tag] || tag) : tag)

// Solo enlaces http(s): evita guardar o abrir "javascript:" u otros esquemas
const urlSegura = (u: string) => { try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:' } catch { return false } }
const youtubeId = (u: string) => u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)?.[1] || null
// Sugerir el tipo a partir del enlace pegado
function tipoDesdeUrl(u: string): string | null {
  const s = u.toLowerCase()
  if (youtubeId(u) || /vimeo\.com|\.(mp4|webm|mov)(\?|$)/.test(s)) return 'video'
  if (/\.(pdf|docx?|pptx?)(\?|$)|docs\.google\.com|drive\.google\.com/.test(s)) return 'pdf'
  if (/\.(png|jpe?g|webp|gif|svg)(\?|$)/.test(s)) return 'image'
  if (/\.(mp3|wav|m4a|ogg)(\?|$)|spotify\.com|soundcloud\.com/.test(s)) return 'audio'
  return null
}
const dominio = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }

const VACIO = { title: '', description: '', resource_type: 'video', url: '', is_global: true, child_id: '', tags: [] as string[] }
const inputCls = 'w-full rounded-v-sm border border-v-border bg-v-bg px-3.5 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none transition-shadow placeholder:text-v-subtle focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft'

export default function ResourcesManagementView() {
  const toast = useToast()
  const { t, locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const [resources, setResources] = useState<any[]>([])
  const [patients, setPatients] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [pacienteQ, setPacienteQ] = useState('')
  const [pacienteOpen, setPacienteOpen] = useState(false)
  const [tipoManual, setTipoManual] = useState(false)
  const [newResource, setNewResource] = useState(VACIO)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/resources')
      const json = await res.json()
      if (!json.error) setResources(json.data || [])
      const { data: kids } = await supabase.from('children').select('id, name, age, diagnosis').order('name')
      if (kids) setPatients(kids)
    } catch (err) { console.error(err) }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const cerrarForm = () => { setShowForm(false); setEditingId(null); setNewResource(VACIO); setTipoManual(false); setPacienteOpen(false) }

  const handleSave = async () => {
    if (!newResource.title.trim()) { toast.error(t('auto.resourcesManagementView.elTituloEsObligatorio')); return }
    if (!newResource.url.trim()) { toast.error(L('URL is required', 'La URL es obligatoria')); return }
    if (!urlSegura(newResource.url.trim())) { toast.error(L('Enter a valid link starting with https://', 'Ingresá un enlace válido que empiece con https://')); return }
    if (!newResource.is_global && !newResource.child_id) { toast.error(t('auto.resourcesManagementView.seleccionaUnPaciente')); return }
    setIsSaving(true)
    try {
      let parentId = null
      if (!newResource.is_global && newResource.child_id) {
        const { data: child } = await supabase.from('children').select('parent_id').eq('id', newResource.child_id).single()
        parentId = (child as any)?.parent_id || null
      }
      const datos = { ...newResource, title: newResource.title.trim(), url: newResource.url.trim(), child_id: newResource.is_global ? null : newResource.child_id, parent_id: parentId }
      if (editingId) {
        const { error } = await supabase.from('parent_resources').update({
          title: datos.title, description: datos.description, resource_type: datos.resource_type, url: datos.url,
          is_global: datos.is_global, child_id: datos.child_id, parent_id: parentId, tags: datos.tags,
        }).eq('id', editingId)
        if (error) throw new Error(error.message)
        toast.success(t('auto.resourcesManagementView.recursoActualizadoCorrectamente'))
      } else {
        const res = await fetch('/api/admin/resources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-locale': locale },
          body: JSON.stringify(datos),
        })
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        toast.success(t('auto.resourcesManagementView.recursoCompartidoCorrectamente'))
      }
      cerrarForm()
      load()
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    } finally { setIsSaving(false) }
  }

  const handleDelete = async (id: string) => {
    setConfirmDel(null)
    try {
      await fetch('/api/admin/resources', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'x-locale': locale }, body: JSON.stringify({ id }) })
      toast.success(t('auto.resourcesManagementView.recursoEliminado'))
      load()
    } catch (err: any) { toast.error('Error: ' + err.message) }
  }

  const handleEdit = (r: any) => {
    setEditingId(r.id)
    setNewResource({ title: r.title || '', description: r.description || '', resource_type: r.resource_type || 'video', url: r.url || '', is_global: r.is_global !== false, child_id: r.child_id || '', tags: r.tags || [] })
    setTipoManual(true)
    setShowForm(true)
  }

  const toggleTag = (tag: string) => setNewResource(p => ({ ...p, tags: p.tags.includes(tag) ? p.tags.filter(x => x !== tag) : [...p.tags, tag] }))

  const norm = (x: string) => (x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const filtered = resources.filter(r => {
    const q = norm(searchTerm)
    const matchSearch = !q || norm(r.title).includes(q) || norm(r.description).includes(q) || (r.tags || []).some((tg: string) => norm(tagLabel(tg, locale)).includes(q))
    return matchSearch && (filterType === 'all' || r.resource_type === filterType)
  })
  const globalCount = resources.filter(r => r.is_global).length
  const specificCount = resources.length - globalCount
  const tiposUsados = RESOURCE_TYPES.filter(tp => resources.some(r => r.resource_type === tp.id))
  const tipoSel = RESOURCE_TYPES.find(tp => tp.id === newResource.resource_type) || RESOURCE_TYPES[0]
  const pacienteSel = patients.find(p => p.id === newResource.child_id)
  const pacientesFiltrados = patients.filter(p => !pacienteQ || norm(p.name).includes(norm(pacienteQ)))

  return (
    <div className="v-scope space-y-4 md:space-y-5">

      {/* Encabezado */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="v-brand grid size-11 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><Library size={20} /></span>
        <div className="min-w-0 flex-[1_1_220px]">
          <h2 className="v-headline text-xl text-v-text">{L('Resource center', 'Centro de recursos')}</h2>
          <p className="text-xs text-v-subtle">{L('Share videos, PDFs, guides and materials with families', 'Comparte videos, PDFs, guías y materiales con las familias')}</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button onClick={load} title={L('Refresh', 'Actualizar')}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-v-border bg-v-elevated text-v-muted transition-colors hover:text-v-accent">
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => { setNewResource(VACIO); setTipoManual(false); setShowForm(true) }}
            className="v-brand inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold sm:flex-none">
            <Plus size={16} /> {L('Share resource', 'Compartir recurso')}
          </button>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: L('Resources', 'Recursos'), value: resources.length, Icon: Library, tone: 'bg-v-accent-soft text-v-accent' },
          { label: L('For all families', 'Para todas las familias'), value: globalCount, Icon: Globe, tone: 'bg-v-success/15 text-v-success' },
          { label: L('For one patient', 'Para un paciente'), value: specificCount, Icon: User, tone: 'bg-v-warning/15 text-v-warning' },
          { label: L('Types', 'Tipos'), value: tiposUsados.length, Icon: Tags, tone: 'bg-v-fill text-v-muted' },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3 rounded-v border border-v-border bg-v-elevated p-4 shadow-v">
            <span className={`grid size-10 shrink-0 place-items-center rounded-[30%] ${k.tone}`}><k.Icon size={18} /></span>
            <div className="min-w-0">
              <p className="v-headline text-2xl tabular-nums text-v-text">{k.value}</p>
              <p className="truncate text-xs text-v-subtle">{k.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Búsqueda + filtro por tipo */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-v-subtle" />
          <input type="text" placeholder={L('Search by title, description or tag…', 'Buscar por título, descripción o etiqueta…')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="h-11 w-full rounded-full border border-v-border bg-v-elevated pl-11 pr-4 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none transition-colors placeholder:text-v-subtle focus:border-v-accent" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[{ id: 'all', label: L('All', 'Todos'), icon: Library }, ...RESOURCE_TYPES.map(tp => ({ id: tp.id, label: locale === 'en' ? tp.labelEn : tp.label, icon: tp.icon }))].map(o => {
            const n = o.id === 'all' ? resources.length : resources.filter(r => r.resource_type === o.id).length
            if (o.id !== 'all' && n === 0) return null
            const on = filterType === o.id
            return (
              <button key={o.id} onClick={() => setFilterType(o.id)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors ${on ? 'border-v-accent/40 bg-v-accent-soft text-v-accent' : 'border-v-border bg-v-elevated text-v-muted hover:text-v-text'}`}>
                <o.icon size={13} /> {o.label} <span className="tabular-nums opacity-70">{n}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tarjetas */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-v-accent" size={28} /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-v border border-dashed border-v-border bg-v-elevated px-6 py-16 text-center">
          <span className="mb-3 grid size-14 place-items-center rounded-full bg-v-accent-soft text-v-accent"><BookOpen size={24} /></span>
          <p className="text-sm font-semibold text-v-text">{resources.length ? L('No resources match your search', 'Ningún recurso coincide con la búsqueda') : t('ui.no_resources')}</p>
          <p className="mt-1 max-w-sm text-xs text-v-subtle">{resources.length ? L('Try another word or type.', 'Probá con otra palabra o tipo.') : t('recursos.compartePrimero')}</p>
          {!resources.length && (
            <button onClick={() => { setNewResource(VACIO); setShowForm(true) }} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-v-accent-soft px-4 text-xs font-semibold text-v-accent hover:bg-v-accent hover:text-white">
              <Plus size={14} /> {L('Share the first one', 'Compartir el primero')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r, i) => {
            const tp = RESOURCE_TYPES.find(x => x.id === r.resource_type) || RESOURCE_TYPES[2]
            const Icon = tp.icon
            const patient = patients.find(p => p.id === r.child_id)
            const yt = r.url ? youtubeId(r.url) : null
            const portada = yt ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg` : r.resource_type === 'image' && urlSegura(r.url || '') ? r.url : null
            const abrir = r.url && urlSegura(r.url) ? r.url : null
            const conf = confirmDel === r.id
            return (
              <motion.article key={r.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 9) * 0.03 }}
                className="group flex flex-col overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v transition-shadow hover:shadow-v-lg">
                {/* Portada */}
                <a href={abrir || undefined} target="_blank" rel="noopener noreferrer" className={`relative block aspect-[16/8] overflow-hidden bg-gradient-to-br ${tp.grad}`}>
                  {portada ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={portada} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <span className={`absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[30%] bg-v-elevated shadow-v ${tp.tone.split(' ').find(c => c.startsWith('text-'))}`}><Icon size={28} /></span>
                  )}
                  {yt && <span className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm"><Play size={20} className="ml-0.5" fill="currentColor" /></span>}
                  <span className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-v-elevated/95 px-2.5 py-1 text-[11px] font-semibold shadow-v ${tp.tone.split(' ').find(c => c.startsWith('text-'))}`}><Icon size={12} /> {locale === 'en' ? tp.labelEn : tp.label}</span>
                </a>

                <div className="flex flex-1 flex-col p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    {r.is_global
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-v-success/15 px-2 py-0.5 text-[11px] font-semibold text-v-success"><Globe size={11} /> {L('All families', 'Todas las familias')}</span>
                      : <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-v-warning/15 px-2 py-0.5 text-[11px] font-semibold text-v-warning"><User size={11} className="shrink-0" /> <span className="truncate">{patient?.name || t('recursos.pacienteEspecifico')}</span></span>}
                    {abrir && <span className="truncate text-[11px] text-v-subtle">{dominio(abrir)}</span>}
                  </div>
                  <h4 className="text-[15px] font-semibold leading-snug tracking-tight text-v-text [overflow-wrap:anywhere]">{r.title}</h4>
                  {r.description && <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-v-muted [overflow-wrap:anywhere]">{r.description}</p>}
                  {r.tags?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {r.tags.map((tag: string) => <span key={tag} className="rounded-full bg-v-fill px-2 py-0.5 text-[11px] font-medium text-v-muted">{tagLabel(tag, locale)}</span>)}
                    </div>
                  )}
                  <div className="mt-auto flex items-center gap-1 pt-4">
                    <span className="min-w-0 flex-1 truncate text-[11px] text-v-subtle">{new Date(r.created_at).toLocaleDateString(toBCP47(locale), { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <button onClick={() => handleEdit(r)} title={t('common.editar')}
                      className="grid size-8 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text"><Pencil size={14} /></button>
                    <button onClick={() => setConfirmDel(conf ? null : r.id)} title={t('common.eliminar')}
                      className={`grid size-8 place-items-center rounded-full transition-colors ${conf ? 'bg-v-danger/10 text-v-danger' : 'text-v-muted hover:bg-v-danger/10 hover:text-v-danger'}`}><Trash2 size={14} /></button>
                    {abrir && (
                      <a href={abrir} target="_blank" rel="noopener noreferrer"
                        className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-full bg-v-accent-soft px-3 text-xs font-semibold text-v-accent transition-colors hover:bg-v-accent hover:text-white">
                        <ExternalLink size={13} /> {L('Open', 'Abrir')}
                      </a>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {conf && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="flex flex-wrap items-center gap-2 border-t border-v-border bg-v-danger/10 px-4 py-2.5">
                        <p className="min-w-0 flex-1 text-xs text-v-danger">{L('Delete this resource? Families will stop seeing it.', '¿Eliminar este recurso? Las familias dejarán de verlo.')}</p>
                        <button onClick={() => setConfirmDel(null)} className="h-8 rounded-full px-3 text-xs font-semibold text-v-muted hover:bg-v-fill">{L('Cancel', 'Cancelar')}</button>
                        <button onClick={() => handleDelete(r.id)} className="h-8 rounded-full bg-v-danger px-3.5 text-xs font-semibold text-white">{t('common.eliminar')}</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            )
          })}
        </div>
      )}

      {/* Formulario: compartir / editar */}
      <AnimatePresence>
        {showForm && (
          <motion.div className="v-scope fixed inset-0 z-50 flex items-end justify-center bg-[#081426]/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={cerrarForm}>
            <motion.div onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.98 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-v-lg bg-v-elevated shadow-v-lg sm:rounded-v-lg">
              <div className="flex items-center gap-3 border-b border-v-border px-5 py-4">
                <span className="v-brand grid size-10 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}>{editingId ? <Pencil size={17} /> : <Send size={17} />}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold tracking-tight text-v-text">{editingId ? L('Edit resource', 'Editar recurso') : L('Share resource', 'Compartir recurso')}</p>
                  <p className="text-xs text-v-subtle">{L('Families will see it in their portal', 'Las familias lo verán en su portal')}</p>
                </div>
                <button onClick={cerrarForm} className="grid size-9 shrink-0 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-fill hover:text-v-text"><X size={17} /></button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                {/* Enlace primero: el tipo se sugiere solo */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-v-muted">{L('Link', 'Enlace')} *</label>
                  <input type="url" value={newResource.url} placeholder="https://…"
                    onChange={e => {
                      const url = e.target.value
                      const sug = tipoDesdeUrl(url)
                      setNewResource(p => ({ ...p, url, resource_type: !tipoManual && sug ? sug : p.resource_type }))
                    }}
                    className={`${inputCls} h-11 font-mono text-[13px]`} />
                  <p className="mt-1 text-[11px] text-v-subtle">{locale === 'en' ? tipoSel.hintEn : tipoSel.hint}</p>
                  {youtubeId(newResource.url) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`https://img.youtube.com/vi/${youtubeId(newResource.url)}/mqdefault.jpg`} alt="" className="mt-2 aspect-video w-40 rounded-v-sm object-cover" />
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-v-muted">{t('ui.tipoRecurso')}</label>
                  <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
                    {RESOURCE_TYPES.map(tp => {
                      const on = newResource.resource_type === tp.id
                      return (
                        <button key={tp.id} type="button" onClick={() => { setTipoManual(true); setNewResource(p => ({ ...p, resource_type: tp.id })) }}
                          className={`flex flex-col items-center gap-1.5 rounded-v-sm border p-2.5 transition-all ${on ? 'border-v-accent bg-v-accent-soft ring-1 ring-v-accent' : 'border-v-border bg-v-bg hover:border-v-accent/40'}`}>
                          <span className={`grid size-8 place-items-center rounded-[30%] ${on ? 'bg-v-accent text-white' : tp.tone}`}><tp.icon size={16} /></span>
                          <span className={`text-[11px] font-semibold ${on ? 'text-v-accent' : 'text-v-muted'}`}>{locale === 'en' ? tp.labelEn : tp.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-v-muted">{t('recursos.tituloStar')}</label>
                  <input type="text" value={newResource.title} onChange={e => setNewResource(p => ({ ...p, title: e.target.value }))} placeholder={t('ui.resource_title')} className={`${inputCls} h-11`} />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-v-muted">{t('common.descripcion')}</label>
                  <textarea rows={3} value={newResource.description} onChange={e => setNewResource(p => ({ ...p, description: e.target.value }))} placeholder={t('ui.resource_desc')} className={`${inputCls} resize-none py-2.5 leading-relaxed`} />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-v-muted">{t('recursos.etiquetas')}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {RESOURCE_TAGS.map(tag => {
                      const on = newResource.tags.includes(tag)
                      return (
                        <button key={tag} type="button" onClick={() => toggleTag(tag)}
                          className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors ${on ? 'border-v-accent bg-v-accent text-white' : 'border-v-border bg-v-bg text-v-muted hover:text-v-text'}`}>
                          {on && <Check size={12} />} {tagLabel(tag, locale)}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-v-muted">{t('recursos.paraQuien')}</label>
                  <div className="flex rounded-full bg-v-fill p-1">
                    {([[true, t('ui.all_families'), Users], [false, t('ui.specific_patient'), User]] as const).map(([g, lbl, Ic]) => (
                      <button key={String(g)} type="button" onClick={() => setNewResource(p => ({ ...p, is_global: g }))}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-all sm:text-sm ${newResource.is_global === g ? 'bg-v-elevated text-v-accent shadow-v' : 'text-v-muted hover:text-v-text'}`}>
                        <Ic size={14} /> {lbl}
                      </button>
                    ))}
                  </div>
                  <AnimatePresence initial={false}>
                    {!newResource.is_global && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="relative mt-2">
                          <button type="button" onClick={() => { setPacienteOpen(o => !o); setPacienteQ('') }}
                            className={`flex h-11 w-full items-center gap-2.5 rounded-v-sm border bg-v-bg px-3 text-left text-sm transition-colors ${pacienteOpen ? 'border-v-accent ring-4 ring-v-accent-soft' : 'border-v-border'}`}>
                            <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${pacienteSel ? 'bg-v-accent-soft text-v-accent' : 'bg-v-fill text-v-subtle'}`}>{pacienteSel ? pacienteSel.name.charAt(0).toUpperCase() : <User size={14} />}</span>
                            <span className={`min-w-0 flex-1 truncate ${pacienteSel ? 'font-medium text-v-text' : 'text-v-subtle'}`}>{pacienteSel?.name || t('common.seleccionarPaciente')}</span>
                            <ChevronDown size={15} className={`shrink-0 text-v-subtle transition-transform ${pacienteOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {pacienteOpen && (
                            <div className="mt-1.5 overflow-hidden rounded-v-sm border border-v-border bg-v-elevated shadow-v-lg">
                              <div className="border-b border-v-border p-2">
                                <input autoFocus value={pacienteQ} onChange={e => setPacienteQ(e.target.value)} placeholder={L('Search patient…', 'Buscar paciente…')}
                                  className="h-9 w-full rounded-full bg-v-fill px-3.5 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none placeholder:text-v-subtle" />
                              </div>
                              <div className="max-h-48 overflow-y-auto p-1">
                                {pacientesFiltrados.map(p => (
                                  <button key={p.id} type="button" onClick={() => { setNewResource(x => ({ ...x, child_id: p.id })); setPacienteOpen(false) }}
                                    className={`flex w-full items-center gap-2.5 rounded-v-sm px-2.5 py-2 text-left text-sm ${p.id === newResource.child_id ? 'bg-v-accent-soft text-v-accent' : 'text-v-text hover:bg-v-fill'}`}>
                                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-v-accent-soft text-xs font-semibold text-v-accent">{p.name.charAt(0).toUpperCase()}</span>
                                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                                    {p.id === newResource.child_id && <Check size={14} />}
                                  </button>
                                ))}
                                {!pacientesFiltrados.length && <p className="px-3 py-4 text-center text-xs text-v-subtle">—</p>}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-v-border px-5 py-4 sm:flex-row sm:justify-end">
                <button onClick={cerrarForm} className="h-11 rounded-full px-5 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill">{L('Cancel', 'Cancelar')}</button>
                <button onClick={handleSave} disabled={isSaving} className="v-brand inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-50">
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : editingId ? <Check size={16} /> : <Send size={16} />}
                  {isSaving ? L('Saving…', 'Guardando…') : editingId ? L('Save changes', 'Guardar cambios') : L('Share', 'Compartir')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
