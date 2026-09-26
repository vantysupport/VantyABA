// Notificación de bienvenida al activar los avisos: muestra a la persona cómo le llegarán.
import { NextRequest, NextResponse } from 'next/server'
import { getApiCaller, unauthorized } from '@/lib/api-auth'
import { enviarPush, panelDeRol } from '@/lib/push'
import { getLocaleFromRequest } from '@/lib/lang'

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  const en = getLocaleFromRequest(req) === 'en'
  const padre = caller.role === 'padre'
  const enviados = await enviarPush([caller.id], {
    title: en ? 'Hi! I am ARIA' : '¡Hola! Soy ARIA',
    body: padre
      ? (en ? 'From now on I will remind you of appointments and help you keep your practice streak.' : 'Desde ahora te recordaré las citas y te ayudaré a mantener tu racha de práctica.')
      : (en ? 'From now on your center updates will reach your phone.' : 'Desde ahora las novedades de tu centro llegarán a tu celular.'),
    url: panelDeRol(caller.role), pose: 'saludo', tag: 'bienvenida',
  })
  return NextResponse.json({ enviados })
}
