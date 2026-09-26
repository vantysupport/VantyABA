'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { clientIp, isLoginLocked, logSecurityEvent, recordLoginFailure } from '@/lib/security-events'
import { logAuditEvent } from '@/lib/audit-log'
import { appBaseUrl, authMailConfigured, resendConfirmationEmail } from '@/lib/auth-emails'

// Crear cliente de Supabase para server actions
async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}

// Reenvío del correo de confirmación (cuenta creada pero sin verificar). Máximo uno por minuto por correo.
const ultimoReenvio = new Map<string, number>()
export async function reenviarConfirmacion(email: string, locale: 'es' | 'en' = 'es'): Promise<{ ok: boolean; espera?: number }> {
  const normalized = String(email ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return { ok: false }
  const antes = ultimoReenvio.get(normalized) ?? 0
  const faltan = Math.ceil((antes + 60_000 - Date.now()) / 1000)
  if (faltan > 0) return { ok: false, espera: faltan }
  const siteUrl = appBaseUrl()
  if (!siteUrl || !authMailConfigured()) return { ok: false }
  ultimoReenvio.set(normalized, Date.now())
  const ok = await resendConfirmationEmail(normalized, siteUrl, locale === 'en' ? 'en' : 'es')
  return { ok }
}

export type SignInResult =
  | { ok: true; userId: string }
  | { ok: false; code: 'invalid' | 'unconfirmed' | 'locked' | 'rate_limited' | 'error'; minutes?: number }

// Sign-in runs server-side so the brute-force lockout can't be skipped from the browser; the session lands in the shared auth cookies.
export async function signInGuarded(email: string, password: string): Promise<SignInResult> {
  const normalized = String(email ?? '').trim().toLowerCase()
  if (!normalized || !password) return { ok: false, code: 'invalid' }

  const ip = clientIp(await headers())
  const lock = await isLoginLocked(normalized, ip)
  if (lock.locked) {
    await logSecurityEvent({ tipo: 'login_blocked_attempt', nivel: 'medio', descripcion: 'Intento durante bloqueo temporal', ip, metadata: { email: normalized } })
    return { ok: false, code: 'locked', minutes: lock.minutes }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password })

  if (error) {
    if (error.message.includes('Email not confirmed')) return { ok: false, code: 'unconfirmed' }
    if (error.status === 429) return { ok: false, code: 'rate_limited' }
    if (error.message.includes('Invalid login credentials')) {
      await recordLoginFailure(normalized, ip)
      return { ok: false, code: 'invalid' }
    }
    return { ok: false, code: 'error' }
  }

  await logAuditEvent({ action: 'login', resource_type: 'auth', userId: data.user.id, userEmail: normalized, req: { headers: await headers() } })
  return { ok: true, userId: data.user.id }
}

/**
 * Función de registro con creación de perfil
 */
export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string

  // Validaciones
  if (!email || !password || !fullName) {
    return { error: 'Por favor completa todos los campos' }
  }

  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres' }
  }

  // Registrar usuario en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      // Opcional: agregar confirmación de email
      // emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (authError) {
    console.error('Error en signup:', authError)
    
    if (authError.message.includes('User already registered')) {
      return { error: 'Este correo ya está registrado. Intenta iniciar sesión.' }
    }
    
    return { error: authError.message }
  }

  // Crear perfil en la tabla profiles
  if (authData.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: authData.user.id,
          email: email,
          full_name: fullName,
          role: 'padre', // Por defecto es padre de familia
          created_at: new Date().toISOString(),
        },
      ])

    // Ignorar error si el perfil ya existe (código 23505)
    if (profileError && profileError.code !== '23505') {
      console.error('Error creando perfil:', profileError)
      return { error: 'Usuario creado pero hubo un error al crear el perfil' }
    }
  }

  revalidatePath('/', 'layout')
  redirect('/padre')
}

/**
 * Función de logout
 */
export async function logout() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Error en logout:', error)
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/login')
}

/**
 * Función para obtener el usuario actual
 */
export async function getCurrentUser() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  // Obtener el perfil completo
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return {
    ...user,
    profile,
  }
}

/**
 * Función para verificar si el usuario es admin
 */
export async function isAdmin() {
  const user = await getCurrentUser()
  
  if (!user) return false
  
  return user.profile?.role === 'jefe' || 
         user.profile?.role === 'admin' || 
         user.profile?.role === 'especialista' ||
         user.profile?.role === 'secretaria'
}