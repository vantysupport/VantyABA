'use client'
import React from 'react'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/components/ThemeContext'
import { datosConsentimiento } from '@/lib/consentimiento'
import {
  ArrowLeft, Baby, BarChart3, Brain, Calendar, Check, ChevronRight,
  ClipboardList, Edit, Link, Link2Off, Loader2, Mail, Plus, Save,
  Search, Stethoscope, User, UserCheck, Users, X,
  FolderOpen, FileText, Heart, Trash2, Settings, Smile, Meh, Frown, Sparkles,
  ClipboardCheck, ClipboardPen, History, Cake, StickyNote, Tag, Activity
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { subirArchivoPrivado } from '@/lib/subir-archivo'
import { getControlStatus } from '@/lib/control'
import { adminFetch } from '@/lib/admin-fetch'
import { useToast } from '@/components/Toast'
import { calcularEdadNumerica } from '../utils/helpers'
import ProgramasABAView from './ProgramasABAView'
import EvaluacionesUnificadas from './EvaluacionesUnificadas'
import AIReportView from './AIReportView'
import DocumentosView from './DocumentosView'
import { ScrollRow } from '@/components/ui/scroll-row'
import { RellenarFicha, GestorPlantillas } from './PlantillasClinicas'
import EvaluacionInicialAdmin from './EvaluacionInicialAdmin'
import { confirmar } from '@/components/ui/confirmar'
import { AceptarTerminos } from '@/components/ui/aceptar-terminos'

// ── Color badge por diagnóstico ────────────────────────────────────────────
const DX_BORDER: Record<string, string> = {
  'TEA': '#0284c7', 'TDAH': '#0891b2', 'Retraso': '#f59e0b', 'Autismo': '#0284c7',
  'TDA': '#0891b2', 'TDL': '#10b981',
}
const getDxStyle = (dx: string) => {
  const k = Object.keys(DX_BORDER).find(k => dx?.includes(k))
  const color = k ? DX_BORDER[k] : '#64748b'
  return { background: `${color}10`, color, border: `1px solid ${color}30` }
}

// ── Nombre a mostrar según rol (apodo para admin/secretaria) ──────────────
const getDisplayName = (p: any, role: string) => {
  const useApodo = ['admin', 'secretaria', 'jefe'].includes(role)
  return (useApodo && p.apodo) ? p.apodo : p.name
}
function Avatar({ name, size = 'md', active = false }: { name: string; size?: 'sm'|'md'|'lg'; active?: boolean }) {
  const sz = { sm: 'size-9 text-sm', md: 'size-12 text-lg', lg: 'size-16 text-2xl' }[size]
  return (
    <div className={`${sz} grid shrink-0 place-items-center rounded-[30%] font-semibold transition-colors ${active ? 'v-brand' : 'bg-v-accent-soft text-v-accent'}`}
      style={active ? { boxShadow: 'none' } : undefined}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

// ── InfoCard premium (ícono en tile tintado + jerarquía) ───────────────────
function InfoCard({ icon: Icon, label, children, className = '' }: {
  icon: any; label: string; color?: string; children: React.ReactNode; className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      className={`min-w-0 rounded-v border border-v-border bg-v-elevated p-4 shadow-v [overflow-wrap:anywhere] ${className}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Icon size={14} /></span>
        <p className="text-xs font-medium text-v-muted">{label}</p>
      </div>
      {children}
    </motion.div>
  )
}

// ── InfoPill ──────────────────────────────────────────────────────────────
function InfoPill({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="p-3 rounded-xl space-y-1" style={{ background: 'var(--muted-bg)' }}>
      <div className="flex items-center gap-1.5">
        <span className="text-sky-500">{icon}</span>
        <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
      <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>{value || '—'}</p>
    </div>
  )
}

// ── Sección vinculación de cuenta ─────────────────────────────────────────
function LinkedAccountSection({ nino, onLinked }: { nino: any; onLinked: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [linkedUser, setLinkedUser] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [emailSearch, setEmailSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [linking, setLinking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)

  // Cargar usuario vinculado
  useEffect(() => {
    const fetchLinked = async () => {
      if (!nino.parent_id) { setLinkedUser(null); return }
      setLoadingUser(true)
      const { data } = await supabase.from('profiles').select('id, full_name, email, role').eq('id', nino.parent_id).maybeSingle()
      setLinkedUser(data || null)
      setLoadingUser(false)
    }
    fetchLinked()
  }, [nino.id, nino.parent_id])

  const handleSearch = async () => {
    if (!emailSearch.trim()) return
    setSearching(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .ilike('email', `%${emailSearch.trim()}%`)
        .in('role', ['padre', 'jefe', 'especialista', 'admin'])
        .limit(8)
      setSearchResults(data || [])
    } catch (e: any) { toast.error(e.message) }
    finally { setSearching(false) }
  }

  const handleLink = async (user: any) => {
    setLinking(true)
    try {
      const res = await adminFetch('/api/admin/children', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: nino.id, parentId: user.id }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(t('auto.patientsView.vinculadoA', { v1: String(nino.name), v2: String(user.full_name || user.email) }))
      setLinkedUser(user)
      setShowLinkModal(false)
      setEmailSearch(''); setSearchResults([])
      onLinked()
    } catch (e: any) { toast.error(e.message) }
    finally { setLinking(false) }
  }

  const handleUnlink = async () => {
    setUnlinking(true)
    try {
      const res = await adminFetch('/api/admin/children', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: nino.id, parentId: null }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(t('auto.patientsView.pacienteDesvinculadoDeLaCuenta'))
      setLinkedUser(null)
      onLinked()
    } catch (e: any) { toast.error(e.message) }
    finally { setUnlinking(false) }
  }

  return (
    <>
      <div className="rounded-v border border-v-border bg-v-elevated p-5 shadow-v">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <UserCheck size={13} style={{ color: 'var(--text-muted)' }} />
            <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
              {t('auto.patientsView.cuentaVinculada')}
            </p>
          </div>
          {!loadingUser && (
            linkedUser
              ? <button onClick={handleUnlink} disabled={unlinking}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
                  style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}>
                  {unlinking ? <Loader2 size={10} className="animate-spin"/> : <Link2Off size={10}/>}
                  {t('pacientes.desvincular')}
                </button>
              : <button onClick={() => setShowLinkModal(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
                  style={{ background: '#dbeafe', color: '#2563eb', border: '1px solid #93c5fd' }}>
                  <Link size={10}/> {t('pacientes.vincularCuenta')}
                </button>
          )}
        </div>

        {loadingUser
          ? <div className="flex justify-center py-2"><Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }}/></div>
          : linkedUser
            ? <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <User size={16} className="text-white"/>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: '#065f46' }}>
                    {linkedUser.full_name || t('pacientes.sinNombre')}
                  </p>
                  <p className="text-xs truncate flex items-center gap-1" style={{ color: '#059669' }}>
                    <Mail size={10}/>{linkedUser.email}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: '#d1fae5', color: '#065f46' }}>
                  {['padre','jefe','especialista','admin','user'].includes(linkedUser.role) ? t('pacientes.rol_'+linkedUser.role) : linkedUser.role}
                </span>
              </div>
            : <div className="flex flex-col items-center py-3 gap-2 text-center">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'var(--muted-bg)' }}>
                  <Link size={16} style={{ color: 'var(--text-muted)' }}/>
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('pacientes.sinCuentaVinculada')}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {t('pacientes.vinculaCuentaAyuda')}
                  </p>
                </div>
              </div>
        }
      </div>

      {/* Modal de búsqueda y vinculación */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl p-5 space-y-4"
            style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  {t('auto.patientsView.vincularCuentaA', { v1: String(nino.name) })}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {t('auto.patientsView.buscaPorEmailDelPadre')}
                </p>
              </div>
              <button onClick={() => { setShowLinkModal(false); setEmailSearch(''); setSearchResults([]) }}
                className="p-2 rounded-xl hover:bg-slate-100">
                <X size={16} style={{ color: 'var(--text-muted)' }}/>
              </button>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}/>
                <input
                  type="email"
                  placeholder={t('auto.patientsView.correoejemplocom')}
                  value={emailSearch}
                  onChange={e => setEmailSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm border outline-none"
                  style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                />
              </div>
              <button onClick={handleSearch} disabled={searching || !emailSearch.trim()}
                className="px-4 py-2.5 rounded-xl text-sm font-bold bg-sky-600 text-white disabled:opacity-50 flex items-center gap-1.5">
                {searching ? <Loader2 size={13} className="animate-spin"/> : <Search size={13}/>}
                {t('auto.patientsView.buscar')}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {searchResults.map(u => (
                  <div key={u.id}
                    className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-sky-50 dark:hover:bg-blue-900/20 transition-all"
                    style={{ borderColor: 'var(--card-border)' }}>
                    <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <User size={14} className="text-white"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                        {u.full_name || '(sin nombre)'}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                    </div>
                    <button onClick={() => handleLink(u)} disabled={linking}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-sky-600 text-white disabled:opacity-50 flex-shrink-0">
                      {linking ? <Loader2 size={10} className="animate-spin"/> : <Link size={10}/>}
                      {t('auto.patientsView.vincular')}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searchResults.length === 0 && emailSearch && !searching && (
              <div className="text-center py-4">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {t('auto.patientsView.noSeEncontraronUsuariosCon')}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {t('auto.patientsView.primeroCreaLaCuentaDel')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ── Card de bienestar del padre ────────────────────────────────────────────
// Muestra el último chequeo de bienestar y el historial (collapsable).
const MOOD_CONFIG: Record<string, { Icon: any; label: string; bg: string; border: string; color: string }> = {
  bien:    { Icon: Smile, label: 'Bien',    bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
  regular: { Icon: Meh,   label: 'Regular', bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
  dificil: { Icon: Frown, label: 'Difícil', bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
}

function ParentWellbeingCard({ childId }: { childId: string }) {
  const { t, locale } = useI18n()
  const [checkins, setCheckins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/parent-wellbeing?child_id=${childId}&limit=12`)
      .then(r => r.json())
      .then(json => { if (!cancelled) setCheckins(json?.data || []) })
      .catch(() => { if (!cancelled) setCheckins([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [childId])

  if (loading) {
    return (
      <div className="rounded-v border border-v-border bg-v-elevated p-5 shadow-v">
        <div className="flex items-center gap-1.5 mb-2">
          <Heart size={12} style={{ color: 'var(--text-muted)' }} />
          <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
            {t('pacientes.bienestarPadre')}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={12} className="animate-spin" /> {t('common.cargando')}
        </div>
      </div>
    )
  }

  if (checkins.length === 0) {
    return (
      <div className="rounded-v border border-v-border bg-v-elevated p-5 shadow-v">
        <div className="flex items-center gap-1.5 mb-2">
          <Heart size={12} style={{ color: 'var(--text-muted)' }} />
          <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
            {t('pacientes.bienestarPadre')}
          </p>
        </div>
        <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
          {t('pacientes.sinChequeosBienestar')}
        </p>
      </div>
    )
  }

  const ultimo = checkins[0]
  const cfg = MOOD_CONFIG[ultimo.mood] || MOOD_CONFIG.regular
  const fechaUltimo = new Date(ultimo.created_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="rounded-v border border-v-border bg-v-elevated p-5 shadow-v">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Heart size={12} style={{ color: 'var(--text-muted)' }} />
          <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
            {t('pacientes.bienestarPadre')}
          </p>
        </div>
        {checkins.length > 1 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-[10px] font-semibold hover:underline"
            style={{ color: 'var(--text-secondary)' }}
          >
            {expanded ? t('pacientes.ocultarHistorial') : `${t('pacientes.verHistorial')} (${checkins.length})`}
          </button>
        )}
      </div>

      {/* Último check-in */}
      <div
        className="rounded-lg p-3 flex items-start gap-3"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
      >
        {(() => { const MI = cfg.Icon; return <MI size={26} style={{ color: cfg.color, flexShrink: 0 }} /> })()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-bold" style={{ color: cfg.color }}>{t('mood.' + ultimo.mood)}</p>
            <p className="text-[10px]" style={{ color: cfg.color, opacity: 0.75 }}>{fechaUltimo}</p>
          </div>
          {ultimo.nota && (
            <p className="text-xs mt-1.5 italic leading-relaxed" style={{ color: cfg.color }}>
              "{ultimo.nota}"
            </p>
          )}
        </div>
      </div>

      {/* Historial expandido */}
      {expanded && checkins.length > 1 && (
        <div className="mt-3 space-y-1.5">
          {checkins.slice(1).map((c: any) => {
            const ccfg = MOOD_CONFIG[c.mood] || MOOD_CONFIG.regular
            const fecha = new Date(c.created_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
            return (
              <div
                key={c.id}
                className="flex items-start gap-2 rounded-lg p-2"
                style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}
              >
                {(() => { const MI = ccfg.Icon; return <MI size={15} style={{ color: ccfg.color, flexShrink: 0 }} /> })()}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{t('mood.' + c.mood)}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{fecha}</p>
                  </div>
                  {c.nota && (
                    <p className="text-[11px] mt-0.5 italic" style={{ color: 'var(--text-secondary)' }}>"{c.nota}"</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Card: Contador de sesiones (auto desde agenda + ajuste manual histórico) ──
function SessionCounterCard({ nino, onSaved }: { nino: any; onSaved: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [sessionsBefore, setSessionsBefore] = useState<number>(nino.sessions_before_platform || 0)
  const [autoCount, setAutoCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [tempInput, setTempInput] = useState(String(nino.sessions_before_platform || 0))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSessionsBefore(nino.sessions_before_platform || 0)
    setTempInput(String(nino.sessions_before_platform || 0))
  }, [nino.id, nino.sessions_before_platform])

  // Contar sesiones reales en la plataforma:
  //   appointments con status completed/completada/realizada + aba_sessions_v2 + agenda_sesiones realizadas
  // Tomamos el MAX entre las fuentes (no se suman porque pueden solaparse)
  useEffect(() => {
    let cancelled = false
    async function loadAuto() {
      setLoading(true)
      try {
        const [a, b, c] = await Promise.all([
          supabase.from('appointments').select('id', { count: 'exact', head: true })
            .eq('child_id', nino.id).in('status', ['completed','completada','realizada']),
          supabase.from('agenda_sesiones').select('id', { count: 'exact', head: true })
            .eq('child_id', nino.id).in('estado', ['realizada','completada','completed']),
          supabase.from('aba_sessions_v2').select('id', { count: 'exact', head: true })
            .eq('child_id', nino.id),
        ])
        const max = Math.max(a.count || 0, b.count || 0, c.count || 0)
        if (!cancelled) setAutoCount(max)
      } catch { /* silencioso */ }
      finally { if (!cancelled) setLoading(false) }
    }
    loadAuto()
    return () => { cancelled = true }
  }, [nino.id])

  const total = sessionsBefore + autoCount

  const handleSave = async () => {
    const n = parseInt(tempInput.replace(/[^0-9]/g, ''), 10)
    if (isNaN(n) || n < 0) { toast.error(t('auto.patientsView.ingresaUnNumeroValido0')); return }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('children')
        .update({ sessions_before_platform: n })
        .eq('id', nino.id)
      if (error) throw error
      setSessionsBefore(n)
      setEditing(false)
      toast.success(t('auto.patientsView.contadorActualizado'))
      onSaved()
    } catch (e: any) {
      toast.error('Error: ' + (e?.message || 'no se pudo guardar'))
    } finally { setSaving(false) }
  }

  return (
    <div className="rounded-v border border-v-border bg-v-elevated p-5 shadow-v">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <BarChart3 size={12} style={{ color: 'var(--text-muted)' }} />
          <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
            {t('auto.patientsView.totalDeSesionesDelPaciente')}
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => { setTempInput(String(sessionsBefore)); setEditing(true) }}
            className="flex items-center gap-1 text-[10px] font-semibold hover:underline"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Edit size={10}/> {t('pacientes.ajustarPrevias')}
          </button>
        )}
      </div>

      {/* Total grande */}
      <div className="flex items-baseline gap-2 mb-3">
        <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {loading ? '…' : total}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('auto.patientsView.sesionesTotales')}</p>
      </div>

      {/* Desglose */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg p-2.5" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-[9px] font-bold mb-0.5" style={{ color: 'var(--text-muted)' }}>
            {t('pacientes.previasAlSistema')}
          </p>
          {editing ? (
            <div className="flex items-center gap-1.5 mt-1">
              <input
                type="number"
                min={0}
                autoFocus
                value={tempInput}
                onChange={e => setTempInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSave()
                  if (e.key === 'Escape') { setEditing(false); setTempInput(String(sessionsBefore)) }
                }}
                className="w-16 px-2 py-1 rounded-md text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400"
                style={{ background: 'var(--card)', border: '1.5px solid var(--input-border)', color: 'var(--text-primary)' }}
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="p-1 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
                title={t('common.guardar')}
              >
                {saving ? <Loader2 size={12} className="animate-spin"/> : <Check size={12}/>}
              </button>
              <button
                onClick={() => { setEditing(false); setTempInput(String(sessionsBefore)) }}
                className="p-1 rounded-md bg-slate-100 text-slate-500 hover:text-slate-700"
                title={t('common.cancelar')}
              >
                <X size={12}/>
              </button>
            </div>
          ) : (
            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {sessionsBefore}
            </p>
          )}
        </div>
        <div className="rounded-lg p-2.5" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-[9px] font-bold mb-0.5" style={{ color: 'var(--text-muted)' }}>
            {t('pacientes.enLaPlataforma')}
          </p>
          <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {loading ? '…' : autoCount}
          </p>
        </div>
      </div>

      <p className="text-[10px] mt-3" style={{ color: 'var(--text-muted)' }}>
        💡 {t('pacientes.previasTip')}
      </p>
    </div>
  )
}

// ── Tab Info del paciente ──────────────────────────────────────────────────
// ── Resumen clínico IA (persistente, editable) ────────────────────────────────
function PatientAISummaryCard({ childId }: { childId: string }) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const [summary, setSummary]   = useState('')
  const [updatedAt, setUpdated] = useState<string | null>(null)
  const [lang, setLang]         = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState(false)   // generando/actualizando IA
  const [translating, setTranslating] = useState(false)
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/patient-ai-summary?childId=${childId}`)
      .then(r => r.json())
      .then(d => { if (alive) { setSummary(d.summary || ''); setUpdated(d.updatedAt || null); setLang(d.lang || null) } })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [childId])

  const traducir = async () => {
    setTranslating(true)
    try {
      const res = await fetch('/api/patient-ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': locale },
        body: JSON.stringify({ childId, action: 'translate', locale }),
      })
      const d = await res.json()
      if (!res.ok || d.error) throw new Error(d.error || `Error ${res.status}`)
      setSummary(d.summary || ''); setLang(d.lang || locale); setUpdated(new Date().toISOString())
      toast.success(t('pacientes.resumenTraducido'))
    } catch (e: any) {
      toast.error((locale === 'en' ? 'Error: ' : 'Error: ') + (e.message || ''))
    } finally { setTranslating(false) }
  }

  const generar = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/patient-ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': locale },
        body: JSON.stringify({ childId, action: 'generate', locale }),
      })
      const d = await res.json()
      if (!res.ok || d.error) throw new Error(d.error || `Error ${res.status}`)
      setSummary(d.summary || ''); setUpdated(new Date().toISOString()); setLang(d.lang || locale); setEditing(false)
      toast.success(t('pacientes.resumenGenerado'))
    } catch (e: any) {
      toast.error((locale === 'en' ? 'Error: ' : 'Error: ') + (e.message || ''))
    } finally { setBusy(false) }
  }

  const guardarEdicion = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/patient-ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': locale },
        body: JSON.stringify({ childId, action: 'save', summary: draft }),
      })
      const d = await res.json()
      if (!res.ok || d.error) throw new Error(d.error || `Error ${res.status}`)
      setSummary(draft); setUpdated(new Date().toISOString()); setLang(locale); setEditing(false)
      toast.success(t('pacientes.resumenGuardado'))
    } catch (e: any) {
      toast.error((locale === 'en' ? 'Error: ' : 'Error: ') + (e.message || ''))
    } finally { setSaving(false) }
  }

  const fecha = updatedAt
    ? new Date(updatedAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="relative min-w-0 overflow-hidden rounded-v border border-v-border bg-v-elevated p-5 shadow-v [overflow-wrap:anywhere] md:col-span-2">
      <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="grid size-7 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Sparkles size={14} /></span>
          <p className="text-sm font-semibold text-v-text">{t('pacientes.resumenIA')}</p>
          {fecha && <span className="text-[11px] text-v-subtle">· {fecha}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {!editing && summary && lang && lang !== locale && (
            <button onClick={traducir} disabled={busy || loading || translating}
              className="inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-3 py-1.5 text-[11px] font-semibold text-v-accent disabled:opacity-50">
              {translating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {locale === 'en' ? 'Translate to English' : 'Traducir al español'}
            </button>
          )}
          {!editing && (
            <button onClick={() => { setDraft(summary); setEditing(true) }} disabled={busy || loading}
              className="inline-flex items-center gap-1 rounded-full border border-v-border px-3 py-1.5 text-[11px] font-semibold text-v-muted transition-colors hover:bg-v-fill hover:text-v-text disabled:opacity-50">
              <Edit size={11} /> {t('common.editar')}
            </button>
          )}
          <button onClick={generar} disabled={busy || loading || saving}
            className="v-brand inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
            style={{ boxShadow: 'none' }}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            {busy ? t('pacientes.resumenGenerando') : (summary ? t('pacientes.resumenRegenerar') : t('pacientes.resumenGenerar'))}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-3"><Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-muted)' }} /><span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('common.cargando')}</span></div>
      ) : editing ? (
        <div className="space-y-2">
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={10}
            className="w-full rounded-xl text-sm leading-relaxed p-3 outline-none focus:border-sky-400"
            style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-primary)' }} />
          <div className="flex gap-2">
            <button onClick={guardarEdicion} disabled={saving}
              className="v-brand inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ boxShadow: 'none' }}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} {t('common.guardar')}
            </button>
            <button onClick={() => setEditing(false)} disabled={saving}
              className="rounded-full border border-v-border px-3.5 py-1.5 text-xs font-semibold text-v-muted hover:bg-v-fill">{t('common.cancelar')}</button>
          </div>
        </div>
      ) : summary ? (
        <div className="space-y-1.5 text-sm leading-relaxed text-v-text">
          {summary.replace(/<br\s*\/?>/gi, '\n').split('\n').map((raw, i) => {
            const line = raw.trim()
            if (!line) return null
            // Título de sección: línea que es solo **Texto**
            const heading = line.match(/^\*\*(.+?)\*\*:?$/)
            if (heading) return <p key={i} className="mt-3 text-[13px] font-semibold text-v-accent">{heading[1]}</p>
            // Resto: negritas inline + viñeta/número conservado
            const parts = line.split(/\*\*(.*?)\*\*/g)
            return <p key={i}>{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}</p>
          })}
        </div>
      ) : (
        <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>{t('pacientes.resumenVacio')}</p>
      )}
    </div>
  )
}

function PatientInfoTab({ nino, onSaved, onDeleted }: { nino: any; onSaved: () => void; onDeleted?: () => void }) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [specialists, setSpecialists] = useState<any[]>([])
  // Las notas se guardan cifradas: se piden al servidor ya descifradas
  const [notasClaras, setNotasClaras] = useState('')
  useEffect(() => {
    let vivo = true
    setNotasClaras('')
    adminFetch(`/api/admin/children?notas=${nino.id}`).then(r => (r.ok ? r.json() : null)).then(j => {
      if (!vivo || !j) return
      setNotasClaras(j.notas || '')
      setForm(f => ({ ...f, notas: j.notas || '' }))
    }).catch(() => {})
    return () => { vivo = false }
  }, [nino.id])
  const [form, setForm] = useState({
    name:          nino.name || '',
    birth_date:    nino.birth_date || '',
    diagnosis:     nino.diagnosis || '',
    age:           String(nino.age || '').replace(/[^0-9]/g, ''),
    apodo:         nino.apodo || '',
    notas:         '',
    specialist_id: nino.specialist_id || '',
  })

  // Cargar especialistas disponibles (incluye especialidad — solo uso interno)
  useEffect(() => {
    supabase.from('profiles')
      .select('id, full_name, email, role, specialty')
      .in('role', ['especialista', 'terapeuta', 'jefe', 'admin'])
      .order('full_name')
      .then(({ data }) => setSpecialists(data || []))
  }, [])

  useEffect(() => {
    setForm({
      name:          nino.name || '',
      birth_date:    nino.birth_date || '',
      diagnosis:     nino.diagnosis || '',
      age:           String(nino.age || '').replace(/[^0-9]/g, ''),
      apodo:         nino.apodo || '',
      notas:         notasClaras,
      specialist_id: nino.specialist_id || '',
    })
    setEditing(false)
  }, [nino.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const edadNum: number | null = form.birth_date
        ? calcularEdadNumerica(form.birth_date)
        : (form.age.trim() ? parseInt(form.age.replace(/[^0-9]/g, ''), 10) || null : null)

      const { error } = await supabase.from('children').update({
        name:          form.name.trim(),
        birth_date:    form.birth_date || null,
        diagnosis:     form.diagnosis.trim() || null,
        age:           edadNum,
        apodo:         form.apodo.trim() || null,
        specialist_id: form.specialist_id || null,
      }).eq('id', nino.id)
      // Las notas van por el servidor, que las guarda cifradas
      if (!error && form.notas.trim() !== notasClaras.trim()) {
        const rn = await adminFetch('/api/admin/children', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ childId: nino.id, notas: form.notas }) })
        if (!rn.ok) throw new Error('No se pudieron guardar las notas')
        setNotasClaras(form.notas.trim())
      }
      if (error) throw error
      toast.success(t('common.exitoGuardado'))
      setEditing(false)
      onSaved()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  // ─── Eliminar paciente ──────────────────────────────────────────────────────
  const [deleting, setDeleting] = useState(false)
  const handleDelete = async () => {
    const tieneCuentaVinculada = !!nino.parent_id
    const nombre = nino.name || 'el paciente'

    // Mensaje de confirmación detallado según vinculación
    const mensaje = tieneCuentaVinculada
      ? `⚠️ "${nombre}" TIENE una cuenta de padre/madre vinculada.\n\n` +
        `Si lo eliminás, esa familia ya no podrá ver su información.\n\n` +
        `Esta acción borrará TODO el historial del paciente:\n` +
        `· Citas y agenda\n` +
        `· Programas ABA y sesiones registradas\n` +
        `· Evaluaciones, formularios y fichas\n` +
        `· Documentos y reportes\n\n` +
        `Esta acción NO se puede deshacer.\n\n` +
        `Para confirmar, escribí el nombre exacto del paciente:`
      : `¿Eliminar a "${nombre}"?\n\n` +
        `Este paciente NO tiene cuenta de padre vinculada (probablemente es de prueba).\n\n` +
        `Se borrará todo su historial (citas, programas, evaluaciones, fichas, documentos).\n\n` +
        `Esta acción no se puede deshacer.`

    let confirmName = ''
    if (tieneCuentaVinculada) {
      const respuesta = prompt(mensaje, '')
      if (respuesta == null) return  // cancelado
      if (respuesta.trim() !== nombre.trim()) {
        toast.error(t('auto.patientsView.elNombreNoCoincideEliminacion'))
        return
      }
      confirmName = respuesta.trim()
    } else {
      if (!await confirmar(mensaje)) return
    }

    setDeleting(true)
    try {
      // Usamos el endpoint /api/admin/delete-patient — borra en cascada manual
      // todas las tablas relacionadas (appointments, programas_aba, evaluaciones,
      // fichas, etc.) antes de eliminar al niño. El cliente no puede hacer esto
      // directo porque appointments tiene FK sin ON DELETE CASCADE.
      const res = await fetch('/api/admin/delete-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: nino.id, confirm_name: confirmName }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Error desconocido')

      // Log informativo de qué se limpió por consola
      if (json.registros_limpiados) {
        console.log(`[delete-patient] "${nombre}" eliminado · limpieza:`, json.registros_limpiados)
      }
      toast.success(t('auto.patientsView.eliminadoCorrectamente', { v1: String(nombre) }))
      onDeleted?.()
    } catch (e: any) {
      toast.error(t('auto.patientsView.noSePudoEliminar', { v1: String(e?.message || 'error desconocido') }))
    } finally {
      setDeleting(false)
    }
  }

  const birthFormatted = nino.birth_date
    ? new Date(nino.birth_date + 'T12:00:00').toLocaleDateString(toBCP47(locale), { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const ageDisplay = nino.age
    ? `${String(nino.age).replace(/[^0-9]/g, '')} ${t('common.anos')}`
    : birthFormatted ? `${calcularEdadNumerica(nino.birth_date)} ${t('common.anos')}` : '—'

  const specialistObj = specialists.find(s => s.id === (nino.specialist_id || form.specialist_id)) || null
  const specialistName = specialistObj?.full_name || null
  const specialistSpecialty = specialistObj?.specialty || null   // solo visible en panel interno

  const fieldCls = "w-full rounded-v-sm border border-v-border bg-v-bg px-3.5 py-2.5 text-sm text-v-text outline-none transition-shadow focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft"
  const fieldStyle = {}
  const labelCls = "mb-1.5 block text-xs font-semibold text-v-muted"

  return (
    <div className="v-scope p-4 md:p-6">
      {!editing ? (
        /* ───────────── VISTA ───────────── */
        <div className="space-y-3">
          <div className="mb-1 flex justify-end gap-2">
            <button onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-v-border bg-v-elevated px-3.5 py-1.5 text-xs font-semibold text-v-muted shadow-v transition-colors hover:text-v-accent">
              <Edit size={12}/> {t('common.editar')}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-full border border-v-danger/30 px-3.5 py-1.5 text-xs font-semibold text-v-danger transition-colors hover:bg-v-danger/10 disabled:opacity-50"
              title={nino.parent_id ? 'Paciente con cuenta de padre vinculada — requiere confirmación por nombre' : 'Eliminar paciente'}
            >
              {deleting ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={12}/>}
              {t('auto.patientsView.eliminar')}
            </button>
          </div>

          {/* Datos básicos en una fila */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <InfoCard icon={Cake} label={t('pacientes.fechaNacimiento')}>
              <p className="text-sm font-semibold text-v-text">{birthFormatted || '—'}</p>
            </InfoCard>
            <InfoCard icon={Baby} label={t('ui.age')}>
              <p className="text-sm font-semibold text-v-text">{ageDisplay}</p>
            </InfoCard>
            <InfoCard icon={Activity} label={t('pacientes.diagnostico')}>
              <p className="text-sm font-semibold text-v-text">{nino.diagnosis || '—'}</p>
            </InfoCard>
            <InfoCard icon={Tag} label={t('pacientes.apodoLabel')}>
              {nino.apodo
                ? <p className="text-sm font-semibold text-v-text">{nino.apodo}</p>
                : <p className="text-xs italic text-v-subtle">{t('pacientes.sinApodo')}</p>}
            </InfoCard>
          </div>

          {/* Especialista + notas */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <InfoCard icon={Stethoscope} label={t('pacientes.especialistaAsignado')}>
              {specialistName
                ? <div className="flex items-center gap-2.5">
                    <Avatar name={specialistName} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight text-v-text">{specialistName}</p>
                      {specialistSpecialty && <p className="truncate text-xs leading-tight text-v-accent">{specialistSpecialty}</p>}
                    </div>
                  </div>
                : <p className="text-xs italic text-v-subtle">{t('pacientes.sinEspecialista')}</p>}
            </InfoCard>
            <InfoCard icon={StickyNote} label={t('pacientes.notasPaciente')}>
              {notasClaras
                ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-v-text">{notasClaras}</p>
                : <p className="text-xs italic text-v-subtle">{t('pacientes.sinNotas')}</p>}
            </InfoCard>
          </div>

          {/* ── Resumen clínico IA (persistente, editable) ── */}
          <PatientAISummaryCard childId={nino.id} />

          {/* ── Contador de sesiones (auto + previas manuales) ── */}
          <SessionCounterCard nino={nino} onSaved={onSaved} />

          {/* ── Cuenta vinculada ── */}
          <LinkedAccountSection nino={nino} onLinked={onSaved} />

          {/* ── Bienestar del padre ── */}
          <ParentWellbeingCard childId={nino.id} />
        </div>

      ) : (
        /* ───────────── EDICIÓN ───────────── */
        <div className="space-y-3 rounded-v border border-v-border bg-v-elevated p-5 shadow-v">
          {/* Header edición */}
          <div className="flex items-center justify-between pb-2 mb-1" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
              {t('common.editar')}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)}
                className="rounded-full border border-v-border px-3.5 py-1.5 text-xs font-semibold text-v-muted transition-colors hover:bg-v-fill">
                {t('common.cancelar')}
              </button>
              <button onClick={handleSave} disabled={saving}
                className="v-brand inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold" style={{ boxShadow: 'none' }}>
                {saving ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>}
                {t('common.guardar')}
              </button>
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>{t('common.nombre')}</label>
            <input type="text" value={form.name} placeholder={t('pacientes.phNombre')}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={fieldCls} style={fieldStyle} />
          </div>

          {/* Apodo */}
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>{t('pacientes.apodo')}</label>
            <input type="text" value={form.apodo} placeholder={t('pacientes.phApodo')}
              onChange={e => setForm(f => ({ ...f, apodo: e.target.value }))}
              className={fieldCls} style={fieldStyle} />
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              {t('pacientes.nombreInformal')}
            </p>
          </div>

          {/* Fecha nacimiento */}
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>{t('pacientes.fechaNacimiento')}</label>
            <input type="date" value={form.birth_date}
              onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
              className={fieldCls} style={fieldStyle} />
          </div>

          {/* Diagnóstico */}
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>{t('pacientes.diagnostico')}</label>
            <input type="text" value={form.diagnosis} placeholder={t('pacientes.phDiagnostico')}
              onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))}
              className={fieldCls} style={fieldStyle} />
          </div>

          {/* Edad manual */}
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>{t('pacientes.edadAnios')}</label>
            <input type="number" min="0" max="99" value={form.age} placeholder={t('pacientes.phEdad')}
              onChange={e => setForm(f => ({ ...f, age: e.target.value.replace(/[^0-9]/g, '') }))}
              className={fieldCls} style={fieldStyle} />
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              {t('pacientes.edadAutoCalc')}
            </p>
          </div>

          {/* Especialista asignado */}
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>{t('pacientes.especialistaAsignado')}</label>
            <select value={form.specialist_id}
              onChange={e => setForm(f => ({ ...f, specialist_id: e.target.value }))}
              className={fieldCls} style={fieldStyle}>
              <option value="">{t('pacientes.sinAsignarOpc')}</option>
              {specialists.map(s => (
                <option key={s.id} value={s.id}>
                  {s.full_name || s.email}{s.specialty ? ` — ${s.specialty}` : ` (${s.role})`}
                </option>
              ))}
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>{t('pacientes.notasPaciente')}</label>
            <textarea value={form.notas} rows={4}
              placeholder={t('pacientes.phNotas')}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              className={`${fieldCls} resize-none`} style={fieldStyle} />
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL — Layout adaptativo móvil / desktop
// ═══════════════════════════════════════════════════════════════════════════
// ── FichasTab — dos sub-tabs grandes ─────────────────────────────────────────
function FichasTab({ childId, childName, currentRole }: {
  childId: string; childName: string; currentRole: string
}) {
  const { isDark } = useTheme()
  const { locale } = useI18n()
  const [subTab, setSubTab] = useState<'plantillas' | 'rellenar'>('rellenar')
  const canManage = ['jefe', 'admin', 'especialista'].includes(currentRole)

  return (
    <div className="flex flex-col">
      {/* Sub-tabs */}
      <div className="v-scope shrink-0 px-3 pb-2 pt-4 sm:px-5">
        <div className="flex rounded-full bg-v-fill p-1">
          {([
            ...(canManage ? [{ id: 'plantillas' as const, Icon: Settings, label: locale === 'en' ? 'Manage forms' : 'Gestionar fichas' }] : []),
            { id: 'rellenar' as const, Icon: ClipboardList, label: locale === 'en' ? 'Patient forms' : 'Fichas del paciente' },
          ]).map(tb => {
            const on = subTab === tb.id
            return (
              <button key={tb.id} onClick={() => setSubTab(tb.id)}
                className={`relative flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-semibold transition-colors ${on ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
                {on && <motion.span layoutId="fichas-subtab" className="absolute inset-0 rounded-full bg-v-elevated shadow-v" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <tb.Icon size={15} className="relative" />
                <span className="relative">{tb.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content — fluye en el scroll principal del detalle (sin scroll anidado) */}
      <div className="p-3 sm:p-5">
        {subTab === 'plantillas' && canManage && <GestorPlantillas isDark={isDark} />}
        {subTab === 'rellenar' && <RellenarFichaConWord childId={childId} childName={childName} isDark={isDark} />}
      </div>
    </div>
  )
}

// ── RellenarFichaConWord — guarda ficha + genera Word automáticamente ─────────
function RellenarFichaConWord({ childId, childName, isDark }: {
  childId: string; childName: string; isDark: boolean
}) {
  const { t } = useI18n()
  const toast = useToast()

  const handleSaved = async (responseId: string) => {
    // Auto-generar Word y guardar en patient_documents
    try {
      const res = await fetch('/api/reporte-ficha-clinica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId }),
      })
      if (!res.ok) return

      const blob  = await res.blob()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('full_name,role').eq('id', user!.id).maybeSingle()

      // Subir al bucket
      const fileName = `Ficha_${childName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.docx`
      const path = `${childId}/${Date.now()}_${fileName}`
      const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })

      const { url: publicUrl } = await subirArchivoPrivado('patient-documents', childId, file)

      await supabase.from('patient_documents').insert({
        child_id:         childId,
        uploaded_by:      user!.id,
        uploader_role:    profile?.role || 'especialista',
        uploader_name:    profile?.full_name || 'Clínico',
        file_name:        fileName,
        file_url:         publicUrl,
        file_type:        'word',
        file_size:        blob.size,
        category:         'informe',
        description:      'Ficha clínica generada automáticamente',
        visible_to_parent: false,
      })

      toast.success(t('auto.patientsView.wordGeneradoYGuardadoEn'))
    } catch (e: any) {
      console.error('Error auto-generando Word:', e)
    }
  }

  return <RellenarFicha childId={childId} childName={childName} isDark={isDark} onSaved={handleSaved} />
}

export default function PatientsView({ onPatientSelect, initialChildId, initialTab, enabledTabs }: {
  onPatientSelect?: (id: string, name: string) => void
  initialChildId?: string | null
  initialTab?: string | null
  enabledTabs?: {
    info?: boolean; programas?: boolean; evaluaciones?: boolean
    'eval-inicial'?: boolean; historial?: boolean; fichas?: boolean; documentos?: boolean
  }
} = {}) {
  const { t } = useI18n()
  const toast  = useToast()

  const [pacientes, setPacientes] = useState<any[]>([])
  const [pacienteLimit, setPacienteLimit] = useState(0)
  const [filtrados, setFiltrados] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [currentRole, setCurrentRole] = useState('')

  // En móvil: 'list' | 'detail'. En desktop ambos visibles.
  const [mobileView, setMobileView] = useState<'list'|'detail'>('list')
  const [selected, setSelected] = useState<any>(null)
  const [tab, setTab] = useState<'info'|'programas'|'evaluaciones'|'eval-inicial'|'historial'|'fichas'|'documentos'>('info')

  // Nuevo paciente
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ name:'', birth_date:'', diagnosis:'' })
  const [consentimiento, setConsentimiento] = useState(false)
  const [saving, setSaving] = useState(false)

  // ── Edición inline del nombre en el header ────────────────────────────────
  const [editingHeaderName, setEditingHeaderName] = useState(false)
  const [headerNameInput, setHeaderNameInput] = useState('')
  const [savingHeaderName, setSavingHeaderName] = useState(false)

  const startEditHeaderName = () => {
    setHeaderNameInput(selected?.name || '')
    setEditingHeaderName(true)
  }
  const cancelEditHeaderName = () => { setEditingHeaderName(false); setHeaderNameInput('') }
  const saveHeaderName = async () => {
    const trimmed = headerNameInput.trim()
    if (!trimmed || trimmed === selected?.name) { cancelEditHeaderName(); return }
    setSavingHeaderName(true)
    try {
      const { error } = await supabase.from('children').update({ name: trimmed }).eq('id', selected.id)
      if (error) throw error
      const updated = { ...selected, name: trimmed }
      setSelected(updated)
      setPacientes(prev => prev.map(p => p.id === selected.id ? { ...p, name: trimmed } : p))
      setFiltrados(prev => prev.map(p => p.id === selected.id ? { ...p, name: trimmed } : p))
      if (onPatientSelect) onPatientSelect(selected.id, trimmed)
      toast.success(t('common.exitoGuardado'))
      setEditingHeaderName(false)
    } catch (e: any) { toast.error(e.message) }
    finally { setSavingHeaderName(false) }
  }

  // ── Cargar ────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setIsLoading(true)
    const { data } = await supabase.from('children').select('*').order('name', { ascending: true })
    if (data) { setPacientes(data); setFiltrados(data) }
    setIsLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { getControlStatus().then(st => setPacienteLimit(Number(st.limits?.paciente || 0))).catch(() => {}) }, [])

  // Auto-seleccionar paciente si viene desde una alerta del dashboard
  useEffect(() => {
    if (!initialChildId || pacientes.length === 0) return
    const target = pacientes.find(p => p.id === initialChildId)
    if (target) {
      selectPatient(target, initialTab || undefined)
    }
  }, [initialChildId, pacientes])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      setCurrentRole(data?.role || '')
    })
  }, [])

  // ── Filtrar ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!search.trim()) { setFiltrados(pacientes); return }
    const q = search.toLowerCase()
    setFiltrados(pacientes.filter(p => p.name?.toLowerCase().includes(q) || p.diagnosis?.toLowerCase().includes(q) || p.apodo?.toLowerCase().includes(q)))
  }, [search, pacientes])

  // ── Seleccionar paciente ──────────────────────────────────────────────────
  const selectPatient = (p: any, overrideTab?: string) => {
    setSelected(p); setTab((overrideTab as any) || 'info')
    setMobileView('detail')   // en móvil ir a la ficha
    if (onPatientSelect) onPatientSelect(p.id, p.name)  // notify parent for ARIA context
  }

  // ── Volver a la lista (solo móvil) ────────────────────────────────────────
  const goBack = () => { setMobileView('list'); setSelected(null) }

  // ── Crear nuevo ───────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newForm.name.trim()) { toast.error(t('pacientes.nombreRequerido')); return }
    if (!consentimiento) return
    // Bloqueo de límite de pacientes (lo define el programador en /control).
    try {
      const st = await getControlStatus()
      const limit = Number(st.limits?.paciente || 0)
      if (limit > 0) {
        const { count } = await supabase.from('children').select('id', { count: 'exact', head: true })
        if ((count || 0) >= limit) {
          toast.error(t('auto.patientsView.limiteDePacientesAlcanzadoSolo', { v1: String(count), v2: String(limit) }))
          return
        }
      }
    } catch { /* si falla el chequeo, deja que la base decida */ }
    setSaving(true)
    try {
      const { data, error } = await supabase.from('children').insert({
        name: newForm.name.trim(),
        birth_date: newForm.birth_date || null,
        diagnosis: newForm.diagnosis.trim() || null,
        age: newForm.birth_date ? calcularEdadNumerica(newForm.birth_date) : null,
        ...(await datosConsentimiento()),
      }).select().single()
      if (error) throw error
      toast.success(t('pacientes.creado'))
      setNewForm({ name:'', birth_date:'', diagnosis:'' })
      setConsentimiento(false)
      setShowNew(false)
      await cargar()
      if (data) selectPatient(data)
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  type TabId = 'info'|'programas'|'evaluaciones'|'eval-inicial'|'historial'|'fichas'|'documentos'
  const ALL_TABS: { id: TabId; icon: React.ReactNode; label: string; short: string }[] = [
    { id:'info',         icon:<User size={14}/>,          label: t('pacientes.informacion'), short: 'Info'  },
    { id:'programas',    icon:<ClipboardList size={14}/>,  label: t('nav.programas'),          short: 'ABA'   },
    { id:'evaluaciones', icon:<ClipboardCheck size={14}/>, label: t('nav.evaluaciones'),       short: 'Eval.' },
    { id:'eval-inicial', icon:<ClipboardPen size={14}/>,   label: t('pacientes.tabEvalInicial'), short: t('pacientes.tabEvalInicialShort') },
    { id:'historial',    icon:<History size={14}/>,        label: t('pacientes.tabHistorial'),   short: t('pacientes.tabHistorialShort') },
    { id:'fichas',       icon:<FileText size={14}/>,      label: t('pacientes.tabFichas'),      short: t('pacientes.tabFichas')},
    { id:'documentos',   icon:<FolderOpen size={14}/>,    label: t('pacientes.tabDocumentos'),  short: t('pacientes.tabDocumentosShort')  },
  ]
  const TABS = ALL_TABS.filter(tb => !enabledTabs || enabledTabs[tb.id] !== false)

  // ── PANEL LISTA ───────────────────────────────────────────────────────────
  const ListPanel = (
    <div
      className={`
        v-scope flex h-full flex-col overflow-hidden border-v-border bg-v-elevated
        ${mobileView === 'detail' ? 'hidden' : 'flex'}
        md:flex md:w-72 md:flex-shrink-0 md:border-r xl:w-80
      `}
    >
      {/* Header */}
      <div className="shrink-0 space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-semibold tracking-tight text-v-text">{t('nav.pacientes')}</p>
            <span className="rounded-full bg-v-accent-soft px-2 py-0.5 text-[11px] font-bold text-v-accent">{filtrados.length}</span>
            {pacienteLimit > 0 && (
              <span className={`text-[11px] font-semibold ${pacientes.length >= pacienteLimit ? 'text-v-danger' : 'text-v-subtle'}`}>
                {pacientes.length}/{pacienteLimit}
              </span>
            )}
          </div>
          <motion.button whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.06 }} onClick={() => setShowNew(true)}
            title={t('pacientes.nuevo')}
            className="v-brand grid size-9 place-items-center rounded-full">
            <Plus size={16} />
          </motion.button>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-v-subtle" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('ui.search_patient')}
            className="w-full rounded-full border border-v-border bg-v-bg py-2.5 pl-10 pr-4 text-sm text-v-text outline-none transition-shadow placeholder:text-v-subtle focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft" />
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 space-y-1 overflow-y-auto px-2.5 pb-4" style={{ scrollbarWidth: 'thin' }}>
        {isLoading
          ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-v-accent" size={22} /></div>
          : filtrados.length === 0
            ? <div className="flex flex-col items-center py-12 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-v-fill"><Users size={20} className="text-v-subtle" /></span>
                <p className="mt-3 text-sm text-v-muted">{search ? t('common.sinResultados') : t('pacientes.sinPacientes')}</p>
              </div>
            : filtrados.map((p, i) => {
                const active = selected?.id === p.id
                return (
                  <motion.button key={p.id} onClick={() => selectPatient(p)}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i, 12) * 0.025 }}
                    className={`group relative flex w-full items-center gap-3 rounded-v-sm px-2.5 py-2.5 text-left transition-colors ${active ? '' : 'hover:bg-v-fill'}`}>
                    {active && (
                      <motion.span layoutId="patient-active" className="absolute inset-0 rounded-v-sm bg-v-accent-soft"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                    )}
                    <span className="relative"><Avatar name={p.name} size="sm" active={active} /></span>
                    <div className="relative min-w-0 flex-1">
                      <p className={`truncate text-sm font-semibold ${active ? 'text-v-accent' : 'text-v-text'}`}>
                        {getDisplayName(p, currentRole)}
                      </p>
                      <p className="truncate text-xs text-v-subtle">
                        {p.diagnosis || t('pacientes.sinDiagnostico')} · {p.birth_date ? calcularEdadNumerica(p.birth_date) : (p.age || '?')} {t('common.anos')}
                      </p>
                    </div>
                    <ChevronRight size={14} className={`relative shrink-0 transition-all ${active ? 'text-v-accent' : 'text-v-subtle opacity-0 group-hover:translate-x-0.5 group-hover:opacity-100'}`} />
                  </motion.button>
                )
              })
        }
      </div>
    </div>
  )

  // ── PANEL DETALLE ─────────────────────────────────────────────────────────
  const DetailPanel = (
    <div
      className={`
        min-w-0 flex-1 flex flex-col overflow-y-auto md:overflow-hidden
        ${mobileView === 'list' ? 'hidden' : 'flex'}
        md:flex
      `}
    >
      {selected ? (
        <>
          {/* Header paciente */}
          <div className="v-scope shrink-0 border-b border-v-border bg-v-elevated">
            <motion.div key={selected.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 px-5 pb-3 pt-5">
              {/* Botón volver — solo móvil */}
              <button onClick={goBack}
                className="-ml-1 grid size-9 shrink-0 place-items-center rounded-full text-v-text transition-colors hover:bg-v-fill md:hidden">
                <ArrowLeft size={18}/>
              </button>
              <Avatar name={selected.name} size="md" active/>
              <div className="flex-1 min-w-0">
                {editingHeaderName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={headerNameInput}
                      onChange={e => setHeaderNameInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveHeaderName(); if (e.key === 'Escape') cancelEditHeaderName() }}
                      className="flex-1 min-w-0 text-base font-bold rounded-lg px-2 py-0.5 leading-tight outline-none"
                      style={{ background: 'var(--muted-bg)', color: 'var(--text-primary)', border: '1.5px solid #0284c7' }}
                    />
                    <button onClick={saveHeaderName} disabled={savingHeaderName}
                      className="p-1 rounded-lg flex-shrink-0 transition-all"
                      style={{ background: '#0284c7', color: '#fff' }}>
                      {savingHeaderName ? <Loader2 size={13} className="animate-spin"/> : <Check size={13}/>}
                    </button>
                    <button onClick={cancelEditHeaderName}
                      className="p-1 rounded-lg flex-shrink-0 transition-all"
                      style={{ background: 'var(--muted-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>
                      <X size={13}/>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group">
                    <h1 className="truncate text-xl font-semibold leading-tight tracking-tight text-v-text">
                      {selected.name}
                    </h1>
                    <button onClick={startEditHeaderName}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg flex-shrink-0 transition-all"
                      title={t('common.editar')}
                      style={{ color: 'var(--text-muted)' }}>
                      <Edit size={13}/>
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className="rounded-full bg-v-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-v-accent">
                    {selected.diagnosis || t('pacientes.sinDiagnostico')}
                  </span>
                  {(selected.birth_date || selected.age) &&
                    <span className="text-xs text-v-subtle">
                      {selected.birth_date ? calcularEdadNumerica(selected.birth_date) : selected.age} {t('common.anos')}
                    </span>}
                </div>
              </div>
            </motion.div>

            {/* Tabs — indicador animado que se desliza entre pestañas */}
            {/* Si las pestañas no caben (ventana angosta), se deslizan con flechas, rueda o barra */}
            <ScrollRow className="px-1 sm:px-3" activeKey={tab}>
              <div className="grid w-full gap-0.5 sm:flex sm:min-w-max sm:gap-1" style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}>
              {TABS.map(tb => {
                const activo = tab === tb.id
                return (
                <button key={tb.id} onClick={() => setTab(tb.id)} data-active={activo}
                  className={`group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 pb-2.5 pt-2 text-[10px] font-medium transition-colors sm:flex-row sm:gap-2 sm:px-3 sm:py-3 sm:text-[13px] ${activo ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}
                  title={tb.label}>
                  <span className={`grid size-7 place-items-center rounded-[30%] transition-all duration-200 group-hover:scale-105 ${activo ? 'bg-v-accent-soft' : ''}`}>
                    {tb.id === 'info'         && <User           size={16}/>}
                    {tb.id === 'programas'    && <ClipboardList  size={16}/>}
                    {tb.id === 'evaluaciones' && <ClipboardCheck size={16}/>}
                    {tb.id === 'eval-inicial' && <ClipboardPen   size={16}/>}
                    {tb.id === 'historial'    && <History        size={16}/>}
                    {tb.id === 'fichas'       && <FileText       size={16}/>}
                    {tb.id === 'documentos'   && <FolderOpen     size={16}/>}
                  </span>
                  <span className="w-full truncate text-center sm:hidden">{tb.short}</span>
                  <span className="hidden whitespace-nowrap sm:inline">{tb.label}</span>
                  {activo && (
                    <motion.span layoutId="patient-tab" className="v-brand absolute inset-x-2 bottom-0 h-[3px] rounded-full sm:inset-x-3"
                      style={{ boxShadow: 'none' }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                  )}
                </button>
                )
              })}
              </div>
            </ScrollRow>
          </div>

          {/* Contenido tab */}
          <AnimatePresence mode="wait">
          <motion.div key={`${selected.id}-${tab}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            className="min-w-0 flex-1 overflow-x-hidden pb-28 md:overflow-y-auto md:pb-24">
            {tab==='info' &&
              <PatientInfoTab
                nino={selected}
                onSaved={async()=>{
                  await cargar()
                  // Fetch fresh data directly from DB to avoid stale closure
                  const { data: fresh } = await supabase.from('children').select('*').eq('id', selected.id).maybeSingle()
                  if (fresh) setSelected(fresh)
                }}
                onDeleted={async()=>{
                  // El paciente fue eliminado — recargar la lista y deseleccionarlo
                  setSelected(null)
                  await cargar()
                }}
              />}
            {tab==='programas' && <div className="p-3 sm:p-5"><ProgramasABAView childId={selected.id} childName={selected.name}/></div>}
            {tab==='evaluaciones' && <div className="p-3 sm:p-5"><EvaluacionesUnificadas initialChildId={selected.id} initialChildName={selected.name}/></div>}
            {tab==='eval-inicial' && <div className="p-3 sm:p-5"><EvaluacionInicialAdmin childId={selected.id} childName={selected.name} /></div>}
            {tab==='historial' && <div className="p-3 sm:p-5"><AIReportView initialChildId={selected.id} /></div>}
            {tab==='fichas' && (
              <FichasTab
                childId={selected.id}
                childName={selected.name}
                currentRole={currentRole}
              />
            )}
            {tab==='documentos' && <div className="p-3 sm:p-5"><DocumentosView childId={selected.id} childName={selected.name} currentRole="admin" /></div>}
          </motion.div>
          </AnimatePresence>
        </>
      ) : (
        /* Empty state — solo visible en desktop */
        <div className="v-scope hidden flex-1 flex-col items-center justify-center gap-4 p-8 md:flex">
          <motion.span animate={{ y: [0, -6, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className="grid size-20 place-items-center rounded-[30%] bg-v-accent-soft">
            <Users size={34} className="text-v-accent"/>
          </motion.span>
          <div className="text-center">
            <h3 className="mb-1 text-lg font-semibold text-v-text">{t('pacientes.seleccionaUno')}</h3>
            <p className="max-w-xs text-sm text-v-muted">{t('pacientes.seleccionaDesc')}</p>
          </div>
          <button onClick={()=>setShowNew(true)}
            className="v-brand inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold">
            <Plus size={15}/> {t('pacientes.nuevo')}
          </button>
        </div>
      )}
    </div>
  )

  // ── MODAL nuevo paciente ──────────────────────────────────────────────────
  const NewModal = showNew && (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#081426]/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={()=>setShowNew(false)}>
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={e => e.stopPropagation()}
        className="v-scope w-full space-y-4 rounded-t-v-lg border border-v-border bg-v-elevated p-6 shadow-v-lg sm:max-w-md sm:rounded-v-lg">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-v-text">
            <span className="v-brand grid size-9 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><Plus size={18}/></span>
            {t('pacientes.nuevo')}
          </h3>
          <button onClick={()=>setShowNew(false)} className="grid size-9 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-fill hover:text-v-text">
            <X size={16}/>
          </button>
        </div>
        <div className="space-y-3">
          {[
            { key:'name',       label:t('common.nombre'),            type:'text', placeholder:'Ej: María García', req:true },
            { key:'birth_date', label:t('pacientes.fechaNacimiento'), type:'date', placeholder:'',                req:false },
            { key:'diagnosis',  label:t('pacientes.diagnostico'),    type:'text', placeholder:'Ej: TEA Nivel 2',  req:false },
          ].map(f => (
            <div key={f.key}>
              <label className="mb-1.5 block text-xs font-semibold text-v-muted">
                {f.label}{f.req && <span className="ml-0.5 text-v-danger">*</span>}
              </label>
              <input type={f.type} placeholder={f.placeholder}
                value={(newForm as any)[f.key]}
                onChange={e=>setNewForm(fm=>({...fm,[f.key]:e.target.value}))}
                className="w-full rounded-v-sm border border-v-border bg-v-bg px-3.5 py-2.5 text-sm text-v-text outline-none transition-shadow focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft"/>
            </div>
          ))}
        </div>
        <AceptarTerminos tipo="paciente" checked={consentimiento} onChange={setConsentimiento} />
        <div className="flex gap-3 pt-1">
          <button onClick={()=>setShowNew(false)}
            className="flex-1 rounded-full border border-v-border py-3 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill">
            {t('common.cancelar')}
          </button>
          <button onClick={handleCreate} disabled={saving||!newForm.name.trim()||!consentimiento}
            className="v-brand flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
            {t('pacientes.crear')}
          </button>
        </div>
      </motion.div>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-v-bg">
      {ListPanel}
      {DetailPanel}
      {NewModal}
    </div>
  )
}
