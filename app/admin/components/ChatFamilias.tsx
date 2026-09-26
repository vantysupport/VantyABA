'use client'
// app/admin/components/ChatFamilias.tsx
// Chat familias con soporte completo: texto, imágenes, documentos y audio

import { fileUrl } from '@/lib/file-url'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useI18n } from '@/lib/i18n-context'
import {
  MessageCircle, Send, Loader2, Search, Users, CheckCheck, Check,
  ChevronLeft, Paperclip, Mic, Image, FileText, X,
  Download, StopCircle,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { subirArchivoPrivado } from '@/lib/subir-archivo'
import { ChatAudio } from '@/components/ui/chat-audio'

interface Msg {
  id: string; content: string; sender_id: string; sender_role: string
  sender_name: string; sender_avatar?: string | null; read_by: string[]; created_at: string
  message_type?: 'text' | 'image' | 'audio' | 'document'
  file_url?: string; file_name?: string; file_size?: number
}
interface Family {
  child_id: string; child_name: string; lastMsg: string
  lastTime: string; unread: number; lastSender: string
}
interface Props { profile?: any; userId?: string; userName?: string; isDark?: boolean }

const ROLE_CFG: Record<string, { label: string; labelEn: string; pill: string; tile: string }> = {
  jefe:         { label: 'Dirección',  labelEn: 'Director',   pill: 'bg-v-accent-soft text-v-accent',   tile: 'bg-v-accent-soft text-v-accent' },
  admin:        { label: 'Admin',      labelEn: 'Admin',      pill: 'bg-v-accent-soft text-v-accent',   tile: 'bg-v-accent-soft text-v-accent' },
  especialista: { label: 'Terapeuta',  labelEn: 'Therapist',  pill: 'bg-v-success/15 text-v-success',   tile: 'bg-v-success/15 text-v-success' },
  terapeuta:    { label: 'Terapeuta',  labelEn: 'Therapist',  pill: 'bg-v-success/15 text-v-success',   tile: 'bg-v-success/15 text-v-success' },
  secretaria:   { label: 'Secretaría', labelEn: 'Front desk', pill: 'bg-v-warning/15 text-v-warning',   tile: 'bg-v-warning/15 text-v-warning' },
  padre:        { label: 'Familia',    labelEn: 'Family',     pill: 'bg-v-fill text-v-muted',           tile: 'bg-v-fill text-v-muted' },
}

function formatTime(iso: string) {
  if (!iso) return ''
  const d = new Date(iso), now = new Date()
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}
function isNewDay(curr: string, prev?: string) {
  if (!prev) return true
  return new Date(curr).toDateString() !== new Date(prev).toDateString()
}
function formatDuration(sec: number) {
  return `${Math.floor(sec/60).toString().padStart(2,'0')}:${Math.floor(sec%60).toString().padStart(2,'0')}`
}
function formatFileSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/1048576).toFixed(1)} MB`
}
function getFileIcon(name?: string) {
  const ext = name?.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return '📄'
  if (['doc','docx'].includes(ext)) return '📝'
  if (['xls','xlsx'].includes(ext)) return '📊'
  if (['zip','rar'].includes(ext)) return '🗜️'
  return '📎'
}

function DayDivider({ date, locale }: { date: string; locale: string }) {
  const d = new Date(date)
  const label = d.toDateString() === new Date().toDateString() ? (locale === 'en' ? 'Today' : 'Hoy')
    : d.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, c => c.toUpperCase())
  return (
    <div className="my-4 flex justify-center">
      <span className="rounded-full bg-v-elevated px-3 py-1 text-[11px] font-semibold text-v-muted shadow-v">{label}</span>
    </div>
  )
}

const AudioPlayer = ChatAudio

function MsgContent({ msg, isMe }: { msg: Msg; isMe: boolean }) {
  const { t } = useI18n()
  if (msg.message_type === 'image' && msg.file_url) return (
    <div>
      <img src={fileUrl(msg.file_url)} alt="imagen"
        style={{ width: '100%', maxWidth: 220, borderRadius: 10, display: 'block', cursor: 'pointer' }}
        onClick={() => window.open(fileUrl(msg.file_url), '_blank')} />
      {msg.content && msg.content !== '📷 Imagen' && (
        <p style={{ margin: '6px 2px 0', fontSize: 13, whiteSpace: 'pre-wrap', color: isMe ? '#fff' : 'var(--v-text)' }}>{msg.content}</p>
      )}
    </div>
  )
  if (msg.message_type === 'audio' && msg.file_url) return <AudioPlayer url={fileUrl(msg.file_url)} isMe={isMe} />
  if (msg.message_type === 'document' && msg.file_url) return (
    <a href={fileUrl(msg.file_url)} target="_blank" rel="noreferrer" download={msg.file_name}
      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
        background: isMe ? 'rgba(255,255,255,0.15)' : 'var(--v-fill)',
        border: isMe ? 'none' : '1px solid var(--v-border)',
        borderRadius: 12, padding: '10px 14px', minWidth: 190 }}>
      <span style={{ fontSize: 28 }}>{getFileIcon(msg.file_name)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: isMe ? '#fff' : 'var(--v-text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
          {msg.file_name || 'Documento'}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 10, color: isMe ? 'rgba(255,255,255,.65)' : 'var(--v-text-tertiary)' }}>
          {t('auto.chatFamilias.tocaParaAbrir', { v1: String(formatFileSize(msg.file_size)) })}
        </p>
      </div>
      <Download size={14} color={isMe ? 'rgba(255,255,255,.75)' : 'var(--v-text-tertiary)'}/>
    </a>
  )
  // Compat: mensajes del portal Familias guardados como texto plano
  const audioLegacy = msg.content?.match(/^🎤 \[Audio\] (https?:\/\/\S+)\s*$/)
  if (audioLegacy) return <AudioPlayer url={fileUrl(audioLegacy[1])} isMe={isMe} />
  const fileLegacy = msg.content?.match(/^📎 \[(.+?)\] (https?:\/\/\S+)\s*$/)
  if (fileLegacy) {
    const name = fileLegacy[1], url = fileUrl(fileLegacy[2])
    if (/\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url)) return (
      <img src={url} alt={name}
        style={{ width: '100%', maxWidth: 220, borderRadius: 10, display: 'block', cursor: 'pointer' }}
        onClick={() => window.open(url, '_blank')} />
    )
    return (
      <a href={url} target="_blank" rel="noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
          background: isMe ? 'rgba(255,255,255,0.15)' : 'var(--v-fill)',
          border: isMe ? 'none' : '1px solid var(--v-border)',
          borderRadius: 12, padding: '10px 14px', minWidth: 190 }}>
        <span style={{ fontSize: 28 }}>{getFileIcon(name)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: isMe ? '#fff' : 'var(--v-text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 10, color: isMe ? 'rgba(255,255,255,.65)' : 'var(--v-text-tertiary)' }}>{t("admin.tocaAbrir")}</p>
        </div>
        <Download size={14} color={isMe ? 'rgba(255,255,255,.75)' : 'var(--v-text-tertiary)'}/>
      </a>
    )
  }
  return <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>{msg.content}</p>
}

export default function ChatFamilias({ profile, userId: _userId, userName: _userName, isDark: _isDark }: Props) {
  const { t, locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const [families, setFamilies]       = useState<Family[]>([])
  const [selected, setSelected]       = useState<Family | null>(null)
  const [messages, setMessages]       = useState<Msg[]>([])
  const [input, setInput]             = useState('')
  const [loadingList, setLoadingList] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [sending, setSending]         = useState(false)
  const [uploading, setUploading]     = useState(false)
  const [search, setSearch]           = useState('')
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [showAttach, setShowAttach]   = useState(false)
  const [recording, setRecording]     = useState(false)
  const [recSeconds, setRecSeconds]   = useState(0)

  const fileInputRef    = useRef<HTMLInputElement>(null)
  const imageInputRef   = useRef<HTMLInputElement>(null)
  const mediaRecRef     = useRef<MediaRecorder | null>(null)
  const audioChunksRef  = useRef<Blob[]>([])
  const recTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const bottomRef       = useRef<HTMLDivElement>(null)
  const channelRef      = useRef<any>(null)
  const inputRef        = useRef<HTMLTextAreaElement>(null)

  const userId   = _userId   || profile?.id        || ''
  const userName = _userName || profile?.full_name  || profile?.name || 'Equipo'
  const userRole = profile?.role || 'admin'
  const isDark   = _isDark ?? false

  const bg          = isDark ? '#0d1117'  : 'var(--card,#fff)'
  const borderColor = isDark ? '#21262d'  : 'var(--v-border)'
  const mutedBg     = isDark ? '#161b22'  : 'var(--v-fill)'
  const textPrimary = isDark ? '#e6edf3'  : 'var(--text-primary,#0f172a)'
  const textMuted   = isDark ? '#7d8590'  : 'var(--v-text-tertiary)'

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  const loadFamilies = useCallback(async () => {
    setLoadingList(true)
    try {
      // Los mensajes se guardan cifrados: el servidor los descifra
      const r = await fetch('/api/chat-familias?resumen=1', { cache: 'no-store' })
      const { data } = r.ok ? await r.json() : { data: null }
      if (!data) return
      const map: Record<string, any> = {}
      data.forEach((m: any) => {
        if (!map[m.child_id]) {
          let preview = m.content
          if (m.message_type === 'image')    preview = '📷 Imagen'
          if (m.message_type === 'audio')    preview = '🎤 Audio'
          if (m.message_type === 'document') preview = '📎 Documento'
          // Compat: mensajes antiguos del portal Familias guardados como texto
          if (/^🎤 \[Audio\] https?:\/\//.test(preview)) preview = '🎤 Audio'
          else if (/^📎 \[.+?\] https?:\/\//.test(preview)) preview = '📎 Documento'
          map[m.child_id] = { child_id: m.child_id, child_name: (m.children as any)?.name || 'Familia',
            lastMsg: preview, lastTime: m.created_at, lastSender: m.sender_name, unread: 0 }
        }
        if (m.sender_role === 'padre' && !m.read_by?.includes(userId)) map[m.child_id].unread++
      })
      const { data: children } = await supabase.from('children').select('id, name').eq('is_active', true).order('name')
      children?.forEach((c: any) => { if (!map[c.id]) map[c.id] = { child_id: c.id, child_name: c.name, lastMsg: '', lastTime: '', lastSender: '', unread: 0 } })
      setFamilies(Object.values(map).sort((a: any, b: any) => b.unread !== a.unread ? b.unread - a.unread : b.lastTime.localeCompare(a.lastTime)))
    } finally { setLoadingList(false) }
  }, [userId])

  useEffect(() => { loadFamilies() }, [loadFamilies])
  useEffect(() => {
    const ch = supabase.channel('cf_list_v3')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_familias' }, () => loadFamilies())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadFamilies])

  const loadMessages = useCallback(async (childId: string, silencioso = false) => {
    if (!silencioso) setLoadingMsgs(true)
    try {
      const res = await fetch(`/api/chat-familias?child_id=${childId}&user_id=${userId}`)
      const json = await res.json()
      if (json.data) { setMessages(json.data); scrollToBottom() }
      await fetch('/api/chat-familias', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: childId, user_id: userId }) })
      setFamilies(prev => prev.map(f => f.child_id === childId ? { ...f, unread: 0 } : f))
    } finally { setLoadingMsgs(false) }
  }, [userId, scrollToBottom])

  const selectFamily = (f: Family) => {
    setSelected(f); setMessages([]); setMobileShowChat(true)
    setAttachedFile(null); setShowAttach(false)
    loadMessages(f.child_id)
  }

  useEffect(() => {
    if (!selected) return
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase.channel(`cf_msgs_v3_${selected.child_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_familias',
        filter: `child_id=eq.${selected.child_id}` }, () => {
          // El aviso trae el texto cifrado: se recarga la conversación ya descifrada
          loadMessages(selected.child_id, true).then(() => scrollToBottom())
          loadFamilies()
        }).subscribe()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [selected, userId, scrollToBottom])

  const uploadFile = async (file: File) => {
    // Privado (R2), directo desde el navegador; las fotos se comprimen antes de subir
    const subido = await subirArchivoPrivado('chat-media', `chat-familias/${selected!.child_id}`, file)
    return { url: subido.url, fileName: file.name, fileSize: subido.size }
  }

  const sendMessage = async (opts?: { text?: string; type?: string; fileUrl?: string; fileName?: string; fileSize?: number }) => {
    const text = opts?.text ?? input.trim()
    if (!text && !attachedFile && !opts?.fileUrl) return
    if (sending || !selected) return
    setSending(true); const prevInput = input; setInput('')
    try {
      let fileUrl = opts?.fileUrl, fileName = opts?.fileName, fileSize = opts?.fileSize, msgType = opts?.type || 'text'
      if (attachedFile && !fileUrl) {
        setUploading(true)
        const up = await uploadFile(attachedFile); setUploading(false)
        fileUrl = up.url; fileName = up.fileName; fileSize = up.fileSize
        msgType = attachedFile.type.startsWith('image/') ? 'image' : 'document'
        setAttachedFile(null)
      }
      const content = text || (msgType==='image' ? '📷 Imagen' : msgType==='audio' ? '🎤 Mensaje de voz' : '📎 Documento')
      const res = await fetch('/api/chat-familias', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: selected.child_id, content, sender_id: userId, sender_role: userRole,
          sender_name: userName, message_type: msgType, file_url: fileUrl||null, file_name: fileName||null, file_size: fileSize||null }) })
      const json = await res.json().catch(() => null)
      // Optimistic update — no depender solo del realtime
      if (json?.data) {
        const newMsg = json.data as Msg
        setMessages(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
      }
      scrollToBottom()
    } catch { setInput(prevInput) }
    finally { setSending(false); setUploading(false); inputRef.current?.focus() }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const mr = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.start(100); mediaRecRef.current = mr
      setRecording(true); setRecSeconds(0)
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000)
    } catch { alert(t('auto.chatFamilias.noSePudoAccederAl')) }
  }

  const stopRecording = async (cancel = false) => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null }
    setRecording(false); setRecSeconds(0)
    const mr = mediaRecRef.current; if (!mr) return
    mr.stream.getTracks().forEach(t => t.stop())
    if (cancel) { mr.stop(); audioChunksRef.current = []; return }
    await new Promise<void>(resolve => { mr.onstop = () => resolve(); mr.stop() })
    if (!audioChunksRef.current.length) return
    const mimeType = mr.mimeType || 'audio/webm'
    const blob = new Blob(audioChunksRef.current, { type: mimeType })
    const ext  = mimeType.includes('ogg') ? 'ogg' : 'webm'
    const file = new File([blob], `voz_${Date.now()}.${ext}`, { type: mimeType })
    setUploading(true); setSending(true)
    try {
      const up = await uploadFile(file)
      const res = await fetch('/api/chat-familias', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: selected!.child_id, content: '🎤 Mensaje de voz', sender_id: userId,
          sender_role: userRole, sender_name: userName, message_type: 'audio',
          file_url: up.url, file_name: up.fileName, file_size: up.fileSize }) })
      const json = await res.json().catch(() => null)
      if (json?.data) {
        const newMsg = json.data as Msg
        setMessages(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
      }
      scrollToBottom()
    } catch { } finally { setUploading(false); setSending(false) }
  }

  const handleMicTouch = (e: React.TouchEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (recording) stopRecording(false); else startRecording()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) { setAttachedFile(file); setShowAttach(false) }
    e.target.value = ''
  }

  const filtered = families.filter(f => f.child_name.toLowerCase().includes(search.toLowerCase()))
  const canSend  = !!(input.trim() || attachedFile)

  const rol = (r: string) => { const c = ROLE_CFG[r] || ROLE_CFG.admin; return { ...c, nombre: locale === 'en' ? c.labelEn : c.label } }
  void bg; void borderColor; void mutedBg; void textPrimary; void textMuted

  return (
    <div className="v-scope flex h-full overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v">

      {/* ── Familias ── */}
      <div className={`${mobileShowChat ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-v-border md:w-[300px]`}>
        <div className="space-y-3 border-b border-v-border p-3">
          <div className="flex items-center gap-2 px-1">
            <span className="grid size-9 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Users size={17} /></span>
            <p className="flex-1 text-[15px] font-semibold tracking-tight text-v-text">{t('admin.familias')}</p>
            {families.some(f => f.unread > 0) && (
              <span className="rounded-full bg-v-accent px-2 py-0.5 text-[11px] font-semibold text-white">{families.filter(f => f.unread > 0).length} {L('unread', 'sin leer')}</span>
            )}
          </div>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-v-subtle" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('admin.buscarFamilia')}
              className="h-9 w-full rounded-full bg-v-fill pl-9 pr-3 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none placeholder:text-v-subtle focus:ring-2 focus:ring-v-accent-soft" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loadingList ? (
            <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-v-accent" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-xs text-v-subtle">{t('admin.sinFamilias')}</p>
          ) : filtered.map(f => {
            const sel = selected?.child_id === f.child_id
            return (
              <button key={f.child_id} onClick={() => selectFamily(f)}
                className={`flex w-full items-center gap-3 rounded-v-sm px-3 py-2.5 text-left transition-colors ${sel ? 'bg-v-accent-soft' : 'hover:bg-v-fill'}`}>
                <span className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${f.unread > 0 ? 'v-brand' : 'bg-v-accent-soft text-v-accent'}`} style={f.unread > 0 ? { boxShadow: 'none' } : undefined}>{f.child_name[0]?.toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={`min-w-0 flex-1 truncate text-sm ${f.unread > 0 ? 'font-bold text-v-text' : sel ? 'font-semibold text-v-accent' : 'font-semibold text-v-text'}`}>{f.child_name}</span>
                    {f.lastTime && <span className={`shrink-0 text-[11px] ${f.unread > 0 ? 'font-semibold text-v-accent' : 'text-v-subtle'}`}>{formatTime(f.lastTime)}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`min-w-0 flex-1 truncate text-xs ${f.unread > 0 ? 'font-medium text-v-text' : 'text-v-subtle'}`}>
                      {f.lastMsg ? `${f.lastSender ? `${f.lastSender.split(' ')[0]}: ` : ''}${f.lastMsg}` : L('No messages yet', 'Sin mensajes aún')}
                    </span>
                    {f.unread > 0 && <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-v-accent px-1.5 text-[10px] font-bold text-white">{f.unread > 9 ? '9+' : f.unread}</span>}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Conversación ── */}
      <div className={`${mobileShowChat ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-v-bg px-8 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-v-accent-soft text-v-accent"><MessageCircle size={28} /></span>
            <div>
              <p className="text-base font-semibold text-v-text">{t('admin.selecFamilia')}</p>
              <p className="mt-1 text-sm text-v-subtle">{t('admin.eligeFamilia')}</p>
            </div>
          </div>
        ) : (<>
          <div className="flex items-center gap-3 border-b border-v-border px-3 py-3 sm:px-4">
            <button onClick={() => { setMobileShowChat(false); setSelected(null) }} className="grid size-9 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill md:hidden"><ChevronLeft size={20} /></button>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-v-accent-soft text-sm font-semibold text-v-accent">{selected.child_name[0]?.toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-v-text">{L('Family of', 'Familia de')} {selected.child_name}</p>
              <p className="truncate text-xs text-v-subtle">{t('admin.chatPrivadoPadre')}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-v-bg px-3 py-4 sm:px-5">
            {loadingMsgs ? (
              <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-v-accent" /></div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
                <span className="grid size-14 place-items-center rounded-full bg-v-elevated text-v-accent shadow-v"><MessageCircle size={24} /></span>
                <p className="text-sm text-v-subtle">{t('admin.sinMensajesInicia')}</p>
              </div>
            ) : messages.map((msg, i) => {
              const isMe    = msg.sender_id === userId
              const cfg     = rol(msg.sender_role)
              const showDay = isNewDay(msg.created_at, messages[i-1]?.created_at)
              const isRead  = msg.read_by?.length > 1
              const isMedia = msg.message_type === 'image'
              const primero = i === 0 || messages[i-1]?.sender_id !== msg.sender_id || showDay
              const avatar = (
                <span className={`grid size-8 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-semibold ${primero ? '' : 'invisible'} ${cfg.tile}`}>
                  {msg.sender_avatar
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={fileUrl(msg.sender_avatar)} alt="" className="size-full object-cover" />
                    : (msg.sender_name?.[0]?.toUpperCase() || '?')}
                </span>
              )
              return (
                <div key={msg.id}>
                  {showDay && <DayDivider date={msg.created_at} locale={locale} />}
                  {!isMe && primero && (
                    <div className="mb-1 mt-3 flex items-center gap-1.5 pl-10">
                      <span className="text-[11px] font-semibold text-v-text">{msg.sender_name}</span>
                      <span className={`rounded-full px-2 py-px text-[10px] font-semibold ${cfg.pill}`}>{cfg.nombre}</span>
                    </div>
                  )}
                  <div className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'} ${primero && isMe ? 'mt-3' : 'mt-1'}`}>
                    {!isMe && avatar}
                    <div className={`overflow-hidden shadow-v ${isMedia ? 'max-w-[250px] p-1' : 'max-w-[78%] px-3.5 py-2 sm:max-w-[68%]'} ${isMe ? 'bg-v-accent text-white' : 'border border-v-border bg-v-elevated text-v-text'}`}
                      style={{ borderRadius: isMe ? (primero ? '20px 20px 6px 20px' : 20) : (primero ? '20px 20px 20px 6px' : 20) }}>
                      <MsgContent msg={msg} isMe={isMe} />
                      <div className={`mt-1 flex items-center justify-end gap-1 ${isMedia ? 'px-1.5 pb-1' : ''}`}>
                        <span className={`text-[10px] ${isMe ? 'text-white/70' : 'text-v-subtle'}`}>{formatTime(msg.created_at)}</span>
                        {isMe && (isRead ? <CheckCheck size={12} className="text-white" /> : <Check size={12} className="text-white/60" />)}
                      </div>
                    </div>
                    {isMe && avatar}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Escribir */}
          <div className="border-t border-v-border px-3 py-3 sm:px-4">
            {attachedFile && (
              <div className="mb-2 flex items-center gap-3 rounded-v-sm border border-v-accent/25 bg-v-accent-soft/60 p-2">
                {attachedFile.type.startsWith('image/')
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={URL.createObjectURL(attachedFile)} alt="" className="size-12 rounded-v-sm object-cover" />
                  : <span className="grid size-12 place-items-center rounded-v-sm bg-v-elevated text-v-accent"><FileText size={20} /></span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-v-text">{attachedFile.name}</p>
                  <p className="text-[11px] text-v-subtle">{formatFileSize(attachedFile.size)}</p>
                </div>
                <button onClick={() => setAttachedFile(null)} className="grid size-8 shrink-0 place-items-center rounded-full text-v-muted hover:bg-v-danger/10 hover:text-v-danger"><X size={14} /></button>
              </div>
            )}

            {recording && (
              <div className="mb-2 flex items-center gap-3 rounded-v-sm bg-v-danger/10 px-3.5 py-2.5">
                <span className="size-2.5 animate-pulse rounded-full bg-v-danger" />
                <span className="text-sm font-semibold text-v-danger">{t('admin.grabando')}</span>
                <span className="text-sm font-semibold tabular-nums text-v-danger">{formatDuration(recSeconds)}</span>
                <button onClick={() => stopRecording(true)} className="ml-auto h-8 rounded-full px-3 text-xs font-semibold text-v-muted hover:bg-v-fill">{t('auto.chatFamilias.cancelar')}</button>
              </div>
            )}

            <AnimatePresence>
              {showAttach && !recording && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <button onClick={() => { imageInputRef.current?.click(); setShowAttach(false) }}
                      className="flex items-center justify-center gap-2 rounded-v-sm bg-v-accent-soft py-3 text-sm font-semibold text-v-accent transition-colors hover:bg-v-accent hover:text-white">
                      <Image size={18} /> {t('recursos.imagen')}
                    </button>
                    <button onClick={() => { fileInputRef.current?.click(); setShowAttach(false) }}
                      className="flex items-center justify-center gap-2 rounded-v-sm bg-v-success/15 py-3 text-sm font-semibold text-v-success transition-colors hover:bg-v-success hover:text-white">
                      <FileText size={18} /> {t('recursos.documento')}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-end gap-1.5">
              {!recording && (
                <button onClick={() => setShowAttach(v => !v)} disabled={sending || uploading} title={t('admin.adjuntar')}
                  className={`grid size-10 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40 ${showAttach ? 'bg-v-accent text-white' : 'text-v-muted hover:bg-v-fill hover:text-v-accent'}`}>
                  {showAttach ? <X size={17} /> : <Paperclip size={17} />}
                </button>
              )}
              {!recording && (
                <div className="min-w-0 flex-1 rounded-[22px] border border-v-border bg-v-bg px-4 py-2 transition-colors focus-within:border-v-accent">
                  <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder={L(`Reply to ${selected.child_name}'s family…`, `Responder a la familia de ${selected.child_name}…`)}
                    rows={1} disabled={sending}
                    className="block max-h-[100px] w-full resize-none bg-transparent text-sm sm:!text-sm [font-family:inherit] leading-6 text-v-text outline-none placeholder:text-v-subtle"
                    onInput={e => { const el = e.target as HTMLTextAreaElement; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 100) + 'px' }} />
                </div>
              )}
              {recording ? (
                <button onClick={() => stopRecording(false)} title={L('Send recording', 'Enviar grabación')}
                  className="grid size-10 shrink-0 animate-pulse place-items-center rounded-full bg-v-danger text-white"><StopCircle size={18} /></button>
              ) : canSend ? (
                <button onClick={() => sendMessage()} disabled={sending || uploading} className="v-brand grid size-10 shrink-0 place-items-center rounded-full disabled:opacity-50">
                  {(sending || uploading) ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                </button>
              ) : (
                <button onMouseDown={startRecording} onMouseUp={() => stopRecording(false)} onTouchStart={handleMicTouch} disabled={sending || uploading} title={t('admin.mantenGrabar')}
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-v-accent-soft text-v-accent transition-colors hover:bg-v-accent hover:text-white disabled:opacity-40"><Mic size={17} /></button>
              )}
            </div>
            <p className="mt-1.5 hidden px-1 text-[11px] text-v-subtle sm:block">
              {recording ? L('Release/tap to send · Cancel to discard', 'Suelta/toca para enviar · Cancelar para descartar')
                : canSend ? L('Enter to send · Shift+Enter for a new line', 'Enter para enviar · Shift+Enter para nueva línea')
                : L('Hold the mic to record · Clip to attach files', 'Mantén el micrófono para grabar · Clip para adjuntar archivos')}
            </p>
          </div>
        </>)}
      </div>

      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv" className="hidden" onChange={handleFileChange} />
    </div>
  )
}
