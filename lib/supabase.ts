// UBICACIÓN: lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'
import { esModoApp } from '@/lib/modo-app'

// Vuelta del inicio de sesión de la app de Android (/auth/callback?app=1): el código es de la app, la web no lo canjea
const vueltaDeApp = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('app') === '1'
  && /\/auth\/callback$/.test(window.location.pathname)

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  vueltaDeApp ? { auth: { detectSessionInUrl: false } } : undefined,
)

// Dentro de la app móvil la sesión es la del teléfono: cerrarla aquí (aunque sea "local") la revoca en el
// servidor y deja a la app sin sesión. En ese modo signOut no hace nada; la app gestiona su propia sesión.
if (esModoApp()) {
  // "Cerrar sesión" desde la web le pide a la app que cierre la sesión del teléfono (vuelve a su login)
  supabase.auth.signOut = (async () => {
    try { (window as unknown as { VantyApp?: { salir?: () => void } }).VantyApp?.salir?.() } catch { /* sin puente */ }
    return { error: null }
  }) as typeof supabase.auth.signOut
}