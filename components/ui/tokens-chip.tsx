'use client'
import { Coins, Plus } from 'lucide-react'
import { useSinPagos } from '@/lib/modo-app'
// Contador de tokens de la familia: cuota restante del periodo, más los comprados (+N).
// Si se pasa onComprar, el contador es un botón que abre la compra de tokens.
export function TokensChip({ restantes, max, etiqueta, extra = 0, onComprar }: { restantes: number; max: number; etiqueta: string; extra?: number; onComprar?: () => void }) {
  // En la app instalada desde Google Play no se vende nada (su política de pagos): el contador no abre la compra
  if (useSinPagos()) onComprar = undefined
  const agotado = restantes === 0 && extra === 0
  const bajo = !agotado && restantes + extra <= Math.max(1, Math.round(max * 0.2))
  const clase = `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tabular-nums transition-colors ${agotado ? 'bg-v-danger/10 text-v-danger' : bajo ? 'bg-v-warning/15 text-v-warning' : 'bg-v-warning/10 text-v-text'} ${onComprar ? 'hover:ring-2 hover:ring-v-warning/30' : ''}`
  const contenido = (
    <>
      <Coins size={12} className={agotado ? '' : 'text-v-warning'} /> {restantes}/{max}
      {extra > 0 && <span className="text-v-success">+{extra}</span>}
      <span className="font-medium text-v-muted">{etiqueta}</span>
      {onComprar && <Plus size={12} className="text-v-accent" />}
    </>
  )
  const titulo = `${restantes}/${max} ${etiqueta}${extra > 0 ? ` · +${extra}` : ''}`
  return onComprar
    ? <button type="button" onClick={onComprar} title={titulo} className={clase}>{contenido}</button>
    : <span title={titulo} className={clase}>{contenido}</span>
}
