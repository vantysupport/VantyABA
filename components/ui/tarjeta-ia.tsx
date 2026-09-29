'use client'
// Estado de las funciones de IA con su interruptor: en Configuración → Centro (dirección, para todo el centro)
// y en el Perfil de la familia (su propia autorización para ARIA). Activar siempre pasa por la ventana de consentimiento.

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n-context'
import { confirmar } from '@/components/ui/confirmar'
import { alCambiarConsentimientoIA, guardarConsentimientoIA, pedirConsentimientoIA } from '@/components/ConsentimientoIA'
import type { EstadoIA, MotivoIA } from '@/lib/ia-consentimiento'

type Estado = { rol: string; centro: EstadoIA; centroAt: string | null; propio: EstadoIA; propioAt: string | null }

export function TarjetaIA({ ambito, className = '' }: { ambito: MotivoIA; className?: string }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [estado, setEstado] = useState<Estado | null>(null)
  const [cambiando, setCambiando] = useState(false)

  const cargar = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/ia/consentimiento', { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}, cache: 'no-store' })
    if (r.ok) setEstado(await r.json())
  }, [])
  useEffect(() => { cargar(); return alCambiarConsentimientoIA(cargar) }, [cargar])

  const valor = estado ? (ambito === 'centro' ? estado.centro : estado.propio) : null
  const fecha = estado ? (ambito === 'centro' ? estado.centroAt : estado.propioAt) : null
  const activa = valor === 'aceptada'
  const centroApagado = ambito === 'propio' && !!estado && estado.centro !== 'aceptada'

  const alternar = async () => {
    if (!estado) return
    if (!activa) { pedirConsentimientoIA(ambito, estado.rol); return }
    const ok = await confirmar(
      ambito === 'centro'
        ? L('ARIA, automatic reports and AI analyses will stop working for everyone in the center. No more data will be sent to the AI provider.',
          'ARIA, los informes automáticos y los análisis con IA dejarán de funcionar para todo el centro. No se enviarán más datos al proveedor de IA.')
        : L('ARIA will stop answering and no more data will be sent to the AI provider.', 'ARIA dejará de responder y no se enviarán más datos al proveedor de IA.'),
      {
        titulo: ambito === 'centro' ? L('Turn off AI for the center?', '¿Desactivar la IA en el centro?') : L('Turn off ARIA?', '¿Desactivar ARIA?'),
        confirmar: L('Turn off', 'Desactivar'), peligro: true,
      },
    )
    if (!ok) return
    setCambiando(true)
    try { await guardarConsentimientoIA(ambito, 'rechazada') } catch { /* la tarjeta queda como estaba */ } finally { setCambiando(false) }
  }

  const fechaTxt = fecha ? new Date(fecha).toLocaleDateString(en ? 'en-US' : 'es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  const sub = !estado ? '…'
    : centroApagado ? L('Your center has not turned on AI features.', 'Tu centro no ha activado las funciones de IA.')
    : activa ? L(`On since ${fechaTxt}`, `Activada desde el ${fechaTxt}`)
    : L('Off. No data is sent to the AI provider.', 'Desactivada. No se envía ningún dato al proveedor de IA.')
  const titulo = ambito === 'centro' ? L('AI features', 'Funciones de IA') : L('ARIA assistant', 'Asistente ARIA')

  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-[30%] ${activa ? 'bg-v-accent-soft text-v-accent' : 'bg-v-fill text-v-muted'}`}><Sparkles size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-v-text">{titulo}</span>
        <span className="mt-0.5 block text-xs text-v-muted">{sub}</span>
      </span>
      {estado && !centroApagado && (
        <button role="switch" aria-checked={activa} onClick={alternar} disabled={cambiando} aria-label={titulo}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${activa ? 'bg-v-accent' : 'bg-[var(--v-border-strong)]'}`}>
          <span className={`absolute top-0.5 grid size-6 place-items-center rounded-full bg-white shadow transition-all ${activa ? 'left-[22px]' : 'left-0.5'}`}>
            {cambiando && <Loader2 className="size-3.5 animate-spin text-v-accent" />}
          </span>
        </button>
      )}
    </div>
  )
}
