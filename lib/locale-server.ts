// lib/locale-server.ts
// Idioma de la página en el servidor: primero el prefijo /en o /es de la URL
// (cabecera x-vanty-locale que fija proxy.ts; Googlebot no envía cookies),
// luego la cookie vanty_locale y por defecto español.
import 'server-only'
import { cookies, headers } from 'next/headers'

export async function localeServidor(): Promise<'es' | 'en'> {
  const fromUrl = (await headers()).get('x-vanty-locale')
  const fromCookie = (await cookies()).get('vanty_locale')?.value
  return (fromUrl || fromCookie) === 'en' ? 'en' : 'es'
}
