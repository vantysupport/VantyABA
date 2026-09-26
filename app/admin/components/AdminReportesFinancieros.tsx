'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useI18n } from '@/lib/i18n-context'
import {
  DollarSign, TrendingUp, Users, Calendar, Download, RefreshCw, Loader2, CheckCircle2,
  ArrowUpRight, ArrowDownRight, Package, Activity, CreditCard, BarChart3, Trophy, ChevronDown,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, ReferenceArea,
} from 'recharts'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { useCurrency } from '@/components/CurrencyContext'
import { cobradoDe, saldoDe } from '@/lib/pagos'

const MESES      = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESES_L    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_EN   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MESES_L_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const METHODS    = ['efectivo','yape','plin','transferencia','tarjeta','otro']
const METHOD_ES: Record<string, string> = { efectivo: 'Efectivo', yape: 'Yape', plin: 'Plin', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro' }
const METHOD_EN: Record<string, string> = { efectivo: 'Cash', yape: 'Yape', plin: 'Plin', transferencia: 'Bank transfer', tarjeta: 'Card', otro: 'Other' }
// efectivo, yape, plin, transferencia, tarjeta, otro (Yape y Plin con sus colores de marca)
const METHOD_COLOR: Record<string, string> = { efectivo: '#10b981', yape: '#742284', plin: '#00b5c3', transferencia: '#0069db', tarjeta: '#f59e0b', otro: '#94a3b8' }
// Paleta de marca para series sin color propio (pacientes, servicios)
const PALETTE = ['#0069db', '#01abfc', '#10b981', '#f59e0b', '#742284', '#00b5c3', '#ef4444', '#94a3b8']

// Mes/año de un pago en hora de Perú (paid_at viene en UTC; los antiguos son medianoche UTC = solo fecha)
function mesAnioLima(iso: string): { m: number; y: number } {
  const d = new Date(iso)
  const soloFecha = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0
  if (soloFecha) return { m: d.getUTCMonth(), y: d.getUTCFullYear() }
  const lima = new Date(d.getTime() - 5 * 3600 * 1000)
  return { m: lima.getUTCMonth(), y: lima.getUTCFullYear() }
}
const fechaPago = (p: any) => p.paid_at || p.created_at

// ── KPI ───────────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, icon: Icon, tone, delta, deltaTitle, index = 0 }: {
  label: string; value: React.ReactNode; sub?: string; icon: any; tone: string; delta?: number | null; deltaTitle?: string; index?: number
}) {
  const up = (delta ?? 0) >= 0
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, type: 'spring', stiffness: 200, damping: 24 }}
      className="rounded-v border border-v-border bg-v-elevated p-4 shadow-v sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-v-muted">{label}</p>
        <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] ${tone}`}><Icon size={17} /></span>
      </div>
      <p className="v-headline truncate text-2xl tabular-nums text-v-text sm:text-[1.75rem]">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {delta !== undefined && delta !== null && (
          <span title={deltaTitle} className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${up ? 'bg-v-success/15 text-v-success' : 'bg-v-danger/10 text-v-danger'}`}>
            {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{Math.abs(delta).toFixed(0)}%
          </span>
        )}
        {sub && <p className="truncate text-[11px] text-v-subtle">{sub}</p>}
      </div>
    </motion.div>
  )
}

function Card({ Icon, tone, title, sub, right, children, className = '' }: { Icon: any; tone: string; title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v ${className}`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-v-border px-5 py-4">
        <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] ${tone}`}><Icon size={17} /></span>
        <div className="min-w-0 flex-[1_1_160px]">
          <h3 className="text-[15px] font-semibold tracking-tight text-v-text">{title}</h3>
          {sub && <p className="text-xs text-v-subtle">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </motion.div>
  )
}

function Vacio({ Icon, texto }: { Icon: any; texto: string }) {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center px-6 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-v-fill text-v-subtle"><Icon size={20} /></span>
      <p className="text-sm text-v-subtle">{texto}</p>
    </div>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-v-sm border border-v-border bg-v-elevated px-3.5 py-2.5 shadow-v-lg">
      <p className="mb-1.5 text-xs font-semibold text-v-text">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-v-muted">{p.name}:</span>
          <span className="font-semibold tabular-nums text-v-text">{p.dataKey === 'sesiones' ? p.value : fmt(Number(p.value))}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminReportesFinancieros({ enabledTabs }: { enabledTabs?: Record<string, boolean> } = {}) {
  const { t, locale } = useI18n()
  const isEN = locale === 'en'
  const L = (en: string, es: string) => (isEN ? en : es)
  const MES  = isEN ? MESES_EN : MESES
  const MESL = isEN ? MESES_L_EN : MESES_L
  const dateLoc = isEN ? 'en-US' : 'es-PE'
  const toast = useToast()
  const { symbol } = useCurrency()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'pacientes' | 'servicios'>('overview')
  const reportesTabs = ([
    { id: 'overview',  label: L('Income', 'Ingresos'),    Icon: TrendingUp },
    { id: 'pacientes', label: L('Patients', 'Pacientes'), Icon: Users },
    { id: 'servicios', label: L('Services', 'Servicios'), Icon: Package },
  ] as const).filter(tb => !enabledTabs || enabledTabs[`reportes_${tb.id}`] !== false)
  type ReportesTab = 'overview' | 'pacientes' | 'servicios'
  const activeTab: ReportesTab = reportesTabs.find(tb => tb.id === tab) ? tab : (reportesTabs[0]?.id ?? 'overview')
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mesFilter, setMesFilter] = useState<number | null>(null) // null = todo el año
  const [mesMenu, setMesMenu] = useState(false)
  const [payments, setPayments] = useState<any[]>([])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      // Se piden desde diciembre del año anterior para poder comparar enero con el mes previo
      const { data: pays, error } = await supabase.from('payments').select('*, children(name, id)')
        .gte('created_at', `${anio - 1}-12-01`).lte('created_at', `${anio}-12-31T23:59:59`).order('created_at')
      if (error) throw error
      setPayments(pays || [])
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setLoading(false) }
  }, [anio]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargar() }, [cargar])

  const fmt = useCallback((n: number) => `${symbol} ${n.toLocaleString(dateLoc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, [symbol, dateLoc])

  const data = useMemo(() => {
    // Cobrado incluye los adelantos de pagos parciales; la deuda, sus saldos (lib/pagos)
    const sum = (arr: any[]) => arr.reduce((a, p) => a + cobradoDe(p), 0)
    const deb = (arr: any[]) => arr.reduce((a, p) => a + saldoDe(p), 0)
    const delAnio = payments.filter(p => mesAnioLima(fechaPago(p)).y === anio)
    const enMes = (p: any, m: number, y: number) => { const r = mesAnioLima(fechaPago(p)); return r.m === m && r.y === y }
    // Mes de referencia: el elegido en el filtro, o el actual si se ve el año en curso
    const mesRef = mesFilter ?? (anio === hoy.getFullYear() ? hoy.getMonth() : 11)
    const alcance = mesFilter === null ? delAnio : delAnio.filter(p => enMes(p, mesFilter, anio))
    const paid    = alcance.filter(p => cobradoDe(p) > 0)
    const pending = alcance.filter(p => saldoDe(p) > 0)

    const pagMes  = sum(payments.filter(p => enMes(p, mesRef, anio)))
    const prevM   = mesRef === 0 ? 11 : mesRef - 1
    const prevY   = mesRef === 0 ? anio - 1 : anio
    const pagPrev = sum(payments.filter(p => enMes(p, prevM, prevY)))
    // El mes en curso todavía no termina: la comparación sería engañosa, así que no se muestra
    const mesEnCurso = anio === hoy.getFullYear() && mesRef === hoy.getMonth()
    const deltaMes = pagPrev > 0 && !mesEnCurso ? ((pagMes - pagPrev) / pagPrev) * 100 : null

    const porMes = Array.from({ length: 12 }, (_, i) => {
      const mp = delAnio.filter(p => cobradoDe(p) > 0 && enMes(p, i, anio))
      const pp = delAnio.filter(p => saldoDe(p) > 0 && enMes(p, i, anio))
      return { mes: MES[i], ingresos: sum(mp), pendiente: deb(pp), sesiones: mp.length }
    })

    const porMetodo = METHODS.map(m => ({
      name: (isEN ? METHOD_EN : METHOD_ES)[m], value: sum(paid.filter(p => p.payment_method === m)), color: METHOD_COLOR[m],
    })).filter(m => m.value > 0)

    const pMap: Record<string, { name: string; ingresos: number; sesiones: number; externo: boolean }> = {}
    paid.forEach(p => {
      const id = p.child_id || `ext:${p.paciente_externo || '—'}`
      if (!pMap[id]) pMap[id] = { name: p.children?.name || p.paciente_externo || '—', ingresos: 0, sesiones: 0, externo: !p.child_id }
      pMap[id].ingresos += cobradoDe(p); pMap[id].sesiones++
    })
    const porPaciente = Object.values(pMap).sort((a, b) => b.ingresos - a.ingresos)

    const sMap: Record<string, { value: number; count: number }> = {}
    paid.forEach(p => {
      const s = p.concept?.replace(/\s*\(\d+\/\d+\)$/, '').trim() || L('Other', 'Otro')
      if (!sMap[s]) sMap[s] = { value: 0, count: 0 }
      sMap[s].value += cobradoDe(p); sMap[s].count++
    })
    const porServicio = Object.entries(sMap).sort(([, a], [, b]) => b.value - a.value)
      .map(([name, v], i) => ({ name, ...v, color: PALETTE[i % PALETTE.length] }))

    const cobrables = alcance.filter(p => p.status !== 'cancelled' && p.status !== 'refunded')
    return {
      total: sum(paid), pagMes, mesRef, deltaMes, pendiente: deb(pending), cobros: paid.length,
      tasaCobro: cobrables.length > 0 ? Math.round((paid.length / cobrables.length) * 100) : 0,
      porMes, porMetodo, porPaciente, porServicio,
    }
  }, [payments, anio, mesFilter, isEN]) // eslint-disable-line react-hooks/exhaustive-deps

  const descargarExcel = async (mes: number) => {
    try {
      const res = await fetch(`/api/pagos/reporte-mensual?anio=${anio}&mes=${mes}&lang=${locale}`)
      if (!res.ok) { toast.error(t('auto.adminReportesFinancieros.errorGenerandoReporte')); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = mes === 0 ? `${L('financial_report', 'reporte_financiero')}_${anio}.xlsx` : `${L('report', 'reporte')}_${MESL[mes - 1].toLowerCase()}_${anio}.xlsx`
      a.click(); URL.revokeObjectURL(url)
      toast.success(t('auto.adminReportesFinancieros.reporteExportado'))
    } catch (e: any) { toast.error('Error: ' + e.message) }
  }

  const periodo = mesFilter === null ? String(anio) : `${MESL[mesFilter]} ${anio}`
  const totMetodo = data.porMetodo.reduce((a, x) => a + x.value, 0)
  const tip = <ChartTooltip fmt={fmt} />
  const sinIngresos = data.porMes.every(m => !m.ingresos && !m.pendiente)

  return (
    <div className="v-scope space-y-4 md:space-y-5">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="v-brand grid size-11 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><BarChart3 size={20} /></span>
        <div className="min-w-0 flex-[1_1_220px]">
          <h2 className="v-headline text-xl text-v-text">{t('admin.reportesFinancieros')}</h2>
          <p className="text-xs text-v-subtle">{L('Income, billing and center metrics', 'Ingresos, facturación y métricas del centro')} · {periodo}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="flex rounded-full bg-v-fill p-1">
            {[hoy.getFullYear() - 1, hoy.getFullYear()].map(y => (
              <button key={y} onClick={() => { setAnio(y); setMesFilter(null) }}
                className={`relative rounded-full px-4 py-1.5 text-xs font-semibold tabular-nums transition-colors ${anio === y ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
                {anio === y && <motion.span layoutId="rf-anio" className="absolute inset-0 rounded-full bg-v-elevated shadow-v" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span className="relative">{y}</span>
              </button>
            ))}
          </div>
          {/* Filtro de mes */}
          <div className="relative">
            <button onClick={() => setMesMenu(o => !o)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors ${mesFilter !== null ? 'border-v-accent/40 bg-v-accent-soft text-v-accent' : 'border-v-border bg-v-elevated text-v-muted hover:text-v-text'}`}>
              <Calendar size={14} /> {mesFilter === null ? t('admin.todoAnio') : MESL[mesFilter]} <ChevronDown size={13} className={`transition-transform ${mesMenu ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {mesMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMesMenu(false)} />
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full z-40 mt-1.5 w-60 rounded-v-sm border border-v-border bg-v-elevated p-2 shadow-v-lg">
                    <button onClick={() => { setMesFilter(null); setMesMenu(false) }}
                      className={`mb-1.5 w-full rounded-full py-1.5 text-xs font-semibold transition-colors ${mesFilter === null ? 'bg-v-accent-soft text-v-accent' : 'text-v-muted hover:bg-v-fill'}`}>{t('admin.todoAnio')}</button>
                    <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-1">
                      {MES.map((m, i) => {
                        const futuro = anio === hoy.getFullYear() && i > hoy.getMonth()
                        return (
                          <button key={m} disabled={futuro} onClick={() => { setMesFilter(i); setMesMenu(false) }}
                            className={`rounded-full py-1.5 text-xs font-semibold transition-colors disabled:opacity-35 ${mesFilter === i ? 'bg-v-accent text-white' : 'text-v-muted hover:bg-v-fill hover:text-v-text'}`}>{m}</button>
                        )
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          <button onClick={() => descargarExcel(mesFilter === null ? 0 : mesFilter + 1)}
            title={L('Download Excel report', 'Descargar reporte en Excel')}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-v-accent-soft px-3.5 text-xs font-semibold text-v-accent transition-colors hover:bg-v-accent hover:text-white">
            <Download size={14} /> Excel
          </button>
          <button onClick={cargar} title={L('Refresh', 'Actualizar')}
            className="grid size-9 place-items-center rounded-full border border-v-border bg-v-elevated text-v-muted transition-colors hover:text-v-accent">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <KPI index={0} label={mesFilter === null ? L('Income this year', 'Ingresos del año') : L('Income of the month', 'Ingresos del mes')} value={loading ? '—' : fmt(data.total)} sub={periodo} icon={DollarSign} tone="bg-v-success/15 text-v-success" />
        <KPI index={1} label={mesFilter === null && anio === hoy.getFullYear() ? L('This month', 'Este mes') : MESL[data.mesRef]} value={loading ? '—' : fmt(data.pagMes)}
          sub={data.deltaMes === null ? (anio === hoy.getFullYear() && data.mesRef === hoy.getMonth() ? L('Month in progress', 'Mes en curso') : undefined) : L('vs previous month', 'vs mes anterior')}
          delta={loading ? null : data.deltaMes} deltaTitle={L('Compared with the previous month', 'Comparado con el mes anterior')} icon={TrendingUp} tone="bg-v-accent-soft text-v-accent" />
        <KPI index={2} label={L('Payments collected', 'Cobros realizados')} value={loading ? '—' : data.cobros} sub={`${data.tasaCobro}% ${L('collection rate', 'tasa de cobro')}`} icon={CheckCircle2} tone="bg-v-accent-soft text-v-accent" />
        <KPI index={3} label={L('Outstanding', 'Por cobrar')} value={loading ? '—' : fmt(data.pendiente)} sub={L('Pending payment', 'Pendiente de pago')} icon={Calendar} tone="bg-v-warning/15 text-v-warning" />
      </div>

      {/* ── TABS ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-full bg-v-fill p-1">
        {reportesTabs.map(tb => {
          const on = activeTab === tb.id
          return (
            <button key={tb.id} onClick={() => setTab(tb.id as ReportesTab)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${on ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
              {on && <motion.span layoutId="rf-tab" className="absolute inset-0 rounded-full bg-v-elevated shadow-v" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <tb.Icon size={15} className="relative" /><span className="relative">{tb.label}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 size={26} className="animate-spin text-v-accent" />
          <p className="text-sm text-v-subtle">{t('admin.calculandoMetricas')}</p>
        </div>
      ) : (
        <>
          {/* ── INGRESOS ── */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <Card Icon={TrendingUp} tone="bg-v-success/15 text-v-success" title={`${L('Income evolution', 'Evolución de ingresos')} ${anio}`} sub={t('admin.ingresosCobrados')}
                right={
                  <div className="flex items-center gap-3 text-xs text-v-muted">
                    <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-v-success" /> {L('Collected', 'Cobrado')}</span>
                    <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-v-warning" /> {L('Pending', 'Pendiente')}</span>
                  </div>
                }>
                <div className="p-3 sm:p-5">
                  {sinIngresos ? <Vacio Icon={BarChart3} texto={L('No payments recorded this year.', 'Aún no hay pagos registrados este año.')} /> : (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={data.porMes} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="rfIngresos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="rfPendiente" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.22} />
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--v-border)" vertical={false} />
                        {mesFilter !== null && <ReferenceArea x1={MES[mesFilter]} x2={MES[mesFilter]} fill="var(--v-accent-soft)" fillOpacity={1} />}
                        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--v-text-tertiary)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--v-text-tertiary)' }} axisLine={false} tickLine={false} width={56} tickFormatter={v => `${symbol}${Number(v).toLocaleString(dateLoc)}`} />
                        <Tooltip content={tip} />
                        <Area type="monotone" dataKey="ingresos" name={L('Collected', 'Cobrado')} stroke="#10b981" strokeWidth={2.5} fill="url(#rfIngresos)" dot={{ r: 3, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                        <Area type="monotone" dataKey="pendiente" name={L('Pending', 'Pendiente')} stroke="#f59e0b" strokeWidth={2} fill="url(#rfPendiente)" dot={false} activeDot={{ r: 5 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card Icon={CreditCard} tone="bg-v-accent-soft text-v-accent" title={t('admin.metodosPago')} sub={periodo}>
                  <div className="p-4 sm:p-5">
                    {data.porMetodo.length === 0 ? <Vacio Icon={CreditCard} texto={t('admin.sinDatos')} /> : (
                      <div className="flex flex-col items-center gap-5 sm:flex-row">
                        <div className="relative size-[170px] shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={data.porMetodo} cx="50%" cy="50%" innerRadius={56} outerRadius={80} dataKey="value" paddingAngle={3} stroke="none">
                                {data.porMetodo.map((e, i) => <Cell key={i} fill={e.color} />)}
                              </Pie>
                              <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: 'var(--v-bg-elevated)', border: '1px solid var(--v-border)', borderRadius: 10, fontSize: 11, color: 'var(--v-text)' }} itemStyle={{ color: 'var(--v-text-secondary)' }} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <p className="text-[11px] text-v-subtle">Total</p>
                            <p className="text-sm font-bold tabular-nums text-v-text">{fmt(totMetodo)}</p>
                          </div>
                        </div>
                        <div className="w-full min-w-0 flex-1 space-y-3">
                          {data.porMetodo.map(m => {
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
                </Card>

                <Card Icon={Activity} tone="bg-v-accent-soft text-v-accent" title={t('admin.sesionesPagadas')} sub={String(anio)}>
                  <div className="p-3 sm:p-5">
                    {sinIngresos ? <Vacio Icon={Activity} texto={t('admin.sinDatos')} /> : (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={data.porMes} barSize={18}>
                          <defs>
                            <linearGradient id="rfBar" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#01abfc" /><stop offset="100%" stopColor="#0069db" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--v-border)" vertical={false} />
                          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--v-text-tertiary)' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: 'var(--v-text-tertiary)' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                          <Tooltip content={tip} cursor={{ fill: 'var(--v-fill)' }} />
                          <Bar dataKey="sesiones" name={L('Sessions', 'Sesiones')} radius={[6, 6, 0, 0]}>
                            {data.porMes.map((_, i) => <Cell key={i} fill={mesFilter === null || mesFilter === i ? 'url(#rfBar)' : 'var(--v-border)'} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Card>
              </div>

              {/* Resumen mes a mes */}
              <Card Icon={Calendar} tone="bg-v-fill text-v-muted" title={`${L('Monthly summary', 'Resumen mensual')} ${anio}`} sub={L('Tap a month to filter · download its Excel on the right', 'Tocá un mes para filtrar · descargá su Excel a la derecha')}
                right={
                  <button onClick={() => descargarExcel(0)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-v-border bg-v-elevated px-3.5 text-xs font-semibold text-v-muted transition-colors hover:text-v-accent">
                    <Download size={14} /> {L('Annual Excel', 'Excel anual')}
                  </button>
                }>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="bg-v-bg text-left text-xs text-v-subtle">
                        {[L('Month', 'Mes'), L('Sessions', 'Sesiones'), L('Collected', 'Cobrado'), L('Pending', 'Pendiente'), L('Total', 'Total'), ''].map((h, i) => (
                          <th key={i} className={`whitespace-nowrap px-4 py-2.5 font-medium sm:px-5 ${i > 0 && i < 5 ? 'text-right' : ''}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-v-border">
                      {data.porMes.map((m, i) => {
                        const vacio = m.ingresos + m.pendiente === 0
                        const sel = mesFilter === i
                        return (
                          <tr key={i} onClick={() => setMesFilter(sel ? null : i)}
                            className={`cursor-pointer transition-colors ${sel ? 'bg-v-accent-soft' : 'hover:bg-v-bg'} ${vacio ? 'text-v-subtle' : ''}`}>
                            <td className={`whitespace-nowrap px-4 py-3 font-medium sm:px-5 ${sel ? 'text-v-accent' : vacio ? '' : 'text-v-text'}`}>{MESL[i]}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-v-muted sm:px-5">{m.sesiones || '—'}</td>
                            <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums sm:px-5 ${m.ingresos ? 'text-v-success' : ''}`}>{m.ingresos ? fmt(m.ingresos) : '—'}</td>
                            <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums sm:px-5 ${m.pendiente ? 'text-v-warning' : ''}`}>{m.pendiente ? fmt(m.pendiente) : '—'}</td>
                            <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums sm:px-5 ${vacio ? '' : 'text-v-text'}`}>{vacio ? '—' : fmt(m.ingresos + m.pendiente)}</td>
                            <td className="px-3 py-2 text-right">
                              {!vacio && (
                                <button onClick={e => { e.stopPropagation(); descargarExcel(i + 1) }} title={`${L('Download report for', 'Descargar reporte de')} ${MESL[i]}`}
                                  className="grid size-8 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-accent-soft hover:text-v-accent"><Download size={14} /></button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      {(() => {
                        const tot = data.porMes.reduce((a, m) => ({ s: a.s + m.sesiones, i: a.i + m.ingresos, p: a.p + m.pendiente }), { s: 0, i: 0, p: 0 })
                        return (
                          <tr className="border-t border-v-border bg-v-bg font-semibold">
                            <td className="whitespace-nowrap px-4 py-3 text-v-text sm:px-5">{L('Total', 'Total')} {anio}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-v-text sm:px-5">{tot.s}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-v-success sm:px-5">{fmt(tot.i)}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-v-warning sm:px-5">{fmt(tot.p)}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-v-text sm:px-5">{fmt(tot.i + tot.p)}</td>
                            <td />
                          </tr>
                        )
                      })()}
                    </tfoot>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ── PACIENTES ── */}
          {activeTab === 'pacientes' && (
            <Card Icon={Users} tone="bg-v-accent-soft text-v-accent" title={`${L('Income by patient', 'Ingresos por paciente')}`} sub={periodo}
              right={<span className="rounded-full bg-v-fill px-2.5 py-1 text-xs font-semibold text-v-muted">{data.porPaciente.length} {L('patients', 'pacientes')}</span>}>
              {data.porPaciente.length === 0 ? <Vacio Icon={Users} texto={t('admin.sinDatos')} /> : (
                <div className="divide-y divide-v-border">
                  {data.porPaciente.map((p, i) => {
                    const max = data.porPaciente[0]?.ingresos || 1
                    const pct = Math.round(p.ingresos / max * 100)
                    const medalla = i < 3
                    return (
                      <motion.div key={p.name + i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.025 }}
                        className="flex items-center gap-3 px-4 py-3 sm:px-5">
                        <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${medalla ? 'bg-v-warning/15 text-v-warning' : 'text-v-subtle'}`}>{medalla ? <Trophy size={12} /> : i + 1}</span>
                        <span className="grid size-9 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-sm font-semibold text-v-accent">{p.name.charAt(0).toUpperCase()}</span>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex items-baseline justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-v-text">{p.name}{p.externo && <span className="ml-1.5 rounded-full bg-v-fill px-1.5 py-0.5 text-[10px] font-medium text-v-subtle">{L('not enrolled', 'sin inscribir')}</span>}</p>
                            <p className="shrink-0 text-sm font-bold tabular-nums text-v-text">{fmt(p.ingresos)}</p>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-v-fill">
                            <motion.div className="h-full rounded-full v-brand" style={{ boxShadow: 'none' }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
                          </div>
                          <p className="mt-1 text-[11px] text-v-subtle">{p.sesiones} {p.sesiones === 1 ? L('paid session', 'sesión pagada') : L('paid sessions', 'sesiones pagadas')}</p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </Card>
          )}

          {/* ── SERVICIOS ── */}
          {activeTab === 'servicios' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card Icon={Package} tone="bg-v-accent-soft text-v-accent" title={t('admin.distribServicio')} sub={periodo}>
                <div className="p-4 sm:p-5">
                  {data.porServicio.length === 0 ? <Vacio Icon={Package} texto={t('admin.sinDatos')} /> : (
                    <div className="relative mx-auto size-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={data.porServicio} cx="50%" cy="50%" innerRadius={70} outerRadius={104} dataKey="value" paddingAngle={2} stroke="none">
                            {data.porServicio.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: 'var(--v-bg-elevated)', border: '1px solid var(--v-border)', borderRadius: 10, fontSize: 11, color: 'var(--v-text)' }} itemStyle={{ color: 'var(--v-text-secondary)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-[11px] text-v-subtle">{data.porServicio.length} {L('services', 'servicios')}</p>
                        <p className="text-base font-bold tabular-nums text-v-text">{fmt(data.total)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              <Card Icon={Trophy} tone="bg-v-warning/15 text-v-warning" title={t('admin.rankingServicio')} sub={periodo}>
                {data.porServicio.length === 0 ? <Vacio Icon={Trophy} texto={t('admin.sinDatos')} /> : (
                  <div className="divide-y divide-v-border">
                    {data.porServicio.slice(0, 10).map((s, i) => {
                      const pct = data.total > 0 ? Math.round(s.value / data.total * 100) : 0
                      return (
                        <div key={s.name} className="flex items-center gap-3 px-5 py-3">
                          <span className="w-5 shrink-0 text-center text-xs font-semibold text-v-subtle">{i + 1}</span>
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-v-text">{s.name}</p>
                            <p className="text-[11px] text-v-subtle">{s.count} {s.count === 1 ? L('payment', 'cobro') : L('payments', 'cobros')} · {pct}%</p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold tabular-nums text-v-text">{fmt(s.value)}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
