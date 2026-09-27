'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useI18n } from '@/lib/i18n-context'
import { useCurrency } from '@/components/CurrencyContext'
import {
  DollarSign, Plus, Search, Download, TrendingUp, CheckCircle2,
  Clock, XCircle, Loader2, Calendar, Save, X, Package, ChevronDown,
  Repeat, Pencil, Trash2, Settings2, Check, FileText,
  BarChart3, CreditCard, Wallet, Banknote, Smartphone, Landmark, MoreHorizontal, ChevronLeft, ChevronRight, UserPlus, Users, HandCoins, AlertCircle, PartyPopper
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { cobradoDe, saldoDe, type Abono } from '@/lib/pagos'

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  paid:      { label: 'Pagado',    color: '#10b981', bg: '#d1fae5' },
  pending:   { label: 'Pendiente', color: '#f59e0b', bg: '#fef3c7' },
  partial:   { label: 'Parcial',   color: '#0069db', bg: '#dbeafe' },
  cancelled: { label: 'Cancelado', color: '#ef4444', bg: '#fee2e2' },
  refunded:  { label: 'Devuelto',  color: '#01abfc', bg: '#ede9fe' },
}
const METHODS      = ['efectivo','yape','plin','transferencia','tarjeta','otro']
// efectivo, yape, plin, transferencia, tarjeta, otro (Yape y Plin con sus colores de marca)
const COLORS       = ['#10b981','#742284','#00b5c3','#0069db','#f59e0b','#94a3b8']

// Etiquetas de fecha localizadas según el idioma activo (Intl)
const _bcp = (loc: string) => loc === 'en' ? 'en-US' : 'es-PE'
const _cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
const mesCorto = (m: number, loc: string) => _cap(new Date(2020, m, 1).toLocaleDateString(_bcp(loc), { month: 'short' }).replace('.', ''))
const mesLargo = (m: number, loc: string) => _cap(new Date(2020, m, 1).toLocaleDateString(_bcp(loc), { month: 'long' }))
const diaCorto = (dow: number, loc: string) => _cap(new Date(2021, 7, 1 + dow).toLocaleDateString(_bcp(loc), { weekday: 'short' }).replace('.', ''))

// ─── Group payments by patient + month ───────────────────────────────────────
// Packages (concept with "(N/M)" pattern) are grouped by their base concept.
// Individual payments keep separate entries so they don't mix with packages.
function groupByPatientMonth(pays: any[], loc: string) {
  const g: Record<string, any> = {}
  pays.forEach(p => {
    const d = new Date(p.paid_at || p.created_at)
    const year = d.getFullYear()
    const month = d.getMonth()

    // Detect package session: concept ends with "(N/M)" where M > 1
    const pkgMatch = p.concept?.match(/^(.+?)\s*\(\d+\/(\d+)\)$/)
    const isPackage = pkgMatch && Number(pkgMatch[2]) > 1

    let k: string
    if (isPackage) {
      // Same package: same base concept + same patient + same month
      const baseConcept = (pkgMatch[1] as string).trim()
      k = `pkg_${p.child_id}_${year}_${month}_${baseConcept}`
    } else {
      // Individual payments: unique per payment id
      k = `ind_${p.id}`
    }

    if (!g[k]) g[k] = {
      key: k,
      child: p.children?.name || p.paciente_externo || '—',
      month: `${year}-${String(month).padStart(2,'0')}`,
      monthLabel: `${mesLargo(month, loc)} ${year}`,
      pays: [],
      total: 0,
      isPackage: !!isPackage,
    }
    g[k].pays.push(p)
    g[k].total += Number(p.amount)
  })
  // Sort: newest month first, then alphabetically by patient
  return Object.values(g).sort((a: any, b: any) => {
    const mc = b.month.localeCompare(a.month)
    if (mc !== 0) return mc
    return a.child.localeCompare(b.child)
  })
}

// ─── KPI ──────────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, icon: Icon, tone, index = 0 }: { label: string; value: React.ReactNode; sub?: string; icon: any; tone: string; index?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, type: 'spring', stiffness: 200, damping: 24 }}
      className="rounded-v border border-v-border bg-v-elevated p-4 shadow-v sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-v-muted">{label}</p>
        <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] ${tone}`}><Icon size={17} /></span>
      </div>
      <p className="v-headline truncate text-2xl tabular-nums text-v-text sm:text-[1.75rem]">{value}</p>
      {sub && <p className="mt-1 truncate text-[11px] text-v-subtle">{sub}</p>}
    </motion.div>
  )
}

// ─── Tonos Vanty por estado y método ─────────────────────────────────────────
const STATUS_TONE: Record<string, { pill: string; dot: string }> = {
  paid:      { pill: 'bg-v-success/15 text-v-success', dot: 'bg-v-success' },
  pending:   { pill: 'bg-v-warning/15 text-v-warning', dot: 'bg-v-warning' },
  partial:   { pill: 'bg-v-accent-soft text-v-accent', dot: 'bg-v-accent' },
  cancelled: { pill: 'bg-v-danger/10 text-v-danger',   dot: 'bg-v-danger' },
  refunded:  { pill: 'bg-v-fill text-v-muted',          dot: 'bg-v-subtle' },
}
const METHOD_ICON: Record<string, any> = {
  efectivo: Banknote, yape: Smartphone, plin: Smartphone, transferencia: Landmark, tarjeta: CreditCard, otro: MoreHorizontal,
}

// Selector de paciente con buscador (reemplaza el <select> nativo, que en listas largas es incómodo)
function ChildCombo({ items, value, onChange, placeholder, searchPh }: {
  items: { id: string; name: string }[]; value: string; onChange: (id: string) => void; placeholder: string; searchPh: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const sel = items.find(i => i.id === value)
  const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const lista = items.filter(i => !q || norm(i.name).includes(norm(q)))
  return (
    <div className="relative">
      <button type="button" onClick={() => { setOpen(o => !o); setQ('') }}
        className={`flex h-11 w-full items-center gap-2.5 rounded-v-sm border bg-v-bg px-3 text-left text-sm transition-colors ${open ? 'border-v-accent ring-4 ring-v-accent-soft' : 'border-v-border hover:border-v-accent/40'}`}>
        {sel
          ? <span className="grid size-7 shrink-0 place-items-center rounded-full bg-v-accent-soft text-xs font-semibold text-v-accent">{sel.name.charAt(0).toUpperCase()}</span>
          : <span className="grid size-7 shrink-0 place-items-center rounded-full bg-v-fill text-v-subtle"><Users size={14} /></span>}
        <span className={`min-w-0 flex-1 truncate ${sel ? 'font-medium text-v-text' : 'text-v-subtle'}`}>{sel?.name || placeholder}</span>
        <ChevronDown size={15} className={`shrink-0 text-v-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
              className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-v-sm border border-v-border bg-v-elevated shadow-v-lg">
              <div className="border-b border-v-border p-2">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-v-subtle" />
                  <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={searchPh}
                    onKeyDown={e => { if (e.key === 'Enter' && lista[0]) { onChange(lista[0].id); setOpen(false) } }}
                    className="h-9 w-full rounded-full bg-v-fill pl-9 pr-3 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none placeholder:text-v-subtle" />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto p-1">
                {lista.length === 0 && <p className="px-3 py-4 text-center text-xs text-v-subtle">—</p>}
                {lista.map(i => (
                  <button key={i.id} type="button" onClick={() => { onChange(i.id); setOpen(false) }}
                    className={`flex w-full items-center gap-2.5 rounded-v-sm px-2.5 py-2 text-left text-sm transition-colors ${i.id === value ? 'bg-v-accent-soft text-v-accent' : 'text-v-text hover:bg-v-fill'}`}>
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-v-accent-soft text-xs font-semibold text-v-accent">{i.name.charAt(0).toUpperCase()}</span>
                    <span className="min-w-0 flex-1 truncate">{i.name}</span>
                    {i.id === value && <Check size={14} className="shrink-0" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// Botones tipo "chip" para elegir una opción (método, estado…)
function ChipGroup({ options, value, onChange }: { options: { v: string; label: string; Icon?: any; dot?: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => {
        const on = value === o.v
        return (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${on ? 'border-v-accent bg-v-accent-soft text-v-accent' : 'border-v-border bg-v-bg text-v-muted hover:text-v-text'}`}>
            {o.Icon && <o.Icon size={13} />}
            {o.dot && <span className={`size-2 rounded-full ${o.dot}`} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// Tarjeta de formulario (a nivel de módulo: si se define dentro del render, los inputs pierden el foco al escribir)
function FormShell({ Icon, title, sub, onClose, children: body }: { Icon: any; title: string; sub?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-v border border-v-accent/30 bg-v-elevated shadow-v-lg">
      <div className="flex items-center gap-3 border-b border-v-border px-5 py-4">
        <span className="v-brand grid size-10 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><Icon size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-tight text-v-text">{title}</p>
          {sub && <p className="text-xs text-v-subtle">{sub}</p>}
        </div>
        <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-fill hover:text-v-text"><X size={17} /></button>
      </div>
      <div className="space-y-5 p-5">{body}</div>
    </motion.div>
  )
}

function ConfirmBar({ texto, onYes, onNo, cancelLabel, deleteLabel }: { texto: string; onYes: () => void; onNo: () => void; cancelLabel: string; deleteLabel: string }) {
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 bg-v-danger/10 px-4 py-2.5">
        <p className="min-w-0 flex-[1_1_200px] text-xs text-v-danger">{texto}</p>
        <button onClick={onNo} className="h-8 rounded-full px-3 text-xs font-semibold text-v-muted hover:bg-v-fill">{cancelLabel}</button>
        <button onClick={onYes} className="h-8 rounded-full bg-v-danger px-3.5 text-xs font-semibold text-white">{deleteLabel}</button>
      </div>
    </motion.div>
  )
}

// ─── Input helper ─────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-v-muted">{label}</label>
      {children}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function SecretariaPagos({ profile, enabledTabs }: { profile: any; enabledTabs?: Record<string, boolean> }) {
  const { t, locale } = useI18n()
  const { symbol, fmt } = useCurrency()
  const toast    = useToast()
  const rtRef    = useRef<any>(null)
  const listRef  = useRef<HTMLDivElement>(null)

  const [tab, setTab] = useState<'dashboard'|'registros'|'deudas'|'agrupado'|'tarifas'>('dashboard')
  const pagosTabs = ([
    { id: 'dashboard', label: 'Dashboard',    Icon: BarChart3 },
    { id: 'registros', label: t('pagos.tabRegistros'), Icon: CreditCard },
    { id: 'deudas',    label: locale === 'en' ? 'Debts' : 'Deudas', Icon: HandCoins },
    { id: 'agrupado',  label: t('pagos.tabPorPaciente'), Icon: Calendar },
    { id: 'tarifas',   label: t('pagos.tabTarifas'), Icon: Package },
  ] as const).filter(t => !enabledTabs || enabledTabs[`pagos_${t.id}`] !== false)
  type PagosTab = 'dashboard'|'registros'|'deudas'|'agrupado'|'tarifas'
  const activeTab: PagosTab = pagosTabs.find(t => t.id === tab) ? tab : (pagosTabs[0]?.id ?? 'dashboard')
  const [payments, setPayments] = useState<any[]>([])
  const [children, setChildren] = useState<any[]>([])
  const [rates, setRates]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [periodo, setPeriodo]   = useState<'semana'|'mes'|'anio'>('mes')
  const [search, setSearch]     = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Forms
  const [showNew, setShowNew]     = useState(false)
  const [showPkg, setShowPkg]     = useState(false)
  const [showRateForm, setShowRateForm] = useState(false)
  const [editingRate, setEditingRate]   = useState<any>(null)

  // Stats
  const [stats, setStats] = useState({ total: 0, cobros: 0, pendiente: 0, cancelados: 0, porMes: [] as any[], porMetodo: [] as any[] })

  // Cobrado = pagados completos + adelantos de los parciales; Por cobrar = pendientes + saldos de parciales
  const buildStats = useCallback((pays: any[]) => {
    const conCobro = pays.filter(p => cobradoDe(p) > 0)
    const canc = pays.filter(p => p.status === 'cancelled')
    const cob  = (a: any[]) => a.reduce((s, p) => s + cobradoDe(p), 0)
    const porMes = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
      const m = d.getMonth(); const y = d.getFullYear()
      const mp = conCobro.filter(p => { const pd = new Date(p.paid_at || p.created_at); return pd.getMonth() === m && pd.getFullYear() === y })
      return { mes: mesCorto(m, locale), total: cob(mp) }
    })
    const porMetodo = METHODS.map((m, i) => ({ name: t('pagos.method.' + m), value: cob(conCobro.filter(p => p.payment_method === m)), color: COLORS[i] })).filter(m => m.value > 0)
    setStats({ total: cob(conCobro), cobros: conCobro.length, pendiente: pays.reduce((s, p) => s + saldoDe(p), 0), cancelados: canc.length, porMes, porMetodo })
  }, [locale, t])

  // Deudas: todo lo pendiente o parcial, sin importar el período elegido
  const [deudas, setDeudas] = useState<any[]>([])
  const cargarDeudas = useCallback(async () => {
    const { data } = await supabase.from('payments').select('*, children(name)').in('status', ['pending', 'partial']).order('created_at', { ascending: true }).limit(1000)
    setDeudas(data || [])
  }, [])
  useEffect(() => { cargarDeudas() }, [cargarDeudas])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const now = new Date()
      let desde = new Date()
      if (periodo === 'semana') desde.setDate(now.getDate() - 7)
      else if (periodo === 'mes') desde = new Date(now.getFullYear(), now.getMonth(), 1)
      else desde = new Date(now.getFullYear(), 0, 1)

      const [{ data: pays }, { data: kids }, { data: svcRates }] = await Promise.all([
        supabase.from('payments').select('*, children(name)').gte('created_at', desde.toISOString()).order('created_at', { ascending: false }).limit(500),
        supabase.from('children').select('id, name').eq('is_active', true).order('name'),
        supabase.from('service_rates').select('*').order('amount', { ascending: true }),
      ])
      const p = pays || []
      setPayments(p); setChildren(kids || []); setRates(svcRates || [])
      buildStats(p)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [periodo, buildStats])

  useEffect(() => { cargar() }, [cargar])

  // Real-time
  useEffect(() => {
    rtRef.current = supabase.channel('payments-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, (payload) => {
        setPayments(prev => {
          let u = prev
          if (payload.eventType === 'INSERT') u = [payload.new, ...prev]
          else if (payload.eventType === 'UPDATE') u = prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p)
          else if (payload.eventType === 'DELETE') u = prev.filter(p => p.id !== (payload.old as any).id)
          buildStats(u); return u
        })
        cargarDeudas()
      }).subscribe()
    return () => { if (rtRef.current) supabase.removeChannel(rtRef.current) }
  }, [buildStats, cargarDeudas])

  // ─── Payment form ───────────────────────────────────────────────────────────
  // modo: 'registrado' (paciente del sistema) | 'externo' (nombre libre, ej. evaluación inicial)
  const emptyForm = { child_id: '', external_name: '', modo: 'registrado' as 'registrado' | 'externo', amount: '', adelanto: '', concept: '', method: 'efectivo', status: 'paid', notes: '', date: new Date().toISOString().split('T')[0] }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const rateNames = rates.map(r => r.name)

  const handleSave = async () => {
    const esExterno = form.modo === 'externo'
    if (esExterno) {
      if (!form.external_name.trim()) { toast.error(t('pagos.errNombreNino')); return }
    } else {
      if (!form.child_id) { toast.error(t('pagos.errSelPaciente')); return }
    }
    if (!form.amount || isNaN(Number(form.amount))) { toast.error(t('pagos.errMontoValido')); return }
    if (!form.concept.trim()) { toast.error(t('pagos.errConcepto')); return }
    const monto = Number(form.amount)
    const adelanto = Number(form.adelanto)
    if (form.status === 'partial' && (!adelanto || adelanto <= 0 || adelanto >= monto)) {
      toast.error(locale === 'en' ? 'The down payment must be greater than 0 and less than the total.' : 'El adelanto debe ser mayor a 0 y menor que el total.'); return
    }
    setSaving(true)
    try {
      const fecha = new Date(form.date + 'T12:00:00').toISOString() // mediodía: en UTC-5 no cambia de día
      const pagado = form.status === 'paid' ? monto : form.status === 'partial' ? adelanto : 0
      const { error } = await supabase.from('payments').insert({
        child_id: esExterno ? null : form.child_id,
        paciente_externo: esExterno ? form.external_name.trim() : null,
        amount: monto, concept: form.concept.trim(),
        payment_method: form.method, status: form.status, notes: form.notes || null,
        paid_at: form.status === 'paid' ? fecha : null,
        amount_paid: pagado,
        abonos: pagado > 0 ? [{ monto: pagado, fecha, metodo: form.method } satisfies Abono] : [],
        created_by: profile?.id,
      })
      if (error) throw error
      toast.success(t('pagos.pagoRegistrado')); setShowNew(false); setForm(emptyForm)
      await Promise.all([cargar(), cargarDeudas()])   // ← refrescar tabla para que el nuevo pago aparezca de inmediato
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  // ─── Package form ───────────────────────────────────────────────────────────
  const emptyPkg = {
    child_id: '', external_name: '', modo: 'registrado' as 'registrado' | 'externo',
    amount: '', concept: '', method: 'efectivo', status: 'paid',
    calMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
  }
  const [pkg, setPkg] = useState(emptyPkg)
  const [pkgDates, setPkgDates] = useState<string[]>([]) // manually selected dates
  const [savingPkg, setSavingPkg] = useState(false)

  const handleSavePkg = async () => {
    const esExterno = pkg.modo === 'externo'
    if (esExterno) {
      if (!pkg.external_name.trim()) { toast.error(t('pagos.errNombreNino')); return }
    } else {
      if (!pkg.child_id) { toast.error(t('pagos.errSelPaciente')); return }
    }
    if (!pkg.amount || isNaN(Number(pkg.amount))) { toast.error(t('pagos.errMontoSesion')); return }
    if (!pkg.concept.trim()) { toast.error(t('pagos.errConcepto')); return }
    if (pkgDates.length === 0) { toast.error(t('pagos.errSelDia')); return }
    setSavingPkg(true)
    try {
      const inserts = pkgDates.map((date, i) => ({
        child_id: esExterno ? null : pkg.child_id,
        paciente_externo: esExterno ? pkg.external_name.trim() : null,
        amount: Number(pkg.amount),
        concept: `${pkg.concept.trim()} (${i+1}/${pkgDates.length})`,
        payment_method: pkg.method, status: pkg.status,
        paid_at: pkg.status === 'paid' ? new Date(date + 'T12:00:00').toISOString() : null,
        notes: t('pagos.notaPaquete', { n: String(pkgDates.length) }),
        created_by: profile?.id,
      }))
      const { error } = await supabase.from('payments').insert(inserts)
      if (error) throw error
      toast.success(t('pagos.pagosCreados', { n: String(pkgDates.length), total: (Number(pkg.amount) * pkgDates.length).toFixed(2) }))
      setShowPkg(false); setPkg(emptyPkg); setPkgDates([])
      await cargar()   // ← refrescar tabla para que los nuevos pagos aparezcan de inmediato
    } catch (e: any) { toast.error(e.message) }
    finally { setSavingPkg(false) }
  }

  // Confirmación en línea de borrados: { tipo, id }
  const [confirmar, setConfirmar] = useState<{ tipo: 'pago' | 'paquete' | 'tarifa'; id: string } | null>(null)
  const [statusMenu, setStatusMenu] = useState<string | null>(null)

  // ─── Abonos: registrar un pago a cuenta de una deuda ─────────────────────────
  const [abonoFor, setAbonoFor] = useState<{ id: string; monto: string; metodo: string } | null>(null)
  const [savingAbono, setSavingAbono] = useState(false)
  const registrarAbono = async (p: any, montoTxt: string, metodo: string) => {
    const monto = Math.round(Number(montoTxt) * 100) / 100
    // Solo un parcial arrastra lo ya pagado. Si el cobro estaba pagado/pendiente/anulado y se pasa a parcial,
    // lo ingresado es el adelanto sobre el total (se reinicia el historial de abonos).
    const sigueParcial = p.status === 'partial'
    const saldo = sigueParcial ? saldoDe(p) : Number(p.amount)
    if (!monto || monto <= 0) { toast.error(locale === 'en' ? 'Enter a valid amount.' : 'Ingresá un monto válido.'); return }
    if (monto > saldo + 0.001) { toast.error(locale === 'en' ? `The amount exceeds the balance (${fmt(saldo)}).` : `El monto supera el saldo (${fmt(saldo)}).`); return }
    const pagadoAntes = sigueParcial ? Number(p.amount_paid || 0) : 0
    const completo = pagadoAntes + monto >= Number(p.amount) - 0.001
    const ahora = new Date().toISOString()
    const abonos: Abono[] = [...(sigueParcial && Array.isArray(p.abonos) ? p.abonos : []), { monto, fecha: ahora, metodo }]
    setSavingAbono(true)
    const { error } = await supabase.from('payments').update({
      amount_paid: completo ? Number(p.amount) : Math.round((pagadoAntes + monto) * 100) / 100,
      abonos, status: completo ? 'paid' : 'partial', paid_at: completo ? ahora : null,
      payment_method: sigueParcial ? p.payment_method : metodo,
    }).eq('id', p.id)
    setSavingAbono(false)
    if (error) { toast.error(t('pagos.errActualizar')); return }
    setAbonoFor(null)
    toast.success(completo
      ? (locale === 'en' ? 'Debt fully paid' : 'Deuda saldada por completo')
      : (locale === 'en' ? `Payment of ${fmt(monto)} recorded` : `Abono de ${fmt(monto)} registrado`))
    await Promise.all([cargar(), cargarDeudas()])
  }

  // Cambiar estado desde la lista. "Parcial" pide el adelanto antes de guardar.
  const cambiarEstado = async (p: any, k: string) => {
    setStatusMenu(null)
    if (k === p.status) return
    if (k === 'partial') { setAbonoFor({ id: p.id, monto: '', metodo: p.payment_method || 'efectivo' }); return }
    const ahora = new Date().toISOString()
    const abonosPrev: Abono[] = Array.isArray(p.abonos) ? p.abonos : []
    const cambios: Record<string, any> =
      k === 'paid'    ? { status: k, paid_at: ahora, amount_paid: Number(p.amount),
                          abonos: p.status === 'partial' && saldoDe(p) > 0 ? [...abonosPrev, { monto: saldoDe(p), fecha: ahora, metodo: p.payment_method }] : (abonosPrev.length ? abonosPrev : [{ monto: Number(p.amount), fecha: ahora, metodo: p.payment_method }]) }
      : k === 'pending' ? { status: k, paid_at: null, amount_paid: 0, abonos: [] }
      : { status: k, paid_at: null }
    const prevPayments = payments
    const updated = payments.map(x => x.id === p.id ? { ...x, ...cambios } : x)
    setPayments(updated); buildStats(updated)   // cambio optimista
    const { error } = await supabase.from('payments').update(cambios).eq('id', p.id)
    if (!error) { toast.success(t('pagos.actualizadoA', { estado: t('pagos.status.' + k) })); cargarDeudas() }
    else { setPayments(prevPayments); buildStats(prevPayments); toast.error(t('pagos.errActualizar')) }
  }

  // ─── Eliminar pago ──────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const handleDeletePago = async (p: any) => {
    const monto = fmt(Number(p.amount))
    const nombre = p.children?.name || p.paciente_externo || t('pagos.pacienteGenerico')
    void nombre; void monto
    setConfirmar(null)
    setDeletingId(p.id)
    // Optimistic update — sacar de la lista al instante
    const prev = payments
    const next = payments.filter(x => x.id !== p.id)
    setPayments(next); buildStats(next)
    try {
      const { error } = await supabase.from('payments').delete().eq('id', p.id)
      if (error) throw error
      toast.success(t('pagos.pagoEliminado'))
    } catch (e: any) {
      // Rollback si falla
      setPayments(prev); buildStats(prev)
      toast.error(t('pagos.noSePudoEliminar') + e.message)
    } finally {
      setDeletingId(null)
    }
  }

  // Eliminar paquete completo (todos los pagos del grupo)
  const handleDeletePaquete = async (g: any) => {
    const total = fmt(g.total)
    const cantidad = g.pays.length
    void total
    setConfirmar(null)
    const ids = g.pays.map((p: any) => p.id)
    const prev = payments
    const next = payments.filter(x => !ids.includes(x.id))
    setPayments(next); buildStats(next)
    try {
      const { error } = await supabase.from('payments').delete().in('id', ids)
      if (error) throw error
      toast.success(t('pagos.paqueteEliminado', { n: String(cantidad) }))
    } catch (e: any) {
      setPayments(prev); buildStats(prev)
      toast.error(t('pagos.noSePudoEliminar') + e.message)
    }
  }

  // ─── Rate CRUD ──────────────────────────────────────────────────────────────
  const emptyRate = { name: '', description: '', amount: '', duration_min: '60' }
  const [rateForm, setRateForm] = useState(emptyRate)
  const [savingRate, setSavingRate] = useState(false)

  const openRateForm = (r?: any) => {
    if (r) { setEditingRate(r); setRateForm({ name: r.name, description: r.description || '', amount: String(r.amount), duration_min: String(r.duration_min) }) }
    else { setEditingRate(null); setRateForm(emptyRate) }
    setShowRateForm(true)
  }

  const handleSaveRate = async () => {
    if (!rateForm.name.trim()) { toast.error(t('pagos.errNombreServicio')); return }
    if (!rateForm.amount || isNaN(Number(rateForm.amount))) { toast.error(t('pagos.errMontoValido')); return }
    setSavingRate(true)
    try {
      const payload = { name: rateForm.name.trim(), description: rateForm.description.trim() || null, amount: Number(rateForm.amount), duration_min: Number(rateForm.duration_min) || 60, is_active: true }
      if (editingRate) await supabase.from('service_rates').update(payload).eq('id', editingRate.id)
      else await supabase.from('service_rates').insert(payload)
      toast.success(editingRate ? t('pagos.tarifaActualizada') : t('pagos.tarifaCreada'))
      setShowRateForm(false); cargar()
    } catch (e: any) { toast.error(e.message) }
    finally { setSavingRate(false) }
  }

  const deleteRate = async (id: string) => {
    setConfirmar(null)
    await supabase.from('service_rates').delete().eq('id', id)
    toast.success(t('pagos.tarifaEliminada')); cargar()
  }

  // ─── Excel export via API ───────────────────────────────────────────────────
  const exportExcel = async () => {
    try {
      const params = new URLSearchParams()
      const now = new Date()
      let desde = new Date()
      if (periodo === 'semana') desde.setDate(now.getDate() - 7)
      else if (periodo === 'mes') desde = new Date(now.getFullYear(), now.getMonth(), 1)
      else desde = new Date(now.getFullYear(), 0, 1)
      params.set('desde', desde.toISOString())
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (search) params.set('search', search)
      const res = await fetch(`/api/pagos/export?${params}`)
      if (!res.ok) throw new Error(t('pagos.errGenerarReporte'))
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a'); a.href = url
      a.download = `pagos_jugando_aprendo_${new Date().toISOString().slice(0,10)}.xlsx`; a.click()
      URL.revokeObjectURL(url); toast.success(t('pagos.excelExportado'))
    } catch (e: any) { toast.error(e.message) }
  }

  const filtered = payments.filter(p => {
    const q = search.toLowerCase()
    return (filterStatus === 'all' || p.status === filterStatus) &&
           (!q || (p.children?.name || p.paciente_externo || '').toLowerCase().includes(q) || (p.concept || '').toLowerCase().includes(q))
  })
  const grouped = groupByPatientMonth(filtered, locale)

  const inputCls = 'h-11 w-full rounded-v-sm border border-v-border bg-v-bg px-3.5 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none transition-shadow placeholder:text-v-subtle focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft'
  const metodoOpts = METHODS.map(m => ({ v: m, label: t('pagos.method.' + m), Icon: METHOD_ICON[m] }))
  const estadoOpts = Object.keys(STATUS_CFG).map(k => ({ v: k, label: t('pagos.status.' + k), dot: STATUS_TONE[k]?.dot }))
  const estadoOptsPkg = estadoOpts.filter(o => o.v !== 'partial')
  const buscarPh = locale === 'en' ? 'Search patient…' : 'Buscar paciente…'
  const selPh = locale === 'en' ? 'Choose a patient' : 'Elegí un paciente'

  // Concepto con autocompletado de tarifas (función, no componente: así el input no pierde el foco al escribir)
  const conceptInput = (value: string, onChange: (v: string) => void, onPriceMatch?: (price: string) => void) => (
    <div>
      <input value={value}
        onChange={e => {
          onChange(e.target.value)
          const matched = rates.find(r => r.name.toLowerCase() === e.target.value.toLowerCase())
          if (matched && onPriceMatch) onPriceMatch(String(matched.amount))
        }}
        placeholder={t('admin.phConceptoPago')} className={inputCls} list="concepts-list" />
      <datalist id="concepts-list">
        {rates.map(r => <option key={r.id} value={r.name} />)}
        <option value={t('pagos.optSesionTerapia')} />
        <option value={t('pagos.optEvalInicial')} />
        <option value={t('pagos.optConsultaSeg')} />
        <option value={t('pagos.optMaterial')} />
      </datalist>
      {rates.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {rates.slice(0, 4).map(r => (
            <button key={r.id} type="button" onClick={() => { onChange(r.name); onPriceMatch?.(String(r.amount)) }}
              className="rounded-full bg-v-fill px-2.5 py-1 text-[11px] font-medium text-v-muted transition-colors hover:bg-v-accent-soft hover:text-v-accent">
              {r.name} · {fmt(Number(r.amount))}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  // Paciente: registrado (buscador) o sin inscribir (nombre libre)
  const pacienteInput = (modo: 'registrado' | 'externo', setModo: (m: 'registrado' | 'externo') => void, childId: string, setChild: (id: string) => void, ext: string, setExt: (v: string) => void, extPh: string) => (
    <div>
      <div className="mb-2 flex rounded-full bg-v-fill p-0.5">
        {([['registrado', t('pagos.registrado'), Users], ['externo', t('pagos.sinInscribir'), UserPlus]] as const).map(([m, lbl, Ic]) => (
          <button key={m} type="button" onClick={() => setModo(m)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-semibold transition-all ${modo === m ? 'bg-v-elevated text-v-accent shadow-v' : 'text-v-muted hover:text-v-text'}`}>
            <Ic size={13} /> {lbl}
          </button>
        ))}
      </div>
      {modo === 'registrado'
        ? <ChildCombo items={children} value={childId} onChange={setChild} placeholder={selPh} searchPh={buscarPh} />
        : <input value={ext} onChange={e => setExt(e.target.value)} placeholder={extPh} className={inputCls} />}
    </div>
  )

  const abonoBar = (p: any, titulo: string) => {
    const saldo = p.status === 'partial' ? saldoDe(p) : Number(p.amount)
    const a = abonoFor!
    return (
      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
        <div className="space-y-3 border-t border-v-border bg-v-accent-soft/50 px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 text-sm font-semibold text-v-text">{titulo}</p>
            <span className="text-xs text-v-muted">{locale === 'en' ? 'Balance' : 'Saldo'}: <b className="tabular-nums text-v-text">{fmt(saldo)}</b></span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-44">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-v-subtle">{symbol}</span>
              <input autoFocus type="number" inputMode="decimal" value={a.monto} onChange={e => setAbonoFor({ ...a, monto: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') registrarAbono(p, a.monto, a.metodo) }}
                placeholder="0.00" className={`${inputCls} h-10 bg-v-elevated pl-10 font-semibold tabular-nums`} />
            </div>
            <button type="button" onClick={() => setAbonoFor({ ...a, monto: String(saldo) })}
              className="h-10 rounded-full border border-v-border bg-v-elevated px-3.5 text-xs font-semibold text-v-muted transition-colors hover:text-v-accent">
              {locale === 'en' ? 'Full balance' : 'Todo el saldo'}
            </button>
          </div>
          <ChipGroup options={metodoOpts} value={a.metodo} onChange={v => setAbonoFor({ ...a, metodo: v })} />
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={() => setAbonoFor(null)} className="h-9 rounded-full px-4 text-sm font-semibold text-v-muted hover:bg-v-fill">{t('common.cancelar')}</button>
            <button onClick={() => registrarAbono(p, a.monto, a.metodo)} disabled={savingAbono}
              className="v-brand inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold disabled:opacity-50">
              {savingAbono ? <Loader2 size={14} className="animate-spin" /> : <HandCoins size={14} />} {locale === 'en' ? 'Record payment' : 'Registrar abono'}
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  const vacioCard = (Icon: any, titulo: string, texto?: string) => (
    <div className="flex flex-col items-center rounded-v border border-dashed border-v-border bg-v-elevated px-6 py-14 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-v-fill text-v-subtle"><Icon size={20} /></span>
      <p className="text-sm font-semibold text-v-text">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-xs text-v-subtle">{texto}</p>}
    </div>
  )
  const fechaCorta = (d: Date) => d.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="v-scope space-y-4 md:space-y-5">

      {/* ── HEADER ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="v-brand hidden size-11 shrink-0 place-items-center rounded-[30%] sm:grid" style={{ boxShadow: 'none' }}><Wallet size={20} /></span>
        <div className="min-w-0 flex-[1_1_220px]">
          {/* En celular el título ya está en la barra superior */}
          <h2 className="v-headline hidden text-xl text-v-text sm:block">{t('nav.pagosFacturacion')}</h2>
          <p className="flex flex-wrap items-center gap-2 text-xs text-v-subtle">
            {t('pagos.subtitulo')}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-v-success/15 px-2 py-0.5 text-[11px] font-semibold text-v-success">
              <span className="size-1.5 animate-pulse rounded-full bg-v-success" /> {t('pagos.enTiempoReal')}
            </span>
          </p>
        </div>
        <div className="flex w-full rounded-full bg-v-fill p-1 sm:w-auto">
          {(['semana', 'mes', 'anio'] as const).map(pp => (
            <button key={pp} onClick={() => setPeriodo(pp)}
              className={`relative flex-1 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors sm:flex-none ${periodo === pp ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
              {periodo === pp && <motion.span layoutId="pagos-periodo" className="absolute inset-0 rounded-full bg-v-elevated shadow-v" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className="relative">{pp === 'semana' ? t('pagos.semana') : pp === 'mes' ? t('pagos.mes') : t('pagos.anio')}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <KPI index={0} label={t('pagos.kpiIngresos')} value={loading ? '—' : fmt(stats.total)} sub={t('pagos.kpiIngresosSub')} icon={DollarSign} tone="bg-v-success/15 text-v-success" />
        <KPI index={1} label={t('pagos.kpiTransacciones')} value={loading ? '—' : stats.cobros} sub={t('pagos.kpiTransaccionesSub')} icon={CheckCircle2} tone="bg-v-accent-soft text-v-accent" />
        <KPI index={2} label={t('pagos.kpiPorCobrar')} value={loading ? '—' : fmt(stats.pendiente)} sub={t('pagos.kpiPorCobrarSub')} icon={Clock} tone="bg-v-warning/15 text-v-warning" />
        <KPI index={3} label={t('pagos.kpiCancelados')} value={loading ? '—' : stats.cancelados} sub={t('pagos.kpiCanceladosSub')} icon={XCircle} tone="bg-v-danger/10 text-v-danger" />
      </div>

      {/* ── TABS ──────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto rounded-full bg-v-fill p-1" style={{ scrollbarWidth: 'none' }}>
        {pagosTabs.map(tb => {
          const on = activeTab === tb.id
          return (
            <button key={tb.id} onClick={() => setTab(tb.id as any)}
              className={`relative flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-colors sm:flex-1 sm:text-sm ${on ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
              {on && <motion.span layoutId="pagos-tab" className="absolute inset-0 rounded-full bg-v-elevated shadow-v" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <tb.Icon size={15} className="relative" /><span className="relative">{tb.label}</span>
              {tb.id === 'deudas' && deudas.length > 0 && <span className="relative grid min-w-5 place-items-center rounded-full bg-v-warning px-1.5 text-[10px] font-bold tabular-nums text-white">{deudas.length}</span>}
            </button>
          )
        })}
      </div>

      {/* ── DASHBOARD ──────────────────────────────────────────────────────────── */}
      {activeTab === 'dashboard' && !loading && (() => {
        const sinIngresos = stats.porMes.every((m: any) => !m.total)
        const totMetodo = stats.porMetodo.reduce((a: number, x: any) => a + x.value, 0)
        const vacio = (Icon: any, titulo: string, texto: string) => (
          <div className="flex h-[210px] flex-col items-center justify-center px-6 text-center">
            <span className="mb-3 grid size-12 place-items-center rounded-full bg-v-fill text-v-subtle"><Icon size={20} /></span>
            <p className="text-sm font-semibold text-v-text">{titulo}</p>
            <p className="mt-1 max-w-xs text-xs text-v-subtle">{texto}</p>
            <button onClick={() => { setTab('registros'); setShowNew(true) }}
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-v-accent-soft px-4 text-xs font-semibold text-v-accent transition-colors hover:bg-v-accent hover:text-white">
              <Plus size={14} /> {locale === 'en' ? 'Record a payment' : 'Registrar un pago'}
            </button>
          </div>
        )
        return (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v">
              <div className="flex items-center gap-3 border-b border-v-border px-5 py-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-[30%] bg-v-success/15 text-v-success"><TrendingUp size={17} /></span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold tracking-tight text-v-text">{t('admin.ingresosPorMes')}</h3>
                  <p className="text-xs text-v-subtle">{t('admin.ultimos6Meses')}</p>
                </div>
              </div>
              <div className="p-4 sm:p-5">
                {sinIngresos ? vacio(BarChart3, locale === 'en' ? 'No income yet' : 'Aún no hay ingresos', locale === 'en' ? 'Paid charges will appear here month by month.' : 'Los cobros pagados aparecerán aquí mes a mes.') : (
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={stats.porMes} barSize={28}>
                      <defs>
                        <linearGradient id="pagosBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#01abfc" />
                          <stop offset="100%" stopColor="#0069db" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--v-border)" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--v-text-tertiary)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--v-text-tertiary)' }} axisLine={false} tickLine={false} width={52} tickFormatter={v => `${symbol}${v}`} allowDecimals={false} />
                      <Tooltip formatter={(v: any) => [fmt(Number(v)), t('pagos.ingresos')]}
                        contentStyle={{ background: 'var(--v-bg-elevated)', border: '1px solid var(--v-border)', borderRadius: 12, fontSize: 12, color: 'var(--v-text)', boxShadow: 'var(--v-shadow-lg)' }}
                        labelStyle={{ color: 'var(--v-text)', fontWeight: 700 }} itemStyle={{ color: 'var(--v-text-secondary)' }}
                        cursor={{ fill: 'var(--v-fill)' }} />
                      <Bar dataKey="total" fill="url(#pagosBar)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v">
              <div className="flex items-center gap-3 border-b border-v-border px-5 py-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><CreditCard size={17} /></span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold tracking-tight text-v-text">{t('admin.metodosPago')}</h3>
                  <p className="text-xs text-v-subtle">{t('admin.distribucionCobros')}</p>
                </div>
              </div>
              <div className="p-4 sm:p-5">
                {stats.porMetodo.length === 0 ? vacio(CreditCard, t('admin.sinDatosPeriodo'), locale === 'en' ? 'Cash, Yape, Plin, transfer or card: you will see how your families pay.' : 'Efectivo, Yape, Plin, transferencia o tarjeta: verás cómo pagan tus familias.') : (
                  <div className="flex flex-col items-center gap-5 sm:flex-row">
                    <div className="relative size-[180px] shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={stats.porMetodo} cx="50%" cy="50%" innerRadius={58} outerRadius={84} dataKey="value" paddingAngle={3} stroke="none">
                            {stats.porMetodo.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => fmt(Number(v))}
                            contentStyle={{ background: 'var(--v-bg-elevated)', border: '1px solid var(--v-border)', borderRadius: 10, fontSize: 11, color: 'var(--v-text)' }}
                            itemStyle={{ color: 'var(--v-text-secondary)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-[11px] text-v-subtle">Total</p>
                        <p className="text-base font-bold tabular-nums text-v-text">{fmt(totMetodo)}</p>
                      </div>
                    </div>
                    <div className="w-full min-w-0 flex-1 space-y-3">
                      {stats.porMetodo.map((m: any) => {
                        const pct = totMetodo > 0 ? Math.round(m.value / totMetodo * 100) : 0
                        return (
                          <div key={m.name}>
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-2 text-sm text-v-muted"><span className="size-2.5 shrink-0 rounded-full" style={{ background: m.color }} /><span className="truncate">{m.name}</span></span>
                              <span className="shrink-0 text-sm font-semibold tabular-nums text-v-text">{fmt(m.value)} <span className="text-xs font-normal text-v-subtle">· {pct}%</span></span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-v-fill">
                              <motion.div className="h-full rounded-full" style={{ background: m.color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )
      })()}

      {/* ── REGISTROS ──────────────────────────────────────────────────────────── */}
      {activeTab === 'registros' && (
        <div className="space-y-4">
          {/* Barra de herramientas */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-[1_1_240px]">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-v-subtle" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('admin.buscarPacienteConcepto')}
                className="h-10 w-full rounded-full border border-v-border bg-v-elevated pl-10 pr-4 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none transition-colors placeholder:text-v-subtle focus:border-v-accent" />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="h-10 rounded-full border border-v-border bg-v-elevated px-4 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none focus:border-v-accent">
              <option value="all">{t('docs.todosEstados')}</option>
              {Object.keys(STATUS_CFG).map(k => <option key={k} value={k}>{t('pagos.status.' + k)}</option>)}
            </select>
            <div className="flex flex-[1_1_100%] gap-2 sm:flex-none">
              <button onClick={exportExcel}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-v-border bg-v-elevated px-3.5 text-sm font-semibold text-v-muted transition-colors hover:text-v-accent">
                <Download size={15} /> Excel
              </button>
              <button onClick={() => { setShowPkg(false); setShowNew(v => !v) }}
                className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors sm:flex-none ${showNew ? 'bg-v-accent text-white' : 'bg-v-accent-soft text-v-accent hover:bg-v-accent hover:text-white'}`}>
                <Plus size={15} /> {t('pagos.pagoUnico')}
              </button>
              <button onClick={() => { setShowNew(false); setShowPkg(v => !v) }}
                className="v-brand inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold sm:flex-none">
                <Package size={15} /> {t('pagos.paquete')}
              </button>
            </div>
          </div>

          {/* Pago único */}
          {showNew && (
            <FormShell Icon={DollarSign} title={t('admin.registrarPagoUnico')} sub={locale === 'en' ? 'One charge for one session or service' : 'Un cobro por una sesión o servicio'} onClose={() => setShowNew(false)}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label={t('pagos.paciente') + ' *'}>
                  {pacienteInput(form.modo, m => setForm(f => ({ ...f, modo: m })), form.child_id, id => setForm(f => ({ ...f, child_id: id })), form.external_name, v => setForm(f => ({ ...f, external_name: v })), t('admin.phNombreNinoEval'))}
                </Field>
                <Field label={t('pagos.concepto') + ' *'}>
                  {conceptInput(form.concept, v => setForm(f => ({ ...f, concept: v })), price => setForm(f => ({ ...f, amount: price })))}
                </Field>
                <Field label={`${locale === 'en' ? 'Amount' : 'Monto'} (${symbol}) *`}>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-v-subtle">{symbol}</span>
                    <input type="number" inputMode="decimal" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className={`${inputCls} pl-10 font-semibold tabular-nums`} />
                  </div>
                </Field>
                <Field label={t('pagos.fechaPago')}>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
                </Field>
                <div className="md:col-span-2"><Field label={t('pagos.metodoPago')}><ChipGroup options={metodoOpts} value={form.method} onChange={v => setForm(f => ({ ...f, method: v }))} /></Field></div>
                <div className="md:col-span-2"><Field label={t('pagos.estado')}><ChipGroup options={estadoOpts} value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} /></Field></div>
                <AnimatePresence initial={false}>
                  {form.status === 'partial' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden md:col-span-2">
                      <div className="grid gap-3 rounded-v-sm border border-v-accent/25 bg-v-accent-soft/60 p-3.5 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-end">
                        <Field label={locale === 'en' ? `Down payment (${symbol}) *` : `Adelanto (${symbol}) *`}>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-v-subtle">{symbol}</span>
                            <input type="number" inputMode="decimal" value={form.adelanto} onChange={e => setForm(f => ({ ...f, adelanto: e.target.value }))} placeholder="0.00" className={`${inputCls} bg-v-elevated pl-10 font-semibold tabular-nums`} />
                          </div>
                        </Field>
                        <p className="pb-2 text-sm text-v-muted">
                          {Number(form.amount) > 0 && Number(form.adelanto) > 0 && Number(form.adelanto) < Number(form.amount)
                            ? <>{locale === 'en' ? 'Remaining debt' : 'Queda debiendo'}: <b className="tabular-nums text-v-warning">{fmt(Number(form.amount) - Number(form.adelanto))}</b> · {locale === 'en' ? 'it will appear in Debts' : 'aparecerá en Deudas'}</>
                            : (locale === 'en' ? 'How much was paid today? The rest is recorded as debt.' : '¿Cuánto pagó hoy? El resto queda registrado como deuda.')}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="md:col-span-2">
                  <Field label={t('pagos.notasOpcional')}>
                    <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('admin.phObsAdicionales')} className={inputCls} />
                  </Field>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-v-border pt-4 sm:flex-row sm:justify-end">
                <button onClick={() => setShowNew(false)} className="h-11 rounded-full px-5 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill">{t('common.cancelar')}</button>
                <button onClick={handleSave} disabled={saving} className="v-brand inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-50">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {t('pagos.guardarPago')}
                </button>
              </div>
            </FormShell>
          )}

          {/* Paquete */}
          {showPkg && (
            <FormShell Icon={Package} title={t('admin.crearPaquete')} sub={t('admin.selecFechasCal')} onClose={() => { setShowPkg(false); setPkgDates([]) }}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label={t('pagos.paciente') + ' *'}>
                  {pacienteInput(pkg.modo, m => setPkg(pp => ({ ...pp, modo: m })), pkg.child_id, id => setPkg(pp => ({ ...pp, child_id: id })), pkg.external_name, v => setPkg(pp => ({ ...pp, external_name: v })), t('admin.phNombreNino'))}
                </Field>
                <Field label={t('pagos.concepto') + ' *'}>
                  {conceptInput(pkg.concept, v => setPkg(pp => ({ ...pp, concept: v })), price => setPkg(pp => ({ ...pp, amount: price })))}
                </Field>
                <Field label={t('pagos.montoPorSesion') + ' *'}>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-v-subtle">{symbol}</span>
                    <input type="number" inputMode="decimal" value={pkg.amount} onChange={e => setPkg(pp => ({ ...pp, amount: e.target.value }))} placeholder="0.00" className={`${inputCls} pl-10 font-semibold tabular-nums`} />
                    {pkg.concept && rates.find(r => r.name.toLowerCase() === pkg.concept.toLowerCase()) && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-v-success/15 px-2 py-0.5 text-[11px] font-semibold text-v-success">{t('admin.tarifa')}</span>
                    )}
                  </div>
                </Field>
                <div className="hidden md:block" />
                <div className="md:col-span-2"><Field label={t('pagos.metodoPago')}><ChipGroup options={metodoOpts} value={pkg.method} onChange={v => setPkg(pp => ({ ...pp, method: v }))} /></Field></div>
                <div className="md:col-span-2"><Field label={t('pagos.estadoPagos')}><ChipGroup options={estadoOptsPkg} value={pkg.status} onChange={v => setPkg(pp => ({ ...pp, status: v }))} /></Field></div>
              </div>

              {/* Calendario para elegir las fechas de las sesiones */}
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="rounded-v-sm border border-v-border p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-v-muted">{t('pagos.selecFechasSesion')}</p>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => { const [y, m] = pkg.calMonth.split('-').map(Number); const d = new Date(y, m - 2, 1); setPkg(pp => ({ ...pp, calMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })) }}
                        className="grid size-8 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text"><ChevronLeft size={16} /></button>
                      <span className="min-w-[110px] text-center text-sm font-semibold text-v-text">{(() => { const [y, m] = pkg.calMonth.split('-').map(Number); return `${mesLargo(m - 1, locale)} ${y}` })()}</span>
                      <button type="button" onClick={() => { const [y, m] = pkg.calMonth.split('-').map(Number); const d = new Date(y, m, 1); setPkg(pp => ({ ...pp, calMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })) }}
                        className="grid size-8 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text"><ChevronRight size={16} /></button>
                    </div>
                  </div>
                  {(() => {
                    const [y, m] = pkg.calMonth.split('-').map(Number)
                    const firstDay = new Date(y, m - 1, 1).getDay()
                    const daysInMonth = new Date(y, m, 0).getDate()
                    const today = new Date().toISOString().split('T')[0]
                    const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
                    while (cells.length % 7 !== 0) cells.push(null)
                    return (
                      <div>
                        <div className="mb-1 grid grid-cols-7">
                          {[0, 1, 2, 3, 4, 5, 6].map(dow => <div key={dow} className="py-1 text-center text-[11px] font-semibold text-v-subtle">{diaCorto(dow, locale)}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {cells.map((day, di) => {
                            if (!day) return <div key={di} />
                            const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                            const on = pkgDates.includes(dateStr)
                            const isToday = dateStr === today
                            return (
                              <button key={di} type="button"
                                onClick={() => setPkgDates(prev => prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr].sort())}
                                className={`grid h-9 place-items-center rounded-full text-sm font-semibold tabular-nums transition-all active:scale-95 ${on ? 'bg-v-accent text-white shadow-v' : isToday ? 'text-v-accent ring-1 ring-v-accent' : 'text-v-text hover:bg-v-fill'}`}>
                                {day}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Resumen de las sesiones elegidas */}
                <div className="flex min-h-[200px] flex-col rounded-v-sm border border-v-border">
                  <div className="flex items-center justify-between gap-2 border-b border-v-border px-4 py-3">
                    <p className="text-xs font-semibold text-v-muted">
                      {pkgDates.length > 0 ? t('pagos.fechasSeleccionadas', { n: String(pkgDates.length) }) : t('pagos.vistaPrevia')}
                    </p>
                    {pkgDates.length > 0 && <button onClick={() => setPkgDates([])} className="text-xs font-semibold text-v-danger hover:underline">{t('pagos.limpiar')}</button>}
                  </div>
                  {pkgDates.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 text-center">
                      <Calendar size={20} className="mb-2 text-v-subtle" />
                      <p className="text-xs text-v-subtle">{locale === 'en' ? 'Tap the days of the sessions on the calendar.' : 'Tocá en el calendario los días de las sesiones.'}</p>
                    </div>
                  ) : (
                    <>
                      <div className="max-h-56 flex-1 divide-y divide-v-border overflow-y-auto">
                        {pkgDates.map(date => {
                          const d = new Date(date + 'T12:00:00')
                          return (
                            <div key={date} className="flex items-center gap-3 px-4 py-2">
                              <span className="w-10 shrink-0 rounded-full bg-v-accent-soft py-0.5 text-center text-[11px] font-semibold text-v-accent">{diaCorto(d.getDay(), locale)}</span>
                              <span className="min-w-0 flex-1 truncate text-sm text-v-text">{fechaCorta(d)}</span>
                              <span className="shrink-0 text-sm font-semibold tabular-nums text-v-text">{fmt(Number(pkg.amount || 0))}</span>
                              <button onClick={() => setPkgDates(prev => prev.filter(x => x !== date))} className="grid size-7 shrink-0 place-items-center rounded-full text-v-subtle hover:bg-v-danger/10 hover:text-v-danger"><X size={13} /></button>
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex items-center justify-between border-t border-v-border bg-v-bg px-4 py-3">
                        <span className="text-xs text-v-muted">Total</span>
                        <span className="text-lg font-bold tabular-nums text-v-success">{fmt(Number(pkg.amount || 0) * pkgDates.length)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-v-border pt-4 sm:flex-row sm:justify-end">
                <button onClick={() => { setShowPkg(false); setPkgDates([]) }} className="h-11 rounded-full px-5 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill">{t('common.cancelar')}</button>
                <button onClick={handleSavePkg}
                  disabled={savingPkg || (pkg.modo === 'externo' ? !pkg.external_name.trim() : !pkg.child_id) || !pkg.amount || !pkg.concept || pkgDates.length === 0}
                  className="v-brand inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-50">
                  {savingPkg ? <Loader2 size={15} className="animate-spin" /> : <Repeat size={15} />}
                  {savingPkg ? t('pagos.creando') : pkgDates.length > 0 ? t('pagos.crearCobros', { n: String(pkgDates.length) }) : t('pagos.selecFechas')}
                </button>
              </div>
            </FormShell>
          )}

          {/* Lista de pagos */}
          {loading ? (
            <div className="flex justify-center py-14"><Loader2 size={22} className="animate-spin text-v-accent" /></div>
          ) : filtered.length === 0 ? (
            vacioCard(Wallet, t('admin.sinPagosRegistrados'), t('admin.usaBotonesArriba'))
          ) : (
            <div className="rounded-v border border-v-border bg-v-elevated shadow-v">
              <div className="divide-y divide-v-border">
                {filtered.map(p => {
                  const tone = STATUS_TONE[p.status] || STATUS_TONE.refunded
                  const MI = METHOD_ICON[p.payment_method] || MoreHorizontal
                  const nombre = p.children?.name || p.paciente_externo || '—'
                  const menuOpen = statusMenu === p.id
                  const conf = confirmar?.tipo === 'pago' && confirmar.id === p.id
                  return (
                    <div key={p.id}>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-v-bg sm:px-5">
                        <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-sm font-semibold text-v-accent">{nombre.charAt(0).toUpperCase()}</span>
                        <div className="min-w-0 flex-[1_1_180px]">
                          <p className="truncate text-sm font-semibold text-v-text">{nombre}{!p.child_id && p.paciente_externo && <span className="ml-1.5 rounded-full bg-v-fill px-1.5 py-0.5 text-[10px] font-medium text-v-subtle">{t('pagos.sinInscribir')}</span>}</p>
                          <p className="truncate text-xs text-v-subtle">{p.concept} · {fechaCorta(new Date(p.paid_at || p.created_at))}</p>
                        </div>
                        <div className="ml-auto flex shrink-0 items-center gap-1.5">
                          <span className="mr-1 text-right">
                            <span className="block text-sm font-bold tabular-nums text-v-text">{fmt(Number(p.amount))}</span>
                            {p.status === 'partial' && <span className="block text-[11px] font-medium tabular-nums text-v-warning">{locale === 'en' ? 'owes' : 'debe'} {fmt(saldoDe(p))}</span>}
                            <span className="flex items-center justify-end gap-1 text-[11px] text-v-subtle"><MI size={11} /> {t('pagos.method.' + p.payment_method)}</span>
                          </span>
                          {/* Estado: tocar para cambiar */}
                          <div className="relative">
                            <button onClick={() => setStatusMenu(menuOpen ? null : p.id)}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.pill}`}>
                              {t('pagos.status.' + p.status)} <ChevronDown size={12} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            <AnimatePresence>
                              {menuOpen && (
                                <>
                                  <div className="fixed inset-0 z-30" onClick={() => setStatusMenu(null)} />
                                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                                    className="absolute right-0 top-full z-40 mt-1.5 w-40 overflow-hidden rounded-v-sm border border-v-border bg-v-elevated p-1 shadow-v-lg">
                                    {Object.keys(STATUS_CFG).map(k => (
                                      <button key={k} onClick={() => cambiarEstado(p, k)}
                                        className={`flex w-full items-center gap-2 rounded-v-sm px-2.5 py-2 text-left text-xs font-semibold transition-colors ${p.status === k ? 'bg-v-fill text-v-text' : 'text-v-muted hover:bg-v-fill hover:text-v-text'}`}>
                                        <span className={`size-2 rounded-full ${STATUS_TONE[k]?.dot}`} /> {t('pagos.status.' + k)}
                                        {p.status === k && <Check size={13} className="ml-auto" />}
                                      </button>
                                    ))}
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                          <button onClick={() => window.open(`/api/pagos/recibo-pdf?id=${p.id}&lang=${locale}`, '_blank')} title={t('admin.verRecibo')}
                            className="grid size-8 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-accent-soft hover:text-v-accent"><FileText size={15} /></button>
                          <button onClick={() => setConfirmar(conf ? null : { tipo: 'pago', id: p.id })} disabled={deletingId === p.id} title={t('admin.eliminarPago')}
                            className={`grid size-8 place-items-center rounded-full transition-colors disabled:opacity-50 ${conf ? 'bg-v-danger/10 text-v-danger' : 'text-v-muted hover:bg-v-danger/10 hover:text-v-danger'}`}>
                            {deletingId === p.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                          </button>
                        </div>
                      </div>
                      <AnimatePresence>
                        {conf && <ConfirmBar cancelLabel={t('common.cancelar')} deleteLabel={locale === 'en' ? 'Delete' : 'Eliminar'} texto={t('pagos.confirmEliminarPago', { nombre, concepto: p.concept, monto: fmt(Number(p.amount)) })} onNo={() => setConfirmar(null)} onYes={() => handleDeletePago(p)} />}
                        {abonoFor?.id === p.id && abonoBar(p, locale === 'en' ? 'How much was paid as a down payment?' : '¿Cuánto pagó de adelanto?')}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-between rounded-b-v border-t border-v-border bg-v-bg px-5 py-3">
                <p className="text-xs text-v-subtle">{t('pagos.registros', { n: String(filtered.length) })}</p>
                <p className="text-sm text-v-muted">{locale === 'en' ? 'Paid' : 'Cobrado'}: <span className="font-bold tabular-nums text-v-success">{fmt(filtered.reduce((a, p) => a + cobradoDe(p), 0))}</span></p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DEUDAS ─────────────────────────────────────────────────────────────── */}
      {activeTab === 'deudas' && (() => {
        const grupos = Object.values(deudas.reduce((acc: Record<string, { key: string; nombre: string; externo: boolean; items: any[]; saldo: number }>, p: any) => {
          const key = p.child_id || `ext:${p.paciente_externo}`
          if (!acc[key]) acc[key] = { key, nombre: p.children?.name || p.paciente_externo || '—', externo: !p.child_id, items: [], saldo: 0 }
          acc[key].items.push(p); acc[key].saldo += saldoDe(p)
          return acc
        }, {})).sort((a, b) => b.saldo - a.saldo)
        const totalDeuda = grupos.reduce((s, g) => s + g.saldo, 0)
        const adelantos = deudas.reduce((s, p) => s + cobradoDe(p), 0)
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
              <div className="rounded-v border border-v-warning/30 bg-v-warning/10 p-4">
                <p className="text-xs font-medium text-v-warning">{locale === 'en' ? 'Total owed' : 'Total adeudado'}</p>
                <p className="v-headline mt-1 text-2xl tabular-nums text-v-text">{fmt(totalDeuda)}</p>
              </div>
              <div className="rounded-v border border-v-border bg-v-elevated p-4 shadow-v">
                <p className="text-xs font-medium text-v-muted">{locale === 'en' ? 'Families with debt' : 'Familias con deuda'}</p>
                <p className="v-headline mt-1 text-2xl tabular-nums text-v-text">{grupos.length}</p>
              </div>
              <div className="rounded-v border border-v-border bg-v-elevated p-4 shadow-v">
                <p className="text-xs font-medium text-v-muted">{locale === 'en' ? 'Down payments received' : 'Adelantos recibidos'}</p>
                <p className="v-headline mt-1 text-2xl tabular-nums text-v-success">{fmt(adelantos)}</p>
              </div>
            </div>

            {grupos.length === 0 ? (
              <div className="flex flex-col items-center rounded-v border border-dashed border-v-border bg-v-elevated px-6 py-14 text-center">
                <span className="mb-3 grid size-12 place-items-center rounded-full bg-v-success/15 text-v-success"><PartyPopper size={20} /></span>
                <p className="text-sm font-semibold text-v-text">{locale === 'en' ? 'No debts' : 'Sin deudas'}</p>
                <p className="mt-1 max-w-sm text-xs text-v-subtle">{locale === 'en' ? 'When a family pays a down payment or leaves a charge pending, it will show up here.' : 'Cuando una familia deje un adelanto o un cobro pendiente, aparecerá aquí.'}</p>
              </div>
            ) : grupos.map((g, gi) => (
              <motion.div key={g.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(gi, 8) * 0.03 }}
                className="overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v">
                <div className="flex items-center gap-3 border-b border-v-border px-4 py-3.5 sm:px-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-warning/15 text-sm font-semibold text-v-warning">{g.nombre.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-v-text">{g.nombre}{g.externo && <span className="ml-1.5 rounded-full bg-v-fill px-1.5 py-0.5 text-[10px] font-medium text-v-subtle">{t('pagos.sinInscribir')}</span>}</p>
                    <p className="text-xs text-v-subtle">{g.items.length} {g.items.length === 1 ? (locale === 'en' ? 'open charge' : 'cobro abierto') : (locale === 'en' ? 'open charges' : 'cobros abiertos')}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-v-subtle">{locale === 'en' ? 'Owes' : 'Debe'}</p>
                    <p className="text-base font-bold tabular-nums text-v-warning sm:text-lg">{fmt(g.saldo)}</p>
                  </div>
                </div>
                <div className="divide-y divide-v-border">
                  {g.items.map((p: any) => {
                    const pagado = cobradoDe(p)
                    const pct = Number(p.amount) > 0 ? Math.round(pagado / Number(p.amount) * 100) : 0
                    const abonos: Abono[] = Array.isArray(p.abonos) ? p.abonos : []
                    return (
                      <div key={p.id}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
                          <div className="min-w-0 flex-[1_1_220px]">
                            <p className="truncate text-sm font-medium text-v-text">{p.concept}</p>
                            <p className="text-xs text-v-subtle">{fechaCorta(new Date(p.created_at))}{abonos.length > 0 && ` · ${abonos.length} ${abonos.length === 1 ? (locale === 'en' ? 'payment' : 'abono') : (locale === 'en' ? 'payments' : 'abonos')}`}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-v-fill">
                                <motion.div className="h-full rounded-full bg-v-success" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7 }} />
                              </div>
                              <span className="shrink-0 text-[11px] tabular-nums text-v-subtle">{fmt(pagado)} / {fmt(Number(p.amount))}</span>
                            </div>
                          </div>
                          <div className="ml-auto flex shrink-0 items-center gap-1.5">
                            <span className="mr-1 text-right">
                              <span className="block text-[11px] text-v-subtle">{locale === 'en' ? 'Balance' : 'Saldo'}</span>
                              <span className="block text-sm font-bold tabular-nums text-v-warning">{fmt(saldoDe(p))}</span>
                            </span>
                            <button onClick={() => setAbonoFor(abonoFor?.id === p.id ? null : { id: p.id, monto: '', metodo: p.payment_method || 'efectivo' })}
                              className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors ${abonoFor?.id === p.id ? 'bg-v-accent text-white' : 'bg-v-accent-soft text-v-accent hover:bg-v-accent hover:text-white'}`}>
                              <HandCoins size={14} /> {locale === 'en' ? 'Pay' : 'Abonar'}
                            </button>
                            <button onClick={() => window.open(`/api/pagos/recibo-pdf?id=${p.id}&lang=${locale}`, '_blank')} title={t('admin.verRecibo')}
                              className="grid size-9 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-accent-soft hover:text-v-accent"><FileText size={15} /></button>
                          </div>
                        </div>
                        <AnimatePresence>
                          {abonoFor?.id === p.id && abonoBar(p, locale === 'en' ? `New payment · ${p.concept}` : `Nuevo abono · ${p.concept}`)}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        )
      })()}

      {/* ── AGRUPADO POR PACIENTE ──────────────────────────────────────────────── */}
      {activeTab === 'agrupado' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-14"><Loader2 size={22} className="animate-spin text-v-accent" /></div>
          ) : grouped.length === 0 ? (
            vacioCard(Calendar, t('admin.sinRegistros'))
          ) : (grouped as any[]).map((g: any, gi: number) => {
            const isOpen = expanded.has(g.key)
            const conf = confirmar?.tipo === 'paquete' && confirmar.id === g.key
            return (
              <motion.div key={g.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(gi, 8) * 0.03 }}
                className="overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v">
                <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                  <button onClick={() => setExpanded(st => { const n = new Set(st); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n })}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-sm font-semibold text-v-accent">{g.child.charAt(0).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-v-text" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.child}</span>
                      <span className="block text-sm font-bold tabular-nums text-v-text sm:hidden">{fmt(g.total)}</span>
                      <span className="flex flex-wrap items-center gap-1.5 text-xs text-v-subtle">
                        {g.isPackage && <span className="inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-2 py-0.5 text-[11px] font-semibold text-v-accent"><Package size={11} /> {t('admin.paquete')}</span>}
                        {g.monthLabel} · {t('pagos.sesionesCount', { n: String(g.pays.length) })}
                      </span>
                    </span>
                  </button>
                  <span className="hidden shrink-0 text-lg font-bold tabular-nums text-v-text sm:block">{fmt(g.total)}</span>
                  <button onClick={() => window.open(`/api/pagos/recibo-paquete?ids=${g.pays.map((x: any) => x.id).join(',')}&lang=${locale}`, '_blank')} title={t('admin.reciboPaquete')}
                    className="grid size-8 shrink-0 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-accent-soft hover:text-v-accent"><FileText size={15} /></button>
                  <button onClick={() => setConfirmar(conf ? null : { tipo: 'paquete', id: g.key })} title={t('admin.eliminarPaquete')}
                    className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors ${conf ? 'bg-v-danger/10 text-v-danger' : 'text-v-muted hover:bg-v-danger/10 hover:text-v-danger'}`}><Trash2 size={15} /></button>
                  <button onClick={() => setExpanded(st => { const n = new Set(st); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n })}
                    className={`grid size-8 shrink-0 place-items-center rounded-full transition-all ${isOpen ? 'rotate-180 bg-v-accent-soft text-v-accent' : 'text-v-subtle hover:bg-v-fill'}`}><ChevronDown size={16} /></button>
                </div>
                <AnimatePresence>
                  {conf && <ConfirmBar cancelLabel={t('common.cancelar')} deleteLabel={locale === 'en' ? 'Delete' : 'Eliminar'} texto={t('pagos.confirmEliminarPaquete', { child: g.child, cantidad: String(g.pays.length), total: fmt(g.total) })} onNo={() => setConfirmar(null)} onYes={() => handleDeletePaquete(g)} />}
                </AnimatePresence>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="divide-y divide-v-border border-t border-v-border bg-v-bg">
                        {g.pays.map((p: any) => {
                          const tone = STATUS_TONE[p.status] || STATUS_TONE.refunded
                          return (
                            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                              <span className="w-24 shrink-0 text-xs tabular-nums text-v-subtle">{fechaCorta(new Date(p.paid_at || p.created_at))}</span>
                              <span className="min-w-0 flex-1 truncate text-sm text-v-muted">{p.concept}</span>
                              <span className="shrink-0 text-sm font-semibold tabular-nums text-v-text">{fmt(Number(p.amount))}</span>
                              <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline ${tone.pill}`}>{t('pagos.status.' + p.status)}</span>
                              <button onClick={() => handleDeletePago(p)} disabled={deletingId === p.id} title={t('admin.eliminarEstePago')}
                                className="grid size-7 shrink-0 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-danger/10 hover:text-v-danger disabled:opacity-50">
                                {deletingId === p.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                              </button>
                            </div>
                          )
                        })}
                        <div className="flex items-center justify-between px-4 py-3 sm:px-5">
                          <span className="text-xs font-semibold text-v-muted">Total {g.monthLabel}</span>
                          <span className="text-base font-bold tabular-nums text-v-success">{fmt(g.total)}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ── TARIFAS EDITABLES ──────────────────────────────────────────────────── */}
      {activeTab === 'tarifas' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-[1_1_220px] text-sm text-v-muted">{t('pagos.defineServicios')}</p>
            <button onClick={() => openRateForm()} className="v-brand inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold">
              <Plus size={15} /> {t('pagos.nuevaTarifa')}
            </button>
          </div>

          {showRateForm && (
            <FormShell Icon={Package} title={editingRate ? t('pagos.editarTarifa') : t('pagos.nuevaTarifa')} sub={locale === 'en' ? 'Its price is filled in automatically when you choose it in a payment' : 'Su precio se completa solo al elegirla en un cobro'} onClose={() => setShowRateForm(false)}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label={t('pagos.nombreServicio') + ' *'}>
                    <input value={rateForm.name} onChange={e => setRateForm(f => ({ ...f, name: e.target.value }))} placeholder={t('admin.phServicioTarifa')} className={inputCls} />
                  </Field>
                </div>
                <Field label={t('pagos.precioSoles') + ' *'}>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-v-subtle">{symbol}</span>
                    <input type="number" inputMode="decimal" value={rateForm.amount} onChange={e => setRateForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className={`${inputCls} pl-10 font-semibold tabular-nums`} />
                  </div>
                </Field>
                <Field label={t('pagos.duracionMin')}>
                  <input type="number" value={rateForm.duration_min} onChange={e => setRateForm(f => ({ ...f, duration_min: e.target.value }))} placeholder="60" className={inputCls} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t('pagos.descripcion')}>
                    <input value={rateForm.description} onChange={e => setRateForm(f => ({ ...f, description: e.target.value }))} placeholder={t('admin.phDescServicio')} className={inputCls} />
                  </Field>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-v-border pt-4 sm:flex-row sm:justify-end">
                <button onClick={() => setShowRateForm(false)} className="h-11 rounded-full px-5 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill">{t('common.cancelar')}</button>
                <button onClick={handleSaveRate} disabled={savingRate} className="v-brand inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-50">
                  {savingRate ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  {editingRate ? t('pagos.actualizar') : t('pagos.crearTarifa')}
                </button>
              </div>
            </FormShell>
          )}

          {rates.length === 0 ? (
            vacioCard(Settings2, t('admin.sinTarifas'), t('admin.agregaTarifas'))
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rates.map((r, i) => {
                const conf = confirmar?.tipo === 'tarifa' && confirmar.id === r.id
                return (
                  <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}
                    className="group overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v">
                    <div className="p-4 sm:p-5">
                      <div className="mb-3 flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Package size={18} /></span>
                        <p className="min-w-0 flex-1 pt-0.5 text-sm font-semibold leading-snug text-v-text [overflow-wrap:anywhere]">{r.name}</p>
                        <div className="flex shrink-0 gap-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                          <button onClick={() => openRateForm(r)} className="grid size-8 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text"><Pencil size={14} /></button>
                          <button onClick={() => setConfirmar(conf ? null : { tipo: 'tarifa', id: r.id })} className="grid size-8 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-danger/10 hover:text-v-danger"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <p className="v-headline text-2xl tabular-nums text-v-text">{fmt(Number(r.amount))}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-v-fill px-2.5 py-0.5 text-[11px] font-semibold text-v-muted"><Clock size={11} /> {r.duration_min} min</span>
                        {r.description && <span className="min-w-0 truncate text-xs text-v-subtle">{r.description}</span>}
                      </div>
                    </div>
                    <AnimatePresence>
                      {conf && <ConfirmBar cancelLabel={t('common.cancelar')} deleteLabel={locale === 'en' ? 'Delete' : 'Eliminar'} texto={t('pagos.confirmEliminarTarifa')} onNo={() => setConfirmar(null)} onYes={() => deleteRate(r.id)} />}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
