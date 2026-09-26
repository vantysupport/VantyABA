'use client'

import { fileUrl } from '@/lib/file-url'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'
import { subirArchivoPrivado } from '@/lib/subir-archivo'
import { useToast } from '@/components/Toast'
import { useTheme } from '@/components/ThemeContext'
import {
  Send, Loader2, MessageCircle, CheckCheck, Check,
  Search, RefreshCw, Users, Circle, Paperclip, Mic,
  MicOff, X, FileText, Play, Pause, Square,
  Reply, Copy, Forward, Pin, Star, Flag, Trash2,
  MoreVertical, Camera, Smile, ChevronLeft, Heart, MoreHorizontal
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import ChatFamilias from './ChatFamilias'
import { ChatAudio } from '@/components/ui/chat-audio'

// ─── Emojis de reacción (estilo WhatsApp) ────────────────────────────────────
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface Especialista {
  id: string
  full_name: string
  specialty: string | null
  role: string
  unread: number
  lastMessage: string | null
  lastTime: string | null
  avatar_url?: string | null
}

interface Mensaje {
  id: string
  content: string
  sender_id: string
  sender_role: string
  sender_name: string
  created_at: string
  read_at: string | null
  message_type?: 'text' | 'file' | 'audio'
  file_url?: string | null
  file_name?: string | null
  file_type?: string | null
  reaction?: string | null
  is_pinned?: boolean
  is_starred?: boolean
}

interface ContextMenu {
  msgId: string
  x: number
  y: number
}

// ─── Avatar helper ────────────────────────────────────────────────────────────
function Avatar({ name, avatarUrl, size = 'md', online = false }: { name: string; avatarUrl?: string | null; size?: 'sm' | 'md' | 'lg'; online?: boolean }) {
  const sz = size === 'sm' ? 'size-8 text-xs' : size === 'lg' ? 'size-11 text-base' : 'size-10 text-sm'
  const [error, setError] = useState(false)
  return (
    <div className="relative shrink-0">
      {avatarUrl && !error ? (
        // El bucket de chat es privado: fileUrl() pasa por /api/files (URL firmada)
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl(avatarUrl)} alt={name} onError={() => setError(true)} className={`${sz} rounded-full object-cover ring-2 ring-[var(--v-bg-elevated)]`} />
      ) : (
        <div className={`${sz} grid place-items-center rounded-full bg-v-accent-soft font-semibold text-v-accent`}>{(name || '?').charAt(0).toUpperCase()}</div>
      )}
      {online && <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-v-success ring-2 ring-[var(--v-bg-elevated)]" />}
    </div>
  )
}

// ─── Upload de avatar ─────────────────────────────────────────────────────────
function AvatarUpload({
  userId,
  currentUrl,
  name,
  onUpdate,
}: {
  userId: string
  currentUrl?: string | null
  name: string
  onUpdate: (url: string) => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('auto.chatEspecialistas.maximo5mbParaLaFoto'))
      return
    }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${userId}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('chat-files')
        .upload(path, file, { contentType: file.type, upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(path)
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId)
      onUpdate(publicUrl)
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="relative group cursor-pointer" onClick={() => inputRef.current?.click()}>
      <Avatar name={name} avatarUrl={currentUrl} size="lg" />
      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        {uploading
          ? <Loader2 size={14} className="animate-spin text-white" />
          : <Camera size={14} className="text-white" />}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </div>
  )
}

// ─── Menú contextual WhatsApp ─────────────────────────────────────────────────
function MessageContextMenu({
  menu,
  esMio,
  onClose,
  onReply,
  onCopy,
  onReact,
  onForward,
  onPin,
  onStar,
  onReport,
  onDelete,
}: {
  menu: ContextMenu
  esMio: boolean
  onClose: () => void
  onReply: () => void
  onCopy: () => void
  onReact: (emoji: string) => void
  onForward: () => void
  onPin: () => void
  onStar: () => void
  onReport: () => void
  onDelete: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Ajustar posición para que no salga del viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    top: menu.y,
    left: menu.x,
    zIndex: 9999,
  }

  return (
    <motion.div ref={ref} style={style} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.12 }} className="v-scope">
      <div className="mb-1.5 flex items-center gap-1 rounded-full border border-v-border bg-v-elevated px-2.5 py-1.5 shadow-v-lg">
        {REACTION_EMOJIS.map(emoji => (
          <button key={emoji} onClick={() => { onReact(emoji); onClose() }} className="p-0.5 text-xl transition-transform hover:scale-125 active:scale-90">{emoji}</button>
        ))}
      </div>
      <div className="min-w-[190px] overflow-hidden rounded-v-sm border border-v-border bg-v-elevated p-1 shadow-v-lg">
        {[
          { icon: Reply, label: L('Reply', 'Responder'), action: onReply },
          { icon: Copy, label: L('Copy', 'Copiar'), action: onCopy },
          { icon: Forward, label: L('Forward', 'Reenviar'), action: onForward },
          { icon: Pin, label: L('Pin', 'Fijar'), action: onPin },
          { icon: Star, label: L('Star', 'Destacar'), action: onStar },
        ].map(({ icon: Icon, label, action }) => (
          <button key={label} onClick={() => { action(); onClose() }}
            className="flex w-full items-center gap-3 rounded-v-sm px-3 py-2 text-sm text-v-text transition-colors hover:bg-v-fill">
            <Icon size={15} className="text-v-muted" /> {label}
          </button>
        ))}
        <div className="my-1 h-px bg-v-border" />
        {esMio ? (
          <button onClick={() => { onDelete(); onClose() }} className="flex w-full items-center gap-3 rounded-v-sm px-3 py-2 text-sm text-v-danger transition-colors hover:bg-v-danger/10">
            <Trash2 size={15} /> {L('Delete', 'Eliminar')}
          </button>
        ) : (
          <button onClick={() => { onReport(); onClose() }} className="flex w-full items-center gap-3 rounded-v-sm px-3 py-2 text-sm text-v-warning transition-colors hover:bg-v-warning/10">
            <Flag size={15} /> {L('Report', 'Reportar')}
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

// El texto del chat del equipo se guarda cifrado: se envía y se lee por /api/chat-equipo.
async function insertarMensaje(fila: Record<string, unknown>) {
  const r = await fetch('/api/chat-equipo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fila) })
  const j = await r.json().catch(() => ({}))
  return { data: j.data ?? null, error: r.ok ? null : new Error(j.error || 'No se pudo enviar') }
}
async function mensajeCifradoPorId(id: string) {
  const r = await fetch(`/api/chat-equipo?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
  return r.ok ? ((await r.json()).data ?? null) : null
}

export default function ChatEspecialistas({
  userId,
  userName,
  userAvatarUrl,
  onAvatarUpdate,
}: {
  userId: string
  userName: string
  userAvatarUrl?: string | null
  onAvatarUpdate?: (url: string) => void
}) {
  const { t, locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  // Rol legible (en la base se guarda el código: "jefe", "especialista"…)
  const roleLabel = (r: string) => {
    const es: Record<string, string> = { especialista: 'Especialista', terapeuta: 'Terapeuta', jefe: 'Director(a)', admin: 'Administrador(a)', secretaria: 'Secretaría', padre: 'Familia' }
    const en: Record<string, string> = { especialista: 'Specialist', terapeuta: 'Therapist', jefe: 'Director', admin: 'Administrator', secretaria: 'Front desk', padre: 'Parent' }
    const k = String(r || '').toLowerCase()
    return (locale === 'en' ? en : es)[k] || r
  }
  const toast = useToast()
  const { isDark } = useTheme()
  const [activeMainTab, setActiveMainTab] = useState<'equipo' | 'familias'>('equipo')
  const [especialistas, setEspecialistas] = useState<Especialista[]>([])
  const [seleccionado, setSeleccionado] = useState<Especialista | null>(null)
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [loadingEsp, setLoadingEsp] = useState(true)
  const [loadingMsg, setLoadingMsg] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  // Audio
  const [grabando, setGrabando] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [reproduciendo, setReproduciendo] = useState<string | null>(null)
  const [tiempoGrabacion, setTiempoGrabacion] = useState(0)

  // Avatar propio (actualizable)
  const [myAvatar, setMyAvatar] = useState<string | null | undefined>(userAvatarUrl)

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [contextMsgId, setContextMsgId] = useState<string | null>(null)

  // Reply
  const [replyTo, setReplyTo] = useState<Mensaje | null>(null)

  // Refs
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})

  const scrollAbajo = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }, [])

  // ── Cargar especialistas ──────────────────────────────────────────────────
  const cargarEspecialistas = useCallback(async () => {
    try {
      const { data: perfilesRaw } = await supabase
        .from('profiles')
        .select('id, full_name, specialty, role, avatar_url')
        .in('role', ['especialista', 'terapeuta', 'admin', 'jefe'])
        .order('full_name')
      if (!perfilesRaw) return
      // Excluir al propio usuario de la lista de contactos
      const perfiles = perfilesRaw.filter((p) => p.id !== userId)

      const resumenRes = await fetch('/api/chat-equipo?resumen=1', { cache: 'no-store' })
      const resumen: Record<string, { last: { content: string | null; created_at: string; message_type: string | null } | null; unread: number }> = resumenRes.ok ? (await resumenRes.json()).data || {} : {}
      const conInfo = perfiles.map((p) => {
        const r = resumen[p.id]
        const last = r?.last
        let preview = last?.content || null
        if (last?.message_type === 'file') preview = '📎 ' + L('File', 'Archivo')
        if (last?.message_type === 'audio') preview = '🎤 ' + L('Voice note', 'Nota de voz')
        return { ...p, unread: r?.unread || 0, lastMessage: preview, lastTime: last?.created_at || null }
      })
      conInfo.sort((a, b) => {
        if (b.unread !== a.unread) return b.unread - a.unread
        if (a.lastTime && b.lastTime)
          return new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()
        return 0
      })
      setEspecialistas(conInfo)
    } catch {
      toast.error(t('auto.chatEspecialistas.errorAlCargarEspecialistas'))
    } finally {
      setLoadingEsp(false)
    }
  }, [userId])

  // ── Cargar mensajes ───────────────────────────────────────────────────────
  const cargarMensajes = useCallback(
    async (espId: string) => {
      setLoadingMsg(true)
      try {
        const res = await fetch(`/api/chat-equipo?con=${espId}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('chat')
        const data = (await res.json()).data as Mensaje[]
        setMensajes(data || [])
        scrollAbajo()
        setEspecialistas((prev) =>
            prev.map((e) => (e.id === espId ? { ...e, unread: 0 } : e))
          )
      } catch {
        toast.error(t('auto.chatEspecialistas.errorAlCargarMensajes'))
      } finally {
        setLoadingMsg(false)
      }
    },
    [scrollAbajo]
  )

  useEffect(() => {
    cargarEspecialistas()
  }, [cargarEspecialistas])

  useEffect(() => {
    if (!seleccionado) return
    cargarMensajes(seleccionado.id)
    const channel = supabase
      .channel('admin_chat_' + seleccionado.id)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_especialista_admin' },
        (payload) => {
          const aviso = payload.new as Mensaje & { recipient_id?: string }
          // Solo mensajes de ESTA conversación
          const esEstaConv = (aviso.sender_id === userId && aviso.recipient_id === seleccionado.id) ||
                             (aviso.sender_id === seleccionado.id && aviso.recipient_id === userId)
          if (!esEstaConv) { cargarEspecialistas(); return }
          // El aviso trae el texto cifrado: se pide el mensaje al servidor
          mensajeCifradoPorId(aviso.id).then((nuevo: Mensaje | null) => {
            if (!nuevo) return
            setMensajes((prev) => prev.find((m) => m.id === nuevo.id) ? prev : [...prev.filter((m) => !(m.id.startsWith('temp_') && m.content === nuevo.content)), nuevo])
            scrollAbajo()
          })
          const nuevo = aviso
          if (nuevo.sender_id !== userId) {
            supabase
              .from('chat_especialista_admin')
              .update({ read_at: new Date().toISOString() })
              .eq('id', nuevo.id)
              .then(() => {})
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [seleccionado, cargarMensajes, cargarEspecialistas, userId, scrollAbajo])

  useEffect(() => {
    scrollAbajo()
  }, [mensajes, scrollAbajo])

  // ── Enviar texto ──────────────────────────────────────────────────────────
  const enviar = async () => {
    const contenido = texto.trim()
    if (!contenido || enviando || !seleccionado) return
    setEnviando(true)
    setTexto('')
    setReplyTo(null)

    const contentFinal = replyTo
      ? `↩ ${replyTo.sender_name}: "${replyTo.content.slice(0, 60)}"\n\n${contenido}`
      : contenido

    // Optimistic update — mostrar el mensaje de inmediato sin esperar Realtime
    const tempId = 'temp_' + Date.now()
    const mensajeOptimista: Mensaje = {
      id: tempId,
      content: contentFinal,
      sender_id: userId || '',
      sender_role: 'jefe',
      sender_name: userName || '',
      created_at: new Date().toISOString(),
      read_at: null,
      message_type: 'text',
    }
    setMensajes(prev => [...prev, mensajeOptimista])
    scrollAbajo()

    try {
      const { data, error } = await insertarMensaje({
        content: contentFinal,
        sender_id: userId,
        sender_role: 'jefe',
        sender_name: userName,
        recipient_id: seleccionado.id,
        message_type: 'text',
        read_at: null,
      })
      if (error) throw error
      // Reemplazar el mensaje temporal con el real (con id definitivo de BD)
      if (data) {
        setMensajes(prev => prev.map(m => m.id === tempId ? data : m))
      }
    } catch {
      toast.error(t('auto.chatEspecialistas.errorAlEnviar'))
      // Revertir el optimista si falló
      setMensajes(prev => prev.filter(m => m.id !== tempId))
      setTexto(contenido)
    } finally {
      setEnviando(false)
      textareaRef.current?.focus()
    }
  }

  // ── Archivo ───────────────────────────────────────────────────────────────
  const handleArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !seleccionado) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('auto.chatEspecialistas.maximo10mb'))
      return
    }
    setSubiendo(true)
    try {
      // Directo a R2 (privado); las fotos se comprimen antes de subir
      const { url: publicUrl } = await subirArchivoPrivado('chat-files', `chat/${userId}`, file)
      const isImage = file.type.startsWith('image/')
      const { error } = await insertarMensaje({
        content: isImage ? '📷 Imagen' : `📎 ${file.name}`,
        sender_id: userId,
        sender_role: 'jefe',
        sender_name: userName,
        recipient_id: seleccionado.id,
        message_type: 'file',
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type,
        read_at: null,
      })
      if (error) throw new Error(error.message)
      toast.success(t('auto.chatEspecialistas.archivoEnviado'))
    } catch (err) {
      toast.error(t('auto.chatEspecialistas.errorAlSubir', { v1: String(err instanceof Error ? err.message : 'Error desconocido') }))
    } finally {
      setSubiendo(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Grabación ─────────────────────────────────────────────────────────────
  const iniciarGrabacion = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      audioChunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
      }
      mr.start()
      setGrabando(true)
      setTiempoGrabacion(0)
      timerRef.current = setInterval(
        () => setTiempoGrabacion((t) => t + 1),
        1000
      )
    } catch {
      toast.error(t('auto.chatEspecialistas.noSePudoAccederAl'))
    }
  }

  const detenerGrabacion = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setGrabando(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  // En móvil usamos tap-toggle en lugar de press-and-hold
  const handleMicTouch = (e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (grabando) {
      detenerGrabacion()
    } else {
      iniciarGrabacion()
    }
  }

  const cancelarAudio = () => {
    setAudioBlob(null)
    setAudioUrl(null)
    setTiempoGrabacion(0)
  }

  const enviarAudio = async () => {
    if (!audioBlob || !seleccionado) return
    setSubiendo(true)
    try {
      const audioName = `audio_${Date.now()}.webm`
      const { url: publicUrl } = await subirArchivoPrivado('chat-files', `chat/${userId}`, new File([audioBlob], audioName, { type: 'audio/webm' }))
      const { error } = await insertarMensaje({
        content: '🎤 ' + L('Voice note', 'Nota de voz'),
        sender_id: userId,
        sender_role: 'jefe',
        sender_name: userName,
        recipient_id: seleccionado.id,
        message_type: 'audio',
        file_url: publicUrl,
        file_name: audioName,
        file_type: 'audio/webm',
        read_at: null,
      })
      if (error) throw new Error(error.message)
      cancelarAudio()
      toast.success(t('auto.chatEspecialistas.audioEnviado'))
    } catch (err) {
      toast.error(
        `Error al enviar audio: ${err instanceof Error ? err.message : 'Error desconocido'}`
      )
    } finally {
      setSubiendo(false)
    }
  }

  // Precargar notas de voz apenas llegan los mensajes → reproducción instantánea
  useEffect(() => {
    mensajes.forEach((m) => {
      if (m.message_type === 'audio' && m.file_url && !audioRefs.current[m.id]) {
        const a = new Audio()
        a.preload = 'auto'
        a.src = m.file_url
        a.onended = () => setReproduciendo(null)
        audioRefs.current[m.id] = a
      }
    })
  }, [mensajes])

  const toggleAudio = (id: string, url: string) => {
    if (reproduciendo === id) {
      audioRefs.current[id]?.pause()
      setReproduciendo(null)
    } else {
      Object.values(audioRefs.current).forEach((a) => a.pause())
      if (!audioRefs.current[id]) {
        const audio = new Audio(url)
        audio.preload = 'auto'
        audio.onended = () => setReproduciendo(null)
        audioRefs.current[id] = audio
      }
      audioRefs.current[id].play()
      setReproduciendo(id)
    }
  }

  // ── Context menu ──────────────────────────────────────────────────────────
  const openContextMenu = (
    e: React.MouseEvent,
    msgId: string
  ) => {
    e.preventDefault()
    const x = Math.min(e.clientX, window.innerWidth - 220)
    const y = Math.min(e.clientY, window.innerHeight - 320)
    setContextMenu({ msgId, x, y })
    setContextMsgId(msgId)
  }

  const handleReaction = async (msgId: string, emoji: string) => {
    await supabase
      .from('chat_especialista_admin')
      .update({ reaction: emoji } as any)
      .eq('id', msgId)
    setMensajes((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, reaction: emoji } : m))
    )
  }

  const handleDelete = async (msgId: string) => {
    const adjunto = mensajes.find((m) => m.id === msgId)?.file_url
    await supabase.from('chat_especialista_admin').delete().eq('id', msgId)
    // Borra también el archivo del mensaje (imagen, documento o nota de voz)
    if (adjunto) {
      const { data: { session } } = await supabase.auth.getSession()
      fetch('/api/files/delete', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify({ url: adjunto }) }).catch(() => {})
    }
    setMensajes((prev) => prev.filter((m) => m.id !== msgId))
  }

  const handleCopy = (msgId: string) => {
    const msg = mensajes.find((m) => m.id === msgId)
    if (msg) navigator.clipboard.writeText(msg.content)
    toast.success(t('auto.chatEspecialistas.copiado'))
  }

  // ── Utilidades ────────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  const formatHora = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale === 'en' ? 'en-US' : 'es-PE', {
      hour: '2-digit',
      minute: '2-digit',
    })
  const formatFecha = (iso: string) => {
    const d = new Date(iso),
      hoy = new Date(),
      ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)
    if (d.toDateString() === hoy.toDateString()) return 'Hoy'
    if (d.toDateString() === ayer.toDateString()) return 'Ayer'
    return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })
  }
  const formatTiempo = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const mensajesAgrupados: { fecha: string; items: Mensaje[] }[] = []
  mensajes.forEach((m) => {
    const fecha = formatFecha(m.created_at)
    const last = mensajesAgrupados[mensajesAgrupados.length - 1]
    if (last && last.fecha === fecha) last.items.push(m)
    else mensajesAgrupados.push({ fecha, items: [m] })
  })

  const filtrados = especialistas.filter((e) =>
    e.full_name.toLowerCase().includes(busqueda.toLowerCase())
  )
  const filtradosAdmins = filtrados.filter((e) => ['admin', 'jefe'].includes(e.role))
  const filtradosEspecialistas = filtrados.filter((e) => ['especialista', 'terapeuta'].includes(e.role))

  const contextMsg = contextMsgId ? mensajes.find((m) => m.id === contextMsgId) : null

  // Fila de contacto (admins y especialistas comparten el mismo diseño)
  const contactoRow = (esp: Especialista) => {
    const sel = seleccionado?.id === esp.id
    return (
      <button key={esp.id} onClick={() => { setSeleccionado(esp); setMobileShowChat(true) }}
        className={`flex w-full items-center gap-3 rounded-v-sm px-3 py-2.5 text-left transition-colors ${sel ? 'bg-v-accent-soft' : 'hover:bg-v-fill'}`}>
        <Avatar name={esp.full_name} avatarUrl={esp.avatar_url} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className={`min-w-0 flex-1 truncate text-sm ${esp.unread > 0 ? 'font-bold text-v-text' : sel ? 'font-semibold text-v-accent' : 'font-semibold text-v-text'}`}>{esp.full_name}</p>
            {esp.lastTime && <span className={`shrink-0 text-[11px] ${esp.unread > 0 ? 'font-semibold text-v-accent' : 'text-v-subtle'}`}>{formatHora(esp.lastTime)}</span>}
          </div>
          <div className="flex items-center gap-2">
            <p className={`min-w-0 flex-1 truncate text-xs ${esp.unread > 0 ? 'font-medium text-v-text' : 'text-v-subtle'}`}>
              {esp.lastMessage || esp.specialty || (['jefe', 'admin'].includes(esp.role) ? (esp.role === 'jefe' ? L('Director', 'Director(a)') : L('Administrator', 'Administrador')) : roleLabel(esp.role))}
            </p>
            {esp.unread > 0 && <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-v-accent px-1.5 text-[10px] font-bold text-white">{esp.unread > 9 ? '9+' : esp.unread}</span>}
          </div>
        </div>
      </button>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {contextMenu && contextMsg && (
        <MessageContextMenu
          menu={contextMenu}
          esMio={contextMsg.sender_id === userId}
          onClose={() => { setContextMenu(null); setContextMsgId(null) }}
          onReply={() => setReplyTo(contextMsg)}
          onCopy={() => handleCopy(contextMsg.id)}
          onReact={(emoji) => handleReaction(contextMsg.id, emoji)}
          onForward={() => toast.success(t('auto.chatEspecialistas.funcionDeReenvioProximamente'))}
          onPin={() => toast.success(t('auto.chatEspecialistas.mensajeFijado'))}
          onStar={() => toast.success(t('auto.chatEspecialistas.mensajeDestacado'))}
          onReport={() => toast.success(t('auto.chatEspecialistas.mensajeReportado'))}
          onDelete={() => handleDelete(contextMsg.id)}
        />
      )}

      <div className="v-scope flex h-full min-h-0 flex-col gap-3 p-3 md:p-4">

      {/* Equipo / Familias */}
      <div className="flex w-full shrink-0 gap-1 rounded-full bg-v-fill p-1 sm:w-fit">
        {(['equipo', 'familias'] as const).map(tab => {
          const on = activeMainTab === tab
          return (
            <button key={tab} onClick={() => setActiveMainTab(tab)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold transition-colors sm:flex-none ${on ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
              {on && <motion.span layoutId="chat-main-tab" className="absolute inset-0 rounded-full bg-v-elevated shadow-v" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              {tab === 'equipo' ? <Users size={15} className="relative" /> : <Heart size={15} className="relative" />}
              <span className="relative">{tab === 'equipo' ? t('admin.chatEquipo') : t('admin.chatFamilias')}</span>
            </button>
          )
        })}
      </div>

      {activeMainTab === 'familias' ? (
        <div className="min-h-0 flex-1 overflow-hidden rounded-v shadow-v">
          <ChatFamilias userId={userId} userName={userName} isDark={isDark} />
        </div>
      ) : (
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v">

        {/* ── Contactos ── */}
        <div className={`${mobileShowChat ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-v-border md:w-[300px]`}>
          <div className="space-y-3 border-b border-v-border p-3">
            <div className="flex items-center gap-3 px-1">
              <AvatarUpload userId={userId} currentUrl={myAvatar} name={userName} onUpdate={(url) => { setMyAvatar(url); onAvatarUpdate?.(url) }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-v-text">{userName}</p>
                <p className="text-[11px] text-v-subtle">{t('admin.tocaFoto')}</p>
              </div>
              <button onClick={cargarEspecialistas} title={L('Refresh', 'Actualizar')} className="grid size-8 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-accent">
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-v-subtle" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder={t('admin.phBuscarSimple')}
                className="h-9 w-full rounded-full bg-v-fill pl-9 pr-3 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none placeholder:text-v-subtle focus:ring-2 focus:ring-v-accent-soft" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {loadingEsp ? (
              <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-v-accent" /></div>
            ) : filtrados.length === 0 ? (
              <p className="py-10 text-center text-xs text-v-subtle">{t('admin.sinContactos')}</p>
            ) : (
              <>
                {filtradosAdmins.length > 0 && (
                  <>
                    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-v-subtle">{L('Administrators', 'Administradores')}</p>
                    {filtradosAdmins.map(contactoRow)}
                  </>
                )}
                {filtradosEspecialistas.length > 0 && (
                  <>
                    <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-v-subtle">{L('Specialists', 'Especialistas')}</p>
                    {filtradosEspecialistas.map(contactoRow)}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Conversación ── */}
        <div className={`${mobileShowChat ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
          {!seleccionado ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-v-bg px-8 text-center">
              <span className="grid size-16 place-items-center rounded-full bg-v-accent-soft text-v-accent"><MessageCircle size={28} /></span>
              <div>
                <p className="text-base font-semibold text-v-text">{t('admin.selecContacto')}</p>
                <p className="mt-1 text-sm text-v-subtle">{t('auto.chatEspecialistas.eligeUnEspecialistaOAdministrador')}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-v-border px-3 py-3 sm:px-4">
                <button onClick={() => setMobileShowChat(false)} className="grid size-9 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill md:hidden"><ChevronLeft size={20} /></button>
                <AvatarUpload
                  userId={seleccionado.id} currentUrl={seleccionado.avatar_url} name={seleccionado.full_name}
                  onUpdate={(url) => {
                    setSeleccionado((prev) => prev ? { ...prev, avatar_url: url } : prev)
                    setEspecialistas((prev) => prev.map((e) => (e.id === seleccionado.id ? { ...e, avatar_url: url } : e)))
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-v-text">{seleccionado.full_name}</p>
                  <p className="truncate text-xs text-v-subtle">{seleccionado.specialty || roleLabel(seleccionado.role)}</p>
                </div>
              </div>

              <AnimatePresence>
                {replyTo && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="flex items-start gap-2 border-b border-v-border bg-v-accent-soft/60 px-4 py-2">
                      <Reply size={14} className="mt-0.5 shrink-0 text-v-accent" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-v-accent">{replyTo.sender_name}</p>
                        <p className="truncate text-xs text-v-muted">{replyTo.content.slice(0, 80)}</p>
                      </div>
                      <button onClick={() => setReplyTo(null)} className="grid size-6 place-items-center rounded-full text-v-accent hover:bg-v-accent-soft"><X size={12} /></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto bg-v-bg px-3 py-4 sm:px-5">
                {loadingMsg ? (
                  <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-v-accent" /></div>
                ) : mensajes.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
                    <span className="grid size-14 place-items-center rounded-full bg-v-elevated text-v-accent shadow-v"><MessageCircle size={24} /></span>
                    <p className="text-sm text-v-subtle">{t('admin.sinMensajesEsp')}</p>
                  </div>
                ) : (
                  mensajesAgrupados.map((grupo) => (
                    <div key={grupo.fecha}>
                      <div className="my-4 flex justify-center">
                        <span className="rounded-full bg-v-elevated px-3 py-1 text-[11px] font-semibold text-v-muted shadow-v">{grupo.fecha}</span>
                      </div>
                      <div>
                        {grupo.items.map((msg, idx) => {
                          const esMio = msg.sender_id === userId
                          const prevMsg = idx > 0 ? grupo.items[idx - 1] : null
                          const mismoEmisor = prevMsg?.sender_id === msg.sender_id
                          const isAudio = msg.message_type === 'audio'
                          const isImage = msg.message_type === 'file' && msg.file_type?.startsWith('image/')
                          const isFile = msg.message_type === 'file' && !msg.file_type?.startsWith('image/')
                          const burbuja = esMio ? 'bg-v-accent text-white' : 'bg-v-elevated text-v-text border border-v-border'
                          return (
                            <div key={msg.id} className={`group flex items-end gap-2 ${esMio ? 'justify-end' : 'justify-start'} ${mismoEmisor ? 'mt-1' : 'mt-3'}`}>
                              {!esMio && (
                                <div className={`shrink-0 ${mismoEmisor ? 'invisible' : ''}`}><Avatar name={msg.sender_name} avatarUrl={seleccionado.avatar_url} size="sm" /></div>
                              )}
                              {/* Menú de opciones (también en celular, sin clic derecho) */}
                              {esMio && (
                                <button onClick={(e) => openContextMenu(e, msg.id)} title={L('Options', 'Opciones')}
                                  className="mb-5 grid size-7 shrink-0 place-items-center rounded-full text-v-subtle opacity-100 transition-opacity hover:bg-v-fill sm:opacity-0 sm:group-hover:opacity-100"><MoreHorizontal size={15} /></button>
                              )}

                              {(() => {
                                const hora = (
                                  <div className={`mt-1 flex items-center justify-end gap-1 ${isImage ? 'px-1.5 pb-1' : ''}`}>
                                    <span className={`text-[10px] ${esMio ? 'text-white/70' : 'text-v-subtle'}`}>{formatHora(msg.created_at)}</span>
                                    {esMio && (msg.read_at ? <CheckCheck size={12} className="text-white" /> : <Check size={12} className="text-white/60" />)}
                                  </div>
                                )
                                const radio = esMio ? (mismoEmisor ? 20 : '20px 20px 6px 20px') : (mismoEmisor ? 20 : '20px 20px 20px 6px')
                                return (
                                  <div className={`relative flex flex-col ${isImage ? 'max-w-[250px]' : 'max-w-[78%] sm:max-w-[68%]'} ${esMio ? 'items-end' : 'items-start'}`} onContextMenu={(e) => openContextMenu(e, msg.id)}>
                                    <div className={`overflow-hidden shadow-v ${isImage ? 'p-1' : 'px-3.5 py-2'} ${burbuja}`} style={{ borderRadius: radio }}>
                                      {isImage && msg.file_url && (
                                        <a href={fileUrl(msg.file_url)} target="_blank" rel="noreferrer">
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img src={fileUrl(msg.file_url)} alt="" className="block max-w-full rounded-[16px] transition-opacity hover:opacity-90" />
                                        </a>
                                      )}
                                      {isFile && msg.file_url && (
                                        <a href={fileUrl(msg.file_url)} target="_blank" rel="noreferrer" className="flex min-w-[190px] items-center gap-3 transition-opacity hover:opacity-90">
                                          <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] ${esMio ? 'bg-white/20' : 'bg-v-accent-soft text-v-accent'}`}><FileText size={16} /></span>
                                          <span className="min-w-0">
                                            <span className="block max-w-[160px] truncate text-xs font-semibold">{msg.file_name}</span>
                                            <span className={`block text-[11px] ${esMio ? 'text-white/75' : 'text-v-subtle'}`}>{t('auto.chatEspecialistas.tocaParaAbrir')}</span>
                                          </span>
                                        </a>
                                      )}
                                      {isAudio && msg.file_url && <ChatAudio url={fileUrl(msg.file_url)} isMe={esMio} />}
                                      {(!msg.message_type || msg.message_type === 'text') && (
                                        <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{msg.content}</p>
                                      )}
                                      {hora}
                                    </div>
                                    {msg.reaction && <span className="absolute -bottom-2 -right-1 rounded-full border border-v-border bg-v-elevated px-1 text-base shadow-v">{msg.reaction}</span>}
                                  </div>
                                )
                              })()}

                              {!esMio && (
                                <button onClick={(e) => openContextMenu(e, msg.id)} title={L('Options', 'Opciones')}
                                  className="mb-5 grid size-7 shrink-0 place-items-center rounded-full text-v-subtle opacity-100 transition-opacity hover:bg-v-fill sm:opacity-0 sm:group-hover:opacity-100"><MoreHorizontal size={15} /></button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Audio grabado listo para enviar */}
              {audioUrl && !grabando && (
                <div className="flex items-center gap-3 border-t border-v-border bg-v-accent-soft/60 px-4 py-2.5">
                  <Mic size={16} className="shrink-0 text-v-accent" />
                  <audio src={audioUrl} controls className="h-8 min-w-0 flex-1" />
                  <button onClick={cancelarAudio} className="grid size-8 shrink-0 place-items-center rounded-full text-v-muted hover:bg-v-fill"><X size={14} /></button>
                  <button onClick={enviarAudio} disabled={subiendo} className="v-brand inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-semibold disabled:opacity-50">
                    {subiendo ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {t('auto.chatEspecialistas.enviar')}
                  </button>
                </div>
              )}

              {grabando && (
                <div className="flex items-center gap-3 border-t border-v-border bg-v-danger/10 px-4 py-2.5">
                  <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-v-danger" />
                  <span className="flex-1 text-sm font-semibold tabular-nums text-v-danger">{L('Recording…', 'Grabando…')} {formatTiempo(tiempoGrabacion)}</span>
                  <button onClick={detenerGrabacion} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-v-danger px-4 text-xs font-semibold text-white"><Square size={12} /> {L('Stop', 'Detener')}</button>
                </div>
              )}

              {/* Escribir */}
              <div className="border-t border-v-border px-3 py-3 sm:px-4">
                <div className="flex items-end gap-1.5">
                  <button onClick={() => fileInputRef.current?.click()} disabled={subiendo || grabando} title={t('mensajes.adjuntar')}
                    className="grid size-10 shrink-0 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-accent disabled:opacity-40">
                    {subiendo ? <Loader2 size={17} className="animate-spin" /> : <Paperclip size={17} />}
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleArchivo} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" />
                  <div className="min-w-0 flex-1 rounded-[22px] border border-v-border bg-v-bg px-4 py-2 transition-colors focus-within:border-v-accent">
                    <textarea ref={textareaRef} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={handleKeyDown}
                      placeholder={L(`Message ${seleccionado.full_name.split(' ')[0]}…`, `Escribe a ${seleccionado.full_name.split(' ')[0]}…`)}
                      rows={1} disabled={grabando}
                      className="block max-h-32 w-full resize-none bg-transparent text-sm sm:!text-sm [font-family:inherit] leading-6 text-v-text outline-none placeholder:text-v-subtle disabled:opacity-50" />
                  </div>
                  {texto.trim() ? (
                    <button onClick={enviar} disabled={enviando} className="v-brand grid size-10 shrink-0 place-items-center rounded-full disabled:opacity-50">
                      {enviando ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                    </button>
                  ) : (
                    <button onMouseDown={iniciarGrabacion} onMouseUp={detenerGrabacion} onTouchStart={handleMicTouch} disabled={subiendo || !!audioUrl}
                      title={grabando ? L('Tap to stop', 'Toca para detener') : L('Hold (PC) or tap (phone) to record', 'Mantén (PC) o toca (celular) para grabar')}
                      className={`grid size-10 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40 ${grabando ? 'animate-pulse bg-v-danger text-white' : 'bg-v-accent-soft text-v-accent hover:bg-v-accent hover:text-white'}`}>
                      {grabando ? <MicOff size={17} /> : <Mic size={17} />}
                    </button>
                  )}
                </div>
                <p className="mt-1.5 hidden px-1 text-[11px] text-v-subtle sm:block">
                  {L('Shift+Enter for a new line · Hold the mic to record · Right-click or ⋯ on a message for more options', 'Shift+Enter nueva línea · Mantén el micrófono para grabar · Clic derecho o ⋯ en un mensaje para más opciones')}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      )}
      </div>
    </>
  )
}
