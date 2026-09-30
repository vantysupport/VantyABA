// POST → registra una hoja del Libro de Reclamaciones virtual (pública, sin cuenta; límite de envíos en proxy.ts).
// Asigna el número correlativo del año (rpc registrar_reclamo), envía la constancia al consumidor y avisa a Vanty.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail } from '@/lib/email'
import { emailLayout, escHtml } from '@/lib/email-layout'
import { EMPRESA } from '@/lib/empresa'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DOCS = ['DNI', 'CE', 'Pasaporte', 'RUC'] as const
const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({})) as Record<string, unknown>
  const en = b.locale === 'en'
  // Trampa para bots: campo oculto que una persona nunca llena
  if (txt(b.sitio_web, 200)) return NextResponse.json({ ok: true, codigo: 'LR-0' })

  const datos = {
    nombre: txt(b.nombre, 150),
    tipo_documento: DOCS.includes(b.tipo_documento as typeof DOCS[number]) ? String(b.tipo_documento) : '',
    numero_documento: txt(b.numero_documento, 20),
    domicilio: txt(b.domicilio, 250),
    telefono: txt(b.telefono, 30),
    email: txt(b.email, 200).toLowerCase(),
    menor_de_edad: b.menor_de_edad === true,
    apoderado: txt(b.apoderado, 150),
    tipo_bien: b.tipo_bien === 'producto' ? 'producto' : 'servicio',
    monto: typeof b.monto === 'number' && b.monto >= 0 ? String(b.monto) : txt(b.monto, 15).replace(/[^\d.]/g, ''),
    descripcion_bien: txt(b.descripcion_bien, 500),
    tipo: b.tipo === 'queja' ? 'queja' : 'reclamo',
    detalle: txt(b.detalle, 3000),
    pedido: txt(b.pedido, 1500),
  }
  const falta = !datos.nombre || !datos.tipo_documento || datos.numero_documento.length < 6 || !datos.domicilio
    || !EMAIL_RE.test(datos.email) || !datos.descripcion_bien || datos.detalle.length < 10 || !datos.pedido
    || (datos.menor_de_edad && !datos.apoderado) || b.acepta !== true
  if (falta) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const { data: hoja, error } = await supabaseAdmin.rpc('registrar_reclamo', { p: datos })
  if (error || !hoja) return NextResponse.json({ error: 'save_failed' }, { status: 500 })
  const h = hoja as { codigo: string; created_at: string }

  const fecha = new Date(h.created_at).toLocaleString(en ? 'en-US' : 'es-PE', { timeZone: 'America/Lima', dateStyle: 'long', timeStyle: 'short' })
  const tipoTxt = datos.tipo === 'reclamo' ? (en ? 'Claim' : 'Reclamo') : (en ? 'Complaint' : 'Queja')
  const detalles = [
    { label: en ? 'Sheet N.°' : 'Hoja N.°', value: escHtml(h.codigo) },
    { label: en ? 'Date' : 'Fecha', value: escHtml(fecha) },
    { label: en ? 'Type' : 'Tipo', value: tipoTxt },
    { label: en ? 'Consumer' : 'Consumidor', value: escHtml(`${datos.nombre} · ${datos.tipo_documento} ${datos.numero_documento}`) },
    { label: en ? 'Contracted' : 'Bien contratado', value: escHtml(`${datos.tipo_bien === 'producto' ? (en ? 'Product' : 'Producto') : (en ? 'Service' : 'Servicio')}: ${datos.descripcion_bien}${datos.monto ? ` · ${datos.monto}` : ''}`) },
    { label: en ? 'Detail' : 'Detalle', value: escHtml(datos.detalle).replace(/\n/g, '<br/>') },
    { label: en ? 'Request' : 'Pedido', value: escHtml(datos.pedido).replace(/\n/g, '<br/>') },
  ]
  const proveedor = `${EMPRESA.titular} · RUC ${EMPRESA.ruc}${EMPRESA.direccion ? ` · ${EMPRESA.direccion}` : ''}`

  // Constancia para el consumidor (copia de su hoja)
  const asunto = en ? `Your ${tipoTxt.toLowerCase()} was registered · ${h.codigo}` : `Tu ${tipoTxt.toLowerCase()} fue registrado · ${h.codigo}`
  await sendEmail(datos.email, asunto, emailLayout({
    locale: en ? 'en' : 'es', subject: asunto, eyebrow: en ? 'Complaints Book' : 'Libro de Reclamaciones',
    title: en ? 'We received your sheet' : 'Recibimos tu hoja de reclamación',
    intro: en
      ? `This is a copy of your ${tipoTxt.toLowerCase()} in the Vanty Complaints Book. We will answer you by email within 15 business days.`
      : `Esta es la copia de tu ${tipoTxt.toLowerCase()} en el Libro de Reclamaciones de Vanty. Te responderemos por correo en un plazo máximo de 15 días hábiles.`,
    detalles,
    note: en
      ? `Provider: ${proveedor}. Filing a claim does not prevent you from using other dispute-resolution channels, nor is it a prerequisite to file a complaint with INDECOPI.`
      : `Proveedor: ${proveedor}. La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.`,
    aria: 'cita',
  }), 'Vanty ABA')

  // Aviso a Vanty para responder dentro del plazo
  const avisoAsunto = `Nuevo ${datos.tipo} en el Libro de Reclamaciones · ${h.codigo}`
  await sendEmail(EMPRESA.email, avisoAsunto, emailLayout({
    locale: 'es', subject: avisoAsunto, eyebrow: 'Libro de Reclamaciones', tono: 'alerta',
    title: `Nuevo ${datos.tipo}: ${h.codigo}`,
    intro: `Tienes 15 días hábiles para responder a ${escHtml(datos.email)}${datos.telefono ? ` (${escHtml(datos.telefono)})` : ''}. Domicilio: ${escHtml(datos.domicilio)}.${datos.menor_de_edad ? ` Menor de edad; apoderado: ${escHtml(datos.apoderado)}.` : ''}`,
    detalles,
  }), 'Vanty ABA')

  return NextResponse.json({ ok: true, codigo: h.codigo, fecha: h.created_at })
}
