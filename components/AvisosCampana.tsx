'use client'
// Avisos sin leer del usuario (tabla notificaciones) para los menús de la campana de cada panel:
// solicitudes de reprogramación, cancelaciones de la familia, etc.

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, XCircle, Bell } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'

export type Aviso = { id: string; tipo: string; titulo: string; mensaje: string; created_at: string }

export function useAvisos(userId: string | null | undefined) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const cargar = useCallback(async () => {
    if (!userId) return
    try {
      const r = await fetch(`/api/notificaciones?user_id=${userId}&no_leidas=true`)
      const j = await r.json()
      setAvisos(Array.isArray(j.data) ? j.data : [])
    } catch {}
  }, [userId])
  useEffect(() => {
    cargar()
    const i = setInterval(cargar, 60_000)
    return () => clearInterval(i)
  }, [cargar])
  const marcarLeido = useCallback(async (id: string) => {
    setAvisos(prev => prev.filter(a => a.id !== id))
    await fetch('/api/notificaciones', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'marcar_leida', id }) }).catch(() => {})
  }, [])
  return { avisos, marcarLeido, recargar: cargar }
}

/** Sección de cada panel a la que lleva un aviso según su tipo (null = solo se marca como leído). */
export function vistaDeAviso(tipo: string, panel: 'admin' | 'especialista' | 'secretaria'): string | null {
  if (tipo.startsWith('cita') || tipo === 'reserva_online') return 'agenda'
  if (tipo === 'mensaje_familia') return panel === 'admin' ? 'chat-especialistas' : panel === 'especialista' ? 'evaluaciones' : null
  if (tipo === 'nuevo_miembro') return panel === 'admin' ? 'usuarios' : null
  return null
}

export function AvisosLista({ avisos, onAbrir }: { avisos: Aviso[]; onAbrir: (a: Aviso) => void }) {
  const { locale } = useI18n()
  if (avisos.length === 0) return null
  return (
    <div className="space-y-1.5">
      <p className="px-1 text-[10px] font-bold text-v-subtle">{locale === 'en' ? 'Notices' : 'Avisos'}</p>
      {avisos.map(a => {
        const Icon = a.tipo === 'cita_reprogramacion' ? RefreshCw : a.tipo.includes('cancel') ? XCircle : Bell
        const tono = a.tipo.includes('cancel') ? 'bg-v-danger/10 text-v-danger' : 'bg-v-accent-soft text-v-accent'
        return (
          <button key={a.id} onClick={() => onAbrir(a)}
            className="flex w-full items-start gap-2.5 rounded-xl bg-v-fill p-2.5 text-left transition-colors hover:bg-v-accent-soft">
            <span className={`grid size-7 shrink-0 place-items-center rounded-full ${tono}`}><Icon size={13} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-v-text">{a.titulo}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-v-muted">{a.mensaje}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
