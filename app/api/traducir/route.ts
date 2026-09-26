// POST /api/traducir  { textos: string[], idioma: 'en' | 'es' }  →  { textos: string[] }
// Traduce textos del expediente (nombres de programas, indicaciones, etc.) al idioma de la app.
// Cada texto se traduce UNA sola vez (modelo rápido) y queda en traducciones_cache.

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, unauthorized } from '@/lib/api-auth'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'

const MAX_TEXTOS = 80
const MAX_LARGO = 2000
const hashDe = (t: string) => createHash('sha256').update(t).digest('hex')

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  const body = await req.json().catch(() => ({}))
  const idioma = body.idioma === 'en' ? 'en' : 'es'
  const textos: string[] = (Array.isArray(body.textos) ? body.textos : []).slice(0, MAX_TEXTOS).map((t: unknown) => String(t ?? '').slice(0, MAX_LARGO))
  if (!textos.length) return NextResponse.json({ textos: [] })

  const hashes = textos.map(hashDe)
  const resultado = [...textos]
  const { data: guardadas } = await supabaseAdmin.from('traducciones_cache').select('hash, texto').eq('idioma', idioma).in('hash', [...new Set(hashes)])
  const mapa = new Map((guardadas || []).map(g => [g.hash as string, g.texto as string]))

  // Faltantes (únicos y no vacíos)
  const faltan: { i: number; t: string; h: string }[] = []
  const vistos = new Set<string>()
  textos.forEach((t, i) => {
    if (!t.trim()) return
    const h = hashes[i]
    if (mapa.has(h)) { resultado[i] = mapa.get(h)!; return }
    if (!vistos.has(h)) { vistos.add(h); faltan.push({ i, t, h }) }
  })

  if (faltan.length) {
    const lenguaje = idioma === 'en' ? 'English' : 'Spanish (Latin America)'
    const sistema =
      `You translate short texts from a child therapy app (ABA programs, goals, home instructions) into ${lenguaje}. ` +
      'Keep codes and numbering exactly as they are (e.g. "B10.", "Set 2", "F5."), keep proper names, use plain parent-friendly wording. ' +
      'If a text is already in the target language, return it unchanged. Reply ONLY with a JSON array of strings, same order and same length as the input.'
    // Lotes pequeños en paralelo: una sola llamada con muchos textos se corta a mitad
    const lotes: typeof faltan[] = []
    for (let k = 0; k < faltan.length; k += 12) lotes.push(faltan.slice(k, k + 12))
    await Promise.all(lotes.map(async lote => {
      try {
        const raw = await callGroqSimple(sistema, JSON.stringify(lote.map(f => f.t)), { model: GROQ_MODELS.FAST, temperature: 0.1, maxTokens: 3000 })
        const inicio = raw.indexOf('['), fin = raw.lastIndexOf(']')
        const lista = JSON.parse(raw.slice(inicio, fin + 1))
        if (!Array.isArray(lista) || lista.length !== lote.length) return
        const filas = lote.map((f, k) => ({ hash: f.h, idioma, texto: String(lista[k] ?? f.t) }))
        await supabaseAdmin.from('traducciones_cache').upsert(filas)
        filas.forEach(f => mapa.set(f.hash, f.texto))
      } catch (e) {
        console.warn('[traducir]', (e as Error).message) // sin traducción: se muestra el original
      }
    }))
    textos.forEach((t, i) => { if (mapa.has(hashes[i])) resultado[i] = mapa.get(hashes[i])! })
  }
  return NextResponse.json({ textos: resultado }, { headers: { 'Cache-Control': 'private, max-age=300' } })
}
