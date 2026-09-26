// app/api/translate-form/route.ts
// Traduce un lote de textos de formulario a inglés con IA. Cachea por hash del
// texto en la tabla knowledge_chunks? No — usa una tabla propia liviana o cae a
// traducir siempre (el cliente cachea en localStorage, así que aquí se llama
// como mucho una vez por formulario por navegador).

import { NextRequest, NextResponse } from 'next/server'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { getApiCaller, unauthorized, forbidden } from '@/lib/api-auth'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!caller.centroId) return forbidden()
  try {
    const { texts, target } = await req.json()
    if (!Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ translations: [] })
    }
    if (String(target || 'en').toLowerCase() !== 'en') {
      // Solo soportamos ES→EN por ahora; devolver igual.
      return NextResponse.json({ translations: texts })
    }

    // Traducir en lotes de ~40 para no exceder tokens.
    const BATCH = 40
    const out: string[] = []
    for (let i = 0; i < texts.length; i += BATCH) {
      const lote = texts.slice(i, i + BATCH)
      const prompt =
        `Translate each item of the following JSON array from Spanish to professional clinical English. ` +
        `These are labels, questions and options of an ABA/neurodevelopment assessment form. ` +
        `Keep clinical terminology accurate. Return ONLY a JSON array of strings with the SAME length and order, nothing else.\n\n` +
        JSON.stringify(lote)
      let translated: string[] = lote
      try {
        const raw = await callGroqSimple(
          'You are a professional clinical translator (Spanish→English) specialized in ABA, autism and ADHD assessment. You return only valid JSON arrays.',
          prompt,
          { model: GROQ_MODELS.SMART, temperature: 0.1, maxTokens: 3000 }
        )
        const match = (raw || '').match(/\[[\s\S]*\]/)
        if (match) {
          const arr = JSON.parse(match[0])
          if (Array.isArray(arr) && arr.length === lote.length) translated = arr.map((x: any) => String(x))
        }
      } catch { /* si falla el lote, devolvemos el original de ese lote */ }
      out.push(...translated)
    }

    return NextResponse.json({ translations: out })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === 'production' ? 'Error' : e.message }, { status: 500 })
  }
}
