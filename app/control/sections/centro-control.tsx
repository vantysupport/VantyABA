'use client'
// Control fino de un centro desde /control: prueba, plan, límites propios, funciones y compras de tokens.

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n-context'
import { callControl, type CentroRow, type Plan } from '../api'
import { Badge, Button, Card, Field, Switch } from '../ui'
import { MODULES } from './plataforma'
import { confirmar } from '@/components/ui/confirmar'

type Compra = { id: string; kind?: string; tokens: number; precio_usd: number; estado: 'pendiente' | 'pagada' | 'cancelada'; created_at: string; pagada_at: string | null; referencia: string | null; familia?: { full_name: string | null; email: string | null } | null }

const MB = 1024 * 1024
export const fmtMB = (bytes: number) => (bytes >= 1024 * MB ? `${(bytes / 1024 / MB).toFixed(2)} GB` : `${(bytes / MB).toFixed(1)} MB`)

export function diasRestantes(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

const LIMITES: { key: keyof CentroRow['limites']; es: string; en: string; unidad?: string }[] = [
  { key: 'max_patients', es: 'Pacientes', en: 'Patients' },
  { key: 'max_professionals', es: 'Equipo', en: 'Team' },
  { key: 'max_parents', es: 'Familias', en: 'Families' },
  { key: 'max_storage_mb', es: 'Archivos (MB)', en: 'Files (MB)' },
  { key: 'max_db_mb', es: 'Datos (MB)', en: 'Data (MB)' },
  { key: 'max_predictive_tokens', es: 'Análisis predictivos / mes', en: 'Predictive analyses / month' },
  { key: 'max_ai_reports', es: 'Reportes IA / mes', en: 'AI reports / month' },
  { key: 'max_parent_plans_month', es: 'Planes de práctica / padre / mes', en: 'Practice plans / parent / month' },
  { key: 'max_aria_msgs_parent_day', es: 'ARIA / padre / día', en: 'ARIA / parent / day' },
  { key: 'max_aria_msgs_staff_day', es: 'ARIA / equipo / día', en: 'ARIA / team member / day' },
]

export function CentroControl({ centro, plans, onChanged, onError }: { centro: CentroRow; plans: Plan[]; onChanged: () => void; onError: (e: unknown) => void }) {
  const { t, locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [dias, setDias] = useState<number>(Math.max(0, diasRestantes(centro.trial_ends_at) ?? 0))
  const [planId, setPlanId] = useState(centro.plan_id ?? '')
  const [limites, setLimites] = useState<Record<string, string>>(() => Object.fromEntries(LIMITES.map(l => [l.key, centro.limites?.[l.key] != null ? String(centro.limites[l.key]) : ''])))
  const [features, setFeatures] = useState<Record<string, boolean>>(centro.features ?? {})
  const [compras, setCompras] = useState<Compra[]>([])
  const [borrar, setBorrar] = useState(false)
  const [nombreConfirma, setNombreConfirma] = useState('')

  const cargarCompras = useCallback(() => {
    callControl<{ compras: Compra[] }>('list_compras_tokens', { centro_id: centro.id }).then(r => setCompras(r.compras)).catch(onError)
  }, [centro.id, onError])
  useEffect(() => { cargarCompras() }, [cargarCompras])

  async function run(key: string, action: string, params: Record<string, unknown>) {
    setBusy(key); setDone(null)
    try {
      await callControl(action, { centro_id: centro.id, ...params })
      setDone(key)
      onChanged()
    } catch (e) { onError(e) } finally { setBusy(null) }
  }

  const restantes = diasRestantes(centro.trial_ends_at)
  const plan = centro.plans
  const usoDe: Record<string, string> = {
    max_patients: String(centro.counts.patients),
    max_professionals: String(centro.counts.staff),
    max_parents: String(centro.counts.parents),
    max_storage_mb: fmtMB(centro.uso?.archivos ?? 0),
    max_db_mb: fmtMB(centro.uso?.datos ?? 0),
    max_predictive_tokens: String(centro.ai.predictive.used),
    max_ai_reports: String(centro.ai.report.used),
    max_parent_plans_month: L('per family', 'por familia'),
    max_aria_msgs_parent_day: L('per family', 'por familia'),
    max_aria_msgs_staff_day: L('per person', 'por persona'),
  }
  const planGate: Record<string, boolean | undefined> = {
    chat_especialistas: plan?.has_team_chat,
    recursos_adicionales: plan?.has_catalog,
    reportes_financieros: plan?.has_financial_reports,
    pagos: plan?.has_financial_reports,
  }
  const guardado = (k: string) => (done === k ? t('vanty.control.saved') : null)

  return (
    <>
      {/* Prueba y estado */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{L('Trial and status', 'Prueba y estado')}</h3>
          <Badge kind={centro.status}>{t(`vanty.control.status.${centro.status}`)}</Badge>
        </div>
        <p className="mt-1 text-sm text-v-muted">
          {centro.status === 'trial'
            ? restantes != null && restantes > 0
              ? L(`${restantes} day(s) of trial left`, `Le quedan ${restantes} día(s) de prueba`)
              : L('The trial has ended', 'La prueba terminó')
            : L('Not in trial', 'No está en prueba')}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="w-32"><Field type="number" min={0} max={365} value={dias} onChange={e => setDias(Math.max(0, Math.min(365, Number(e.target.value) || 0)))} label={L('Days left', 'Días restantes')} /></div>
          <Button onClick={() => run('trial', 'set_trial_days', { days: dias })} disabled={busy === 'trial'}>{guardado('trial') ?? L('Set', 'Fijar')}</Button>
          {[7, 14, 30].map(d => (
            <Button key={d} variant="secondary" onClick={() => { setDias(d); run('trial', 'set_trial_days', { days: d }) }} disabled={busy === 'trial'}>{d} {L('days', 'días')}</Button>
          ))}
          <Button variant="secondary" onClick={() => { setDias(0); run('trial', 'set_trial_days', { days: 0 }) }} disabled={busy === 'trial'}>{L('End trial', 'Terminar prueba')}</Button>
        </div>
        <div className="mt-4 border-t border-v-border pt-4">
          {centro.status === 'suspended' ? (
            <Button onClick={() => run('status', 'set_centro_status', { status: 'active' })} disabled={busy === 'status'}>{t('vanty.control.centros.reactivate')}</Button>
          ) : (
            <Button variant="danger" disabled={busy === 'status'}
              onClick={async () => { if (await confirmar(t('vanty.control.centros.suspendConfirm', { name: centro.name }))) run('status', 'set_centro_status', { status: 'suspended' }) }}>
              {t('vanty.control.centros.suspend')}
            </Button>
          )}
        </div>
      </Card>

      {/* Zona de peligro: eliminar el centro con toda su información */}
      <Card>
        <h3 className="font-semibold text-v-danger">{L('Danger zone', 'Zona de peligro')}</h3>
        <p className="mt-1 text-sm text-v-muted">
          {L('Deletes the center, its patients, sessions, payments, files and the accounts (emails) of its team and families. This cannot be undone.',
            'Borra el centro, sus pacientes, sesiones, pagos, archivos y las cuentas (correos) de su equipo y sus familias. No se puede deshacer.')}
        </p>
        {!borrar ? (
          <div className="mt-4"><Button variant="danger" onClick={() => { setBorrar(true); setNombreConfirma('') }}>{L('Delete center', 'Eliminar centro')}</Button></div>
        ) : (
          <div className="mt-4 space-y-3">
            <Field value={nombreConfirma} onChange={e => setNombreConfirma(e.target.value)} autoComplete="off"
              label={L(`Type "${centro.name}" to confirm`, `Escribe "${centro.name}" para confirmar`)} />
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" disabled={busy === 'delete' || nombreConfirma.trim() !== centro.name.trim()}
                onClick={async () => {
                  if (!(await confirmar(L(`Delete ${centro.name} and all its information permanently?`, `¿Eliminar ${centro.name} y toda su información para siempre?`),
                    { titulo: L('Delete center', 'Eliminar centro'), confirmar: L('Delete', 'Eliminar'), peligro: true }))) return
                  run('delete', 'delete_centro', { confirm_name: nombreConfirma.trim() })
                }}>
                {busy === 'delete' ? L('Deleting…', 'Eliminando…') : L('Delete permanently', 'Eliminar definitivamente')}
              </Button>
              <Button variant="secondary" disabled={busy === 'delete'} onClick={() => setBorrar(false)}>{L('Cancel', 'Cancelar')}</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Plan */}
      <Card>
        <h3 className="font-semibold">{L('Plan', 'Plan')}</h3>
        <p className="mt-1 text-xs text-v-muted">{L('Changes the plan without recording a payment (courtesy or correction).', 'Cambia el plan sin registrar un pago (cortesía o corrección).')}</p>
        <div className="mt-3 flex gap-2">
          <select value={planId} onChange={e => setPlanId(e.target.value)} className="h-10 min-w-0 flex-1 rounded-v-sm border border-v-border bg-v-bg px-3 text-[15px]">
            {plans.map(p => <option key={p.id} value={p.id}>{p.name_es}{p.is_active ? '' : L(' (hidden)', ' (oculto)')}</option>)}
          </select>
          <Button onClick={() => run('plan', 'set_centro_plan', { plan_id: planId })} disabled={busy === 'plan' || planId === centro.plan_id}>{guardado('plan') ?? L('Change', 'Cambiar')}</Button>
        </div>
      </Card>

      {/* Límites propios */}
      <Card>
        <h3 className="font-semibold">{L('Limits for this center', 'Límites de este centro')}</h3>
        <p className="mt-1 text-xs text-v-muted">{L('Empty = uses the plan value. Only this center is affected.', 'Vacío = usa el valor del plan. Solo afecta a este centro.')}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {LIMITES.map(l => {
            const delPlan = plan?.[l.key as keyof typeof plan] as number | null | undefined
            return (
              <Field key={l.key} type="number" min={0} label={L(l.en, l.es)} value={limites[l.key] ?? ''}
                placeholder={delPlan != null ? L(`Plan: ${delPlan}`, `Plan: ${delPlan}`) : L('No limit', 'Sin límite')}
                onChange={e => setLimites(s => ({ ...s, [l.key]: e.target.value }))}
                hint={L(`In use: ${usoDe[l.key]}`, `En uso: ${usoDe[l.key]}`)} />
            )
          })}
        </div>
        <Button className="mt-4 w-full" onClick={() => run('limites', 'set_centro_limits', { limites })} disabled={busy === 'limites'}>
          {guardado('limites') ?? L('Save limits', 'Guardar límites')}
        </Button>
      </Card>

      {/* Funciones */}
      <Card>
        <h3 className="font-semibold">{L('Features', 'Funciones')}</h3>
        <p className="mt-1 text-xs text-v-muted">{L('Turn modules on or off for this center only.', 'Enciende o apaga módulos solo para este centro.')}</p>
        <div className="mt-3 divide-y divide-v-border">
          {MODULES.map(m => {
            const bloqueadoPorPlan = planGate[m] === false
            return (
              <div key={m} className={bloqueadoPorPlan ? 'opacity-60' : ''}>
                <Switch checked={!bloqueadoPorPlan && features[m] !== false} onChange={v => !bloqueadoPorPlan && setFeatures(f => ({ ...f, [m]: v }))}
                  label={`${t(`vanty.control.modules.${m}`)}${bloqueadoPorPlan ? L(' · not in plan', ' · no incluido en el plan') : ''}`} />
              </div>
            )
          })}
        </div>
        <Button className="mt-4 w-full" onClick={() => run('features', 'set_centro_features', { features })} disabled={busy === 'features'}>
          {guardado('features') ?? L('Save features', 'Guardar funciones')}
        </Button>
      </Card>

      {/* Compras de tokens */}
      <Card>
        <h3 className="font-semibold">{L('Token purchases', 'Compras de tokens')}</h3>
        <p className="mt-1 text-xs text-v-muted">
          {L(`Predictive analyses: ${centro.ai.predictive.used} used this month · ${centro.ai.predictive.extra} bought left`, `Análisis predictivos: ${centro.ai.predictive.used} usados este mes · ${centro.ai.predictive.extra} comprados disponibles`)}
        </p>
        <ul className="mt-3 divide-y divide-v-border text-sm">
          {compras.map(c => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{c.tokens} token(s) · US$ {Number(c.precio_usd).toFixed(2)}</span>
                <span className="block text-xs text-v-muted">
                  {c.kind === 'padre_aria' ? L('Family · ARIA messages', 'Familia · mensajes de ARIA')
                    : c.kind === 'padre_practica' ? L('Family · practice plans', 'Familia · planes de práctica')
                    : L('Center · analyses', 'Centro · análisis')}
                  {c.familia && ` · ${c.familia.full_name || c.familia.email || ''}`}
                </span>
                <span className="block text-xs text-v-subtle">{new Date(c.created_at).toLocaleString(locale === 'en' ? 'en-US' : 'es-PE', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </span>
              {c.estado === 'pendiente' ? (
                <>
                  <Button className="h-8 px-3 text-xs" disabled={busy === c.id} onClick={async () => {
                    setBusy(c.id)
                    try { await callControl('confirm_compra_tokens', { id: c.id }); cargarCompras(); onChanged() } catch (e) { onError(e) } finally { setBusy(null) }
                  }}>{L('Confirm payment', 'Confirmar pago')}</Button>
                  <Button variant="secondary" className="h-8 px-3 text-xs" disabled={busy === c.id} onClick={async () => {
                    setBusy(c.id)
                    try { await callControl('cancel_compra_tokens', { id: c.id }); cargarCompras() } catch (e) { onError(e) } finally { setBusy(null) }
                  }}>{L('Cancel', 'Cancelar')}</Button>
                </>
              ) : (
                <Badge kind={c.estado === 'pagada' ? 'active' : 'bajo'}>{c.estado === 'pagada' ? L('Paid', 'Pagada') : L('Cancelled', 'Cancelada')}</Badge>
              )}
            </li>
          ))}
          {compras.length === 0 && <li className="py-3 text-v-muted">{L('No purchases yet', 'Sin compras todavía')}</li>}
        </ul>
      </Card>
    </>
  )
}
