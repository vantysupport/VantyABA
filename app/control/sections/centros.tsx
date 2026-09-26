'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Search } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { Sheet } from '@/components/ui/sheet'
import { LogoCentro } from '../logo-centro'
import { callControl, type CentroRow, type Plan } from '../api'
import { Badge, Button, Card, Field, SectionTitle, Usage, useDate, useMoney } from '../ui'
import { CentroControl, diasRestantes, fmtMB } from './centro-control'
import { fasePago } from '@/lib/estado-centro'

type Event = { id: string; event: string; amount_pen: number | null; reference: string | null; note: string | null; created_at: string; plans: { name_es: string } | null }
type Topup = { id: string; kind: string; amount: number; price_pen: number | null; note: string | null; created_at: string }

export function CentrosSection({ onError }: { onError: (e: unknown) => void }) {
  const { t } = useI18n()
  const { date } = useDate()
  const [centros, setCentros] = useState<CentroRow[] | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(() => {
    Promise.all([callControl<{ centros: CentroRow[] }>('list_centros'), callControl<{ plans: Plan[] }>('list_plans')])
      .then(([c, p]) => {
        setCentros(c.centros)
        setPlans(p.plans)
      })
      .catch(onError)
  }, [onError])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (centros ?? []).filter(c => !q || c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q))
  }, [centros, query])

  const open = centros?.find(c => c.id === openId) ?? null

  return (
    <div>
      <SectionTitle
        title={t('vanty.control.centros.title')}
        subtitle={t('vanty.control.centros.subtitle', { n: String(centros?.length ?? 0) })}
        action={
          <label className="relative block w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-v-subtle" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('vanty.control.centros.search')}
              className="h-10 w-full rounded-full border border-v-border bg-v-elevated pr-4 pl-9 text-sm outline-none focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft"
            />
          </label>
        }
      />

      {centros && filtered.length === 0 && <p className="py-12 text-center text-v-muted">{t('vanty.control.centros.empty')}</p>}

      <div className="grid gap-3 md:grid-cols-2">
        <AnimatePresence initial={false}>
          {filtered.map((c, i) => { const pago = fasePago(c); return (
            <motion.button
              key={c.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.03 } }}
              exit={{ opacity: 0 }}
              whileHover={{ y: -2 }}
              onClick={() => setOpenId(c.id)}
              className={`rounded-v-lg border bg-v-elevated p-5 text-left shadow-v ${pago.fase === 'vencido' || pago.fase === 'gracia' ? 'border-v-danger/50 ring-2 ring-v-danger/15' : pago.fase === 'por_vencer' ? 'border-v-warning/50' : 'border-v-border'}`}
            >
              <div className="flex items-center gap-3">
                <LogoCentro nombre={c.name} logo={c.logo_url} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="truncate text-xs text-v-muted">{c.plans?.name_es ?? '—'} · {c.email ?? c.slug}</p>
                </div>
                <Badge kind={c.status}>{t(`vanty.control.status.${c.status}`)}</Badge>
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-v-subtle">
                {c.status === 'trial'
                  ? `${t('vanty.control.centros.trialEnds')} ${date(c.trial_ends_at)} · ${Math.max(0, diasRestantes(c.trial_ends_at) ?? 0)} d`
                  : `${t('vanty.control.centros.paidUntil')} ${date(c.paid_until)}`}
                {pago.fase === 'vencido' && <Badge kind="suspended">Pago vencido · acceso pausado</Badge>}
                {pago.fase === 'gracia' && <Badge kind="suspended">Pago vencido · pausa en {pago.dias} d</Badge>}
                {pago.fase === 'por_vencer' && <Badge kind="pending_payment">Vence en {pago.dias} d</Badge>}
                {c.comprasPendientes > 0 && <Badge kind="pending_payment">{c.comprasPendientes} {c.comprasPendientes === 1 ? 'compra pendiente' : 'compras pendientes'}</Badge>}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                <Usage label={t('vanty.control.centros.patients')} used={c.counts.patients} max={c.plans?.max_patients ?? null} />
                <Usage label={t('vanty.control.centros.staff')} used={c.counts.staff} max={c.plans?.max_professionals ?? null} />
                <Usage label={t('vanty.control.centros.parents')} used={c.counts.parents} max={c.plans?.max_parents ?? null} extra={c.extra_parents} />
                <Usage label={t('vanty.control.centros.aiReports')} used={c.ai.report.used} max={c.plans?.max_ai_reports ?? null} extra={c.ai.report.extra} />
                <Usage label={t('vanty.control.centros.predictive')} used={c.ai.predictive.used} max={c.limites?.max_predictive_tokens ?? c.plans?.max_predictive_tokens ?? null} extra={c.ai.predictive.extra} />
                <div className="text-xs text-v-muted">
                  <p className="flex justify-between"><span>Archivos</span><span className="tabular-nums">{fmtMB(c.uso?.archivos ?? 0)} / {(c.limites?.max_storage_mb ?? c.plans?.max_storage_mb) ? `${c.limites?.max_storage_mb ?? c.plans?.max_storage_mb} MB` : '∞'}</span></p>
                  <p className="mt-1 flex justify-between"><span>Datos</span><span className="tabular-nums">{fmtMB(c.uso?.datos ?? 0)} / {(c.limites?.max_db_mb ?? c.plans?.max_db_mb) ? `${c.limites?.max_db_mb ?? c.plans?.max_db_mb} MB` : '∞'}</span></p>
                </div>
              </div>
            </motion.button>
          ) })}
        </AnimatePresence>
      </div>

      {open && (
        <Sheet
          open={!!open}
          onOpenChange={o => !o && setOpenId(null)}
          title={open.name}
          description={`${open.plans?.name_es ?? '—'} · ${t(`vanty.control.status.${open.status}`)}`}
        >
          <CentroDetail centro={open} plans={plans} onChanged={load} onError={onError} />
        </Sheet>
      )}
    </div>
  )
}

function CentroDetail({ centro, plans, onChanged, onError }: { centro: CentroRow; plans: Plan[]; onChanged: () => void; onError: (e: unknown) => void }) {
  const { t } = useI18n()
  const money = useMoney()
  const { dateTime } = useDate()
  const [events, setEvents] = useState<Event[]>([])
  const [topups, setTopups] = useState<Topup[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const loadHistory = useCallback(() => {
    callControl<{ events: Event[]; topups: Topup[] }>('centro_events', { centro_id: centro.id })
      .then(r => {
        setEvents(r.events)
        setTopups(r.topups)
      })
      .catch(onError)
  }, [centro.id, onError])

  useEffect(() => { loadHistory() }, [loadHistory])

  async function run(key: string, action: string, params: Record<string, unknown>) {
    setBusy(key)
    setDone(null)
    try {
      await callControl(action, { centro_id: centro.id, ...params })
      setDone(key)
      onChanged()
      loadHistory()
    } catch (e) {
      onError(e)
    } finally {
      setBusy(null)
    }
  }

  const formData = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    return Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
  }

  return (
    <div className="space-y-4 pb-4">
      <CentroControl centro={centro} plans={plans} onChanged={onChanged} onError={onError} />

      <Card>
        <h3 className="font-semibold">{t('vanty.control.centros.confirmPayment')}</h3>
        <p className="mt-1 text-xs text-v-muted">{t('vanty.control.centros.confirmPaymentHint')}</p>
        <form
          className="mt-4 grid grid-cols-2 gap-3"
          onSubmit={e => {
            const f = formData(e)
            run('payment', 'confirm_payment', { plan_id: f.plan_id, months: Number(f.months), amount_pen: f.amount_pen, reference: f.reference })
          }}
        >
          <label className="col-span-2 block">
            <span className="mb-1.5 block text-xs font-medium text-v-muted">{t('vanty.control.centros.plan')}</span>
            <select name="plan_id" defaultValue={centro.plan_id ?? ''} required className="h-10 w-full rounded-v-sm border border-v-border bg-v-bg px-3 text-[15px]">
              {plans.map(p => <option key={p.id} value={p.id}>{p.name_es} · US$ {p.precio_region?.sudamerica ?? '—'} / US$ {p.precio_region?.norteamerica ?? '—'} / € {p.precio_region?.europa ?? '—'}</option>)}
            </select>
          </label>
          <Field name="months" type="number" min={1} max={24} defaultValue={1} label={t('vanty.control.centros.months')} required />
          <Field name="amount_pen" type="number" min={0} step="0.01" label={t('vanty.control.centros.amount')} />
          <div className="col-span-2">
            <Field name="reference" label={t('vanty.control.centros.reference')} hint={t('vanty.control.centros.referenceHint')} />
          </div>
          <Button type="submit" disabled={busy === 'payment'} className="col-span-2">
            {done === 'payment' ? t('vanty.control.saved') : t('vanty.control.centros.activate')}
          </Button>
        </form>
      </Card>

      <Card>
        <h3 className="font-semibold">{t('vanty.control.centros.topupTitle')}</h3>
        <form
          className="mt-4 grid grid-cols-2 gap-3"
          onSubmit={e => {
            const f = formData(e)
            run('topup', 'grant_topup', { kind: f.kind, amount: Number(f.amount), price_pen: f.price_pen, note: f.note })
          }}
        >
          <label className="col-span-2 block">
            <span className="mb-1.5 block text-xs font-medium text-v-muted">{t('vanty.control.centros.topupKind')}</span>
            <select name="kind" className="h-10 w-full rounded-v-sm border border-v-border bg-v-bg px-3 text-[15px]">
              <option value="report">{t('vanty.control.centros.aiReports')}</option>
              <option value="predictive">{t('vanty.control.centros.predictive')}</option>
              <option value="parent_slot">{t('vanty.control.centros.parentSlots')}</option>
            </select>
          </label>
          <Field name="amount" type="number" required label={t('vanty.control.centros.quantity')} hint={t('vanty.control.centros.quantityHint')} />
          <Field name="price_pen" type="number" min={0} step="0.01" label={t('vanty.control.centros.amount')} />
          <div className="col-span-2"><Field name="note" label={t('vanty.control.centros.note')} /></div>
          <Button type="submit" disabled={busy === 'topup'} className="col-span-2">
            {done === 'topup' ? t('vanty.control.saved') : t('vanty.control.centros.grant')}
          </Button>
        </form>
      </Card>

      <Card>
        <h3 className="font-semibold">{t('vanty.control.centros.history')}</h3>
        <ul className="mt-3 divide-y divide-v-border text-sm">
          {[...events.map(e => ({ id: e.id, at: e.created_at, title: t(`vanty.control.events.${e.event}`), detail: [e.plans?.name_es, e.amount_pen != null ? money(e.amount_pen) : null, e.reference, e.note].filter(Boolean).join(' · ') })),
            ...topups.map(tp => ({ id: tp.id, at: tp.created_at, title: `${t('vanty.control.centros.topupTitle')} · ${tp.kind} ${tp.amount > 0 ? '+' : ''}${tp.amount}`, detail: [tp.price_pen != null ? money(tp.price_pen) : null, tp.note].filter(Boolean).join(' · ') }))]
            .sort((a, b) => b.at.localeCompare(a.at))
            .map(item => (
              <li key={item.id} className="py-2.5">
                <div className="flex justify-between gap-3">
                  <span className="font-medium">{item.title}</span>
                  <span className="shrink-0 text-xs text-v-subtle">{dateTime(item.at)}</span>
                </div>
                {item.detail && <p className="mt-0.5 text-xs text-v-muted">{item.detail}</p>}
              </li>
            ))}
          {events.length + topups.length === 0 && <li className="py-3 text-v-muted">{t('vanty.control.centros.noHistory')}</li>}
        </ul>
      </Card>
    </div>
  )
}
