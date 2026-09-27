// Segundo paso por correo (alternativa a la app de autenticación).
//  POST { accion: 'enviar' }            → manda un código de 6 dígitos al correo de la cuenta (1 por minuto)
//  POST { accion: 'verificar', codigo }  → si es correcto, marca ESTA sesión como verificada (cookie firmada)
// Vive bajo /api/session/ porque el proxy deja pasar esas rutas mientras el segundo paso está pendiente.
// El programador no puede usarlo: la consola /control exige la app de autenticación (aal2 real).

import { NextRequest, NextResponse } from 'next/server'
import { randomInt, timingSafeEqual } from 'crypto'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail } from '@/lib/email'
import { emailLayout } from '@/lib/email-layout'
import { getLocaleFromRequest } from '@/lib/lang'
import { COOKIE_MFA_EMAIL, cookieMfaEmail, hashCodigo } from '@/lib/mfa-email'

export const dynamic = 'force-dynamic'

const MINUTOS_VALIDEZ = 10
const MAX_INTENTOS = 5

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: c } = await supabase.auth.getClaims()
  const uid = c?.claims?.sub as string | undefined
  const sid = c?.claims?.session_id as string | undefined
  const email = c?.claims?.email as string | undefined
  if (!uid || !sid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: perfil } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).maybeSingle()
  if (perfil?.role === 'programador') return NextResponse.json({ error: 'solo_app' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const en = getLocaleFromRequest(req, body) === 'en'

  if (body?.accion === 'enviar') {
    if (!email) return NextResponse.json({ error: 'sin_correo' }, { status: 400 })
    const { data: previo } = await supabaseAdmin.from('mfa_codigos_email').select('enviado_en').eq('user_id', uid).maybeSingle()
    if (previo && Date.now() - new Date(previo.enviado_en).getTime() < 60_000) {
      return NextResponse.json({ error: 'espera' }, { status: 429 })
    }
    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0')
    await supabaseAdmin.from('mfa_codigos_email').upsert({
      user_id: uid, codigo_hash: hashCodigo(uid, codigo), intentos: 0,
      expira_en: new Date(Date.now() + MINUTOS_VALIDEZ * 60_000).toISOString(), enviado_en: new Date().toISOString(),
    })
    const L = (e: string, s: string) => (en ? e : s)
    const html = emailLayout({
      locale: en ? 'en' : 'es',
      subject: L('Your Vanty ABA verification code', 'Tu código de verificación de Vanty ABA'),
      preheader: L(`Code: ${codigo}`, `Código: ${codigo}`),
      title: L('Your verification code', 'Tu código de verificación'),
      intro: L('Use this code to finish signing in. It expires in 10 minutes.', 'Usa este código para terminar de iniciar sesión. Vence en 10 minutos.'),
      extra: `<div style="margin:8px 0 4px;text-align:center;font-size:34px;font-weight:700;letter-spacing:10px;color:#0b1b33;font-family:Menlo,Consolas,monospace;">${codigo}</div>`,
      note: L("If you didn't try to sign in, change your password: someone may know it.", 'Si no intentaste iniciar sesión, cambia tu contraseña: alguien podría conocerla.'),
      aria: 'pensando',
    })
    const ok = await sendEmail(email, L('Your Vanty ABA verification code', 'Tu código de verificación de Vanty ABA'), html, 'Vanty ABA')
    if (!ok) return NextResponse.json({ error: 'no_enviado' }, { status: 502 })
    const [usuario, dominio] = email.split('@')
    return NextResponse.json({ ok: true, correo: `${usuario.slice(0, 2)}${'•'.repeat(Math.max(1, usuario.length - 2))}@${dominio}` })
  }

  if (body?.accion === 'verificar') {
    const codigo = String(body?.codigo ?? '').replace(/\D/g, '')
    if (codigo.length !== 6) return NextResponse.json({ error: 'codigo' }, { status: 400 })
    const { data: fila } = await supabaseAdmin.from('mfa_codigos_email').select('codigo_hash, expira_en, intentos').eq('user_id', uid).maybeSingle()
    if (!fila || new Date(fila.expira_en).getTime() < Date.now()) return NextResponse.json({ error: 'vencido' }, { status: 400 })
    if (fila.intentos >= MAX_INTENTOS) return NextResponse.json({ error: 'intentos' }, { status: 429 })
    const a = Buffer.from(fila.codigo_hash), b = Buffer.from(hashCodigo(uid, codigo))
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      await supabaseAdmin.from('mfa_codigos_email').update({ intentos: fila.intentos + 1 }).eq('user_id', uid)
      return NextResponse.json({ error: 'codigo', restantes: MAX_INTENTOS - fila.intentos - 1 }, { status: 400 })
    }
    await supabaseAdmin.from('mfa_codigos_email').delete().eq('user_id', uid)
    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE_MFA_EMAIL, cookieMfaEmail(uid, sid), {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
    })
    return res
  }

  return NextResponse.json({ error: 'accion' }, { status: 400 })
}
