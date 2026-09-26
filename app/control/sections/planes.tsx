'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { callControl, type Plan } from '../api'
import { Button, Card, Field, SectionTitle, Switch } from '../ui'

const NUMBER_FIELDS = [
  'max_professionals', 'max_patients', 'max_parents', 'max_ai_reports', 'max_predictive_tokens',
  'max_aria_msgs_staff_day', 'max_aria_msgs_parent_day', 'max_parent_plans_month', 'max_storage_mb', 'max_db_mb', 'extra_ai_pack_size', 'extra_ai_pack_price_pen', 'extra_parent_price_pen', 'sort_order',
] as const
const PRICE_FIELDS = new Set(['price_pen', 'extra_ai_pack_price_pen', 'extra_parent_price_pen'])
// Precio mensual por región (USD en Latinoamérica y Norteamérica, EUR en Europa). Anual = 10 meses.
const REGIONES_PRECIO = [
  { k: 'sudamerica', es: 'Latinoamérica (USD)', en: 'Latin America (USD)' },
  { k: 'norteamerica', es: 'Norteamérica (USD)', en: 'North America (USD)' },
  { k: 'europa', es: 'Europa (EUR)', en: 'Europe (EUR)' },
] as const
const FLAG_FIELDS = ['has_team_chat', 'has_catalog', 'has_financial_reports', 'is_active'] as const

export function PlanesSection({ onError }: { onError: (e: unknown) => void }) {
  const { t } = useI18n()
  const [plans, setPlans] = useState<Plan[]>([])
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    callControl<{ plans: Plan[] }>('list_plans').then(r => setPlans(r.plans)).catch(onError)
  }, [onError])
  useEffect(() => { load() }, [load])

  return (
    <div>
      <SectionTitle
        title={t('vanty.control.plans.title')}
        subtitle={t('vanty.control.plans.subtitle')}
        action={<Button variant="secondary" onClick={() => setCreating(c => !c)}><Plus className="size-4" />{t('vanty.control.plans.new')}</Button>}
      />
      {creating && <NewPlanForm onCreated={() => { setCreating(false); load() }} onError={onError} />}
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map(p => <PlanEditor key={p.id} plan={p} onError={onError} />)}
      </div>
    </div>
  )
}

function PlanEditor({ plan, onError }: { plan: Plan; onError: (e: unknown) => void }) {
  const { t, locale } = useI18n()
  const [draft, setDraft] = useState<Plan>(plan)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const dirty = JSON.stringify(draft) !== JSON.stringify(plan) && state !== 'saved'

  const set = <K extends keyof Plan>(k: K, v: Plan[K]) => {
    setDraft(d => ({ ...d, [k]: v }))
    setState('idle')
  }

  async function save() {
    setState('saving')
    try {
      const { id, code, ...rest } = draft
      void code
      await callControl('update_plan', { id, plan: rest })
      setState('saved')
    } catch (e) {
      setState('idle')
      onError(e)
    }
  }

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-v-subtle uppercase">{plan.code}</span>
        <Switch checked={draft.is_active} onChange={v => set('is_active', v)} label={t('vanty.control.plans.active')} />
      </div>
      <p className="mt-4 text-xs font-semibold text-v-muted">{locale === 'en' ? 'Monthly price by region' : 'Precio mensual por región'}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {REGIONES_PRECIO.map(r => (
          <Field key={r.k} type="number" min={0} step="0.01" label={locale === 'en' ? r.en : r.es}
            value={draft.precio_region?.[r.k] ?? ''}
            onChange={e => set('precio_region', { ...(draft.precio_region ?? {}), [r.k]: e.target.value === '' ? undefined : Number(e.target.value) })} />
        ))}
      </div>
      <p className="mt-4 text-xs font-semibold text-v-muted">{locale === 'en' ? 'Lemon Squeezy variant IDs' : 'IDs de variante en Lemon Squeezy'}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field inputMode="numeric" label={locale === 'en' ? 'Monthly' : 'Mensual'} placeholder="123456" value={draft.lemon_variant_mensual ?? ''}
          onChange={e => set('lemon_variant_mensual', e.target.value.replace(/\D/g, '') || null)} />
        <Field inputMode="numeric" label={locale === 'en' ? 'Yearly' : 'Anual'} placeholder="123457" value={draft.lemon_variant_anual ?? ''}
          onChange={e => set('lemon_variant_anual', e.target.value.replace(/\D/g, '') || null)} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label={t('vanty.control.plans.nameEs')} value={draft.name_es} onChange={e => set('name_es', e.target.value)} />
        <Field label={t('vanty.control.plans.nameEn')} value={draft.name_en} onChange={e => set('name_en', e.target.value)} />
        {NUMBER_FIELDS.map(k => (
          <Field
            key={k}
            type="number"
            min={0}
            step={PRICE_FIELDS.has(k) ? '0.01' : '1'}
            label={t(`vanty.control.plans.fields.${k}`)}
            value={draft[k] ?? ''}
            onChange={e => set(k, (e.target.value === '' ? null : Number(e.target.value)) as Plan[typeof k])}
          />
        ))}
      </div>
      <div className="mt-3 divide-y divide-v-border">
        {FLAG_FIELDS.filter(k => k !== 'is_active').map(k => (
          <Switch key={k} checked={draft[k]} onChange={v => set(k, v)} label={t(`vanty.control.plans.fields.${k}`)} />
        ))}
      </div>
      <Button onClick={save} disabled={!dirty || state === 'saving'} className="mt-4">
        {state === 'saved' ? t('vanty.control.saved') : state === 'saving' ? t('vanty.control.saving') : t('vanty.control.save')}
      </Button>
    </Card>
  )
}

function NewPlanForm({ onCreated, onError }: { onCreated: () => void; onError: (e: unknown) => void }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  return (
    <Card className="mb-4">
      <form
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
        onSubmit={async e => {
          e.preventDefault()
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
          setBusy(true)
          try {
            await callControl('create_plan', { code: f.code, plan: { name_es: f.name_es, name_en: f.name_en, price_pen: Number(f.price_pen), is_active: false } })
            onCreated()
          } catch (err) {
            onError(err)
          } finally {
            setBusy(false)
          }
        }}
      >
        <Field name="code" required label={t('vanty.control.plans.code')} pattern="[a-z0-9_-]+" />
        <Field name="name_es" required label={t('vanty.control.plans.nameEs')} />
        <Field name="name_en" required label={t('vanty.control.plans.nameEn')} />
        <Field name="price_pen" type="number" min={0} step="0.01" required label={t('vanty.control.plans.fields.price_pen')} />
        <p className="col-span-2 text-xs text-v-muted md:col-span-3">{t('vanty.control.plans.newHint')}</p>
        <Button type="submit" disabled={busy}>{t('vanty.control.plans.create')}</Button>
      </form>
    </Card>
  )
}
