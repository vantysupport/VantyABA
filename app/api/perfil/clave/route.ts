// Cambio de contraseña con verificación por correo (todos los roles).
//  POST { accion: 'enviar' }                   → manda un código de 6 dígitos al correo de la cuenta (1 por minuto)
//  POST { accion: 'cambiar', codigo, nueva }    → si el código es correcto, el servidor cambia la contraseña
// Así, quien tenga la sesión abierta en un equipo ajeno no puede cambiar la clave sin acceso al correo.

import { NextRequest, NextResponse } from 'next/server'
import { randomInt, timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, unauthorized } from '@/lib/api-auth'
import { sendEmail } from '@/lib/email'
import { emailLayout } from '@/lib/email-layout'
import { getLocaleFromRequest } from '@/lib/lang'
import { hashCodigo } from '@/lib/mfa-email'

export const dynamic = 'force-dynamic'

const PROPOSITO = 'cambio_clave'
const MINUTOS_VALIDEZ = 10
const MAX_INTENTOS = 5

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller || !caller.email) return unauthorized()
  const uid = caller.id
  const body = await req.json().catch(() => ({}))
  const en = getLocaleFromRequest(req, body) === 'en'
  const L = (e: string, s: string) => (en ? e : s)

  if (body?.accion === 'enviar') {
    const { data: previo } = await supabaseAdmin.from('codigos_email').select('enviado_en').eq('user_id', uid).eq('proposito', PROPOSITO).maybeSingle()
    if (previo && Date.now() - new Date(previo.enviado_en).getTime() < 60_000) {
      return NextResponse.json({ error: 'espera' }, { status: 429 })
    }
    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0')
    await supabaseAdmin.from('codigos_email').upsert({
      user_id: uid, proposito: PROPOSITO, codigo_hash: hashCodigo(`${uid}:${PROPOSITO}`, codigo), intentos: 0,
      expira_en: new Date(Date.now() + MINUTOS_VALIDEZ * 60_000).toISOString(), enviado_en: new Date().toISOString(),
    })
    const asunto = L('Code to change your Vanty ABA password', 'Código para cambiar tu contraseña de Vanty ABA')
    const html = emailLayout({
      locale: en ? 'en' : 'es', subject: asunto, preheader: L(`Code: ${codigo}`, `Código: ${codigo}`),
      title: L('Confirm your password change', 'Confirma el cambio de contraseña'),
      intro: L('Someone asked to change the password of your account. Enter this code to confirm it was you. It expires in 10 minutes.',
        'Se pidió cambiar la contraseña de tu cuenta. Escribe este código para confirmar que fuiste tú. Vence en 10 minutos.'),
      extra: `<div style="margin:8px 0 4px;text-align:center;font-size:34px;font-weight:700;letter-spacing:10px;color:#0b1b33;font-family:Menlo,Consolas,monospace;">${codigo}</div>`,
      note: L("If you didn't ask for this, ignore this email and your password stays the same.", 'Si no lo pediste tú, ignora este correo: tu contraseña no cambiará.'),
      aria: 'pensando',
    })
    const ok = await sendEmail(caller.email, asunto, html, 'Vanty ABA')
    if (!ok) return NextResponse.json({ error: 'no_enviado' }, { status: 502 })
    const [u, d] = caller.email.split('@')
    return NextResponse.json({ ok: true, correo: `${u.slice(0, 2)}${'•'.repeat(Math.max(1, u.length - 2))}@${d}` })
  }

  if (body?.accion === 'cambiar') {
    const codigo = String(body?.codigo ?? '').replace(/\D/g, '')
    const nueva = String(body?.nueva ?? '')
    if (nueva.length < 8) return NextResponse.json({ error: 'clave_corta' }, { status: 400 })
    if (codigo.length !== 6) return NextResponse.json({ error: 'codigo' }, { status: 400 })

    const { data: fila } = await supabaseAdmin.from('codigos_email').select('codigo_hash, expira_en, intentos').eq('user_id', uid).eq('proposito', PROPOSITO).maybeSingle()
    if (!fila || new Date(fila.expira_en).getTime() < Date.now()) return NextResponse.json({ error: 'vencido' }, { status: 400 })
    if (fila.intentos >= MAX_INTENTOS) return NextResponse.json({ error: 'intentos' }, { status: 429 })
    const a = Buffer.from(fila.codigo_hash), b = Buffer.from(hashCodigo(`${uid}:${PROPOSITO}`, codigo))
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      await supabaseAdmin.from('codigos_email').update({ intentos: fila.intentos + 1 }).eq('user_id', uid).eq('proposito', PROPOSITO)
      return NextResponse.json({ error: 'codigo', restantes: MAX_INTENTOS - fila.intentos - 1 }, { status: 400 })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(uid, { password: nueva })
    if (error) {
      const debil = /weak|pwned|leaked|characters|password/i.test(error.message)
      return NextResponse.json({ error: debil ? 'clave_debil' : 'no_cambiada' }, { status: 400 })
    }
    await supabaseAdmin.from('codigos_email').delete().eq('user_id', uid).eq('proposito', PROPOSITO)

    // Aviso de seguridad: la contraseña cambió
    const asunto = L('Your Vanty ABA password was changed', 'Tu contraseña de Vanty ABA fue cambiada')
    sendEmail(caller.email, asunto, emailLayout({
      locale: en ? 'en' : 'es', subject: asunto, title: L('Password changed', 'Contraseña cambiada'),
      intro: L('The password of your account was changed just now.', 'La contraseña de tu cuenta se cambió hace un momento.'),
      note: L("If it wasn't you, reset it right away from the sign-in page and contact your center.", 'Si no fuiste tú, restablécela de inmediato desde la pantalla de inicio de sesión y avisa a tu centro.'),
      aria: 'saludo',
    }), 'Vanty ABA').catch(() => {})
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'accion' }, { status: 400 })
}
