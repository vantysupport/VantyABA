// app/api/pagos/reporte-mensual/route.ts
// Reporte financiero en Excel (mes o año completo), con la identidad visual de Vanty.
//  · Resumen: indicadores con comparación vs período anterior, servicios, métodos, evolución y top pacientes
//  · Transacciones: fechas reales, filtros, totales que respetan el filtro (SUBTOTAL)
//  · Por paciente, Deudas (lo que se debe hoy) y Abonos (pagos a cuenta del período)
// Los pagos se ubican en el período por su FECHA DE PAGO en hora de Perú (antes se usaba la fecha de registro
// y un reporte de junio podía traer cobros de julio).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import sharp from 'sharp'
import { getCentroMoneda } from '@/lib/centro-moneda'
import { getCentroBranding } from '@/lib/centro-branding'
import { getApiCaller, hasRole, ROLES, unauthorized, forbidden } from '@/lib/api-auth'
import { cobradoDe, saldoDe, type Abono } from '@/lib/pagos'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MESES    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MES_C    = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MES_C_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS_ES  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const DAYS_EN  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const STATUS_ES: Record<string, string> = { paid: 'Pagado', pending: 'Pendiente', partial: 'Parcial', cancelled: 'Cancelado', refunded: 'Devuelto' }
const STATUS_EN: Record<string, string> = { paid: 'Paid', pending: 'Pending', partial: 'Partial', cancelled: 'Cancelled', refunded: 'Refunded' }
const METHOD_ES: Record<string, string> = { efectivo: 'Efectivo', yape: 'Yape', plin: 'Plin', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro' }
const METHOD_EN: Record<string, string> = { efectivo: 'Cash', yape: 'Yape', plin: 'Plin', transferencia: 'Bank transfer', tarjeta: 'Card', otro: 'Other' }

// ── Paleta Vanty (ARGB) ───────────────────────────────────────────────────────
const V = {
  brand: 'FF0069DB', brand2: 'FF01ABFC', brandSoft: 'FFE8F2FF', brandSoft2: 'FFF2F7FF',
  text: 'FF0F1B2D', muted: 'FF56657D', subtle: 'FF8A98AD', border: 'FFE6EBF2', fill: 'FFF4F7FB', white: 'FFFFFFFF',
  ok: 'FF047857', okBg: 'FFE7F8F0', warn: 'FFB45309', warnBg: 'FFFFF5E0', bad: 'FFC81E1E', badBg: 'FFFDECEC', gray: 'FF475569', grayBg: 'FFEEF2F6',
}
const STATUS_TONE: Record<string, { fg: string; bg: string }> = {
  paid: { fg: V.ok, bg: V.okBg }, pending: { fg: V.warn, bg: V.warnBg }, partial: { fg: V.brand, bg: V.brandSoft },
  cancelled: { fg: V.bad, bg: V.badBg }, refunded: { fg: V.gray, bg: V.grayBg },
}
const FONT = 'Calibri'
const thin = (argb = V.border) => ({ style: 'thin' as const, color: { argb } })

// ── Fechas en hora de Perú ────────────────────────────────────────────────────
// paid_at viene en UTC. Los pagos antiguos guardaban solo la fecha como medianoche UTC: esos se leen tal cual.
function limaParts(iso: string) {
  const d = new Date(iso)
  const soloFecha = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0
  const x = soloFecha ? d : new Date(d.getTime() - 5 * 3600 * 1000)
  return { y: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate(), dow: x.getUTCDay() }
}
// Date "local" para Excel (Excel no tiene zona horaria: guardamos el día calendario de Perú a mediodía UTC)
const excelDate = (iso: string) => { const p = limaParts(iso); return new Date(Date.UTC(p.y, p.m, p.d, 12)) }
const fechaPago = (p: any) => p.paid_at || p.created_at

// ── Helpers de estilo ─────────────────────────────────────────────────────────
function style(c: ExcelJS.Cell, o: { bold?: boolean; size?: number; color?: string; bg?: string; align?: 'left' | 'center' | 'right'; italic?: boolean; numFmt?: string; wrap?: boolean; indent?: number } = {}) {
  c.font = { name: FONT, size: o.size ?? 10, bold: o.bold, italic: o.italic, color: { argb: o.color ?? V.text } }
  if (o.bg) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.bg } }
  c.alignment = { horizontal: o.align ?? 'left', vertical: 'middle', wrapText: o.wrap, indent: o.indent }
  if (o.numFmt) c.numFmt = o.numFmt
  return c
}
function fillRow(ws: ExcelJS.Worksheet, row: number, from: number, to: number, argb: string) {
  for (let c = from; c <= to; c++) ws.getCell(row, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}
function sectionTitle(ws: ExcelJS.Worksheet, row: number, cols: number, text: string) {
  ws.mergeCells(row, 1, row, cols)
  style(ws.getCell(row, 1), { bold: true, size: 12, color: V.brand })
  ws.getCell(row, 1).value = text
  for (let c = 1; c <= cols; c++) ws.getCell(row, c).border = { bottom: { style: 'medium', color: { argb: V.brand2 } } }
  ws.getRow(row).height = 24
}
function tableHeader(ws: ExcelJS.Worksheet, row: number, labels: string[], aligns: ('left' | 'center' | 'right')[] = []) {
  labels.forEach((l, i) => {
    const c = ws.getCell(row, i + 1)
    c.value = l
    style(c, { bold: true, size: 9, color: V.muted, bg: V.fill, align: aligns[i] ?? 'left' })
    c.border = { bottom: thin(V.border) }
  })
  ws.getRow(row).height = 22
}
function bodyRow(ws: ExcelJS.Worksheet, row: number, cols: number, zebra: boolean) {
  for (let c = 1; c <= cols; c++) {
    const cell = ws.getCell(row, c)
    if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: V.brandSoft2 } }
    cell.border = { bottom: thin(V.border) }
    if (!cell.font?.name) style(cell)
  }
  ws.getRow(row).height = 20
}
function dataBar(ws: ExcelJS.Worksheet, ref: string, argb = V.brand2) {
  ws.addConditionalFormatting({ ref, rules: [{ type: 'dataBar', priority: 1, gradient: false, cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb } } as any] })
}
function pageSetup(ws: ExcelJS.Worksheet, centro: string, titulo: string, landscape = true) {
  ws.pageSetup = { orientation: landscape ? 'landscape' : 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 }, horizontalCentered: true }
  ws.headerFooter = { oddHeader: `&L&8&K56657D${centro}&R&8&K56657D${titulo}`, oddFooter: '&L&8&K8A98ADVanty&R&8&K8A98AD&P / &N' }
}

// Logo del centro como PNG (si no se puede descargar, el reporte sale sin logo)
async function logoPng(url: string | null): Promise<Buffer | null> {
  if (!url) return null
  try {
    const ctrl = new AbortController()
    const tm = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(tm)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return await sharp(buf).resize(160, 160, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).png().toBuffer()
  } catch { return null }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const anio = Number(searchParams.get('anio') || new Date().getFullYear())
  const mes  = Number(searchParams.get('mes') ?? new Date().getMonth() + 1) // 1-12; 0 = año completo
  const lang = searchParams.get('lang') === 'en' ? 'en' : (req.headers.get('x-locale') === 'en' ? 'en' : 'es')
  const isEN = lang === 'en'
  const L = (en: string, es: string) => (isEN ? en : es)
  const MESL = isEN ? MESES_EN : MESES
  const MESC = isEN ? MES_C_EN : MES_C
  const DAYS = isEN ? DAYS_EN : DAYS_ES
  const STATUS = isEN ? STATUS_EN : STATUS_ES
  const METHOD = isEN ? METHOD_EN : METHOD_ES
  const dateLoc = isEN ? 'en-US' : 'es-PE'
  const isYear = mes === 0

  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.billing)) return forbidden()

  // Período y período anterior (para comparar)
  const enPeriodo = (iso: string, y: number, m: number | null) => { const p = limaParts(iso); return p.y === y && (m === null || p.m === m) }
  const perY = anio, perM = isYear ? null : mes - 1
  const prevY = isYear ? anio - 1 : (mes === 1 ? anio - 1 : anio)
  const prevM = isYear ? null : (mes === 1 ? 11 : mes - 2)
  const nombrePeriodo = isYear ? String(anio) : `${MESL[mes - 1]} ${anio}`
  const nombrePrev = isYear ? String(prevY) : `${MESL[prevM!]} ${prevY}`

  try {
    // Se amplía la ventana de created_at: un cobro registrado antes puede pagarse dentro del período
    const desde = new Date(Date.UTC(prevY, prevM ?? 0, 1) - 400 * 86400000).toISOString()
    const hasta = new Date(Date.UTC(anio, isYear ? 12 : mes, 1) + 45 * 86400000).toISOString()
    const [{ data: pays, error }, { data: abiertos }, branding, cur] = await Promise.all([
      supabase.from('payments').select('*, children(name)').eq('centro_id', caller.centroId)
        .gte('created_at', desde).lt('created_at', hasta).order('created_at', { ascending: true }).limit(10000),
      supabase.from('payments').select('*, children(name)').eq('centro_id', caller.centroId)
        .in('status', ['pending', 'partial']).order('created_at', { ascending: true }).limit(2000),
      getCentroBranding({ centroId: caller.centroId }),
      getCentroMoneda(caller.centroId),
    ])
    if (error) throw error
    const money = `"${cur.symbol} "#,##0.00;[Red]-"${cur.symbol} "#,##0.00;"—"`
    const pct = '0%'

    const todos = pays || []
    const all  = todos.filter(p => enPeriodo(fechaPago(p), perY, perM))
    const prev = todos.filter(p => enPeriodo(fechaPago(p), prevY, prevM))
    const pacienteDe = (p: any) => p.children?.name || p.paciente_externo || L('No name', 'Sin nombre')
    const esExterno = (p: any) => !p.children?.name && !!p.paciente_externo

    const cob  = (a: any[]) => a.reduce((s, p) => s + cobradoDe(p), 0)
    const deb  = (a: any[]) => a.reduce((s, p) => s + saldoDe(p), 0)
    const vig  = (a: any[]) => a.filter(p => p.status !== 'cancelled' && p.status !== 'refunded')
    const cobrado = cob(all), cobradoPrev = cob(prev)
    const porCobrar = deb(all)
    const facturado = vig(all).reduce((s, p) => s + Number(p.amount), 0)
    const cobros = all.filter(p => cobradoDe(p) > 0).length
    const cobrosPrev = prev.filter(p => cobradoDe(p) > 0).length
    const anulados = all.filter(p => p.status === 'cancelled' || p.status === 'refunded')
    const ticket = cobros ? cobrado / cobros : 0
    const ticketPrev = cobrosPrev ? cobradoPrev / cobrosPrev : 0
    const tasa = facturado ? cobrado / facturado : 0
    const delta = (a: number, b: number) => (b > 0 ? (a - b) / b : null)

    const centro = branding.name
    const titulo = `${L('Financial report', 'Reporte financiero')} · ${nombrePeriodo}`
    const emitido = new Date().toLocaleDateString(dateLoc, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Lima' })

    const wb = new ExcelJS.Workbook()
    wb.creator = centro; wb.company = centro; wb.title = titulo; wb.created = new Date()
    const logo = await logoPng(branding.logoUrl)
    const logoId = logo ? wb.addImage({ buffer: logo as any, extension: 'png' }) : null

    // ════════════════════════════════════════════════════════════════════════
    // HOJA 1 · RESUMEN
    // ════════════════════════════════════════════════════════════════════════
    const ws = wb.addWorksheet(L('Summary', 'Resumen'), { properties: { tabColor: { argb: V.brand } }, views: [{ showGridLines: false }] })
    ws.columns = [{ width: 30 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }]
    const COLS = 8

    // Banda de marca
    for (let r = 1; r <= 4; r++) fillRow(ws, r, 1, COLS, V.brand)
    ws.getRow(1).height = 10; ws.getRow(2).height = 30; ws.getRow(3).height = 20; ws.getRow(4).height = 12
    ws.mergeCells(2, 1, 2, 6); ws.mergeCells(3, 1, 3, 6)
    style(ws.getCell(2, 1), { bold: true, size: 18, color: V.white, bg: V.brand, indent: logo ? 5 : 1 }).value = centro
    style(ws.getCell(3, 1), { size: 11, color: 'FFDCEBFF', bg: V.brand, indent: logo ? 5 : 1 }).value = `${titulo}   ·   ${L('Issued', 'Emitido el')} ${emitido}`
    if (logoId !== null) ws.addImage(logoId, { tl: { col: 0.15, row: 0.6 }, ext: { width: 52, height: 52 } })
    for (let c = 1; c <= COLS; c++) ws.getCell(5, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: V.brand2 } }
    ws.getRow(5).height = 4

    // Tarjetas de indicadores (2 columnas cada una)
    const kpis: { label: string; value: number; fmt: string; d: number | null; tone: string; sub: string }[] = [
      { label: L('Collected', 'Cobrado'), value: cobrado, fmt: money, d: delta(cobrado, cobradoPrev), tone: V.ok, sub: `${L('vs', 'vs')} ${nombrePrev}` },
      { label: L('Outstanding', 'Por cobrar'), value: porCobrar, fmt: money, d: null, tone: V.warn, sub: L('Pending + balances of partial payments', 'Pendientes + saldos de parciales') },
      { label: L('Payments', 'Cobros'), value: cobros, fmt: '0', d: delta(cobros, cobrosPrev), tone: V.brand, sub: `${Math.round(tasa * 100)}% ${L('of billed collected', 'de lo facturado cobrado')}` },
      { label: L('Average ticket', 'Ticket promedio'), value: ticket, fmt: money, d: delta(ticket, ticketPrev), tone: V.brand, sub: L('Per collected payment', 'Por cobro realizado') },
    ]
    const kr = 7
    kpis.forEach((k, i) => {
      const c0 = 1 + i * 2, c1 = c0 + 1
      if (i === 0) { ws.getColumn(1).width = 30 }
      ws.mergeCells(kr, c0, kr, c1); ws.mergeCells(kr + 1, c0, kr + 1, c1); ws.mergeCells(kr + 2, c0, kr + 2, c1)
      for (let r = kr; r <= kr + 2; r++) for (let c = c0; c <= c1; c++) {
        const cell = ws.getCell(r, c)
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: V.fill } }
        cell.border = { top: r === kr ? { style: 'medium', color: { argb: k.tone } } : undefined, left: c === c0 ? thin(V.white) : undefined, right: c === c1 ? thin(V.white) : undefined }
      }
      style(ws.getCell(kr, c0), { size: 9, color: V.muted, bg: V.fill, indent: 1 }).value = k.label.toUpperCase()
      style(ws.getCell(kr + 1, c0), { size: 20, bold: true, color: V.text, bg: V.fill, indent: 1, numFmt: k.fmt }).value = Math.round(k.value * 100) / 100
      const dTxt = k.d === null ? k.sub : `${k.d >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(k.d * 100))}%  ${k.sub}`
      style(ws.getCell(kr + 2, c0), { size: 9, color: k.d === null ? V.subtle : k.d >= 0 ? V.ok : V.bad, bg: V.fill, indent: 1 }).value = dTxt
    })
    ws.getRow(kr).height = 20; ws.getRow(kr + 1).height = 32; ws.getRow(kr + 2).height = 18

    let r = kr + 4

    // Evolución (mes a mes si es anual; semana a semana si es mensual)
    if (isYear) {
      sectionTitle(ws, r, COLS, L('Month by month', 'Mes a mes')); r++
      tableHeader(ws, r, [L('Month', 'Mes'), L('Payments', 'Cobros'), L('Collected', 'Cobrado'), L('Outstanding', 'Por cobrar'), L('Share', 'Participación')], ['left', 'center', 'right', 'right', 'left']); r++
      const r0 = r
      for (let m = 0; m < 12; m++) {
        const rows = all.filter(p => limaParts(fechaPago(p)).m === m)
        const row = ws.getRow(r)
        row.values = [MESL[m], rows.filter(p => cobradoDe(p) > 0).length, cob(rows), deb(rows), cobrado ? cob(rows) / cobrado : 0]
        bodyRow(ws, r, 5, m % 2 === 1)
        style(row.getCell(1), { bold: true, bg: m % 2 ? V.brandSoft2 : undefined, indent: 1 }); style(row.getCell(2), { align: 'center', bg: m % 2 ? V.brandSoft2 : undefined })
        style(row.getCell(3), { numFmt: money, align: 'right', bold: true, color: V.ok, bg: m % 2 ? V.brandSoft2 : undefined }); style(row.getCell(4), { numFmt: money, align: 'right', color: V.warn, bg: m % 2 ? V.brandSoft2 : undefined })
        style(row.getCell(5), { numFmt: pct, bg: m % 2 ? V.brandSoft2 : undefined })
        r++
      }
      dataBar(ws, `E${r0}:E${r - 1}`)
      r++
    } else {
      sectionTitle(ws, r, COLS, L('Week by week', 'Semana a semana')); r++
      tableHeader(ws, r, [L('Week', 'Semana'), L('Payments', 'Cobros'), L('Collected', 'Cobrado'), L('Share', 'Participación')], ['left', 'center', 'right', 'left']); r++
      const r0 = r
      const diasMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
      for (let w = 0; w * 7 < diasMes; w++) {
        const d0 = w * 7 + 1, d1 = Math.min(diasMes, d0 + 6)
        const rows = all.filter(p => { const d = limaParts(fechaPago(p)).d; return d >= d0 && d <= d1 })
        const row = ws.getRow(r)
        row.values = [`${L('Week', 'Semana')} ${w + 1}  (${d0}–${d1} ${MESC[mes - 1]})`, rows.filter(p => cobradoDe(p) > 0).length, cob(rows), cobrado ? cob(rows) / cobrado : 0]
        const z = w % 2 === 1 ? V.brandSoft2 : undefined
        bodyRow(ws, r, 4, w % 2 === 1)
        style(row.getCell(1), { bold: true, bg: z, indent: 1 }); style(row.getCell(2), { align: 'center', bg: z })
        style(row.getCell(3), { numFmt: money, align: 'right', bold: true, color: V.ok, bg: z }); style(row.getCell(4), { numFmt: pct, bg: z })
        r++
      }
      dataBar(ws, `D${r0}:D${r - 1}`)
      r++
    }

    // Ingresos por servicio
    const sMap: Record<string, { n: number; v: number }> = {}
    all.filter(p => cobradoDe(p) > 0).forEach(p => {
      const s = String(p.concept || L('Other', 'Otro')).replace(/\s*\(\d+\/\d+\)$/, '').trim()
      sMap[s] ??= { n: 0, v: 0 }; sMap[s].n++; sMap[s].v += cobradoDe(p)
    })
    const servicios = Object.entries(sMap).sort(([, a], [, b]) => b.v - a.v)
    sectionTitle(ws, r, COLS, L('Income by service', 'Ingresos por servicio')); r++
    tableHeader(ws, r, [L('Service', 'Servicio'), L('Payments', 'Cobros'), L('Income', 'Ingreso'), L('Share', 'Participación')], ['left', 'center', 'right', 'left']); r++
    {
      const r0 = r
      servicios.forEach(([name, v], i) => {
        const row = ws.getRow(r); const z = i % 2 ? V.brandSoft2 : undefined
        row.values = [name, v.n, v.v, cobrado ? v.v / cobrado : 0]
        bodyRow(ws, r, 4, i % 2 === 1)
        style(row.getCell(1), { bg: z, indent: 1 }); style(row.getCell(2), { align: 'center', bg: z })
        style(row.getCell(3), { numFmt: money, align: 'right', bold: true, bg: z }); style(row.getCell(4), { numFmt: pct, bg: z })
        r++
      })
      if (!servicios.length) { style(ws.getCell(r, 1), { italic: true, color: V.subtle, indent: 1 }).value = L('No income in this period', 'Sin ingresos en este período'); r++ }
      else dataBar(ws, `D${r0}:D${r - 1}`)
    }
    r++

    // Ingresos por método
    const metodos = Object.keys(METHOD).map(m => ({ m, v: cob(all.filter(p => p.payment_method === m)), n: all.filter(p => p.payment_method === m && cobradoDe(p) > 0).length })).filter(x => x.v > 0).sort((a, b) => b.v - a.v)
    sectionTitle(ws, r, COLS, L('Income by payment method', 'Ingresos por método de pago')); r++
    tableHeader(ws, r, [L('Method', 'Método'), L('Payments', 'Cobros'), L('Income', 'Ingreso'), L('Share', 'Participación')], ['left', 'center', 'right', 'left']); r++
    {
      const r0 = r
      metodos.forEach((x, i) => {
        const row = ws.getRow(r); const z = i % 2 ? V.brandSoft2 : undefined
        row.values = [METHOD[x.m], x.n, x.v, cobrado ? x.v / cobrado : 0]
        bodyRow(ws, r, 4, i % 2 === 1)
        style(row.getCell(1), { bg: z, indent: 1 }); style(row.getCell(2), { align: 'center', bg: z })
        style(row.getCell(3), { numFmt: money, align: 'right', bold: true, bg: z }); style(row.getCell(4), { numFmt: pct, bg: z })
        r++
      })
      if (!metodos.length) { style(ws.getCell(r, 1), { italic: true, color: V.subtle, indent: 1 }).value = '—'; r++ }
      else dataBar(ws, `D${r0}:D${r - 1}`, 'FF10B981')
    }
    r++

    // Top pacientes
    const pMap: Record<string, { name: string; ext: boolean; n: number; v: number; saldo: number }> = {}
    all.forEach(p => {
      const k = p.child_id || `ext:${p.paciente_externo || ''}`
      pMap[k] ??= { name: pacienteDe(p), ext: esExterno(p), n: 0, v: 0, saldo: 0 }
      if (cobradoDe(p) > 0) pMap[k].n++
      pMap[k].v += cobradoDe(p); pMap[k].saldo += saldoDe(p)
    })
    const pacientes = Object.values(pMap).sort((a, b) => b.v - a.v)
    sectionTitle(ws, r, COLS, L('Top patients', 'Pacientes con más ingresos')); r++
    tableHeader(ws, r, ['#  ' + L('Patient', 'Paciente'), L('Payments', 'Cobros'), L('Collected', 'Cobrado'), L('Share', 'Participación')], ['left', 'center', 'right', 'left']); r++
    {
      const r0 = r
      pacientes.slice(0, 5).forEach((x, i) => {
        const row = ws.getRow(r); const z = i % 2 ? V.brandSoft2 : undefined
        row.values = [`${i + 1}.  ${x.name}${x.ext ? L(' (not enrolled)', ' (sin inscribir)') : ''}`, x.n, x.v, cobrado ? x.v / cobrado : 0]
        bodyRow(ws, r, 4, i % 2 === 1)
        style(row.getCell(1), { bold: i < 3, bg: z, indent: 1 }); style(row.getCell(2), { align: 'center', bg: z })
        style(row.getCell(3), { numFmt: money, align: 'right', bold: true, bg: z }); style(row.getCell(4), { numFmt: pct, bg: z })
        r++
      })
      if (pacientes.length) dataBar(ws, `D${r0}:D${r - 1}`)
    }
    r++
    ws.mergeCells(r, 1, r, COLS)
    style(ws.getCell(r, 1), { size: 8, italic: true, color: V.subtle, wrap: true }).value =
      L(`Collected includes full payments and down payments of partial payments. Payments are placed in the period by their payment date (Peru time). ${anulados.length} cancelled/refunded charge(s) excluded. Internal report — not a SUNAT tax document.`,
        `Cobrado incluye pagos completos y adelantos de pagos parciales. Los cobros se ubican en el período por su fecha de pago (hora de Perú). Se excluyen ${anulados.length} cobro(s) anulado(s) o devuelto(s). Reporte interno — no es comprobante SUNAT.`)
    ws.getRow(r).height = 30
    pageSetup(ws, centro, titulo, false)

    // ════════════════════════════════════════════════════════════════════════
    // HOJA 2 · TRANSACCIONES
    // ════════════════════════════════════════════════════════════════════════
    const wt = wb.addWorksheet(L('Transactions', 'Transacciones'), { properties: { tabColor: { argb: V.brand2 } }, views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] })
    wt.columns = [{ width: 12 }, { width: 7 }, { width: 28 }, { width: 32 }, { width: 15 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 36 }]
    wt.mergeCells(1, 1, 1, 10)
    style(wt.getCell(1, 1), { bold: true, size: 14, color: V.white, bg: V.brand, indent: 1 }).value = `${centro} — ${L('Transactions', 'Transacciones')} · ${nombrePeriodo}`
    wt.getRow(1).height = 30
    wt.mergeCells(2, 1, 2, 10)
    style(wt.getCell(2, 1), { size: 9, color: V.muted, bg: V.brandSoft2, indent: 1 }).value = L('Use the arrows in the header to filter by patient, method or status. Totals below follow the filter.', 'Usá las flechas del encabezado para filtrar por paciente, método o estado. Los totales de abajo respetan el filtro.')
    tableHeader(wt, 3, [L('Date', 'Fecha'), L('Day', 'Día'), L('Patient', 'Paciente'), L('Concept', 'Concepto'), L('Method', 'Método'), L('Status', 'Estado'), L('Amount', 'Importe'), L('Paid', 'Pagado'), L('Balance', 'Saldo'), L('Note', 'Nota')],
      ['left', 'center', 'left', 'left', 'left', 'center', 'right', 'right', 'right', 'left'])
    const ordenadas = [...all].sort((a, b) => new Date(fechaPago(a)).getTime() - new Date(fechaPago(b)).getTime())
    let tr = 4
    ordenadas.forEach((p, i) => {
      const row = wt.getRow(tr); const z = i % 2 ? V.brandSoft2 : undefined
      const anulado = p.status === 'cancelled' || p.status === 'refunded'
      row.values = [excelDate(fechaPago(p)), DAYS[limaParts(fechaPago(p)).dow], pacienteDe(p) + (esExterno(p) ? L(' (not enrolled)', ' (sin inscribir)') : ''), p.concept || '—',
        METHOD[p.payment_method] || p.payment_method || '—', STATUS[p.status] || p.status, anulado ? 0 : Number(p.amount), cobradoDe(p), saldoDe(p), p.notes || '']
      bodyRow(wt, tr, 10, i % 2 === 1)
      style(row.getCell(1), { numFmt: 'dd/mm/yyyy', bg: z, indent: 1 }); style(row.getCell(2), { align: 'center', color: V.muted, bg: z })
      style(row.getCell(3), { bold: true, bg: z }); style(row.getCell(4), { bg: z }); style(row.getCell(5), { color: V.muted, bg: z })
      const tone = STATUS_TONE[p.status] || STATUS_TONE.refunded
      style(row.getCell(6), { bold: true, size: 9, align: 'center', color: tone.fg, bg: tone.bg })
      style(row.getCell(7), { numFmt: money, align: 'right', bg: z, color: anulado ? V.subtle : V.text })
      style(row.getCell(8), { numFmt: money, align: 'right', bold: true, color: V.ok, bg: z })
      style(row.getCell(9), { numFmt: money, align: 'right', color: V.warn, bg: z })
      style(row.getCell(10), { size: 9, italic: true, color: V.muted, bg: z, wrap: true })
      if (anulado) row.getCell(7).note = L('Cancelled/refunded: not counted', 'Anulado/devuelto: no suma')
      tr++
    })
    if (!ordenadas.length) { wt.mergeCells(tr, 1, tr, 10); style(wt.getCell(tr, 1), { italic: true, color: V.subtle, align: 'center' }).value = L('No transactions in this period', 'Sin transacciones en este período'); tr++ }
    const last = Math.max(4, tr - 1)
    wt.autoFilter = { from: { row: 3, column: 1 }, to: { row: last, column: 10 } }
    // Totales con SUBTOTAL: se recalculan al filtrar
    const tt = wt.getRow(tr + 1)
    wt.mergeCells(tr + 1, 1, tr + 1, 6)
    tt.getCell(1).value = { formula: `"${L('TOTAL', 'TOTAL')} — "&SUBTOTAL(103,C4:C${last})&" ${L('records', 'registros')}"`, result: `${L('TOTAL', 'TOTAL')} — ${ordenadas.length} ${L('records', 'registros')}` } as any
    tt.getCell(7).value = { formula: `SUBTOTAL(109,G4:G${last})`, result: ordenadas.reduce((s, p) => s + (p.status === 'cancelled' || p.status === 'refunded' ? 0 : Number(p.amount)), 0) } as any
    tt.getCell(8).value = { formula: `SUBTOTAL(109,H4:H${last})`, result: cobrado } as any
    tt.getCell(9).value = { formula: `SUBTOTAL(109,I4:I${last})`, result: porCobrar } as any
    for (let c = 1; c <= 10; c++) style(tt.getCell(c), { bold: true, size: 11, color: V.white, bg: V.brand, align: c >= 7 && c <= 9 ? 'right' : 'left', numFmt: c >= 7 && c <= 9 ? money : undefined, indent: c === 1 ? 1 : undefined })
    tt.height = 24
    pageSetup(wt, centro, titulo)
    wt.pageSetup.printTitlesRow = '3:3'

    // ════════════════════════════════════════════════════════════════════════
    // HOJA 3 · POR PACIENTE
    // ════════════════════════════════════════════════════════════════════════
    const wp = wb.addWorksheet(L('By patient', 'Por paciente'), { properties: { tabColor: { argb: 'FF10B981' } }, views: [{ state: 'frozen', ySplit: 2, showGridLines: false }] })
    wp.columns = [{ width: 34 }, { width: 11 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 14 }]
    wp.mergeCells(1, 1, 1, 6)
    style(wp.getCell(1, 1), { bold: true, size: 14, color: V.white, bg: V.brand, indent: 1 }).value = `${centro} — ${L('By patient', 'Por paciente')} · ${nombrePeriodo}`
    wp.getRow(1).height = 30
    tableHeader(wp, 2, [L('Patient', 'Paciente'), L('Payments', 'Cobros'), L('Billed', 'Facturado'), L('Collected', 'Cobrado'), L('Balance', 'Saldo'), L('Share', 'Participación')], ['left', 'center', 'right', 'right', 'right', 'left'])
    const fMap: Record<string, number> = {}
    vig(all).forEach(p => { const k = p.child_id || `ext:${p.paciente_externo || ''}`; fMap[k] = (fMap[k] || 0) + Number(p.amount) })
    const pacKeys = Object.keys(pMap).sort((a, b) => pMap[b].v - pMap[a].v)
    let pr = 3
    pacKeys.forEach((k, i) => {
      const x = pMap[k]; const row = wp.getRow(pr); const z = i % 2 ? V.brandSoft2 : undefined
      row.values = [x.name + (x.ext ? L(' (not enrolled)', ' (sin inscribir)') : ''), x.n, fMap[k] || 0, x.v, x.saldo, cobrado ? x.v / cobrado : 0]
      bodyRow(wp, pr, 6, i % 2 === 1)
      style(row.getCell(1), { bold: true, bg: z, indent: 1 }); style(row.getCell(2), { align: 'center', bg: z })
      style(row.getCell(3), { numFmt: money, align: 'right', bg: z }); style(row.getCell(4), { numFmt: money, align: 'right', bold: true, color: V.ok, bg: z })
      style(row.getCell(5), { numFmt: money, align: 'right', color: V.warn, bg: z }); style(row.getCell(6), { numFmt: pct, bg: z })
      pr++
    })
    if (pacKeys.length) {
      dataBar(wp, `F3:F${pr - 1}`)
      wp.autoFilter = { from: { row: 2, column: 1 }, to: { row: pr - 1, column: 6 } }
    }
    const pt = wp.getRow(pr + 1)
    pt.values = [L('TOTAL', 'TOTAL'), cobros, facturado, cobrado, porCobrar, cobrado ? 1 : 0]
    for (let c = 1; c <= 6; c++) style(pt.getCell(c), { bold: true, size: 11, color: V.white, bg: V.brand, align: c === 1 ? 'left' : c === 2 ? 'center' : 'right', numFmt: c >= 3 && c <= 5 ? money : c === 6 ? pct : undefined, indent: c === 1 ? 1 : undefined })
    pt.height = 24
    pageSetup(wp, centro, titulo, false)

    // ════════════════════════════════════════════════════════════════════════
    // HOJA 4 · DEUDAS (situación al día de hoy)
    // ════════════════════════════════════════════════════════════════════════
    const deudas = (abiertos || []).filter(p => saldoDe(p) > 0)
    const wd = wb.addWorksheet(L('Debts', 'Deudas'), { properties: { tabColor: { argb: 'FFF59E0B' } }, views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] })
    wd.columns = [{ width: 30 }, { width: 30 }, { width: 13 }, { width: 11 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }]
    wd.mergeCells(1, 1, 1, 8)
    style(wd.getCell(1, 1), { bold: true, size: 14, color: V.white, bg: V.warn, indent: 1 }).value = `${centro} — ${L('Open debts as of', 'Deudas abiertas al')} ${emitido}`
    wd.getRow(1).height = 30
    wd.mergeCells(2, 1, 2, 8)
    style(wd.getCell(2, 1), { size: 9, color: V.muted, bg: V.warnBg, indent: 1 }).value = L('Everything owed today (any date): pending charges and balances of partial payments.', 'Todo lo que se debe hoy (de cualquier fecha): cobros pendientes y saldos de pagos parciales.')
    tableHeader(wd, 3, [L('Patient', 'Paciente'), L('Concept', 'Concepto'), L('Registered', 'Registrado'), L('Days', 'Días'), L('Amount', 'Importe'), L('Paid', 'Pagado'), L('Balance', 'Saldo'), L('Status', 'Estado')],
      ['left', 'left', 'left', 'center', 'right', 'right', 'right', 'center'])
    const hoyMs = Date.now()
    const deudasOrd = [...deudas].sort((a, b) => pacienteDe(a).localeCompare(pacienteDe(b)) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    let dr = 4
    deudasOrd.forEach((p, i) => {
      const row = wd.getRow(dr); const z = i % 2 ? V.brandSoft2 : undefined
      const dias = Math.max(0, Math.floor((hoyMs - new Date(p.created_at).getTime()) / 86400000))
      row.values = [pacienteDe(p) + (esExterno(p) ? L(' (not enrolled)', ' (sin inscribir)') : ''), p.concept || '—', excelDate(p.created_at), dias, Number(p.amount), cobradoDe(p), saldoDe(p), STATUS[p.status] || p.status]
      bodyRow(wd, dr, 8, i % 2 === 1)
      style(row.getCell(1), { bold: true, bg: z, indent: 1 }); style(row.getCell(2), { bg: z }); style(row.getCell(3), { numFmt: 'dd/mm/yyyy', bg: z })
      style(row.getCell(4), { align: 'center', bold: dias > 30, color: dias > 60 ? V.bad : dias > 30 ? V.warn : V.muted, bg: z })
      style(row.getCell(5), { numFmt: money, align: 'right', bg: z }); style(row.getCell(6), { numFmt: money, align: 'right', color: V.ok, bg: z })
      style(row.getCell(7), { numFmt: money, align: 'right', bold: true, color: V.warn, bg: z })
      const tone = STATUS_TONE[p.status] || STATUS_TONE.pending
      style(row.getCell(8), { bold: true, size: 9, align: 'center', color: tone.fg, bg: tone.bg })
      dr++
    })
    if (!deudasOrd.length) { wd.mergeCells(dr, 1, dr, 8); style(wd.getCell(dr, 1), { italic: true, color: V.ok, align: 'center' }).value = L('No open debts', 'No hay deudas abiertas'); dr++ }
    else wd.autoFilter = { from: { row: 3, column: 1 }, to: { row: dr - 1, column: 8 } }
    const dt = wd.getRow(dr + 1)
    wd.mergeCells(dr + 1, 1, dr + 1, 4)
    dt.getCell(1).value = `${L('TOTAL OWED', 'TOTAL ADEUDADO')} — ${new Set(deudas.map(p => p.child_id || p.paciente_externo)).size} ${L('families', 'familias')}`
    dt.getCell(5).value = deudas.reduce((s, p) => s + Number(p.amount), 0)
    dt.getCell(6).value = cob(deudas)
    dt.getCell(7).value = deb(deudas)
    for (let c = 1; c <= 8; c++) style(dt.getCell(c), { bold: true, size: 11, color: V.white, bg: V.warn, align: c >= 5 && c <= 7 ? 'right' : 'left', numFmt: c >= 5 && c <= 7 ? money : undefined, indent: c === 1 ? 1 : undefined })
    dt.height = 24
    pageSetup(wd, centro, titulo)

    // ════════════════════════════════════════════════════════════════════════
    // HOJA 5 · ABONOS (pagos a cuenta registrados en el período)
    // ════════════════════════════════════════════════════════════════════════
    // Solo cobros pagados en cuotas (un pago al contado ya aparece en Transacciones)
    const enCuotas = (p: any) => Array.isArray(p.abonos) && (p.status === 'partial' || p.abonos.length > 1)
    const abonos = todos.filter(enCuotas).flatMap(p => (p.abonos as Abono[])
      .filter(a => a?.fecha && enPeriodo(a.fecha, perY, perM))
      .map(a => ({ p, a })))
      .sort((x, y) => new Date(x.a.fecha).getTime() - new Date(y.a.fecha).getTime())
    if (abonos.length) {
      const wa = wb.addWorksheet(L('Installments', 'Abonos'), { properties: { tabColor: { argb: 'FF742284' } }, views: [{ state: 'frozen', ySplit: 2, showGridLines: false }] })
      wa.columns = [{ width: 12 }, { width: 30 }, { width: 32 }, { width: 15 }, { width: 14 }]
      wa.mergeCells(1, 1, 1, 5)
      style(wa.getCell(1, 1), { bold: true, size: 14, color: V.white, bg: V.brand, indent: 1 }).value = `${centro} — ${L('Payments on account', 'Pagos a cuenta')} · ${nombrePeriodo}`
      wa.getRow(1).height = 30
      tableHeader(wa, 2, [L('Date', 'Fecha'), L('Patient', 'Paciente'), L('Concept', 'Concepto'), L('Method', 'Método'), L('Amount', 'Importe')], ['left', 'left', 'left', 'left', 'right'])
      let ar = 3
      abonos.forEach(({ p, a }, i) => {
        const row = wa.getRow(ar); const z = i % 2 ? V.brandSoft2 : undefined
        row.values = [excelDate(a.fecha), pacienteDe(p), p.concept || '—', METHOD[a.metodo] || a.metodo, Number(a.monto)]
        bodyRow(wa, ar, 5, i % 2 === 1)
        style(row.getCell(1), { numFmt: 'dd/mm/yyyy', bg: z, indent: 1 }); style(row.getCell(2), { bold: true, bg: z }); style(row.getCell(3), { bg: z })
        style(row.getCell(4), { color: V.muted, bg: z }); style(row.getCell(5), { numFmt: money, align: 'right', bold: true, color: V.ok, bg: z })
        ar++
      })
      const at = wa.getRow(ar + 1)
      wa.mergeCells(ar + 1, 1, ar + 1, 4)
      at.getCell(1).value = `${L('TOTAL', 'TOTAL')} — ${abonos.length} ${L('installments', 'abonos')}`
      at.getCell(5).value = abonos.reduce((s, x) => s + Number(x.a.monto), 0)
      for (let c = 1; c <= 5; c++) style(at.getCell(c), { bold: true, size: 11, color: V.white, bg: V.brand, align: c === 5 ? 'right' : 'left', numFmt: c === 5 ? money : undefined, indent: c === 1 ? 1 : undefined })
      at.height = 24
      pageSetup(wa, centro, titulo, false)
    }

    const buffer = await wb.xlsx.writeBuffer()
    const archivo = `${L('financial_report', 'reporte_financiero')}_${isYear ? anio : `${MESL[mes - 1].toLowerCase()}_${anio}`}.xlsx`
    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${archivo}"`,
      },
    })
  } catch (e: any) {
    console.error('Error generando reporte:', e)
    return NextResponse.json({ error: process.env.NODE_ENV === 'production' ? 'Ocurrió un error. Intentá de nuevo.' : e.message }, { status: 500 })
  }
}
