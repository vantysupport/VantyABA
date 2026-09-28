// app/api/pagos/recibo-paquete/route.ts
// Genera un recibo PDF agrupando múltiples pagos (paquete de sesiones)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCentroMoneda } from '@/lib/centro-moneda'
import { getCentroBranding } from '@/lib/centro-branding'
import { getApiCaller, hasRole, ROLES, unauthorized } from '@/lib/api-auth'
import { esc, fmtFechaLarga, fmtFechaCorta, fmtDiaSemana, RECIBO_CSS, RECIBO_FONTS } from '@/lib/recibo-html'
import { cobradoDe, saldoDe } from '@/lib/pagos'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function fmtMoney(n: number, lang: string = 'es', symbol: string = 'S/') {
  return `${symbol}\u00a0${n.toLocaleString(lang === 'en' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function padNum(n: number) { return String(n).padStart(4, '0') }

// Center that owns the payments (multi-tenant: payments.centro_id, else the patient's)
async function getCenterInfo(centroId: string | null, childId: string | null) {
  const b = await getCentroBranding({ centroId, childId })
  return { nombre: b.name, ruc: b.ruc || '', direccion: b.direccion || '', telefono: b.telefono || '', email: b.email || '', logoUrl: b.logoUrl }
}

const iniciales = (nombre: string) =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '·'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ids     = searchParams.get('ids')?.split(',').filter(Boolean) || []
  const childId = searchParams.get('child_id')
  const month   = searchParams.get('month') // YYYY-M (optional, for month filter)
  const lang    = searchParams.get('lang') === 'en' ? 'en' : (req.headers.get('x-locale') === 'en' ? 'en' : 'es')
  const isEN    = lang === 'en'
  const L       = (en: string, es: string) => (isEN ? en : es)

  if (ids.length === 0 && !childId) {
    return NextResponse.json({ error: 'Falta ids o child_id' }, { status: 400 })
  }

  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  const isStaff = hasRole(caller, ROLES.staff)

  try {
    let query = supabase
      .from('payments')
      .select('*, children(id, name, parent_id, profiles:parent_id(full_name, email, phone)), appointments(appointment_date, appointment_time), especialista:especialista_id(full_name)')
      .order('paid_at', { ascending: true })
      .order('created_at', { ascending: true })

    if (ids.length > 0) {
      query = query.in('id', ids)
    } else if (childId) {
      query = query.eq('child_id', childId)
      if (month) {
        const [y, m] = month.split('-').map(Number)
        const start  = `${y}-${String(m).padStart(2,'0')}-01`
        const end    = new Date(y, m, 0)
        query = query.gte('created_at', start).lte('created_at', end.toISOString().split('T')[0] + 'T23:59:59')
      }
    }

    // Staff see their own center's payments; a parent only their own children's.
    if (isStaff) query = query.eq('centro_id', caller.centroId!)
    const { data: allPayments, error } = await query
    const payments = isStaff ? allPayments : (allPayments ?? []).filter(p => (p.children as { parent_id?: string } | null)?.parent_id === caller.id)
    if (error || !payments?.length) return NextResponse.json({ error: 'Sin pagos encontrados' }, { status: 404 })

    const child         = payments[0].children
    const center        = await getCenterInfo(payments[0].centro_id ?? null, payments[0].child_id ?? childId ?? null)
    const cur = await getCentroMoneda(payments[0].centro_id ?? null)
    const parentProfile = (child as any)?.profiles
    const paciente      = child?.name || payments[0].paciente_externo || '—'
    const externo       = !child?.name && !!payments[0].paciente_externo

    // Totales: solo lo pagado cuenta como cobrado; lo cancelado/devuelto no suma al paquete
    const vigentes  = payments.filter(p => p.status !== 'cancelled' && p.status !== 'refunded')
    const paid      = payments.filter(p => p.status === 'paid')
    const pending   = payments.filter(p => p.status === 'pending' || p.status === 'partial')
    const anulados  = payments.filter(p => p.status === 'cancelled' || p.status === 'refunded')
    const sum       = (a: any[]) => a.reduce((acc, p) => acc + Number(p.amount), 0)
    const total     = sum(vigentes)
    // Los parciales aportan su adelanto a lo pagado y su saldo a lo pendiente
    const totalPaid = payments.reduce((acc, p) => acc + cobradoDe(p), 0)
    const totalPend = payments.reduce((acc, p) => acc + saldoDe(p), 0)

    // Número correlativo por centro y año (antes era por paciente y se repetía entre niños)
    const year = new Date(payments[0].created_at).getFullYear()
    const { count } = await supabase.from('payments').select('*', { count: 'exact', head: true })
      .eq('centro_id', payments[0].centro_id)
      .gte('created_at', new Date(Date.UTC(year, 0, 1)).toISOString())
      .lte('created_at', payments[0].created_at)
    const reciboNum = `PKG-${year}-${padNum(count || 1)}`
    const logoUrl: string | null = center.logoUrl || null

    const STATUS: Record<string, { label: string; fg: string; bg: string }> = {
      paid:      { label: L('Paid', 'Pagado'),         fg: '#047857', bg: '#e7f8f0' },
      pending:   { label: L('Pending', 'Pendiente'),   fg: '#b45309', bg: '#fff5e0' },
      partial:   { label: L('Partial', 'Parcial'),     fg: '#0069db', bg: '#e8f2ff' },
      cancelled: { label: L('Cancelled', 'Cancelado'), fg: '#c81e1e', bg: '#fdecec' },
      refunded:  { label: L('Refunded', 'Devuelto'),   fg: '#475569', bg: '#eef2f6' },
    }
    const METHOD: Record<string, string> = isEN
      ? { yape: 'Yape', plin: 'Plin', efectivo: 'Cash', transferencia: 'Transfer', tarjeta: 'Card', otro: 'Other' }
      : { yape: 'Yape', plin: 'Plin', efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro' }
    const fechaDe = (p: any) => p.paid_at || p.fecha_cobro || p.created_at
    // Fecha y hora de la sesión agendada vinculada (si la hay); si no, la del cobro
    type FilaSesion = { paid_at?: string | null; fecha_cobro?: string | null; created_at: string; responsable?: string | null
      appointments?: { appointment_date?: string; appointment_time?: string | null } | null; especialista?: { full_name?: string } | null }
    const fechaSesion = (p: FilaSesion) => (p.appointments?.appointment_date ? `${p.appointments.appointment_date}T12:00:00` : (p.fecha_cobro || fechaDe(p)))
    const horaSesion = (p: FilaSesion) => String(p.appointments?.appointment_time ?? '').slice(0, 5)
    const filas = payments as FilaSesion[]
    const especialistaPkg: string = filas.find(x => x.especialista?.full_name)?.especialista?.full_name || ''
    const responsablePkg: string = filas.find(x => x.responsable)?.responsable || ''
    const firstDate = fechaDe(payments[0])
    const lastDate  = fechaDe(payments[payments.length - 1])
    const todoPagado = pending.length === 0 && paid.length > 0
    const concepto = String(payments[0].concept || '').replace(/\s*\(\d+\/\d+\)$/, '')

    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${L('Package receipt', 'Recibo de paquete')} ${esc(reciboNum)} · ${esc(center.nombre)}</title>
  ${RECIBO_FONTS}
  <style>${RECIBO_CSS}
    .ses{display:grid;grid-template-columns:54px 1fr 110px 96px 110px;gap:8px;padding:11px 16px;align-items:center;border-top:1px solid var(--border);font-size:13.5px}
    .ses.h{border-top:none;background:var(--fill);font-size:11px;font-weight:600;color:var(--subtle);text-transform:uppercase;letter-spacing:.8px}
    .ses .r{text-align:right;white-space:nowrap;font-weight:600}
    .dia{display:inline-block;min-width:40px;text-align:center;padding:2px 8px;border-radius:999px;background:#e8f2ff;color:var(--brand);font-size:11px;font-weight:700;text-transform:capitalize}
    .mini{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700}
    .mini i{width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block}
    .muted{color:var(--muted)}
    .sum{margin-top:18px;border:1px solid var(--border);border-radius:16px;overflow:hidden}
    .sum .l{display:flex;justify-content:space-between;align-items:center;padding:11px 20px;border-bottom:1px solid var(--border);font-size:13.5px}
    .sum .l b{font-weight:600}
    @media (max-width:560px){ .ses{grid-template-columns:48px 1fr 90px} .ses .hide{display:none} }
  </style>
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
          <p class="kind">${L('Package receipt', 'Recibo de paquete')}</p>
          <p class="num">N.° ${esc(reciboNum)}</p>
          <p class="em">${L('Issued', 'Emitido')} ${fmtFechaLarga(new Date().toISOString(), lang)}</p>
        </div>
      </div>

      <div class="bar">
        <span class="pill" style="background:#e8f2ff;color:#0069db"><i></i>${payments.length} ${payments.length === 1 ? L('session', 'sesión') : L('sessions', 'sesiones')} · ${fmtFechaCorta(firstDate, lang)}${payments.length > 1 ? ` — ${fmtFechaCorta(lastDate, lang)}` : ''}</span>
        <span class="d"><b>${paid.length}</b> ${L('paid', 'pagadas')} · <b>${pending.length}</b> ${L('pending', 'pendientes')}${anulados.length ? ` · <b>${anulados.length}</b> ${L('void', 'anuladas')}` : ''}</span>
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
            <p>${esc(parentProfile?.full_name || responsablePkg || '—')}</p>
            ${parentProfile?.phone || parentProfile?.email ? `<p class="m">${esc([parentProfile?.phone, parentProfile?.email].filter(Boolean).join(' · '))}</p>` : ''}
          </div>
        </div>

        <p class="sec">${L('Sessions', 'Sesiones')} · ${esc(concepto)}${especialistaPkg ? ` · ${L('Specialist', 'Especialista')}: ${esc(especialistaPkg)}` : ''}</p>
        <div class="items">
          <div class="ses h"><span>${L('Day', 'Día')}</span><span>${L('Date', 'Fecha')}</span><span class="hide">${L('Method', 'Método')}</span><span class="hide">${L('Status', 'Estado')}</span><span class="r">${L('Amount', 'Importe')}</span></div>
          ${payments.map(p => {
            const st = STATUS[p.status] || { label: p.status, fg: '#475569', bg: '#eef2f6' }
            const anulado = p.status === 'cancelled' || p.status === 'refunded'
            return `<div class="ses">
              <span><span class="dia">${fmtDiaSemana(fechaSesion(p), lang)}</span></span>
              <span>${fmtFechaCorta(fechaSesion(p), lang)}${horaSesion(p) ? ` · ${horaSesion(p)}` : ''}</span>
              <span class="hide muted">${esc(METHOD[p.payment_method] || p.payment_method || '—')}</span>
              <span class="hide"><span class="mini" style="background:${st.bg};color:${st.fg}"><i></i>${st.label}</span></span>
              <span class="r"${anulado ? ' style="text-decoration:line-through;color:#8a98ad"' : ''}>${fmtMoney(Number(p.amount), lang, cur.symbol)}</span>
            </div>`
          }).join('')}
        </div>

        <div class="sum">
          <div class="l"><span>${L('Paid sessions', 'Sesiones pagadas')} (${paid.length})</span><b style="color:#047857">${fmtMoney(totalPaid, lang, cur.symbol)}</b></div>
          ${pending.length ? `<div class="l"><span>${L('Pending sessions', 'Sesiones pendientes')} (${pending.length})</span><b style="color:#b45309">${fmtMoney(totalPend, lang, cur.symbol)}</b></div>` : ''}
          ${anulados.length ? `<div class="l"><span>${L('Cancelled / refunded', 'Anuladas / devueltas')} (${anulados.length})</span><b style="color:#8a98ad;text-decoration:line-through">${fmtMoney(sum(anulados), lang, cur.symbol)}</b></div>` : ''}
        </div>

        <div class="total">
          <span class="lbl">${L('Package total', 'Total del paquete')}</span>
          <span class="val">${fmtMoney(total, lang, cur.symbol)}</span>
        </div>

        ${todoPagado
          ? `<div class="ok"><b>✓</b><span>${L('Package fully paid. Thank you for trusting', 'Paquete pagado por completo. Gracias por confiar en')} ${esc(center.nombre)}.</span></div>`
          : pending.length ? `<div class="ok" style="background:#fff5e0;color:#b45309"><b style="background:#b45309">!</b><span>${L('Balance due', 'Saldo por pagar')}: ${fmtMoney(totalPend, lang, cur.symbol)}</span></div>` : ''}
      </div>

      <div class="foot">
        <div><b>${esc(center.nombre)}</b><br/>${L('Internal payment receipt.', 'Recibo interno de pago.')}</div>
        <div class="r">${L('Receipt', 'Recibo')} N.° ${esc(reciboNum)}<br/>${L('Not valid as a SUNAT tax document', 'No válido como comprobante SUNAT')}</div>
      </div>
    </div>

    <div class="actions">
      <button class="btn p" onclick="window.print()">${L('Print / Save PDF', 'Imprimir / Guardar PDF')}</button>
      <button class="btn g" onclick="window.close()">${L('Close', 'Cerrar')}</button>
    </div>
  </div>
</body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }
    })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
