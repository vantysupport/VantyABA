'use client'
import React from 'react'

import { useI18n } from '@/lib/i18n-context'
import { useCuotaAria, ChipCuotaAria, textoAriaAgotada } from '@/components/ui/cuota-aria'
import { toBCP47 } from '@/lib/i18n'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Send, Loader2, User, BookOpen, Trash2, Volume2, VolumeX, Sparkles
} from 'lucide-react'
import { motion } from 'motion/react'
import { AriaGlyph } from '@/components/ui/aria-glyph'
import { confirmar } from '@/components/ui/confirmar'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  fuentes?: string[]
}

// Divide un texto en segmentos cortos por frases, agrupando hasta ~180 caracteres.
// El primer segmento se mantiene corto para que la voz empiece a sonar cuanto antes.
function splitEnFrases(text: string, maxLen = 180): string[] {
  const limpio = text.replace(/\s+/g, ' ').trim()
  if (!limpio) return []
  const frases = limpio.match(/[^.!?¿¡\n]+[.!?]*/g) || [limpio]
  const chunks: string[] = []
  let actual = ''
  for (const f of frases) {
    const frase = f.trim()
    if (!frase) continue
    // El primer chunk se cierra antes (más corto) para arrancar rápido
    const limite = chunks.length === 0 ? Math.min(maxLen, 90) : maxLen
    if (actual && (actual.length + frase.length + 1) > limite) {
      chunks.push(actual.trim())
      actual = frase
    } else {
      actual = actual ? `${actual} ${frase}` : frase
    }
  }
  if (actual.trim()) chunks.push(actual.trim())
  return chunks.length > 0 ? chunks : [limpio]
}

interface ARIAAgentChatProps {
  userId: string
  childId?: string
  childName?: string
  contexto?: string
  compact?: boolean
}

export default function ARIAAgentChat({
  userId, childId, childName, contexto = 'general', compact = false
}: ARIAAgentChatProps) {
  const { t, locale } = useI18n()
  // Mensajes a ARIA que quedan hoy según el plan del centro
  const { cuota: cuotaAria, agotado: ariaAgotada, cargar: recargarCuota } = useCuotaAria(true)

  // Keys por usuario + paciente — persisten entre cierres/aperturas
  const STORAGE_KEY = useMemo(
    () => `aria_agent_msgs_${userId}${childId ? '_' + childId : ''}`,
    [userId, childId]
  )
  const CONV_KEY = useMemo(
    () => `aria_agent_conv_${userId}${childId ? '_' + childId : ''}`,
    [userId, childId]
  )

  const welcomeMsg = useCallback((): Message => ({
    role: 'assistant',
    content: childId
      ? (locale === 'en'
          ? `Hi! 👋 I'm **ARIA**. I'm reviewing **${childName || 'your patient'}**'s record and I have access to their full history, ABA programs, therapeutic goals and previous evaluations.\n\nHow can I help you today?`
          : `¡Hola! 👋 Soy **ARIA**. Estoy revisando el expediente de **${childName || 'tu paciente'}** y tengo acceso a todo su historial, programas ABA, objetivos terapéuticos y evaluaciones previas.\n\n¿En qué te puedo ayudar hoy?`)
      : (locale === 'en'
          ? `Hi! 👋 I'm **ARIA**, your clinical assistant.\n\nI'm trained in ABA, neuropsychology and special education.\n\nHow can I help you today? 🧠`
          : `¡Hola! 👋 Soy **ARIA**, tu asistente clínica.\n\nEstoy entrenada en ABA, neuropsicología y educación especial.\n\n¿En qué puedo ayudarte hoy? 🧠`),
    timestamp: new Date().toISOString(),
  }), [childId, childName, locale])

  // Estado inicial — restaura desde localStorage si existe
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem(`aria_agent_msgs_${userId}${childId ? '_' + childId : ''}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return []
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversacionId, setConversacionId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(`aria_agent_conv_${userId}${childId ? '_' + childId : ''}`)
    } catch { return null }
  })
  const [sugerencias] = useState(
    locale === 'en'
      ? [
          childId ? `How is ${childName || 'this patient'}'s overall progress?` : 'What are the best reinforcers for non-verbal ASD?',
          'How do I apply escape extinction in a session?',
          childId ? `What programs do you recommend for ${childName || 'this patient'}?` : 'How do I handle an ethical dilemma in therapy?',
        ]
      : [
          childId ? `¿Cómo va el progreso general de ${childName || 'este paciente'}?` : '¿Cuáles son los mejores reforzadores para TEA no verbal?',
          '¿Cómo aplicar extinción de escape en sesión?',
          childId ? `¿Qué programas recomiendas para ${childName || 'este paciente'}?` : '¿Cómo manejar un dilema ético en terapia?',
        ]
  )
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const prevKeyRef = useRef<string>(STORAGE_KEY)

  // ── Voz de ARIA (Edge TTS, con respaldo a la voz del navegador) ──
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [speaking, setSpeaking]         = useState(false)
  const audioRef        = useRef<HTMLAudioElement | null>(null)
  const speakTokenRef   = useRef(0)
  const voiceEnabledRef = useRef(voiceEnabled)
  useEffect(() => { voiceEnabledRef.current = voiceEnabled }, [voiceEnabled])

  const stopSpeaking = useCallback(() => {
    speakTokenRef.current++
    try { audioRef.current?.pause(); audioRef.current = null } catch {}
    try { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel() } catch {}
    setSpeaking(false)
  }, [])

  const speakBrowser = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { setSpeaking(false); return }
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      const isEn = String(locale || '').toLowerCase().startsWith('en')
      u.lang = isEn ? 'en-US' : 'es-ES'; u.rate = 1; u.pitch = 1.05
      const pref = isEn ? 'en' : 'es'
      const match = window.speechSynthesis.getVoices().find(v => v.lang?.toLowerCase().startsWith(pref))
      if (match) u.voice = match
      u.onstart = () => setSpeaking(true)
      u.onend   = () => setSpeaking(false)
      u.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(u)
    } catch { setSpeaking(false) }
  }, [locale])

  // Voz neuronal de ARIA — generada al momento, sin guardar nada.
  // Se divide el texto en frases y se reproduce la primera apenas está lista,
  // mientras se generan las siguientes en segundo plano (baja la latencia inicial).
  const speak = useCallback(async (text: string) => {
    const limpio = (text || '').trim()
    if (!limpio) return
    stopSpeaking()
    const myToken = ++speakTokenRef.current
    setSpeaking(true)

    const segmentos = splitEnFrases(limpio)

    const fetchAudio = async (seg: string): Promise<string> => {
      const res = await fetch('/api/elevenlabs-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: seg, locale }),
      })
      if (!res.ok) throw new Error('tts')
      const blob = await res.blob()
      return URL.createObjectURL(blob)
    }

    const playUrl = (url: string) => new Promise<void>((resolve) => {
      const a = new Audio(url)
      audioRef.current = a
      a.onended = () => resolve()
      a.onerror = () => resolve()
      a.play().catch(() => resolve())
    })

    try {
      // Pipeline: mientras suena un segmento, ya se va pidiendo el siguiente
      let siguiente = fetchAudio(segmentos[0])
      for (let i = 0; i < segmentos.length; i++) {
        const url = await siguiente
        if (myToken !== speakTokenRef.current) { URL.revokeObjectURL(url); return }
        // prefetch del próximo segmento en paralelo a la reproducción del actual
        siguiente = i + 1 < segmentos.length
          ? fetchAudio(segmentos[i + 1]).catch(() => '')
          : Promise.resolve('')
        await playUrl(url)
        URL.revokeObjectURL(url)
        if (myToken !== speakTokenRef.current) return
      }
    } catch {
      if (myToken === speakTokenRef.current) speakBrowser(limpio)
    } finally {
      if (myToken === speakTokenRef.current) setSpeaking(false)
    }
  }, [stopSpeaking, speakBrowser, locale])

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(v => { if (v) stopSpeaking(); return !v })
  }, [stopSpeaking])

  // Cortar la voz al desmontar
  useEffect(() => () => stopSpeaking(), [stopSpeaking])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Persistir mensajes en localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (messages.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch {}
  }, [messages, STORAGE_KEY])

  // Persistir conversacionId
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (conversacionId) localStorage.setItem(CONV_KEY, conversacionId)
      else localStorage.removeItem(CONV_KEY)
    } catch {}
  }, [conversacionId, CONV_KEY])

  // Cambio de paciente → cargar el historial de ESE paciente desde localStorage
  // Solo se ejecuta cuando STORAGE_KEY cambia (no en el primer render)
  useEffect(() => {
    if (prevKeyRef.current === STORAGE_KEY) return
    prevKeyRef.current = STORAGE_KEY
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      const savedConv = localStorage.getItem(CONV_KEY)
      const parsed = saved ? JSON.parse(saved) : []
      setConversacionId(savedConv || null)
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMessages(parsed)
      } else {
        setMessages([welcomeMsg()])
      }
    } catch {
      setMessages([welcomeMsg()])
    }
  }, [STORAGE_KEY, CONV_KEY, welcomeMsg])

  // Mostrar bienvenida si el chat está completamente vacío al montar
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([welcomeMsg()])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Borrar historial — localStorage + Supabase + reset estado
  const clearHistory = useCallback(async () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(CONV_KEY)
      } catch {}
    }
    try {
      const params = new URLSearchParams({ user_id: userId })
      if (conversacionId) params.set('conversacion_id', conversacionId)
      await fetch(`/api/agente/chat?${params.toString()}`, { method: 'DELETE' })
    } catch {}
    setConversacionId(null)
    setMessages([welcomeMsg()])
  }, [STORAGE_KEY, CONV_KEY, userId, conversacionId, welcomeMsg])

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading || ariaAgotada) return

    setInput('')
    setLoading(true)

    const userMessage: Message = {
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMessage])

    try {
      const res = await fetch('/api/agente/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': locale || 'es' },
        body: JSON.stringify({ mensaje: msg, childId, userId, conversacionId, contexto , locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setConversacionId(data.conversacionId)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.respuesta,
        timestamp: new Date().toISOString(),
        fuentes: data.fuentesUsadas,
      }])
      if (voiceEnabledRef.current) speak(data.respuesta)
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Ocurrió un error al procesar tu consulta. Por favor intenta de nuevo.',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
      recargarCuota()
      inputRef.current?.focus()
    }
  }, [input, loading, ariaAgotada, childId, userId, conversacionId, contexto, locale, speak, recargarCuota])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div className="v-scope flex h-full flex-col overflow-hidden bg-v-bg">
      {/* Header (solo vista completa; en la flotante lo pone el contenedor) */}
      {!compact && (
        <div className="flex shrink-0 items-center justify-between border-b border-v-border bg-v-elevated px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="relative size-9 shrink-0 overflow-hidden rounded-full ring-1 ring-v-border"><AriaGlyph /></span>
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-v-text">
                {t('auto.aRIAAgentChat.ariaAsistenteClinicoIa')}
                <span className="rounded-full bg-v-accent-soft px-1.5 py-0.5 text-[9px] font-bold text-v-accent">BETA</span>
              </h3>
              <p className="text-[11px] text-v-subtle">
                {childId ? `${locale === 'en' ? 'Active case' : 'Caso activo'}: ${childName || 'Paciente'}` : (locale === 'en' ? 'Specialized clinical assistant' : 'Asistente clínica especializada')}
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-v-success/15 px-2.5 py-1 text-[10px] font-semibold text-v-success">
            <span className="size-1.5 animate-pulse rounded-full bg-v-success" /> {t('common.activo')}
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5" style={{ scrollbarWidth: 'thin' }}>
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {loading && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-2.5">
            <AriaAvatar />
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-v-border bg-v-elevated px-4 py-3.5 shadow-v">
              {[0, 1, 2].map(d => (
                <motion.span key={d} className="size-1.5 rounded-full bg-v-accent"
                  animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }} />
              ))}
              <span className="sr-only">{t('aria.ariaPensando')}</span>
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Sugerencias */}
      {messages.length <= 1 && (
        <div className="shrink-0 px-4 pb-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-v-subtle">
            <Sparkles size={11} className="text-v-accent" />
            {locale === 'en' ? 'Suggested questions' : 'Preguntas sugeridas'}
          </p>
          <div className="flex flex-wrap gap-2">
            {sugerencias.map((s, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => sendMessage(s)}
                className="rounded-full border border-v-border bg-v-elevated px-3.5 py-2 text-left text-xs font-medium leading-tight text-v-muted shadow-v transition-colors hover:border-v-accent/40 hover:bg-v-accent-soft hover:text-v-accent"
              >
                {s}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="shrink-0 border-t border-v-border bg-v-elevated px-4 pb-4 pt-2.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[11px] text-v-subtle">
            <ChipCuotaAria cuota={cuotaAria} en={locale === 'en'} />
            {messages.length > 1
              ? (locale === 'en'
                  ? `${messages.length - 1} saved message${messages.length > 2 ? 's' : ''}`
                  : `${messages.length - 1} mensaje${messages.length > 2 ? 's' : ''} guardado${messages.length > 2 ? 's' : ''}`)
              : (locale === 'en' ? 'New conversation' : 'Conversación nueva')}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleVoice}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${voiceEnabled ? 'bg-v-success/15 text-v-success' : 'text-v-subtle hover:bg-v-fill hover:text-v-text'}`}
              title={voiceEnabled ? (locale === 'en' ? "Disable ARIA's voice" : 'Desactivar voz de ARIA') : (locale === 'en' ? "Enable ARIA's voice" : 'Activar voz de ARIA')}
            >
              {voiceEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              {speaking ? (locale === 'en' ? 'Speaking…' : 'Hablando…') : (locale === 'en' ? 'Voice' : 'Voz')}
            </button>
            <button
              onClick={async () => { if (await confirmar(t('auto.aRIAAgentChat.borrarTodoElHistorialDe'))) clearHistory() }}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-v-subtle transition-colors hover:bg-v-danger/10 hover:text-v-danger"
              title={t('auto.aRIAAgentChat.borrarHistorialDelChat')}
            >
              <Trash2 size={13} />
              {locale === 'en' ? 'Clear' : 'Borrar'}
            </button>
          </div>
        </div>
        {ariaAgotada && cuotaAria && (
          <p role="status" className="mb-2 rounded-v-sm bg-v-warning/10 px-3 py-2 text-xs text-v-text">{textoAriaAgotada(cuotaAria, locale === 'en')}</p>
        )}
        <div className="flex items-end gap-2 rounded-[22px] border border-v-border bg-v-bg p-1.5 pl-4 transition-shadow focus-within:border-v-accent/50 focus-within:ring-4 focus-within:ring-v-accent-soft">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={ariaAgotada}
            {...{placeholder: t('ui.ask_aria')}}
            className="max-h-28 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-sm leading-relaxed text-v-text outline-none placeholder:text-v-subtle"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading || ariaAgotada}
            aria-label={locale === 'en' ? 'Send' : 'Enviar'}
            className="v-brand grid size-9 shrink-0 place-items-center rounded-full transition-opacity disabled:opacity-35 disabled:shadow-none"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} className="-translate-x-px translate-y-px" />}
          </motion.button>
        </div>
      </div>
    </div>
  )
}

function AriaAvatar() {
  return (
    <span className="relative size-7 shrink-0 overflow-hidden rounded-full ring-1 ring-v-border">
      <AriaGlyph />
    </span>
  )
}

function MessageBubble({ message }: { message: Message; key?: any }) {
  const { locale } = useI18n()
  const isUser = message.role === 'user'

  const formatContent = (text: string) => {
    // Red de seguridad: convertir <br> literales a saltos de línea reales (el modelo a veces los emite)
    const normalized = text.replace(/<br\s*\/?>/gi, '\n')
    return normalized.split('\n').map((line, i, arr) => {
      const parts = line.split(/\*\*(.*?)\*\*/g)
      return (
        <span key={i}>
          {parts.map((part, j) => j % 2 === 1 ? <strong key={j} className="font-semibold">{part}</strong> : part)}
          {i < arr.length - 1 && <br />}
        </span>
      )
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className={`flex items-end gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {isUser
        ? <span className="grid size-7 shrink-0 place-items-center rounded-full bg-v-fill text-v-muted"><User size={13} /></span>
        : <AriaAvatar />}
      <div className={`flex max-w-[82%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`px-4 py-2.5 text-sm leading-relaxed ${isUser
          ? 'v-brand rounded-2xl rounded-br-md'
          : 'rounded-2xl rounded-bl-md border border-v-border bg-v-elevated text-v-text shadow-v'}`}
          style={isUser ? { boxShadow: 'none' } : undefined}>
          {formatContent(message.content)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <span className="text-[10px] text-v-subtle">
            {new Date(message.timestamp).toLocaleTimeString(toBCP47(locale), { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.fuentes && message.fuentes.length > 0 && message.fuentes.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-2 py-0.5 text-[9px] font-semibold text-v-accent">
              <BookOpen size={9} /> {f}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
