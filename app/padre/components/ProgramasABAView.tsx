'use client'
// app/padre/components/ProgramasABAView.tsx
// Programas ABA para las familias: qué trabaja su hijo/a, cómo practicarlo en casa y registro semanal.
// Los textos que escribe el equipo se muestran traducidos cuando la app está en inglés.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { useTraducir } from '@/lib/use-traducir'
import {
  ChevronDown, CheckCircle2, Check, BookOpen, Target, Loader2, Star, Award, Info,
  MessageCircle, Zap, Brain, Users, Activity, Languages, Lightbulb, Gift,
  MessagesSquare, Hand, Package, RotateCcw, Sprout, TrendingUp, X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

interface Objetivo {
  id: string; nombre?: string; descripcion?: string; estado: string; numero_set: number
  materiales?: string; sd_estimulo?: string; unidad_positiva?: string; unidad_negativa?: string
  reforzadores?: string; correction_errores?: string; generalizacion?: string
}
interface Programa {
  id: string; titulo: string; descripcion: string; area: string; fase_actual: string
  instrucciones_casa: string; materiales: string; sd_estimulo: string; reforzadores: string; ayudas: string
  criterio_dominio_pct: number; estado: string
  objetivos_cp: Objetivo[]
  sesiones_datos_aba: { fecha: string; porcentaje_exito: number }[]
}
interface Props { childId: string; childName: string }

const cardClass = 'rounded-v border border-v-border bg-v-elevated shadow-v'

// Un ícono y un tono por área (por palabra clave: el área la escribe el equipo)
function areaDe(area: string) {
  const a = (area || '').toLowerCase()
  if (/comunic|lenguaje receptivo|petici|mand/.test(a)) return { Icon: MessageCircle, tone: 'bg-v-accent-soft text-v-accent' }
  if (/lenguaje|verbal|habla/.test(a)) return { Icon: Languages, tone: 'bg-v-accent-soft text-v-accent' }
  if (/conduct|cooperaci/.test(a)) return { Icon: Zap, tone: 'bg-v-warning/15 text-v-warning' }
  if (/imitaci|motor/.test(a)) return { Icon: Activity, tone: 'bg-v-success/15 text-v-success' }
  if (/social|juego/.test(a)) return { Icon: Users, tone: 'bg-v-success/15 text-v-success' }
  if (/autonom|vida diaria/.test(a)) return { Icon: Star, tone: 'bg-v-warning/15 text-v-warning' }
  if (/visual|cognit|habilidad|desempe/.test(a)) return { Icon: Brain, tone: 'bg-v-accent-soft text-v-accent' }
  return { Icon: Target, tone: 'bg-v-fill text-v-muted' }
}

const FASE: Record<string, { es: string; en: string; tone: string }> = {
  linea_base:    { es: 'Línea base', en: 'Baseline', tone: 'bg-v-fill text-v-muted' },
  intervencion:  { es: 'En intervención', en: 'In intervention', tone: 'bg-v-accent-soft text-v-accent' },
  mantenimiento: { es: 'Mantenimiento', en: 'Maintenance', tone: 'bg-v-success/15 text-v-success' },
  dominado:      { es: 'Dominado', en: 'Mastered', tone: 'bg-v-success/15 text-v-success' },
}

// ─── Registro de práctica de la semana ────────────────────────────────────────
function WeekTracker({ programaId, childId, objetivos, tr }: { programaId: string; childId: string; objetivos?: Objetivo[]; tr: (t?: string) => string }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [practiced, setPracticed] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [elegirSet, setElegirSet] = useState<string | null>(null)

  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const today = new Date()
  const hoy = iso(today)
  const lunes = new Date(today); lunes.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1))
  const semana = Array.from({ length: 7 }, (_, i) => { const d = new Date(lunes); d.setDate(lunes.getDate() + i); return d })

  useEffect(() => {
    supabase.from('programa_practica_casa').select('fecha').eq('programa_id', programaId).eq('child_id', childId).in('fecha', semana.map(iso))
      .then(({ data }) => { if (data) setPracticed(new Set(data.map((r: any) => r.fecha))) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, childId])

  const toggle = async (fecha: string, objetivoId?: string) => {
    if (fecha > hoy) return
    setSaving(true); setElegirSet(null)
    if (practiced.has(fecha)) {
      await supabase.from('programa_practica_casa').delete().eq('programa_id', programaId).eq('child_id', childId).eq('fecha', fecha)
      setPracticed(prev => { const s = new Set(prev); s.delete(fecha); return s })
    } else {
      const record: any = { programa_id: programaId, child_id: childId, fecha }
      if (objetivoId) record.objetivo_id = objetivoId
      await supabase.from('programa_practica_casa').upsert(record)
      setPracticed(prev => new Set([...prev, fecha]))
    }
    setSaving(false)
  }
  const hayObjetivos = !!objetivos?.length

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-v-text">{L('Practice this week', 'Práctica de esta semana')}</p>
        <span className="rounded-full bg-v-success/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-v-success">{practiced.size}/7</span>
      </div>
      <div className="mt-2.5 grid grid-cols-7 gap-1.5">
        {semana.map(d => {
          const f = iso(d), done = practiced.has(f), esHoy = f === hoy, pasado = f <= hoy
          return (
            <motion.button key={f} whileTap={pasado ? { scale: 0.9 } : undefined} disabled={saving || !pasado}
              onClick={() => { if (done) toggle(f); else if (hayObjetivos) setElegirSet(f); else toggle(f) }}
              className={`flex flex-col items-center gap-1 rounded-v-sm py-2 transition-colors disabled:cursor-default ${done ? 'bg-v-success/15' : esHoy ? 'bg-v-accent-soft' : 'bg-v-fill'} ${pasado ? '' : 'opacity-40'}`}>
              <span className={`text-[10px] font-semibold uppercase ${esHoy ? 'text-v-accent' : 'text-v-muted'}`}>{d.toLocaleDateString(toBCP47(locale), { weekday: 'narrow' })}</span>
              <span className={`grid size-6 place-items-center rounded-full ${done ? 'bg-v-success text-white' : esHoy ? 'border-2 border-v-accent' : 'border-2 border-v-border'}`}>
                {done && <Check size={13} strokeWidth={3} />}
              </span>
            </motion.button>
          )
        })}
      </div>
      <AnimatePresence>
        {elegirSet && hayObjetivos && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-3 space-y-1.5 rounded-v-sm border border-v-border bg-v-elevated p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-v-text">{L('Which set did you practice?', '¿Qué set practicaron?')}</p>
                <button onClick={() => setElegirSet(null)} aria-label={L('Close', 'Cerrar')} className="grid size-7 place-items-center rounded-full text-v-muted hover:bg-v-fill"><X size={14} /></button>
              </div>
              {objetivos!.map(o => (
                <button key={o.id} onClick={() => toggle(elegirSet, o.id)}
                  className="flex w-full items-center gap-2.5 rounded-v-sm bg-v-fill px-3 py-2 text-left text-sm text-v-text transition-colors hover:bg-v-accent-soft">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-v-accent-soft text-[11px] font-bold text-v-accent">{o.numero_set}</span>
                  <span className="min-w-0 flex-1 truncate">{tr(o.descripcion || o.nombre) || `Set ${o.numero_set}`}</span>
                </button>
              ))}
              <button onClick={() => toggle(elegirSet)} className="w-full rounded-v-sm border border-dashed border-v-border py-2 text-xs font-semibold text-v-muted hover:text-v-text">
                {L('Mark without choosing a set', 'Marcar sin elegir set')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Tarjeta de programa ──────────────────────────────────────────────────────
function ProgramCard({ prog, childId, index, tr }: { prog: Programa; childId: string; index: number; tr: (t?: string) => string }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [open, setOpen] = useState(false)
  const [setAbierto, setSetAbierto] = useState<string | null>(null)
  const area = areaDe(prog.area)
  const done = prog.fase_actual === 'dominado' || prog.estado === 'dominado'
  const fase = FASE[done ? 'dominado' : prog.fase_actual] || FASE.intervencion
  const sesiones = (prog.sesiones_datos_aba || []).slice(0, 8).reverse()
  const ultimas = (prog.sesiones_datos_aba || []).slice(0, 3)
  const promedio = ultimas.length ? Math.round(ultimas.reduce((s, r) => s + (r.porcentaje_exito || 0), 0) / ultimas.length) : null
  const criterio = prog.criterio_dominio_pct || 80
  const activos = (prog.objetivos_cp || []).filter(o => o.estado !== 'dominado')

  return (
    <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * index, type: 'spring', stiffness: 220, damping: 24 }}
      className={`${cardClass} overflow-hidden ${done ? 'border-v-success/40' : ''}`}>
      <button onClick={() => setOpen(o => !o)} className="group flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-v-fill/50 sm:px-5">
        <span className={`grid size-11 shrink-0 place-items-center rounded-[30%] ${done ? 'bg-v-success/15 text-v-success' : area.tone}`}>{done ? <Award size={20} /> : <area.Icon size={20} />}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug tracking-tight text-v-text">{tr(prog.titulo)}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {prog.area && <span className="rounded-full bg-v-fill px-2 py-0.5 text-[11px] font-medium text-v-muted">{tr(prog.area)}</span>}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${fase.tone}`}>{en ? fase.en : fase.es}</span>
          </span>
        </span>
        {/* Avance: barritas de las últimas sesiones + promedio */}
        {promedio !== null && (
          <span className="hidden shrink-0 items-end gap-3 sm:flex">
            <span className="flex h-8 items-end gap-0.5">
              {sesiones.map((s, i) => (
                <span key={i} className={`w-1.5 rounded-sm ${(s.porcentaje_exito || 0) >= criterio ? 'bg-v-success' : 'bg-v-accent/60'}`} style={{ height: `${Math.max(12, s.porcentaje_exito || 0)}%` }} />
              ))}
            </span>
            <span className="text-right">
              <span className={`block text-lg font-bold leading-none tabular-nums ${promedio >= criterio ? 'text-v-success' : 'text-v-text'}`}>{promedio}%</span>
              <span className="text-[10px] text-v-subtle">{L('last sessions', 'últimas sesiones')}</span>
            </span>
          </span>
        )}
        <ChevronDown size={17} className={`shrink-0 text-v-subtle transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="space-y-4 border-t border-v-border px-4 pb-5 pt-4 sm:px-5">
              {promedio !== null && (
                <div className="sm:hidden">
                  <div className="mb-1 flex justify-between text-xs"><span className="text-v-muted">{L('Last sessions', 'Últimas sesiones')}</span><span className="font-semibold tabular-nums text-v-text">{promedio}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-v-fill"><div className={`h-full rounded-full ${promedio >= criterio ? 'bg-v-success' : 'v-brand'}`} style={{ width: `${promedio}%` }} /></div>
                </div>
              )}
              {prog.descripcion && <p className="text-sm leading-relaxed text-v-muted">{tr(prog.descripcion)}</p>}

              {(prog.instrucciones_casa || prog.reforzadores) && (
                <div className="space-y-3 rounded-v-sm bg-v-accent-soft/60 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-v-accent"><BookOpen size={13} /> {L('General guidance', 'Indicaciones generales')}</p>
                  {prog.instrucciones_casa && (
                    <div><p className="flex items-center gap-1.5 text-[11px] font-semibold text-v-muted"><Info size={12} /> {L('Instructions', 'Instrucciones')}</p><p className="mt-1 text-sm leading-relaxed text-v-text">{tr(prog.instrucciones_casa)}</p></div>
                  )}
                  {prog.reforzadores && (
                    <div><p className="flex items-center gap-1.5 text-[11px] font-semibold text-v-muted"><Gift size={12} /> {L('What motivates them', 'Lo que lo motiva')}</p><p className="mt-1 text-sm leading-relaxed text-v-text">{tr(prog.reforzadores)}</p></div>
                  )}
                </div>
              )}

              {activos.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-v-text"><Target size={13} className="text-v-accent" /> {L('What they are practicing now', 'Qué está practicando ahora')}</p>
                  <div className="space-y-1.5">
                    {activos.map(obj => {
                      const abierto = setAbierto === obj.id
                      const sd = obj.sd_estimulo || prog.sd_estimulo
                      const materiales = obj.materiales || prog.materiales
                      const ayudas = obj.reforzadores || prog.ayudas // en el admin "Ayudas" se guarda en `reforzadores` del set
                      const campos = [
                        { Icon: MessagesSquare, label: L('What to say or do', 'Qué decir o hacer'), v: sd },
                        { Icon: Hand, label: L('Help / prompts', 'Ayudas'), v: ayudas },
                        { Icon: Package, label: L('Materials', 'Materiales'), v: materiales },
                        { Icon: RotateCcw, label: L('If they make a mistake', 'Si se equivoca'), v: obj.correction_errores },
                        { Icon: Sprout, label: L('Take it to other places', 'Llevarlo a otros lugares'), v: obj.generalizacion },
                      ].filter(c => c.v)
                      return (
                        <div key={obj.id} className={`overflow-hidden rounded-v-sm border transition-colors ${abierto ? 'border-v-accent/40' : 'border-v-border'}`}>
                          <button onClick={() => setSetAbierto(abierto ? null : obj.id)} className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors ${abierto ? 'bg-v-accent-soft/60' : 'hover:bg-v-fill'}`}>
                            <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${abierto ? 'v-brand' : 'bg-v-accent-soft text-v-accent'}`} style={abierto ? { boxShadow: 'none' } : undefined}>{obj.numero_set || '•'}</span>
                            <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-v-text">{tr(obj.descripcion || obj.nombre) || `Set ${obj.numero_set}`}</span>
                            {obj.estado === 'en_progreso' && <span className="shrink-0 rounded-full bg-v-accent-soft px-2 py-0.5 text-[10px] font-semibold text-v-accent">{L('In progress', 'En curso')}</span>}
                            <ChevronDown size={15} className={`shrink-0 text-v-subtle transition-transform ${abierto ? 'rotate-180' : ''}`} />
                          </button>
                          <AnimatePresence initial={false}>
                            {abierto && (
                              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                <div className="space-y-3 border-t border-v-border bg-v-elevated px-3.5 py-3.5">
                                  {campos.length ? (
                                    <>
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-v-subtle">{L('How to practice at home', 'Cómo practicarlo en casa')}</p>
                                      {campos.map(c => (
                                        <div key={c.label} className="flex items-start gap-2.5">
                                          <span className="grid size-7 shrink-0 place-items-center rounded-[30%] bg-v-fill text-v-accent"><c.Icon size={14} /></span>
                                          <div className="min-w-0"><p className="text-[11px] font-semibold text-v-muted">{c.label}</p><p className="text-sm leading-relaxed text-v-text">{tr(c.v)}</p></div>
                                        </div>
                                      ))}
                                    </>
                                  ) : (
                                    <p className="flex items-center gap-2 text-xs text-v-muted"><Lightbulb size={14} className="shrink-0 text-v-warning" /> {L('The therapist has not added home instructions for this set yet.', 'El terapeuta aún no agregó indicaciones para casa en este set.')}</p>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {done ? (
                <div className="flex items-center gap-3 rounded-v-sm bg-v-success/10 p-3.5">
                  <Award size={20} className="shrink-0 text-v-success" />
                  <div><p className="text-sm font-semibold text-v-success">{L('Program mastered', 'Programa dominado')}</p><p className="text-xs text-v-muted">{L('They reached the mastery criterion. Great job!', 'Alcanzó el criterio de dominio. ¡Excelente trabajo!')}</p></div>
                </div>
              ) : (
                <div className="rounded-v-sm bg-v-fill/60 p-3.5">
                  <WeekTracker programaId={prog.id} childId={childId} objetivos={activos} tr={tr} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function ProgramasABAView({ childId, childName }: Props) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [programas, setProgramas] = useState<Programa[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'activos' | 'todos'>('activos')

  const load = useCallback(async () => {
    if (!childId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/programas-aba?child_id=${childId}`)
      const json = await res.json()
      if (json.data) setProgramas(json.data)
    } finally { setLoading(false) }
  }, [childId])
  useEffect(() => { load() }, [load])

  const activos = programas.filter(p => p.estado !== 'dominado' && p.estado !== 'archivado' && p.fase_actual !== 'dominado')
  const filtrados = filtro === 'activos' ? activos : programas.filter(p => p.estado !== 'archivado')
  const dominados = programas.filter(p => p.estado === 'dominado' || p.fase_actual === 'dominado').length

  // Todos los textos del equipo que se muestran (para traducirlos si la app está en inglés)
  const textos = useMemo(() => programas.flatMap(p => [
    p.titulo, p.area, p.descripcion, p.instrucciones_casa, p.reforzadores, p.sd_estimulo, p.materiales, p.ayudas,
    ...(p.objetivos_cp || []).flatMap(o => [o.descripcion, o.nombre, o.sd_estimulo, o.materiales, o.reforzadores, o.correction_errores, o.generalizacion]),
  ]), [programas])
  const traducir = useTraducir(textos)
  const tr = (t?: string) => traducir(t)
  const nombre = (childName || '').split(' ')[0] || L('your child', 'tu hijo/a')

  return (
    <div className="v-scope space-y-4 pb-8 md:space-y-5">
      {/* Encabezado */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }} className={`relative overflow-hidden ${cardClass}`}>
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(40rem 14rem at 0% 0%, var(--v-glow-1), transparent 70%)' }} />
        <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-v-muted">{L('ABA programs', 'Programas ABA')}</p>
            <h2 className="v-headline mt-1 text-[1.5rem] leading-tight text-v-text sm:text-[1.8rem]">{L('What ', 'Lo que trabaja ')}<span className="v-brand-text">{nombre}</span>{L(' is working on', '')}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-v-muted">
              {L('These are the programs the therapy team works on. Practicing them at home reinforces learning — mark the days you practiced to keep track.',
                 'Estos son los programas que trabaja el equipo de terapia. Practicarlos en casa refuerza el aprendizaje: marca los días que lo practicaron para hacer seguimiento.')}
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2">
            <div className="rounded-v-sm bg-v-accent-soft px-4 py-3 text-center"><p className="text-2xl font-bold leading-none tabular-nums text-v-accent">{activos.length}</p><p className="mt-1 text-[11px] font-medium text-v-muted">{L('Active', 'Activos')}</p></div>
            <div className="rounded-v-sm bg-v-success/10 px-4 py-3 text-center"><p className="text-2xl font-bold leading-none tabular-nums text-v-success">{dominados}</p><p className="mt-1 text-[11px] font-medium text-v-muted">{L('Mastered', 'Dominados')}</p></div>
          </div>
        </div>
      </motion.div>

      {/* Filtro */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-full bg-v-fill p-1">
          {([['activos', L('Active', 'Activos'), activos.length], ['todos', L('All', 'Todos'), programas.filter(p => p.estado !== 'archivado').length]] as const).map(([id, label, n]) => {
            const on = filtro === id
            return (
              <button key={id} onClick={() => setFiltro(id)} className={`relative rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${on ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
                {on && <motion.span layoutId="programas-filtro" transition={{ type: 'spring', stiffness: 420, damping: 32 }} className="absolute inset-0 rounded-full bg-v-elevated shadow-v" />}
                <span className="relative">{label} <span className="tabular-nums text-v-subtle">{n}</span></span>
              </button>
            )
          })}
        </div>
        <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-v-subtle sm:flex"><TrendingUp size={12} /> {L('Bars: last sessions (green = mastery reached)', 'Barras: últimas sesiones (verde = dominio alcanzado)')}</span>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 size={26} className="animate-spin text-v-accent" /></div>
      ) : filtrados.length === 0 ? (
        <div className={`${cardClass} px-6 py-12 text-center`}>
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-v-fill"><BookOpen size={20} className="text-v-subtle" /></span>
          <p className="mt-3 text-sm font-semibold text-v-text">{L('No active programs', 'Sin programas activos')}</p>
          <p className="mt-1 text-xs text-v-muted">{L('The therapy team has not assigned programs yet.', 'El equipo de terapia aún no asignó programas.')}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtrados.map((p, i) => <ProgramCard key={p.id} prog={p} childId={childId} index={i} tr={tr} />)}
        </div>
      )}
    </div>
  )
}
