// UBICACIÓN: lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'
import { esModoApp } from '@/lib/modo-app'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Dentro de la app móvil la sesión es la del teléfono: cerrarla aquí (aunque sea "local") la revoca en el
// servidor y deja a la app sin sesión. En ese modo signOut no hace nada; la app gestiona su propia sesión.
if (esModoApp()) {
  supabase.auth.signOut = (async () => ({ error: null })) as typeof supabase.auth.signOut
}