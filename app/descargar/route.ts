import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Enlace corto para compartir la app de Android: vanty.xyz/descargar → el último APK subido en /control
// (Plataforma → App de Android). Se descarga con el nombre "Vanty-ABA.apk".
export async function GET(req: Request) {
  const { data } = await supabaseAdmin.from('platform_settings').select('app_android').eq('id', 1).maybeSingle()
  const url = String((data?.app_android as { url_apk?: string } | null)?.url_apk ?? '')
  if (!/^https:\/\//.test(url)) return NextResponse.redirect(new URL('/', req.url))
  const destino = new URL(url)
  if (destino.hostname.endsWith('.supabase.co')) destino.searchParams.set('download', 'Vanty-ABA.apk')
  return NextResponse.redirect(destino, { headers: { 'Cache-Control': 'no-store' } })
}
