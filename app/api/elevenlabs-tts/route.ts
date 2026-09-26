import { NextRequest, NextResponse } from 'next/server'
import { logServerError } from '@/lib/log-server-error'
import { synthesizeEdgeTTS, streamEdgeTTS } from '@/lib/edge-tts'
import { getApiCaller, unauthorized, forbidden, type ApiCaller } from '@/lib/api-auth'
import { createHash } from 'crypto'

// Verificar la sesión con Supabase cuesta ~1 s por pedido y ARIA pide varios audios seguidos
// (una frase cada uno). Se recuerda el resultado 5 min por sesión (clave = hash de la cookie
// o del token), así solo el primer audio paga esa verificación.
const sesiones = new Map<string, { caller: ApiCaller; hasta: number }>()
async function llamador(req: NextRequest): Promise<ApiCaller | null> {
  const credencial = `${req.headers.get('authorization') || ''}|${req.headers.get('cookie') || ''}`
  const clave = createHash('sha256').update(credencial).digest('hex')
  const guardada = sesiones.get(clave)
  if (guardada && guardada.hasta > Date.now()) return guardada.caller
  const caller = await getApiCaller(req)
  if (caller) {
    sesiones.set(clave, { caller, hasta: Date.now() + 5 * 60_000 })
    if (sesiones.size > 500) sesiones.delete(sesiones.keys().next().value as string)
  }
  return caller
}

// Voz de ARIA. GRATIS vía Microsoft Edge TTS — sin API key.
// El audio se genera al momento y NO se almacena en ningún lado.
// (La ruta conserva el nombre "elevenlabs-tts" por compatibilidad con los
//  componentes que ya la consumen; internamente ya NO usa ElevenLabs.)
export const runtime = 'nodejs'

const DEFAULT_VOICE = process.env.EDGE_TTS_VOICE || 'es-PE-CamilaNeural'
const EN_VOICE = process.env.EDGE_TTS_VOICE_EN || 'en-US-AriaNeural'

// Caché en memoria SOLO para textos cortos de práctica (fonemas, sílabas, palabras)
// que el cliente marca con `cache: true`: son iguales para todas las familias y
// generarlos tarda ~1-2 s. Las respuestas de ARIA nunca se guardan.
const CACHE_MAX = 400
const CACHE_TEXTO_MAX = 80
const cacheAudio = new Map<string, Buffer>()
function guardarEnCache(clave: string, audio: Buffer) {
  cacheAudio.delete(clave)
  cacheAudio.set(clave, audio)
  if (cacheAudio.size > CACHE_MAX) cacheAudio.delete(cacheAudio.keys().next().value as string)
}

export async function POST(req: NextRequest) {
  const caller = await llamador(req)
  if (!caller) return unauthorized()
  if (!caller.centroId) return forbidden()
  try {
    const { text, language, voice, locale, cache, rate } = await req.json()
    // Velocidad opcional (p. ej. "-45%" para decir una palabra despacio, por sílabas).
    const velocidad = typeof rate === 'string' && /^[-+]\d{1,2}%$/.test(rate) ? rate : undefined
    // La voz define el idioma con el que se leen números y símbolos.
    // En inglés usamos una voz en inglés; por defecto, la voz en español.
    const isEn = String(locale || language || '').toLowerCase().startsWith('en')

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Texto requerido' }, { status: 400 })
    }

    // Limpiar el texto de markdown y emojis antes de enviarlo
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/[💙📊🏠💬❌⚠️✅🎯📋💡🤖💜😊😐😔📨🔊🎤]/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/•/g, '')
      .trim()
      .slice(0, 4000)

    if (!clean) {
      return NextResponse.json({ error: 'Texto vacío tras limpieza' }, { status: 400 })
    }

    // El acento lo define la voz. Si el cliente envía un locale completo
    // (p. ej. "es-MX") lo respetamos; un simple "es" usa el acento de la voz.
    const lang = typeof language === 'string' && language.includes('-') ? language : undefined

    const vozFinal = voice || (isEn ? EN_VOICE : DEFAULT_VOICE)
    const cacheable = cache === true && clean.length <= CACHE_TEXTO_MAX
    const clave = `${vozFinal}|${lang || ''}|${velocidad || ''}|${clean}`
    const guardado = cacheable ? cacheAudio.get(clave) : undefined
    if (guardado) {
      guardarEnCache(clave, guardado) // lo marca como usado recién
      return new NextResponse(new Uint8Array(guardado), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } })
    }

    const audio = await synthesizeEdgeTTS(clean, {
      voice: vozFinal,
      lang: lang || (isEn ? 'en-US' : undefined),
      ...(velocidad ? { rate: velocidad } : {}),
    })
    if (cacheable && audio?.length) guardarEnCache(clave, audio)

    if (!audio || audio.length === 0) {
      await logServerError('Edge TTS audio vacío', `voz: ${voice || (isEn ? EN_VOICE : DEFAULT_VOICE)}`, 'api:tts')
      return NextResponse.json({ error: 'No se pudo generar el audio. Intenta de nuevo.' }, { status: 502 })
    }

    return new NextResponse(new Uint8Array(audio), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',  // nada se guarda — voz solo al momento
      },
    })

  } catch (error: any) {
    await logServerError('Error en /api/elevenlabs-tts (Edge TTS)', error?.stack || error?.message || String(error), 'api:tts')
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

// GET /api/elevenlabs-tts?text=…&locale=es|en — voz de ARIA en streaming: el <audio> del
// navegador empieza a sonar con los primeros datos (sin esperar el audio completo).
export async function GET(req: NextRequest) {
  const caller = await llamador(req)
  if (!caller) return unauthorized()
  if (!caller.centroId) return forbidden()
  const sp = req.nextUrl.searchParams
  const isEn = (sp.get('locale') || '').toLowerCase().startsWith('en')
  const clean = (sp.get('text') || '')
    .replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/#{1,6}\s/g, '')
    .replace(/<[^>]+>/g, '').replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200)
  if (!clean) return NextResponse.json({ error: 'Texto requerido' }, { status: 400 })
  const stream = streamEdgeTTS(clean, { voice: isEn ? EN_VOICE : DEFAULT_VOICE, lang: isEn ? 'en-US' : undefined })
  return new Response(stream, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=600' } })
}
