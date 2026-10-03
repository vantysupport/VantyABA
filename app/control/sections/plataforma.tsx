'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { callControl, type PlatformSettings } from '../api'
import { Button, Card, Field, SectionTitle, Switch, useDate } from '../ui'
import { confirmar } from '@/components/ui/confirmar'
import { supabase } from '@/lib/supabase'

export const MODULES = ['agenda', 'ninos', 'inteligencia', 'cerebro', 'pagos', 'reportes_financieros', 'recursos_adicionales', 'chat_especialistas'] as const

export function PlataformaSection({ onError }: { onError: (e: unknown) => void }) {
  const { t, locale } = useI18n()
  const [s, setS] = useState<PlatformSettings | null>(null)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [sync, setSync] = useState<{ cargando: boolean; texto?: string; error?: boolean }>({ cargando: false })
  const [subida, setSubida] = useState<{ cargando: boolean; texto?: string; error?: boolean }>({ cargando: false })

  // Trae de Lemon Squeezy los IDs de variante de los planes (por región y ciclo) y de los créditos de IA.
  async function sincronizarLemon() {
    setSync({ cargando: true })
    try {
      const r = await callControl<{ resumen: Record<string, Record<string, Record<string, string>>>; tokens: string | null; faltan: string[]; total: number }>('lemon_sync_variantes')
      const planes = Object.entries(r.resumen).map(([plan, regs]) => `${plan}: ${Object.values(regs).reduce((n, c) => n + Object.keys(c).length, 0)}/6`).join(' · ')
      if (r.tokens) setS(x => (x ? { ...x, lemon_variant_tokens: r.tokens } : x))
      setSync({ cargando: false, error: r.faltan.length > 0,
        texto: (locale === 'en' ? `${r.total} variants found. ${planes}. Tokens: ${r.tokens ?? '—'}.` : `${r.total} variantes encontradas. ${planes}. Tokens: ${r.tokens ?? '—'}.`)
          + (r.faltan.length ? (locale === 'en' ? ` Missing: ${r.faltan.join(', ')}.` : ` Faltan: ${r.faltan.join(', ')}.`) : '') })
    } catch (e) {
      setSync({ cargando: false, error: true, texto: (locale === 'en' ? 'Could not read Lemon Squeezy: ' : 'No se pudo leer Lemon Squeezy: ') + (e instanceof Error ? e.message : '') })
    }
  }

  useEffect(() => {
    callControl<{ settings: PlatformSettings }>('get_settings').then(r => setS(r.settings)).catch(onError)
  }, [onError])

  if (!s) return null
  const app = s.app_android ?? {}
  const en = locale === 'en'

  // Sube el APK directo a Storage (bucket público "app") y deja su enlace en la versión
  async function subirApk(f: File | undefined) {
    if (!f || !s) return
    if (!f.name.toLowerCase().endsWith('.apk')) { setSubida({ cargando: false, error: true, texto: en ? 'Choose an .apk file' : 'Elige un archivo .apk' }); return }
    setSubida({ cargando: true, texto: en ? 'Uploading…' : 'Subiendo…' })
    try {
      const r = await callControl<{ path: string; token: string; url: string }>('app_apk_subida', { version_code: app.version_code || 1 })
      const { error } = await supabase.storage.from('app').uploadToSignedUrl(r.path, r.token, f, { contentType: 'application/vnd.android.package-archive' })
      if (error) throw error
      setS(x => (x ? { ...x, app_android: { ...(x.app_android ?? {}), url_apk: r.url } } : x))
      setState('idle')
      setSubida({ cargando: false, texto: en ? 'Uploaded. Remember to save.' : 'Subido. No olvides guardar.' })
    } catch (e) {
      setSubida({ cargando: false, error: true, texto: (en ? 'Could not upload: ' : 'No se pudo subir: ') + (e instanceof Error ? e.message : '') })
    }
  }

  const update = (patch: Partial<PlatformSettings>) => {
    setS({ ...s, ...patch })
    setState('idle')
  }

  async function save() {
    if (!s) return
    setState('saving')
    try {
      await callControl('set_settings', { settings: s })
      setState('saved')
    } catch (e) {
      setState('idle')
      onError(e)
    }
  }

  return (
    <div>
      <SectionTitle
        title={t('vanty.control.platform.title')}
        subtitle={t('vanty.control.platform.subtitle')}
        action={<Button onClick={save} disabled={state === 'saving'}>{state === 'saved' ? t('vanty.control.saved') : t('vanty.control.save')}</Button>}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="font-semibold">{t('vanty.control.platform.maintenance')}</h3>
          <Switch checked={s.maintenance} onChange={v => update({ maintenance: v })} label={t('vanty.control.platform.maintenanceOn')} />
          <div className="mt-3"><Field label={t('vanty.control.platform.maintenanceMsg')} value={s.maintenance_msg ?? ''} onChange={e => update({ maintenance_msg: e.target.value })} /></div>
        </Card>
        <Card>
          <h3 className="font-semibold">{t('vanty.control.platform.accessTitle')}</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field type="number" min={0} max={90} label={t('vanty.control.platform.trialDays')} value={s.trial_days} onChange={e => update({ trial_days: Number(e.target.value) })} />
            <Field type="number" min={3} max={20} label={t('vanty.control.platform.maxFailures')} value={s.login_max_failures} onChange={e => update({ login_max_failures: Number(e.target.value) })} />
            <Field type="number" min={1} max={1440} label={t('vanty.control.platform.lockoutMinutes')} value={s.login_lockout_minutes} onChange={e => update({ login_lockout_minutes: Number(e.target.value) })} />
          </div>
          <p className="mt-3 text-xs text-v-muted">{t('vanty.control.platform.lockoutHint')}</p>
        </Card>
        <Card className="md:col-span-2">
          <h3 className="font-semibold">{locale === 'en' ? 'Predictive-analysis token packs' : 'Paquetes de tokens de análisis predictivo'}</h3>
          <p className="mt-1 text-xs text-v-muted">{locale === 'en' ? 'What centers see when they buy extra tokens (USD).' : 'Lo que ven los centros al comprar tokens extra (en dólares).'}</p>
          <div className="mt-3 rounded-v-sm border border-v-border bg-v-bg p-3">
            <p className="text-xs text-v-muted">{locale === 'en'
              ? 'Fetch the variant IDs of the plans (by region and cycle) and of the AI credits from Lemon Squeezy, matched by name: "Plan mensual/anual" (Latin America), "Monthly/Annual plan" (North America), "Cuota mensual/anual" (Europe).'
              : 'Trae de Lemon Squeezy los IDs de variante de los planes (por región y ciclo) y de los créditos de IA, asociados por nombre: "Plan mensual/anual" (Latinoamérica), "Monthly/Annual plan" (Norteamérica), "Cuota mensual/anual" (Europa).'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={sincronizarLemon} disabled={sync.cargando}>
                {sync.cargando ? (locale === 'en' ? 'Fetching…' : 'Trayendo…') : (locale === 'en' ? 'Fetch IDs from Lemon Squeezy' : 'Traer IDs desde Lemon Squeezy')}
              </Button>
              {sync.texto && <span className={`text-xs ${sync.error ? 'text-v-danger' : 'text-v-success'}`}>{sync.texto}</span>}
            </div>
          </div>
          <div className="mt-3 max-w-xs">
            <Field inputMode="numeric" placeholder="123458" label={locale === 'en' ? 'Lemon Squeezy variant ID (token packs)' : 'ID de variante en Lemon Squeezy (paquetes de tokens)'}
              value={s.lemon_variant_tokens ?? ''} onChange={e => update({ lemon_variant_tokens: e.target.value.replace(/\D/g, '') || null })} />
          </div>
          <div className="mt-3 space-y-2">
            {(s.token_packs ?? []).map((pk, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1"><Field type="number" min={1} label={locale === 'en' ? 'Tokens' : 'Tokens'} value={pk.tokens}
                  onChange={e => update({ token_packs: s.token_packs.map((x, j) => (j === i ? { ...x, tokens: Number(e.target.value) } : x)) })} /></div>
                <div className="flex-1"><Field type="number" min={0} step="0.01" label={locale === 'en' ? 'Price (USD)' : 'Precio (US$)'} value={pk.usd}
                  onChange={e => update({ token_packs: s.token_packs.map((x, j) => (j === i ? { ...x, usd: Number(e.target.value) } : x)) })} /></div>
                <Button variant="secondary" onClick={() => update({ token_packs: s.token_packs.filter((_, j) => j !== i) })}>{locale === 'en' ? 'Remove' : 'Quitar'}</Button>
              </div>
            ))}
            {(s.token_packs ?? []).length < 6 && (
              <Button variant="secondary" onClick={() => update({ token_packs: [...(s.token_packs ?? []), { tokens: 10, usd: 2 }] })}>{locale === 'en' ? 'Add pack' : 'Agregar paquete'}</Button>
            )}
          </div>
        </Card>
        <Card className="md:col-span-2">
          <h3 className="font-semibold">{en ? 'Android app' : 'App de Android'}</h3>
          <p className="mt-1 text-xs text-v-muted">{en
            ? 'Latest published version. Anyone with an older one sees a notice with these notes and a button to update (the Google Play store if they installed it from there, otherwise the APK below). After updating, the notes are shown once as "What\'s new".'
            : 'Última versión publicada. Quien tenga una más antigua verá un aviso con estas notas y un botón para actualizar (Google Play si la instaló desde ahí; si no, el APK de abajo). Después de actualizar, las notas se muestran una vez como "Novedades".'}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field type="number" min={1} label={en ? 'Version code (versionCode)' : 'Número de versión (versionCode)'} value={app.version_code ?? ''}
              onChange={e => update({ app_android: { ...app, version_code: Number(e.target.value) } })} />
            <Field placeholder="1.0.1" label={en ? 'Version name (versionName)' : 'Nombre de versión (versionName)'} value={app.version_name ?? ''}
              onChange={e => update({ app_android: { ...app, version_name: e.target.value } })} />
          </div>
          <label className="mt-3 block">
            <span className="text-xs font-semibold text-v-muted">{en ? 'Release notes (one per line)' : 'Notas de la versión (una por línea)'}</span>
            <textarea rows={4} maxLength={1500} value={app.notas ?? ''} onChange={e => update({ app_android: { ...app, notas: e.target.value } })}
              placeholder={en ? 'New agenda widget\nFaster loading' : 'Nuevo widget de agenda\nCarga más rápida'}
              className="mt-1 w-full rounded-v-sm border border-v-border bg-v-bg px-3 py-2 text-sm text-v-text outline-none focus:border-v-accent" />
          </label>
          <div className="mt-3">
            <Field placeholder="https://…/vanty-aba.apk" label={en ? 'APK link' : 'Enlace del APK'} value={app.url_apk ?? ''}
              onChange={e => update({ app_android: { ...app, url_apk: e.target.value } })} />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className={`inline-flex cursor-pointer items-center rounded-full border border-v-border px-4 py-2 text-sm font-semibold text-v-text hover:bg-v-fill ${subida.cargando ? 'pointer-events-none opacity-60' : ''}`}>
                {en ? 'Upload APK…' : 'Subir APK…'}
                <input type="file" accept=".apk,application/vnd.android.package-archive" className="hidden" onChange={e => { subirApk(e.target.files?.[0]); e.target.value = '' }} />
              </label>
              {subida.texto && <span className={`text-xs ${subida.error ? 'text-v-danger' : 'text-v-success'}`}>{subida.texto}</span>}
            </div>
          </div>
          <Switch checked={!!app.obligatoria} onChange={v => update({ app_android: { ...app, obligatoria: v } })}
            label={en ? 'Required update (no "Later" button)' : 'Actualización obligatoria (sin botón "Más tarde")'} />
        </Card>
        <Card className="md:col-span-2">
          <h3 className="font-semibold">{t('vanty.control.platform.modules')}</h3>
          <p className="mt-1 text-xs text-v-muted">{t('vanty.control.platform.modulesHint')}</p>
          <div className="mt-3 grid gap-x-8 divide-y divide-v-border md:grid-cols-2 md:divide-y-0">
            {MODULES.map(m => (
              <Switch
                key={m}
                checked={s.features?.[m] !== false}
                onChange={v => update({ features: { ...s.features, [m]: v } })}
                label={t(`vanty.control.modules.${m}`)}
              />
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
