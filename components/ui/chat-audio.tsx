'use client'
// Reproductor de notas de voz para los chats (equipo y familias): botón, barra de progreso y forma de onda.
// Recibe la URL ya resuelta (fileUrl) porque los buckets de chat son privados.

import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'

const ONDA = [4, 6, 10, 8, 14, 12, 16, 10, 8, 12, 16, 14, 10, 8, 6, 10, 14, 12, 8, 16, 10, 8, 12, 14, 8, 10, 6, 4]
const fmt = (sec: number) => `${Math.floor(sec / 60).toString().padStart(2, '0')}:${Math.floor(sec % 60).toString().padStart(2, '0')}`

export function ChatAudio({ url, isMe }: { url: string; isMe: boolean }) {
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const a = audioRef.current; if (!a) return
    const onT = () => setCurrent(a.currentTime)
    const onL = () => { if (Number.isFinite(a.duration)) setDuration(a.duration) }
    const onE = () => { setPlaying(false); setCurrent(0) }
    const onErr = () => { setError(true); setPlaying(false) }
    a.addEventListener('timeupdate', onT); a.addEventListener('loadedmetadata', onL); a.addEventListener('durationchange', onL)
    a.addEventListener('ended', onE); a.addEventListener('error', onErr)
    return () => {
      a.removeEventListener('timeupdate', onT); a.removeEventListener('loadedmetadata', onL); a.removeEventListener('durationchange', onL)
      a.removeEventListener('ended', onE); a.removeEventListener('error', onErr)
    }
  }, [])

  const toggle = async () => {
    const a = audioRef.current; if (!a) return
    if (playing) { a.pause(); setPlaying(false); return }
    // Pausar cualquier otro audio del chat que esté sonando
    document.querySelectorAll('audio[data-chat-audio]').forEach(el => { if (el !== a) (el as HTMLAudioElement).pause() })
    try { await a.play(); setPlaying(true); setError(false) } catch { setError(true) }
  }

  const progress = duration ? (current / duration) * 100 : 0
  return (
    <div className="flex min-w-[200px] items-center gap-2.5">
      <audio ref={audioRef} src={url} preload="metadata" data-chat-audio onPause={() => setPlaying(false)} />
      <button onClick={toggle} aria-label={playing ? 'Pausa' : 'Reproducir'}
        className={`grid size-9 shrink-0 place-items-center rounded-full transition-colors ${isMe ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-v-accent-soft text-v-accent hover:bg-v-accent hover:text-white'}`}>
        {playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-[18px] cursor-pointer items-center gap-[2px]"
          onClick={e => { const r = e.currentTarget.getBoundingClientRect(); if (audioRef.current && duration) audioRef.current.currentTime = ((e.clientX - r.left) / r.width) * duration }}>
          {ONDA.map((h, i) => (
            <span key={i} className="w-[2px] rounded-full transition-colors" style={{ height: h, background: (i / ONDA.length) * 100 < progress ? (isMe ? '#fff' : 'var(--v-accent)') : (isMe ? 'rgba(255,255,255,0.35)' : 'var(--v-border)') }} />
          ))}
        </div>
        <span className={`mt-1 block text-[11px] tabular-nums ${isMe ? 'text-white/80' : 'text-v-subtle'}`}>
          {error ? 'No se pudo cargar el audio' : fmt(playing || current ? current : duration)}
        </span>
      </div>
    </div>
  )
}
