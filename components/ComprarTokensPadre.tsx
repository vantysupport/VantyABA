'use client'
// components/ComprarTokensPadre.tsx
// Compra de tokens extra para una familia (planes de práctica o mensajes de ARIA).
// El pedido queda "pendiente" y se suma al confirmarse el pago en /control. Los tokens comprados no vencen.

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X, Coins, Loader2, Check, Sparkles, Heart, Clock, ShieldCheck } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'

type Tipo = 'practica' | 'aria'
type Pack = { tokens: number; usd: number }
type Compra = { id: string; kind: string; tokens: number; precio_usd: number; estado: string; created_at: string }

export default function ComprarTokensPadre({ abierto, tipoInicial = 'aria', onClose, onComprado }: { abierto: boolean; tipoInicial?: Tipo; onClose: () => void; onComprado?: () => void }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [tipo, setTipo] = useState<Tipo>(tipoInicial)
  const [packs, setPacks] = useState<Pack[]>([])
  const [compras, setCompras] = useState<Compra[]>([])
  const [pack, setPack] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState('')

  const cargar = () => {
    setCargando(true)
    fetch('/api/padre/tokens', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => {
      if (!j) return
      setPacks(j.packs || [])
      setCompras(j.compras || [])
      // Por defecto, el paquete más conveniente (el de más tokens)
      const mejor = (j.packs || []).reduce((b: number, p: Pack, i: number, arr: Pack[]) => (p.tokens > arr[b].tokens ? i : b), 0)
      setPack(mejor)
    }).catch(() => {}).finally(() => setCargando(false))
  }
  useEffect(() => { if (abierto) { setTipo(tipoInicial); setListo(false); setError(''); cargar() } }, [abierto, tipoInicial])
  useEffect(() => {
    if (!abierto) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [abierto, onClose])

  const pedir = async () => {
    setEnviando(true); setError('')
    try {
      const r = await fetch('/api/padre/tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, pack }) })
      const j = await r.json().catch(() => ({}))
      if (r.status === 409) throw new Error(L('You already have pending purchases. Wait until they are confirmed.', 'Ya tienes compras pendientes. Espera a que se confirmen.'))
      if (!r.ok) throw new Error(L('We could not register your purchase. Try again.', 'No pudimos registrar tu compra. Inténtalo de nuevo.'))
      // Pago con tarjeta en la pasarela: los tokens se suman solos al confirmarse el pago
      if (j.checkoutUrl) { window.location.href = j.checkoutUrl; return }
      setCompras(c => [j.compra, ...c])
      setListo(true)
      onComprado?.()
    } catch (e: any) { setError(e.message) }
    finally { setEnviando(false) }
  }

  const tipos = [
    { id: 'aria' as Tipo, Icon: Sparkles, t: L('ARIA messages', 'Mensajes de ARIA'), d: L('Keep chatting when your daily messages run out', 'Sigue conversando cuando se acaben tus mensajes del día') },
    { id: 'practica' as Tipo, Icon: Heart, t: L('Practice plans', 'Planes de práctica'), d: L('Create new home plans when your monthly ones run out', 'Crea planes nuevos cuando se acaben los del mes') },
  ]
  const unitario = (p: Pack) => p.usd / p.tokens
  const base = packs.length ? Math.max(...packs.map(unitario)) : 0
  const pendientes = compras.filter(c => c.estado === 'pendiente')

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div className="v-scope fixed inset-0 z-[160] flex items-end justify-center bg-[#081426]/50 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-v-lg border border-v-border bg-v-elevated shadow-v-lg sm:rounded-v-lg">
            <div className="relative flex shrink-0 items-center gap-3 border-b border-v-border px-5 py-4">
              <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
              <span className="grid size-10 place-items-center rounded-[30%] bg-v-warning/15 text-v-warning"><Coins size={19} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-v-text">{L('Get more tokens', 'Conseguir más tokens')}</p>
                <p className="text-xs text-v-muted">{L('Purchased tokens never expire', 'Los tokens comprados no vencen')}</p>
              </div>
              <button onClick={onClose} aria-label={L('Close', 'Cerrar')} className="grid size-9 place-items-center rounded-full text-v-muted hover:bg-v-fill"><X size={17} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {cargando ? (
                <div className="grid place-items-center py-10"><Loader2 className="animate-spin text-v-accent" size={24} /></div>
              ) : listo ? (
                <div className="py-4 text-center">
                  <span className="mx-auto grid size-14 place-items-center rounded-full bg-v-success/15 text-v-success"><Check size={26} /></span>
                  <p className="mt-3 text-lg font-semibold text-v-text">{L('Purchase requested', 'Compra solicitada')}</p>
                  <p className="mx-auto mt-1 max-w-xs text-sm text-v-muted">{L('We will contact you to coordinate the payment. Once confirmed, your tokens are added automatically.', 'Te contactaremos para coordinar el pago. Al confirmarlo, tus tokens se suman automáticamente.')}</p>
                  <button onClick={onClose} className="v-brand mt-5 inline-flex h-11 items-center rounded-full px-6 text-sm font-semibold">{L('Done', 'Listo')}</button>
                </div>
              ) : (
                <>
                  <p className="mb-2 text-xs font-semibold text-v-muted">{L('What do you need?', '¿Qué necesitas?')}</p>
                  <div className="space-y-2">
                    {tipos.map(({ id, Icon, t, d }) => (
                      <button key={id} onClick={() => setTipo(id)}
                        className={`flex w-full items-center gap-3 rounded-v-sm border p-3 text-left transition-all ${tipo === id ? 'border-v-accent/50 bg-v-accent-soft/60 ring-4 ring-v-accent-soft' : 'border-v-border bg-v-bg hover:border-v-accent/30'}`}>
                        <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] ${tipo === id ? 'v-brand' : 'bg-v-fill text-v-muted'}`} style={tipo === id ? { boxShadow: 'none' } : undefined}><Icon size={16} /></span>
                        <span className="min-w-0"><span className="block text-sm font-semibold text-v-text">{t}</span><span className="block text-xs text-v-muted">{d}</span></span>
                      </button>
                    ))}
                  </div>

                  <p className="mb-2 mt-5 text-xs font-semibold text-v-muted">{L('Choose a pack', 'Elige un paquete')}</p>
                  <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2">
                    {packs.map((p, i) => {
                      const ahorro = base > 0 ? Math.round((1 - unitario(p) / base) * 100) : 0
                      return (
                        <button key={i} onClick={() => setPack(i)}
                          className={`relative rounded-v-sm border p-4 text-center transition-all ${pack === i ? 'border-v-accent/50 bg-v-accent-soft/60 ring-4 ring-v-accent-soft' : 'border-v-border bg-v-bg hover:border-v-accent/30'}`}>
                          {ahorro > 0 && <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-v-success px-2 py-0.5 text-[10px] font-bold text-white">{L(`Save ${ahorro}%`, `Ahorra ${ahorro}%`)}</span>}
                          <p className="flex items-center justify-center gap-1 text-2xl font-bold tabular-nums text-v-text"><Coins size={18} className="text-v-warning" /> {p.tokens}</p>
                          <p className="text-xs text-v-muted">{p.tokens === 1 ? 'token' : 'tokens'}</p>
                          <p className="mt-2 text-base font-semibold tabular-nums text-v-accent">US$ {p.usd.toFixed(2)}</p>
                        </button>
                      )
                    })}
                  </div>

                  {pendientes.length > 0 && (
                    <div className="mt-5 rounded-v-sm bg-v-fill/60 p-3">
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-v-muted"><Clock size={12} /> {L('Pending payment', 'Pendientes de pago')}</p>
                      {pendientes.map(c => (
                        <p key={c.id} className="text-xs text-v-text">{c.tokens} {c.kind === 'padre_aria' ? L('ARIA', 'ARIA') : L('practice', 'práctica')} · US$ {Number(c.precio_usd).toFixed(2)}</p>
                      ))}
                    </div>
                  )}
                  {error && <p role="alert" className="mt-3 text-center text-sm text-v-danger">{error}</p>}
                </>
              )}
            </div>

            {!cargando && !listo && (
              <div className="shrink-0 space-y-2 border-t border-v-border p-4">
                <button onClick={pedir} disabled={enviando || !packs.length} className="v-brand inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-60">
                  {enviando ? <Loader2 size={16} className="animate-spin" /> : <Coins size={16} />}
                  {packs[pack] ? L(`Buy ${packs[pack].tokens} token${packs[pack].tokens === 1 ? '' : 's'} · US$ ${packs[pack].usd.toFixed(2)}`, `Comprar ${packs[pack].tokens} token${packs[pack].tokens === 1 ? '' : 's'} · US$ ${packs[pack].usd.toFixed(2)}`) : L('Buy', 'Comprar')}
                </button>
                <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-v-subtle"><ShieldCheck size={12} /> {L('No card needed: we coordinate the payment with you.', 'Sin tarjeta: coordinamos el pago contigo.')}</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
