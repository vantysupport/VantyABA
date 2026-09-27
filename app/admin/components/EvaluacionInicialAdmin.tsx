'use client'
import { useCentroBranding } from '@/components/CentroBrandingContext'

// Panel de admin/especialista para gestionar la Evaluación Inicial de un paciente.
//
// El admin ve:
//  • Estado completo del flujo
//  • Intake del padre + 2ª anamnesis
//  • Análisis clínico completo de la IA (razonamiento, áreas, señales — uso interno)
//  • Terapias que eligió la familia
//  • Botón para ENVIAR RESPUESTA al padre
//  • Descarga del documento clínico interno

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n-context'
import {
  ClipboardCheck, Brain, Heart, Loader2, X, Sparkles, FileText, RefreshCw,
  CheckCircle2, User, Send, Award, Clock, MessageCircle, Edit3, Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { AnimatePresence, motion } from 'motion/react'
import { Wizard, Hero, RespuestasEvaluacion, seccionesEvaluacion, autoriaFicha } from '@/app/padre/components/EvaluacionInicialView'

type Props = { childId: string; childName: string }

type ModoFicha = { tipo: 'intake' | 'anamnesis'; accion: 'llenar' | 'editar' }

// Editor a pantalla completa para que el equipo llene o corrija una ficha (mismo asistente que ve la familia)
function EditorFicha({ modo, evaluacion, childId, childName, onClose, onGuardado }: {
  modo: ModoFicha; evaluacion: any; childId: string; childName: string; onClose: () => void; onGuardado: () => void
}) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const secciones = seccionesEvaluacion(modo.tipo, evaluacion?.recomendacion, en)
  const inicial = modo.tipo === 'intake' ? evaluacion?.respuestas_intake : evaluacion?.anamnesis_especifica
  const [respuestas, setRespuestas] = useState<Record<string, any>>(() => inicial ? { ...inicial } : (modo.tipo === 'intake' ? { menor_nombre: childName } : {}))
  const [idx, setIdx] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const clave = `vanty_eval_equipo_${modo.accion}_${modo.tipo}_${childId}`

  const guardar = async () => {
    setEnviando(true); setError('')
    try {
      let r: Response
      if (modo.accion === 'editar') {
        r = await fetch('/api/evaluacion-inicial', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: evaluacion.id, [modo.tipo === 'intake' ? 'respuestas_intake' : 'anamnesis_especifica']: respuestas }) })
      } else if (modo.tipo === 'intake') {
        r = await fetch('/api/evaluacion-inicial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ child_id: childId, respuestas }) })
        const d = await r.clone().json().catch(() => ({}))
        // Igual que cuando la llena la familia: la IA sugiere el tipo de evaluación
        if (r.ok && d?.evaluacion?.id) await fetch('/api/evaluacion-inicial/analizar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.evaluacion.id }) }).catch(() => {})
      } else {
        r = await fetch('/api/evaluacion-inicial/anamnesis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluacion_id: evaluacion.id, respuestas }) })
      }
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d.error) throw new Error(d.error || `Error ${r.status}`)
      try { localStorage.removeItem(clave) } catch { /* sin storage */ }
      onGuardado()
    } catch (e: any) { setError(e.message) }
    finally { setEnviando(false) }
  }

  const titulo = modo.tipo === 'intake' ? L('Initial form', 'Ficha inicial')
    : evaluacion?.recomendacion === 'neuropsicologica' ? L('Neuropsychological form', 'Ficha neuropsicológica') : L('Psychological-emotional form', 'Ficha psicológica emocional')
  return (
    <motion.div className="v-scope fixed inset-0 z-[150] overflow-y-auto bg-v-bg text-left" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-v-border bg-v-elevated/90 px-4 py-3 backdrop-blur-xl sm:px-6">
        <span className="grid size-9 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Edit3 size={16} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-v-text" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{modo.accion === 'editar' ? L('Editing', 'Editando') : L('Filling in', 'Llenando')} · {titulo}</p>
          <p className="text-xs text-v-muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{childName} · {L('Changes are recorded with your name', 'Los cambios quedan registrados con tu nombre')}</p>
        </div>
        <button onClick={onClose} aria-label={L('Close', 'Cerrar')} className="grid size-9 place-items-center rounded-full text-v-muted hover:bg-v-fill"><X size={17} /></button>
      </div>
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6">
        {error && <p role="alert" className="mb-3 rounded-v-sm bg-v-danger/10 px-4 py-2 text-sm text-v-danger">{error}</p>}
        <Wizard clave={clave} secciones={secciones} seccionIdx={idx} setSeccionIdx={setIdx} respuestas={respuestas} setRespuestas={setRespuestas}
          enviando={enviando} textoEnviando={L('Saving…', 'Guardando…')}
          hero={<Hero Icon={ClipboardCheck} eyebrow={modo.accion === 'editar' ? L('Edit answers', 'Editar respuestas') : L('Filled in by the team', 'Llenada por el equipo')} titulo={titulo}>
            <p>{L('The family will see these answers as a record in their portal.', 'La familia verá estas respuestas como constancia en su portal.')}</p>
          </Hero>}
          onEnviar={guardar} />
      </div>
    </motion.div>
  )
}


// Render de texto con **negritas** y --- (markdown sencillo de la IA) → formato limpio
function RichText({ texto }: { texto: string }) {
  const lineas = (texto || '').split('\n')
  const renderInline = (linea: string, key: number) => {
    const partes = linea.split(/(\*\*[^*]+\*\*)/g)
    return (
      <p key={key} className="leading-relaxed mb-1.5 last:mb-0">
        {partes.map((p, i) => {
          if (p.startsWith('**') && p.endsWith('**')) {
            return <strong key={i} style={{ color: 'var(--v-text)', fontWeight: 800 }}>{p.slice(2, -2)}</strong>
          }
          // limpiar asteriscos sueltos
          return <span key={i}>{p.replace(/\*+/g, '')}</span>
        })}
      </p>
    )
  }
  return (
    <div>
      {lineas.map((ln, i) => {
        const t = ln.trim()
        if (t === '') return null
        if (/^[-—*_]{2,}$/.test(t)) {
          return <hr key={i} className="my-2.5 border-0 h-px" style={{ background: 'var(--v-border)' }} />
        }
        // Títulos markdown (#, ##, ###) → subtítulo limpio
        const titulo = t.match(/^#{1,6}\s+(.*)$/)
        if (titulo) return <p key={i} className="mb-1.5 mt-3 text-sm font-semibold text-v-text first:mt-0">{titulo[1].replace(/\*+/g, '')}</p>
        // Viñetas (- o •) → punto de lista
        const vineta = t.match(/^[-•]\s+(.*)$/)
        if (vineta) return <div key={i} className="flex gap-2">{'•'}{renderInline(vineta[1], i)}</div>
        return renderInline(ln, i)
      })}
    </div>
  )
}

export default function EvaluacionInicialAdmin({ childId, childName }: Props) {
  const { name: centroNombre } = useCentroBranding()
  const { t, locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [loading, setLoading] = useState(true)
  const [evaluacion, setEvaluacion] = useState<any>(null)
  const [terapias, setTerapias] = useState<any[]>([])  // catálogo completo
  const [reanalizando, setReanalizando] = useState(false)
  const [reRecomendando, setReRecomendando] = useState(false)
  const [generandoWord, setGenerandoWord] = useState(false)
  const [showResponder, setShowResponder] = useState(false)
  const [respuesta, setRespuesta] = useState('')
  const [enviandoResp, setEnviandoResp] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [eliminando, setEliminando] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  // Editor de terapias: el especialista puede cambiar lo que eligió el padre
  const [showEditTerapias, setShowEditTerapias] = useState(false)
  const [seleccionEdit, setSeleccionEdit] = useState<string[]>([])
  const [notaCambio, setNotaCambio] = useState('')
  const [guardandoTerapias, setGuardandoTerapias] = useState(false)
  // Llenar / editar fichas desde el equipo
  const [modoFicha, setModoFicha] = useState<ModoFicha | null>(null)
  const [vista, setVista] = useState<'resumen' | 'intake' | 'anamnesis'>('resumen')
  const toast = useToast()

  useEffect(() => { if (childId) cargar() }, [childId])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) {
        supabase.from('profiles').select('*').eq('email', data.user.email).maybeSingle()
          .then(({ data: p }) => setProfile(p))
      }
    })
  }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const [e1, e2] = await Promise.all([
        fetch(`/api/evaluacion-inicial?child_id=${childId}`).then(r => r.json()),
        fetch('/api/terapias-catalogo?all=1').then(r => r.json()),
      ])
      if (e1.ok) setEvaluacion(e1.evaluacion)
      if (e2.ok) setTerapias(e2.terapias || [])
    } finally { setLoading(false) }
  }

  const reanalizar = async () => {
    if (!evaluacion?.id) return
    setReanalizando(true)
    try {
      const r = await fetch('/api/evaluacion-inicial/analizar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: evaluacion.id }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Error ${r.status}`)
      await cargar()
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setReanalizando(false) }
  }

  const regenerarInformeWord = async () => {
    if (!evaluacion?.id) return
    setGenerandoWord(true)
    try {
      const r = await fetch('/api/evaluacion-inicial/generar-informe-word', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacion_id: evaluacion.id }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      toast.success(L(`Report generated: ${d.file_name}`, `Informe generado: ${d.file_name}`))
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setGenerandoWord(false) }
  }

  const reRecomendarTerapias = async () => {
    if (!evaluacion?.id) return
    setReRecomendando(true)
    try {
      const r = await fetch('/api/evaluacion-inicial/recomendar-terapias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacion_id: evaluacion.id }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      await cargar()
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setReRecomendando(false) }
  }

  const abrirEditorTerapias = () => {
    setSeleccionEdit(evaluacion?.terapias_seleccionadas || [])
    setNotaCambio('')
    setShowEditTerapias(true)
  }

  const guardarSeleccionTerapias = async () => {
    if (!evaluacion?.id) return
    setGuardandoTerapias(true)
    try {
      const payload: any = {
        id: evaluacion.id,
        terapias_seleccionadas: seleccionEdit,
      }
      // Si la nota cambió, registrarla (campo opcional, va dentro del meta)
      if (notaCambio.trim()) {
        payload.nota_cambio_terapias = notaCambio.trim()
        payload.terapias_cambiadas_por_admin = true
      }
      const r = await fetch('/api/evaluacion-inicial', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (!r.ok || d.error) throw new Error(d.error || 'No se pudo guardar')
      setShowEditTerapias(false)
      await cargar()
    } catch (e: any) {
      toast.error(L('Could not save: ', 'No se pudo guardar: ') + e.message)
    } finally {
      setGuardandoTerapias(false)
    }
  }

  const eliminarEvaluacion = async () => {
    if (!evaluacion?.id) return
    setEliminando(true)
    try {
      const r = await fetch(`/api/evaluacion-inicial?id=${evaluacion.id}`, { method: 'DELETE' })
      const d = await r.json()
      if (!r.ok || d.error) throw new Error(d.error || 'No se pudo eliminar')
      setShowConfirmDelete(false)
      setEvaluacion(null)
    } catch (e: any) {
      toast.error(L('Could not delete: ', 'No se pudo eliminar: ') + e.message)
    } finally {
      setEliminando(false)
    }
  }

  const enviarRespuesta = async () => {
    if (!(respuesta || evaluacion?.respuesta_especialista || '').trim()) { toast.error(L('Write a reply first', 'Escribe una respuesta primero')); return }
    setEnviandoResp(true)
    try {
      const r = await fetch('/api/evaluacion-inicial/responder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluacion_id: evaluacion.id,
          respuesta: respuesta || evaluacion.respuesta_especialista || '',
          respondido_por: profile?.id,
        }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      setShowResponder(false)
      setRespuesta('')
      await cargar()
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setEnviandoResp(false) }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-v-accent" size={32} /></div>
  }


  const editor = (
    <AnimatePresence>
      {modoFicha && (
        <EditorFicha modo={modoFicha} evaluacion={evaluacion} childId={childId} childName={childName}
          onClose={() => setModoFicha(null)} onGuardado={async () => { setModoFicha(null); await cargar() }} />
      )}
    </AnimatePresence>
  )

  if (!evaluacion) {
    return (
      <div className="v-scope rounded-v border-2 border-dashed border-v-border p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-v-accent-soft text-v-accent"><ClipboardCheck size={26} /></span>
        <p className="mt-3 font-semibold text-v-text">{t("admin.sinEvalInicial")}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-v-muted">{L('The family has not filled it in yet. You can fill it in now (for example, during the first interview); the family will see it as a record.', 'La familia aún no la llena. Puedes llenarla tú ahora (por ejemplo, durante la primera entrevista); la familia la verá como constancia.')}</p>
        <button onClick={() => setModoFicha({ tipo: 'intake', accion: 'llenar' })} className="v-brand mt-5 inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold">
          <Edit3 size={16} /> {L('Fill in the initial form', 'Llenar la ficha inicial')}
        </button>
        {editor}
      </div>
    )
  }

  const areas = evaluacion.recomendacion_areas || {}
  const terapiasElegidas = terapias.filter(tx => (evaluacion.terapias_seleccionadas || []).includes(tx.id))
  const bcp = en ? 'en-US' : 'es-PE'
  const fecha = (x?: string | null) => (x ? new Date(x).toLocaleDateString(bcp, { day: 'numeric', month: 'short' }) : null)
  const estado = evaluacion.estado as string
  const pasoActual = ({ pendiente_intake: 0, analizando: 1, recomendado: 2, rechazado: 2, confirmado: 3, anamnesis_completa: 4, terapia_seleccionada: 5, revisado: 6, completado: 7 } as Record<string, number>)[estado] ?? 0
  const pasos = [
    { t: L('Initial form', 'Ficha inicial'), f: evaluacion.intake_completado_en },
    { t: L('AI analysis', 'Análisis IA'), f: evaluacion.recomendacion_generada_en },
    { t: L('Family confirms', 'Familia confirma'), f: evaluacion.confirmado_en },
    { t: L('Second form', 'Ficha 2'), f: evaluacion.anamnesis_completada_en },
    { t: L('Therapies', 'Terapias'), f: evaluacion.seleccionado_en },
    { t: L('Your reply', 'Tu respuesta'), f: evaluacion.respondido_en },
    { t: L('Done', 'Listo'), f: null },
  ]
  const ESTADO: Record<string, { t: string; tone: string }> = {
    pendiente_intake: { t: L('Waiting for the initial form', 'Esperando la ficha inicial'), tone: 'bg-v-fill text-v-muted' },
    analizando: { t: L('AI is analyzing', 'La IA está analizando'), tone: 'bg-v-accent-soft text-v-accent' },
    recomendado: { t: L('Waiting for the family to confirm', 'Esperando que la familia confirme'), tone: 'bg-v-accent-soft text-v-accent' },
    confirmado: { t: L('Second form in progress', 'Ficha 2 en curso'), tone: 'bg-v-accent-soft text-v-accent' },
    anamnesis_completa: { t: L('Family choosing therapies', 'La familia elige terapias'), tone: 'bg-v-accent-soft text-v-accent' },
    terapia_seleccionada: { t: L('Waiting for your reply', 'Esperando tu respuesta'), tone: 'bg-v-warning/15 text-v-warning' },
    revisado: { t: L('Reply sent', 'Respuesta enviada'), tone: 'bg-v-success/15 text-v-success' },
    completado: { t: L('Completed', 'Completada'), tone: 'bg-v-success/15 text-v-success' },
    rechazado: { t: L('Family has questions · contact them', 'La familia tiene dudas · contáctala'), tone: 'bg-v-danger/10 text-v-danger' },
  }
  const est = ESTADO[estado] || ESTADO.pendiente_intake
  const recTexto = evaluacion.recomendacion === 'psicologica' ? L('Psychological-emotional evaluation', 'Evaluación psicológica emocional')
    : evaluacion.recomendacion === 'neuropsicologica' ? L('Neuropsychological evaluation', 'Evaluación neuropsicológica') : L('Both evaluations', 'Ambas evaluaciones')
  const card = 'rounded-v border border-v-border bg-v-elevated shadow-v'
  const btnSec = 'inline-flex h-9 items-center gap-1.5 rounded-full border border-v-border bg-v-elevated px-3.5 text-xs font-semibold text-v-text transition-colors hover:bg-v-fill disabled:opacity-50'
  const urgenciaTone = areas.urgencia === 'alta' ? 'bg-v-danger/10 text-v-danger' : areas.urgencia === 'media' ? 'bg-v-warning/15 text-v-warning' : 'bg-v-success/15 text-v-success'
  const tabs = [
    { id: 'resumen' as const, label: L('Summary', 'Resumen'), Icon: Sparkles },
    { id: 'intake' as const, label: L('Initial form', 'Ficha inicial'), Icon: User },
    { id: 'anamnesis' as const, label: L('Second form', 'Ficha 2'), Icon: ClipboardCheck },
  ]

  const Ficha = ({ tipo }: { tipo: 'intake' | 'anamnesis' }) => {
    const resp = tipo === 'intake' ? evaluacion.respuestas_intake : evaluacion.anamnesis_especifica
    const autor = tipo === 'intake' ? autoriaFicha(evaluacion.intake_llenado_rol, evaluacion.intake_completado_en, en, false) : autoriaFicha(evaluacion.anamnesis_llenado_rol, evaluacion.anamnesis_completada_en, en, false)
    const puedeLlenar = tipo === 'intake' || !!evaluacion.recomendacion
    const titulo = tipo === 'intake' ? L('Initial form for parents', 'Ficha inicial para papás')
      : evaluacion.recomendacion === 'neuropsicologica' ? L('Neuropsychological form', 'Ficha neuropsicológica') : L('Psychological-emotional form', 'Ficha psicológica emocional')
    return (
      <div className={`${card} p-4 sm:p-5`}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <p className="flex-1 text-[15px] font-semibold text-v-text">{titulo}</p>
          {autor && <span className="rounded-full bg-v-fill px-2.5 py-0.5 text-[11px] text-v-muted">{autor}</span>}
          {(resp || puedeLlenar) && (
            <button onClick={() => setModoFicha({ tipo, accion: resp ? 'editar' : 'llenar' })} className={resp ? btnSec : 'v-brand inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold'}>
              <Edit3 size={13} /> {resp ? L('Edit answers', 'Editar respuestas') : L('Fill in', 'Llenar')}
            </button>
          )}
        </div>
        {resp
          ? <RespuestasEvaluacion secciones={seccionesEvaluacion(tipo, evaluacion.recomendacion, en)} respuestas={resp} abiertaInicial />
          : <p className="rounded-v-sm bg-v-fill/60 p-4 text-sm text-v-muted">{puedeLlenar ? L('The family has not filled in this form yet. You can fill it in for them.', 'La familia aún no llena esta ficha. Puedes llenarla tú.') : L('Available after the AI recommendation.', 'Disponible después de la recomendación de la IA.')}</p>}
        {evaluacion.editado_en && <p className="mt-3 text-[11px] text-v-subtle">{L('Last edited by the team: ', 'Última edición del equipo: ')}{new Date(evaluacion.editado_en).toLocaleString(bcp, { dateStyle: 'medium', timeStyle: 'short' })}</p>}
      </div>
    )
  }

  return (
    <div className="v-scope space-y-4">
      {/* Encabezado: estado, línea de tiempo y acciones */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`relative overflow-hidden ${card} p-4 sm:p-5`}>
        <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><ClipboardCheck size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-v-muted">{L('Initial evaluation', 'Evaluación inicial')}</p>
            <h2 className="truncate text-lg font-semibold tracking-tight text-v-text">{childName}</h2>
            <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${est.tone}`}>
              {estado === 'terapia_seleccionada' && <span className="size-1.5 animate-pulse rounded-full bg-current" />} {est.t}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {estado === 'terapia_seleccionada' && (
              <button onClick={() => setShowResponder(true)} className="v-brand inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold"><Send size={14} /> {L('Reply to the family', 'Responder a la familia')}</button>
            )}
            {(estado === 'revisado' || estado === 'completado') && (
              <button onClick={() => setShowResponder(true)} className={btnSec}><Edit3 size={14} /> {L('Edit reply', 'Editar respuesta')}</button>
            )}
            {evaluacion.respuestas_intake && (
              <button onClick={reanalizar} disabled={reanalizando} className={btnSec}>
                {reanalizando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-v-accent" />} {evaluacion.recomendacion ? L('Re-analyze', 'Re-analizar') : L('Analyze with AI', 'Analizar con IA')}
              </button>
            )}
            {evaluacion.anamnesis_especifica && (
              <button onClick={regenerarInformeWord} disabled={generandoWord} className={btnSec}>
                {generandoWord ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} className="text-v-accent" />} {L('Word report', 'Informe Word')}
              </button>
            )}
            <button onClick={() => setShowConfirmDelete(true)} aria-label={L('Delete', 'Eliminar')} title={L('Delete evaluation', 'Eliminar evaluación')}
              className="grid size-9 place-items-center rounded-full border border-v-border text-v-danger transition-colors hover:bg-v-danger/10"><Trash2 size={14} /></button>
          </div>
        </div>

        {/* Línea de tiempo */}
        <ol className="mt-5 grid grid-cols-[repeat(7,minmax(0,1fr))] gap-1">
          {pasos.map((p, i) => {
            const hecho = i < pasoActual, actual = i === pasoActual
            return (
              <li key={i} className="min-w-0">
                <div className={`h-1.5 rounded-full ${hecho ? 'v-brand' : actual ? 'bg-v-accent/35' : 'bg-v-fill'}`} style={hecho ? { boxShadow: 'none' } : undefined} />
                <p className={`mt-1.5 hidden truncate text-[11px] font-semibold sm:block ${hecho || actual ? 'text-v-text' : 'text-v-subtle'}`}>{p.t}</p>
                <p className="hidden truncate text-[10px] text-v-subtle sm:block">{fecha(p.f) || (actual ? L('In progress', 'En curso') : '')}</p>
              </li>
            )
          })}
        </ol>
      </motion.div>

      {/* Aviso: la familia espera respuesta */}
      {estado === 'terapia_seleccionada' && (
        <div className="flex flex-wrap items-center gap-3 rounded-v border border-v-warning/40 bg-v-warning/10 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-v-warning text-white"><Send size={17} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-v-text">{L('The family is waiting for your reply', 'La familia espera tu respuesta')}</p>
            <p className="text-xs text-v-muted">{L(`They chose ${terapiasElegidas.length} therap${terapiasElegidas.length === 1 ? 'y' : 'ies'}. Review the information and send a personalized message.`, `Eligió ${terapiasElegidas.length} terapia${terapiasElegidas.length === 1 ? '' : 's'}. Revisa la información y envía un mensaje personalizado.`)}</p>
          </div>
          <button onClick={() => setShowResponder(true)} className="v-brand inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold"><Send size={14} /> {L('Reply', 'Responder')}</button>
        </div>
      )}

      {/* Pestañas */}
      <div className="flex gap-1 overflow-x-auto rounded-full bg-v-fill p-1 [scrollbar-width:none] sm:w-fit">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setVista(id)} className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${vista === id ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
            {vista === id && <motion.span layoutId="eval-admin-tab" transition={{ type: 'spring', stiffness: 400, damping: 32 }} className="absolute inset-0 rounded-full bg-v-elevated shadow-v" />}
            <Icon size={15} className="relative" /><span className="relative">{label}</span>
            {id === 'anamnesis' && !evaluacion.anamnesis_especifica && <span className="relative size-1.5 rounded-full bg-v-warning" />}
          </button>
        ))}
      </div>

      {vista === 'intake' && Ficha({ tipo: 'intake' })}
      {vista === 'anamnesis' && Ficha({ tipo: 'anamnesis' })}

      {vista === 'resumen' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          {/* Columna principal: análisis de la IA */}
          <div className="space-y-4">
            {evaluacion.recomendacion ? (
              <div className={`${card} p-4 sm:p-5`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent">{evaluacion.recomendacion === 'psicologica' ? <Heart size={15} /> : <Brain size={15} />}</span>
                  <p className="flex-1 text-[15px] font-semibold text-v-text">{L('AI recommendation', 'Recomendación de la IA')}</p>
                  <span className="rounded-full bg-v-warning/15 px-2 py-0.5 text-[10px] font-semibold text-v-warning">{L('Internal use', 'Uso interno')}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-v-accent-soft px-3 py-1 text-xs font-semibold text-v-accent">{recTexto}</span>
                  {areas.urgencia && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${urgenciaTone}`}>{L('Urgency', 'Urgencia')}: {String(areas.urgencia)}</span>}
                </div>
                {evaluacion.recomendacion_razon && (
                  <div className="mt-4 rounded-v-sm bg-v-fill/60 p-4 text-sm leading-relaxed text-v-muted"><RichText texto={evaluacion.recomendacion_razon} /></div>
                )}
                {(areas.areas_a_evaluar?.length > 0 || areas.señales_detectadas?.length > 0) && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {areas.areas_a_evaluar?.length > 0 && (
                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-v-subtle">{L('Areas to evaluate', 'Áreas a evaluar')}</p>
                        <div className="flex flex-wrap gap-1.5">{areas.areas_a_evaluar.map((a: string, i: number) => <span key={i} className="rounded-full bg-v-fill px-2.5 py-1 text-xs text-v-text">{a}</span>)}</div>
                      </div>
                    )}
                    {areas.señales_detectadas?.length > 0 && (
                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-v-subtle">{L('Signals detected', 'Señales detectadas')}</p>
                        <ul className="space-y-1.5 text-xs text-v-muted">{areas.señales_detectadas.map((sx: any, i: number) => <li key={i}><span className="font-semibold text-v-text">{sx.categoria}:</span> {sx.descripcion}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}
                {evaluacion.mensaje_amigable_padre && (
                  <details className="mt-4 rounded-v-sm border border-v-border p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-v-accent">{L('Message the family saw', 'Mensaje que vio la familia')}</summary>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-v-muted">{evaluacion.mensaje_amigable_padre}</p>
                  </details>
                )}
              </div>
            ) : (
              <div className={`${card} p-6 text-center`}>
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-v-accent-soft text-v-accent"><Brain size={20} /></span>
                <p className="mt-3 text-sm font-semibold text-v-text">{L('No AI analysis yet', 'Aún sin análisis de la IA')}</p>
                {evaluacion.respuestas_intake && <button onClick={reanalizar} disabled={reanalizando} className="v-brand mt-3 inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold">{reanalizando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {L('Analyze now', 'Analizar ahora')}</button>}
              </div>
            )}

            {/* Terapias recomendadas por la IA */}
            {evaluacion.terapias_recomendadas?.length > 0 ? (
              <div className={`${card} p-4 sm:p-5`}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Sparkles size={15} /></span>
                  <p className="flex-1 text-[15px] font-semibold text-v-text">{L('Therapies recommended by AI', 'Terapias recomendadas por la IA')}</p>
                  {evaluacion.anamnesis_especifica && <button onClick={reRecomendarTerapias} disabled={reRecomendando} className={btnSec}>{reRecomendando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} {L('Recalculate', 'Recalcular')}</button>}
                </div>
                <div className="space-y-2">
                  {evaluacion.terapias_recomendadas.map((id: string, i: number) => {
                    const tx = terapias.find(x => x.id === id)
                    if (!tx) return null
                    const elegida = (evaluacion.terapias_seleccionadas || []).includes(id)
                    return (
                      <div key={id} className="flex items-center gap-3 rounded-v-sm border border-v-border bg-v-bg p-2.5">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-v-accent text-xs font-bold text-white">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-v-text">{tx.nombre}</span>
                          <span className="block truncate text-xs text-v-subtle">{[tx.categoria, tx.duracion, tx.precio ? `${tx.precio} ${tx.moneda || ''}` : null].filter(Boolean).join(' · ')}</span>
                        </span>
                        {elegida && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-v-success/15 px-2 py-0.5 text-[10px] font-semibold text-v-success"><CheckCircle2 size={10} /> {L('Chosen', 'Elegida')}</span>}
                      </div>
                    )
                  })}
                </div>
                {evaluacion.terapias_recomendadas_razon && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-v-accent">{L('See the AI reasoning', 'Ver el razonamiento de la IA')}</summary>
                    <div className="mt-2 rounded-v-sm bg-v-fill/60 p-3 text-sm text-v-muted"><RichText texto={evaluacion.terapias_recomendadas_razon} /></div>
                  </details>
                )}
              </div>
            ) : evaluacion.anamnesis_especifica ? (
              <div className="flex flex-wrap items-center gap-3 rounded-v border border-dashed border-v-border p-4">
                <Sparkles size={16} className="shrink-0 text-v-accent" />
                <p className="min-w-0 flex-1 text-sm text-v-muted">{L('The AI has not recommended therapies yet.', 'La IA aún no recomendó terapias.')}</p>
                <button onClick={reRecomendarTerapias} disabled={reRecomendando} className="v-brand inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold">{reRecomendando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {L('Generate now', 'Generar ahora')}</button>
              </div>
            ) : null}
          </div>

          {/* Columna lateral: lo que eligió la familia y la comunicación */}
          <div className="space-y-4">
            <div className={`${card} p-4 sm:p-5`}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="grid size-8 place-items-center rounded-[30%] bg-v-warning/15 text-v-warning"><Award size={15} /></span>
                <p className="flex-1 text-[15px] font-semibold text-v-text">{L('Chosen therapies', 'Terapias elegidas')}</p>
                <button onClick={abrirEditorTerapias} className={btnSec}><Edit3 size={13} /> {L('Change', 'Cambiar')}</button>
              </div>
              {evaluacion.terapias_cambiadas_por_admin && <span className="mb-2 inline-block rounded-full bg-v-accent-soft px-2 py-0.5 text-[10px] font-semibold text-v-accent">{L('Adjusted by the team', 'Ajustada por el equipo')}</span>}
              {terapiasElegidas.length === 0
                ? <p className="text-sm text-v-muted">{L('The family has not chosen yet. You can select them based on your clinical judgment.', 'La familia aún no elige. Puedes seleccionarlas según tu criterio clínico.')}</p>
                : <div className="space-y-2">{terapiasElegidas.map(tx => (
                    <div key={tx.id} className="flex items-center gap-3 rounded-v-sm bg-v-fill/60 p-2.5">
                      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-[30%] bg-v-success/15 text-v-success">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {tx.imagen_url ? <img src={tx.imagen_url} alt="" className="size-full object-cover" /> : <CheckCircle2 size={16} />}
                      </span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-v-text">{tx.nombre}</span><span className="block truncate text-xs text-v-subtle">{[tx.categoria, tx.duracion].filter(Boolean).join(' · ')}</span></span>
                    </div>
                  ))}</div>}
              {evaluacion.nota_cambio_terapias && <p className="mt-3 rounded-v-sm border-l-2 border-v-accent bg-v-accent-soft/40 px-3 py-2 text-xs text-v-text"><span className="font-semibold">{L('Team note: ', 'Nota del equipo: ')}</span>{evaluacion.nota_cambio_terapias}</p>}
            </div>

            {evaluacion.mensaje_al_especialista && (
              <div className="rounded-v border border-v-warning/30 bg-v-warning/10 p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-v-warning"><MessageCircle size={13} /> {L('Message from the family', 'Mensaje de la familia')}</p>
                <p className="mt-1.5 text-sm italic text-v-text">“{evaluacion.mensaje_al_especialista}”</p>
              </div>
            )}

            {evaluacion.respuesta_especialista && (
              <div className="rounded-v border border-v-success/30 bg-v-success/10 p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-v-success"><CheckCircle2 size={13} /> {L('Reply sent to the family', 'Respuesta enviada a la familia')}{evaluacion.respondido_en && <span className="font-normal text-v-muted">· {fecha(evaluacion.respondido_en)}</span>}</p>
                <p className="mt-2 whitespace-pre-wrap rounded-v-sm bg-v-elevated p-3 text-sm text-v-text">{evaluacion.respuesta_especialista}</p>
              </div>
            )}

            <div className={`${card} p-4`}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-v-subtle">{L('Forms', 'Fichas')}</p>
              {[{ id: 'intake' as const, t: L('Initial form', 'Ficha inicial'), ok: !!evaluacion.respuestas_intake, a: autoriaFicha(evaluacion.intake_llenado_rol, evaluacion.intake_completado_en, en, false) },
                { id: 'anamnesis' as const, t: L('Second form', 'Ficha 2'), ok: !!evaluacion.anamnesis_especifica, a: autoriaFicha(evaluacion.anamnesis_llenado_rol, evaluacion.anamnesis_completada_en, en, false) }].map(f => (
                <button key={f.id} onClick={() => setVista(f.id)} className="flex w-full items-center gap-3 rounded-v-sm p-2 text-left hover:bg-v-fill/60">
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full ${f.ok ? 'bg-v-success/15 text-v-success' : 'bg-v-fill text-v-subtle'}`}>{f.ok ? <CheckCircle2 size={14} /> : <Clock size={14} />}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-v-text">{f.t}</span><span className="block truncate text-xs text-v-subtle">{f.ok ? f.a : L('Pending', 'Pendiente')}</span></span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {editor}

      {/* Confirmar eliminación */}
      <AnimatePresence>
        {showConfirmDelete && (
          <motion.div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#081426]/50 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !eliminando && setShowConfirmDelete(false)}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md rounded-v-lg border border-v-border bg-v-elevated p-6 shadow-v-lg" onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-v-danger/10 text-v-danger"><Trash2 size={18} /></span>
                <div>
                  <p className="text-base font-semibold text-v-text">{L('Delete the initial evaluation?', '¿Eliminar la evaluación inicial?')}</p>
                  <p className="mt-1 text-sm text-v-muted">{L(`Both forms, the AI recommendation and the chosen therapies for ${childName} will be permanently deleted. This cannot be undone.`, `Se borrarán para siempre las dos fichas, la recomendación de la IA y las terapias elegidas de ${childName}. No se puede deshacer.`)}</p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setShowConfirmDelete(false)} disabled={eliminando} className="h-10 rounded-full px-4 text-sm font-semibold text-v-muted hover:bg-v-fill">{L('Cancel', 'Cancelar')}</button>
                <button onClick={eliminarEvaluacion} disabled={eliminando} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-v-danger px-4 text-sm font-semibold text-white disabled:opacity-60">
                  {eliminando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} {L('Yes, delete', 'Sí, eliminar')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cambiar selección de terapias */}
      <AnimatePresence>
        {showEditTerapias && (
          <motion.div className="fixed inset-0 z-[150] flex items-end justify-center bg-[#081426]/50 backdrop-blur-sm sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !guardandoTerapias && setShowEditTerapias(false)}>
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-v-lg border border-v-border bg-v-elevated shadow-v-lg sm:rounded-v-lg" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 border-b border-v-border px-5 py-4">
                <span className="grid size-9 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Edit3 size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-v-text">{L('Change therapies', 'Cambiar terapias')}</p>
                  <p className="truncate text-xs text-v-muted">{L(`Your selection replaces the family's for ${childName}.`, `Tu selección reemplaza la de la familia para ${childName}.`)}</p>
                </div>
                <button onClick={() => setShowEditTerapias(false)} disabled={guardandoTerapias} aria-label={L('Close', 'Cerrar')} className="grid size-9 place-items-center rounded-full text-v-muted hover:bg-v-fill"><X size={17} /></button>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                <p className="text-[11px] font-semibold text-v-subtle">{L(`Catalog · ${seleccionEdit.length} selected`, `Catálogo · ${seleccionEdit.length} seleccionada${seleccionEdit.length === 1 ? '' : 's'}`)}</p>
                {terapias.length === 0 ? <p className="py-8 text-center text-sm text-v-muted">{L('No active therapies in the catalog.', 'No hay terapias activas en el catálogo.')}</p> : terapias.map(tx => {
                  const sel = seleccionEdit.includes(tx.id)
                  const ia = (evaluacion.terapias_recomendadas || []).includes(tx.id)
                  const familia = (evaluacion.terapias_seleccionadas || []).includes(tx.id)
                  return (
                    <button key={tx.id} onClick={() => setSeleccionEdit(arr => arr.includes(tx.id) ? arr.filter(x => x !== tx.id) : [...arr, tx.id])}
                      className={`flex w-full items-center gap-3 rounded-v-sm border p-3 text-left transition-all ${sel ? 'border-v-accent/50 bg-v-accent-soft/60 ring-4 ring-v-accent-soft' : 'border-v-border bg-v-bg hover:border-v-accent/30'}`}>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-v-text">{tx.nombre}</span>
                          {ia && <span className="rounded-full bg-v-accent-soft px-1.5 py-0.5 text-[9px] font-bold text-v-accent">{L('AI', 'IA')}</span>}
                          {familia && <span className="rounded-full bg-v-warning/15 px-1.5 py-0.5 text-[9px] font-bold text-v-warning">{L('Family', 'Familia')}</span>}
                        </span>
                        <span className="block truncate text-xs text-v-subtle">{[tx.categoria, tx.modalidad, tx.duracion, tx.precio != null ? `${tx.precio} ${tx.moneda || 'PEN'}` : null].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className={`grid size-6 shrink-0 place-items-center rounded-full ${sel ? 'bg-v-accent text-white' : 'border-2 border-v-border'}`}>{sel && <CheckCircle2 size={14} />}</span>
                    </button>
                  )
                })}
              </div>
              <div className="border-t border-v-border p-4">
                <label className="mb-1.5 block text-xs font-semibold text-v-muted">{L('Clinical note (optional): why this change', 'Nota clínica (opcional): por qué el cambio')}</label>
                <textarea value={notaCambio} onChange={e => setNotaCambio(e.target.value)} rows={2} className="w-full resize-none rounded-v-sm border border-v-border bg-v-bg px-3 py-2 text-sm text-v-text outline-none focus:ring-4 focus:ring-v-accent-soft" />
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => setShowEditTerapias(false)} disabled={guardandoTerapias} className="h-10 rounded-full px-4 text-sm font-semibold text-v-muted hover:bg-v-fill">{L('Cancel', 'Cancelar')}</button>
                  <button onClick={guardarSeleccionTerapias} disabled={guardandoTerapias || seleccionEdit.length === 0} className="v-brand inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-sm font-semibold disabled:opacity-50">
                    {guardandoTerapias ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {L('Save selection', 'Guardar selección')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Responder a la familia */}
      <AnimatePresence>
        {showResponder && (
          <motion.div className="fixed inset-0 z-[150] flex items-end justify-center bg-[#081426]/50 backdrop-blur-sm sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowResponder(false)}>
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-2xl rounded-t-v-lg border border-v-border bg-v-elevated p-5 shadow-v-lg sm:rounded-v-lg" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-[30%] bg-v-success/15 text-v-success"><MessageCircle size={16} /></span>
                <p className="flex-1 text-base font-semibold text-v-text">{L('Reply to the family', 'Responder a la familia')}</p>
                <button onClick={() => setShowResponder(false)} aria-label={L('Close', 'Cerrar')} className="grid size-9 place-items-center rounded-full text-v-muted hover:bg-v-fill"><X size={17} /></button>
              </div>
              <p className="mt-3 rounded-v-sm bg-v-fill/60 p-3 text-xs text-v-muted">{L('The family will see it in their portal and receive a notification. Be warm, clear and professional: confirm therapies, propose schedules or ask for more information.', 'La familia lo verá en su portal y recibirá una notificación. Sé cálido, claro y profesional: confirma terapias, propone horarios o pide información adicional.')}</p>
              <textarea value={respuesta || evaluacion.respuesta_especialista || ''} onChange={e => setRespuesta(e.target.value)} rows={9}
                placeholder={L(`Hello, I'm [your name], specialist at ${centroNombre}. I reviewed ${childName}'s case and…`, `Hola, soy [tu nombre], especialista de ${centroNombre}. Revisé el caso de ${childName} y…`)}
                className="mt-3 w-full resize-none rounded-v-sm border border-v-border bg-v-bg px-4 py-3 text-sm text-v-text outline-none focus:ring-4 focus:ring-v-accent-soft" />
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setShowResponder(false)} className="h-10 rounded-full px-4 text-sm font-semibold text-v-muted hover:bg-v-fill">{L('Cancel', 'Cancelar')}</button>
                <button onClick={enviarRespuesta} disabled={enviandoResp} className="v-brand inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-sm font-semibold disabled:opacity-60">
                  {enviandoResp ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {L('Send to the family', 'Enviar a la familia')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
