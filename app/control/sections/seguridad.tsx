'use client'
// Seguridad de la plataforma: indicadores, eventos agrupados por día y registro de auditoría encadenado.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ShieldCheck, ShieldAlert, CheckCircle2, KeyRound, Lock, UserX, AlertTriangle, Activity, Link2, Loader2,
  Mail, Globe, Clock, CheckCheck, type LucideIcon,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { callControl, type AuditEntry, type SecurityEvent } from '../api'
import { SectionTitle } from '../ui'

const LEVELS = ['', 'critico', 'alto', 'medio', 'bajo'] as const
const NIVEL: Record<SecurityEvent['nivel'], { chip: string; icono: string; punto: string }> = {
  critico: { chip: 'bg-v-danger/15 text-v-danger', icono: 'bg-v-danger/15 text-v-danger', punto: 'bg-v-danger' },
  alto: { chip: 'bg-orange-500/15 text-orange-600', icono: 'bg-orange-500/15 text-orange-600', punto: 'bg-orange-500' },
  medio: { chip: 'bg-v-warning/15 text-v-warning', icono: 'bg-v-warning/15 text-v-warning', punto: 'bg-v-warning' },
  bajo: { chip: 'bg-v-fill text-v-muted', icono: 'bg-v-fill text-v-muted', punto: 'bg-v-subtle' },
}
function iconoTipo(tipo: string): LucideIcon {
  if (tipo.includes('login')) return KeyRound
  if (tipo.includes('blocked') || tipo.includes('lock')) return Lock
  if (tipo.includes('mfa')) return ShieldAlert
  if (tipo.includes('denied') || tipo.includes('forbidden')) return UserX
  return AlertTriangle
}

export function SeguridadSection({ onError }: { onError: (e: unknown) => void }) {
  const { t, locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [vista, setVista] = useState<'eventos' | 'auditoria'>('eventos')
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [abiertos, setAbiertos] = useState<SecurityEvent[]>([])
  const [unresolved, setUnresolved] = useState(true)
  const [nivel, setNivel] = useState<(typeof LEVELS)[number]>('')
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [integrity, setIntegrity] = useState<{ checked: number; first_broken_seq: number | null } | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [resolviendo, setResolviendo] = useState(false)

  const fmtHora = (s: string) => new Date(s).toLocaleTimeString(en ? 'en-US' : 'es-PE', { hour: '2-digit', minute: '2-digit' })
  const fmtFecha = (s: string) => new Date(s).toLocaleString(en ? 'en-US' : 'es-PE', { dateStyle: 'medium', timeStyle: 'short' })

  const loadEvents = useCallback(() => {
    callControl<{ events: SecurityEvent[] }>('security_events', { unresolved, nivel }).then(r => setEvents(r.events)).catch(onError)
  }, [unresolved, nivel, onError])
  const loadAbiertos = useCallback(() => {
    callControl<{ events: SecurityEvent[] }>('security_events', { unresolved: true, nivel: '' }).then(r => setAbiertos(r.events)).catch(onError)
  }, [onError])

  useEffect(() => { loadEvents() }, [loadEvents])
  useEffect(() => { loadAbiertos() }, [loadAbiertos])
  useEffect(() => {
    callControl<{ entries: AuditEntry[] }>('audit_log').then(r => setAudit(r.entries)).catch(onError)
  }, [onError])

  async function resolve(id: string) {
    try {
      await callControl('resolve_event', { id })
      setEvents(list => (unresolved ? list.filter(e => e.id !== id) : list.map(e => (e.id === id ? { ...e, resuelto: true } : e))))
      setAbiertos(list => list.filter(e => e.id !== id))
    } catch (e) { onError(e) }
  }
  async function resolverVisibles() {
    setResolviendo(true)
    try {
      for (const e of events.filter(x => !x.resuelto)) await callControl('resolve_event', { id: e.id })
      loadEvents(); loadAbiertos()
    } catch (e) { onError(e) } finally { setResolviendo(false) }
  }
  async function verify() {
    setVerifying(true)
    try { setIntegrity(await callControl<{ checked: number; first_broken_seq: number | null }>('audit_verify')) }
    catch (e) { onError(e) } finally { setVerifying(false) }
  }

  // Indicadores
  const hace24 = Date.now() - 86_400_000
  const graves = abiertos.filter(e => e.nivel === 'critico' || e.nivel === 'alto').length
  const fallidos24 = abiertos.filter(e => e.tipo.includes('login_failed') && new Date(e.timestamp).getTime() > hace24).length

  // Eventos agrupados por día
  const grupos = useMemo(() => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1)
    const m = new Map<string, SecurityEvent[]>()
    for (const e of events) {
      const d = new Date(e.timestamp); d.setHours(0, 0, 0, 0)
      const k = d.getTime() === hoy.getTime() ? L('Today', 'Hoy') : d.getTime() === ayer.getTime() ? L('Yesterday', 'Ayer')
        : d.toLocaleDateString(en ? 'en-US' : 'es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
      m.set(k, [...(m.get(k) ?? []), e])
    }
    return [...m.entries()]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, en])

  const indicadores: { Icon: LucideIcon; t: string; v: string | number; tono: string; onClick?: () => void }[] = [
    { Icon: ShieldAlert, t: L('Open events', 'Eventos abiertos'), v: abiertos.length, tono: abiertos.length ? 'bg-v-warning/15 text-v-warning' : 'bg-v-success/15 text-v-success' },
    { Icon: AlertTriangle, t: L('Critical or high', 'Críticos o altos'), v: graves, tono: graves ? 'bg-v-danger/15 text-v-danger' : 'bg-v-success/15 text-v-success' },
    { Icon: KeyRound, t: L('Failed logins (24 h)', 'Accesos fallidos (24 h)'), v: fallidos24, tono: 'bg-v-accent-soft text-v-accent' },
    {
      Icon: integrity ? (integrity.first_broken_seq == null ? ShieldCheck : ShieldAlert) : Link2,
      t: L('Audit log', 'Auditoría'),
      v: integrity ? (integrity.first_broken_seq == null ? L('Intact', 'Íntegra') : L('Broken', 'Alterada')) : L('Verify', 'Verificar'),
      tono: integrity ? (integrity.first_broken_seq == null ? 'bg-v-success/15 text-v-success' : 'bg-v-danger/15 text-v-danger') : 'bg-v-fill text-v-muted',
      onClick: () => { setVista('auditoria'); if (!integrity) verify() },
    },
  ]

  return (
    <div>
      <SectionTitle title={L('Security', 'Seguridad')} subtitle={t('vanty.control.security.eventsSubtitle')} />

      {/* Indicadores */}
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
        {indicadores.map((x, i) => (
          <motion.button key={x.t} type="button" onClick={x.onClick} disabled={!x.onClick}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={x.onClick ? { y: -2 } : undefined}
            className="flex items-center gap-3 rounded-[20px] border border-v-border bg-v-elevated p-4 text-left shadow-v disabled:cursor-default">
            <span className={`grid size-11 shrink-0 place-items-center rounded-[14px] ${x.tono}`}><x.Icon size={20} /></span>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none tabular-nums">{x.v}</p>
              <p className="mt-1 truncate text-xs text-v-muted">{x.t}</p>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Pestañas */}
      <div className="mt-6 inline-grid grid-cols-[repeat(2,minmax(0,1fr))] rounded-full bg-v-fill p-1">
        {([['eventos', L('Events', 'Eventos'), Activity], ['auditoria', L('Audit log', 'Auditoría'), Link2]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setVista(k)} className={`relative flex h-9 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold transition-colors ${vista === k ? 'text-v-text' : 'text-v-muted'}`}>
            {vista === k && <motion.span layoutId="seg-tab" className="absolute inset-0 rounded-full bg-v-elevated shadow-v" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <span className="relative flex items-center gap-1.5"><Icon size={15} /> {label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {vista === 'eventos' ? (
          <motion.section key="eventos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 rounded-[24px] border border-v-border bg-v-elevated shadow-v">
            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-2 border-b border-v-border p-4">
              <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] rounded-full bg-v-fill p-0.5 text-xs font-semibold">
                {[true, false].map(v => (
                  <button key={String(v)} onClick={() => setUnresolved(v)} className={`rounded-full px-3 py-1.5 ${unresolved === v ? 'bg-v-elevated text-v-text shadow-v' : 'text-v-muted'}`}>
                    {v ? L('Open', 'Abiertos') : L('All', 'Todos')}
                  </button>
                ))}
              </div>
              <span className="mx-1 h-5 w-px bg-v-border" />
              {LEVELS.map(l => (
                <button key={l || 'any'} onClick={() => setNivel(l)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${nivel === l ? 'border-v-accent/40 bg-v-accent-soft text-v-accent' : 'border-v-border text-v-muted hover:bg-v-fill'}`}>
                  {l && <span className={`size-2 rounded-full ${NIVEL[l].punto}`} />}
                  {l ? t(`vanty.control.levels.${l}`) : L('All levels', 'Todos los niveles')}
                </button>
              ))}
              {events.some(e => !e.resuelto) && (
                <button onClick={resolverVisibles} disabled={resolviendo}
                  className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full border border-v-border px-3 text-xs font-semibold text-v-text hover:bg-v-fill disabled:opacity-60">
                  {resolviendo ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={14} />} {L('Resolve all shown', 'Resolver los visibles')}
                </button>
              )}
            </div>

            {/* Lista por día */}
            {events.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-center">
                <span className="grid size-14 place-items-center rounded-full bg-v-success/15 text-v-success"><ShieldCheck size={26} /></span>
                <p className="mt-3 font-semibold">{L('No events', 'Sin eventos')}</p>
                <p className="text-sm text-v-muted">{t('vanty.control.security.noEvents')}</p>
              </div>
            ) : (
              <div className="p-2 sm:p-3">
                {grupos.map(([dia, lista]) => (
                  <div key={dia} className="mb-2">
                    <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-v-subtle first-letter:uppercase">{dia}</p>
                    <AnimatePresence initial={false}>
                      {lista.map(e => {
                        const Icon = iconoTipo(e.tipo)
                        const email = typeof e.metadata?.email === 'string' ? e.metadata.email : null
                        return (
                          <motion.div key={e.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                            className="group flex items-center gap-3 rounded-[16px] px-3 py-3 transition-colors hover:bg-v-bg">
                            <span className={`grid size-10 shrink-0 place-items-center rounded-[12px] ${NIVEL[e.nivel].icono}`}><Icon size={17} /></span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold">{e.descripcion}</p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${NIVEL[e.nivel].chip}`}>{t(`vanty.control.levels.${e.nivel}`)}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-v-muted">
                                {email && <span className="inline-flex items-center gap-1"><Mail size={11} /> {email}</span>}
                                {e.ip_address && <span className="inline-flex items-center gap-1"><Globe size={11} /> {e.ip_address === '::1' ? L('Local', 'Local') : e.ip_address}</span>}
                                <span className="inline-flex items-center gap-1"><Clock size={11} /> {fmtHora(e.timestamp)}</span>
                                <span className="font-mono text-v-subtle">{e.tipo}</span>
                              </div>
                            </div>
                            {e.resuelto ? (
                              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-v-success"><CheckCircle2 size={15} /> {L('Resolved', 'Resuelto')}</span>
                            ) : (
                              <button onClick={() => resolve(e.id)}
                                className="shrink-0 rounded-full border border-v-border px-3 py-1.5 text-xs font-semibold text-v-text transition-colors hover:border-v-success/40 hover:bg-v-success/10 hover:text-v-success">
                                {t('vanty.control.security.resolve')}
                              </button>
                            )}
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </motion.section>
        ) : (
          <motion.section key="auditoria" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 rounded-[24px] border border-v-border bg-v-elevated shadow-v">
            <div className="flex flex-wrap items-center gap-3 border-b border-v-border p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t('vanty.control.security.auditTitle')}</p>
                <p className="text-xs text-v-muted">{t('vanty.control.security.auditSubtitle')}</p>
              </div>
              {integrity && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${integrity.first_broken_seq == null ? 'bg-v-success/15 text-v-success' : 'bg-v-danger/15 text-v-danger'}`}>
                  {integrity.first_broken_seq == null ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                  {integrity.first_broken_seq == null
                    ? t('vanty.control.security.intact', { n: String(integrity.checked) })
                    : t('vanty.control.security.broken', { seq: String(integrity.first_broken_seq) })}
                </span>
              )}
              <button onClick={verify} disabled={verifying}
                className="v-brand inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold disabled:opacity-60">
                {verifying ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                {verifying ? t('vanty.control.security.verifying') : t('vanty.control.security.verify')}
              </button>
            </div>
            {audit.length === 0 ? (
              <p className="p-10 text-center text-sm text-v-muted">{t('vanty.control.security.noAudit')}</p>
            ) : (
              <ol className="relative p-4 pl-6">
                <span aria-hidden className="absolute bottom-6 left-[34px] top-6 w-px bg-v-border" />
                {audit.map(a => (
                  <li key={a.seq} className="relative flex gap-4 py-2.5">
                    <span className={`relative z-[1] mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-4 ring-v-elevated ${a.success ? 'bg-v-accent-soft text-v-accent' : 'bg-v-danger/15 text-v-danger'}`}>
                      <span className={`size-1.5 rounded-full ${a.success ? 'bg-v-accent' : 'bg-v-danger'}`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${a.success ? '' : 'text-v-danger'}`}>{a.description ?? `${a.action} ${a.resource_type ?? ''}`}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-v-muted">
                        <span>{fmtFecha(a.created_at)}</span>
                        <span>{a.user_email ?? '—'}{a.user_role ? ` · ${a.user_role}` : ''}</span>
                        <span className="font-mono text-v-subtle">#{a.seq} · {a.hash?.slice(0, 8)}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
