'use client'
// Saldo de tokens de análisis predictivo del centro y compra de paquetes.
// La compra queda "pendiente de pago" hasta que se confirme (hoy desde /control; luego la pasarela).

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Coins, Loader2, ShoppingCart, Check, Clock, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { adminFetch } from '@/lib/admin-fetch'

type Estado = { limit: number | null; used: number; extra: number; disponible: number | null }
type Pack = { tokens: number; usd: number }
type Compra = { id: string; tokens: number; precio_usd: number; estado: 'pendiente' | 'pagada' | 'cancelada'; created_at: string }

const EVENTO = 'vanty:tokens'
/** Avisar a la barra de tokens: `agotado` abre la compra; si no, solo actualiza el saldo. */
export function avisarTokens(agotado: boolean) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO, { detail: { agotado } }))
}

export function useTokensPrediccion() {
  const [data, setData] = useState<{ estado: Estado; packs: Pack[]; compras: Compra[] } | null>(null)
  const cargar = useCallback(() => {
    adminFetch('/api/centro/tokens').then(r => (r.ok ? r.json() : null)).then(j => { if (j?.estado) setData(j) }).catch(() => {})
  }, [])
  useEffect(() => { cargar() }, [cargar])
  return { data, cargar }
}

/** Barra compacta: saldo del mes y botón de compra. `agotado` la muestra como aviso. */
export function TokensPrediccion({ agotado = false, className = '' }: { agotado?: boolean; className?: string }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const { data, cargar } = useTokensPrediccion()
  const [abierto, setAbierto] = useState(agotado)
  const [comprando, setComprando] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [sinSaldo, setSinSaldo] = useState(agotado)
  useEffect(() => { if (agotado) { setAbierto(true); setSinSaldo(true); cargar() } }, [agotado, cargar])
  // Otras pantallas avisan cuando generan algo (o cuando se quedan sin tokens)
  useEffect(() => {
    const on = (e: Event) => {
      const ag = !!(e as CustomEvent<{ agotado: boolean }>).detail?.agotado
      setSinSaldo(ag); if (ag) setAbierto(true)
      cargar()
    }
    window.addEventListener(EVENTO, on)
    return () => window.removeEventListener(EVENTO, on)
  }, [cargar])

  if (!data) return null
  const { estado, packs, compras } = data
  const sinLimite = estado.limit == null
  const disp = estado.disponible ?? 0
  const pendientes = compras.filter(c => c.estado === 'pendiente')
  const alerta = sinSaldo || (!sinLimite && disp <= 0)

  const comprar = async (i: number) => {
    setComprando(i); setMsg(null)
    try {
      const res = await adminFetch('/api/centro/tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pack: i }) })
      const j = await res.json().catch(() => ({}))
      if (res.status === 403) throw new Error(L('Only the center director can buy tokens.', 'Solo el director del centro puede comprar tokens.'))
      if (!res.ok) throw new Error(j.error || L('Could not register the purchase', 'No se pudo registrar la compra'))
      // Pago con tarjeta en la pasarela: los tokens se suman solos al confirmarse el pago
      if (j.checkoutUrl) { window.location.href = j.checkoutUrl; return }
      setMsg({ ok: true, text: L('Purchase registered. It is pending payment; the tokens are added as soon as the payment is confirmed.', 'Compra registrada. Queda pendiente de pago; los tokens se suman apenas se confirme el pago.') })
      cargar()
    } catch (e: any) {
      setMsg({ ok: false, text: e.message })
    } finally { setComprando(null) }
  }

  return (
    <div className={`overflow-hidden rounded-v border ${alerta ? 'border-v-warning/40 bg-v-warning/10' : 'border-v-border bg-v-elevated'} shadow-v ${className}`}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] ${alerta ? 'bg-v-warning/20 text-v-warning' : 'bg-v-accent-soft text-v-accent'}`}><Coins size={17} /></span>
        <div className="min-w-0 flex-[1_1_200px]">
          <p className="text-sm font-semibold text-v-text">
            {alerta
              ? L('No analysis tokens left this month', 'Se acabaron los tokens de análisis de este mes')
              : sinLimite
                ? L('AI analyses: no limit', 'Análisis con IA: sin límite')
                : L(`${disp} analysis tokens left`, `Te quedan ${disp} tokens de análisis`)}
          </p>
          <p className="text-[11px] text-v-subtle">
            {sinLimite ? L(`${estado.used} used this month`, `${estado.used} usados este mes`)
              : L(`${estado.used} of ${estado.limit} used this month${estado.extra ? ` · ${estado.extra} bought` : ''}`, `${estado.used} de ${estado.limit} usados este mes${estado.extra ? ` · ${estado.extra} comprados` : ''}`)}
            {pendientes.length > 0 && <span className="text-v-warning"> · {L(`${pendientes.length} purchase(s) pending payment`, `${pendientes.length} compra(s) pendiente(s) de pago`)}</span>}
          </p>
        </div>
        {packs.length > 0 && (
          <button data-compra onClick={() => setAbierto(a => !a)} className="v-brand inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold">
            {abierto ? <X size={14} /> : <ShoppingCart size={14} />} {abierto ? L('Close', 'Cerrar') : L('Buy tokens', 'Comprar tokens')}
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div data-compra initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-v-border px-4 py-4">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
                {packs.map((p, i) => {
                  const unit = p.usd / p.tokens
                  const mejor = packs.length > 1 && unit === Math.min(...packs.map(x => x.usd / x.tokens))
                  return (
                    <button key={i} onClick={() => comprar(i)} disabled={comprando !== null}
                      className={`relative flex flex-col items-start rounded-v-sm border p-3.5 text-left transition-all hover:border-v-accent disabled:opacity-60 ${mejor ? 'border-v-accent bg-v-accent-soft' : 'border-v-border bg-v-bg'}`}>
                      {mejor && <span className="absolute right-2.5 top-2.5 rounded-full bg-v-accent px-2 py-0.5 text-[10px] font-semibold text-white">{L('Best price', 'Mejor precio')}</span>}
                      <span className="text-2xl font-bold tabular-nums text-v-text">{p.tokens}</span>
                      <span className="text-xs text-v-muted">{p.tokens === 1 ? L('token', 'token') : L('tokens', 'tokens')}</span>
                      <span className="mt-2 text-base font-semibold text-v-accent">US$ {p.usd.toFixed(2)}</span>
                      <span className="text-[11px] text-v-subtle">{L(`US$ ${unit.toFixed(2)} each`, `US$ ${unit.toFixed(2)} c/u`)}</span>
                      {comprando === i && <Loader2 size={14} className="absolute bottom-3 right-3 animate-spin text-v-accent" />}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2.5 text-[11px] text-v-subtle">{L('1 token = 1 prediction, pattern analysis, goals, AI report or AI-assisted evaluation. Bought tokens do not expire and are used after the monthly ones.', '1 token = 1 predicción, análisis de patrones, objetivos, reporte IA o evaluación con apoyo de IA. Los tokens comprados no vencen y se usan después de los del mes.')}</p>
              {msg && (
                <p className={`mt-3 flex items-start gap-2 rounded-v-sm px-3 py-2.5 text-xs ${msg.ok ? 'bg-v-success/10 text-v-success' : 'bg-v-danger/10 text-v-danger'}`}>
                  {msg.ok ? <Check size={14} className="mt-px shrink-0" /> : <X size={14} className="mt-px shrink-0" />} {msg.text}
                </p>
              )}
              {pendientes.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {pendientes.map(c => (
                    <li key={c.id} className="flex items-center gap-2 text-xs text-v-muted">
                      <Clock size={12} className="text-v-warning" /> {c.tokens} token(s) · US$ {Number(c.precio_usd).toFixed(2)} · {L('pending payment', 'pendiente de pago')}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
