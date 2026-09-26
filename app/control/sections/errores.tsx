'use client'
// Errores de la plataforma: indicadores, filtros por fuente, búsqueda y errores repetidos agrupados.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Bug, Clock, Layers, MonitorSmartphone, Search, Trash2, ChevronDown, Sparkles, Globe, Zap, Atom, AlertCircle, CheckCircle2, User, type LucideIcon } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { confirmar } from '@/components/ui/confirmar'
import { callControl } from '../api'
import { SectionTitle } from '../ui'

type ErrLog = { id: string; message: string | null; detail: string | null; source: string | null; url: string | null; user_email: string | null; created_at: string }
type Grupo = { clave: string; mensaje: string; fuente: string; items: ErrLog[]; ultimo: string; primero: string; urls: string[]; usuarios: string[] }

const FUENTES: Record<string, { es: string; en: string; Icon: LucideIcon; tono: string }> = {
  groq: { es: 'IA (Groq)', en: 'AI (Groq)', Icon: Sparkles, tono: 'bg-violet-500/15 text-violet-600' },
  window: { es: 'Página', en: 'Page', Icon: Globe, tono: 'bg-v-danger/15 text-v-danger' },
  promise: { es: 'Promesa', en: 'Promise', Icon: Zap, tono: 'bg-v-warning/15 text-v-warning' },
  'react-boundary': { es: 'React', en: 'React', Icon: Atom, tono: 'bg-v-accent-soft text-v-accent' },
}
const fuenteDe = (s: string | null) => (s && FUENTES[s] ? s : 'otro')
const infoFuente = (f: string) => FUENTES[f] ?? { es: 'Otro', en: 'Other', Icon: AlertCircle, tono: 'bg-v-fill text-v-muted' }
// Agrupa mensajes iguales ignorando números variables (segundos, ids, etc.)
const normalizar = (m: string) => m.replace(/\d+/g, '#').trim()
const ruta = (u: string | null) => { if (!u) return null; try { return new URL(u).pathname } catch { return u } }

export function ErroresSection({ onError }: { onError: (e: unknown) => void }) {
  const { t, locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [errors, setErrors] = useState<ErrLog[]>([])
  const [cargando, setCargando] = useState(true)
  const [fuente, setFuente] = useState<string>('')
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)

  const load = useCallback(() => {
    setCargando(true)
    callControl<{ errors: ErrLog[] }>('get_errors').then(r => setErrors(r.errors)).catch(onError).finally(() => setCargando(false))
  }, [onError])
  useEffect(() => { load() }, [load])

  const hace = (s: string) => {
    const min = Math.round((Date.now() - new Date(s).getTime()) / 60000)
    if (min < 1) return L('just now', 'ahora')
    if (min < 60) return L(`${min} min ago`, `hace ${min} min`)
    const h = Math.round(min / 60)
    if (h < 24) return L(`${h} h ago`, `hace ${h} h`)
    const d = Math.round(h / 24)
    return L(`${d} d ago`, `hace ${d} d`)
  }

  const conteoFuente = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of errors) { const f = fuenteDe(e.source); m[f] = (m[f] ?? 0) + 1 }
    return m
  }, [errors])

  const grupos = useMemo(() => {
    const txt = q.trim().toLowerCase()
    const m = new Map<string, Grupo>()
    for (const e of errors) {
      const f = fuenteDe(e.source)
      if (fuente && f !== fuente) continue
      const mensaje = e.message || e.detail?.slice(0, 160) || L('(no message)', '(sin mensaje)')
      if (txt && !`${mensaje} ${e.url ?? ''} ${e.user_email ?? ''}`.toLowerCase().includes(txt)) continue
      const clave = `${f}|${normalizar(mensaje)}`
      const g = m.get(clave) ?? { clave, mensaje, fuente: f, items: [], ultimo: e.created_at, primero: e.created_at, urls: [], usuarios: [] }
      g.items.push(e)
      if (e.created_at > g.ultimo) g.ultimo = e.created_at
      if (e.created_at < g.primero) g.primero = e.created_at
      const r = ruta(e.url); if (r && !g.urls.includes(r)) g.urls.push(r)
      if (e.user_email && !g.usuarios.includes(e.user_email)) g.usuarios.push(e.user_email)
      m.set(clave, g)
    }
    return [...m.values()].sort((a, b) => (a.ultimo < b.ultimo ? 1 : -1))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors, fuente, q, en])

  const hace24 = Date.now() - 86_400_000
  const ultimas24 = errors.filter(e => new Date(e.created_at).getTime() > hace24).length
  const topFuente = Object.entries(conteoFuente).sort((a, b) => b[1] - a[1])[0]?.[0]
  const pantallas = new Set(errors.map(e => ruta(e.url)).filter(Boolean)).size

  async function borrarGrupo(g: Grupo) {
    if (!await confirmar(L(`Delete ${g.items.length} occurrence(s) of this error?`, `¿Borrar ${g.items.length} registro(s) de este error?`))) return
    try {
      await callControl('delete_errors', { ids: g.items.map(i => i.id) })
      const ids = new Set(g.items.map(i => i.id))
      setErrors(list => list.filter(e => !ids.has(e.id)))
    } catch (e) { onError(e) }
  }
  async function borrarTodo() {
    if (!await confirmar(t('vanty.control.errors.clearConfirm'))) return
    try { await callControl('clear_errors'); setErrors([]) } catch (e) { onError(e) }
  }

  const indicadores: { Icon: LucideIcon; t: string; v: string | number; tono: string }[] = [
    { Icon: Bug, t: L('Logged errors', 'Errores registrados'), v: errors.length, tono: errors.length ? 'bg-v-danger/15 text-v-danger' : 'bg-v-success/15 text-v-success' },
    { Icon: Clock, t: L('Last 24 h', 'Últimas 24 h'), v: ultimas24, tono: 'bg-v-warning/15 text-v-warning' },
    { Icon: Layers, t: L('Most frequent source', 'Fuente más frecuente'), v: topFuente ? (en ? infoFuente(topFuente).en : infoFuente(topFuente).es) : '—', tono: topFuente ? infoFuente(topFuente).tono : 'bg-v-fill text-v-muted' },
    { Icon: MonitorSmartphone, t: L('Affected screens', 'Pantallas afectadas'), v: pantallas, tono: 'bg-v-accent-soft text-v-accent' },
  ]

  return (
    <div>
      <SectionTitle title={t('vanty.control.errors.title')} subtitle={L('What failed in the platform, grouped so you can fix it fast.', 'Lo que falló en la plataforma, agrupado para corregirlo rápido.')}
        action={errors.length > 0 ? (
          <button onClick={borrarTodo} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-v-border bg-v-elevated px-4 text-sm font-semibold text-v-muted hover:border-v-danger/40 hover:text-v-danger">
            <Trash2 size={15} /> {t('vanty.control.errors.clear')}
          </button>
        ) : undefined} />

      {/* Indicadores */}
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
        {indicadores.map((x, i) => (
          <motion.div key={x.t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 rounded-[20px] border border-v-border bg-v-elevated p-4 shadow-v">
            <span className={`grid size-11 shrink-0 place-items-center rounded-[14px] ${x.tono}`}><x.Icon size={20} /></span>
            <div className="min-w-0">
              <p className="truncate text-2xl font-bold leading-none tabular-nums">{cargando ? '—' : x.v}</p>
              <p className="mt-1 truncate text-xs text-v-muted">{x.t}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <section className="mt-5 rounded-[24px] border border-v-border bg-v-elevated shadow-v">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 border-b border-v-border p-4">
          <button onClick={() => setFuente('')} className={`h-8 rounded-full border px-3 text-xs font-semibold ${fuente === '' ? 'border-v-accent/40 bg-v-accent-soft text-v-accent' : 'border-v-border text-v-muted hover:bg-v-fill'}`}>
            {L('All', 'Todas')} · {errors.length}
          </button>
          {Object.entries(conteoFuente).sort((a, b) => b[1] - a[1]).map(([f, n]) => {
            const inf = infoFuente(f)
            return (
              <button key={f} onClick={() => setFuente(f)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${fuente === f ? 'border-v-accent/40 bg-v-accent-soft text-v-accent' : 'border-v-border text-v-muted hover:bg-v-fill'}`}>
                <inf.Icon size={13} /> {en ? inf.en : inf.es} · {n}
              </button>
            )
          })}
          <label className="ml-auto flex h-9 min-w-[200px] items-center gap-2 rounded-full border border-v-border bg-v-bg px-3 text-sm">
            <Search size={14} className="text-v-subtle" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={L('Search error, screen or user…', 'Buscar error, pantalla o usuario…')} className="w-full bg-transparent outline-none placeholder:text-v-subtle" />
          </label>
        </div>

        {/* Lista agrupada */}
        {!cargando && grupos.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-v-success/15 text-v-success"><CheckCircle2 size={26} /></span>
            <p className="mt-3 font-semibold">{errors.length ? L('No matches', 'Sin coincidencias') : L('No errors', 'Sin errores')}</p>
            <p className="text-sm text-v-muted">{errors.length ? L('Try another filter or search.', 'Prueba con otro filtro o búsqueda.') : t('vanty.control.errors.empty')}</p>
          </div>
        ) : (
          <ul className="p-2 sm:p-3">
            {grupos.map(g => {
              const inf = infoFuente(g.fuente)
              const on = abierto === g.clave
              const ejemplo = g.items.find(i => i.detail)?.detail
              return (
                <li key={g.clave} className={`rounded-[16px] transition-colors ${on ? 'bg-v-bg' : 'hover:bg-v-bg'}`}>
                  <button onClick={() => setAbierto(on ? null : g.clave)} className="flex w-full items-center gap-3 px-3 py-3 text-left">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-[12px] ${inf.tono}`}><inf.Icon size={17} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{g.mensaje}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-v-muted">
                        <span>{en ? inf.en : inf.es}</span>
                        <span>{L('Last', 'Último')}: {hace(g.ultimo)}</span>
                        {g.urls[0] && <span className="font-mono">{g.urls[0]}{g.urls.length > 1 ? ` +${g.urls.length - 1}` : ''}</span>}
                      </p>
                    </div>
                    {g.items.length > 1 && <span className="shrink-0 rounded-full bg-v-danger/10 px-2.5 py-1 text-xs font-bold tabular-nums text-v-danger">×{g.items.length}</span>}
                    <ChevronDown size={16} className={`shrink-0 text-v-subtle transition-transform ${on ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {on && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="space-y-3 px-3 pb-4 pl-16">
                          <p className="text-sm">{g.mensaje}</p>
                          <div className="flex flex-wrap gap-2 text-[11px]">
                            <span className="rounded-full bg-v-elevated px-2.5 py-1 text-v-muted">{L('First', 'Primero')}: {new Date(g.primero).toLocaleString(en ? 'en-US' : 'es-PE')}</span>
                            <span className="rounded-full bg-v-elevated px-2.5 py-1 text-v-muted">{L('Last', 'Último')}: {new Date(g.ultimo).toLocaleString(en ? 'en-US' : 'es-PE')}</span>
                            {g.urls.map(u => <span key={u} className="inline-flex items-center gap-1 rounded-full bg-v-elevated px-2.5 py-1 font-mono text-v-muted"><MonitorSmartphone size={11} /> {u}</span>)}
                            {g.usuarios.map(u => <span key={u} className="inline-flex items-center gap-1 rounded-full bg-v-elevated px-2.5 py-1 text-v-muted"><User size={11} /> {u}</span>)}
                          </div>
                          {ejemplo && <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-[12px] border border-v-border bg-v-elevated p-3 font-mono text-[11px] text-v-muted">{ejemplo}</pre>}
                          <button onClick={() => borrarGrupo(g)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-v-border px-3 text-xs font-semibold text-v-muted hover:border-v-danger/40 hover:text-v-danger">
                            <Trash2 size={13} /> {L('Delete this error', 'Borrar este error')}{g.items.length > 1 ? ` (${g.items.length})` : ''}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
