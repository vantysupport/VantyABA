'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useI18n } from '@/lib/i18n-context'
import {
  Upload, FileText, Image, File, Trash2, Download,
  Eye, EyeOff, Plus, Loader2, X, Search, Filter,
  FolderOpen, CheckCircle, AlertCircle, ExternalLink,
  Folder, FolderPlus, ChevronRight, Home, MoreVertical,
  Edit2, Move, FolderInput, FileSpreadsheet, Lock, LayoutGrid, PencilLine, ClipboardCheck, Signature, Paperclip
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { fileUrl } from '@/lib/file-url'
import { subirArchivoPrivado } from '@/lib/subir-archivo'
import { useToast } from '@/components/Toast'
import { confirmar } from '@/components/ui/confirmar'

// ── Ícono + color clínico por tipo de archivo (no emojis) ───────────────────
const FILE_ICON_CFG: Record<string, { Icon: any; color: string }> = {
  pdf:   { Icon: FileText,        color: '#ef4444' },
  image: { Icon: Image,          color: '#01abfc' },
  word:  { Icon: FileText,        color: '#0069db' },
  excel: { Icon: FileSpreadsheet, color: '#10b981' },
  other: { Icon: File,            color: '#64748b' },
}
const fileIconCfg = (t: string) => FILE_ICON_CFG[t] || FILE_ICON_CFG.other

// ── Types ───────────────────────────────────────────────────────────────────
interface Doc {
  id: string
  child_id: string
  uploaded_by: string
  uploader_role: string
  uploader_name: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  category: string
  description: string | null
  visible_to_parent: boolean
  created_at: string
}

interface Carpeta {
  id: string
  name: string
  emoji: string
  createdAt: string
  parentId: string | null
}

interface FolderState {
  carpetas: Carpeta[]
  docFolder: Record<string, string | null> // docId -> carpetaId | null (raíz)
}

const EMOJIS_FOLDER = ['📁','📂','🗂️','📋','📌','🗒️','🔖','📎','🏷️','💼','🗃️','📦']

const CATEGORIES = [
  { id: 'all',           label: 'Todos',           labelEn: 'All',            emoji: '📁' },
  { id: 'tarea',         label: 'Tarea',            labelEn: 'Task',           emoji: '📝' },
  { id: 'informe',       label: 'Informe',          labelEn: 'Report',         emoji: '📄' },
  { id: 'evaluacion',    label: 'Evaluación',       labelEn: 'Evaluation',     emoji: '🔬' },
  { id: 'consentimiento',label: 'Consentimiento',   labelEn: 'Consent',        emoji: '✍️' },
  { id: 'foto',          label: 'Foto / imagen',    labelEn: 'Photo / image',  emoji: '🖼️' },
  { id: 'general',       label: 'General',          labelEn: 'General',        emoji: '📂' },
  { id: 'otro',          label: 'Otro',             labelEn: 'Other',          emoji: '📎' },
]

const CAT_ICON: Record<string, any> = {
  all: LayoutGrid, tarea: PencilLine, informe: FileText, evaluacion: ClipboardCheck,
  consentimiento: Signature, foto: Image, general: Folder, otro: Paperclip,
}

const FILE_ICONS: Record<string, string> = {
  pdf: '📄', image: '🖼️', word: '📝', excel: '📊', other: '📎'
}

function fileTypeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['doc','docx'].includes(ext)) return 'word'
  if (['xls','xlsx','csv'].includes(ext)) return 'excel'
  return 'other'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string, locale?: string): string {
  return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function useFolderState(childId: string) {
  const key = `docs_folders_${childId}`
  const [state, setState] = useState<FolderState>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : { carpetas: [], docFolder: {} }
    } catch { return { carpetas: [], docFolder: {} } }
  })

  const save = (next: FolderState) => {
    setState(next)
    localStorage.setItem(key, JSON.stringify(next))
  }

  const crearCarpeta = (name: string, emoji: string, parentId: string | null) => {
    const nueva: Carpeta = { id: Date.now().toString(), name, emoji, createdAt: new Date().toISOString(), parentId }
    save({ ...state, carpetas: [...state.carpetas, nueva] })
  }

  const renombrarCarpeta = (id: string, name: string, emoji: string) => {
    save({ ...state, carpetas: state.carpetas.map(c => c.id === id ? { ...c, name, emoji } : c) })
  }

  const eliminarCarpeta = (id: string) => {
    // Move docs in deleted folder to root
    const newDocFolder = { ...state.docFolder }
    Object.keys(newDocFolder).forEach(docId => {
      if (newDocFolder[docId] === id) newDocFolder[docId] = null
    })
    // Also delete sub-carpetas
    const toDelete = new Set<string>()
    const collect = (pid: string) => {
      toDelete.add(pid)
      state.carpetas.filter(c => c.parentId === pid).forEach(c => collect(c.id))
    }
    collect(id)
    save({ carpetas: state.carpetas.filter(c => !toDelete.has(c.id)), docFolder: newDocFolder })
  }

  const moverDoc = (docId: string, carpetaId: string | null) => {
    save({ ...state, docFolder: { ...state.docFolder, [docId]: carpetaId } })
  }

  // Asigna VARIOS documentos a una carpeta en una sola operación (evita el bug
  // de closure obsoleto cuando se llamaba moverDoc en un loop y solo guardaba el último).
  const moverDocs = (docIds: string[], carpetaId: string | null) => {
    const next = { ...state.docFolder }
    docIds.forEach(id => { next[id] = carpetaId })
    save({ ...state, docFolder: next })
  }

  return { state, crearCarpeta, renombrarCarpeta, eliminarCarpeta, moverDoc, moverDocs }
}

// ── Main Component ──────────────────────────────────────────────────────────
interface DocumentosViewProps {
  childId: string
  childName: string
  currentRole: 'jefe' | 'admin' | 'especialista' | 'terapeuta' | 'padre'
  isDark?: boolean
}

export default function DocumentosView({ childId, childName, currentRole, isDark = false }: DocumentosViewProps) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [docs, setDocs]           = useState<Doc[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch]       = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showUpload, setShowUpload] = useState(false)

  // Folder navigation
  const { state: fs, crearCarpeta, renombrarCarpeta, eliminarCarpeta, moverDoc, moverDocs } = useFolderState(childId)
  const [currentFolder, setCurrentFolder] = useState<string | null>(null) // null = raíz
  const [uploadFolder, setUploadFolder] = useState<string | null>(null)   // carpeta destino al subir
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderEmoji, setNewFolderEmoji] = useState('📁')
  const [editingFolder, setEditingFolder] = useState<Carpeta | null>(null)
  const [movingDoc, setMovingDoc] = useState<Doc | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [renamingDoc, setRenamingDoc] = useState<string | null>(null)  // doc.id en edición
  const [previewId, setPreviewId] = useState<string | null>(null)  // doc abierto en el visor
  const [renameValue, setRenameValue] = useState('')

  // Upload form state
  const [newCat, setNewCat]       = useState('general')
  const [otroLabel, setOtroLabel] = useState('')
  const [newDesc, setNewDesc]     = useState('')
  const [visibleParent, setVisibleParent] = useState(true)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging]       = useState(false)

  const canUpload = ['jefe','admin','especialista','terapeuta','padre'].includes(currentRole)
  const canDelete = ['jefe','admin','especialista'].includes(currentRole)
  const canToggleVisibility = ['jefe','admin','especialista'].includes(currentRole)
  const isPadre = currentRole === 'padre'

  const card    = 'bg-v-elevated border-v-border'
  const cardHover = 'hover:bg-v-fill'
  const txt1    = 'text-v-text'
  const txt3    = 'text-v-subtle'
  const inputCls = 'bg-v-fill border-v-border text-v-text placeholder:text-v-subtle focus:border-v-accent'

  const loadDocs = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('patient_documents')
        .select('*')
        .eq('child_id', childId)
        .order('created_at', { ascending: false })
      if (isPadre) q = q.eq('visible_to_parent', true)
      const { data, error } = await q
      if (error) throw error
      setDocs(data || [])
    } catch (e: any) {
      toast.error((locale === 'en' ? 'Error loading documents: ' : 'Error cargando documentos: ') + e.message)
    } finally {
      setLoading(false)
    }
  }, [childId, isPadre])

  useEffect(() => { loadDocs() }, [loadDocs])

  // Close menus on outside click
  useEffect(() => {
    const handler = () => setOpenMenuId(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming)
    setSelectedFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      return [...prev, ...arr.filter(f => !existing.has(f.name + f.size))]
    })
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) { toast.error(t('auto.documentosView.seleccionaAlMenosUnArchivo')); return }
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      const { data: profile } = await supabase.from('profiles').select('full_name,role').eq('id', user.id).single()

      let uploaded = 0
      const fallidos: string[] = []
      const newIds: string[] = []

      // Subimos archivo por archivo de forma RESILIENTE: si uno falla, los demás
      // siguen subiendo (antes un solo error abortaba todo el lote).
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        try {
          // Directo a R2 (privado); las fotos se comprimen antes de subir
          const subido = await subirArchivoPrivado('patient-documents', childId, file)
          const publicUrl = subido.url
          const { data: inserted, error: dbErr } = await supabase.from('patient_documents').insert({
            child_id: childId, uploaded_by: user.id,
            uploader_role: profile?.role || currentRole,
            uploader_name: profile?.full_name || 'Usuario',
            file_name: file.name, file_url: publicUrl,
            file_type: fileTypeFromName(file.name), file_size: subido.size,
            category: newCat === 'otro' && otroLabel.trim() ? otroLabel.trim() : newCat,
            description: newDesc.trim() || null, visible_to_parent: visibleParent,
          }).select('id').single()
          if (dbErr) throw dbErr

          if (inserted?.id) newIds.push(inserted.id)
          // 🧠 Auto-extraer texto en background para que la IA lo conozca
          if (inserted?.id) {
            fetch('/api/patient-documents/extract', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ document_id: inserted.id }),
            }).catch(() => {})
          }
          uploaded++
        } catch (errFile: any) {
          console.error(`[docs] falló subida de "${file.name}":`, errFile?.message)
          fallidos.push(file.name)
        }
      }

      // Asignar TODOS los subidos a la carpeta destino elegida (en una sola operación)
      if (newIds.length > 0) {
        moverDocs(newIds, uploadFolder)
        // Si subiste a una carpeta distinta a la que estás viendo, navegá a ella
        if (uploadFolder !== currentFolder) setCurrentFolder(uploadFolder)
      }

      if (uploaded > 0 && fallidos.length === 0) {
        const destino = uploadFolder ? (fs.carpetas.find(c => c.id === uploadFolder)?.name || (locale === 'en' ? 'the folder' : 'la carpeta')) : (locale === 'en' ? 'Home' : 'Inicio')
        toast.success(locale === 'en'
          ? `${uploaded} document${uploaded > 1 ? 's' : ''} uploaded to "${destino}"`
          : `${uploaded} documento${uploaded > 1 ? 's subidos' : ' subido'} en "${destino}"`)
      } else if (uploaded > 0 && fallidos.length > 0) {
        toast.warning(`Se subieron ${uploaded}, pero fallaron ${fallidos.length}: ${fallidos.join(', ')}`)
      } else {
        toast.error(t('auto.documentosView.noSePudoSubirNingun'))
      }

      if (uploaded > 0) {
        setShowUpload(false); setSelectedFiles([]); setNewDesc(''); setNewCat('general'); setOtroLabel('')
        loadDocs()
      }
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  // ── Renombrar documento (solo cambia el nombre visible en la BD) ──
  const renombrarDoc = async (doc: Doc, nuevoNombre: string) => {
    const nombre = nuevoNombre.trim()
    if (!nombre || nombre === doc.file_name) { setRenamingDoc(null); return }
    try {
      const { error } = await supabase.from('patient_documents').update({ file_name: nombre }).eq('id', doc.id)
      if (error) throw error
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, file_name: nombre } : d))
      toast.success(t('auto.documentosView.nombreActualizado'))
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    } finally {
      setRenamingDoc(null)
    }
  }

  const handleDelete = async (doc: Doc) => {
    if (!await confirmar(t('auto.documentosView.eliminar', { v1: String(doc.file_name) }))) return
    try {
      await supabase.from('patient_documents').delete().eq('id', doc.id)
      // Borra también el archivo guardado para no ocupar espacio
      if (doc.file_url) {
        const { data: { session } } = await supabase.auth.getSession()
        fetch('/api/files/delete', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify({ url: doc.file_url }) }).catch(() => {})
      }
      toast.success(t('auto.documentosView.documentoEliminado'))
      setDocs(prev => prev.filter(d => d.id !== doc.id))
    } catch (e: any) { toast.error('Error: ' + e.message) }
  }

  const toggleVisibility = async (doc: Doc) => {
    try {
      await supabase.from('patient_documents').update({ visible_to_parent: !doc.visible_to_parent }).eq('id', doc.id)
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, visible_to_parent: !d.visible_to_parent } : d))
    } catch (e: any) { toast.error('Error: ' + e.message) }
  }

  // Build breadcrumb path
  const buildPath = (folderId: string | null): Carpeta[] => {
    if (!folderId) return []
    const folder = fs.carpetas.find(c => c.id === folderId)
    if (!folder) return []
    return [...buildPath(folder.parentId), folder]
  }
  const breadcrumb = buildPath(currentFolder)

  // Carpetas en la carpeta actual
  const subCarpetas = fs.carpetas.filter(c => c.parentId === currentFolder)

  // Docs en la carpeta actual (con filtros)
  const docsEnCarpeta = docs.filter(d => {
    const docCarpeta = fs.docFolder[d.id] ?? null
    return docCarpeta === currentFolder
  })
  const filtered = docsEnCarpeta.filter(d => {
    const matchSearch = d.file_name.toLowerCase().includes(search.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(search.toLowerCase()) ||
      d.uploader_name.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || d.category === catFilter
    return matchSearch && matchCat
  })

  // Count items for each sub-carpeta
  const countInFolder = (fid: string): number => {
    const subIds = new Set<string>()
    const collect = (pid: string) => {
      subIds.add(pid)
      fs.carpetas.filter(c => c.parentId === pid).forEach(c => collect(c.id))
    }
    collect(fid)
    const docCount = docs.filter(d => subIds.has(fs.docFolder[d.id] ?? '')).length
    const folderCount = fs.carpetas.filter(c => c.parentId === fid).length
    return docCount + folderCount
  }

  const handleCrearCarpeta = () => {
    if (!newFolderName.trim()) return
    crearCarpeta(newFolderName.trim(), newFolderEmoji, currentFolder)
    setNewFolderName(''); setNewFolderEmoji('📁'); setShowNewFolder(false)
    toast.success(t('auto.documentosView.carpetaCreada'))
  }

  const handleEditarCarpeta = () => {
    if (!editingFolder || !newFolderName.trim()) return
    renombrarCarpeta(editingFolder.id, newFolderName.trim(), newFolderEmoji)
    setEditingFolder(null); setNewFolderName(''); setNewFolderEmoji('📁')
    toast.success(t('auto.documentosView.carpetaActualizada'))
  }

  const isEmpty = subCarpetas.length === 0 && filtered.length === 0 && !search && catFilter === 'all'
  const previewIndex = previewId ? filtered.findIndex(d => d.id === previewId) : -1
  const previewDoc = previewIndex >= 0 ? filtered[previewIndex] : null

  return (
    <div className="space-y-4" onClick={() => setOpenMenuId(null)}>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-v-text sm:text-lg">
            <span className="grid size-9 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><FolderOpen size={17} /></span>
            {locale === 'en' ? 'Documents' : 'Documentos'}
          </h3>
          <p className="mt-1 text-xs text-v-subtle sm:text-sm">
            {isPadre ? (locale === 'en' ? "Documents shared for your child" : 'Documentos compartidos de tu hijo/a') : (locale === 'en' ? `Files and documents of ${childName}` : `Archivos y documentos de ${childName}`)}
          </p>
        </div>
        <div className="flex items-center gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
          {canUpload && (
            <button onClick={() => setShowNewFolder(true)}
              className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-v-border bg-v-elevated px-3.5 text-xs font-semibold text-v-muted shadow-v transition-colors hover:text-v-accent sm:h-10 sm:px-4 sm:text-sm">
              <FolderPlus size={15} /> {locale === 'en' ? 'New folder' : 'Nueva carpeta'}
            </button>
          )}
          {canUpload && (
            <button onClick={() => { setUploadFolder(currentFolder); setShowUpload(!showUpload) }}
              className="v-brand inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-xs font-semibold sm:h-10 sm:px-5 sm:text-sm">
              <Upload size={15} /> {locale === 'en' ? 'Upload document' : 'Subir documento'}
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumb */}
      <div className={`flex items-center gap-1 text-xs flex-wrap`}>
        <button onClick={() => setCurrentFolder(null)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg font-semibold transition-colors
            ${currentFolder === null
              ? 'bg-v-accent-soft text-v-accent'
              : 'text-v-muted hover:bg-v-fill'}`}>
          <Home size={11} /> {locale === 'en' ? 'Home' : 'Inicio'}
        </button>
        {breadcrumb.map((crumb, i) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <ChevronRight size={11} className={txt3} />
            <button onClick={() => setCurrentFolder(crumb.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg font-semibold transition-colors
                ${currentFolder === crumb.id
                  ? 'bg-v-accent-soft text-v-accent'
                  : 'text-v-muted hover:bg-v-fill'}`}>
              {crumb.emoji} {crumb.name}
            </button>
          </span>
        ))}
      </div>

      {/* ── Ventana: nueva carpeta / editar carpeta ── */}
      <AnimatePresence>
        {(showNewFolder || editingFolder) && (
          <DocModal key="folder" icon={FolderPlus} title={editingFolder ? (locale === 'en' ? 'Edit folder' : 'Editar carpeta') : (locale === 'en' ? 'New folder' : 'Nueva carpeta')}
            onClose={() => { setShowNewFolder(false); setEditingFolder(null); setNewFolderName(''); setNewFolderEmoji('📁') }}>
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-v-sm border border-v-border bg-v-bg p-3 focus-within:border-v-accent/50 focus-within:ring-4 focus-within:ring-v-accent-soft">
                <span className="grid size-11 shrink-0 place-items-center rounded-[30%] bg-v-warning/15 text-2xl">{newFolderEmoji}</span>
                <input autoFocus value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (editingFolder ? handleEditarCarpeta() : handleCrearCarpeta())}
                  placeholder={t('admin.phCarpeta')}
                  className="min-w-0 flex-1 bg-transparent text-base font-semibold text-v-text outline-none placeholder:font-normal placeholder:text-v-subtle" />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-v-muted">{locale === 'en' ? 'Icon' : 'Ícono'}</p>
                <div className="grid grid-cols-6 gap-1.5">
                  {EMOJIS_FOLDER.map(em => (
                    <button key={em} type="button" onClick={() => setNewFolderEmoji(em)}
                      className={`grid aspect-square place-items-center rounded-v-sm text-xl transition-all hover:scale-110 ${newFolderEmoji === em ? 'bg-v-accent-soft ring-2 ring-v-accent/40' : 'bg-v-fill'}`}>
                      {em}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowNewFolder(false); setEditingFolder(null); setNewFolderName(''); setNewFolderEmoji('📁') }}
                  className="flex-1 rounded-full border border-v-border py-2.5 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill">
                  {t('auto.documentosView.cancelar')}
                </button>
                <button onClick={editingFolder ? handleEditarCarpeta : handleCrearCarpeta} disabled={!newFolderName.trim()}
                  className="v-brand flex-1 rounded-full py-2.5 text-sm font-semibold disabled:opacity-40">
                  {editingFolder ? (locale === 'en' ? 'Save' : 'Guardar') : (locale === 'en' ? 'Create folder' : 'Crear carpeta')}
                </button>
              </div>
            </div>
          </DocModal>
        )}
      </AnimatePresence>

      {/* ── Ventana: mover documento ── */}
      <AnimatePresence>
        {movingDoc && (
          <DocModal key="move" icon={FolderInput} title={t('admin.moverCarpeta')} subtitle={movingDoc.file_name} onClose={() => setMovingDoc(null)}>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {[{ id: null as string | null, label: locale === 'en' ? 'Home (root)' : 'Inicio (raíz)', emoji: null as string | null, sub: false },
                ...fs.carpetas.map(c => ({ id: c.id as string | null, label: c.name, emoji: c.emoji as string | null, sub: !!c.parentId }))].map(opt => {
                const on = (fs.docFolder[movingDoc.id] ?? null) === opt.id
                return (
                  <button key={opt.id ?? 'root'}
                    onClick={() => { moverDoc(movingDoc.id, opt.id); setMovingDoc(null); toast.success(opt.id ? `${locale === 'en' ? 'Moved to' : 'Movido a'} ${opt.label}` : (locale === 'en' ? 'Moved to Home' : 'Movido a Inicio')) }}
                    className={`flex w-full items-center gap-3 rounded-v-sm px-3 py-2.5 text-left text-sm transition-colors ${on ? 'bg-v-accent-soft font-semibold text-v-accent' : 'text-v-text hover:bg-v-fill'}`}>
                    <span className="grid size-8 shrink-0 place-items-center rounded-[30%] bg-v-fill text-base">{opt.emoji ?? <Home size={15} className="text-v-accent" />}</span>
                    <span className="flex-1 truncate">{opt.label}</span>
                    {opt.sub && <span className="text-[10px] text-v-subtle">{locale === 'en' ? 'subfolder' : 'subcarpeta'}</span>}
                    {on && <CheckCircle size={15} />}
                  </button>
                )
              })}
            </div>
          </DocModal>
        )}
      </AnimatePresence>

      {/* ── Ventana: subir documentos ── */}
      <AnimatePresence>
        {showUpload && (
          <DocModal key="upload" icon={Upload} wide title={t('admin.subirDocumento')}
            subtitle={locale === 'en' ? `For ${childName}` : `Para ${childName}`}
            onClose={() => { setShowUpload(false); setSelectedFiles([]) }}>
            <div className="space-y-5">
              {/* Zona para soltar */}
              <motion.div
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files) }}
                onClick={() => fileRef.current?.click()}
                animate={{ scale: isDragging ? 1.01 : 1 }}
                className={`cursor-pointer rounded-v border-2 border-dashed px-6 py-8 text-center transition-colors ${isDragging ? 'border-v-accent bg-v-accent-soft' : 'border-v-border bg-v-bg hover:border-v-accent/40 hover:bg-v-accent-soft'}`}>
                <motion.span animate={{ y: isDragging ? -4 : [0, -3, 0] }} transition={isDragging ? { duration: 0.2 } : { duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="v-brand mx-auto mb-3 grid size-14 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}>
                  <Upload size={24} />
                </motion.span>
                <p className="text-sm font-semibold text-v-text">
                  {isDragging ? (locale === 'en' ? 'Drop the files here' : 'Suelta los archivos aquí') : (locale === 'en' ? 'Drag files here or click to choose' : 'Arrastra archivos aquí o haz clic para elegir')}
                </p>
                <p className="mt-1 text-xs text-v-subtle">{t('admin.formatosArchivo')}</p>
              </motion.div>
              <input ref={fileRef} type="file" className="hidden" multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mp3"
                onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = '' } }} />

              {/* Archivos elegidos */}
              <AnimatePresence initial={false}>
                {selectedFiles.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-1.5">
                    <p className="text-xs font-semibold text-v-muted">{selectedFiles.length} {locale === 'en' ? (selectedFiles.length === 1 ? 'file' : 'files') : (selectedFiles.length === 1 ? 'archivo' : 'archivos')}</p>
                    <div className="max-h-44 space-y-1.5 overflow-y-auto">
                      {selectedFiles.map((f, i) => {
                        const fic = fileIconCfg(fileTypeFromName(f.name))
                        const FI = fic.Icon
                        return (
                          <motion.div key={`${f.name}-${i}`} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                            className="flex items-center gap-3 rounded-v-sm border border-v-border bg-v-elevated px-3 py-2">
                            <span className="grid size-8 shrink-0 place-items-center rounded-[30%]" style={{ background: `${fic.color}18`, color: fic.color }}><FI size={15} /></span>
                            <span className="min-w-0 flex-1 truncate text-sm text-v-text">{f.name}</span>
                            <span className="shrink-0 text-xs tabular-nums text-v-subtle">{formatSize(f.size)}</span>
                            <button onClick={() => setSelectedFiles(prev => prev.filter((_, j) => j !== i))}
                              className="grid size-7 shrink-0 place-items-center rounded-full text-v-subtle hover:bg-v-danger/10 hover:text-v-danger"><X size={13} /></button>
                          </motion.div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-v-muted">{t('admin.guardarCarpeta')}</p>
                  <select value={uploadFolder ?? ''} onChange={e => setUploadFolder(e.target.value || null)}
                    className="w-full rounded-v-sm border border-v-border bg-v-bg px-3.5 py-2.5 text-sm text-v-text outline-none focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft">
                    <option value="">{t('auto.documentosView.inicioSinCarpeta')}</option>
                    {fs.carpetas.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-v-muted">{t('ui.descripcionOpcional')}</p>
                  <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder={t('admin.phDescDoc')}
                    className="w-full rounded-v-sm border border-v-border bg-v-bg px-3.5 py-2.5 text-sm text-v-text outline-none placeholder:text-v-subtle focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft" />
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-v-muted">{t('common.categoria')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.filter(c => c.id !== 'all').map(c => {
                    const CI = CAT_ICON[c.id] || Folder
                    const on = newCat === c.id
                    return (
                      <button key={c.id} type="button" onClick={() => setNewCat(c.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${on ? 'border-v-accent/40 bg-v-accent-soft text-v-accent' : 'border-v-border bg-v-elevated text-v-muted hover:text-v-text'}`}>
                        <CI size={13} /> {locale === 'en' ? c.labelEn : c.label}
                      </button>
                    )
                  })}
                </div>
                {newCat === 'otro' && (
                  <input autoFocus value={otroLabel} onChange={e => setOtroLabel(e.target.value)} placeholder={t('admin.phCategoriaDoc')}
                    className="mt-2 w-full rounded-v-sm border border-v-border bg-v-bg px-3.5 py-2.5 text-sm text-v-text outline-none placeholder:text-v-subtle focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft" />
                )}
              </div>

              {!isPadre && (
                <button type="button" onClick={() => setVisibleParent(!visibleParent)}
                  className={`flex w-full items-center gap-3 rounded-v-sm border p-3 text-left transition-colors ${visibleParent ? 'border-v-success/30 bg-v-success/10' : 'border-v-border bg-v-bg'}`}>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full ${visibleParent ? 'bg-v-success/15 text-v-success' : 'bg-v-fill text-v-subtle'}`}>
                    {visibleParent ? <Eye size={16} /> : <Lock size={15} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-v-text">{t('admin.visibleFamilia')}</span>
                    <span className="block text-xs text-v-subtle">{visibleParent ? (locale === 'en' ? 'The family will see it in their portal' : 'La familia lo verá en su portal') : (locale === 'en' ? 'Only the clinical team will see it' : 'Solo lo verá el equipo clínico')}</span>
                  </span>
                  <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${visibleParent ? 'bg-v-success' : 'bg-v-border'}`}>
                    <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      className={`absolute top-0.5 size-5 rounded-full bg-white shadow ${visibleParent ? 'right-0.5' : 'left-0.5'}`} />
                  </span>
                </button>
              )}

              <motion.button whileTap={{ scale: 0.98 }} onClick={handleUpload} disabled={uploading || selectedFiles.length === 0}
                className="v-brand flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploading ? (locale === 'en' ? 'Uploading…' : 'Subiendo…') : selectedFiles.length > 0 ? (locale === 'en' ? `Upload ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}` : `Subir ${selectedFiles.length} archivo${selectedFiles.length > 1 ? 's' : ''}`) : (locale === 'en' ? 'Choose files to upload' : 'Elige archivos para subir')}
              </motion.button>
            </div>
          </DocModal>
        )}
      </AnimatePresence>

      {/* Filtros (solo si hay docs o búsqueda activa) */}
      {(docs.length > 0 || search) && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 rounded-full border border-v-border bg-v-elevated px-4 py-2.5 shadow-v transition-shadow focus-within:border-v-accent/50 focus-within:ring-4 focus-within:ring-v-accent-soft">
            <Search size={15} className="shrink-0 text-v-subtle" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('admin.phBuscarDoc')}
              className="flex-1 bg-transparent text-sm text-v-text outline-none placeholder:text-v-subtle" />
            {search && <button onClick={() => setSearch('')} className="text-v-subtle hover:text-v-text"><X size={14} /></button>}
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: 'none' }}>
            {CATEGORIES.map(c => {
              const CI = CAT_ICON[c.id] || Folder
              const on = catFilter === c.id
              return (
                <button key={c.id} onClick={() => setCatFilter(c.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${on ? 'border-v-accent/40 bg-v-accent-soft text-v-accent' : 'border-v-border bg-v-elevated text-v-muted hover:text-v-text'}`}>
                  <CI size={13} /> {locale === 'en' ? c.labelEn : c.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-v-accent" /></div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center rounded-v border border-dashed border-v-border bg-v-elevated py-14 text-center">
          <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="mb-3 grid size-14 place-items-center rounded-[30%] bg-v-accent-soft"><FolderOpen size={24} className="text-v-accent" /></motion.span>
          <p className="font-semibold text-v-text">
            {currentFolder ? (locale === 'en' ? 'Empty folder' : 'Carpeta vacía') : (locale === 'en' ? 'No documents yet' : 'Sin documentos aún')}
          </p>
          {canUpload && <p className="mt-1 text-sm text-v-subtle">{locale === 'en' ? 'Upload documents or create subfolders to organize' : 'Sube documentos o crea subcarpetas para organizar'}</p>}
          {canUpload && (
            <button onClick={() => { setUploadFolder(currentFolder); setShowUpload(true) }}
              className="v-brand mt-4 inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold"><Upload size={15} /> {locale === 'en' ? 'Upload document' : 'Subir documento'}</button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Carpetas */}
          {subCarpetas.length > 0 && (
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {subCarpetas.map(carpeta => (
                <motion.div key={carpeta.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }}
                  className="group relative flex cursor-pointer items-center gap-3 rounded-v border border-v-border bg-v-elevated p-3.5 shadow-v transition-colors hover:border-v-warning/40"
                  onClick={() => setCurrentFolder(carpeta.id)}>
                  <span className="grid size-11 shrink-0 place-items-center rounded-[30%] bg-v-warning/15 text-v-warning transition-transform group-hover:scale-105">
                    <Folder size={20} fill="currentColor" fillOpacity={0.2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-v-text">{carpeta.name}</p>
                    <p className="text-xs text-v-subtle">{countInFolder(carpeta.id)} {locale === 'en' ? 'items' : `elemento${countInFolder(carpeta.id) !== 1 ? 's' : ''}`}</p>
                  </div>
                  {canUpload && (
                    <div className="relative" onClick={e => e.stopPropagation()}>
                      <button onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === carpeta.id ? null : carpeta.id) }}
                        className="grid size-8 place-items-center rounded-full text-v-subtle transition-all hover:bg-v-fill hover:text-v-text sm:opacity-0 sm:group-hover:opacity-100">
                        <MoreVertical size={15} />
                      </button>
                      {openMenuId === carpeta.id && (
                        <div className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-v-sm border border-v-border bg-v-elevated p-1 shadow-v-lg" onClick={e => e.stopPropagation()}>
                          <button onClick={() => { setEditingFolder(carpeta); setNewFolderName(carpeta.name); setNewFolderEmoji(carpeta.emoji); setOpenMenuId(null) }}
                            className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-sm text-v-muted hover:bg-v-fill hover:text-v-text">
                            <Edit2 size={13} /> {locale === 'en' ? 'Rename' : 'Renombrar'}
                          </button>
                          <button onClick={async () => { if (await confirmar(t('auto.documentosView.eliminarCarpetaLosDocumentosSe', { v1: String(carpeta.name) }))) { eliminarCarpeta(carpeta.id); setOpenMenuId(null) } }}
                            className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-sm text-v-danger hover:bg-v-danger/10">
                            <Trash2 size={13} /> {locale === 'en' ? 'Delete' : 'Eliminar'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Documentos */}
          {filtered.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((doc, i) => {
                const fic = fileIconCfg(doc.file_type)
                const FIcon = fic.Icon
                const cat = CATEGORIES.find(c => c.id === doc.category)
                return (
                  <motion.div key={doc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 9) * 0.03 }}
                    whileHover={{ y: -3 }}
                    className="group flex flex-col overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v transition-shadow hover:shadow-v-lg">
                    {/* Vista previa: miniatura real para imágenes, ícono grande para el resto */}
                    <button onClick={() => setPreviewId(doc.id)} className="relative block h-36 w-full overflow-hidden bg-v-bg text-left" title={locale === 'en' ? 'Preview' : 'Vista previa'}>
                      {doc.file_type === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fileUrl(doc.file_url)} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : doc.file_type === 'pdf' ? (
                        <PdfThumb src={fileUrl(doc.file_url)} cacheKey={doc.id} color={fic.color} />
                      ) : (
                        <div className="grid size-full place-items-center">
                          <span className="grid size-16 place-items-center rounded-[30%] transition-transform duration-300 group-hover:scale-110" style={{ background: `${fic.color}18`, color: fic.color }}>
                            <FIcon size={30} />
                          </span>
                          <span className="absolute left-3 top-3 rounded-full bg-v-elevated px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-v" style={{ color: fic.color }}>
                            {doc.file_name.split('.').pop()}
                          </span>
                        </div>
                      )}
                      <span className="absolute inset-0 hidden place-items-center bg-[#081426]/0 opacity-0 transition-all group-hover:bg-[#081426]/25 group-hover:opacity-100 [@media(hover:hover)]:grid">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-v-elevated px-3.5 py-1.5 text-xs font-semibold text-v-text shadow-v"><Eye size={13} /> {locale === 'en' ? 'Preview' : 'Vista previa'}</span>
                      </span>
                    </button>

                    <div className="flex flex-1 flex-col p-4">
                      {renamingDoc === doc.id ? (
                        <input autoFocus value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') renombrarDoc(doc, renameValue); if (e.key === 'Escape') setRenamingDoc(null) }}
                          onBlur={() => renombrarDoc(doc, renameValue)}
                          className={`w-full rounded-v-sm border px-2 py-1 text-sm font-semibold outline-none ${inputCls}`} />
                      ) : (
                        <p className="truncate text-sm font-semibold text-v-text" title={doc.file_name}>{doc.file_name}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-v-accent-soft px-2 py-0.5 text-[10px] font-semibold capitalize text-v-accent">{cat ? (locale === 'en' ? cat.labelEn : cat.label) : doc.category}</span>
                        {!isPadre && (doc.visible_to_parent
                          ? <span className="inline-flex items-center gap-1 rounded-full bg-v-success/15 px-2 py-0.5 text-[10px] font-semibold text-v-success"><Eye size={10} /> {locale === 'en' ? 'Family' : 'Familia'}</span>
                          : <span className="inline-flex items-center gap-1 rounded-full bg-v-warning/15 px-2 py-0.5 text-[10px] font-semibold text-v-warning"><Lock size={10} /> {locale === 'en' ? 'Clinical only' : 'Solo clínico'}</span>)}
                      </div>
                      {doc.description && <p className="mt-1.5 line-clamp-2 text-xs text-v-muted">{doc.description}</p>}
                      <p className="mt-auto pt-2 text-[11px] text-v-subtle">{doc.uploader_name} · {formatDate(doc.created_at, locale)} · {formatSize(doc.file_size)}</p>
                    </div>

                    <div className="flex items-center justify-end gap-0.5 border-t border-v-border px-2 py-1.5">
                      <a href={fileUrl(doc.file_url, { download: true })} download={doc.file_name} target="_blank" rel="noopener noreferrer" title={locale === 'en' ? 'Download' : 'Descargar'}
                        className="grid size-8 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-accent-soft hover:text-v-accent"><Download size={14} /></a>
                      {canUpload && (
                        <button onClick={() => { setRenamingDoc(doc.id); setRenameValue(doc.file_name) }} title={t('admin.renombrar')}
                          className="grid size-8 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-fill hover:text-v-text"><Edit2 size={14} /></button>
                      )}
                      {canUpload && (
                        <button onClick={() => setMovingDoc(doc)} title={t('admin.moverCarpeta')}
                          className="grid size-8 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-fill hover:text-v-text"><FolderInput size={14} /></button>
                      )}
                      {canToggleVisibility && (
                        <button onClick={() => toggleVisibility(doc)}
                          title={doc.visible_to_parent ? (locale === 'en' ? 'Hide from family' : 'Ocultar a familia') : (locale === 'en' ? 'Show to family' : 'Mostrar a familia')}
                          className={`grid size-8 place-items-center rounded-full transition-colors hover:bg-v-fill ${doc.visible_to_parent ? 'text-v-success' : 'text-v-subtle'}`}>
                          {doc.visible_to_parent ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(doc)} title={t('common.eliminar')}
                          className="grid size-8 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-danger/10 hover:text-v-danger"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
          {filtered.length === 0 && (search || catFilter !== 'all') && (
            <p className="py-8 text-center text-sm text-v-subtle">{locale === 'en' ? 'No documents match the search.' : 'Ningún documento coincide con la búsqueda.'}</p>
          )}
        </div>
      )}

      {/* Visor de documentos */}
      <AnimatePresence>
        {previewDoc && (
          <DocPreview doc={previewDoc} total={filtered.length} index={previewIndex}
            onClose={() => setPreviewId(null)}
            onPrev={previewIndex > 0 ? () => setPreviewId(filtered[previewIndex - 1].id) : undefined}
            onNext={previewIndex < filtered.length - 1 ? () => setPreviewId(filtered[previewIndex + 1].id) : undefined} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Visor: PDF, imágenes, video y audio en la app; Word/Excel se descargan ─────
function DocPreview({ doc, index, total, onClose, onPrev, onNext }: {
  doc: Doc; index: number; total: number; onClose: () => void; onPrev?: () => void; onNext?: () => void
}) {
  const { locale } = useI18n()
  const fic = fileIconCfg(doc.file_type)
  const FIcon = fic.Icon
  const ext = (doc.file_name.split('.').pop() || '').toLowerCase()
  const isVideo = ['mp4', 'webm', 'mov'].includes(ext)
  const isAudio = ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)

  const noPreview = (
    <div className="w-full max-w-sm rounded-v-lg bg-v-elevated p-8 text-center shadow-v-lg">
                <span className="mx-auto mb-4 grid size-16 place-items-center rounded-[30%]" style={{ background: `${fic.color}18`, color: fic.color }}><FIcon size={30} /></span>
                <p className="font-semibold text-v-text">{locale === 'en' ? 'This file could not be previewed' : 'No se pudo mostrar este archivo'}</p>
                <p className="mt-1 text-sm text-v-muted">{locale === 'en' ? 'Old .doc/.xls formats or damaged files can only be opened after downloading.' : 'Los formatos antiguos (.doc, .xls) o archivos dañados solo se abren descargándolos.'}</p>
                <a href={fileUrl(doc.file_url, { download: true })} download={doc.file_name} target="_blank" rel="noopener noreferrer"
                  className="v-brand mt-5 inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold"><Download size={15} /> {locale === 'en' ? 'Download' : 'Descargar'}</a>
              </div>
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev?.()
      if (e.key === 'ArrowRight') onNext?.()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose, onPrev, onNext])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="v-scope fixed inset-0 z-[120] flex flex-col bg-[#081426]/80 backdrop-blur-md" onClick={onClose}>
      {/* Barra superior */}
      <div className="flex items-center gap-3 px-4 py-3 text-white" onClick={e => e.stopPropagation()}>
        <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-elevated/10"><FIcon size={19} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{doc.file_name}</p>
          <p className="text-xs text-white/60">{doc.uploader_name} · {formatDate(doc.created_at, locale)} · {formatSize(doc.file_size)}{total > 1 ? ` · ${index + 1}/${total}` : ''}</p>
        </div>
        <a href={fileUrl(doc.file_url, { download: true })} download={doc.file_name} target="_blank" rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-v-elevated/10 px-3.5 text-xs font-semibold transition-colors hover:bg-v-elevated/20">
          <Download size={14} /> <span className="hidden sm:inline">{locale === 'en' ? 'Download' : 'Descargar'}</span>
        </a>
        <a href={fileUrl(doc.file_url)} target="_blank" rel="noopener noreferrer" title={locale === 'en' ? 'Open in new tab' : 'Abrir en pestaña nueva'}
          className="grid size-9 place-items-center rounded-full bg-v-elevated/10 transition-colors hover:bg-v-elevated/20"><ExternalLink size={15} /></a>
        <button onClick={onClose} title={locale === 'en' ? 'Close' : 'Cerrar'}
          className="grid size-9 place-items-center rounded-full bg-v-elevated/10 transition-colors hover:bg-v-elevated/20"><X size={17} /></button>
      </div>

      {/* Contenido */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 sm:px-16" onClick={e => e.stopPropagation()}>
        {onPrev && (
          <button onClick={onPrev} className="absolute left-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-v-elevated/10 text-white transition-colors hover:bg-v-elevated/25"><ChevronRight size={20} className="rotate-180" /></button>
        )}
        {onNext && (
          <button onClick={onNext} className="absolute right-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-v-elevated/10 text-white transition-colors hover:bg-v-elevated/25"><ChevronRight size={20} /></button>
        )}
        <AnimatePresence mode="wait">
          <motion.div key={doc.id} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.18 }}
            className="flex size-full items-center justify-center">
            {doc.file_type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl(doc.file_url)} alt={doc.file_name} className="max-h-full max-w-full rounded-v object-contain shadow-v-lg" />
            ) : doc.file_type === 'pdf' ? (
              <iframe src={`${fileUrl(doc.file_url)}#view=FitH`} title={doc.file_name} className="size-full max-w-5xl rounded-v bg-v-elevated shadow-v-lg" />
            ) : isVideo ? (
              <video src={fileUrl(doc.file_url)} controls className="max-h-full max-w-full rounded-v shadow-v-lg" />
            ) : ext === 'docx' ? (
              <DocxPreview src={fileUrl(doc.file_url)} fallback={noPreview} />
            ) : ['xlsx', 'csv'].includes(ext) ? (
              <SheetPreview src={fileUrl(doc.file_url)} ext={ext} fallback={noPreview} />
            ) : isAudio ? (
              <div className="w-full max-w-md rounded-v bg-v-elevated p-6 shadow-v-lg">
                <p className="mb-3 truncate text-sm font-semibold text-v-text">{doc.file_name}</p>
                <audio src={fileUrl(doc.file_url)} controls className="w-full" />
              </div>
            ) : noPreview}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ── Ventana base de Documentos ─────────────────────────────────────────────────
function DocModal({ icon: Icon, title, subtitle, wide, onClose, children }: {
  icon: any; title: string; subtitle?: string; wide?: boolean; onClose: () => void; children: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="v-scope fixed inset-0 z-[110] flex items-end justify-center bg-[#081426]/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }} onClick={e => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-v-lg border border-v-border bg-v-elevated shadow-v-lg sm:rounded-v-lg ${wide ? 'sm:max-w-xl' : 'sm:max-w-sm'}`}>
        <div className="flex items-start gap-3 px-5 pb-3 pt-5">
          <span className="v-brand grid size-10 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><Icon size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold tracking-tight text-v-text">{title}</p>
            {subtitle && <p className="truncate text-xs text-v-subtle">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-fill hover:text-v-text"><X size={17} /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
      </motion.div>
    </motion.div>
  )
}

// ── Miniatura de PDF: dibuja la primera página (se carga al aparecer en pantalla) ──
const pdfThumbCache = new Map<string, string>()

function PdfThumb({ src, cacheKey, color }: { src: string; cacheKey: string; color: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<string | null>(() => pdfThumbCache.get(cacheKey) ?? null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (thumb || failed || !ref.current) return
    let cancelled = false
    const el = ref.current
    const io = new IntersectionObserver(async entries => {
      if (!entries.some(e => e.isIntersecting)) return
      io.disconnect()
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
        const pdf = await pdfjs.getDocument({ url: new URL(src, window.location.origin).toString(), disableAutoFetch: true, isEvalSupported: false, verbosity: 0 } as any).promise
        const page = await pdf.getPage(1)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: 480 / base.width })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport } as any).promise
        const url = canvas.toDataURL('image/jpeg', 0.82)
        pdf.destroy()
        pdfThumbCache.set(cacheKey, url)
        if (!cancelled) setThumb(url)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => { cancelled = true; io.disconnect() }
  }, [src, cacheKey, thumb, failed])

  return (
    <div ref={ref} className="relative size-full bg-white">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="size-full object-cover object-top transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className={`grid size-full place-items-center ${failed ? 'bg-v-bg' : 'animate-pulse bg-v-fill'}`}>
          <span className="grid size-16 place-items-center rounded-[30%]" style={{ background: `${color}18`, color }}><FileText size={30} /></span>
        </div>
      )}
      <span className="absolute left-3 top-3 rounded-full bg-v-elevated px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-v" style={{ color }}>PDF</span>
    </div>
  )
}

// ── Word (.docx) dibujado en el navegador: el archivo no sale a ningún servicio externo ──
function DocxPreview({ src, fallback }: { src: string; fallback: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(src)
        if (!res.ok) throw new Error(String(res.status))
        const blob = await res.blob()
        const { renderAsync } = await import('docx-preview')
        if (cancelled || !ref.current) return
        ref.current.innerHTML = ''
        await renderAsync(blob, ref.current, undefined, { inWrapper: true, ignoreLastRenderedPageBreak: false, breakPages: true, experimental: true })
        if (!cancelled) setState('ok')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => { cancelled = true }
  }, [src])
  if (state === 'error') return <>{fallback}</>
  return (
    <div className="relative size-full max-w-5xl overflow-auto rounded-v bg-[#e9edf2] shadow-v-lg">
      {state === 'loading' && (
        <div className="absolute inset-0 grid place-items-center"><Loader2 size={26} className="animate-spin text-v-accent" /></div>
      )}
      <div ref={ref} className="docx-host [&_.docx-wrapper]:!bg-transparent [&_.docx-wrapper]:!p-6 [&_section.docx]:!mb-6 [&_section.docx]:!shadow-v" />
    </div>
  )
}

// ── Excel (.xlsx) / CSV como tabla, con pestañas por hoja ─────────────────────
function SheetPreview({ src, ext, fallback }: { src: string; ext: string; fallback: React.ReactNode }) {
  const [sheets, setSheets] = useState<{ name: string; rows: string[][] }[] | null>(null)
  const [active, setActive] = useState(0)
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(src)
        if (!res.ok) throw new Error(String(res.status))
        const MAX_ROWS = 300, MAX_COLS = 30
        let out: { name: string; rows: string[][] }[]
        if (ext === 'csv') {
          const text = await res.text()
          const sep = (text.split('\n')[0].match(/;/g)?.length ?? 0) > (text.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ','
          out = [{ name: 'CSV', rows: text.split(/\r?\n/).filter(Boolean).slice(0, MAX_ROWS).map(l => l.split(sep).slice(0, MAX_COLS)) }]
        } else {
          const ExcelJS = (await import('exceljs')).default
          const wb = new ExcelJS.Workbook()
          await wb.xlsx.load(await res.arrayBuffer())
          out = wb.worksheets.map(ws => {
            const rows: string[][] = []
            ws.eachRow({ includeEmpty: false }, row => {
              if (rows.length >= MAX_ROWS) return
              const vals = (row.values as any[]).slice(1, MAX_COLS + 1).map(v =>
                v == null ? '' : typeof v === 'object' ? (v.text ?? v.result ?? (v instanceof Date ? v.toLocaleDateString() : v.richText?.map((r: any) => r.text).join('') ?? '')) : String(v))
              rows.push(vals)
            })
            return { name: ws.name, rows }
          })
        }
        if (!cancelled) setSheets(out)
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => { cancelled = true }
  }, [src, ext])
  if (error) return <>{fallback}</>
  if (!sheets) return <Loader2 size={26} className="animate-spin text-white" />
  const sheet = sheets[active] ?? sheets[0]
  const cols = Math.max(1, ...sheet.rows.map(r => r.length))
  return (
    <div className="flex size-full max-w-6xl flex-col overflow-hidden rounded-v bg-v-elevated shadow-v-lg">
      {sheets.length > 1 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-v-border p-2">
          {sheets.map((sh, i) => (
            <button key={sh.name + i} onClick={() => setActive(i)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${i === active ? 'bg-v-accent-soft text-v-accent' : 'text-v-muted hover:bg-v-fill'}`}>{sh.name}</button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-max min-w-full border-collapse text-sm">
          <tbody>
            {sheet.rows.map((r, ri) => (
              <tr key={ri} className={ri === 0 ? 'sticky top-0 bg-v-fill font-semibold text-v-text' : 'text-v-muted even:bg-v-bg'}>
                <td className="border border-v-border bg-v-fill px-2 py-1.5 text-right text-[11px] tabular-nums text-v-subtle">{ri + 1}</td>
                {Array.from({ length: cols }, (_, ci) => (
                  <td key={ci} className="max-w-[280px] truncate border border-v-border px-3 py-1.5" title={r[ci] || ''}>{r[ci] || ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
