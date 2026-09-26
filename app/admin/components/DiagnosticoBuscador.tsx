'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useI18n } from '@/lib/i18n-context'
import {
  Search, X, Loader2, Copy, Check, ChevronRight, AlertCircle, ExternalLink, Star, Tag,
  BookOpen, GitBranch, ArrowLeft, ArrowUp, Clock, Stethoscope, FileText, CheckCircle2, XCircle,
} from 'lucide-react'

type Result = { id?: string; code: string; title: string; chapter?: string; isLeaf?: boolean }
type Detail = {
  code: string; title: string; definition: string
  inclusions: string[]; exclusions: string[]; indexTerms: string[]
  codingNote: string; diagnosticCriteria: string
  children: { id: string; code: string; title: string }[]
  parent: { id: string; code: string; title: string } | null
  browserUrl: string
}

const SIGLAS_ES: Record<string, string> = {
  'tea': 'Trastorno del espectro autista',
  'tdah': 'Trastorno por déficit de atención',
  'toc': 'Trastorno obsesivo compulsivo',
  'tept': 'Estrés postraumático',
  'tnd': 'Negativista desafiante',
  'tlp': 'Límite personalidad',
  'di': 'Discapacidad intelectual',
  'dislexia': 'Dislexia',
  'dispraxia': 'Coordinación motora desarrollo',
  'discalculia': 'Dificultad aprendizaje matemáticas',
  'disgrafia': 'Dificultad escritura',
  'arfid': 'Evitación restricción ingesta',
  'bipolar': 'Trastorno bipolar',
  'esquizofrenia': 'Esquizofrenia',
  'ansiedad': 'Ansiedad',
  'depresion': 'Depresivo',
  'enuresis': 'Enuresis',
  'encopresis': 'Encopresis',
  'tourette': 'Tourette',
  'mutismo': 'Mutismo selectivo',
  'tartamudez': 'Disfluencia',
}

const CHIPS: { es: string; en: string }[] = [
  { es: 'TEA', en: 'ASD' }, { es: 'TDAH', en: 'ADHD' }, { es: 'TOC', en: 'OCD' },
  { es: 'TEPT', en: 'PTSD' }, { es: 'Ansiedad', en: 'Anxiety' }, { es: 'Dislexia', en: 'Dyslexia' },
  { es: 'TND', en: 'ODD' }, { es: 'Depresión', en: 'Depression' }, { es: 'Bipolar', en: 'Bipolar' },
  { es: 'Enuresis', en: 'Enuresis' }, { es: 'ARFID', en: 'ARFID' }, { es: 'Dispraxia', en: 'Dyspraxia' },
  { es: 'Tourette', en: 'Tourette' }, { es: 'Mutismo', en: 'Mutism' }, { es: 'TLP', en: 'BPD' },
  { es: 'Esquizofrenia', en: 'Schizophrenia' },
]

interface Props {
  onAsignar?: (r: Result | Detail) => void
  showAsignar?: boolean
}

export default function DiagnosticoBuscador({ onAsignar, showAsignar = false }: Props) {
  const { t, locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const [q, setQ]               = useState('')
  const [results, setResults]   = useState<Result[]>([])
  const [loading, setLoading]   = useState(false)
  const [apiOk, setApiOk]       = useState<boolean | null>(null)
  const [selected, setSelected] = useState<Detail | null>(null)
  const [detailLoading, setDL]  = useState(false)
  const [copied, setCopied]     = useState<string | null>(null)
  const [history, setHistory]   = useState<string[]>([])
  const [breadcrumb, setBreadcrumb] = useState<{ code: string; title: string }[]>([])
  const [verTerminos, setVerTerminos] = useState(false)
  const inputRef  = useRef<HTMLInputElement>(null)
  const debounce  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  // Verificar API al montar
  useEffect(() => {
    fetch(`/api/cie11?action=search&q=autismo&lang=${locale}`)
      .then(r => r.json())
      .then(d => setApiOk(!d.fallback))
      .catch(() => setApiOk(false))
  }, [locale])

  // Búsqueda con debounce
  const doSearch = useCallback(async (query: string) => {
    const q2 = query.trim()
    // Resolver sigla en español si aplica
    const resolved = SIGLAS_ES[q2.toLowerCase()] || q2
    setLoading(true)
    setSelected(null)
    setBreadcrumb([])
    try {
      const res  = await fetch(`/api/cie11?action=search&q=${encodeURIComponent(resolved)}&lang=${locale}`)
      const data = await res.json()
      setApiOk(!data.fallback)
      setResults(data.results || [])
      if (!history.includes(q2)) setHistory(h => [q2, ...h].slice(0, 6))
    } catch {
      setApiOk(false)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [history, locale])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (q.trim().length < 2) { setResults([]); setSelected(null); return }
    debounce.current = setTimeout(() => doSearch(q), 400)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [q, doSearch])

  // Cargar detalle
  const loadDetail = async (r: { id?: string; code: string; title: string }, addBreadcrumb = true) => {
    setDL(true)
    setVerTerminos(false)
    if (addBreadcrumb && selected) {
      setBreadcrumb(bc => [...bc, { code: selected.code, title: selected.title }])
    }
    // Mostrar panel inmediatamente con lo que ya sabemos
    setSelected({
      code: r.code, title: r.title || r.code,
      definition: '', inclusions: [], exclusions: [],
      indexTerms: [], codingNote: '', diagnosticCriteria: '',
      children: [], parent: null,
      browserUrl: `https://icd.who.int/browse/2024-01/mms/${locale}#${r.code}`,
    })
    try {
      // Siempre usar el ID completo (URL) si está disponible — más confiable que el código alfanumérico
      const param = r.id || r.code
      const res   = await fetch(`/api/cie11?action=detail&code=${encodeURIComponent(param)}&lang=${locale}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data  = await res.json()
      if (data.fallback || data.error) throw new Error(data.error || 'fallback')
      setSelected({
        code:               data.code       || r.code,
        title:              data.title      || r.title || r.code,
        definition:         data.definition || '',
        inclusions:         Array.isArray(data.inclusions) ? data.inclusions : [],
        exclusions:         Array.isArray(data.exclusions) ? data.exclusions : [],
        indexTerms:         Array.isArray(data.indexTerms) ? data.indexTerms : [],
        children:           Array.isArray(data.children)   ? data.children   : [],
        codingNote:         data.codingNote         || '',
        diagnosticCriteria: data.diagnosticCriteria || '',
        parent:             data.parent             || null,
        browserUrl:         data.browserUrl || `https://icd.who.int/browse/2024-01/mms/${locale}#${data.code || r.code}`,
      })
    } catch (e) {
      console.warn('[CIE-11] Detail load failed:', e)
      // Mantener el panel con lo básico ya mostrado
    } finally {
      setDL(false)
    }
  }

  const goBack = async () => {
    const prev = breadcrumb[breadcrumb.length - 1]
    if (!prev) { setSelected(null); setBreadcrumb([]); return }
    setBreadcrumb(bc => bc.slice(0, -1))
    await loadDetail(prev, false)
  }

  const copiar = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1800)
  }

  const clear = () => {
    setQ(''); setResults([]); setSelected(null); setBreadcrumb([])
    inputRef.current?.focus()
  }


  // Para un centro ABA, primero lo del capítulo 06 (trastornos mentales y del neurodesarrollo)
  const ordenados = [...results].sort((a, b) => Number(b.chapter === '06') - Number(a.chapter === '06'))

  const seccion = 'text-[11px] font-semibold uppercase tracking-wider text-v-subtle flex items-center gap-1.5'

  return (
    <div className="space-y-4">

      {/* ── CABECERA + BUSCADOR ── */}
      <section className="relative overflow-hidden rounded-v border border-v-border bg-v-elevated p-4 shadow-v sm:p-5">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(36rem 12rem at 0% 0%, var(--v-glow-1), transparent 70%)' }} />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="v-brand grid size-11 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><Stethoscope size={20} /></span>
            <div className="min-w-0">
              <h2 className="v-headline text-lg leading-tight text-v-text sm:text-xl">{L('Diagnosis finder', 'Buscador de diagnósticos')}</h2>
              <p className="mt-0.5 text-xs text-v-muted">{L('WHO ICD-11 classification — search by name, code (6A02) or acronym', 'Clasificación CIE-11 de la OMS — busca por nombre, código (6A02) o sigla')}</p>
            </div>
          </div>
          {apiOk !== null && (
            <span title={apiOk ? L('Data from the public WHO ICD-11 API', 'Datos de la API pública de la CIE-11 de la OMS') : L('Using the local base', 'Usando la base local')}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${apiOk ? 'bg-v-success/12 text-v-success' : 'bg-v-warning/15 text-v-warning'}`}>
              <span className={`size-1.5 rounded-full ${apiOk ? 'bg-v-success' : 'bg-v-warning'}`} />
              {apiOk ? L('Updated', 'Actualizado') : L('Local base', 'Base local')}
            </span>
          )}
        </div>

        <div className="relative mt-4">
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-v-subtle" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && q.trim().length >= 2 && doSearch(q)}
            placeholder={t('admin.phBuscarDiag')}
            className="h-12 w-full rounded-full border border-v-border bg-v-bg pl-11 pr-11 text-sm font-medium text-v-text outline-none transition-shadow placeholder:text-v-subtle focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft"
            autoComplete="off"
          />
          {loading
            ? <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-v-accent" />
            : q && <button onClick={clear} aria-label={L('Clear', 'Borrar')} className="absolute right-2.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-v-muted hover:bg-v-fill"><X size={15} /></button>}
        </div>

        {q.length === 0 && !selected && (
          <div className="relative mt-3 space-y-2">
            {history.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {history.map(h => (
                  <button key={h} onClick={() => setQ(h)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-v-fill px-3 py-1.5 text-xs font-semibold text-v-muted transition-colors hover:bg-v-accent-soft hover:text-v-accent">
                    <Clock size={11} /> {h}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {CHIPS.map(c => {
                const label = locale === 'en' ? c.en : c.es
                return (
                  <button key={c.es} onClick={() => setQ(label)}
                    className="rounded-full border border-v-border px-3 py-1.5 text-xs font-semibold text-v-muted transition-colors hover:border-v-accent/40 hover:bg-v-accent-soft hover:text-v-accent">
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── DETALLE ── */}
      {selected && (
        <section ref={detailRef} className="overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-v-border bg-v-fill/60 px-4 py-2.5 text-xs">
            <button onClick={() => { setSelected(null); setBreadcrumb([]) }} className="inline-flex items-center gap-1 font-semibold text-v-accent hover:underline">
              <ArrowLeft size={12} /> {L('Results', 'Resultados')}
            </button>
            {breadcrumb.map((bc, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <ChevronRight size={11} className="text-v-subtle" />
                <button onClick={goBack} className="font-semibold text-v-accent hover:underline">{bc.code}</button>
              </span>
            ))}
            <ChevronRight size={11} className="text-v-subtle" />
            <span className="font-semibold text-v-text">{selected.code}</span>
            {detailLoading && <Loader2 size={12} className="ml-auto animate-spin text-v-accent" />}
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <button onClick={() => copiar(selected.code, 'code')} title={L('Copy code', 'Copiar código')}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-v-sm bg-v-accent-soft px-3 py-1.5 font-mono text-sm font-bold text-v-accent">
                {selected.code} {copied === 'code' ? <Check size={13} /> : <Copy size={12} className="opacity-60" />}
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold leading-snug text-v-text">{selected.title}</h3>
                {selected.parent && (
                  <p className="mt-1 text-xs text-v-muted">{chapterName(selected.parent.code, locale) || selected.parent.title}</p>
                )}
              </div>
            </div>

            {selected.definition && (
              <div className="space-y-1.5">
                <p className={seccion}><BookOpen size={12} /> {L('Definition', 'Definición')}</p>
                <p className="max-w-3xl text-sm leading-relaxed text-v-text/90">{selected.definition}</p>
              </div>
            )}

            {selected.diagnosticCriteria && (
              <div className="rounded-v-sm border border-v-accent/20 bg-v-accent-soft/50 p-3.5">
                <p className={`${seccion} mb-1.5 !text-v-accent`}><Stethoscope size={12} /> {L('Diagnostic criteria (WHO ICD-11)', 'Criterios diagnósticos (OMS CIE-11)')}</p>
                <p className="whitespace-pre-line text-xs leading-relaxed text-v-text/90">{selected.diagnosticCriteria}</p>
              </div>
            )}

            {selected.codingNote && (
              <div className="rounded-v-sm bg-v-fill p-3.5">
                <p className={`${seccion} mb-1`}><FileText size={12} /> {L('Coding note', 'Nota de codificación')}</p>
                <p className="text-xs leading-relaxed text-v-muted">{selected.codingNote}</p>
              </div>
            )}

            {selected.indexTerms.length > 0 && (
              <div className="space-y-2">
                <p className={seccion}><Tag size={12} /> {L('Included terms / synonyms', 'Términos incluidos / sinónimos')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(verTerminos ? selected.indexTerms : selected.indexTerms.slice(0, 10)).map((term, i) => (
                    <span key={i} className="rounded-full bg-v-fill px-2.5 py-1 text-xs font-medium text-v-text/80">{term}</span>
                  ))}
                  {selected.indexTerms.length > 10 && (
                    <button onClick={() => setVerTerminos(v => !v)} className="rounded-full px-2.5 py-1 text-xs font-semibold text-v-accent hover:bg-v-accent-soft">
                      {verTerminos ? L('Show less', 'Ver menos') : L(`+${selected.indexTerms.length - 10} more`, `+${selected.indexTerms.length - 10} más`)}
                    </button>
                  )}
                </div>
              </div>
            )}

            {(selected.inclusions.length > 0 || selected.exclusions.length > 0) && (
              <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-x-8">
                {selected.inclusions.length > 0 && (
                  <div className="min-w-0 space-y-1.5">
                    <p className={`${seccion} !text-v-success`}><CheckCircle2 size={12} /> {L('Includes', 'Incluye')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.inclusions.map((inc, i) => <span key={i} className="rounded-full bg-v-success/10 px-2.5 py-1 text-xs font-medium text-v-text">{inc}</span>)}
                    </div>
                  </div>
                )}
                {selected.exclusions.length > 0 && (
                  <div className="min-w-0 space-y-1.5">
                    <p className={`${seccion} !text-v-danger`}><XCircle size={12} /> {L('Excludes', 'Excluye')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.exclusions.map((exc, i) => <span key={i} className="rounded-full bg-v-danger/10 px-2.5 py-1 text-xs font-medium text-v-text">{exc}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(selected.children.length > 0 || selected.parent) && (
              <div className="space-y-2">
                <p className={seccion}><GitBranch size={12} /> {L('Related categories', 'Categorías relacionadas')}</p>
                <div className="overflow-hidden rounded-v-sm border border-v-border">
                  {selected.parent && (
                    <button onClick={() => loadDetail(selected.parent!)}
                      className="grid w-full grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-v-border bg-v-fill/50 px-3.5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-v-fill">
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-v-muted">
                        <ArrowUp size={12} /> {esCodigo(selected.parent.code) ? selected.parent.code : ''}
                      </span>
                      <span className="text-sm text-v-text">
                        <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wide text-v-subtle">{L('Parent', 'Superior')}</span>
                        {selected.parent.title}
                      </span>
                      <ChevronRight size={14} className="text-v-subtle" />
                    </button>
                  )}
                  {selected.children.map((child, i) => (
                    <button key={i} onClick={() => loadDetail(child)}
                      className="group grid w-full grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-v-border px-3.5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-v-fill">
                      <span className="font-mono text-xs font-bold text-v-accent">{esCodigo(child.code) ? child.code : '—'}</span>
                      <span className="text-sm leading-snug text-v-text">{child.title || (L('View subcategory', 'Ver subcategoría'))}</span>
                      <ChevronRight size={14} className="text-v-subtle transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-v-border pt-4">
              <button onClick={() => copiar(`${selected.title}\nCIE-11: ${selected.code}\n${selected.definition}`, 'full')}
                className="v-brand inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold">
                {copied === 'full' ? <Check size={14} /> : <Copy size={14} />} {L('Copy for ARIA', 'Copiar para ARIA')}
              </button>
              {showAsignar && onAsignar && (
                <button onClick={() => onAsignar(selected)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-v-success px-4 text-sm font-semibold text-white">
                  <Star size={14} /> {L('Assign to patient', 'Asignar al paciente')}
                </button>
              )}
              <a href={selected.browserUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-v-border px-4 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill">
                <ExternalLink size={14} /> {L('View on WHO', 'Ver en la OMS')}
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ── RESULTADOS ── */}
      {!selected && q.trim().length >= 2 && (
        <section className="overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v">
          <div className="flex items-center justify-between gap-2 border-b border-v-border px-4 py-2.5">
            <p className="text-xs font-semibold text-v-muted">
              {loading ? L('Searching…', 'Buscando…')
                : results.length === 0 ? L(`No results for "${q}"`, `Sin resultados para "${q}"`)
                : L(`${results.length} result${results.length !== 1 ? 's' : ''}`, `${results.length} resultado${results.length !== 1 ? 's' : ''}`)}
            </p>
            {!loading && results.length > 0 && <p className="hidden text-[11px] text-v-subtle sm:block">{L('Tap one to see the full detail', 'Toca uno para ver el detalle completo')}</p>}
          </div>

          {loading ? (
            <div className="divide-y divide-v-border">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="h-6 w-16 animate-pulse rounded-v-sm bg-v-fill" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-v-fill" />
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-full bg-v-fill text-v-subtle"><AlertCircle size={20} /></span>
              <p className="mt-3 text-sm font-semibold text-v-text">{L('Nothing found', 'No encontramos nada')}</p>
              <p className="mt-1 text-xs text-v-muted">{t('admin.intentaCodigoCIE')}</p>
            </div>
          ) : (
            <ul className="max-h-[62vh] divide-y divide-v-border overflow-y-auto">
              {ordenados.map(r => {
                const neuro = r.chapter === '06'
                return (
                  <li key={r.id || r.code}>
                    <button onClick={() => loadDetail(r)} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-v-fill">
                      <span className={`w-[4.5rem] shrink-0 rounded-v-sm py-1 text-center font-mono text-xs font-bold ${neuro ? 'bg-v-accent-soft text-v-accent' : 'bg-v-fill text-v-muted'}`}>{r.code || '—'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-snug text-v-text">{r.title}</span>
                        {r.chapter && <span className="mt-0.5 block text-[11px] text-v-subtle">{chapterName(r.chapter, locale) || (L('Chapter ', 'Capítulo ') + r.chapter)}</span>}
                      </span>
                      <ChevronRight size={15} className="shrink-0 text-v-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-v-accent" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {/* Atribución exigida por la licencia de la CIE-11 (CC BY-ND 3.0 IGO) */}
      <p className="mx-auto max-w-2xl text-center text-[10px] leading-relaxed text-v-subtle">
        {L('ICD-11 content © World Health Organization, used under the CC BY-ND 3.0 IGO license and shown unmodified. Vanty ABA is not affiliated with or endorsed by WHO. Reference tool: it does not replace clinical judgment.',
           'Contenido de la CIE-11 © Organización Mundial de la Salud, usado bajo licencia CC BY-ND 3.0 IGO y mostrado sin modificaciones. Vanty ABA no está afiliado ni respaldado por la OMS. Herramienta de consulta: no reemplaza el juicio clínico.')}
      </p>
    </div>
  )
}

const CHAPTER_NAMES: Record<string, string> = {
  '01':'Enfermedades infecciosas', '02':'Neoplasias', '03':'Sangre',
  '04':'Sistema inmune', '05':'Endocrino / Nutrición',
  '06':'Trastornos mentales — Neurodesarrollo',
  '07':'Trastornos del sueño', '08':'Sistema nervioso',
  '09':'Ojo', '10':'Oído', '11':'Sistema circulatorio',
  '12':'Sistema respiratorio', '13':'Sistema digestivo',
  '14':'Piel', '15':'Músculo-esquelético', '16':'Genitourinario',
  '22':'Traumatismos', '24':'Factores de salud',
}

const CHAPTER_NAMES_EN: Record<string, string> = {
  '01':'Infectious diseases', '02':'Neoplasms', '03':'Blood',
  '04':'Immune system', '05':'Endocrine / Nutrition',
  '06':'Mental disorders — Neurodevelopment',
  '07':'Sleep disorders', '08':'Nervous system',
  '09':'Eye', '10':'Ear', '11':'Circulatory system',
  '12':'Respiratory system', '13':'Digestive system',
  '14':'Skin', '15':'Musculoskeletal', '16':'Genitourinary',
  '22':'Injuries', '24':'Health factors',
}

function esCodigo(c: string | null | undefined): boolean {
  return !!c && /^[0-9A-Z]{2,4}(\.[0-9A-Z]{1,3})?$/.test(c)
}

function chapterName(code: string, locale: string): string {
  return (locale === 'en' ? CHAPTER_NAMES_EN[code] : CHAPTER_NAMES[code]) || ''
}
