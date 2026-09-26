// GET /api/videos-actividad?q=<búsqueda>&lang=es|en
// Videos de YouTube para ver dentro de "Practicar en casa" (sin IA).
// Usa la API oficial de YouTube (YOUTUBE_API_KEY, cuota gratuita) y guarda cada búsqueda
// en videos_actividad por 30 días, así una misma actividad se busca una sola vez para todos.
// Sin clave configurada responde { disponible: false } y la app ofrece el enlace a YouTube.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, unauthorized } from '@/lib/api-auth'

type Video = { id: string; titulo: string; canal: string; miniatura: string }
const VIGENCIA_MS = 30 * 24 * 60 * 60 * 1000

const decodificar = (s: string) => s
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()

  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 160)
  const en = req.nextUrl.searchParams.get('lang') === 'en'
  if (q.length < 3) return NextResponse.json({ error: 'q requerido' }, { status: 400 })
  const consulta = `${en ? 'en' : 'es'}:${q.toLowerCase()}`

  // 1. Caché
  const { data: cache } = await supabaseAdmin.from('videos_actividad').select('videos, created_at').eq('consulta', consulta).maybeSingle()
  if (cache && Date.now() - new Date(cache.created_at).getTime() < VIGENCIA_MS) {
    return NextResponse.json({ disponible: true, videos: cache.videos }, { headers: { 'Cache-Control': 'private, max-age=3600' } })
  }

  const key = process.env.YOUTUBE_API_KEY
  if (!key) return NextResponse.json({ disponible: false, videos: [] })

  // 2. YouTube Data API: solo videos incrustables, búsqueda segura y en el idioma del padre
  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.search = new URLSearchParams({
    key, part: 'snippet', type: 'video', maxResults: '4', q,
    safeSearch: 'strict', videoEmbeddable: 'true', videoSyndicated: 'true',
    relevanceLanguage: en ? 'en' : 'es', regionCode: en ? 'US' : 'PE',
  }).toString()

  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      // Cuota agotada o clave inválida: la app vuelve al enlace de búsqueda
      console.warn('[videos-actividad] YouTube', res.status)
      return NextResponse.json({ disponible: false, videos: [] })
    }
    const json = await res.json() as { items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: Record<string, { url: string }> } }[] }
    const videos: Video[] = (json.items || [])
      .filter(i => i.id?.videoId)
      .map(i => ({
        id: i.id!.videoId!,
        titulo: decodificar(i.snippet?.title || ''),
        canal: decodificar(i.snippet?.channelTitle || ''),
        miniatura: i.snippet?.thumbnails?.medium?.url || i.snippet?.thumbnails?.default?.url || `https://i.ytimg.com/vi/${i.id!.videoId}/mqdefault.jpg`,
      }))
    await supabaseAdmin.from('videos_actividad').upsert({ consulta, videos, created_at: new Date().toISOString() })
    return NextResponse.json({ disponible: true, videos }, { headers: { 'Cache-Control': 'private, max-age=3600' } })
  } catch (e) {
    console.warn('[videos-actividad]', (e as Error).message)
    return NextResponse.json({ disponible: false, videos: [] })
  }
}
