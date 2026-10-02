'use client'
// Mensajes a ARIA del personal: cuántos quedan hoy según el plan del centro (GET /api/agente/chat?action=cuota).

import { useCallback, useEffect, useState } from 'react'

export type CuotaAria = { usados: number; max: number; reinicia: string | null }

export function useCuotaAria(activo: boolean) {
  const [cuota, setCuota] = useState<CuotaAria | null>(null)
  const cargar = useCallback(() => {
    fetch('/api/agente/chat?action=cuota', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j && typeof j.max === 'number') setCuota(j) })
      .catch(() => {})
  }, [])
  useEffect(() => { if (activo) cargar() }, [activo, cargar])
  const restantes = cuota ? Math.max(0, cuota.max - cuota.usados) : null
  return { cuota, restantes, agotado: restantes === 0, cargar }
}

const hora = (iso: string | null, en: boolean) =>
  iso ? new Date(iso).toLocaleTimeString(en ? 'en-US' : 'es-PE', { hour: '2-digit', minute: '2-digit' }) : null

/** Texto cuando ya no quedan mensajes hoy. */
export function textoAriaAgotada(cuota: CuotaAria, en: boolean) {
  const h = hora(cuota.reinicia, en)
  return en
    ? `You used your ${cuota.max} ARIA messages for today${h ? ` · available again at ${h}` : ''}. The limit depends on your center's plan.`
    : `Usaste tus ${cuota.max} mensajes de ARIA de hoy${h ? ` · vuelven a las ${h}` : ''}. El límite depende del plan de tu centro.`
}

/** Chip "Te quedan 12 de 30 hoy". `claro` para usarlo sobre un encabezado de color. */
export function ChipCuotaAria({ cuota, en, claro = false, className = '' }: { cuota: CuotaAria | null; en: boolean; claro?: boolean; className?: string }) {
  if (!cuota) return null
  const quedan = Math.max(0, cuota.max - cuota.usados)
  const bajo = quedan <= Math.max(1, Math.ceil(cuota.max * 0.2))
  const color = claro
    ? (quedan === 0 ? 'bg-red-500/90 text-white' : bajo ? 'bg-amber-400/90 text-slate-900' : 'bg-white/20 text-white')
    : (quedan === 0 ? 'bg-v-danger/15 text-v-danger' : bajo ? 'bg-v-warning/15 text-v-warning' : 'bg-v-accent-soft text-v-accent')
  return (
    <span title={en ? 'ARIA messages left today (per your center plan)' : 'Mensajes de ARIA que te quedan hoy (según el plan de tu centro)'}
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${color} ${className}`}>
      {en ? `${quedan}/${cuota.max} today` : `${quedan}/${cuota.max} hoy`}
    </span>
  )
}
