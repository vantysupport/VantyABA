// GET /api/app/entrar?destino=/es/admin?vista=ninos&embebido=1
// La app móvil abre un apartado de la web con su sesión: llama aquí con "Authorization: Bearer <token>" y la
// web deja la cookie de sesión en el formato de @supabase/ssr (el mismo que usa el login) y redirige al
// destino. El token se verifica con Supabase (setSession → getUser). Solo se permiten destinos internos.
// El token de renovación no se comparte: la web no renueva la sesión del teléfono (si vence, la app vuelve a entrar).

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const pedido = req.nextUrl.searchParams.get('destino') || '/'
  // Solo rutas de este sitio (sin "//" ni esquemas): evita redirecciones abiertas
  const destino = pedido.startsWith('/') && !pedido.startsWith('//') && !pedido.includes('\\') ? pedido : '/'
  const res = NextResponse.redirect(new URL(destino, req.url), { status: 302 })
  res.headers.set('Cache-Control', 'no-store')

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => [],
      setAll: lista => lista.forEach(c => res.cookies.set(c.name, c.value, c.options)),
    },
  })
  const { data, error } = await supabase.auth.setSession({ access_token: token, refresh_token: 'app' })
  if (error || !data.session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  // Dejar que @supabase/ssr escriba las cookies antes de responder
  await new Promise(r => setTimeout(r, 0))
  return res
}
