// lib/embeddings.ts
// Embeddings locales: el modelo corre dentro del servidor (sin API, sin costo por uso, sin límites).
// Multilingüe (ES/EN, cross-lingual): una búsqueda en inglés encuentra texto en español y viceversa.
// 768 dimensiones — compatible con la columna knowledge_chunks.embedding.

import os from 'node:os'
import path from 'node:path'

export const EMBED_MODEL = 'Xenova/paraphrase-multilingual-mpnet-base-v2'
export const EMBED_DIMS = 768

type Extractor = (texts: string | string[], opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][] }>
let extractorPromise: Promise<Extractor> | null = null

function getExtractor(): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers')
      // En serverless solo /tmp es escribible; en local se cachea dentro del proyecto.
      env.cacheDir = process.env.EMBEDDINGS_CACHE_DIR
        || (process.env.VERCEL ? path.join(os.tmpdir(), 'vanty-models') : path.join(process.cwd(), '.cache', 'models'))
      const pipe = await pipeline('feature-extraction', EMBED_MODEL, { dtype: 'q8' })
      return pipe as unknown as Extractor
    })().catch(e => { extractorPromise = null; throw e })
  }
  return extractorPromise
}

/** Vectores normalizados (similitud coseno = producto punto). Devuelve [] por texto vacío. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const clean = texts.map(t => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 2000))
  if (clean.every(t => !t)) return clean.map(() => [])
  const extractor = await getExtractor()
  const out = await extractor(clean.map(t => t || ' '), { pooling: 'mean', normalize: true })
  return out.tolist().map((v, i) => (clean[i] ? v : []))
}

export async function embedText(text: string): Promise<number[]> {
  return (await embedTexts([text]))[0] ?? []
}
