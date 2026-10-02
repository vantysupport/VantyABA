'use client'
import { useCentroBranding } from '@/components/CentroBrandingContext'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'

import { useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { Send, Heart, ShoppingBag, Mic, MicOff, Volume2, VolumeX, RefreshCw, StopCircle, ClipboardList, Home, Target, ArrowRight, Smile, Meh, Frown, Coins } from 'lucide-react'
import { TokensChip } from '@/components/ui/tokens-chip'
import ComprarTokensPadre from '@/components/ComprarTokensPadre'
import { AnimatePresence, motion } from 'motion/react'
import { AriaGlyph } from '@/components/ui/aria-glyph'

// ── Tipos para Web Speech API ─────────────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

// ── Hook de Text-to-Speech con ElevenLabs (Ivanna) ───────────────────────────
// Limpia el texto para voz y lo parte en frases cortas: así ARIA empieza a hablar apenas
// está lista la primera frase, mientras se preparan las siguientes (antes esperaba el audio
// de toda la respuesta, que podía tardar muchos segundos).
function partirParaVoz(texto: string): string[] {
  const limpio = texto
    .replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/#{1,6}\s/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/^\s*[-•*]\s+/gm, '').replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n+/g, '. ').replace(/\s+/g, ' ').replace(/(\.\s*){2,}/g, '. ').trim()
  const frases = limpio.match(/[^.!?¡¿]+[.!?]+|[^.!?]+$/g) || [limpio]
  const trozos: string[] = []
  let actual = ''
  for (const f of frases) {
    const x = f.trim(); if (!x) continue
    // el primer trozo corto para arrancar rápido; los demás más largos (menos pausas)
    const max = trozos.length === 0 ? 140 : 380
    if ((actual + ' ' + x).trim().length > max && actual) { trozos.push(actual.trim()); actual = x }
    else actual = `${actual} ${x}`
  }
  if (actual.trim()) trozos.push(actual.trim())
  return trozos.slice(0, 30)
}

function useTextToSpeech() {
  const { locale } = useI18n()
  const [speaking, setSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const turnoRef = useRef(0)

  const speak = useCallback(async (text: string) => {
    if (!voiceEnabled || !text.trim()) return
    abortRef.current?.abort()
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    const turno = ++turnoRef.current
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setSpeaking(true)

    const trozos = partirParaVoz(text)
    const urlDe = (t: string) => `/api/elevenlabs-tts?${new URLSearchParams({ text: t, locale: locale || 'es' })}`
    // Crea el <audio> y empieza a descargar (streaming) sin reproducir todavía
    const preparar = (t: string) => { const a = new Audio(); a.preload = 'auto'; a.src = urlDe(t); a.load(); return a }
    const reproducir = (audio: HTMLAudioElement) => new Promise<boolean>((resolve) => {
      audioRef.current = audio
      audio.onended = () => resolve(true)
      audio.onerror = () => resolve(false)
      audio.play().catch(() => resolve(false))
    })

    let siguiente: HTMLAudioElement | null = trozos.length ? preparar(trozos[0]) : null
    let ok = true
    for (let k = 0; k < trozos.length && siguiente; k++) {
      const actual = siguiente
      // mientras suena este trozo, el siguiente ya se va descargando
      siguiente = k + 1 < trozos.length ? preparar(trozos[k + 1]) : null
      if (turno !== turnoRef.current) return
      ok = await reproducir(actual)
      if (turno !== turnoRef.current) return
      if (!ok) break
    }
    if (turno !== turnoRef.current) return
    if (!ok && k0Fallback()) return
    setSpeaking(false)

    // Respaldo: voz del navegador si el servicio de voz falló
    function k0Fallback() {
      if (!('speechSynthesis' in window)) return false
      const utter = new SpeechSynthesisUtterance(trozos.join(' ').slice(0, 4000))
      utter.lang = toBCP47(locale)
      utter.rate = 1.05
      utter.onend = () => setSpeaking(false)
      utter.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utter)
      return true
    }
  }, [voiceEnabled, locale])

  const stopSpeaking = useCallback(() => {
    turnoRef.current++
    abortRef.current?.abort()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const toggleVoice = useCallback(() => {
    if (speaking) {
      turnoRef.current++
      abortRef.current?.abort()
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
    setVoiceEnabled(v => !v)
  }, [speaking])

  return { speak, stopSpeaking, speaking, voiceEnabled, toggleVoice }
}

// ── Hook de Speech-to-Text ────────────────────────────────────────────────────
function useSpeechToText(onResult: (text: string) => void) {
  const { t, locale } = useI18n()

  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setSupported(true)
      const rec = new SpeechRecognition()
      rec.lang = toBCP47(locale)
      rec.continuous = false
      rec.interimResults = false
      rec.maxAlternatives = 1
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript
        onResult(transcript)
      }
      rec.onend = () => setListening(false)
      rec.onerror = () => setListening(false)
      recognitionRef.current = rec
    }
  }, [onResult])

  const startListening = useCallback(() => {
    if (!recognitionRef.current || listening) return
    setListening(true)
    recognitionRef.current.start()
  }, [listening])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return
    recognitionRef.current.stop()
    setListening(false)
  }, [])

  return { listening, supported, startListening, stopListening }
}

// ── Detección emocional ───────────────────────────────────────────────────────
const EMOTIONAL_KEYWORDS = [
  'cansado','cansada','agotado','agotada','frustrado','frustrada',
  'triste','llorar','lloro','no sé qué hacer','no avanza','no mejora',
  'sin esperanza','desesperado','desesperada','culpa','culpable',
  'difícil','no puedo','rendirme','solo','sola','nadie entiende',
  'necesito ayuda','estoy mal','me siento mal','deprimido','deprimida',
  'preocupado','preocupada','angustiado','angustiada','miedo','apoyo emocional',
  'hard for me','tired','exhausted','overwhelmed','sad','emotional support','i need support','worried','anxious',
]

function detectsEmotion(t: string) {

  const l = t.toLowerCase()
  return EMOTIONAL_KEYWORDS.some(kw => l.includes(kw))
}

function getEmotionalPrefix(text: string, centroNombre: string, en: boolean): string {
  const l = text.toLowerCase()
  if (/cansad|agotad|tired|exhausted/.test(l))
    return en ? 'I understand you are tired, and that is completely valid. Supporting a child through this process takes a lot of energy.\n\n'
              : 'Entiendo que estás cansado/a, y eso es completamente válido. Acompañar a un hijo en este proceso requiere muchísima energía.\n\n'
  if (/culpa|guilt/.test(l))
    return en ? 'There is no blame here. You are a parent looking for the best for your child, and that says everything about you.\n\n'
              : 'No hay culpa aquí. Eres un papá o mamá que busca lo mejor para su hijo/a, y eso ya dice todo de ti.\n\n'
  if (/no avanza|no mejora|not improving|no progress/.test(l))
    return en ? 'Progress in ABA therapy is not always linear, but it is real. Gains add up even when we do not see them every day.\n\n'
              : 'El progreso en terapia ABA no siempre es lineal, pero sí real. Hay avances que se acumulan aunque no los veamos cada día.\n\n'
  if (/\bsolo\b|\bsola\b|nadie entiende|alone|nobody understands/.test(l))
    return en ? `You are not alone. The whole ${centroNombre} team is here for you and your family.\n\n`
              : `No estás solo/a. Todo el equipo de ${centroNombre} está aquí para acompañarte a ti y a tu familia.\n\n`
  return en ? 'I hear how you feel, and it is completely valid. I am here with you.\n\n'
            : 'Escucho cómo te sientes, y es completamente válido. Estoy aquí contigo.\n\n'
}

// ── Avatar de ARIA (la mascota) ───────────────────────────────────────────────
function AriaAvatar({ size = 36, pulso = false }: { size?: number; pulso?: boolean }) {
  return (
    <span className="relative block shrink-0 overflow-hidden rounded-full ring-2 ring-v-elevated shadow-v" style={{ width: size, height: size }}>
      <AriaGlyph />
      {pulso && <motion.span className="absolute inset-0 rounded-full ring-2 ring-v-accent" animate={{ opacity: [0.9, 0, 0.9], scale: [1, 1.25, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />}
    </span>
  )
}

// ── Markdown sencillo ─────────────────────────────────────────────────────────
function renderMarkdown(text: string) {
  if (!text) return null
  const lines = text.split('\n')
  const elements: ReactNode[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) { elements.push(<div key={i} className="h-1.5" />); continue }
    if (line.startsWith('### ')) { elements.push(<p key={i} className="mt-2 text-sm font-semibold text-v-text">{parseInline(line.slice(4))}</p>); continue }
    if (line.startsWith('**') && line.endsWith('**') && line.length > 4) { elements.push(<p key={i} className="mt-2 text-sm font-semibold text-v-text">{line.slice(2, -2)}</p>); continue }
    if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(<div key={i} className="flex items-start gap-2 text-sm leading-relaxed text-v-text"><span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-v-accent" /><span>{parseInline(line.slice(2))}</span></div>)
      continue
    }
    const num = line.match(/^(\d+)\. (.+)/)
    if (num) {
      elements.push(<div key={i} className="flex items-start gap-2 text-sm leading-relaxed text-v-text"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-v-accent-soft text-[10px] font-bold text-v-accent">{num[1]}</span><span>{parseInline(num[2])}</span></div>)
      continue
    }
    elements.push(<p key={i} className="text-sm leading-relaxed text-v-text">{parseInline(line)}</p>)
  }
  return <div className="flex flex-col gap-1">{elements}</div>
}

function parseInline(text: string): ReactNode {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return <>{parts.map((p, i) => (i % 2 === 1 ? <strong key={i} className="font-semibold text-v-text">{p}</strong> : p))}</>
}

// ── Burbujas ──────────────────────────────────────────────────────────────────
const OPCIONES_BIENESTAR = [
  { es: 'Bien, con energía', en: 'Good, with energy', Icon: Smile, tone: 'text-v-success' },
  { es: 'Regular, algo cansado/a', en: 'So-so, a bit tired', Icon: Meh, tone: 'text-v-warning' },
  { es: 'Difícil, necesito apoyo', en: 'Hard, I need support', Icon: Frown, tone: 'text-v-danger' },
]

function MessageBubble({ m, onNavigateToStore, onWellbeingAnswer }: { m: any; onNavigateToStore?: () => void; onWellbeingAnswer?: (opt: string) => void }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  if (m.role === 'user') {
    return (
      <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} className="mb-3 flex justify-end">
        <div className="v-brand max-w-[80%] rounded-[22px] rounded-br-md px-4 py-2.5 text-sm leading-relaxed" style={{ boxShadow: 'none' }}>{m.text}</div>
      </motion.div>
    )
  }
  if (m.type === 'wellbeing') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex items-start gap-2.5">
        <AriaAvatar size={32} />
        <div className="max-w-[85%] overflow-hidden rounded-[22px] rounded-tl-md border border-v-border bg-v-elevated shadow-v">
          <div className="px-4 pb-2 pt-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-v-accent"><Heart size={11} /> {en ? 'Wellbeing check-in' : 'Chequeo de bienestar'}</p>
            <p className="mt-1 text-sm leading-relaxed text-v-text">{en ? 'How have you felt this week supporting your child?' : '¿Cómo te has sentido esta semana acompañando a tu peque?'}</p>
          </div>
          <div className="flex flex-col gap-1.5 px-3 pb-3">
            {OPCIONES_BIENESTAR.map(o => (
              <button key={o.es} onClick={() => onWellbeingAnswer?.(en ? o.en : o.es)}
                className="flex items-center gap-2.5 rounded-v-sm border border-v-border px-3 py-2.5 text-left text-sm font-medium text-v-text transition-colors hover:bg-v-fill">
                <o.Icon size={17} className={o.tone} /> {en ? o.en : o.es}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    )
  }
  const emocional = m.type === 'emotional'
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }} className="mb-4 flex items-start gap-2.5">
      <AriaAvatar size={32} />
      <div className="flex max-w-[85%] flex-col gap-2">
        <div className={`rounded-[22px] rounded-tl-md px-4 py-3 shadow-v ${emocional ? 'border border-v-accent/30 bg-v-accent-soft' : 'border border-v-border bg-v-elevated'}`}>
          {emocional && <p className="mb-2 flex items-center gap-1.5 border-b border-v-accent/20 pb-2 text-[11px] font-semibold text-v-accent"><Heart size={11} /> {en ? 'With you in this' : 'Contigo en esto'}</p>}
          {renderMarkdown(m.text)}
        </div>
        {m.producto && (
          <div className="overflow-hidden rounded-v-sm border border-v-border bg-v-elevated shadow-v">
            <div className="flex items-center gap-3 p-3">
              <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-v-sm bg-v-fill text-v-muted">
                {m.producto.imagen_url ? <img src={m.producto.imagen_url} alt="" className="absolute inset-0 size-full object-cover" style={{ height: '100%' }} /> : <ShoppingBag size={20} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-v-warning">{en ? 'Available in the store' : 'Disponible en la tienda'}</p>
                <p className="truncate text-sm font-semibold text-v-text">{m.producto.nombre}</p>
                {(m.producto.razon || m.producto.descripcion) && <p className="line-clamp-2 text-xs text-v-muted">{m.producto.razon || m.producto.descripcion}</p>}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-v-border px-3 py-2">
              <span className="text-sm font-bold tabular-nums text-v-text">S/ {Number(m.producto.precio_soles).toFixed(2)}</span>
              <button onClick={onNavigateToStore} className="v-brand inline-flex h-8 items-center gap-1 rounded-full px-3.5 text-xs font-semibold">{en ? 'View' : 'Ver'} <ArrowRight size={12} /></button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function TypingIndicator() {
  const { locale } = useI18n()
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex items-center gap-2.5">
      <AriaAvatar size={32} pulso />
      <div className="flex items-center gap-1.5 rounded-[22px] rounded-tl-md border border-v-border bg-v-elevated px-4 py-3 shadow-v">
        {[0, 0.15, 0.3].map(d => (
          <motion.span key={d} className="size-1.5 rounded-full bg-v-accent" animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.9, repeat: Infinity, delay: d }} />
        ))}
        <span className="ml-1.5 text-xs text-v-muted">{locale === 'en' ? 'ARIA is thinking…' : 'ARIA está pensando…'}</span>
      </div>
    </motion.div>
  )
}

// ── Bienvenida ────────────────────────────────────────────────────────────────
function WelcomeScreen({ childName, onQuickSend }: { childName: string; onQuickSend: (q: string) => void }) {
  const { name: centroNombre } = useCentroBranding()
  const { locale } = useI18n()
  const en = locale === 'en'
  const nombre = (childName || '').split(' ')[0] || (en ? 'your child' : 'tu peque')
  const quick = [
    { Icon: ClipboardList, titulo: en ? 'Last session' : 'Última sesión', text: en ? 'How did the last session go?' : '¿Cómo le fue en la última sesión?', tone: 'bg-v-accent-soft text-v-accent' },
    { Icon: Home, titulo: en ? 'Tips for home' : 'Consejos para casa', text: en ? 'Give me tips for home' : 'Dame consejos para casa', tone: 'bg-v-success/15 text-v-success' },
    { Icon: Target, titulo: en ? 'Current goals' : 'Objetivos actuales', text: en ? 'What goals is my child working on?' : '¿Qué objetivos está trabajando?', tone: 'bg-v-warning/15 text-v-warning' },
    { Icon: Heart, titulo: en ? 'Emotional support' : 'Apoyo emocional', text: en ? 'I need emotional support' : 'Necesito apoyo emocional', tone: 'bg-v-danger/10 text-v-danger' },
  ]
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} className="relative">
        <span aria-hidden className="absolute inset-x-2 bottom-1 h-4 rounded-full bg-v-accent/20 blur-md" />
        <motion.span animate={{ y: [0, -6, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} className="relative block h-32 w-28">
          <img src="/aria/poses/saluda.webp" alt="" draggable={false} className="absolute inset-0 size-full select-none object-contain" style={{ height: '100%' }} />
        </motion.span>
      </motion.div>
      <motion.h3 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="v-headline mt-2 text-[1.6rem] leading-tight text-v-text">
        {en ? 'Hi, I’m ' : 'Hola, soy '}<span className="v-brand-text">ARIA</span>
      </motion.h3>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.14 }} className="mt-1.5 max-w-md text-sm leading-relaxed text-v-muted">
        {en ? <>The assistant of {centroNombre}. I know <strong className="text-v-text">{nombre}</strong>’s history and can explain sessions, home activities and more.</>
            : <>La asistente de {centroNombre}. Conozco el historial de <strong className="text-v-text">{nombre}</strong> y puedo explicarte sesiones, actividades para casa y mucho más.</>}
      </motion.p>
      <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
        {quick.map(({ Icon, titulo, text, tone }, i) => (
          <motion.button key={text} onClick={() => onQuickSend(text)}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 + i * 0.05, type: 'spring', stiffness: 260, damping: 24 }}
            whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
            className="group flex items-center gap-3 rounded-v border border-v-border bg-v-elevated px-4 py-3 text-left shadow-v transition-colors hover:border-v-accent/40">
            <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] ${tone}`}><Icon size={16} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-v-text">{titulo}</span>
              <span className="block truncate text-xs text-v-muted">{text}</span>
            </span>
            <ArrowRight size={15} className="shrink-0 text-v-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-v-accent" />
          </motion.button>
        ))}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
function ChatInterface({ childId, childName, onNavigateToStore, parentId }: any) {
  const { name: centroNombre } = useCentroBranding()
  const { t, locale } = useI18n()
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [wellbeingShown, setWellbeingShown] = useState(false)
  const [showWelcome, setShowWelcome] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Voz ──
  const { speak, stopSpeaking, speaking, voiceEnabled, toggleVoice } = useTextToSpeech()

  const handleVoiceResult = useCallback((transcript: string) => {
    setInput(transcript)
    // Auto-enviar después de un breve delay para que el usuario vea el texto
    setTimeout(() => {
      sendText(transcript)
    }, 600)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { listening, supported: micSupported, startListening, stopListening } = useSpeechToText(handleVoiceResult)

  // Reset al cambiar de niño
  useEffect(() => {
    setMessages([])
    setShowWelcome(true)
    setWellbeingShown(false)
    stopSpeaking()
  }, [childId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  // Apoyo emocional pedido desde el chequeo de bienestar del Inicio: ARIA abre la conversación
  useEffect(() => {
    if (!childId) return
    let mensaje: string | null = null
    try { mensaje = sessionStorage.getItem('vanty_aria_apoyo'); sessionStorage.removeItem('vanty_aria_apoyo') } catch { /* sin storage */ }
    if (mensaje) setTimeout(() => sendText(mensaje!), 400)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId])

  // ── Guardar respuesta de bienestar ─────────────────────────────────────────
  const handleWellbeingAnswer = useCallback(async (opt: string) => {
    // Se guarda como chequeo de bienestar (no como formulario: antes aparecía en "Formularios completados")
    if (parentId && childId) {
      const l = opt.toLowerCase()
      const mood = /difícil|hard/.test(l) ? 'dificil' : /regular|so-so/.test(l) ? 'regular' : 'bien'
      fetch('/api/parent-wellbeing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: parentId, child_id: childId, mood }),
      }).catch(() => {})
    }
    setMessages(p => [...p,
      { role: 'user', text: opt },
      { role: 'ai', text: locale === 'en' ? 'Thanks for sharing how you feel. Your wellbeing matters a lot for your child’s progress too.' : '¡Gracias por compartir cómo te sientes! Tu bienestar también importa mucho para el progreso de tu hijo/a.' }
    ])
  }, [parentId, childId, locale])

  // Tokens de ARIA de la familia (mensajes por día, según el plan del centro)
  const [tokensAria, setTokensAria] = useState<{ usados: number; max: number | null; extra: number; reinicia: string | null } | null>(null)
  const [comprarAbierto, setComprarAbierto] = useState(false)
  const onComprarTokens = () => setComprarAbierto(true)
  const cargarTokensAria = useCallback(() => {
    fetch('/api/padre/tokens', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => { if (j?.aria) setTokensAria(j.aria) }).catch(() => {})
  }, [])
  useEffect(() => { cargarTokensAria() }, [cargarTokensAria])
  const ariaRestantes = tokensAria?.max != null ? Math.max(0, tokensAria.max - tokensAria.usados) : null
  const ariaExtra = tokensAria?.extra ?? 0
  const ariaAgotado = ariaRestantes === 0 && ariaExtra === 0

  const sendText = async (txt: string) => {
    if (!txt.trim() || typing || ariaAgotado) return

    setShowWelcome(false)
    setInput('')
    stopSpeaking()

    if (!childId) {
      const errMsg = locale === 'en' ? 'Loading the patient profile, try again in a moment.' : 'Cargando el perfil del paciente, intenta de nuevo en un momento.'
      setMessages(p => [...p, { role: 'user', text: txt }, { role: 'ai', text: errMsg }])
      speak(errMsg)
      return
    }

    const isEmotional = detectsEmotion(txt)
    setMessages(p => [...p, { role: 'user', text: txt }])
    setTyping(true)

    let emotionalPrefix = ''
    if (isEmotional) {
      emotionalPrefix = getEmotionalPrefix(txt, centroNombre, locale === 'en')
      await new Promise(r => setTimeout(r, 700))
      const tempMsg = emotionalPrefix + (locale === 'en' ? 'Let me review the clinical history to give you more precise information…' : 'Déjame revisar el historial clínico para darte información más precisa…')
      setMessages(p => [...p, { role: 'ai', text: tempMsg, type: 'emotional' }])
      await new Promise(r => setTimeout(r, 900))
    }

    try {
      const res = await fetch('/api/parent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': locale || 'es' },
        body: JSON.stringify({
          question: isEmotional
            ? `${txt}\n\n[INSTRUCCIÓN: El padre/madre experimenta carga emocional. Valida primero con calidez genuina antes de información clínica.]`
            : txt,
          childId,
          childName,
        }),
      })
      const data = await res.json()
      cargarTokensAria()
      const aiResponse = data.text || (locale === 'en' ? 'Sorry, I could not process your question.' : 'Lo siento, no pude procesar tu pregunta.')
      const productoSugerido = data.producto_sugerido_info || null
      const finalText = isEmotional ? emotionalPrefix + aiResponse : aiResponse

      if (isEmotional) {
        setMessages(p => {
          const copy = [...p]
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].type === 'emotional') {
              copy[i] = { role: 'ai', text: finalText, type: 'emotional', producto: productoSugerido }
              break
            }
          }
          return copy
        })
      } else {
        setMessages(p => [...p, { role: 'ai', text: aiResponse, producto: productoSugerido }])
      }

      // Leer respuesta en voz
      speak(aiResponse)

      // Wellbeing check
      const userCount = messages.filter(m => m.role === 'user').length
      if (userCount >= 2 && !wellbeingShown) {
        setWellbeingShown(true)
        setTimeout(() => {
          setMessages(p => [...p, { role: 'ai', text: '', type: 'wellbeing' }])
        }, 2200)
      }
    } catch {
      const errMsg = locale === 'en' ? 'Connection problem. Please try again.' : 'Problema de conexión. Intenta nuevamente.'
      setMessages(p => [...p, { role: 'ai', text: errMsg }])
      speak(errMsg)
    } finally {
      setTyping(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const send = (customText?: string) => sendText(customText || input)

  const handleReset = () => {
    setMessages([])
    setShowWelcome(true)
    setWellbeingShown(false)
    stopSpeaking()
  }

  const handleMicClick = () => {
    if (listening) {
      stopListening()
    } else {
      stopSpeaking()
      startListening()
    }
  }

  const en = locale === 'en'
  const atajos = [
    { Icon: ClipboardList, label: en ? 'Last session' : 'Última sesión', text: en ? 'How did the last session go?' : '¿Cómo le fue en la última sesión?' },
    { Icon: Home, label: en ? 'Tips for home' : 'Tips para casa', text: en ? 'Give me tips for activities at home' : 'Dame consejos para actividades en casa' },
    { Icon: Target, label: en ? 'Goals' : 'Objetivos', text: en ? 'What goals is my child working on?' : '¿Qué objetivos está trabajando?' },
    { Icon: Heart, label: en ? 'Support' : 'Apoyo', text: en ? 'I need emotional support' : 'Necesito apoyo emocional' },
  ]

  return (
    <div className="v-scope flex min-h-0 flex-1 flex-col overflow-hidden bg-v-elevated" style={{ height: '100%' }}>
      {/* ── Encabezado ── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-v-border px-4 py-3">
        <AriaAvatar size={40} pulso={speaking} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-[15px] font-semibold tracking-tight text-v-text">ARIA</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-v-success/15 px-2 py-0.5 text-[10px] font-semibold text-v-success">
              <span className="size-1.5 animate-pulse rounded-full bg-v-success" /> {en ? 'Online' : 'En línea'}
            </span>
            {speaking && <span className="inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-2 py-0.5 text-[10px] font-semibold text-v-accent"><Volume2 size={10} /> {en ? 'Speaking' : 'Hablando'}</span>}
          </div>
          <p className="truncate text-xs text-v-muted">{childName ? (en ? `Focused on ${childName}` : `Especializada en ${childName}`) : (en ? 'Clinical AI assistant' : 'Asistente clínico IA')}</p>
        </div>
        {ariaRestantes != null && <TokensChip restantes={ariaRestantes} max={tokensAria!.max!} extra={ariaExtra} etiqueta={en ? 'today' : 'hoy'} onComprar={onComprarTokens} />}
        <button onClick={toggleVoice} title={voiceEnabled ? (en ? 'Mute voice' : 'Silenciar voz') : (en ? 'Turn voice on' : 'Activar voz')}
          className={`grid size-9 place-items-center rounded-full transition-colors ${voiceEnabled ? 'bg-v-accent-soft text-v-accent' : 'bg-v-fill text-v-muted'}`}>
          {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <button onClick={handleReset} title={t('aria.nuevaConversacion')}
          className="grid size-9 place-items-center rounded-full bg-v-fill text-v-muted transition-colors hover:text-v-text">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* ── Micrófono activo ── */}
      <AnimatePresence>
        {listening && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="shrink-0 overflow-hidden">
            <div className="mx-4 mt-3 flex items-center gap-3 rounded-v-sm bg-v-danger/10 px-4 py-2.5">
              <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.1, repeat: Infinity }} className="grid size-8 shrink-0 place-items-center rounded-full bg-v-danger text-white"><Mic size={14} /></motion.span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-v-danger">{en ? 'Listening…' : 'Escuchando…'}</p>
                <p className="text-xs text-v-muted">{t('aria.hablaAhora')}</p>
              </div>
              <button onClick={stopListening} className="grid size-8 place-items-center rounded-full bg-v-elevated text-v-danger"><StopCircle size={16} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mensajes ── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-v-bg px-4 pt-4" style={{ scrollbarWidth: 'thin' }}>
        {showWelcome && messages.length === 0 ? (
          <>
            <WelcomeScreen childName={childName} onQuickSend={send} />
            {ariaRestantes != null && ariaRestantes + ariaExtra <= 1 && (
              <div className="mx-auto w-full max-w-2xl px-4 pb-4">
                <AvisoTokensAria restantes={ariaRestantes + ariaExtra} max={tokensAria!.max!} reinicia={tokensAria?.reinicia ?? null} en={en} onComprar={onComprarTokens} />
              </div>
            )}
            <ComprarTokensPadre abierto={comprarAbierto} tipoInicial="aria" onClose={() => { setComprarAbierto(false); cargarTokensAria() }} />
          </>
        ) : (
          <div className="w-full">
            {messages.map((m, i) => <MessageBubble key={i} m={m} onNavigateToStore={onNavigateToStore} onWellbeingAnswer={handleWellbeingAnswer} />)}
            {typing && <TypingIndicator />}
            {/* ARIA avisa cuando se acaban (o casi) los mensajes del día */}
            {!typing && ariaRestantes != null && ariaRestantes + ariaExtra <= 1 && (
              <AvisoTokensAria restantes={ariaRestantes + ariaExtra} max={tokensAria!.max!} reinicia={tokensAria?.reinicia ?? null} en={en} onComprar={onComprarTokens} />
            )}
            <div ref={endRef} />
            <ComprarTokensPadre abierto={comprarAbierto} tipoInicial="aria" onClose={() => { setComprarAbierto(false); cargarTokensAria() }} />
          </div>
        )}
      </div>

      {/* ── Atajos (con conversación) ── */}
      {!showWelcome && messages.length > 0 && !typing && (
        <div className="shrink-0 border-t border-v-border bg-v-elevated px-3">
          <div className="flex gap-1.5 overflow-x-auto py-2" style={{ scrollbarWidth: 'none' }}>
            {atajos.map(({ Icon, label, text }) => (
              <button key={label} onClick={() => send(text)}
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-v-fill px-3 py-1.5 text-xs font-semibold text-v-muted transition-colors hover:bg-v-accent-soft hover:text-v-accent">
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Escribir ── */}
      <div className="shrink-0 border-t border-v-border bg-v-elevated px-3 pb-2 pt-3">
        <div className="w-full">
          <div className={`flex items-center gap-1.5 rounded-full border p-1.5 pl-4 transition-shadow ${listening ? 'border-v-danger/50 bg-v-danger/5' : 'border-v-border bg-v-bg focus-within:border-v-accent/50 focus-within:ring-4 focus-within:ring-v-accent-soft'}`}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder={ariaAgotado ? (en ? 'No ARIA messages left today' : 'Sin mensajes de ARIA por hoy') : listening ? (en ? 'Listening…' : 'Escuchando…') : childName ? (en ? `Ask me about ${childName}…` : `Pregúntame sobre ${childName}…`) : (en ? 'Type your question…' : 'Escribe tu pregunta…')}
              disabled={typing || listening || ariaAgotado}
              className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-v-text outline-none placeholder:text-v-subtle disabled:opacity-60" />
            {micSupported && (
              <motion.button whileTap={{ scale: 0.92 }} onClick={handleMicClick} disabled={typing || ariaAgotado}
                title={listening ? (en ? 'Stop recording' : 'Detener grabación') : (en ? 'Talk to ARIA' : 'Hablar con ARIA')}
                className={`grid size-10 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40 ${listening ? 'bg-v-danger text-white' : 'text-v-muted hover:bg-v-fill hover:text-v-text'}`}>
                {listening ? <MicOff size={17} /> : <Mic size={17} />}
              </motion.button>
            )}
            {speaking ? (
              <motion.button whileTap={{ scale: 0.92 }} onClick={stopSpeaking} title={t('aria.detenerVoz')}
                className="v-brand grid size-10 shrink-0 place-items-center rounded-full"><StopCircle size={17} /></motion.button>
            ) : (
              <motion.button whileTap={{ scale: 0.92 }} onClick={() => send()} disabled={typing || !input.trim() || listening || ariaAgotado}
                className="v-brand grid size-10 shrink-0 place-items-center rounded-full transition-opacity disabled:opacity-35" style={{ boxShadow: 'none' }}>
                <Send size={16} className="translate-x-px" />
              </motion.button>
            )}
          </div>
          <p className="mt-1.5 text-center text-[10px] text-v-subtle">
            {ariaAgotado
              ? (() => { const h = tokensAria?.reinicia ? new Date(tokensAria.reinicia).toLocaleTimeString(en ? 'en-US' : 'es-PE', { hour: '2-digit', minute: '2-digit' }) : null
                  return h ? (en ? `You used your ${tokensAria?.max} messages for today · Available again at ${h}` : `Usaste tus ${tokensAria?.max} mensajes de hoy · Vuelven a las ${h}`) : (en ? 'You used your messages for today' : 'Usaste tus mensajes de hoy') })()
              : listening ? (en ? 'Recording — speak close to the microphone' : 'Grabando — habla cerca del micrófono') : (en ? 'ARIA can make mistakes · Check with your therapist' : 'ARIA puede cometer errores · Consulta con tu terapeuta')}
          </p>
        </div>
      </div>
    </div>
  )
}

export default ChatInterface

// Mensaje de ARIA sobre los tokens del día (se muestra como una burbuja suya)
function AvisoTokensAria({ restantes, max, reinicia, en, onComprar }: { restantes: number; max: number; reinicia: string | null; en: boolean; onComprar?: () => void }) {
  const hora = reinicia ? new Date(reinicia).toLocaleTimeString(en ? 'en-US' : 'es-PE', { hour: '2-digit', minute: '2-digit' }).replace(/\.$/, '') : null
  const agotado = restantes === 0
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2.5">
      <AriaAvatar size={32} />
      <div className={`max-w-[85%] rounded-v rounded-tl-md border p-3.5 text-sm leading-relaxed text-v-text ${agotado ? 'border-v-warning/40 bg-v-warning/10' : 'border-v-border bg-v-bg'}`}>
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-v-warning"><Coins size={13} /> {en ? 'Your ARIA tokens' : 'Tus tokens de ARIA'}</p>
        {agotado
          ? <p>{en
              ? `You've used your ${max} messages for today, so I can't answer more questions right now.${hora ? ` Your tokens come back at ${hora}.` : ''} If it's urgent, please contact the center directly.`
              : `Usaste tus ${max} mensajes de hoy, así que por ahora no puedo responder más preguntas.${hora ? ` Tus tokens vuelven a las ${hora}.` : ''} Si es urgente, comunícate directamente con el centro.`}</p>
          : <p>{en ? 'You have 1 message left today. Make it count!' : 'Te queda 1 mensaje hoy. ¡Aprovéchalo!'}</p>}
        {agotado && onComprar && (
          <button onClick={onComprar} className="v-brand mt-3 inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold">
            <Coins size={13} /> {en ? 'Get more tokens' : 'Conseguir más tokens'}
          </button>
        )}
      </div>
    </motion.div>
  )
}
