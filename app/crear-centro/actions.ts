'use server'

import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { appBaseUrl, authMailConfigured, createUserWithConfirmationEmail } from '@/lib/auth-emails'
import { liberarCorreoHuerfano } from '@/lib/cuenta-huerfana'
import { detectarPais } from '@/lib/precios-server'
import { aceptacionTerminos } from '@/lib/terminos'

const DEFAULT_TRIAL_DAYS = 14
const LOGO_MAX_BYTES = 2 * 1024 * 1024
// SVG is excluded on purpose: it can carry scripts and is served from a public bucket.
const LOGO_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

export type CreateCentroState = { error?: string; ok?: boolean; email?: string; trialDays?: number }

function slugify(name: string) {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${base || 'centro'}-${crypto.randomUUID().slice(0, 6)}`
}

const text = (f: FormData, k: string, max = 200) => String(f.get(k) ?? '').trim().slice(0, max)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function createCentro(_prev: CreateCentroState, formData: FormData): Promise<CreateCentroState> {
  const centroName = text(formData, 'centroName', 120)
  const direccion = text(formData, 'direccion', 250)
  const telefono = text(formData, 'telefono', 40)
  const centroEmail = text(formData, 'centroEmail', 200).toLowerCase()
  const ruc = text(formData, 'ruc', 20)
  const fullName = text(formData, 'fullName', 120)
  const email = text(formData, 'email', 200).toLowerCase()
  const password = String(formData.get('password') ?? '')
  const planCode = text(formData, 'plan', 30) || 'starter'
  const ciclo = text(formData, 'ciclo', 10) === 'anual' ? 'anual' : 'mensual'
  const locale = formData.get('locale') === 'en' ? 'en' : 'es'
  const logo = formData.get('logo')

  if (centroName.length < 2 || fullName.length < 2 || direccion.length < 4 || telefono.length < 6) return { error: 'vanty.createCenter.errors.required' }
  if (!EMAIL_RE.test(email) || !EMAIL_RE.test(centroEmail)) return { error: 'vanty.createCenter.errors.email' }
  if (ruc && !/^[0-9A-Za-z-]{6,20}$/.test(ruc)) return { error: 'vanty.createCenter.errors.ruc' }
  if (password.length < 8) return { error: 'vanty.createCenter.errors.password' }
  if (formData.get('terminos') !== '1') return { error: 'vanty.createCenter.errors.terms' }
  const logoFile = logo instanceof File && logo.size > 0 ? logo : null
  if (logoFile && (!LOGO_TYPES[logoFile.type] || logoFile.size > LOGO_MAX_BYTES)) return { error: 'vanty.createCenter.errors.logo' }

  const [{ data: plan }, { data: settings }] = await Promise.all([
    supabaseAdmin.from('plans').select('id').eq('code', planCode).eq('is_active', true).maybeSingle(),
    supabaseAdmin.from('platform_settings').select('trial_days').eq('id', 1).maybeSingle(),
  ])
  if (!plan) return { error: 'vanty.createCenter.errors.plan' }

  // With Gmail SMTP configured the app sends its own branded confirmation email; otherwise Supabase's mailer does.
  const siteUrl = appBaseUrl()
  if (!siteUrl) return { error: 'vanty.createCenter.errors.generic' }
  // Si el correo quedó ocupado por una cuenta que se creó sola al entrar con Google/Microsoft y no
  // pertenece a nada, se libera. La cuenta nueva igual exige confirmar el correo.
  await liberarCorreoHuerfano(email)
  let userId: string
  if (authMailConfigured()) {
    const created = await createUserWithConfirmationEmail({ email, password, fullName, siteUrl, locale })
    if ('error' in created) return { error: created.error === 'email_taken' ? 'vanty.createCenter.errors.emailTaken' : 'vanty.createCenter.errors.generic' }
    userId = created.userId
  } else {
    const supabase = await createClient()
    const { data: signUp, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: `${siteUrl}/auth/callback` },
    })
    if (signUpError) return { error: 'vanty.createCenter.errors.generic' }
    // With email confirmation on, an existing address comes back as a user with no identities instead of an error.
    if (!signUp.user || signUp.user.identities?.length === 0) return { error: 'vanty.createCenter.errors.emailTaken' }
    userId = signUp.user.id
  }
  const user = { id: userId }

  const trialDays = settings?.trial_days ?? DEFAULT_TRIAL_DAYS
  const { data: centro, error: centroError } = await supabaseAdmin
    .from('centros')
    .insert({
      name: centroName,
      slug: slugify(centroName),
      locale_default: locale,
      plan_id: plan.id,
      status: 'trial',
      trial_ends_at: new Date(Date.now() + trialDays * 86_400_000).toISOString(),
      owner_id: user.id,
      email: centroEmail,
      direccion,
      telefono,
      ruc: ruc || null,
      // País para cobrar con el precio de su región; ciclo elegido en la web (mensual / anual)
      pais: await detectarPais(),
      ciclo_facturacion: ciclo,
    })
    .select('id')
    .single()

  const rollback = async (centroId?: string) => {
    if (centroId) await supabaseAdmin.from('centros').delete().eq('id', centroId)
    await supabaseAdmin.auth.admin.deleteUser(user.id)
  }

  if (centroError || !centro) {
    await rollback()
    return { error: 'vanty.createCenter.errors.generic' }
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ role: 'jefe', centro_id: centro.id, full_name: fullName, nombre_confirmado: true, ...aceptacionTerminos() })
    .eq('id', user.id)
  if (profileError) {
    await rollback(centro.id)
    return { error: 'vanty.createCenter.errors.generic' }
  }

  await supabaseAdmin.from('subscription_events').insert({ centro_id: centro.id, event: 'trial_started', plan_id: plan.id, note: `${trialDays} días`, actor_id: user.id })

  // A failed logo upload shouldn't lose the account; the admin can upload it later from settings.
  if (logoFile) {
    const path = `centros/${centro.id}/logo-${crypto.randomUUID().slice(0, 8)}.${LOGO_TYPES[logoFile.type]}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('public-images')
      .upload(path, Buffer.from(await logoFile.arrayBuffer()), { contentType: logoFile.type, upsert: false })
    if (!uploadError) {
      const { data } = supabaseAdmin.storage.from('public-images').getPublicUrl(path)
      await supabaseAdmin.from('centros').update({ logo_url: data.publicUrl }).eq('id', centro.id)
    }
  }

  return { ok: true, email, trialDays }
}
