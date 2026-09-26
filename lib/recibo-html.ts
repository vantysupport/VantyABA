// lib/recibo-html.ts
// Estilos y utilidades compartidas por los recibos (pago único y paquete), con la identidad visual de Vanty.

/** Escapa texto escrito por usuarios (concepto, nota, nombres) antes de insertarlo en HTML */
export const esc = (v: unknown) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Los pagos antiguos guardaban solo la fecha como medianoche UTC: esos se leen en UTC para no mostrar el día anterior.
function tzDe(d: Date) {
  const soloFecha = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
  return soloFecha ? 'UTC' : 'America/Lima'
}

/** "23 de setiembre de 2026" en hora de Perú */
export function fmtFechaLarga(iso: string, lang: string = 'es') {
  const d = new Date(iso)
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-PE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: tzDe(d) })
}

/** "23 set. 2026" en hora de Perú */
export function fmtFechaCorta(iso: string, lang: string = 'es') {
  const d = new Date(iso)
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-PE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: tzDe(d) })
}

/** Día de la semana abreviado ("mar.") en hora de Perú */
export function fmtDiaSemana(iso: string, lang: string = 'es') {
  const d = new Date(iso)
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-PE', { weekday: 'short', timeZone: tzDe(d) }).replace('.', '')
}

export const RECIBO_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap" rel="stylesheet"/>`

export const RECIBO_CSS = `
    *{margin:0;padding:0;box-sizing:border-box}
    :root{--brand:#0069db;--brand2:#01abfc;--text:#0f1b2d;--muted:#56657d;--subtle:#8a98ad;--border:#e6ebf2;--fill:#f4f7fb}
    body{font-family:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif;background:#eef3f9;color:var(--text);min-height:100vh;padding:32px 16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .wrap{max-width:720px;margin:0 auto}
    .doc{background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 2px 6px rgba(0,45,110,.05),0 24px 64px rgba(0,45,110,.12);position:relative}
    .doc::before{content:'';position:absolute;inset:0 0 auto 0;height:4px;background:linear-gradient(90deg,var(--brand),var(--brand2))}
    h1,.num,.total .val{font-family:'Poppins','Plus Jakarta Sans',sans-serif}

    .top{padding:30px 36px 24px;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;align-items:flex-start}
    .company{display:flex;gap:14px;min-width:0;flex:1 1 280px}
    .logo{width:56px;height:56px;flex-shrink:0;border-radius:30%;background:#fff;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 1px 3px rgba(0,45,110,.08)}
    .logo img{width:100%;height:100%;object-fit:contain;padding:4px}
    .logo span{font-weight:700;color:var(--brand);font-size:18px}
    h1{font-size:18px;font-weight:700;letter-spacing:-.3px;line-height:1.25}
    .company .sub{font-size:12px;color:var(--muted);margin-top:2px}
    .meta{margin-top:8px;display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11.5px;color:var(--muted)}
    .meta b{color:var(--text);font-weight:600}
    .rinfo{text-align:right;flex-shrink:0}
    .rinfo .kind{font-size:11px;font-weight:600;color:var(--subtle);text-transform:uppercase;letter-spacing:1.4px}
    .num{font-size:28px;font-weight:700;letter-spacing:-.5px;line-height:1.15;margin-top:2px;background:linear-gradient(90deg,var(--brand),var(--brand2));-webkit-background-clip:text;background-clip:text;color:transparent}
    .rinfo .em{font-size:12px;color:var(--muted);margin-top:4px}

    .bar{margin:0 36px;padding:12px 16px;border-radius:14px;background:var(--fill);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
    .pill{display:inline-flex;align-items:center;gap:7px;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:700}
    .pill i{width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block}
    .bar .d{font-size:12.5px;color:var(--muted)} .bar .d b{color:var(--text);font-weight:600}

    .body{padding:26px 36px 30px}
    .sec{font-size:11px;font-weight:600;color:var(--subtle);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:26px}
    .card{border:1px solid var(--border);border-radius:14px;padding:12px 14px}
    .card label{display:block;font-size:11px;color:var(--subtle);margin-bottom:3px}
    .card p{font-size:14px;font-weight:600;overflow-wrap:anywhere}
    .card p.m{font-weight:400;color:var(--muted);font-size:12.5px;margin-top:2px}
    .tag{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;background:var(--fill);color:var(--muted);font-size:10.5px;font-weight:600;vertical-align:middle}

    .items{border:1px solid var(--border);border-radius:14px;overflow:hidden}
    .row{display:grid;grid-template-columns:1fr 60px 120px 120px;gap:8px;padding:12px 16px;align-items:center}
    .row.h{background:var(--fill);font-size:11px;font-weight:600;color:var(--subtle);text-transform:uppercase;letter-spacing:.8px}
    .row .c{text-align:center} .row .r{text-align:right;white-space:nowrap}
    .row.b{font-size:14px} .row.b .concept{font-weight:600;overflow-wrap:anywhere}
    .row.b .r{font-weight:600}

    .note{margin-top:14px;border-radius:14px;background:#f2f7ff;border:1px solid #d9e8fd;padding:12px 16px;display:flex;gap:12px}
    .note .ic{width:28px;height:28px;border-radius:30%;background:#fff;color:var(--brand);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:700;font-size:14px}
    .note label{display:block;font-size:11px;font-weight:600;color:var(--brand);margin-bottom:2px}
    .note p{font-size:13.5px;color:var(--text);line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}

    .total{margin-top:18px;border-radius:16px;padding:18px 22px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;background:linear-gradient(135deg,#f2f8ff,#eaf6ff);border:1px solid #d9e8fd}
    .total .lbl{font-size:13px;font-weight:600;color:var(--muted)}
    .total .val{font-size:32px;font-weight:700;letter-spacing:-.5px;color:var(--text);white-space:nowrap}

    .pay{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}
    .ok{margin-top:18px;border-radius:14px;background:#e7f8f0;color:#047857;padding:12px 16px;font-size:13px;font-weight:500;display:flex;gap:10px;align-items:center}
    .ok b{width:22px;height:22px;border-radius:50%;background:#047857;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}

    .foot{border-top:1px solid var(--border);background:var(--fill);padding:16px 36px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:11.5px;color:var(--muted);line-height:1.7}
    .foot b{color:var(--text);font-weight:600}
    .foot .r{text-align:right;color:var(--subtle)}

    .actions{margin-top:18px;display:flex;gap:10px;justify-content:center}
    .btn{border:none;cursor:pointer;font-family:inherit;font-size:14px;font-weight:600;border-radius:999px;padding:12px 26px}
    .btn.p{color:#fff;background:linear-gradient(90deg,var(--brand),var(--brand2));box-shadow:0 8px 20px rgba(0,105,219,.25)}
    .btn.g{background:#fff;color:var(--muted);border:1px solid var(--border)}

    @media (max-width:560px){
      body{padding:12px 8px}
      .top,.body{padding-left:20px;padding-right:20px} .bar{margin:0 20px} .foot{padding:14px 20px}
      .rinfo{text-align:left} .grid,.pay{grid-template-columns:1fr}
      .row{grid-template-columns:1fr 90px} .row .hide{display:none}
      .total .val{font-size:26px}
    }
    @media print{
      body{background:#fff;padding:0}
      .doc{box-shadow:none;border-radius:0}
      .actions{display:none}
    }
`
