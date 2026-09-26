// Plantilla única de correos de Vanty ABA: tablas + estilos en línea (Gmail, Outlook, Apple Mail),
// 640 px de ancho, cabecera con la marca, hero con ARIA y pie común. Los textos llegan ya escapados.

const ASSETS = 'https://ylcnfqkhivqwjeifuhbl.supabase.co/storage/v1/object/public/public-images/brand'
const BRAND = 'Vanty ABA'

// Poses de ARIA (PNG con transparencia, 320 px de alto) para cada tipo de correo
export type PoseAria = 'saludo' | 'celebra' | 'laptop' | 'cita' | 'pensando'

export const escHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export type EmailLayout = {
  locale: 'es' | 'en'
  /** <title> y texto de vista previa en la bandeja */
  subject: string
  preheader?: string
  /** Línea pequeña sobre el título (normalmente el nombre del centro) */
  eyebrow?: string
  title: string
  intro: string
  /** Filas etiqueta / valor en una tarjeta (citas, reservas, etc.) */
  detalles?: { label: string; value: string }[]
  /** HTML extra debajo de los detalles */
  extra?: string
  cta?: { href: string; label: string }
  note?: string
  /** Mostrar el enlace del botón en texto plano por si el botón no funciona */
  enlaceAlterno?: boolean
  aria?: PoseAria
  /** Frase breve de ARIA en el globo junto a su imagen */
  ariaDice?: string
  tono?: 'normal' | 'alerta'
}

export function emailLayout(o: EmailLayout): string {
  const en = o.locale === 'en'
  const pose = o.aria ?? 'saludo'
  const acento = o.tono === 'alerta' ? '#d92d20' : '#0069db'
  const degradado = o.tono === 'alerta'
    ? 'background:#d92d20;background-image:linear-gradient(135deg,#f97066 0%,#d92d20 100%);'
    : 'background:#0069db;background-image:linear-gradient(135deg,#01abfc 0%,#0063d8 100%);'
  const tagline = en ? 'Clinical management for therapy centers' : 'Gestión clínica para centros de terapia'
  const automatico = en ? 'This is an automated message, please do not reply.' : 'Este es un mensaje automático, por favor no respondas.'
  const alterno = en ? "If the button doesn't work, copy this link into your browser:" : 'Si el botón no funciona, copia este enlace en tu navegador:'
  const href = o.cta ? escHtml(o.cta.href) : ''

  const detalles = o.detalles?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 24px;background:#f5f9ff;border:1px solid #e1ecfa;border-radius:16px;">
${o.detalles.map((d, i) => `<tr><td class="det-l" style="padding:12px 18px;${i ? 'border-top:1px solid #e1ecfa;' : ''}font-size:13px;color:#6b7c96;width:38%;vertical-align:top;">${d.label}</td>
<td class="det-v" style="padding:12px 18px;${i ? 'border-top:1px solid #e1ecfa;' : ''}font-size:14px;color:#0b1b33;font-weight:600;vertical-align:top;">${d.value}</td></tr>`).join('\n')}
</table>`
    : ''

  const boton = o.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 8px;"><tr><td style="border-radius:999px;${degradado}box-shadow:0 6px 18px rgba(0,99,216,0.28);">
<a href="${href}" target="_blank" style="display:inline-block;padding:15px 34px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${o.cta.label} &rarr;</a>
</td></tr></table>`
    : ''

  const globo = o.ariaDice
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 0 auto;"><tr><td style="background:#ffffff;border-radius:16px 16px 4px 16px;padding:10px 14px;font-size:13px;line-height:1.4;color:#0b1b33;font-weight:600;box-shadow:0 4px 14px rgba(0,40,100,0.18);">${o.ariaDice}</td></tr></table>`
    : ''

  return `<!DOCTYPE html><html lang="${o.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escHtml(o.subject)}</title>
<style>
@media (max-width:620px){
  .wrap{padding:16px 8px !important}
  .px{padding-left:22px !important;padding-right:22px !important}
  .hero-t{font-size:24px !important}
  .aria-col{width:112px !important}
  .aria-img{width:104px !important;height:auto !important}
  .globo{display:none !important}
  .det-l,.det-v{display:block !important;width:auto !important}
  .det-v{border-top:0 !important;padding-top:0 !important}
}
</style></head>
<body style="margin:0;padding:0;background:#eef4fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0b1b33;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escHtml(o.preheader ?? o.title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4fb;"><tr><td align="center" class="wrap" style="padding:36px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">

<!-- Marca -->
<tr><td style="padding:0 6px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;"><img src="${ASSETS}/vanty-logo-256.png" width="34" height="34" alt="${BRAND}" style="display:block;border:0;border-radius:9px;"></td>
<td style="vertical-align:middle;padding-left:10px;font-size:17px;font-weight:700;letter-spacing:-0.2px;color:#0b1b33;">Vanty <span style="font-weight:500;letter-spacing:1px;color:#0069db;">ABA</span></td>
</tr></table></td>
${o.eyebrow ? `<td align="right" style="vertical-align:middle;font-size:12px;color:#6b7c96;">${o.eyebrow}</td>` : ''}
</tr></table>
</td></tr>

<!-- Tarjeta -->
<tr><td style="background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 18px 50px rgba(0,45,110,0.12);">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">

<!-- Hero con ARIA -->
<tr><td style="${degradado}border-radius:28px 28px 0 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td class="px" style="padding:34px 0 30px 40px;vertical-align:middle;">
${o.eyebrow ? `<p style="margin:0 0 10px;font-size:12px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,0.78);">${o.eyebrow}</p>` : ''}
<h1 class="hero-t" style="margin:0;font-size:30px;line-height:1.15;font-weight:700;letter-spacing:-0.6px;color:#ffffff;">${o.title}</h1>
</td>
<td class="aria-col" width="190" style="width:190px;padding:18px 24px 0 8px;vertical-align:bottom;" align="right">
<div class="globo">${globo}</div>
<img class="aria-img" src="${ASSETS}/aria/${pose}.png" width="150" alt="ARIA" style="display:block;border:0;width:150px;height:auto;margin:6px 0 0 auto;">
</td>
</tr></table>
</td></tr>

<!-- Cuerpo -->
<tr><td class="px" style="padding:34px 40px 10px;">
<p style="margin:0 0 24px;font-size:16px;line-height:1.65;color:#40506b;">${o.intro}</p>
${detalles}
${o.extra ?? ''}
${boton}
${o.note ? `<p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#6b7c96;">${o.note}</p>` : ''}
</td></tr>

${o.cta && o.enlaceAlterno !== false ? `<tr><td class="px" style="padding:18px 40px 0;"><p style="margin:0;border-top:1px solid #e6eef9;padding-top:18px;font-size:12px;line-height:1.6;color:#8a9ab3;">${alterno}<br><a href="${href}" style="color:${acento};word-break:break-all;">${href}</a></p></td></tr>` : ''}

<tr><td style="padding:30px 0 0;"></td></tr>
</table>
</td></tr>

<!-- Pie -->
<tr><td align="center" style="padding:24px 16px 0;">
<p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#40506b;">${BRAND} · ${tagline}</p>
<p style="margin:0;font-size:11px;line-height:1.6;color:#8a9ab3;">${automatico}</p>
</td></tr>

</table>
</td></tr></table>
</body></html>`
}
