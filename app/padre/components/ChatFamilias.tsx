'use client'
// app/padre/components/ChatFamilias.tsx
// Chat privado de la familia con el equipo del paciente. Mismo diseño que el chat del admin:
// burbujas, reproductor de notas de voz (ChatAudio), adjuntar imagen/documento y
// "mantén presionado para grabar".

import { fileUrl } from '@/lib/file-url'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import {
  Send, Loader2, MessageCircle, CheckCheck, Check, Users, Mic, Paperclip, X, Lock,
  Image as ImageIcon, FileText, Download, StopCircle, CalendarDays, BarChart3, HelpCircle,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { subirArchivoPrivado } from '@/lib/subir-archivo'
import { ChatAudio } from '@/components/ui/chat-audio'
import { useToast } from '@/components/Toast'

interface Msg {
  id: string; content: string; sender_id: string; sender_role: string
  sender_name: string; read_by: string[]; created_at: string
  sender_avatar?: string | null
  message_type?: 'text' | 'audio' | 'image' | 'document'
  file_url?: string; file_name?: string; file_size?: number
}
interface Props { childId: string; childName: string; profile: any }

// Un tono por rol (igual que en el chat del admin)
const ROL: Record<string, { es: string; en: string; pill: string; tile: string }> = {
  jefe:         { es: 'Dirección',  en: 'Director',   pill: 'bg-v-accent-soft text-v-accent', tile: 'bg-v-accent-soft text-v-accent' },
  admin:        { es: 'Admin',      en: 'Admin',      pill: 'bg-v-accent-soft text-v-accent', tile: 'bg-v-accent-soft text-v-accent' },
  especialista: { es: 'Terapeuta',  en: 'Therapist',  pill: 'bg-v-success/15 text-v-success', tile: 'bg-v-success/15 text-v-success' },
  terapeuta:    { es: 'Terapeuta',  en: 'Therapist',  pill: 'bg-v-success/15 text-v-success', tile: 'bg-v-success/15 text-v-success' },
  secretaria:   { es: 'Secretaría', en: 'Front desk', pill: 'bg-v-warning/15 text-v-warning', tile: 'bg-v-warning/15 text-v-warning' },
  padre:        { es: 'Familia',    en: 'Family',     pill: 'bg-v-fill text-v-muted',         tile: 'bg-v-fill text-v-muted' },
}
const rolDe = (r: string) => ROL[r] || ROL.admin

const nuevoDia = (a: string, b?: string) => !b || new Date(a).toDateString() !== new Date(b).toDateString()
const fmtDur = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const fmtPeso = (b?: number) => !b ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`
const esImagen = (n?: string) => /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(n || '')

function Avatar({ name, role, url, visible = true }: { name: string; role: string; url?: string | null; visible?: boolean }) {
  const [rota, setRota] = useState(false)
  return (
    <span className={`grid size-8 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-semibold ${visible ? '' : 'invisible'} ${rolDe(role).tile}`}>
      {url && !rota
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={fileUrl(url)} alt="" onError={() => setRota(true)} className="size-full object-cover" style={{ height: '100%' }} />
        : (name?.[0]?.toUpperCase() || '?')}
    </span>
  )
}

function Documento({ url, nombre, peso, mio, L }: { url: string; nombre: string; peso?: number; mio: boolean; L: (e: string, s: string) => string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" download={nombre}
      className={`flex min-w-[190px] items-center gap-3 rounded-v-sm px-3 py-2.5 ${mio ? 'bg-white/15 text-white' : 'border border-v-border bg-v-fill text-v-text'}`}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-v-sm ${mio ? 'bg-white/20' : 'bg-v-accent-soft text-v-accent'}`}><FileText size={17} /></span>
      <span className="min-w-0 flex-1">
        <span className="block max-w-[160px] truncate text-xs font-semibold">{nombre}</span>
        <span className={`text-[10px] ${mio ? 'text-white/70' : 'text-v-subtle'}`}>{[fmtPeso(peso), L('Tap to open', 'Toca para abrir')].filter(Boolean).join(' · ')}</span>
      </span>
      <Download size={14} className={mio ? 'text-white/75' : 'text-v-subtle'} />
    </a>
  )
}

function Contenido({ msg, mio, L }: { msg: Msg; mio: boolean; L: (e: string, s: string) => string }) {
  if (msg.message_type === 'image' && msg.file_url) {
    const url = fileUrl(msg.file_url)
    return (
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" onClick={() => window.open(url, '_blank')} className="block w-full max-w-[220px] cursor-pointer rounded-[14px]" style={{ height: 'auto' }} />
        {msg.content && !/^(📷 )?(Imagen|Image)$/.test(msg.content) && <p className="mx-0.5 mt-1.5 whitespace-pre-wrap text-[13px]">{msg.content}</p>}
      </div>
    )
  }
  if (msg.message_type === 'audio' && msg.file_url) return <ChatAudio url={fileUrl(msg.file_url)} isMe={mio} />
  if (msg.message_type === 'document' && msg.file_url) return <Documento url={fileUrl(msg.file_url)} nombre={msg.file_name || L('Document', 'Documento')} peso={msg.file_size} mio={mio} L={L} />
  // Formato antiguo: adjuntos guardados dentro del texto
  const audioViejo = msg.content?.match(/^🎤 \[Audio\] (https?:\/\/\S+)\s*$/)
  if (audioViejo) return <ChatAudio url={fileUrl(audioViejo[1])} isMe={mio} />
  const adjViejo = msg.content?.match(/^📎 \[(.+?)\] (https?:\/\/\S+)\s*$/)
  if (adjViejo) {
    const url = fileUrl(adjViejo[2])
    // eslint-disable-next-line @next/next/no-img-element
    if (esImagen(url)) return <img src={url} alt="" onClick={() => window.open(url, '_blank')} className="block w-full max-w-[220px] cursor-pointer rounded-[14px]" style={{ height: 'auto' }} />
    return <Documento url={url} nombre={adjViejo[1]} mio={mio} L={L} />
  }
  return <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{msg.content}</p>
}

export default function ChatFamilias({ childId, childName, profile }: Props) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const toast = useToast()
  const bcp = toBCP47(locale)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [adjunto, setAdjunto] = useState<File | null>(null)
  const [verAdjuntar, setVerAdjuntar] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recSegundos, setRecSegundos] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const imagenRef = useRef<HTMLInputElement>(null)
  const archivoRef = useRef<HTMLInputElement>(null)
  const mediaRecRef = useRef<MediaRecorder | null>(null)
  const trozosAudio = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef = useRef<any>(null)

  const userId = profile?.id || ''
  const userName = profile?.full_name || L('Family', 'Familia')
  const nombre = (childName || '').split(' ')[0] || childName

  const scrollToBottom = useCallback(() => { setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50) }, [])

  const loadMessages = useCallback(async (silencioso = false) => {
    if (!childId) return
    if (!silencioso) setLoading(true)
    try {
      const res = await fetch(`/api/chat-familias?child_id=${childId}&user_id=${userId}`)
      const json = await res.json()
      if (json.data) { setMessages(json.data); scrollToBottom() }
    } finally { setLoading(false) }
  }, [childId, userId, scrollToBottom])
  useEffect(() => { loadMessages() }, [loadMessages])

  useEffect(() => {
    const markRead = () => {
      if (!childId || !userId) return
      fetch('/api/chat-familias', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ child_id: childId, user_id: userId }) }).catch(() => {})
    }
    window.addEventListener('focus', markRead); markRead()
    return () => window.removeEventListener('focus', markRead)
  }, [childId, userId])

  useEffect(() => {
    if (!childId) return
    channelRef.current = supabase
      .channel(`chat_familias_${childId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_familias', filter: `child_id=eq.${childId}` },
        // El aviso trae el texto cifrado: se recarga la conversación ya descifrada (y se marca leída)
        () => { loadMessages(true).then(() => scrollToBottom()) })
      .subscribe()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [childId, userId, scrollToBottom, loadMessages])

  const publicar = async (extra: Record<string, unknown>) => {
    const res = await fetch('/api/chat-familias', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ child_id: childId, sender_id: userId, sender_role: 'padre', sender_name: userName, ...extra }),
    })
    const json = await res.json().catch(() => null)
    // Actualización inmediata sin esperar al aviso en tiempo real
    if (json?.data) { const m = json.data as Msg; setMessages(prev => prev.find(x => x.id === m.id) ? prev : [...prev, m]) }
    scrollToBottom()
  }

  const subir = (f: File) => subirArchivoPrivado('chat-media', `chat-familias/${childId}`, f) // privado (R2)

  const sendMessage = async () => {
    const texto = input.trim()
    if ((!texto && !adjunto) || sending || !childId) return
    setSending(true)
    try {
      if (adjunto) {
        setUploading(true)
        const { url } = await subir(adjunto)
        const img = adjunto.type.startsWith('image/') || esImagen(adjunto.name)
        await publicar({
          content: texto || (img ? L('Image', 'Imagen') : adjunto.name),
          message_type: img ? 'image' : 'document', file_url: url, file_name: adjunto.name, file_size: adjunto.size,
        })
        setAdjunto(null)
      } else {
        await publicar({ content: texto })
      }
      setInput('')
      if (inputRef.current) inputRef.current.style.height = 'auto'
    } catch (e: any) { toast.error(L('Could not send: ', 'No se pudo enviar: ') + e.message) }
    finally { setSending(false); setUploading(false); inputRef.current?.focus() }
  }

  // ── Notas de voz: mantener presionado para grabar, soltar para enviar ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const mr = new MediaRecorder(stream, { mimeType })
      trozosAudio.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) trozosAudio.current.push(e.data) }
      mr.start(100); mediaRecRef.current = mr
      setRecording(true); setRecSegundos(0)
      timerRef.current = setInterval(() => setRecSegundos(s => s + 1), 1000)
    } catch { toast.error(L('Could not access the microphone', 'No se pudo acceder al micrófono')) }
  }
  const stopRecording = async (cancelar = false) => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setRecording(false); setRecSegundos(0)
    const mr = mediaRecRef.current; if (!mr) return
    mediaRecRef.current = null
    mr.stream.getTracks().forEach(t => t.stop())
    if (cancelar) { mr.stop(); trozosAudio.current = []; return }
    await new Promise<void>(resolve => { mr.onstop = () => resolve(); mr.stop() })
    if (!trozosAudio.current.length) return
    const tipo = mr.mimeType || 'audio/webm'
    const file = new File([new Blob(trozosAudio.current, { type: tipo })], `voz_${Date.now()}.${tipo.includes('ogg') ? 'ogg' : 'webm'}`, { type: tipo })
    setUploading(true); setSending(true)
    try {
      const { url } = await subir(file)
      await publicar({ content: L('Voice message', 'Mensaje de voz'), message_type: 'audio', file_url: url, file_name: file.name, file_size: file.size })
    } catch (e: any) { toast.error(L('Could not send the audio: ', 'No se pudo enviar el audio: ') + e.message) }
    finally { setUploading(false); setSending(false) }
  }
  const micTactil = (e: React.TouchEvent) => { e.preventDefault(); e.stopPropagation(); if (recording) stopRecording(false); else startRecording() }

  const elegirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) { setAdjunto(f); setVerAdjuntar(false) }
    e.target.value = ''
  }

  const etiquetaDia = (iso: string) => {
    const d = new Date(iso), hoy = new Date(), ayer = new Date(); ayer.setDate(hoy.getDate() - 1)
    if (d.toDateString() === hoy.toDateString()) return L('Today', 'Hoy')
    if (d.toDateString() === ayer.toDateString()) return L('Yesterday', 'Ayer')
    return d.toLocaleDateString(bcp, { weekday: 'long', day: 'numeric', month: 'long' })
  }
  const hora = (iso: string) => new Date(iso).toLocaleTimeString(bcp, { hour: '2-digit', minute: '2-digit' })

  const equipo = [...new Map(messages.filter(m => m.sender_id !== userId).map(m => [m.sender_id, m])).values()].slice(0, 3)
  const puedeEnviar = !!(input.trim() || adjunto)
  const sugerencias = [
    { Icon: CalendarDays, t: L('I have a question about an appointment', 'Tengo una consulta sobre una cita') },
    { Icon: BarChart3, t: L('Could you send me a progress report?', '¿Me pueden enviar un reporte de avance?') },
    { Icon: HelpCircle, t: L('I have a question', 'Tengo una duda') },
  ]

  return (
    <div className="v-scope flex h-full min-h-0 flex-col overflow-hidden bg-v-elevated">
      {/* ── Encabezado ── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-v-border px-3 py-3 sm:px-4">
        {equipo.length > 0 ? (
          <span className="flex -space-x-2">{equipo.map(m => <span key={m.sender_id} className="rounded-full ring-2 ring-v-elevated"><Avatar name={m.sender_name} role={m.sender_role} url={m.sender_avatar} /></span>)}</span>
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-v-accent-soft text-v-accent"><Users size={18} /></span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-v-text">{L(`${nombre}'s team`, `Equipo de ${nombre}`)}</p>
          <p className="flex items-center gap-1 truncate text-xs text-v-subtle"><Lock size={11} /> {L('Private chat with the center and therapists', 'Chat privado con el centro y los terapeutas')}</p>
        </div>
        <span className="hidden items-center gap-1 rounded-full bg-v-success/15 px-2.5 py-1 text-[11px] font-semibold text-v-success sm:inline-flex"><span className="size-1.5 rounded-full bg-v-success" /> {L('Online', 'En línea')}</span>
      </div>

      {/* ── Mensajes ── */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-v-bg px-3 py-4 sm:px-5" style={{ scrollbarWidth: 'thin' }}>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-v-accent" /></div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-v-elevated text-v-accent shadow-v"><MessageCircle size={24} /></span>
            <p className="mt-3 text-base font-semibold text-v-text">{L('Write to us', 'Escríbenos')}</p>
            <p className="mt-1 max-w-sm text-sm text-v-subtle">{L(`This chat is private between your family and ${nombre}'s team.`, `Este chat es privado entre tu familia y el equipo de ${nombre}.`)}</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
              {sugerencias.map(({ Icon, t }) => (
                <button key={t} onClick={() => { setInput(t); inputRef.current?.focus() }}
                  className="inline-flex items-center gap-2 rounded-full border border-v-border bg-v-elevated px-3.5 py-2 text-xs font-semibold text-v-text shadow-v transition-colors hover:border-v-accent/40 hover:text-v-accent">
                  <Icon size={13} /> {t}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full">
            {messages.map((msg, i) => {
              const mio = msg.sender_id === userId
              const rol = rolDe(msg.sender_role)
              const dia = nuevoDia(msg.created_at, messages[i - 1]?.created_at)
              const leido = (msg.read_by?.length || 0) > 1
              const media = msg.message_type === 'image'
              const primero = i === 0 || messages[i - 1]?.sender_id !== msg.sender_id || dia
              const avatar = <Avatar name={mio ? userName : msg.sender_name} role={msg.sender_role} url={mio ? profile?.avatar_url : msg.sender_avatar} visible={primero} />
              return (
                <div key={msg.id}>
                  {dia && (
                    <div className="my-4 flex justify-center">
                      <span className="rounded-full bg-v-elevated px-3 py-1 text-[11px] font-semibold text-v-muted shadow-v first-letter:uppercase">{etiquetaDia(msg.created_at)}</span>
                    </div>
                  )}
                  {!mio && primero && (
                    <div className="mb-1 mt-3 flex items-center gap-1.5 pl-10">
                      <span className="text-[11px] font-semibold text-v-text">{msg.sender_name}</span>
                      <span className={`rounded-full px-2 py-px text-[10px] font-semibold ${rol.pill}`}>{en ? rol.en : rol.es}</span>
                    </div>
                  )}
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
                    className={`flex items-end gap-2 ${mio ? 'justify-end' : 'justify-start'} ${primero && mio ? 'mt-3' : 'mt-1'}`}>
                    {!mio && avatar}
                    <div className={`overflow-hidden shadow-v ${media ? 'max-w-[250px] p-1' : 'max-w-[78%] px-3.5 py-2 sm:max-w-[68%]'} ${mio ? 'bg-v-accent text-white' : 'border border-v-border bg-v-elevated text-v-text'}`}
                      style={{ borderRadius: mio ? (primero ? '20px 20px 6px 20px' : 20) : (primero ? '20px 20px 20px 6px' : 20) }}>
                      <Contenido msg={msg} mio={mio} L={L} />
                      <div className={`mt-1 flex items-center justify-end gap-1 ${media ? 'px-1.5 pb-1' : ''}`}>
                        <span className={`text-[10px] ${mio ? 'text-white/70' : 'text-v-subtle'}`}>{hora(msg.created_at)}</span>
                        {mio && (leido ? <CheckCheck size={12} className="text-white" /> : <Check size={12} className="text-white/60" />)}
                      </div>
                    </div>
                    {mio && avatar}
                  </motion.div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Escribir ── */}
      <div className="shrink-0 border-t border-v-border px-3 py-3 sm:px-4">
        <div className="w-full">
          {adjunto && (
            <div className="mb-2 flex items-center gap-3 rounded-v-sm border border-v-accent/25 bg-v-accent-soft/60 p-2">
              {adjunto.type.startsWith('image/')
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={URL.createObjectURL(adjunto)} alt="" className="size-12 rounded-v-sm object-cover" style={{ height: 48 }} />
                : <span className="grid size-12 place-items-center rounded-v-sm bg-v-elevated text-v-accent"><FileText size={20} /></span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-v-text">{adjunto.name}</p>
                <p className="text-[11px] text-v-subtle">{fmtPeso(adjunto.size)}</p>
              </div>
              <button onClick={() => setAdjunto(null)} aria-label={L('Remove', 'Quitar')} className="grid size-8 shrink-0 place-items-center rounded-full text-v-muted hover:bg-v-danger/10 hover:text-v-danger"><X size={14} /></button>
            </div>
          )}

          {recording && (
            <div className="mb-2 flex items-center gap-3 rounded-v-sm bg-v-danger/10 px-3.5 py-2.5">
              <span className="size-2.5 animate-pulse rounded-full bg-v-danger" />
              <span className="text-sm font-semibold text-v-danger">{L('Recording', 'Grabando')}</span>
              <span className="text-sm font-semibold tabular-nums text-v-danger">{fmtDur(recSegundos)}</span>
              <button onClick={() => stopRecording(true)} className="ml-auto h-8 rounded-full px-3 text-xs font-semibold text-v-muted hover:bg-v-fill">{L('Cancel', 'Cancelar')}</button>
            </div>
          )}

          <AnimatePresence>
            {verAdjuntar && !recording && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <button onClick={() => { imagenRef.current?.click(); setVerAdjuntar(false) }}
                    className="flex items-center justify-center gap-2 rounded-v-sm bg-v-accent-soft py-3 text-sm font-semibold text-v-accent transition-colors hover:bg-v-accent hover:text-white">
                    <ImageIcon size={18} /> {L('Image', 'Imagen')}
                  </button>
                  <button onClick={() => { archivoRef.current?.click(); setVerAdjuntar(false) }}
                    className="flex items-center justify-center gap-2 rounded-v-sm bg-v-success/15 py-3 text-sm font-semibold text-v-success transition-colors hover:bg-v-success hover:text-white">
                    <FileText size={18} /> {L('Document', 'Documento')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-1.5">
            {!recording && (
              <button onClick={() => setVerAdjuntar(v => !v)} disabled={sending || uploading} title={L('Attach', 'Adjuntar')}
                className={`grid size-10 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40 ${verAdjuntar ? 'bg-v-accent text-white' : 'text-v-muted hover:bg-v-fill hover:text-v-accent'}`}>
                {verAdjuntar ? <X size={17} /> : <Paperclip size={17} />}
              </button>
            )}
            {!recording && (
              <div className="min-w-0 flex-1 rounded-[22px] border border-v-border bg-v-bg px-4 py-2 transition-colors focus-within:border-v-accent">
                <textarea ref={inputRef} value={input} rows={1} disabled={sending}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 100) + 'px' }}
                  placeholder={L('Write a message to the team…', 'Escribe un mensaje al equipo…')}
                  className="block max-h-[100px] w-full resize-none bg-transparent text-sm leading-6 text-v-text outline-none [font-family:inherit] placeholder:text-v-subtle" />
              </div>
            )}
            {recording ? (
              <button onClick={() => stopRecording(false)} title={L('Send recording', 'Enviar grabación')}
                className="grid size-10 shrink-0 animate-pulse place-items-center rounded-full bg-v-danger text-white"><StopCircle size={18} /></button>
            ) : puedeEnviar ? (
              <button onClick={() => sendMessage()} disabled={sending || uploading} className="v-brand grid size-10 shrink-0 place-items-center rounded-full disabled:opacity-50">
                {(sending || uploading) ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              </button>
            ) : (
              <button onMouseDown={startRecording} onMouseUp={() => stopRecording(false)} onTouchStart={micTactil} disabled={sending || uploading}
                title={L('Hold to record', 'Mantén presionado para grabar')}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-v-accent-soft text-v-accent transition-colors hover:bg-v-accent hover:text-white disabled:opacity-40">
                {uploading ? <Loader2 size={17} className="animate-spin" /> : <Mic size={17} />}
              </button>
            )}
          </div>
          <p className="mt-1.5 hidden px-1 text-[11px] text-v-subtle sm:block">
            {recording ? L('Release/tap to send · Cancel to discard', 'Suelta/toca para enviar · Cancelar para descartar')
              : puedeEnviar ? L('Enter to send · Shift+Enter for a new line', 'Enter para enviar · Shift+Enter para nueva línea')
              : L('Hold the mic to record · Clip to attach files', 'Mantén el micrófono para grabar · Clip para adjuntar archivos')}
          </p>
        </div>
      </div>

      <input ref={imagenRef} type="file" accept="image/*" className="hidden" onChange={elegirArchivo} />
      <input ref={archivoRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" className="hidden" onChange={elegirArchivo} />
    </div>
  )
}
