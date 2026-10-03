import 'server-only'
// Correo cuando se acaban los tokens (fuera de la app: Google Play no permite enlaces de compra dentro de la app,
// pero sí comunicarse con el usuario por correo). Máximo uno por semana y por persona/centro (tabla push_enviados).
//   aria / practica → la familia (solo si hay paquetes a la venta)
//   analisis        → la dirección del centro (tokens de análisis predictivo del mes)

import { after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail } from '@/lib/email'
import { emailLayout, escHtml } from '@/lib/email-layout'
import { SITIO } from '@/lib/seo'

type Tipo = 'aria' | 'practica' | 'analisis'

const semana = () => {
  const d = new Date(); const ini = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return `${d.getUTCFullYear()}-${Math.ceil(((d.getTime() - ini.getTime()) / 86_400_000 + ini.getUTCDay() + 1) / 7)}`
}

async function primeraVez(clave: string, userId: string) {
  const { error } = await supabaseAdmin.from('push_enviados').insert({ clave, user_id: userId })
  return !error
}

/** No bloquea ni lanza: se llama sin await. */
export function avisarTokensAgotados(tipo: Tipo, opts: { userId?: string | null; centroId?: string | null }) {
  const tarea = () => enviar(tipo, opts).catch(() => {})
  // after(): se envía cuando ya salió la respuesta (en Vercel la función sigue viva hasta terminar)
  try { after(tarea) } catch { void tarea() }
}

async function enviar(tipo: Tipo, { userId, centroId }: { userId?: string | null; centroId?: string | null }) {
  let destinoId = userId ?? null
  if (tipo === 'analisis') {
    if (!centroId) return
    const { data: c } = await supabaseAdmin.from('centros').select('owner_id').eq('id', centroId).maybeSingle()
    destinoId = c?.owner_id ?? null
    if (!destinoId) {
      const { data: jefe } = await supabaseAdmin.from('profiles').select('id').eq('centro_id', centroId).eq('role', 'jefe').eq('is_active', true).limit(1).maybeSingle()
      destinoId = jefe?.id ?? null
    }
  } else {
    // Familias: solo si la plataforma vende paquetes de tokens
    const { data: ps } = await supabaseAdmin.from('platform_settings').select('token_packs').eq('id', 1).maybeSingle()
    if (!Array.isArray(ps?.token_packs) || ps.token_packs.length === 0) return
  }
  if (!destinoId) return

  const { data: p } = await supabaseAdmin.from('profiles').select('email, full_name, centros(name)').eq('id', destinoId).maybeSingle()
  const email = p?.email
  if (!email) return
  if (!(await primeraVez(`correo-tokens:${tipo}:${tipo === 'analisis' ? centroId : destinoId}:${semana()}`, destinoId))) return

  const nombre = String(p?.full_name || '').trim().split(/\s+/)[0] || ''
  const centro = (p?.centros as { name?: string } | null)?.name || 'Vanty'
  const t = {
    aria: {
      asunto: 'Te quedaste sin mensajes de ARIA por hoy',
      titulo: `${nombre ? `${nombre}, ¿` : '¿'}seguimos conversando?`,
      intro: 'Usaste los mensajes de ARIA de hoy. Vuelven solos mañana, pero si quieres seguir ahora puedes recargar mensajes extra; los que compres no vencen.',
      cta: 'Recargar mensajes', href: `${SITIO}/es/padre?vista=chat`,
    },
    practica: {
      asunto: 'Usaste los planes de práctica del mes',
      titulo: `${nombre ? `${nombre}, ¡` : '¡'}qué constancia!`,
      intro: 'Ya creaste todos los planes de práctica en casa de este mes. Si quieres uno nuevo ahora, puedes recargar planes extra; los que compres no vencen.',
      cta: 'Recargar planes', href: `${SITIO}/es/padre?vista=engagement`,
    },
    analisis: {
      asunto: 'Tu centro usó los análisis de IA del mes',
      titulo: 'Se acabaron los análisis de este mes',
      intro: `El equipo de ${escHtml(centro)} usó todos los análisis con IA del mes (predicciones, patrones, objetivos y reportes). Puedes recargar tokens para seguir hoy mismo; los comprados no vencen.`,
      cta: 'Recargar tokens', href: `${SITIO}/es/admin?vista=inteligencia`,
    },
  }[tipo]

  await sendEmail(email, t.asunto, emailLayout({
    locale: 'es', subject: t.asunto, eyebrow: escHtml(centro), title: t.titulo, intro: t.intro,
    cta: { href: t.href, label: t.cta }, aria: 'pensando',
    note: 'Te escribimos como máximo una vez por semana sobre esto.',
  }), 'Vanty ABA')
}
