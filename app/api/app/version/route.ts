import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Última versión de la app de Android (se edita en /control → Plataforma). Pública: solo número, notas y enlace.
export async function GET() {
  const { data } = await supabaseAdmin.from('platform_settings').select('app_android').eq('id', 1).maybeSingle()
  const a = (data?.app_android ?? {}) as Record<string, unknown>
  return NextResponse.json({
    version_code: Number(a.version_code) || 0,
    version_name: String(a.version_name ?? ''),
    notas: String(a.notas ?? ''),
    url_apk: String(a.url_apk ?? ''),
    obligatoria: !!a.obligatoria,
  }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
}
