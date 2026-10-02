import 'server-only'
// Recibo de pago en PDF (A4), generado en el servidor para adjuntarlo al correo. Mismo contenido que
// el recibo HTML de /api/pagos/recibo-pdf: centro, número, estado, cliente, detalle, total y pago.

import { jsPDF } from 'jspdf'
import sharp from 'sharp'
import { fmtFechaCorta, fmtFechaLarga } from '@/lib/recibo-html'
import { creditoVanty } from '@/lib/branding'
import { cobradoDe, saldoDe, type Abono } from '@/lib/pagos'

export type PagoRecibo = {
  status: string; amount: number | string; concept?: string | null; notes?: string | null; payment_method?: string | null
  created_at: string; fecha_cobro?: string | null; paid_at?: string | null; abonos?: unknown; amount_paid?: number | string | null
  paciente_externo?: string | null; children?: unknown; appointments?: unknown; especialista?: unknown; responsable?: string | null
}

export type DatosReciboPDF = {
  payment: PagoRecibo
  center: { nombre: string; ruc?: string; direccion?: string; telefono?: string; email?: string; logoUrl?: string | null }
  pacienteNombre: string
  tutor: { full_name?: string | null; email?: string | null; phone?: string | null } | null
  reciboNum: string
  lang: 'es' | 'en'
  symbol: string
  sesion?: { appointment_date: string; appointment_time: string | null } | null
  especialista?: string | null
}

const AZUL: [number, number, number] = [0, 99, 216]
const TINTA: [number, number, number] = [11, 27, 51]
const GRIS: [number, number, number] = [110, 124, 146]
const BORDE: [number, number, number] = [222, 231, 243]
const FONDO: [number, number, number] = [243, 248, 254]

const ESTADO: Record<string, { es: string; en: string; fg: [number, number, number]; bg: [number, number, number] }> = {
  paid:      { es: 'Pagado',    en: 'Paid',      fg: [4, 120, 87],   bg: [231, 248, 240] },
  pending:   { es: 'Pendiente', en: 'Pending',   fg: [180, 83, 9],   bg: [255, 245, 224] },
  partial:   { es: 'Parcial',   en: 'Partial',   fg: [0, 105, 219],  bg: [232, 242, 255] },
  cancelled: { es: 'Anulado',   en: 'Cancelled', fg: [200, 30, 30],  bg: [253, 236, 236] },
  refunded:  { es: 'Devuelto',  en: 'Refunded',  fg: [71, 85, 105],  bg: [238, 242, 246] },
}

async function logoPng(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!r.ok) return null
    const png = await sharp(Buffer.from(await r.arrayBuffer())).resize(160, 160, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).flatten({ background: '#ffffff' }).png().toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  } catch {
    return null
  }
}

export async function generarReciboPDF(d: DatosReciboPDF): Promise<Buffer> {
  const { payment: p, center, lang, symbol } = d
  const en = lang === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const dinero = (n: number) => `${symbol} ${Number(n || 0).toLocaleString(en ? 'en-US' : 'es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const METODO: Record<string, string> = en
    ? { yape: 'Yape', plin: 'Plin', efectivo: 'Cash', transferencia: 'Bank transfer', tarjeta: 'Card', otro: 'Other' }
    : { yape: 'Yape', plin: 'Plin', efectivo: 'Efectivo', transferencia: 'Transferencia bancaria', tarjeta: 'Tarjeta', otro: 'Otro' }

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 48
  const ancho = W - M * 2
  let y = 0

  const txt = (s: string, x: number, yy: number, o: { size?: number; bold?: boolean; color?: [number, number, number]; align?: 'left' | 'right' | 'center' } = {}) => {
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(o.size ?? 10); doc.setTextColor(...(o.color ?? TINTA))
    doc.text(s, x, yy, { align: o.align ?? 'left' })
  }
  const caja = (x: number, yy: number, w: number, h: number, fill: [number, number, number] = [255, 255, 255], borde = true) => {
    doc.setFillColor(...fill); doc.setDrawColor(...BORDE); doc.setLineWidth(0.8)
    doc.roundedRect(x, yy, w, h, 8, 8, borde ? 'FD' : 'F')
  }
  const seccion = (t: string) => { txt(t.toUpperCase(), M, y, { size: 8, bold: true, color: GRIS }); y += 10 }

  // Franja de marca
  doc.setFillColor(...AZUL); doc.rect(0, 0, W, 6, 'F')

  // Encabezado: centro a la izquierda, número de recibo a la derecha
  y = 48
  const logo = await logoPng(center.logoUrl)
  let xNombre = M
  if (logo) { doc.addImage(logo, 'PNG', M, y - 8, 46, 46); xNombre = M + 58 }
  txt(center.nombre || 'Vanty ABA', xNombre, y + 6, { size: 15, bold: true })
  const datosCentro = [center.ruc ? `RUC ${center.ruc}` : '', center.direccion, center.telefono, center.email].filter(Boolean) as string[]
  datosCentro.slice(0, 3).forEach((l, i) => txt(l, xNombre, y + 21 + i * 12, { size: 8.5, color: GRIS }))
  txt(L('PAYMENT RECEIPT', 'RECIBO DE PAGO'), W - M, y - 2, { size: 8, bold: true, color: GRIS, align: 'right' })
  txt(`N.° ${d.reciboNum}`, W - M, y + 18, { size: 20, bold: true, color: AZUL, align: 'right' })
  const emitido = fmtFechaLarga(p.fecha_cobro || p.created_at, lang)
  txt(`${L('Issued', 'Emitido')} ${emitido}`, W - M, y + 33, { size: 9, color: GRIS, align: 'right' })
  y += Math.max(58, 30 + datosCentro.slice(0, 3).length * 12) + 10

  // Estado y fecha
  const st = ESTADO[p.status] || { es: p.status, en: p.status, fg: GRIS, bg: FONDO }
  const pagadoEl = p.paid_at ? fmtFechaLarga(p.paid_at, lang) : null
  caja(M, y, ancho, 34, FONDO, false)
  const etiqueta = en ? st.en : st.es
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  const anchoPill = doc.getTextWidth(etiqueta) + 20
  doc.setFillColor(...st.bg); doc.roundedRect(M + 12, y + 8, anchoPill, 18, 9, 9, 'F')
  txt(etiqueta, M + 12 + anchoPill / 2, y + 20.5, { size: 9, bold: true, color: st.fg, align: 'center' })
  txt(pagadoEl ? `${L('Payment date', 'Fecha de pago')}: ${pagadoEl}` : `${L('Charge date', 'Fecha del cobro')}: ${emitido}`, W - M - 12, y + 21, { size: 9.5, align: 'right' })
  y += 52

  // Cliente
  seccion(L('Client', 'Cliente'))
  const mitad = (ancho - 12) / 2
  const tutorExtra = [d.tutor?.phone, d.tutor?.email].filter(Boolean).join(' · ')
  const altoCliente = tutorExtra ? 58 : 46
  caja(M, y, mitad, altoCliente); caja(M + mitad + 12, y, mitad, altoCliente)
  txt(L('Patient', 'Paciente'), M + 12, y + 16, { size: 8, color: GRIS })
  txt(d.pacienteNombre || '—', M + 12, y + 32, { size: 11, bold: true })
  txt(L('Guardian', 'Responsable / tutor'), M + mitad + 24, y + 16, { size: 8, color: GRIS })
  txt(d.tutor?.full_name || '—', M + mitad + 24, y + 32, { size: 11, bold: true })
  if (tutorExtra) txt(doc.splitTextToSize(tutorExtra, mitad - 24)[0], M + mitad + 24, y + 47, { size: 8.5, color: GRIS })
  y += altoCliente + 20

  // Detalle
  seccion(L('Detail', 'Detalle'))
  const colCant = M + ancho * 0.58, colUnit = M + ancho * 0.8, colImp = W - M - 12
  const concepto = doc.splitTextToSize(String(p.concept || '—'), ancho * 0.5) as string[]
  const altoFila = Math.max(30, 14 + concepto.length * 13)
  caja(M, y, ancho, 26 + altoFila)
  doc.setFillColor(...FONDO); doc.rect(M + 0.8, y + 0.8, ancho - 1.6, 25, 'F')
  txt(L('DESCRIPTION', 'DESCRIPCIÓN'), M + 12, y + 16, { size: 8, bold: true, color: GRIS })
  txt(L('QTY', 'CANT.'), colCant, y + 16, { size: 8, bold: true, color: GRIS, align: 'center' })
  txt(L('UNIT PRICE', 'P. UNIT.'), colUnit, y + 16, { size: 8, bold: true, color: GRIS, align: 'right' })
  txt(L('AMOUNT', 'IMPORTE'), colImp, y + 16, { size: 8, bold: true, color: GRIS, align: 'right' })
  const monto = dinero(Number(p.amount))
  concepto.forEach((l, i) => txt(l, M + 12, y + 44 + i * 13, { size: 10.5, bold: true }))
  txt('1', colCant, y + 44, { size: 10.5, align: 'center' })
  txt(monto, colUnit, y + 44, { size: 10.5, align: 'right' })
  txt(monto, colImp, y + 44, { size: 10.5, bold: true, align: 'right' })
  y += 26 + altoFila + 12

  // Sesión de la agenda vinculada y especialista a cargo
  if (d.sesion?.appointment_date || d.especialista) {
    const mitadS = (ancho - 12) / 2
    caja(M, y, mitadS, 46); caja(M + mitadS + 12, y, mitadS, 46)
    txt(L('Session date and time', 'Fecha y hora de la sesión'), M + 12, y + 16, { size: 8, color: GRIS })
    if (d.sesion?.appointment_date) {
      const f = new Date(d.sesion.appointment_date + 'T12:00:00')
      const dia = f.toLocaleDateString(en ? 'en-US' : 'es-PE', { weekday: 'long', timeZone: 'America/Lima' })
      const hora = String(d.sesion.appointment_time ?? '').slice(0, 5)
      const linea = `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${fmtFechaCorta(d.sesion.appointment_date + 'T12:00:00', lang)}${hora ? ` · ${hora}` : ''}`
      txt(doc.splitTextToSize(linea, mitadS - 24)[0], M + 12, y + 33, { size: 11, bold: true })
    } else txt(L('Not scheduled', 'Sin sesión agendada'), M + 12, y + 33, { size: 11, color: GRIS })
    txt(L('Specialist in charge', 'Especialista a cargo'), M + mitadS + 24, y + 16, { size: 8, color: GRIS })
    txt(doc.splitTextToSize(d.especialista || '—', mitadS - 24)[0], M + mitadS + 24, y + 33, { size: 11, bold: !!d.especialista, color: d.especialista ? TINTA : GRIS })
    y += 60
  }

  // Nota
  const nota = String(p.notes || '').trim()
  if (nota) {
    const lineas = doc.splitTextToSize(nota, ancho - 24) as string[]
    const alto = 26 + lineas.length * 12
    caja(M, y, ancho, alto, [240, 246, 255])
    txt(L('Note', 'Nota'), M + 12, y + 15, { size: 8, bold: true, color: AZUL })
    lineas.forEach((l, i) => txt(l, M + 12, y + 29 + i * 12, { size: 9.5 }))
    y += alto + 12
  }

  // Abonos (parcial)
  if (p.status === 'partial') {
    const abonos: Abono[] = Array.isArray(p.abonos) ? p.abonos : []
    const alto = 22 + abonos.length * 18 + 36
    caja(M, y, ancho, alto)
    txt(L('Payments on account', 'Pagos a cuenta'), M + 12, y + 15, { size: 8, bold: true, color: GRIS })
    abonos.forEach((a, i) => {
      const yy = y + 32 + i * 18
      txt(`${L('Payment', 'Abono')} ${i + 1} · ${fmtFechaCorta(a.fecha, lang)} · ${METODO[a.metodo] || a.metodo}`, M + 12, yy, { size: 9.5 })
      txt(dinero(Number(a.monto)), colImp, yy, { size: 9.5, align: 'right' })
    })
    const yb = y + 32 + abonos.length * 18
    txt(L('Paid so far', 'Pagado a la fecha'), M + 12, yb, { size: 9.5, bold: true, color: [4, 120, 87] })
    txt(dinero(cobradoDe(p as never)), colImp, yb, { size: 9.5, bold: true, color: [4, 120, 87], align: 'right' })
    txt(L('Balance due', 'Saldo pendiente'), M + 12, yb + 16, { size: 9.5, bold: true, color: [180, 83, 9] })
    txt(dinero(saldoDe(p as never)), colImp, yb + 16, { size: 9.5, bold: true, color: [180, 83, 9], align: 'right' })
    y += alto + 12
  }

  // Total
  const totalLbl: Record<string, string> = {
    paid: L('Total paid', 'Total pagado'), pending: L('Amount due', 'Total por pagar'), partial: L('Service total', 'Total del servicio'),
    cancelled: L('Total (cancelled)', 'Total (anulado)'), refunded: L('Total refunded', 'Total devuelto'),
  }
  caja(M, y, ancho, 58, [232, 242, 255])
  txt(totalLbl[p.status] || 'Total', M + 16, y + 34, { size: 10.5, color: GRIS })
  txt(monto, W - M - 16, y + 38, { size: 22, bold: true, color: p.status === 'cancelled' ? GRIS : TINTA, align: 'right' })
  y += 72

  // Método y fecha de pago
  caja(M, y, mitad, 46); caja(M + mitad + 12, y, mitad, 46)
  txt(L('Payment method', 'Método de pago'), M + 12, y + 16, { size: 8, color: GRIS })
  txt(METODO[p.payment_method ?? ''] || p.payment_method || '—', M + 12, y + 33, { size: 11, bold: true })
  txt(L('Payment date', 'Fecha de pago'), M + mitad + 24, y + 16, { size: 8, color: GRIS })
  txt(pagadoEl || L('Not paid yet', 'Aún no pagado'), M + mitad + 24, y + 33, { size: 11, bold: !!pagadoEl, color: pagadoEl ? TINTA : GRIS })
  y += 62

  // Aviso según estado
  const aviso: Record<string, string> = {
    paid: L(`Payment received. Thank you for trusting ${center.nombre}.`, `Pago recibido. Gracias por confiar en ${center.nombre}.`),
    pending: L('This charge is pending payment.', 'Este cobro está pendiente de pago.'),
    partial: L(`Down payment received. Balance due: ${dinero(saldoDe(p as never))}.`, `Adelanto recibido. Saldo pendiente: ${dinero(saldoDe(p as never))}.`),
    cancelled: L('This charge was cancelled and has no value.', 'Este cobro fue anulado y no tiene valor.'),
    refunded: L('This amount was refunded to the family.', 'Este monto fue devuelto a la familia.'),
  }
  if (aviso[p.status]) {
    caja(M, y, ancho, 30, st.bg, false)
    txt(aviso[p.status], M + 14, y + 19, { size: 9.5, bold: true, color: st.fg })
    y += 44
  }

  // Pie
  const H = doc.internal.pageSize.getHeight()
  doc.setDrawColor(...BORDE); doc.setLineWidth(0.8); doc.line(M, H - 70, W - M, H - 70)
  txt(center.nombre || 'Vanty ABA', M, H - 52, { size: 8.5, bold: true })
  txt(L('Internal payment receipt.', 'Recibo interno de pago.'), M, H - 40, { size: 8, color: GRIS })
  txt(`${L('Receipt', 'Recibo')} N.° ${d.reciboNum}`, W - M, H - 52, { size: 8, color: GRIS, align: 'right' })
  txt(L('Not valid as a SUNAT tax document', 'No válido como comprobante SUNAT'), W - M, H - 40, { size: 8, color: GRIS, align: 'right' })
  txt(creditoVanty(lang === 'en'), W / 2, H - 22, { size: 7.5, bold: true, color: [0, 99, 216], align: 'center' })

  return Buffer.from(doc.output('arraybuffer'))
}

// ── Recibo de un paquete de sesiones (un solo PDF con todas las sesiones) ─────
export type DatosPaquetePDF = {
  pagos: (PagoRecibo & { id?: string })[]
  center: DatosReciboPDF['center']
  pacienteNombre: string
  tutor: DatosReciboPDF['tutor']
  reciboNum: string
  lang: 'es' | 'en'
  symbol: string
  concepto: string
  especialista?: string | null
}

export async function generarReciboPaquetePDF(d: DatosPaquetePDF): Promise<Buffer> {
  const { pagos, center, lang, symbol } = d
  const en = lang === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const dinero = (n: number) => `${symbol} ${Number(n || 0).toLocaleString(en ? 'en-US' : 'es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const METODO: Record<string, string> = en
    ? { yape: 'Yape', plin: 'Plin', efectivo: 'Cash', transferencia: 'Bank transfer', tarjeta: 'Card', otro: 'Other' }
    : { yape: 'Yape', plin: 'Plin', efectivo: 'Efectivo', transferencia: 'Transferencia bancaria', tarjeta: 'Tarjeta', otro: 'Otro' }

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 48
  const ancho = W - M * 2
  let y = 0
  const txt = (s: string, x: number, yy: number, o: { size?: number; bold?: boolean; color?: [number, number, number]; align?: 'left' | 'right' | 'center' } = {}) => {
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(o.size ?? 10); doc.setTextColor(...(o.color ?? TINTA))
    doc.text(s, x, yy, { align: o.align ?? 'left' })
  }
  const caja = (x: number, yy: number, w: number, h: number, fill: [number, number, number] = [255, 255, 255], borde = true) => {
    doc.setFillColor(...fill); doc.setDrawColor(...BORDE); doc.setLineWidth(0.8)
    doc.roundedRect(x, yy, w, h, 8, 8, borde ? 'FD' : 'F')
  }
  const pie = () => {
    doc.setDrawColor(...BORDE); doc.setLineWidth(0.8); doc.line(M, H - 70, W - M, H - 70)
    txt(center.nombre || 'Vanty ABA', M, H - 52, { size: 8.5, bold: true })
    txt(L('Internal payment receipt.', 'Recibo interno de pago.'), M, H - 40, { size: 8, color: GRIS })
    txt(`${L('Receipt', 'Recibo')} N.° ${d.reciboNum}`, W - M, H - 52, { size: 8, color: GRIS, align: 'right' })
    txt(L('Not valid as a SUNAT tax document', 'No válido como comprobante SUNAT'), W - M, H - 40, { size: 8, color: GRIS, align: 'right' })
    txt(creditoVanty(d.lang === 'en'), W / 2, H - 22, { size: 7.5, bold: true, color: [0, 99, 216], align: 'center' })
  }
  const nuevaPagina = () => { pie(); doc.addPage(); doc.setFillColor(...AZUL); doc.rect(0, 0, W, 6, 'F'); y = 40 }

  // Fecha/hora de cada sesión: la de la agenda vinculada o, si no, la del cobro
  const sesionDe = (p: PagoRecibo) => {
    const a = p.appointments as { appointment_date?: string; appointment_time?: string | null } | null
    const iso = a?.appointment_date ? `${a.appointment_date}T12:00:00` : (p.fecha_cobro || p.created_at)
    const f = new Date(iso)
    const dia = f.toLocaleDateString(en ? 'en-US' : 'es-PE', { weekday: 'short', timeZone: 'America/Lima' }).replace('.', '')
    const hora = String(a?.appointment_time ?? '').slice(0, 5)
    return { iso, texto: `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${fmtFechaCorta(iso, lang)}${hora ? ` · ${hora}` : ''}` }
  }
  const ordenados = [...pagos].sort((a, b) => sesionDe(a).iso.localeCompare(sesionDe(b).iso))
  const vigentes = ordenados.filter(p => p.status !== 'cancelled' && p.status !== 'refunded')
  const total = vigentes.reduce((s, p) => s + Number(p.amount || 0), 0)
  const pagado = ordenados.reduce((s, p) => s + cobradoDe(p as never), 0)
  const pendiente = ordenados.reduce((s, p) => s + saldoDe(p as never), 0)
  const estadoGlobal = pendiente <= 0.001 ? 'paid' : pagado > 0 ? 'partial' : 'pending'

  // Franja y encabezado
  doc.setFillColor(...AZUL); doc.rect(0, 0, W, 6, 'F')
  y = 48
  const logo = await logoPng(center.logoUrl)
  let xNombre = M
  if (logo) { doc.addImage(logo, 'PNG', M, y - 8, 46, 46); xNombre = M + 58 }
  txt(center.nombre || 'Vanty ABA', xNombre, y + 6, { size: 15, bold: true })
  const datosCentro = [center.ruc ? `RUC ${center.ruc}` : '', center.direccion, center.telefono, center.email].filter(Boolean) as string[]
  datosCentro.slice(0, 3).forEach((l, i) => txt(l, xNombre, y + 21 + i * 12, { size: 8.5, color: GRIS }))
  txt(L('PACKAGE RECEIPT', 'RECIBO DE PAQUETE'), W - M, y - 2, { size: 8, bold: true, color: GRIS, align: 'right' })
  txt(`N.° ${d.reciboNum}`, W - M, y + 18, { size: 20, bold: true, color: AZUL, align: 'right' })
  txt(`${L('Issued', 'Emitido')} ${fmtFechaLarga(ordenados[0]?.created_at || new Date().toISOString(), lang)}`, W - M, y + 33, { size: 9, color: GRIS, align: 'right' })
  y += Math.max(58, 30 + datosCentro.slice(0, 3).length * 12) + 10

  // Resumen: estado + sesiones y rango de fechas
  const st = ESTADO[estadoGlobal]
  caja(M, y, ancho, 34, FONDO, false)
  const etiqueta = en ? st.en : st.es
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  const anchoPill = doc.getTextWidth(etiqueta) + 20
  doc.setFillColor(...st.bg); doc.roundedRect(M + 12, y + 8, anchoPill, 18, 9, 9, 'F')
  txt(etiqueta, M + 12 + anchoPill / 2, y + 20.5, { size: 9, bold: true, color: st.fg, align: 'center' })
  const primera = ordenados[0] ? fmtFechaCorta(sesionDe(ordenados[0]).iso, lang) : ''
  const ultima = ordenados.length > 1 ? fmtFechaCorta(sesionDe(ordenados[ordenados.length - 1]).iso, lang) : ''
  txt(`${ordenados.length} ${ordenados.length === 1 ? L('session', 'sesión') : L('sessions', 'sesiones')} · ${primera}${ultima ? ` – ${ultima}` : ''}`, W - M - 12, y + 21, { size: 9.5, align: 'right' })
  y += 52

  // Cliente + especialista
  txt(L('CLIENT', 'CLIENTE'), M, y, { size: 8, bold: true, color: GRIS }); y += 10
  const tercio = (ancho - 24) / 3
  const tarjeta = (i: number, etq: string, val: string) => {
    const x = M + i * (tercio + 12)
    caja(x, y, tercio, 46)
    txt(etq, x + 12, y + 16, { size: 8, color: GRIS })
    txt(doc.splitTextToSize(val || '—', tercio - 24)[0], x + 12, y + 33, { size: 10.5, bold: !!val, color: val ? TINTA : GRIS })
  }
  tarjeta(0, L('Patient', 'Paciente'), d.pacienteNombre)
  tarjeta(1, L('Guardian', 'Responsable / tutor'), d.tutor?.full_name || '')
  tarjeta(2, L('Specialist in charge', 'Especialista a cargo'), d.especialista || '')
  y += 62

  // Sesiones
  txt(`${L('SESSIONS', 'SESIONES')} · ${d.concepto.toUpperCase()}`, M, y, { size: 8, bold: true, color: GRIS }); y += 10
  const cSes = M + 12, cFecha = M + 90, cEst = M + ancho * 0.66, cImp = W - M - 12
  const cabecera = () => {
    doc.setFillColor(...FONDO); doc.setDrawColor(...BORDE); doc.roundedRect(M, y, ancho, 26, 6, 6, 'FD')
    txt(L('SESSION', 'SESIÓN'), cSes, y + 16, { size: 8, bold: true, color: GRIS })
    txt(L('DATE AND TIME', 'FECHA Y HORA'), cFecha, y + 16, { size: 8, bold: true, color: GRIS })
    txt(L('STATUS', 'ESTADO'), cEst, y + 16, { size: 8, bold: true, color: GRIS })
    txt(L('AMOUNT', 'IMPORTE'), cImp, y + 16, { size: 8, bold: true, color: GRIS, align: 'right' })
    y += 26
  }
  cabecera()
  ordenados.forEach((p, i) => {
    if (y > H - 130) { nuevaPagina(); cabecera() }
    const e = ESTADO[p.status] || { es: p.status, en: p.status, fg: GRIS, bg: FONDO }
    txt(`${i + 1}/${ordenados.length}`, cSes, y + 17, { size: 10, bold: true })
    txt(sesionDe(p).texto, cFecha, y + 17, { size: 10 })
    txt(en ? e.en : e.es, cEst, y + 17, { size: 9.5, bold: true, color: e.fg })
    const anulado = p.status === 'cancelled' || p.status === 'refunded'
    txt(dinero(Number(p.amount)), cImp, y + 17, { size: 10, bold: !anulado, color: anulado ? GRIS : TINTA, align: 'right' })
    doc.setDrawColor(...BORDE); doc.line(M + 8, y + 26, W - M - 8, y + 26)
    y += 26
  })
  y += 16

  // Totales
  if (y > H - 220) nuevaPagina()
  caja(M, y, ancho, 58, [232, 242, 255])
  txt(L('Package total', 'Total del paquete'), M + 16, y + 34, { size: 10.5, color: GRIS })
  txt(dinero(total), W - M - 16, y + 38, { size: 22, bold: true, align: 'right' })
  y += 70
  const mitad = (ancho - 12) / 2
  caja(M, y, mitad, 46); caja(M + mitad + 12, y, mitad, 46)
  txt(L('Paid', 'Pagado'), M + 12, y + 16, { size: 8, color: GRIS })
  txt(dinero(pagado), M + 12, y + 33, { size: 11, bold: true, color: [4, 120, 87] })
  txt(L('Pending', 'Pendiente'), M + mitad + 24, y + 16, { size: 8, color: GRIS })
  txt(dinero(pendiente), M + mitad + 24, y + 33, { size: 11, bold: true, color: pendiente > 0 ? [180, 83, 9] : GRIS })
  y += 58
  const metodos = [...new Set(ordenados.map(p => METODO[p.payment_method ?? ''] || p.payment_method).filter(Boolean))].join(', ')
  if (metodos) { txt(`${L('Payment method', 'Método de pago')}: ${metodos}`, M + 4, y + 6, { size: 9.5, color: GRIS }); y += 20 }
  caja(M, y, ancho, 30, st.bg, false)
  txt(estadoGlobal === 'paid'
    ? L(`Package paid in full. Thank you for trusting ${center.nombre}.`, `Paquete pagado en su totalidad. Gracias por confiar en ${center.nombre}.`)
    : L(`Balance due: ${dinero(pendiente)}.`, `Saldo pendiente: ${dinero(pendiente)}.`), M + 14, y + 19, { size: 9.5, bold: true, color: st.fg })

  pie()
  return Buffer.from(doc.output('arraybuffer'))
}
