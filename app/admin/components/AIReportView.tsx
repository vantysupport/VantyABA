'use client'
import React from 'react'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'

import { useState, useEffect, useRef, useCallback } from 'react'
import ProgresoGraficas from '@/components/graficos/ProgresoGraficas'
import {
  Activity, Brain, CheckCircle2, ChevronDown, ChevronRight, Clock, Download, Eye, FileCheck, FileDown, FileText, History, Home, Loader2, MessageCircle, RefreshCw, Send, ShieldAlert, Sparkles, Target, User, Users, X, Zap, Mic, MicOff, Volume2, VolumeX, StopCircle, BarChart3, ClipboardList
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

// ── Tipos Web Speech API ──────────────────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

// ── Hook Text-to-Speech con ElevenLabs (Ivanna) ──────────────────────────────
function useTextToSpeech() {
  const { t, locale } = useI18n()
  const [speaking, setSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)  // Desactivado por defecto para evitar audio inesperado
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const speak = useCallback(async (text: string) => {
    if (!voiceEnabled || !text.trim()) return

    abortRef.current?.abort()
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }

    abortRef.current = new AbortController()
    setSpeaking(true)

    try {
      const res = await fetch('/api/elevenlabs-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ text, locale: localStorage.getItem('vanty_locale') || 'es' }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url) }
      audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url) }
      audio.play()
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('ElevenLabs TTS falló, usando fallback del navegador')
        if ('speechSynthesis' in window) {
          const clean = text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\n{2,}/g, '. ').trim().slice(0, 4000)
          const utter = new SpeechSynthesisUtterance(clean)
          utter.lang = toBCP47(locale); utter.rate = 1.05
          utter.onend = () => setSpeaking(false)
          utter.onerror = () => setSpeaking(false)
          window.speechSynthesis.speak(utter)
        } else { setSpeaking(false) }
      } else { setSpeaking(false) }
    }
  }, [voiceEnabled])

  const stopSpeaking = useCallback(() => {
    abortRef.current?.abort()
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const toggleVoice = useCallback(() => {
    if (speaking) {
      abortRef.current?.abort()
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
    setVoiceEnabled(v => !v)
  }, [speaking])

  return { speak, stopSpeaking, speaking, voiceEnabled, toggleVoice }
}

// ── Hook Speech-to-Text ───────────────────────────────────────────────────────
function useSpeechToText(onResult: (text: string) => void) {
  const { t, locale } = useI18n()
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SR) {
      setSupported(true)
      const rec = new SR()
      rec.lang = toBCP47(locale)
      rec.continuous = false
      rec.interimResults = false
      rec.onresult = (e: any) => onResult(e.results[0][0].transcript)
      rec.onend = () => setListening(false)
      rec.onerror = () => setListening(false)
      recognitionRef.current = rec
    }
  }, [onResult])

  const startListening = useCallback(() => {
    if (!recognitionRef.current || listening) return
    setListening(true)
    recognitionRef.current.start()
  }, [listening])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  return { listening, supported, startListening, stopListening }
}
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import ReportGenerator from '@/components/ReportGenerator'

function AIReportView({ onChildSelect, initialChildId }: { onChildSelect?: (child: {id: string, name: string} | null) => void; initialChildId?: string }) {
  const { t, locale } = useI18n()
  const [listaNinos, setListaNinos] = useState<any[]>([])
  const [selectedChild, setSelectedChild] = useState(initialChildId || '')
  const [historyData, setHistoryData] = useState<any>({ anamnesis: null, aba: [], entorno: [] })
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [reportesHistorial, setReportesHistorial] = useState<any[]>([])
  const [loadingReportes, setLoadingReportes] = useState(false)
  const [showReportPanel, setShowReportPanel] = useState(true)
  const [showAnamnesisReport, setShowAnamnesisReport] = useState(false)
  const [mobileTab, setMobileTab] = useState<'chat' | 'history' | 'reports' | 'graficas'>('chat')
  const [histFiltro, setHistFiltro] = useState<'todos' | 'programa' | 'aba' | 'hogar'>('todos')
  const [histLimite, setHistLimite] = useState(15)
  
  const [messages, setMessages] = useState<any[]>([
      { role: 'ai', text: locale === 'en' ? 'Hi 👋. Select a patient to start the clinical analysis.' : 'Hola 👋. Selecciona un paciente para iniciar el análisis clínico.' }
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // ── Voz ──
  const { speak, stopSpeaking, speaking, voiceEnabled, toggleVoice } = useTextToSpeech()

  const handleVoiceResult = useCallback((transcript: string) => {
    setInput(transcript)
    setTimeout(() => sendMessageWithText(transcript), 600)
  }, []) // eslint-disable-line

  const { listening, supported: micSupported, startListening, stopListening } = useSpeechToText(handleVoiceResult)

  useEffect(() => {
    supabase.from('children').select('id, name').then(({ data }: { data: any[] | null }) => {
      if (data) {
        setListaNinos(data)
        if (initialChildId) {
          handleSelectChild(initialChildId)
        }
      }
    })
  }, []) // eslint-disable-line

  useEffect(() => {
    if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, typing])

  const handleSelectChild = async (childId: string) => {
    setSelectedChild(childId)
    const selectedNino = listaNinos.find(n => n.id === childId)
    if (onChildSelect && selectedNino) {
      onChildSelect({ id: childId, name: selectedNino.name })
    }
    setHistoryData({ anamnesis: null, aba: [], entorno: [] }) 
    
    setMessages([{ role: 'ai', text: locale === 'en' ? 'Loading patient history...' : 'Cargando historial del paciente...' }])
    
    console.log('🔍 Buscando datos para child_id:', childId)
    
    // Buscar anamnesis en anamnesis_completa (llenada por admin)
    const { data: anamnesisAdmin } = await supabase
      .from('anamnesis_completa')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Si no hay, buscar en parent_forms (llenada por el padre)
    let anamnesisFromParent: any = null
    if (!anamnesisAdmin) {
      const { data: pf } = await supabase
        .from('parent_forms')
        .select('*')
        .eq('child_id', childId)
        .eq('status', 'completed')
        .in('form_type', ['anamnesis', 'historia_familiar', 'Historia Familiar y del Desarrollo'])
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (pf) {
        // Adaptar estructura para que sea compatible con el resto del código
        anamnesisFromParent = { datos: pf.responses, form_title: pf.form_title, created_at: pf.completed_at }
      }
    }

    const anamnesis = anamnesisAdmin || anamnesisFromParent
    console.log('📋 Anamnesis encontrada:', anamnesis ? (anamnesisAdmin ? 'admin' : 'padre') : 'No')
    
    const { data: aba, error: abaError } = await supabase
      .from('registro_aba')
      .select('*')
      .eq('child_id', childId)
      .order('fecha_sesion', { ascending: false })

    if (abaError) console.error('❌ Error cargando sesiones ABA (registro_aba):', abaError)
    console.log('📊 Sesiones ABA legacy (registro_aba):', aba?.length || 0)

    // Sesiones de DATOS ABA — las que se registran al evaluar un programa específico.
    // Esta es la fuente actual del gráfico de "Progreso ABA — Líneas" del padre.
    // Antes este conteo solo miraba registro_aba (legacy) y siempre daba 0 aunque
    // hubiera datos en los programas, lo que generaba la inconsistencia mostrada.
    // Las notas de sesión están cifradas: se piden al servidor, que las descifra.
    let sesionesDataAba: any[] = []
    try {
      const r = await fetch(`/api/programas-aba?child_id=${childId}&sesiones=1`, { cache: 'no-store' })
      const j = r.ok ? await r.json() : { data: [], programas: [] }
      const progTitulos: Record<string, string> = {}
      ;(j.programas || []).forEach((p: any) => { progTitulos[p.id] = p.titulo })
      sesionesDataAba = (j.data || []).map((s: any) => ({ ...s, _programaTitulo: progTitulos[s.programa_id] || 'Programa ABA' }))
    } catch { sesionesDataAba = [] }
    console.log('📊 Sesiones de programas (sesiones_datos_aba):', sesionesDataAba.length)

    // Total visible al usuario = legacy + actuales
    const totalSesionesAba = (aba?.length || 0) + sesionesDataAba.length
    
    const { data: entorno, error: entornoError } = await supabase
      .from('registro_entorno_hogar')
      .select('*')
      .eq('child_id', childId)
      .order('fecha_visita', { ascending: false })
    
    if (entornoError) console.error('❌ Error cargando visitas hogar:', entornoError)
    console.log('🏠 Visitas hogar encontradas:', entorno?.length || 0)

    const { data: brief2 } = await supabase
    .from('evaluacion_brief2')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  const { data: ados2 } = await supabase
    .from('evaluacion_ados2')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  const { data: vineland3 } = await supabase
    .from('evaluacion_vineland3')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  const { data: wiscv } = await supabase
    .from('evaluacion_wiscv')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  const { data: basc3 } = await supabase
    .from('evaluacion_basc3')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Load all completed NeuroForms and form_responses
  const { data: formResponses } = await supabase
    .from('form_responses')
    .select('id, form_type, form_title, ai_analysis, responses, created_at')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(30)

  // Helper: extract professional eval from form_responses if dedicated table is empty
  const fromFormResponses = (type: string) =>
    (formResponses || []).find((r: any) => r.form_type === type) || null;

  // Formularios completados por los padres
  const { data: parentFormsCompleted } = await supabase
    .from('parent_forms')
    .select('id, form_type, form_title, responses, completed_at')
    .eq('child_id', childId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(20)
     
  const resolvedBrief2   = brief2   || fromFormResponses('brief2');
  const resolvedAdos2    = ados2    || fromFormResponses('ados2');
  const resolvedVineland = vineland3 || fromFormResponses('vineland3');
  const resolvedWiscv    = wiscv    || fromFormResponses('wiscv');
  const resolvedBasc3    = basc3    || fromFormResponses('basc3');

  // Filter form_responses to exclude professional evals (already handled above)
  const filteredFormResponses = (formResponses || []).filter(
    (r: any) => !['brief2','ados2','vineland3','wiscv','basc3'].includes(r.form_type)
  );

  setHistoryData({
    anamnesis: anamnesis ? anamnesis.datos : null,
    aba: aba || [],
    sesionesDataAba: sesionesDataAba,             // registros nuevos por programa
    totalSesionesAba: totalSesionesAba,           // suma para badges
    entorno: entorno || [],
    brief2: resolvedBrief2,
    ados2: resolvedAdos2,
    vineland3: resolvedVineland,
    wiscv: resolvedWiscv,
    basc3: resolvedBasc3,
    parentForms: parentFormsCompleted || [],
  })
    
const nombre = listaNinos.find(n => n.id === childId)?.name || t('nav.pacientes').toLowerCase();
  const totalEvaluaciones = [resolvedBrief2, resolvedAdos2, resolvedVineland, resolvedWiscv, resolvedBasc3].filter(Boolean).length;
  const totalFormularios = (filteredFormResponses.length || 0) + (parentFormsCompleted?.length || 0)
  const parentFormsText = (parentFormsCompleted || []).length > 0
    ? `\n📨 **${locale === 'en' ? 'Parent Forms' : 'Formularios de Padres'} (${parentFormsCompleted!.length}):**\n${parentFormsCompleted!.slice(0,5).map((f: any) => `  • ${f.form_title || f.form_type} (${f.completed_at ? new Date(f.completed_at).toLocaleDateString(toBCP47(locale)) : (locale === 'en' ? 'No date' : 'Sin fecha')})`).join('\n')}`
    : '';
  
  // Añadir alertas si faltan datos críticos
  if (!anamnesis) {
    console.warn('⚠️ No se encontró anamnesis para este paciente')
  }
  if (!entorno || entorno.length === 0) {
    console.warn('⚠️ No se encontraron visitas domiciliarias para este paciente')
  }
      
     setMessages([{
    role: 'ai',
    text: locale === 'en'
      ? `✅ Complete history of **${nombre}** loaded.\n\n📊 **Professional Evaluations:** ${totalEvaluaciones}/5\n• ${resolvedBrief2 ? "✅" : "❌"} BRIEF-2\n• ${resolvedAdos2 ? "✅" : "❌"} ADOS-2\n• ${resolvedVineland ? "✅" : "❌"} Vineland-3\n• ${resolvedWiscv ? "✅" : "❌"} WISC-V\n• ${resolvedBasc3 ? "✅" : "❌"} BASC-3\n\n📋 **ABA Sessions:** ${totalSesionesAba}${sesionesDataAba.length > 0 ? ` _(${sesionesDataAba.length} records in programs)_` : ''}${(aba?.length || 0) > 0 && sesionesDataAba.length > 0 ? ` + ${aba?.length || 0} in legacy record` : ''}\n🏠 **Home Visits:** ${entorno?.length || 0}\n📝 **NeuroForms / Forms:** ${totalFormularios}${totalFormularios > 0 ? `\n${[...(filteredFormResponses), ...(parentFormsCompleted||[])].slice(0,8).map((f: any) => `  • ${f.form_title || f.form_type} (${new Date(f.completed_at || f.created_at).toLocaleDateString(toBCP47(locale))})`).join('\n')}` : ''}${!anamnesis ? '\n\n⚠️ Missing Initial Anamnesis' : ''}${(!entorno || entorno.length === 0) ? '\n⚠️ Missing Home Visit' : ''}\n\nWhat would you like to analyze?`
      : `✅ Historial completo de **${nombre}** cargado.\n\n📊 **Evaluaciones Profesionales:** ${totalEvaluaciones}/5\n• ${resolvedBrief2 ? "✅" : "❌"} BRIEF-2\n• ${resolvedAdos2 ? "✅" : "❌"} ADOS-2\n• ${resolvedVineland ? "✅" : "❌"} Vineland-3\n• ${resolvedWiscv ? "✅" : "❌"} WISC-V\n• ${resolvedBasc3 ? "✅" : "❌"} BASC-3\n\n📋 **Sesiones ABA:** ${totalSesionesAba}${sesionesDataAba.length > 0 ? ` _(${sesionesDataAba.length} registros en programas)_` : ''}${(aba?.length || 0) > 0 && sesionesDataAba.length > 0 ? ` + ${aba?.length || 0} en registro legacy` : ''}\n🏠 **Visitas Hogar:** ${entorno?.length || 0}\n📝 **NeuroFormas / Formularios:** ${totalFormularios}${totalFormularios > 0 ? `\n${[...(filteredFormResponses), ...(parentFormsCompleted||[])].slice(0,8).map((f: any) => `  • ${f.form_title || f.form_type} (${new Date(f.completed_at || f.created_at).toLocaleDateString(toBCP47(locale))})`).join('\n')}` : ''}${!anamnesis ? '\n\n⚠️ Falta Anamnesis Inicial' : ''}${(!entorno || entorno.length === 0) ? '\n⚠️ Falta Visita Domiciliaria' : ''}\n\n¿Qué deseas analizar?`
  }])

    // Cargar todos los reportes Word del paciente
    setLoadingReportes(true)
    const { data: allReportes } = await supabase
      .from('reportes_generados')
      .select('id, tipo_reporte, titulo, nombre_archivo, fecha_generacion, tamano_bytes, generado_por')
      .eq('child_id', childId)
      .order('fecha_generacion', { ascending: false })
    setReportesHistorial(allReportes || [])
    setLoadingReportes(false)
}

  const sendMessageWithText = async (text: string) => {
    if (!text.trim()) return
    if (!selectedChild) { alert(t('ui.seleccionaPrimero')); return }
    setMessages(prev => [...prev, { role: 'user', text }])
    setInput('')
    stopSpeaking()
    setTyping(true)
    try {
      const response = await fetch('/api/admin-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ question: text, childId: selectedChild , locale: localStorage.getItem('vanty_locale') || 'es' })
      })
      const data = await response.json()
      setMessages(prev => [...prev, { role: 'ai', text: data.text }])
      speak(data.text)
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: locale === 'en' ? '❌ Connection error.' : '❌ Error de conexión.' }])
    } finally {
      setTyping(false)
    }
  }

  const sendMessage = () => sendMessageWithText(input)

  const handleMicClick = () => {
    if (listening) { stopListening() }
    else { stopSpeaking(); startListening() }
  }

  const toggleCard = (id: string) => setExpandedCardId(expandedCardId === id ? null : id)

  // ── Línea de tiempo unificada del registro clínico ──
  type Kind = 'programa' | 'aba' | 'hogar'
  const items: { kind: Kind; key: string; fecha: Date | null; raw: any }[] = [
    ...(historyData.sesionesDataAba || []).map((x: any) => ({ kind: 'programa' as const, key: `sda-${x.id}`, fecha: x.fecha ? new Date(x.fecha + 'T12:00:00') : null, raw: x })),
    ...(historyData.aba || []).map((x: any) => ({ kind: 'aba' as const, key: `aba-${x.id}`, fecha: x.fecha_sesion ? new Date(String(x.fecha_sesion).slice(0, 10) + 'T12:00:00') : null, raw: x })),
    ...(historyData.entorno || []).map((x: any) => ({ kind: 'hogar' as const, key: `entorno-${x.id}`, fecha: x.fecha_visita ? new Date(String(x.fecha_visita).slice(0, 10) + 'T12:00:00') : null, raw: x })),
  ].sort((x, y) => (y.fecha?.getTime() ?? 0) - (x.fecha?.getTime() ?? 0))
  const KIND = {
    programa: { label: locale === 'en' ? 'Program sessions' : 'Sesiones de programas', Icon: ClipboardList },
    aba:      { label: locale === 'en' ? 'ABA session forms' : 'Fichas de sesión ABA', Icon: Target },
    hogar:    { label: locale === 'en' ? 'Home visits' : 'Visitas al hogar', Icon: Home },
  } as const
  const visibles = items.filter(it => histFiltro === 'todos' || it.kind === histFiltro)
  const mostrados = visibles.slice(0, histLimite)
  const grupos: { mes: string; items: typeof mostrados }[] = []
  for (const it of mostrados) {
    const mes = it.fecha ? it.fecha.toLocaleDateString(toBCP47(locale), { month: 'long', year: 'numeric' }) : '—'
    const g = grupos[grupos.length - 1]
    if (g && g.mes === mes) g.items.push(it); else grupos.push({ mes, items: [it] })
  }
  const pctTone = (pct: number | null) => pct == null ? 'text-v-subtle' : pct >= 90 ? 'text-v-success' : pct >= 70 ? 'text-v-accent' : pct >= 45 ? 'text-v-warning' : 'text-v-danger'
  const setLabel = (v: any) => { const t = String(v ?? '').trim(); return !t ? '' : /^set\b/i.test(t) ? t : `Set ${t}` }
  const faseLabel = (f: any) => ({ linea_base: 'Línea base', intervencion: 'Intervención', mantenimiento: 'Mantenimiento', dominado: 'Dominado' } as Record<string, string>)[f] || f || (locale === 'en' ? 'Session' : 'Sesión')

  return (
    <div className="v-scope flex flex-col gap-4">
      {!initialChildId && (
        <div className="flex flex-col items-start justify-between gap-4 rounded-v border border-v-border bg-v-elevated p-5 shadow-v md:flex-row md:items-center">
          <h3 className="flex items-center gap-3 text-lg font-semibold tracking-tight text-v-text">
            <span className="grid size-10 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Brain size={20} /></span>
            Analizador Inteligente
          </h3>
          <select onChange={e => handleSelectChild(e.target.value)} value={selectedChild}
            className="w-full rounded-full border border-v-border bg-v-bg px-4 py-2.5 text-sm font-medium text-v-text outline-none focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft md:w-[360px]">
            <option value="">{t('auto.aIReportView.seleccionarPaciente')}</option>
            {listaNinos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </div>
      )}

      {selectedChild ? (
        <div className="flex flex-col gap-4">

          {/* ══ REGISTRO CLÍNICO — línea de tiempo por mes ══ */}
          <AccordionSection
            id="historial"
            title={t('ui.clinical_record')}
            icon={<History size={17} />}
            badge={<span className="rounded-full bg-v-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-v-accent">{items.length} {locale === 'en' ? 'records' : 'registros'}</span>}
            defaultOpen
          >
            <div className="space-y-4 p-4 sm:p-5">
              {/* Filtros por tipo */}
              <div className="flex flex-wrap gap-2">
                {(['todos', 'programa', 'aba', 'hogar'] as const).map(k => {
                  const n = k === 'todos' ? items.length : items.filter(it => it.kind === k).length
                  if (k !== 'todos' && n === 0) return null
                  const on = histFiltro === k
                  const Icon = k === 'todos' ? History : KIND[k].Icon
                  return (
                    <button key={k} onClick={() => { setHistFiltro(k); setHistLimite(15) }}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${on ? 'border-v-accent/40 bg-v-accent-soft text-v-accent' : 'border-v-border bg-v-elevated text-v-muted hover:text-v-text'}`}>
                      <Icon size={13} /> {k === 'todos' ? (locale === 'en' ? 'All' : 'Todos') : KIND[k].label}
                      <span className="text-[10px] opacity-70">{n}</span>
                    </button>
                  )
                })}
              </div>

              {items.length === 0 ? (
                <div className="flex flex-col items-center rounded-v border border-dashed border-v-border py-14 text-center">
                  <span className="mb-3 grid size-12 place-items-center rounded-full bg-v-fill"><History size={20} className="text-v-subtle" /></span>
                  <p className="text-sm text-v-muted">{t('admin.sinRegistros')}</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {grupos.map(g => (
                    <div key={g.mes}>
                      <p className="sticky top-0 z-[1] mb-2 inline-flex rounded-full bg-v-elevated px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-v-subtle shadow-v">{g.mes}</p>
                      <div className="relative space-y-2 border-l-2 border-v-border pl-4 sm:ml-2">
                        {g.items.map(it => {
                          const open = expandedCardId === it.key
                          const Icon = KIND[it.kind].Icon
                          const r = it.raw
                          const d = r.datos || {}
                          const pct = it.kind === 'programa' ? (r.porcentaje_exito ?? null) : null
                          const titulo = it.kind === 'programa' ? (r._programaTitulo || (locale === 'en' ? 'Program' : 'Programa'))
                            : it.kind === 'aba' ? (d.conducta || (locale === 'en' ? 'ABA session' : 'Sesión ABA'))
                            : t('admin.visitaDomiciliaria')
                          const sub = it.kind === 'programa' ? [setLabel(r.set), faseLabel(r.fase)].filter(Boolean).join(' · ')
                            : it.kind === 'aba' ? (locale === 'en' ? 'ABA session form' : 'Ficha de sesión ABA')
                            : (locale === 'en' ? 'Home environment' : 'Entorno del hogar')
                          return (
                            <motion.div key={it.key} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                              className={`relative overflow-hidden rounded-v-sm border bg-v-elevated transition-colors ${open ? 'border-v-accent/40 shadow-v' : 'border-v-border hover:border-v-accent/30'}`}>
                              <span className={`absolute -left-[23px] top-5 size-3 rounded-full ring-4 ring-[var(--v-bg-elevated)] ${it.kind === 'hogar' ? 'bg-v-success' : 'bg-v-accent'}`} />
                              <button onClick={() => toggleCard(it.key)} className="flex w-full items-center gap-3 p-3 text-left">
                                <div className="flex w-12 shrink-0 flex-col items-center rounded-[30%] bg-v-fill py-1.5 text-v-muted">
                                  <span className="text-[9px] font-semibold uppercase leading-none">{it.fecha ? it.fecha.toLocaleDateString(toBCP47(locale), { month: 'short' }).replace('.', '') : '—'}</span>
                                  <span className="text-lg font-bold leading-tight tabular-nums text-v-text">{it.fecha ? it.fecha.getDate() : '·'}</span>
                                </div>
                                <span className={`grid size-8 shrink-0 place-items-center rounded-full ${it.kind === 'hogar' ? 'bg-v-success/15 text-v-success' : 'bg-v-accent-soft text-v-accent'}`}><Icon size={15} /></span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-v-text">{titulo}</p>
                                  <p className="truncate text-xs text-v-subtle">{sub}</p>
                                </div>
                                {pct != null && <span className={`text-base font-bold tabular-nums ${pctTone(pct)}`}>{pct}%</span>}
                                <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180 text-v-accent' : 'text-v-subtle'}`} />
                              </button>
                              <AnimatePresence initial={false}>
                                {open && (
                                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                                    <div className="space-y-3 border-t border-v-border bg-v-bg p-4">
                                      {it.kind === 'programa' && (
                                        <>
                                          <div className="grid grid-cols-3 gap-2">
                                            {[
                                              { v: pct != null ? `${pct}%` : '—', l: t('admin.exito'), tone: pctTone(pct) },
                                              { v: r.respuestas_correctas ?? '—', l: t('admin.correctas'), tone: 'text-v-text' },
                                              { v: r.oportunidades_totales ?? '—', l: locale === 'en' ? 'Opportunities' : 'Oportunidades', tone: 'text-v-text' },
                                            ].map(k => (
                                              <div key={k.l} className="rounded-v-sm border border-v-border bg-v-elevated p-3 text-center">
                                                <p className={`text-xl font-bold tabular-nums ${k.tone}`}>{k.v}</p>
                                                <p className="text-[11px] text-v-subtle">{k.l}</p>
                                              </div>
                                            ))}
                                          </div>
                                          {r.notas && <DetailBox title={t('common.notas')} content={r.notas} icon={<MessageCircle size={13} />} full />}
                                        </>
                                      )}
                                      {it.kind === 'aba' && (
                                        <>
                                          <DetailBox title={t('familias.objetivo')} content={d.objetivo_principal} icon={<Target size={13} />} full />
                                          <DetailBox title={t('ui.observations')} content={d.observaciones_tecnicas} icon={<Eye size={13} />} full />
                                          <div className="grid gap-3 sm:grid-cols-2">
                                            <DetailBox title="ABC" content={d.antecedente} icon={<Activity size={13} />} />
                                            <DetailBox title={t('ui.intervencion')} content={d.estrategias_manejo} icon={<Zap size={13} />} />
                                          </div>
                                          <DetailBox title={t('ui.mensajePadresLabel')} content={d.mensaje_padres} icon={<MessageCircle size={13} />} tone="family"
                                            extra={<span className="ml-auto rounded-full bg-v-warning/15 px-2 py-0.5 text-[10px] font-semibold text-v-warning">{t('ui.enBandeja')}</span>} full />
                                        </>
                                      )}
                                      {it.kind === 'hogar' && (
                                        <>
                                          <DetailBox title={t('ui.people_present')} content={d.personas_presentes} icon={<Users size={13} />} full />
                                          <DetailBox title={t('ui.behavior')} content={d.comportamiento_observado} icon={<Eye size={13} />} full />
                                          <DetailBox title={t('ui.ai_impression')} content={d.impresion_general} icon={<Sparkles size={13} />} full />
                                          <div className="grid gap-3 sm:grid-cols-2">
                                            <DetailBox title={t('ui.barriers')} content={d.barreras_identificadas} icon={<ShieldAlert size={13} />} tone="danger" />
                                            <DetailBox title={t('ui.facilitators')} content={d.facilitadores} icon={<CheckCircle2 size={13} />} tone="success" />
                                          </div>
                                          <DetailBox title={t('ui.mensajePadresLabel')} content={d.mensaje_padres_entorno} icon={<MessageCircle size={13} />} tone="family" full />
                                        </>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  {visibles.length > histLimite && (
                    <button onClick={() => setHistLimite(n => n + 20)}
                      className="mx-auto flex items-center gap-1.5 rounded-full border border-v-border bg-v-elevated px-4 py-2 text-xs font-semibold text-v-muted shadow-v transition-colors hover:text-v-accent">
                      <ChevronDown size={14} /> {locale === 'en' ? `Show more (${visibles.length - histLimite} left)` : `Ver más (quedan ${visibles.length - histLimite})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </AccordionSection>

          {/* ══ FICHA DE INGRESO ══ */}
          <AccordionSection
            id="anamnesis"
            title={t('ui.fichaIngreso')}
            icon={<FileText size={17} />}
            defaultOpen={false}
            badge={historyData.anamnesis && selectedChild ? (
              <button onClick={e => { e.stopPropagation(); setShowAnamnesisReport(true) }}
                className="v-brand inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold" style={{ boxShadow: 'none' }}>
                <FileDown size={12} /> {locale === 'en' ? 'Word report' : 'Generar reporte Word'}
              </button>
            ) : undefined}
          >
            <div className="p-4 sm:p-5">
              {historyData.anamnesis ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(historyData.anamnesis)
                    .filter(([k, v]: any) => v !== null && v !== '' && !/^(id|child_id|centro_id|created_at|updated_at)$/.test(k))
                    .slice(0, 24).map(([key, value]: any) => (
                    <div key={key} className="rounded-v-sm border border-v-border bg-v-bg px-3.5 py-2.5 [overflow-wrap:anywhere]">
                      <span className="mb-0.5 block text-[11px] font-medium capitalize text-v-subtle">{key.replace(/_/g, ' ')}</span>
                      <p className="text-sm leading-snug text-v-text">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center rounded-v border border-dashed border-v-border py-12 text-center">
                  <span className="mb-3 grid size-12 place-items-center rounded-full bg-v-fill"><FileText size={20} className="text-v-subtle" /></span>
                  <p className="text-sm text-v-muted">{t('ui.sinFichaIngreso')}</p>
                </div>
              )}
            </div>
          </AccordionSection>

          {/* ══ REPORTES WORD ══ */}
          <AccordionSection
            id="reportes"
            title={t('admin.reportesGenerados')}
            icon={<FileDown size={17} />}
            badge={reportesHistorial.length > 0 ? <span className="rounded-full bg-v-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-v-accent">{reportesHistorial.length}</span> : undefined}
            defaultOpen={false}
          >
            <div className="p-4 sm:p-5">
              {loadingReportes ? (
                <div className="flex items-center justify-center gap-2 py-8 text-v-subtle">
                  <Loader2 className="animate-spin text-v-accent" size={18} /><span className="text-xs font-semibold">{t('common.cargando')}</span>
                </div>
              ) : reportesHistorial.length === 0 ? (
                <div className="flex flex-col items-center rounded-v border border-dashed border-v-border py-12 text-center">
                  <span className="mb-3 grid size-12 place-items-center rounded-full bg-v-fill"><FileDown size={20} className="text-v-subtle" /></span>
                  <p className="text-sm text-v-muted">{t('admin.sinReportesGenerados')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {reportesHistorial.map(rep => <ReporteHistorialCard key={rep.id} reporte={rep} />)}
                </div>
              )}
            </div>
          </AccordionSection>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <span className="mb-4 grid size-20 place-items-center rounded-[30%] bg-v-accent-soft"><Brain size={36} className="text-v-accent" /></span>
          <p className="text-lg font-semibold text-v-text">{t('ui.seleccionarPacienteOpc')}</p>
        </div>
      )}

      {/* ══ MODAL: REPORTE WORD ANAMNESIS ══ */}
      {showAnamnesisReport && selectedChild && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#081426]/50 p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-full max-w-xl">
            <ReportGenerator
              childId={selectedChild}
              childName={listaNinos.find(n => n.id === selectedChild)?.name || ''}
              evaluationType="anamnesis"
              evaluationData={historyData.anamnesis || {}}
              evaluationId={selectedChild}
              compact={false}
              onClose={() => setShowAnamnesisReport(false)}
            />
          </motion.div>
        </div>
      )}
    </div>
  )
}

// ── Componente acordeón reutilizable ──────────────────────────────────────────
function AccordionSection({ title, icon, badge, defaultOpen, children }: {
  id: string
  title: string
  icon: React.ReactNode
  badge?: React.ReactNode
  defaultOpen?: boolean
  accent?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className={`overflow-hidden rounded-v border bg-v-elevated shadow-v transition-colors ${open ? 'border-v-accent/25' : 'border-v-border'}`}>
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-v-fill">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent">{icon}</span>
          <span className="min-w-0 text-[15px] font-semibold leading-snug tracking-tight text-v-text">{title}</span>
          {badge}
        </div>
        <span className={`grid size-8 shrink-0 place-items-center rounded-full transition-all ${open ? 'rotate-180 bg-v-accent-soft text-v-accent' : 'text-v-subtle'}`}><ChevronDown size={16} /></span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
            className="border-t border-v-border bg-v-bg">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


// ==============================================================================
// SUBCOMPONENTE: TARJETA DE REPORTE EN HISTORIAL
// ==============================================================================
const TIPO_REPORTE: Record<string, string> = {
  aba: 'Sesión ABA', anamnesis: 'Ficha de ingreso', entorno_hogar: 'Entorno del hogar', brief2: 'BRIEF-2',
  ados2: 'ADOS-2', vineland3: 'Vineland-3', wiscv: 'WISC-V', basc3: 'BASC-3', programas: 'Programas',
  seguro: 'Informe clínico', clinico: 'Informe clínico', general: 'Reporte general', comparativo: 'Comparativo',
}

function ReporteHistorialCard({ reporte }: { reporte: any; key?: any }) {
  const { t, locale } = useI18n()
  const handleDownload = async () => {
    try {
      const { data, error } = await supabase
        .from('reportes_generados')
        .select('file_data, nombre_archivo')
        .eq('id', reporte.id)
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error(locale === 'en' ? 'Report not found' : 'Reporte no encontrado')
      const byteChars = atob(data.file_data)
      const bytes = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = data.nombre_archivo
      document.body.appendChild(a); a.click()
      URL.revokeObjectURL(url); document.body.removeChild(a)
    } catch {
      alert(t('ui.errorDescargar'))
    }
  }

  const tipo = TIPO_REPORTE[reporte.tipo_reporte] || String(reporte.tipo_reporte || '').replace(/_/g, ' ')

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }}
      className="group flex flex-col rounded-v border border-v-border bg-v-elevated p-4 shadow-v">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><FileText size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-v-text">{reporte.titulo}</p>
          <span className="mt-1 inline-flex rounded-full bg-v-fill px-2 py-0.5 text-[10px] font-semibold capitalize text-v-muted">{tipo}</span>
        </div>
      </div>
      <div className="mb-3 space-y-1 text-[11px] text-v-subtle">
        <p className="flex items-center gap-1.5"><Clock size={11} />
          {new Date(reporte.fecha_generacion).toLocaleDateString(toBCP47(locale), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
        {reporte.generado_por && <p className="flex items-center gap-1.5"><User size={11} /> {reporte.generado_por}</p>}
        {reporte.tamano_bytes ? <p className="flex items-center gap-1.5"><FileDown size={11} /> {(reporte.tamano_bytes / 1024).toFixed(0)} KB</p> : null}
      </div>
      <button onClick={handleDownload}
        className="mt-auto flex h-9 w-full items-center justify-center gap-2 rounded-full border border-v-accent/30 bg-v-accent-soft text-xs font-semibold text-v-accent transition-colors hover:bg-v-accent hover:text-white">
        <Download size={14} /> {locale === 'en' ? 'Download .docx' : 'Descargar .docx'}
      </button>
    </motion.div>
  )
}

const DETAIL_TONES: Record<string, string> = {
  neutral: 'border-v-border bg-v-elevated',
  success: 'border-v-success/30 bg-v-success/10',
  danger: 'border-v-danger/30 bg-v-danger/10',
  family: 'border-v-warning/30 bg-v-warning/10',
}

function DetailBox({ title, content, icon, full, tone = 'neutral', extra }: { title: string; content: any; icon?: React.ReactNode; full?: boolean; tone?: string; extra?: React.ReactNode; color?: string }) {
  const text = content == null ? '' : String(content)
  const empty = !text || text === 'undefined'
  return (
    <div className={`rounded-v-sm border p-3.5 ${empty ? 'border-dashed border-v-border' : DETAIL_TONES[tone] ?? DETAIL_TONES.neutral} ${full ? 'w-full' : ''}`}>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-v-muted">{icon} {title}{extra}</p>
      <p className={`whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere] ${empty ? 'italic text-v-subtle' : 'text-v-text'}`}>
        {empty ? 'Sin registro' : text}
      </p>
    </div>
  )
}


export default AIReportView
