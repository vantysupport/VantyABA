// app/api/pagos/recibo-pdf/route.ts
// Genera un recibo de pago en PDF profesional usando jsPDF

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCentroMoneda } from '@/lib/centro-moneda'
import { getCentroBranding } from '@/lib/centro-branding'
import { getApiCaller, hasRole, ROLES, unauthorized } from '@/lib/api-auth'
import { esc, fmtFechaLarga, fmtFechaCorta, RECIBO_CSS, RECIBO_FONTS } from '@/lib/recibo-html'
import { cobradoDe, saldoDe, type Abono } from '@/lib/pagos'
import { sendEmail } from '@/lib/email'
import { emailLayout, escHtml } from '@/lib/email-layout'
import { generarReciboPDF, type PagoRecibo } from '@/lib/recibo-pdf'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Helpers ───────────────────────────────────────────────────────────────────
function padRecibo(n: number) { return String(n).padStart(4, '0') }

function fmtCurrency(n: number, lang: string = 'es', symbol: string = 'S/') {
  return `${symbol}\u00a0${n.toLocaleString(lang === 'en' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Center that owns the payment (multi-tenant: payments.centro_id, else the patient's) ───
async function getCenterInfo(centroId: string | null, childId: string | null) {
  const b = await getCentroBranding({ centroId, childId })
  return {
    nombre:    b.name,
    ruc:       b.ruc || '',
    direccion: b.direccion || '',
    telefono:  b.telefono || '',
    email:     b.email || '',
    logoUrl:   b.logoUrl,
  }
}

const iniciales = (nombre: string) =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '·'

// ── Recibo en HTML (el navegador lo imprime / guarda como PDF) ────────────────
function generateReceiptHTML(payment: any, center: any, child: any, parentProfile: any, reciboNum: string, lang: string = 'es', symbol: string = 'S/', paraCorreo = false) {
  const isEN = lang === 'en'
  const L = (en: string, es: string) => (isEN ? en : es)
  const STATUS: Record<string, { es: string; en: string; fg: string; bg: string }> = {
    paid:      { es: 'Pagado',    en: 'Paid',      fg: '#047857', bg: '#e7f8f0' },
    pending:   { es: 'Pendiente', en: 'Pending',   fg: '#b45309', bg: '#fff5e0' },
    partial:   { es: 'Parcial',   en: 'Partial',   fg: '#0069db', bg: '#e8f2ff' },
    cancelled: { es: 'Cancelado', en: 'Cancelled', fg: '#c81e1e', bg: '#fdecec' },
    refunded:  { es: 'Devuelto',  en: 'Refunded',  fg: '#475569', bg: '#eef2f6' },
  }
  const st = STATUS[payment.status] || { es: payment.status, en: payment.status, fg: '#475569', bg: '#eef2f6' }
  const isPaid   = payment.status === 'paid'
  // Solo hay fecha de pago si realmente se pagó; un pendiente no debe parecer cobrado
  const paidDate = payment.paid_at ? fmtFechaLarga(payment.paid_at, lang) : null
  const sinFecha = L('Not paid yet', 'Aún no pagado')
  const totalLbl: Record<string, string> = {
    paid: L('Total paid', 'Total pagado'), pending: L('Amount due', 'Total por pagar'), partial: L('Service total', 'Total del servicio'),
    cancelled: L('Total (cancelled)', 'Total (anulado)'), refunded: L('Total refunded', 'Total devuelto'),
  }
  const aviso: Record<string, string> = {
    pending: L('This charge is pending payment.', 'Este cobro está pendiente de pago.'),
    partial: L(`Down payment received. Balance due: ${fmtCurrency(saldoDe(payment), lang, symbol)}.`, `Adelanto recibido. Saldo pendiente: ${fmtCurrency(saldoDe(payment), lang, symbol)}.`),
    cancelled: L('This charge was cancelled and has no value.', 'Este cobro fue anulado y no tiene valor.'),
    refunded: L('This amount was refunded to the family.', 'Este monto fue devuelto a la familia.'),
  }
  // Fecha elegida al registrar el cobro (antes solo existía la de registro en el sistema)
  const emitDate = fmtFechaLarga(payment.fecha_cobro || payment.created_at, lang)
  const METHOD: Record<string, string> = isEN
    ? { yape: 'Yape', plin: 'Plin', efectivo: 'Cash', transferencia: 'Bank transfer', tarjeta: 'Card', otro: 'Other' }
    : { yape: 'Yape', plin: 'Plin', efectivo: 'Efectivo', transferencia: 'Transferencia bancaria', tarjeta: 'Tarjeta', otro: 'Otro' }
  const paciente = child?.name || payment.paciente_externo || '—'
  const externo  = !child?.name && !!payment.paciente_externo
  const monto    = fmtCurrency(Number(payment.amount), lang, symbol)
  const nota     = String(payment.notes || '').trim()
  const abonos: Abono[] = Array.isArray(payment.abonos) ? payment.abonos : []
  const esParcial = payment.status === 'partial'
  const logoUrl: string | null = center.logoUrl || null

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${L('Receipt', 'Recibo')} ${esc(reciboNum)} · ${esc(center.nombre)}</title>
  ${RECIBO_FONTS}
  <style>${RECIBO_CSS}</style>
</head>
<body>
  <div class="wrap">
    <div class="doc">
      <div class="top">
        <div class="company">
          <div class="logo">${logoUrl ? `<img src="${esc(logoUrl)}" alt="" onerror="this.remove()"/>` : `<span>${esc(iniciales(center.nombre))}</span>`}</div>
          <div style="min-width:0">
            <h1>${esc(center.nombre)}</h1>
            <p class="sub">${L('Therapy center', 'Centro de terapias')}</p>
            <div class="meta">
              ${center.ruc ? `<span>RUC <b>${esc(center.ruc)}</b></span>` : ''}
              ${center.telefono ? `<span>${esc(center.telefono)}</span>` : ''}
              ${center.email ? `<span>${esc(center.email)}</span>` : ''}
              ${center.direccion ? `<span>${esc(center.direccion)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="rinfo">
          <p class="kind">${L('Payment receipt', 'Recibo de pago')}</p>
          <p class="num">N.° ${esc(reciboNum)}</p>
          <p class="em">${L('Issued', 'Emitido')} ${emitDate}</p>
        </div>
      </div>

      <div class="bar">
        <span class="pill" style="background:${st.bg};color:${st.fg}"><i></i>${isEN ? st.en : st.es}</span>
        <span class="d">${paidDate ? `${L('Payment date', 'Fecha de pago')}: <b>${paidDate}</b>` : `${L('Charge date', 'Fecha del cobro')}: <b>${emitDate}</b>`}</span>
      </div>

      <div class="body">
        <p class="sec">${L('Client', 'Cliente')}</p>
        <div class="grid">
          <div class="card">
            <label>${L('Patient', 'Paciente')}</label>
            <p>${esc(paciente)}${externo ? `<span class="tag">${L('not enrolled', 'sin inscribir')}</span>` : ''}</p>
          </div>
          <div class="card">
            <label>${L('Guardian', 'Responsable / tutor')}</label>
            <p>${esc(parentProfile?.full_name || '—')}</p>
            ${parentProfile?.phone || parentProfile?.email ? `<p class="m">${esc([parentProfile?.phone, parentProfile?.email].filter(Boolean).join(' · '))}</p>` : ''}
          </div>
        </div>

        <p class="sec">${L('Detail', 'Detalle')}</p>
        <div class="items">
          <div class="row h"><span>${L('Description', 'Descripción')}</span><span class="c hide">${L('Qty', 'Cant.')}</span><span class="r hide">${L('Unit price', 'P. unit.')}</span><span class="r">${L('Amount', 'Importe')}</span></div>
          <div class="row b"><span class="concept">${esc(payment.concept || '—')}</span><span class="c hide">1</span><span class="r hide">${monto}</span><span class="r">${monto}</span></div>
        </div>

        ${nota ? `
        <div class="note">
          <span class="ic">✎</span>
          <div style="min-width:0"><label>${L('Note', 'Nota')}</label><p>${esc(nota)}</p></div>
        </div>` : ''}

        ${esParcial ? `
        <div class="items" style="margin-top:18px">
          <div class="row h" style="grid-template-columns:1fr auto"><span>${L('Payments on account', 'Pagos a cuenta')}</span><span class="r">${L('Amount', 'Importe')}</span></div>
          ${abonos.map((a, i) => `<div class="row b" style="grid-template-columns:1fr auto;font-size:13px"><span>${L('Payment', 'Abono')} ${i + 1} · ${fmtFechaCorta(a.fecha, lang)} · <span style="color:var(--muted)">${esc(METHOD[a.metodo] || a.metodo)}</span></span><span class="r">${fmtCurrency(Number(a.monto), lang, symbol)}</span></div>`).join('')}
          <div class="row b" style="grid-template-columns:1fr auto;background:#e7f8f0"><span style="font-weight:600;color:#047857">${L('Paid so far', 'Pagado a la fecha')}</span><span class="r" style="color:#047857">${fmtCurrency(cobradoDe(payment), lang, symbol)}</span></div>
          <div class="row b" style="grid-template-columns:1fr auto;background:#fff5e0"><span style="font-weight:600;color:#b45309">${L('Balance due', 'Saldo pendiente')}</span><span class="r" style="color:#b45309">${fmtCurrency(saldoDe(payment), lang, symbol)}</span></div>
        </div>` : ''}

        <div class="total">
          <span class="lbl">${totalLbl[payment.status] || L('Total', 'Total')}</span>
          <span class="val"${payment.status === 'cancelled' ? ' style="text-decoration:line-through;color:#8a98ad"' : ''}>${monto}</span>
        </div>

        <div class="pay">
          <div class="card"><label>${L('Payment method', 'Método de pago')}</label><p>${esc(METHOD[payment.payment_method] || payment.payment_method || '—')}</p></div>
          <div class="card"><label>${L('Payment date', 'Fecha de pago')}</label><p${paidDate ? '' : ' style="color:#8a98ad;font-weight:500"'}>${paidDate || sinFecha}</p></div>
        </div>

        ${!isPaid && aviso[payment.status] ? `<div class="ok" style="background:${st.bg};color:${st.fg}"><b style="background:${st.fg}">!</b><span>${aviso[payment.status]}</span></div>` : ''}
        ${isPaid ? `<div class="ok"><b>✓</b><span>${L('Payment received. Thank you for trusting', 'Pago recibido. Gracias por confiar en')} ${esc(center.nombre)}.</span></div>` : ''}
      </div>

      <div class="foot">
        <div><b>${esc(center.nombre)}</b><br/>${L('Internal payment receipt.', 'Recibo interno de pago.')}</div>
        <div class="r">${L('Receipt', 'Recibo')} N.° ${esc(reciboNum)}<br/>${L('Not valid as a SUNAT tax document', 'No válido como comprobante SUNAT')}</div>
      </div>
    </div>

    ${paraCorreo ? '' : `<div class="actions">
      <button class="btn p" onclick="window.print()">${L('Print / Save PDF', 'Imprimir / Guardar PDF')}</button>
      <button class="btn g" onclick="window.close()">${L('Close', 'Cerrar')}</button>
    </div>`}
  </div>
</body>
</html>`
}


// ── Armar el recibo (compartido por ver/imprimir y enviar por correo) ────────
type Tutor = { full_name?: string | null; email?: string | null; phone?: string | null }
type Armado = { error: NextResponse } | { html: string; reciboNum: string; center: Awaited<ReturnType<typeof getCenterInfo>>; parentProfile: Tutor | null; payment: PagoRecibo; symbol: string }

async function armarRecibo(req: NextRequest, paymentId: string, lang: string, paraCorreo: boolean, soloStaff: boolean): Promise<Armado> {
  const caller = await getApiCaller(req)
  if (!caller) return { error: unauthorized() }

  // 1. Pago con paciente y familia
  const { data: payment, error } = await supabase
    .from('payments')
    .select(`
      *,
      children (
        id, name, parent_id,
        profiles:parent_id ( full_name, email, phone )
      ),
      appointments ( appointment_date, appointment_time, status )
    `)
    .eq('id', paymentId)
    .single()

  // Same 404 for "not yours" so payment ids can't be probed across centers.
  const ownsAsStaff = hasRole(caller, ROLES.staff) && payment?.centro_id === caller.centroId
  const ownsAsParent = !soloStaff && (payment?.children as { parent_id?: string } | null)?.parent_id === caller.id
  if (error || !payment || !(ownsAsStaff || ownsAsParent)) {
    return { error: NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 }) }
  }

  // 2. Número de recibo correlativo por centro y año (antes era por paciente: se repetían entre niños
  //    y fallaba con pacientes sin inscribir, que no tienen child_id)
  const year = new Date(payment.created_at).getFullYear()
  const { count } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('centro_id', payment.centro_id)
    .gte('created_at', new Date(Date.UTC(year, 0, 1)).toISOString())
    .lte('created_at', payment.created_at)
  const reciboNum = `${year}-${padRecibo(count || 1)}`

  // 3. Centro, moneda, paciente y familia
  const center = await getCenterInfo(payment.centro_id ?? null, payment.child_id ?? null)
  const cur = await getCentroMoneda(payment.centro_id ?? null)
  const child         = payment.children
  const parentProfile = (child as any)?.profiles

  const html = generateReceiptHTML(payment, center, child, parentProfile, reciboNum, lang, cur.symbol, paraCorreo)
  return { html, reciboNum, center, parentProfile: parentProfile ?? null, payment, symbol: cur.symbol }
}

const langDe = (req: NextRequest, v: unknown) => (v === 'en' ? 'en' : (req.headers.get('x-locale') === 'en' ? 'en' : 'es'))

// ── GET: ver / imprimir el recibo ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const paymentId = searchParams.get('id')
  if (!paymentId) return NextResponse.json({ error: 'Falta el ID del pago' }, { status: 400 })
  try {
    const r = await armarRecibo(req, paymentId, langDe(req, searchParams.get('lang')), false, false)
    if ('error' in r) return r.error
    return new NextResponse(r.html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } })
  } catch (e: any) {
    console.error('Error generando recibo:', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

// ── POST: enviar el recibo por correo (solo equipo del centro) ────────────────
// body: { id, email?, lang? } — sin email se envía al correo de la familia del paciente.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { id?: string; email?: string; lang?: string }
  const paymentId = typeof body.id === 'string' ? body.id : ''
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) return NextResponse.json({ error: 'Falta el ID del pago' }, { status: 400 })
  const lang = langDe(req, body.lang)
  try {
    const r = await armarRecibo(req, paymentId, lang, true, true)
    if ('error' in r) return r.error
    const destino = String(body.email || r.parentProfile?.email || '').trim().toLowerCase()
    if (!EMAIL_RE.test(destino)) return NextResponse.json({ error: 'sin_correo' }, { status: 400 })
    const en = lang === 'en'
    const L = (e: string, s: string) => (en ? e : s)
    const p = r.payment
    const paciente = String((p.children as { name?: string } | null)?.name || p.paciente_externo || '—')
    const sesion = (p.appointments as { appointment_date: string; appointment_time: string | null } | null) ?? null
    const pdf = await generarReciboPDF({ payment: p, center: r.center, pacienteNombre: paciente, tutor: r.parentProfile, reciboNum: r.reciboNum, lang, symbol: r.symbol, sesion })

    const ESTADO: Record<string, [string, string]> = { paid: ['Paid', 'Pagado'], pending: ['Pending', 'Pendiente'], partial: ['Partially paid', 'Pago parcial'], cancelled: ['Cancelled', 'Anulado'], refunded: ['Refunded', 'Devuelto'] }
    const est = ESTADO[p.status] ?? [p.status, p.status]
    const monto = fmtCurrency(Number(p.amount), lang, r.symbol)
    const saludo = r.parentProfile?.full_name && !body.email ? L(`Hi ${r.parentProfile.full_name.split(' ')[0]},`, `Hola, ${r.parentProfile.full_name.split(' ')[0]}:`) : L('Hello,', 'Hola:')
    const asunto = L(`Your receipt N.° ${r.reciboNum} from ${r.center.nombre}`, `Tu recibo N.° ${r.reciboNum} de ${r.center.nombre}`)
    const html = emailLayout({
      locale: en ? 'en' : 'es', subject: asunto, eyebrow: r.center.nombre,
      preheader: L(`Your payment receipt is attached (${monto}).`, `Te enviamos tu recibo de pago (${monto}).`),
      title: L('Your receipt is here', 'Tu recibo está aquí'),
      intro: `${escHtml(saludo)} ${L(`we're sending you the payment receipt from <b>${escHtml(r.center.nombre)}</b>. You'll find it attached as a PDF.`, `te enviamos el recibo de pago de <b>${escHtml(r.center.nombre)}</b>. Lo encontrarás adjunto en PDF.`)}`,
      detalles: [
        { label: L('Receipt', 'Recibo'), value: `N.° ${escHtml(r.reciboNum)}` },
        { label: L('Patient', 'Paciente'), value: escHtml(paciente) },
        { label: L('Concept', 'Concepto'), value: escHtml(String(p.concept || '—')) },
        { label: L('Amount', 'Monto'), value: escHtml(monto) },
        { label: L('Status', 'Estado'), value: escHtml(en ? est[0] : est[1]) },
      ],
      aria: p.status === 'paid' ? 'celebra' : 'laptop',
      note: L('Internal payment receipt, not valid as a SUNAT tax document. If you have any questions, please contact the center.',
        'Recibo interno de pago, no válido como comprobante SUNAT. Si tienes alguna duda, comunícate con el centro.'),
    })
    const ok = await sendEmail(destino, asunto, html, r.center.nombre || 'Vanty ABA', [
      { filename: `${L('Receipt', 'Recibo')}-${r.reciboNum}.pdf`, content: pdf, contentType: 'application/pdf' },
    ])
    if (!ok) return NextResponse.json({ error: 'envio_fallido' }, { status: 502 })
    return NextResponse.json({ ok: true, email: destino })
  } catch (e) {
    console.error('Error enviando recibo:', e)
    return NextResponse.json({ error: 'envio_fallido' }, { status: 500 })
  }
}
