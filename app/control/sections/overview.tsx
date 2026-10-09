'use client'
// Resumen de la consola: ingresos, reparto de centros, lo que requiere atención, centros recientes y uso.

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import {
  TrendingUp, Building2, Hourglass, CalendarClock, AlertTriangle, Coins, ChevronRight, CheckCircle2,
  Baby, Users, ShieldAlert, type LucideIcon,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { callControl } from '../api'
import { SectionTitle, useDate } from '../ui'
import { LogoCentro } from '../logo-centro'
import { AlmacenamientoPlataforma } from './almacenamiento'

type Item = { id: string; name: string; logo: string | null; plan: string | null; fecha: string | null }
type Overview = {
  byStatus: Record<string, number>
  mrr: number
  trialsEndingSoon: number
  patients: number
  users: number
  openAlerts: number
  total: number
  pagando: number
  atencion: { pendientes: Item[]; pruebas: Item[]; vencidos: Item[] }
  recientes: { id: string; name: string; logo: string | null; status: string; created_at: string; plan: string | null }[]
  comprasPendientes: number
  extras: number
  extrasCompras: number
}

const ESTADOS = [
  { k: 'active', color: 'bg-v-success', es: 'Activos', en: 'Active' },
  { k: 'trial', color: 'bg-v-accent', es: 'En prueba', en: 'Trial' },
  { k: 'pending_payment', color: 'bg-v-warning', es: 'Pago pendiente', en: 'Pending payment' },
  { k: 'suspended', color: 'bg-v-danger', es: 'Suspendidos', en: 'Suspended' },
]
const TONO_ESTADO: Record<string, string> = {
  active: 'bg-v-success/15 text-v-success', trial: 'bg-v-accent-soft text-v-accent',
  pending_payment: 'bg-v-warning/15 text-v-warning', suspended: 'bg-v-danger/15 text-v-danger',
}

export function OverviewSection({ onOpenSecurity, onOpenCentros, onError }: { onOpenSecurity: () => void; onOpenCentros: () => void; onError: (e: unknown) => void }) {
  const { t, locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const { date } = useDate()
  const [data, setData] = useState<Overview | null>(null)

  useEffect(() => {
    callControl<Overview>('overview').then(setData).catch(onError)
  }, [onError])

  const usd = (n: number, dec = 0) => `US$ ${n.toLocaleString(en ? 'en-US' : 'es-PE', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
  const total = data?.total ?? 0

  const grupos: { Icon: LucideIcon; tono: string; titulo: string; items: Item[]; fecha: string }[] = data ? [
    { Icon: Hourglass, tono: 'bg-v-warning/15 text-v-warning', titulo: L('Payments to confirm', 'Pagos por confirmar'), items: data.atencion.pendientes, fecha: L('Requested', 'Solicitado') },
    { Icon: AlertTriangle, tono: 'bg-v-danger/15 text-v-danger', titulo: L('Overdue or in grace period', 'Vencidos o en gracia'), items: data.atencion.vencidos, fecha: L('Paid until', 'Pagado hasta') },
    { Icon: CalendarClock, tono: 'bg-v-accent-soft text-v-accent', titulo: L('Trials ending in 7 days', 'Pruebas que vencen en 7 días'), items: data.atencion.pruebas, fecha: L('Ends', 'Vence') },
  ] : []
  const hayAtencion = grupos.some(g => g.items.length > 0) || (data?.comprasPendientes ?? 0) > 0

  return (
    <div>
      <SectionTitle title={t('vanty.control.overview.title')} subtitle={t('vanty.control.overview.subtitle')} />

      {/* ── Ingresos + reparto de centros ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="v-brand relative overflow-hidden rounded-[26px] p-6 text-white sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/15 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm text-white/80"><TrendingUp size={15} /> {L('Revenue this month', 'Ingresos del mes')}</p>
            <p className="mt-1 text-5xl font-bold tracking-tight tabular-nums">{data ? usd(data.mrr + data.extras, data.extras % 1 ? 2 : 0) : '—'}</p>
            <div className="mt-3 grid max-w-md grid-cols-[repeat(2,minmax(0,1fr))] gap-2 text-xs">
              <div className="rounded-[14px] bg-white/15 px-3 py-2">
                <p className="text-white/75">{L('Subscriptions (MRR)', 'Suscripciones (MRR)')}</p>
                <p className="text-base font-bold tabular-nums">{data ? usd(data.mrr) : '—'}</p>
                <p className="text-[10px] text-white/70">{data ? data.pagando : '—'} {L('paying centers', 'centros pagando')}</p>
              </div>
              <div className="rounded-[14px] bg-white/15 px-3 py-2">
                <p className="text-white/75">{L('Tokens and extras', 'Tokens y extras')}</p>
                <p className="text-base font-bold tabular-nums">{data ? usd(data.extras, 2) : '—'}</p>
                <p className="text-[10px] text-white/70">{data ? data.extrasCompras : '—'} {L('purchases this month', 'compras este mes')}</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-white/70">{L('Yearly run rate', 'Proyección anual')}: {data ? usd(data.mrr * 12) : '—'}</p>
          </div>
          <div className="rounded-[20px] bg-white/12 p-4 backdrop-blur">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-semibold"><Building2 size={15} /> {L('Centers', 'Centros')}</span>
              <span className="text-2xl font-bold tabular-nums">{data ? total : '—'}</span>
            </div>
            {/* Barra repartida por estado */}
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-white/20">
              {data && total > 0 && ESTADOS.map(e => {
                const n = data.byStatus[e.k] ?? 0
                return n > 0 ? <motion.span key={e.k} className={e.color} initial={{ width: 0 }} animate={{ width: `${(n / total) * 100}%` }} transition={{ duration: 0.8 }} /> : null
              })}
            </div>
            <div className="mt-3 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-4 gap-y-1.5 sm:grid-cols-[repeat(4,minmax(0,1fr))]">
              {ESTADOS.map(e => (
                <div key={e.k} className="flex items-center gap-1.5 text-xs text-white/85">
                  <span className={`size-2 rounded-full ${e.color}`} /> {en ? e.en : e.es}
                  <b className="ml-auto text-white tabular-nums sm:ml-1">{data ? data.byStatus[e.k] ?? 0 : '—'}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* ── Requiere tu atención ── */}
        <section className="rounded-[24px] border border-v-border bg-v-elevated p-5 shadow-v">
          <h3 className="font-semibold">{L('Needs your attention', 'Requiere tu atención')}</h3>
          {!data ? <p className="mt-4 text-sm text-v-muted">…</p> : !hayAtencion ? (
            <div className="mt-6 flex flex-col items-center py-6 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-v-success/15 text-v-success"><CheckCircle2 size={22} /></span>
              <p className="mt-3 text-sm font-semibold">{L('All clear', 'Todo en orden')}</p>
              <p className="text-xs text-v-muted">{L('No payments, trials or purchases waiting.', 'No hay pagos, pruebas ni compras pendientes.')}</p>
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              {grupos.filter(g => g.items.length > 0).map(g => (
                <div key={g.titulo}>
                  <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-v-muted">
                    <span className={`grid size-6 place-items-center rounded-[8px] ${g.tono}`}><g.Icon size={13} /></span>
                    {g.titulo} <span className="rounded-full bg-v-fill px-1.5 text-[10px]">{g.items.length}</span>
                  </p>
                  <div className="space-y-1">
                    {g.items.slice(0, 4).map(it => (
                      <button key={it.id} onClick={onOpenCentros} className="flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-left transition-colors hover:bg-v-fill">
                        <LogoCentro nombre={it.name} logo={it.logo} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{it.name}</p>
                          <p className="text-[11px] text-v-muted">{it.plan ?? '—'} · {g.fecha} {date(it.fecha)}</p>
                        </div>
                        <ChevronRight size={15} className="text-v-subtle" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {data.comprasPendientes > 0 && (
                <button onClick={onOpenCentros} className="flex w-full items-center gap-3 rounded-[14px] border border-v-border bg-v-bg px-3 py-2.5 text-left hover:bg-v-fill">
                  <span className="grid size-8 place-items-center rounded-[10px] bg-v-accent-soft text-v-accent"><Coins size={15} /></span>
                  <p className="flex-1 text-sm font-semibold">{L(`${data.comprasPendientes} token purchases to confirm`, `${data.comprasPendientes} compras de tokens por confirmar`)}</p>
                  <ChevronRight size={15} className="text-v-subtle" />
                </button>
              )}
            </div>
          )}
        </section>

        <div className="space-y-5">
          {/* ── Centros recientes ── */}
          <section className="rounded-[24px] border border-v-border bg-v-elevated p-5 shadow-v">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{L('Recent centers', 'Centros recientes')}</h3>
              <button onClick={onOpenCentros} className="text-xs font-semibold text-v-accent hover:underline">{L('See all', 'Ver todos')}</button>
            </div>
            <div className="mt-3 space-y-1">
              {(data?.recientes ?? []).map(c => (
                <button key={c.id} onClick={onOpenCentros} className="flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-left hover:bg-v-fill">
                  <LogoCentro nombre={c.name} logo={c.logo} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <p className="text-[11px] text-v-muted">{c.plan ?? '—'} · {date(c.created_at)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TONO_ESTADO[c.status] ?? 'bg-v-fill text-v-muted'}`}>{t(`vanty.control.status.${c.status}`)}</span>
                </button>
              ))}
              {data && data.recientes.length === 0 && <p className="py-4 text-center text-sm text-v-muted">{L('No centers yet.', 'Aún no hay centros.')}</p>}
            </div>
          </section>

          {/* ── Uso de la plataforma ── */}
          <section className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-3">
            {[
              { Icon: Baby, t: t('vanty.control.overview.patients'), v: data?.patients, tono: 'bg-v-accent-soft text-v-accent' },
              { Icon: Users, t: t('vanty.control.overview.users'), v: data?.users, tono: 'bg-v-accent-soft text-v-accent' },
              { Icon: ShieldAlert, t: L('Security alerts', 'Alertas'), v: data?.openAlerts, tono: data && data.openAlerts > 0 ? 'bg-v-danger/15 text-v-danger' : 'bg-v-success/15 text-v-success', onClick: onOpenSecurity },
            ].map(m => (
              <motion.button key={m.t} whileHover={{ y: -2 }} onClick={m.onClick} disabled={!m.onClick}
                className="rounded-[20px] border border-v-border bg-v-elevated p-4 text-left shadow-v disabled:cursor-default">
                <span className={`grid size-8 place-items-center rounded-[10px] ${m.tono}`}><m.Icon size={15} /></span>
                <p className="mt-3 text-2xl font-bold tabular-nums">{data ? m.v ?? 0 : '—'}</p>
                <p className="truncate text-xs text-v-muted">{m.t}</p>
              </motion.button>
            ))}
          </section>
        </div>
      </div>

      {/* ── Almacenamiento de toda la plataforma ── */}
      <AlmacenamientoPlataforma onError={onError} />
    </div>
  )
}
