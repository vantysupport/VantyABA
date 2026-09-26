'use client'
// Cómo se llena una evaluación: a mano (sin costo) o con apoyo de IA (1 token por análisis).
// Lo usan la pestaña Evaluaciones del paciente y "Mis formularios" del especialista.

import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, ChevronLeft, Coins, PenLine, Sparkles } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { TokensPrediccion, useTokensPrediccion } from '@/components/TokensPrediccion'

export type ModoLlenado = 'manual' | 'ia'

/** Tokens que le quedan al centro; null = sin límite o aún cargando. */
export function useTokensDisponibles(): number | null {
  const { data } = useTokensPrediccion()
  return data?.estado.limit == null ? null : (data.estado.disponible ?? 0)
}

/** Pantalla previa al formulario: elegir entre llenar a mano o con apoyo de IA. */
export function ElegirModoLlenado({ titulo, subtitulo, icono, onElegir, onBack }: {
  titulo: string; subtitulo?: string; icono?: ReactNode
  onElegir: (m: ModoLlenado) => void; onBack: () => void
}) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const disp = useTokensDisponibles()
  const sinSaldo = disp !== null && disp <= 0
  const opciones = [
    { key: 'manual' as const, Icon: PenLine, titulo: en ? 'Fill in manually' : 'Llenar manualmente', precio: en ? 'Free' : 'Sin costo',
      texto: en ? 'You write the analysis fields yourself (progress, difficulties, recommendations, message to the family).' : 'Tú escribes los campos de análisis (avances, dificultades, recomendaciones, mensaje a la familia).',
      tono: 'bg-v-fill text-v-text', disabled: false },
    { key: 'ia' as const, Icon: Sparkles, titulo: en ? 'AI assistance' : 'Apoyo con IA', precio: '1 token',
      texto: en ? 'You answer the questions and the AI completes the analysis fields using the latest sessions. You can edit everything.' : 'Respondes las preguntas y la IA completa los campos de análisis con las últimas sesiones. Puedes editar todo.',
      tono: 'bg-v-accent-soft text-v-accent', disabled: sinSaldo },
  ]
  return (
    <div className="v-scope mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="group inline-flex items-center gap-1 rounded-full py-1.5 pl-2 pr-3 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill hover:text-v-text">
          <ChevronLeft size={17} className="transition-transform group-hover:-translate-x-0.5" /> {en ? 'Back' : 'Volver'}
        </button>
        {icono && <span className="grid size-9 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent">{icono}</span>}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-v-text">{titulo}</p>
          {subtitulo && <p className="truncate text-xs text-v-subtle">{subtitulo}</p>}
        </div>
      </div>
      <div>
        <h2 className="text-xl font-bold tracking-tight text-v-text">{en ? 'How do you want to fill it in?' : '¿Cómo quieres llenarla?'}</h2>
        <p className="mt-1 text-sm text-v-muted">{en ? 'You can switch while filling it in.' : 'Puedes cambiar de modo mientras la llenas.'}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {opciones.map(({ key, Icon, titulo: tt, precio, texto, tono, disabled }, i) => (
          <motion.button key={key} type="button" disabled={disabled} onClick={() => onElegir(key)}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, type: 'spring', stiffness: 240, damping: 24 }}
            whileHover={disabled ? undefined : { y: -3 }} whileTap={disabled ? undefined : { scale: 0.98 }}
            className={`group flex flex-col items-start gap-3 rounded-v border bg-v-elevated p-5 text-left shadow-v transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${key === 'ia' ? 'border-v-accent/40 hover:border-v-accent' : 'border-v-border hover:border-v-accent/40'}`}>
            <div className="flex w-full items-center justify-between">
              <span className={`grid size-11 place-items-center rounded-[30%] ${tono}`}><Icon size={20} /></span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${key === 'ia' ? 'bg-v-accent text-white' : 'bg-v-success/15 text-v-success'}`}>
                {key === 'ia' && <Coins size={12} />} {precio}
              </span>
            </div>
            <div>
              <p className="text-base font-semibold text-v-text">{tt}</p>
              <p className="mt-1 text-sm leading-relaxed text-v-muted">{texto}</p>
              {disabled && <p className="mt-2 text-xs font-semibold text-v-warning">{en ? 'No tokens left this month' : 'No quedan tokens este mes'}</p>}
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-v-accent">
              {en ? 'Start' : 'Empezar'} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </motion.button>
        ))}
      </div>
      <TokensPrediccion />
    </div>
  )
}

/** Botón de la barra superior: muestra el modo actual (y el saldo en modo IA) y lo alterna. */
export function ChipModoLlenado({ modo, onCambiar }: { modo: ModoLlenado; onCambiar: (m: ModoLlenado) => void }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const disp = useTokensDisponibles()
  return (
    <button type="button" onClick={() => onCambiar(modo === 'ia' ? 'manual' : 'ia')} title={en ? 'Switch mode' : 'Cambiar modo'}
      className={`v-scope inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${modo === 'ia' ? 'bg-v-accent-soft text-v-accent hover:bg-v-accent/15' : 'bg-v-fill text-v-muted hover:text-v-text'}`}>
      {modo === 'ia' ? <Sparkles size={13} /> : <PenLine size={13} />}
      <span className="hidden sm:inline">{modo === 'ia' ? (en ? 'AI assistance' : 'Apoyo con IA') : 'Manual'}</span>
      {modo === 'ia' && disp !== null && <span className="inline-flex items-center gap-0.5 rounded-full bg-v-elevated px-1.5 py-0.5 tabular-nums"><Coins size={11} /> {disp}</span>}
    </button>
  )
}

/** Etiqueta "· 1" con moneda para los botones que gastan un token. */
export function CostoToken({ claro = false }: { claro?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${claro ? 'bg-white/20' : 'bg-v-elevated'}`}>
      <Coins size={11} /> 1
    </span>
  )
}
