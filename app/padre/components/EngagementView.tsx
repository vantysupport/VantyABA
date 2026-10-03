'use client'
// Practicar en casa — plan semanal de actividades.
// Todo lo visual de las actividades sale sin IA: la ilustración es una pose de ARIA según el área,
// el video es un enlace de búsqueda en YouTube armado con el título y el temporizador es local.

import { useI18n } from '@/lib/i18n-context'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { TokensChip } from '@/components/ui/tokens-chip'
import ComprarTokensPadre from '@/components/ComprarTokensPadre'
import { supabase } from '@/lib/supabase'
import {
  Brain, CheckCircle2, Circle, Clock, Sparkles, Target, Loader2, RefreshCw, TrendingUp, Trophy,
  Zap, Star, MessageCircle, Users, ClipboardList, Play, Pause, RotateCcw, X,
  CirclePlay, Package, CalendarDays, ChevronRight, Check, Maximize2, Coins,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useToast } from '@/components/Toast'
import { confirmar } from '@/components/ui/confirmar'

interface Actividad {
  titulo: string; descripcion: string; duracion_minutos: number
  dificultad: 'facil' | 'media' | 'alta'; area: string
  materiales_necesarios: string[]; por_que_importa: string
  dias_recomendados: string[]; completada?: boolean; video_url?: string
}
interface Plan {
  id?: string; semana: string; mensaje_motivacional: string
  actividades: Actividad[]; child_name: string; completadas_pct?: number
}

const cardClass = 'rounded-v border border-v-border bg-v-elevated shadow-v'

// Un ícono, un tono y una pose de ARIA por área
const AREA: Record<string, { es: string; en: string; Icon: any; tone: string; fondo: string; pose: number }> = {
  comunicacion:  { es: 'Comunicación', en: 'Communication', Icon: MessageCircle, tone: 'bg-v-accent-soft text-v-accent',   fondo: 'from-sky-100 to-cyan-50 dark:from-sky-950/60 dark:to-cyan-950/30',        pose: 4 },
  conducta:      { es: 'Conducta',     en: 'Behavior',      Icon: Zap,           tone: 'bg-v-warning/15 text-v-warning',   fondo: 'from-amber-100 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/30', pose: 3 },
  habilidades:   { es: 'Habilidades',  en: 'Skills',        Icon: Brain,         tone: 'bg-v-accent-soft text-v-accent',   fondo: 'from-indigo-100 to-sky-50 dark:from-indigo-950/50 dark:to-sky-950/30',    pose: 8 },
  socializacion: { es: 'Socialización', en: 'Social',       Icon: Users,         tone: 'bg-v-success/15 text-v-success',   fondo: 'from-emerald-100 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/30', pose: 2 },
  autonomia:     { es: 'Autonomía',    en: 'Independence',  Icon: Star,          tone: 'bg-v-warning/15 text-v-warning',   fondo: 'from-yellow-100 to-amber-50 dark:from-yellow-950/40 dark:to-amber-950/30', pose: 7 },
}
const AREA_DEF = { es: 'Actividad', en: 'Activity', Icon: Target, tone: 'bg-v-fill text-v-muted', fondo: 'from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800/40', pose: 1 }
const areaDe = (a: string) => AREA[(a || '').toLowerCase()] || AREA_DEF

const DIFICULTAD: Record<string, { es: string; en: string; tone: string }> = {
  facil: { es: 'Fácil', en: 'Easy', tone: 'bg-v-success/15 text-v-success' },
  media: { es: 'Media', en: 'Medium', tone: 'bg-v-warning/15 text-v-warning' },
  alta:  { es: 'Difícil', en: 'Hard', tone: 'bg-v-danger/10 text-v-danger' },
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const DIAS_ES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const DIAS_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const esParaHoy = (dias: string[] = []) => {
  const d = new Date().getDay()
  return dias.some(x => { const n = sinTildes(x); return n === DIAS_ES[d] || n === DIAS_EN[d] || n.slice(0, 3) === DIAS_ES[d].slice(0, 3) })
}
const urlVideo = (act: Actividad, en: boolean) => act.video_url ||
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${act.titulo} ${en ? 'activity for kids at home' : 'actividad para niños en casa'}`)}`

function lsKey(childId: string, planId: string | null) {
  return `engagement_done_${childId}_${planId || 'current'}`
}

function Ilustracion({ area, className = '', done = false, miniatura }: { area: string; className?: string; done?: boolean; miniatura?: string | null }) {
  const a = areaDe(area)
  const [cargada, setCargada] = useState(false)
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${a.fondo} ${className}`}>
      <span className="absolute -right-6 -top-6 size-24 rounded-full bg-white/40 dark:bg-white/5" />
      <span className="absolute -bottom-8 left-4 size-20 rounded-full bg-white/30 dark:bg-white/5" />
      {/* Miniatura del video de ejemplo de fondo (aparece suave cuando termina de cargar) */}
      {miniatura && (
        <>
          <img src={miniatura} alt="" draggable={false} onLoad={() => setCargada(true)}
            className={`absolute inset-0 size-full select-none object-cover transition-all duration-700 ${cargada ? 'opacity-100' : 'opacity-0'} ${done ? 'grayscale' : ''}`}
            style={{ height: '100%' }} />
          <span className={`absolute inset-0 bg-gradient-to-r from-black/45 via-black/15 to-transparent transition-opacity duration-700 ${cargada ? 'opacity-100' : 'opacity-0'}`} />
          <span className={`absolute left-1/2 top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-all duration-700 ${cargada ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}>
            <Play size={16} className="ml-0.5" fill="currentColor" />
          </span>
        </>
      )}
      <img src={`/aria/pose-${a.pose}.webp?v=2`} alt="" draggable={false}
        className={`absolute bottom-0 right-2 w-auto select-none object-contain transition-all duration-300 ${done ? 'opacity-50 grayscale' : ''}`}
        style={{ height: miniatura ? '78%' : '88%', maxWidth: 'none', filter: miniatura ? 'drop-shadow(0 6px 14px rgba(0,0,0,.35))' : undefined }} />
    </div>
  )
}

// ─── Videos dentro de la app ───────────────────────────────────────────────────
type VideoYT = { id: string; titulo: string; canal: string; miniatura: string }
const idYouTube = (url?: string) => url?.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1] || null
const busquedaVideo = (act: Actividad, en: boolean) => `${act.titulo} ${en ? 'activity for kids at home' : 'actividad para niños en casa'}`

function VideosActividad({ act, autoAbrir }: { act: Actividad; autoAbrir: boolean }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const propio = idYouTube(act.video_url)
  const [estado, setEstado] = useState<'cerrado' | 'cargando' | 'listo' | 'sin'>('cerrado')
  const [videos, setVideos] = useState<VideoYT[]>([])
  const [actual, setActual] = useState<string | null>(null)
  const [grande, setGrande] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const abrir = async () => {
    if (propio) {
      setVideos([{ id: propio, titulo: L('Therapist video', 'Video del terapeuta'), canal: '', miniatura: `https://i.ytimg.com/vi/${propio}/mqdefault.jpg` }])
      setActual(propio); setEstado('listo'); return
    }
    setEstado('cargando')
    try {
      const r = await fetch(`/api/videos-actividad?q=${encodeURIComponent(busquedaVideo(act, en))}&lang=${en ? 'en' : 'es'}`)
      const j = await r.json()
      if (j.disponible && j.videos?.length) { setVideos(j.videos); setActual(j.videos[0].id); setEstado('listo') }
      else setEstado('sin')
    } catch { setEstado('sin') }
  }
  useEffect(() => {
    if (!autoAbrir) return
    abrir()
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAbrir])

  if (estado === 'cerrado') return (
    <button onClick={abrir} className="flex w-full items-center gap-3 rounded-v-sm border border-v-border px-3.5 py-3 text-left text-sm font-semibold text-v-text transition-colors hover:bg-v-fill">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-v-danger/10 text-v-danger"><CirclePlay size={18} /></span>
      <span className="min-w-0 flex-1">
        {propio ? L('Watch the therapist video', 'Ver el video del terapeuta') : L('See video examples', 'Ver ejemplos en video')}
        <span className="block text-xs font-normal text-v-muted">{L('Plays right here', 'Se reproduce aquí mismo')}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-v-subtle" />
    </button>
  )

  return (
    <div ref={ref} className="scroll-mt-4 space-y-2.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-v-subtle"><CirclePlay size={12} /> {L('Video examples', 'Ejemplos en video')}</p>
      {estado === 'cargando' && <div className="grid aspect-video w-full place-items-center rounded-v-sm bg-v-fill"><Loader2 size={22} className="animate-spin text-v-accent" /></div>}
      {estado === 'sin' && (
        <a href={urlVideo(act, en)} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-v-sm bg-v-fill px-3.5 py-3 text-sm text-v-text transition-colors hover:bg-v-accent-soft">
          <CirclePlay size={18} className="shrink-0 text-v-danger" />
          <span className="min-w-0 flex-1">{L('Open the examples on YouTube', 'Abrir los ejemplos en YouTube')}<span className="block text-xs text-v-muted">{L('They could not be loaded here right now', 'Ahora no se pudieron cargar aquí')}</span></span>
          <ChevronRight size={16} className="shrink-0 text-v-subtle" />
        </a>
      )}
      {estado === 'listo' && actual && (
        <>
          <div className="relative aspect-video w-full overflow-hidden rounded-v-sm bg-black">
            {grande
              ? <button onClick={() => setGrande(false)} className="absolute inset-0 grid place-items-center text-sm font-semibold text-white/80">{L('Playing in large view', 'Reproduciendo en grande')}</button>
              : <iframe key={actual} src={`https://www.youtube-nocookie.com/embed/${actual}?rel=0&playsinline=1&modestbranding=1`}
                  title={videos.find(v => v.id === actual)?.titulo || 'Video'} className="absolute inset-0 size-full" style={{ height: '100%' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />}
          </div>
          <button onClick={() => setGrande(true)}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-v-fill text-xs font-semibold text-v-text transition-colors hover:bg-v-accent-soft hover:text-v-accent">
            <Maximize2 size={13} /> {L('Watch in large view', 'Ver en grande')}
          </button>
          {/* Vista grande: se dibuja sobre toda la pantalla (fuera del modal, que tiene transformaciones) */}
          {grande && typeof document !== 'undefined' && createPortal(
            <div className="v-scope fixed inset-0 z-[400] flex flex-col items-center justify-center bg-black/90 p-3 backdrop-blur-sm sm:p-8" onClick={() => setGrande(false)}>
              <div className="relative w-full max-w-6xl" onClick={e => e.stopPropagation()}>
                <div className="mb-3 flex items-center gap-3">
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{videos.find(v => v.id === actual)?.titulo}</p>
                  <button onClick={() => setGrande(false)} aria-label={L('Close', 'Cerrar')}
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"><X size={18} /></button>
                </div>
                <div className="relative aspect-video w-full overflow-hidden rounded-v bg-black shadow-2xl" style={{ maxHeight: '80vh' }}>
                  <iframe src={`https://www.youtube-nocookie.com/embed/${actual}?rel=0&playsinline=1&modestbranding=1&autoplay=1`}
                    title={videos.find(v => v.id === actual)?.titulo || 'Video'} className="absolute inset-0 size-full" style={{ height: '100%' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
                </div>
              </div>
            </div>,
            document.body,
          )}
          {videos.length > 1 && (
            <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
              {videos.filter(v => v.id !== actual).slice(0, 3).map(v => (
                <button key={v.id} onClick={() => setActual(v.id)} className="group text-left">
                  <span className="relative block aspect-video overflow-hidden rounded-md bg-v-fill">
                    <img src={v.miniatura} alt="" className="absolute inset-0 size-full object-cover transition-transform group-hover:scale-105" style={{ height: '100%' }} />
                    <span className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100"><Play size={16} className="text-white" /></span>
                  </span>
                  <span className="mt-1 line-clamp-2 block text-[11px] leading-snug text-v-muted">{v.titulo}</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-v-subtle">{L('YouTube videos chosen automatically. Always check they fit your child.', 'Videos de YouTube elegidos automáticamente. Revisa siempre que se ajusten a tu peque.')}</p>
        </>
      )}
    </div>
  )
}

// ─── Modo "Hacer ahora": paso a paso con materiales, temporizador y cierre ──────
function HacerAhora({ act, done, conVideo = false, miniatura, onTerminar, onCerrar }: { act: Actividad; done: boolean; conVideo?: boolean; miniatura?: string; onTerminar: () => void; onCerrar: () => void }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const total = Math.max(1, act.duracion_minutos || 15) * 60
  const [restante, setRestante] = useState(total)
  const [corriendo, setCorriendo] = useState(false)
  const [listos, setListos] = useState<Set<number>>(new Set())
  const [fin, setFin] = useState(false)
  const a = areaDe(act.area)

  useEffect(() => {
    if (!corriendo) return
    const t = setInterval(() => setRestante(r => {
      if (r <= 1) { setCorriendo(false); return 0 }
      return r - 1
    }), 1000)
    return () => clearInterval(t)
  }, [corriendo])

  const mm = String(Math.floor(restante / 60)).padStart(2, '0')
  const ss = String(restante % 60).padStart(2, '0')
  const pct = 1 - restante / total
  const r = 52, circ = 2 * Math.PI * r

  return (
    <motion.div className="v-scope fixed inset-0 z-[150] flex items-end justify-center bg-[#081426]/55 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCerrar}>
      <motion.div onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-v-lg border border-v-border bg-v-elevated shadow-v-lg sm:rounded-v-lg">
        <div className="relative shrink-0">
          <Ilustracion area={act.area} miniatura={miniatura} className="h-36" />
          {miniatura && <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />}
          <button onClick={onCerrar} aria-label={L('Close', 'Cerrar')} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-v-elevated/90 text-v-muted shadow-v"><X size={17} /></button>
          <div className="absolute bottom-3 left-4 right-28">
            <span className="inline-flex items-center gap-1 rounded-full bg-v-elevated/95 px-2.5 py-0.5 text-[11px] font-semibold text-v-text shadow-v"><span className={`grid size-4 place-items-center rounded-full ${a.tone}`}><a.Icon size={9} /></span> {en ? a.en : a.es}</span>
            <p className={`mt-1 text-lg font-semibold leading-tight ${miniatura ? 'text-white' : 'text-v-text'}`} style={miniatura ? { textShadow: '0 1px 8px rgba(0,0,0,.5)' } : undefined}>{act.titulo}</p>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {fin ? (
            <motion.div key="fin" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-8 text-center">
              <motion.span initial={{ rotate: -15, scale: 0.5 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 12 }}
                className="mx-auto grid size-20 place-items-center rounded-full bg-v-success/15 text-v-success"><Trophy size={38} /></motion.span>
              <p className="v-headline mt-4 text-2xl text-v-text">{L('Great job!', '¡Muy bien hecho!')}</p>
              <p className="mt-2 text-sm text-v-muted">{L('Activity marked as done. Every practice at home counts.', 'Actividad marcada como hecha. Cada práctica en casa suma.')}</p>
              <button onClick={onCerrar} className="v-brand mx-auto mt-6 inline-flex h-11 items-center rounded-full px-6 text-sm font-semibold">{L('Back to the plan', 'Volver al plan')}</button>
            </motion.div>
          ) : (
            <motion.div key="pasos" className="flex-1 space-y-5 overflow-y-auto p-5" style={{ scrollbarWidth: 'thin' }}>
              {/* Temporizador */}
              <div className="flex items-center gap-5 rounded-v-sm bg-v-fill p-4">
                <div className="relative size-[120px] shrink-0">
                  <svg viewBox="0 0 120 120" className="size-full -rotate-90">
                    <circle cx="60" cy="60" r={r} fill="none" stroke="var(--v-border)" strokeWidth="8" />
                    <motion.circle cx="60" cy="60" r={r} fill="none" stroke="var(--v-accent)" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={circ} animate={{ strokeDashoffset: circ * (1 - pct) }} transition={{ ease: 'linear', duration: 0.9 }} />
                  </svg>
                  <span className="absolute inset-0 grid place-items-center text-2xl font-bold tabular-nums text-v-text">{mm}:{ss}</span>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-semibold text-v-text">{restante === 0 ? L('Time is up!', '¡Tiempo cumplido!') : L(`${act.duracion_minutos} minute timer`, `Temporizador de ${act.duracion_minutos} min`)}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setCorriendo(c => !c)} disabled={restante === 0}
                      className="v-brand inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold disabled:opacity-50">
                      {corriendo ? <><Pause size={15} /> {L('Pause', 'Pausar')}</> : <><Play size={15} /> {restante < total ? L('Resume', 'Seguir') : L('Start', 'Empezar')}</>}
                    </button>
                    <button onClick={() => { setCorriendo(false); setRestante(total) }} aria-label={L('Restart', 'Reiniciar')}
                      className="grid size-10 shrink-0 place-items-center rounded-full bg-v-elevated text-v-muted transition-colors hover:text-v-text"><RotateCcw size={15} /></button>
                  </div>
                </div>
              </div>

              {/* Cómo hacerlo */}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-v-subtle">{L('How to do it', 'Cómo hacerlo')}</p>
                <p className="text-sm leading-relaxed text-v-text">{act.descripcion}</p>
              </div>

              {/* Materiales */}
              {act.materiales_necesarios?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-v-subtle">{L('Get ready', 'Prepara')}</p>
                  <div className="space-y-1.5">
                    {act.materiales_necesarios.map((m, j) => {
                      const ok = listos.has(j)
                      return (
                        <button key={j} onClick={() => setListos(s => { const n = new Set(s); n.has(j) ? n.delete(j) : n.add(j); return n })}
                          className={`flex w-full items-center gap-3 rounded-v-sm border px-3.5 py-2.5 text-left text-sm transition-colors ${ok ? 'border-transparent bg-v-success/10 text-v-success' : 'border-v-border text-v-text hover:bg-v-fill'}`}>
                          <span className={`grid size-5 shrink-0 place-items-center rounded-md border-2 ${ok ? 'border-v-success bg-v-success text-white' : 'border-v-border'}`}>{ok && <Check size={12} strokeWidth={3} />}</span>
                          <span className={ok ? 'line-through decoration-v-success/40' : ''}>{m}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Por qué */}
              {act.por_que_importa && (
                <div className="rounded-v-sm bg-v-accent-soft/60 p-3.5">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-v-accent"><Target size={12} /> {L('Why it matters', 'Por qué importa')}</p>
                  <p className="text-sm leading-relaxed text-v-muted">{act.por_que_importa}</p>
                </div>
              )}

              <VideosActividad act={act} autoAbrir={conVideo} />
            </motion.div>
          )}
        </AnimatePresence>

        {!fin && (
          <div className="shrink-0 border-t border-v-border p-4">
            <button onClick={() => { if (!done) onTerminar(); setCorriendo(false); setFin(true) }}
              className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold ${done ? 'bg-v-fill text-v-muted' : 'v-brand'}`}>
              <CheckCircle2 size={17} /> {done ? L('Already done — close', 'Ya estaba hecha — cerrar') : L('We finished!', '¡Terminamos!')}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

export default function EngagementView({ childId, childName }: { childId: string; childName?: string }) {
  const { t, locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const toast = useToast()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [planId, setPlanId] = useState<string | null>(null)
  const [historial, setHistorial] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generando, setGenerando] = useState(false)
  // Tokens de la familia para generar planes (por mes, según el plan del centro)
  const [tokens, setTokens] = useState<{ usados: number; max: number | null; extra: number } | null>(null)
  const [comprarAbierto, setComprarAbierto] = useState(false)
  const cargarTokens = () => {
    fetch('/api/padre/tokens', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => { if (j?.practica) setTokens(j.practica) }).catch(() => {})
  }
  useEffect(() => { cargarTokens() }, [])
  const restantes = tokens?.max != null ? Math.max(0, tokens.max - tokens.usados) : null
  const extra = tokens?.extra ?? 0
  const sinTokens = restantes === 0 && extra === 0
  const [completadas, setCompletadas] = useState<Set<number>>(new Set())
  const [filtro, setFiltro] = useState<'todas' | 'hoy' | 'pendientes'>('todas')
  const [activa, setActiva] = useState<number | null>(null)
  const [conVideo, setConVideo] = useState(false)
  // Miniatura del primer video de ejemplo de cada actividad (búsqueda cacheada en el servidor)
  const [miniaturas, setMiniaturas] = useState<Record<number, string>>({})
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveLocal = (cId: string, pId: string | null, done: Set<number>) => {
    try { localStorage.setItem(lsKey(cId, pId), JSON.stringify([...done])) } catch { /* sin storage */ }
  }
  const loadLocal = (cId: string, pId: string | null): Set<number> => {
    try { const raw = localStorage.getItem(lsKey(cId, pId)); if (raw) return new Set(JSON.parse(raw) as number[]) } catch { /* */ }
    return new Set()
  }
  const loc = () => (en ? 'en' : 'es') // el plan se pide y se genera en el idioma activo

  const cargar = async () => {
    setLoading(true)
    setPlan(null); setPlanId(null); setCompletadas(new Set())
    try {
      const r = await fetch(`/api/engagement-padres?child_id=${childId}&locale=${loc()}`, { cache: 'no-store' })
      const j = await r.json()
      if (j.plan) {
        const planData = j.plan
        const pId = planData.id || planData.plan_id || planData._id || null
        setPlan(planData); setPlanId(pId)
        const fromServer = new Set<number>()
        planData.actividades?.forEach((a: Actividad, i: number) => { if (a.completada) fromServer.add(i) })
        const fromLocal = loadLocal(childId, pId)
        const merged = new Set<number>([...fromServer, ...fromLocal])
        setCompletadas(merged)
        if (fromLocal.size > fromServer.size && pId) {
          fetch('/api/engagement-padres', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-locale': loc() },
            body: JSON.stringify({
              childId, accion: 'actualizar_completadas', hoy: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10), planId: pId,
              actividades: planData.actividades.map((a: Actividad, i: number) => ({ ...a, completada: merged.has(i) })),
              completadas_pct: Math.round(merged.size / (planData.actividades.length || 1) * 100),
            }),
          }).catch(() => {})
        }
      }
      setHistorial(j.historial || [])
    } catch (e) { console.warn('Error cargando plan:', e) }
    setLoading(false)
  }

  const generar = async () => {
    if (sinTokens) { setComprarAbierto(true); return }
    if (plan && completadas.size > 0 && !(await confirmar(L('A new plan replaces this week’s activities. Continue?', 'Un plan nuevo reemplaza las actividades de esta semana. ¿Continuar?'), { peligro: false }))) return
    setGenerando(true)
    try {
      const r = await fetch('/api/engagement-padres', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-locale': loc() },
        body: JSON.stringify({ childId, accion: 'generar_plan', locale: loc() }),
      })
      const j = await r.json()
      if (j.error || !j.plan?.id) throw new Error(j.error || L('The plan could not be saved. Try again.', 'El plan no se pudo guardar. Intenta de nuevo.'))
      setPlan(j.plan); setPlanId(j.plan.id); setCompletadas(new Set()); setFiltro('todas')
    } catch (e: any) { toast.error(e.message) }
    cargarTokens()
    setGenerando(false)
  }

  const toggle = (idx: number) => {
    if (!plan) return
    const next = new Set<number>(completadas)
    const marcando = !next.has(idx)
    marcando ? next.add(idx) : next.delete(idx)
    setCompletadas(next)
    const updatedPlan = { ...plan, actividades: plan.actividades.map((a, i) => ({ ...a, completada: next.has(i) })) }
    setPlan(updatedPlan)
    const currentPlanId = planId || plan.id || (plan as any).plan_id || null
    saveLocal(childId, currentPlanId, next)
    const completadas_pct = Math.round(next.size / (plan.actividades.length || 1) * 100)
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/engagement-padres', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-locale': loc() },
          body: JSON.stringify({ childId, accion: 'actualizar_completadas', hoy: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10), planId: currentPlanId, actividades: updatedPlan.actividades, completadas_pct }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } catch {
        if (currentPlanId) {
          try {
            // Respaldo mínimo: solo el porcentaje (el texto puede estar traducido y no debe pisar el original)
            await supabase.from('engagement_planes').update({ completadas_pct }).eq('id', currentPlanId)
          } catch { /* se reintenta al volver a cargar (queda en el equipo) */ }
        }
      }
    }, 300)
    if (marcando && next.size === plan.actividades.length) toast.success(L('Week completed! Great job.', '¡Semana completada! Excelente trabajo.'))
  }

  useEffect(() => { if (childId) cargar() }, [childId, en])

  useEffect(() => {
    setMiniaturas({})
    if (!plan?.actividades?.length) return
    let vivo = true
    plan.actividades.forEach((act, i) => {
      const propio = idYouTube(act.video_url)
      if (propio) { setMiniaturas(m => ({ ...m, [i]: `https://i.ytimg.com/vi/${propio}/hqdefault.jpg` })); return }
      fetch(`/api/videos-actividad?q=${encodeURIComponent(busquedaVideo(act, en))}&lang=${en ? 'en' : 'es'}`)
        .then(r => r.json())
        .then(j => { const id = j.videos?.[0]?.id; if (vivo && id) setMiniaturas(m => ({ ...m, [i]: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` })) })
        .catch(() => { /* sin miniatura: queda la ilustración */ })
    })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, plan?.semana, en])

  const all = plan?.actividades?.length || 0
  const pct = plan ? Math.round(completadas.size / (all || 1) * 100) : 0
  const paraHoy = (plan?.actividades || []).map((a, i) => ({ a, i })).filter(({ a }) => esParaHoy(a.dias_recomendados))
  const visibles = (plan?.actividades || []).map((a, i) => ({ a, i })).filter(({ a, i }) =>
    filtro === 'todas' ? true : filtro === 'hoy' ? esParaHoy(a.dias_recomendados) : !completadas.has(i))
  const r = 30, circ = 2 * Math.PI * r

  return (
    <div className="v-scope space-y-4 pb-8 md:space-y-5">
      <ComprarTokensPadre abierto={comprarAbierto} tipoInicial="practica" onClose={() => { setComprarAbierto(false); cargarTokens() }} />
      {(loading ? (
        <div className="grid place-items-center py-20"><Loader2 size={28} className="animate-spin text-v-accent" /></div>
      ) : (
        <>
          {/* ── Encabezado con progreso ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }}
            className={`relative overflow-hidden ${cardClass}`}>
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(40rem 14rem at 0% 0%, var(--v-glow-1), transparent 70%)' }} />
            <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
            <div className="relative flex items-center gap-5 p-5 sm:p-6">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-v-muted">{L('Practice at home', 'Practicar en casa')}{plan?.semana ? ` · ${/^\d+$/.test(String(plan.semana)) ? `${L('Week', 'Semana')} ${plan.semana}` : plan.semana}` : ''}</p>
                <h2 className="v-headline mt-1 text-[1.5rem] leading-tight text-v-text sm:text-[1.8rem]">
                  {L('Plan for ', 'Plan de ')}<span className="v-brand-text">{(childName || plan?.child_name || '').split(' ')[0] || L('your child', 'tu hijo/a')}</span>
                </h2>
                {plan?.mensaje_motivacional && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-v-muted">{plan.mensaje_motivacional}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {paraHoy.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-v-accent-soft px-3 py-1 text-xs font-semibold text-v-accent">
                      <CalendarDays size={12} /> {paraHoy.length} {L(paraHoy.length === 1 ? 'for today' : 'for today', paraHoy.length === 1 ? 'para hoy' : 'para hoy')}
                    </span>
                  )}
                  <button onClick={generar} disabled={generando} title={sinTokens ? L('No practice tokens left: get more', 'Sin tokens de práctica: consigue más') : undefined}
                    className="inline-flex items-center gap-1.5 rounded-full bg-v-fill px-3 py-1 text-xs font-semibold text-v-muted transition-colors hover:bg-v-accent-soft hover:text-v-accent disabled:cursor-not-allowed disabled:opacity-60">
                    {generando ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} {generando ? L('Generating…', 'Generando…') : L('New plan', 'Nuevo plan')}
                  </button>
                  {restantes != null && <TokensChip restantes={restantes} max={tokens!.max!} extra={extra} etiqueta={L('this month', 'este mes')} onComprar={() => setComprarAbierto(true)} />}
                </div>
              </div>
              {plan && (
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <div className="relative size-[76px]">
                    <svg viewBox="0 0 76 76" className="size-full -rotate-90">
                      <defs><linearGradient id="practica-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="var(--v-brand-from)" /><stop offset="100%" stopColor="var(--v-brand-to)" /></linearGradient></defs>
                      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--v-fill)" strokeWidth="6" />
                      <motion.circle cx="38" cy="38" r={r} fill="none" stroke={pct === 100 ? 'var(--v-success)' : 'url(#practica-ring)'} strokeWidth="6" strokeLinecap="round"
                        strokeDasharray={circ} initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ * (1 - pct / 100) }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
                    </svg>
                    <span className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums text-v-text">
                      {pct === 100 ? <Trophy size={20} className="text-v-success" /> : `${completadas.size}/${all}`}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-v-subtle">{L('this week', 'esta semana')}</p>
                </div>
              )}
            </div>
          </motion.div>

          {!plan ? (
            <div className={`${cardClass} overflow-hidden`}>
              <Ilustracion area="" className="h-40" />
              <div className="p-6 text-center">
                <p className="text-base font-semibold text-v-text">{t('ui.no_plan')}</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-v-muted">{t('familias.iaGeneraraTer')}</p>
                <button onClick={generar} disabled={generando} className="v-brand mx-auto mt-5 inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60">
                  {generando ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {generando ? L('Generating…', 'Generando…') : L('Create this week’s plan', 'Crear el plan de la semana')}
                </button>
                {restantes != null && (
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-v-muted">
                    <Coins size={13} className={sinTokens ? 'text-v-danger' : 'text-v-warning'} />
                    {sinTokens
                      ? <>{L('No practice plans left this month. New ones arrive on the 1st', 'No te quedan planes este mes. Tendrás nuevos el día 1')}<span data-compra>{L(', or ', ', o ')}<button onClick={() => setComprarAbierto(true)} className="font-semibold text-v-accent hover:underline">{L('get more tokens', 'consigue más tokens')}</button></span>.</>
                      : L(`Uses 1 token · ${restantes + extra} available`, `Usa 1 token · tienes ${restantes + extra} disponibles`)}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* ── Filtros ── */}
              <div className="flex flex-wrap items-center gap-2">
                {([
                  { id: 'todas' as const, label: L('All', 'Todas'), n: all },
                  { id: 'hoy' as const, label: L('For today', 'Para hoy'), n: paraHoy.length },
                  { id: 'pendientes' as const, label: L('Pending', 'Pendientes'), n: all - completadas.size },
                ]).map(f => {
                  const on = filtro === f.id
                  return (
                    <button key={f.id} onClick={() => setFiltro(f.id)}
                      className={`relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${on ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
                      {on && <motion.span layoutId="practicar-filtro" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-full bg-v-accent-soft" />}
                      <span className="relative">{f.label}</span>
                      <span className="relative rounded-full bg-v-elevated px-1.5 text-[10px] tabular-nums">{f.n}</span>
                    </button>
                  )
                })}
                <p className="ml-auto hidden text-[11px] text-v-subtle sm:block">{t('familias.planDisenadoIA')}</p>
              </div>

              {/* ── Actividades ── */}
              {visibles.length === 0 ? (
                <div className={`${cardClass} px-6 py-10 text-center`}>
                  <span className="mx-auto grid size-12 place-items-center rounded-full bg-v-success/15 text-v-success"><CheckCircle2 size={22} /></span>
                  <p className="mt-3 text-sm font-semibold text-v-text">{filtro === 'hoy' ? L('Nothing scheduled for today', 'Nada programado para hoy') : L('All done!', '¡Todo hecho!')}</p>
                  <p className="mt-1 text-xs text-v-muted">{filtro === 'hoy' ? L('You can do any activity from “All”.', 'Puedes hacer cualquier actividad desde “Todas”.') : L('You completed every activity this week.', 'Completaste todas las actividades de la semana.')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visibles.map(({ a: act, i }, k) => {
                    const done = completadas.has(i)
                    const ar = areaDe(act.area)
                    const dif = DIFICULTAD[act.dificultad]
                    const hoy = esParaHoy(act.dias_recomendados)
                    return (
                      <motion.article key={i} layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.04 * k, type: 'spring', stiffness: 220, damping: 24 }}
                        className={`group flex flex-col overflow-hidden rounded-v border bg-v-elevated shadow-v transition-colors ${done ? 'border-v-success/40' : 'border-v-border hover:border-v-accent/40'}`}>
                        <button onClick={() => setActiva(i)} className="relative block text-left">
                          <Ilustracion area={act.area} done={done} miniatura={miniaturas[i]} className="h-32 transition-transform duration-500 group-hover:scale-[1.03]" />
                          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-v-elevated/95 px-2.5 py-0.5 text-[11px] font-semibold text-v-text shadow-v backdrop-blur"><span className={`grid size-4 place-items-center rounded-full ${ar.tone}`}><ar.Icon size={9} /></span> {en ? ar.en : ar.es}</span>
                          {hoy && !done && <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-v-elevated/95 px-2.5 py-0.5 text-[11px] font-semibold text-v-accent shadow-v"><CalendarDays size={11} /> {L('Today', 'Hoy')}</span>}
                          {done && <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-v-success px-2.5 py-0.5 text-[11px] font-semibold text-white"><Check size={11} strokeWidth={3} /> {L('Done', 'Hecha')}</span>}
                        </button>
                        <div className="flex flex-1 flex-col p-4">
                          <p className={`text-[15px] font-semibold leading-snug tracking-tight ${done ? 'text-v-muted line-through decoration-v-success/40' : 'text-v-text'}`}>{act.titulo}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-v-muted">{act.descripcion}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-v-fill px-2 py-0.5 text-[11px] font-medium text-v-muted"><Clock size={11} /> {act.duracion_minutos} min</span>
                            {dif && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${dif.tone}`}>{en ? dif.en : dif.es}</span>}
                            {act.materiales_necesarios?.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-v-fill px-2 py-0.5 text-[11px] font-medium text-v-muted"><Package size={11} /> {act.materiales_necesarios.length}</span>}
                          </div>
                          <div className="mt-auto flex items-center gap-2 pt-4">
                            <button onClick={() => setActiva(i)}
                              className={`inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-transform active:scale-95 ${done ? 'bg-v-fill text-v-text' : 'v-brand'}`}>
                              <Play size={13} /> {done ? L('Do it again', 'Repetir') : L('Do it now', 'Hacer ahora')}
                            </button>
                            <button onClick={() => { setConVideo(true); setActiva(i) }} title={L('See video examples', 'Ver ejemplos en video')}
                              className="grid size-9 shrink-0 place-items-center rounded-full bg-v-danger/10 text-v-danger transition-transform hover:scale-105"><CirclePlay size={16} /></button>
                            <button onClick={() => toggle(i)} title={done ? L('Mark as pending', 'Marcar pendiente') : L('Mark as done', 'Marcar hecha')}
                              className={`grid size-9 shrink-0 place-items-center rounded-full transition-colors ${done ? 'bg-v-success/15 text-v-success' : 'bg-v-fill text-v-subtle hover:text-v-success'}`}>
                              {done ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                            </button>
                          </div>
                        </div>
                      </motion.article>
                    )
                  })}
                </div>
              )}

              {/* ── Historial ── */}
              {historial.length > 1 && (
                <section className={`${cardClass} p-5`}>
                  <div className="mb-4 flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-[30%] bg-v-success/15 text-v-success"><TrendingUp size={15} /></span>
                    <p className="text-[15px] font-semibold tracking-tight text-v-text">{L('Previous weeks', 'Semanas anteriores')}</p>
                  </div>
                  <div className="space-y-3">
                    {historial.slice(0, 5).map((h: any, k: number) => (
                      <div key={k} className="flex items-center gap-3">
                        <span className="w-16 shrink-0 text-xs font-medium text-v-muted">{L('Week', 'Sem.')} {h.semana}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-v-fill">
                          <motion.div className={`h-full rounded-full ${h.completadas_pct === 100 ? 'bg-v-success' : 'v-brand'}`} initial={{ width: 0 }} animate={{ width: `${h.completadas_pct || 0}%` }} transition={{ delay: 0.05 * k, duration: 0.8 }} />
                        </div>
                        <span className={`w-10 text-right text-xs font-semibold tabular-nums ${h.completadas_pct === 100 ? 'text-v-success' : 'text-v-text'}`}>{h.completadas_pct || 0}%</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      ))}

      <AnimatePresence>
        {activa !== null && plan?.actividades?.[activa] && (
          <HacerAhora key={activa} act={plan.actividades[activa]} done={completadas.has(activa)} conVideo={conVideo} miniatura={miniaturas[activa]}
            onTerminar={() => toggle(activa)} onCerrar={() => { setActiva(null); setConVideo(false) }} />
        )}
      </AnimatePresence>
    </div>
  )
}

