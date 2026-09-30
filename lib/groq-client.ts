// lib/groq-client.ts
// Cliente de IA: Groq con fallback automático entre modelos cuando se agota el límite, y DeepInfra como
// respaldo si Groq se queda sin cupo, falla o no está configurado (lib/proveedores-ia.ts).

import { logServerError } from '@/lib/log-server-error'
import { iaDesactivadaAhora, notaSinIA } from '@/lib/ia-contexto'
import { modeloDeepInfra, proveedoresIA, type ProveedorIA } from '@/lib/proveedores-ia'

// Cadena de fallback: si el modelo principal falla por rate limit,
// se prueba automáticamente el siguiente en la lista.
// ACTUALIZADO (ago 2026): llama-3.3-70b-versatile y llama-3.1-8b-instant
// fueron deprecados por Groq (anuncio 17/jun/2026). Reemplazados por gpt-oss.
export const GROQ_MODELS = {
  SMART: 'openai/gpt-oss-120b',   // reportes, análisis clínicos
  FAST:  'openai/gpt-oss-20b',    // chats rápidos
  LONG:  'openai/gpt-oss-120b',   // contexto largo
  // Modelo "compound" de Groq: agente con BÚSQUEDA WEB + ejecución de código integrados.
  // Útil cuando la pregunta requiere info actualizada (research reciente, news, datos en vivo).
  // Cuesta lo mismo que un modelo normal en el plan free pero tarda un poco más.
  WEB:   'groq/compound-mini',
}

// Orden de fallback cuando se alcanza el límite de tokens/día o el contexto es muy grande
// Modelos ordenados por TPM (tokens-per-minute) DESCENDENTE — los grandes primero
// para que el contexto largo no choque con límites de modelos chicos.
// Solo modelos activos en producción (agosto 2026)
const FALLBACK_CHAIN = [
  'openai/gpt-oss-120b',        // alto TPM · máxima capacidad de contexto — modelo principal
  'openai/gpt-oss-20b',         // medio/bajo · último recurso (puede fallar con contexto grande)
]

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Info de un 429 — distingue límite por minuto (se resuelve solo en segundos) de límite diario. */
type RateLimitInfo = {
  rateLimited: true
  model: string
  rawMessage: string
  /** true = TPM/RPM (por minuto, se resuelve rápido) · false = TPD/RPD (diario, se resetea a medianoche UTC) */
  isPerMinute: boolean
  /** segundos de espera reportados por Groq, si los incluyó */
  retryAfterSeconds: number | null
}

function parseRateLimitInfo(model: string, rawMessage: string, retryAfterHeader: string | null): RateLimitInfo {
  const isPerMinute = /\b(TPM|RPM)\b/i.test(rawMessage)

  // Groq suele incluir algo como "Please try again in 6m11.52s" — lo parseamos a segundos.
  let retryAfterSeconds: number | null = retryAfterHeader ? Number(retryAfterHeader) : null
  if (retryAfterSeconds === null || Number.isNaN(retryAfterSeconds)) {
    const match = rawMessage.match(/try again in\s+(?:([\d.]+)m)?(?:([\d.]+)s)?/i)
    if (match) {
      const mins = match[1] ? parseFloat(match[1]) : 0
      const secs = match[2] ? parseFloat(match[2]) : 0
      if (mins || secs) retryAfterSeconds = Math.ceil(mins * 60 + secs)
    }
  }

  return { rateLimited: true, model, rawMessage, isPerMinute, retryAfterSeconds }
}

// Intentar un modelo específico — retorna { text } si funcionó, o RateLimitInfo si hubo 429/413
// (para registrar y probar el siguiente modelo). Lanza solo en errores NO recuperables.
async function tryModel(
  proveedor: ProveedorIA,
  model: string,
  messages: GroqMessage[],
  temperature: number,
  maxTokens: number,
): Promise<{ text: string } | RateLimitInfo> {
  try {
    const res = await fetch(proveedor.url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${proveedor.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: false }),
    })

    if (res.status === 429) {
      const err = await res.json().catch(() => ({}))
      const rawMsg: string = err?.error?.message || ''
      const info = parseRateLimitInfo(model, rawMsg, res.headers.get('retry-after'))
      console.warn(`[IA:${proveedor.id}] Rate limit en ${model}: ${rawMsg || '429'}`)
      return info
    }

    // 413 = Request too large — el modelo no acepta el tamaño del contexto.
    //       Probamos con el siguiente (puede tener más TPM o contexto).
    if (res.status === 413) {
      const err = await res.json().catch(() => ({}))
      const rawMsg: string = err?.error?.message || '413'
      console.warn(`[IA:${proveedor.id}] Payload too large en ${model}: ${rawMsg}`)
      return { rateLimited: true, model, rawMessage: rawMsg, isPerMinute: false, retryAfterSeconds: null }
    }

    // 404 = modelo inexistente o deprecado/decommissioned en la cuenta.
    //       Lo tratamos como "no disponible" y probamos el siguiente modelo,
    //       en vez de tirar un error duro al usuario final.
    if (res.status === 404) {
      const err = await res.json().catch(() => ({}))
      const rawMsg: string = err?.error?.message || '404'
      console.warn(`[IA:${proveedor.id}] Modelo no disponible/decommissioned: ${model}: ${rawMsg}`)
      return { rateLimited: true, model, rawMessage: rawMsg, isPerMinute: false, retryAfterSeconds: null }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
      throw new Error(`${proveedor.id} error ${res.status} (${model}): ${err?.error?.message || res.statusText}`)
    }

    const data = await res.json()
    return { text: data.choices?.[0]?.message?.content || '' }
  } catch (err: any) {
    const msg = String(err?.message || '')
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('413') || msg.includes('too large')) {
      return { rateLimited: true, model, rawMessage: msg, isPerMinute: /\b(TPM|RPM)\b/i.test(msg), retryAfterSeconds: null }
    }
    throw err
  }
}

/** Error tipado para que las rutas /api puedan mostrar al usuario un mensaje amable y simple,
 *  mientras el detalle técnico completo va al panel del programador (error_logs). */
export class GroqExhaustedError extends Error {
  /** true si TODOS los modelos chocaron con límite por minuto (se resuelve en breve) */
  isPerMinute: boolean
  /** segundos estimados hasta poder reintentar — null si es límite diario o desconocido */
  retryAfterSeconds: number | null
  constructor(isPerMinute: boolean, retryAfterSeconds: number | null, technicalMessage: string) {
    super(technicalMessage)
    this.name = 'GroqExhaustedError'
    this.isPerMinute = isPerMinute
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export async function callGroq(
  messages: GroqMessage[],
  options: {
    model?: string
    temperature?: number
    maxTokens?: number
    maxRetries?: number
  } = {}
): Promise<string> {
  // IA no autorizada por el centro: no se envía nada al proveedor (ver lib/ia-contexto.ts)
  if (iaDesactivadaAhora()) return notaSinIA()
  const {
    model = GROQ_MODELS.SMART,
    temperature = 0.5,
    maxTokens = 2500,
  } = options

  const proveedores = proveedoresIA()
  if (proveedores.length === 0) {
    await logServerError('IA sin configurar', 'Faltan GROQ_API_KEY y DEEPINFRA_API_KEY', 'groq')
    throw new Error('GROQ_API_KEY no configurada')
  }

  const rateLimitHits: RateLimitInfo[] = []

  for (const [n, proveedor] of proveedores.entries()) {
    const ultimo = n === proveedores.length - 1
    // Groq: modelo preferido y luego la cadena de fallback. DeepInfra: los equivalentes.
    const modelsToTry = proveedor.id === 'groq'
      ? [model, ...FALLBACK_CHAIN.filter(m => m !== model)]
      : [...new Set([model, ...FALLBACK_CHAIN].map(modeloDeepInfra))]

    for (const currentModel of modelsToTry) {
      let result: { text: string } | RateLimitInfo
      try {
        result = await tryModel(proveedor, currentModel, messages, temperature, maxTokens)
      } catch (err) {
        // Error NO recuperable (no es rate limit): se registra y se pasa al proveedor de respaldo, si hay.
        await logServerError(`IA error ${proveedor.id} (${currentModel})`, (err as Error)?.stack || (err as Error)?.message || String(err), 'groq')
        if (ultimo) throw err
        break
      }
      if ('text' in result) {
        if (currentModel !== model || n > 0) {
          console.info(`[IA] Usando respaldo: ${proveedor.id} · ${currentModel} (preferido: groq · ${model})`)
        }
        return result.text
      }
      // Era rate limit / payload too large / modelo no disponible → registrar y probar el siguiente modelo
      rateLimitHits.push({ ...result, model: `${proveedor.id} · ${result.model}` })
    }
  }

  // Todos los modelos fallaron. Determinar si es por-minuto (se resuelve solo)
  // o diario (se resetea a medianoche UTC) para dar el mensaje correcto al programador y al usuario.
  const allPerMinute = rateLimitHits.length > 0 && rateLimitHits.every(h => h.isPerMinute)
  const bestRetry = rateLimitHits.reduce<number | null>((min, h) => {
    if (h.retryAfterSeconds == null) return min
    if (min == null) return h.retryAfterSeconds
    return Math.min(min, h.retryAfterSeconds)
  }, null)

  const detail = rateLimitHits.map(h => `${h.model}: ${h.rawMessage || '(sin detalle)'}`).join('\n')
  const summary = allPerMinute
    ? `Groq: límite por minuto (TPM/RPM) alcanzado en todos los modelos${bestRetry ? ` — se libera en ~${bestRetry}s` : ''}`
    : 'Groq: límite diario (TPD/RPD) agotado, modelo no disponible, o ambos, en todos los modelos de la cadena'

  await logServerError(summary, detail, 'groq')

  throw new GroqExhaustedError(allPerMinute, bestRetry, summary)
}

// Helper para prompt simple (sistema + usuario)
export async function callGroqSimple(
  systemPrompt: string,
  userPrompt: string,
  options: Parameters<typeof callGroq>[1] = {}
): Promise<string> {
  return callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    options
  )
}