// 🔒 Proxy / Middleware global de seguridad SANTI
// ⚠️  Next.js 16+ con Turbopack: este archivo se llama proxy.ts (antes middleware.ts)
// ════════════════════════════════════════════════════════════════════════════
// Se ejecuta en EDGE antes de cualquier ruta y aplica 4 capas:
//   0. i18n: prefijo de idioma en la URL (/en, /es) + autodetección
//   1. Auth: bloquea acceso a /admin, /secretaria, /padre, /especialista sin sesión
//   2. Role gates: cada panel solo es accesible a su rol
//   3. API protection: /api/* requiere sesión salvo rutas explícitamente públicas
//
// Las rutas estáticas (_next, favicon, imágenes, etc.) NO pasan por aquí.
// ════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { rateLimit, RATE_LIMITS, getClientIP } from './lib/rate-limit'

// ── i18n ─────────────────────────────────────────────────────────────────────
const I18N_LOCALES = ['en', 'es'] as const
const I18N_DEFAULT = 'es'
function detectLocale(req: NextRequest): string {
  const cookie = req.cookies.get('vanty_locale')?.value
  if (cookie === 'en' || cookie === 'es') return cookie
  const al = (req.headers.get('accept-language') || '').toLowerCase()
  return al.startsWith('en') ? 'en' : I18N_DEFAULT
}

// Rutas que NO requieren autenticación (públicas por diseño)
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verificar',                  // verificación pública de documentos por QR
  '/auth/callback',
  '/landing',
  '/mfa-required',               // página de enrollment 2FA (requiere sesión pero salta los role checks)
]

// Endpoints API públicos (verificación, webhooks, etc.)
const PUBLIC_API_PATHS = [
  '/api/auth',                   // callbacks de auth
  '/api/health',                 // health check
  '/api/verificar-documento',    // verificación pública por QR
]

// Rutas por rol → si user.role === X, puede acceder a estas raíces
const ROLE_ROUTES: Record<string, string[]> = {
  jefe:          ['/admin'],
  admin:         ['/admin'],
  especialista:  ['/especialista', '/admin'], // los especialistas pueden ver /admin (mismo panel filtrado)
  terapeuta:     ['/admin'],
  secretaria:    ['/secretaria'],
  padre:         ['/padre'],
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  if (pathname.startsWith('/verificar/')) return true   // verificación con código
  if (pathname.startsWith('/auth/')) return true
  // Archivos estáticos / assets
  if (pathname.startsWith('/_next/')) return true
  if (pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|gif|css|js|woff2?|ttf|map)$/i)) return true
  return false
}

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// Mapeo de paths críticos → su preset de rate limit
function pickRateLimit(pathname: string): typeof RATE_LIMITS[keyof typeof RATE_LIMITS] | null {
  if (pathname === '/api/auth/signin' || pathname.startsWith('/api/auth/v1/token')) return RATE_LIMITS.LOGIN
  if (pathname.startsWith('/api/parent-chat')) return RATE_LIMITS.AI_CHAT
  if (pathname.startsWith('/api/admin-chat')) return RATE_LIMITS.AI_CHAT
  if (pathname.startsWith('/api/vanty-agent')) return RATE_LIMITS.AI_CHAT
  if (pathname.startsWith('/api/reporte-word')) return RATE_LIMITS.REPORT_GENERATION
  if (pathname.startsWith('/api/reporte-')) return RATE_LIMITS.REPORT_GENERATION
  if (pathname.startsWith('/api/knowledge/ocr')) return RATE_LIMITS.OCR
  if (pathname.startsWith('/verificar/')) return RATE_LIMITS.PUBLIC_VERIFY
  if (pathname.startsWith('/api/')) return RATE_LIMITS.API_GENERIC
  return null
}

export async function proxy(req: NextRequest) {
  const rawPath = req.nextUrl.pathname
  const isApi = rawPath.startsWith('/api')

  // ═══ CAPA 0 · i18n (prefijo /en, /es) ═══════════════════════════════════════
  // Las rutas /api NO llevan prefijo de idioma. Las páginas SÍ.
  const seg = rawPath.split('/')[1]
  const hasLocale = seg === 'en' || seg === 'es'
  const locale = hasLocale ? seg : detectLocale(req)

  if (!isApi && !hasLocale) {
    // Sin prefijo → redirigir a la versión con idioma (autodetectado o cookie)
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = `/${locale}${rawPath === '/' ? '' : rawPath}`
    return NextResponse.redirect(redirectUrl)
  }

  // Ruta lógica SIN prefijo (para toda la lógica de auth/roles/rate-limit)
  const pathname = (!isApi && hasLocale) ? (rawPath.slice(3) || '/') : rawPath

  // Respuesta base: rewrite para páginas con prefijo (así app/admin sirve /es/admin
  // sin mover archivos); next() para API.
  const buildBaseRes = () => {
    if (!isApi && hasLocale) {
      const u = req.nextUrl.clone()
      u.pathname = pathname
      return NextResponse.rewrite(u)
    }
    return NextResponse.next()
  }
  const res = buildBaseRes()
  // Persistir el idioma elegido (por si vino por URL sin cookie previa)
  if (!isApi) res.cookies.set('vanty_locale', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 })

  // Helper: construir redirects manteniendo el prefijo de idioma en páginas
  const pageUrl = (p: string) => new URL(`/${locale}${p === '/' ? '' : p}`, req.url)

  // 0a. Rate limiting (corre ANTES que cualquier auth — para no gastar DB en bots)
  const rateConfig = pickRateLimit(pathname)
  if (rateConfig) {
    const ip = getClientIP(req as any)
    const r = await rateLimit(ip, rateConfig)
    res.headers.set('X-RateLimit-Limit', String(r.limit))
    res.headers.set('X-RateLimit-Remaining', String(r.remaining))
    res.headers.set('X-RateLimit-Reset', String(Math.floor(r.resetAt / 1000)))
    if (!r.allowed) {
      const retryAfter = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000))
      return new NextResponse(
        JSON.stringify({ error: 'Demasiadas solicitudes. Intentá nuevamente en unos minutos.', retryAfter }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(r.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(r.resetAt / 1000)),
          },
        },
      )
    }
  }

  // 0b. Rutas explícitamente públicas → seguir sin tocar (ya con rewrite de idioma)
  if (isPublicPath(pathname)) return res

  // 1. Crear cliente Supabase para leer la sesión desde cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: '', ...options })
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 2. Endpoints API
  if (pathname.startsWith('/api/')) {
    if (isPublicApiPath(pathname)) return res
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado. Iniciá sesión.' },
        { status: 401 },
      )
    }
    // Usuario autenticado → dejar pasar (el endpoint hace validaciones de role internamente)
    return res
  }

  // 3. Rutas de panel (admin, secretaria, padre, especialista)
  const protectedRoots = ['/admin', '/secretaria', '/padre', '/especialista']
  const isProtected = protectedRoots.some(r => pathname === r || pathname.startsWith(r + '/'))

  if (!isProtected) return res

  // Sin sesión → al login con redirect-back (con prefijo de idioma)
  if (!user) {
    const loginUrl = pageUrl('/login')
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 4. Validar role para esta ruta
  // Leemos el perfil completo (resiliente a columnas mfa_* que pueden no existir todavía)
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const role = (profile as any)?.role || 'padre'

  // 4a. 🔐 Forzar 2FA si el role lo requiere y el usuario aún no enroló
  const mfaRequired = (profile as any)?.mfa_required === true
  const mfaEnrolled = !!(profile as any)?.mfa_enrolled_at
  if (mfaRequired && !mfaEnrolled && pathname !== '/mfa-required') {
    return NextResponse.redirect(pageUrl('/mfa-required'))
  }

  const allowedRoots = ROLE_ROUTES[role] || []
  const matchesRole = allowedRoots.some(r => pathname === r || pathname.startsWith(r + '/'))

  if (!matchesRole) {
    // El usuario está logueado pero quiere entrar a un panel que no le corresponde.
    // Redirigir a SU panel propio (con prefijo de idioma) en vez de tirar 403.
    const homeForRole =
      role === 'jefe' || role === 'admin' || role === 'terapeuta' || role === 'especialista' ? '/admin'
      : role === 'secretaria' ? '/secretaria'
      : '/padre'
    return NextResponse.redirect(pageUrl(homeForRole))
  }

  return res
}

// Matcher: a qué rutas se aplica el middleware
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)',
  ],
}
