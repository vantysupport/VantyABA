// lib/rate-limit.ts
// ════════════════════════════════════════════════════════════════════════════
// 🚦 Rate limiter dual: Upstash Redis (producción) + in-memory (dev/fallback)
//
// Si las variables UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN están
// configuradas, usa Upstash (compartido entre instancias serverless).
// Si no, cae a un Map en memoria del proceso (suficiente para dev / single instance).
//
// Configurá Upstash gratis en https://console.upstash.com (10K requests/día gratis).
// ════════════════════════════════════════════════════════════════════════════

type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number // timestamp ms cuando se resetea
}

// ─── Backend en memoria (fallback) ─────────────────────────────────────────
const memoryStore = new Map<string, { count: number; resetAt: number }>()

// Limpieza periódica de entradas expiradas (cada 5 min)
let cleanupTimer: NodeJS.Timeout | null = null
if (typeof setInterval !== 'undefined' && !cleanupTimer) {
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, val] of memoryStore.entries()) {
      if (val.resetAt < now) memoryStore.delete(key)
    }
  }, 5 * 60 * 1000)
  // En dev / hot-reload no acumular timers
  if (typeof (cleanupTimer as any).unref === 'function') (cleanupTimer as any).unref()
}

async function memoryRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now()
  const entry = memoryStore.get(key)
  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, limit, remaining: limit - 1, resetAt: now + windowMs }
  }
  entry.count++
  return {
    allowed: entry.count <= limit,
    limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  }
}

// ─── Backend Upstash Redis ─────────────────────────────────────────────────
async function upstashRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  try {
    const ttlSec = Math.ceil(windowMs / 1000)
    // INCR + EXPIRE NX en una sola llamada via pipeline
    const resp = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, ttlSec, 'NX'],
        ['PTTL', key],
      ]),
    })
    if (!resp.ok) return null
    const result = await resp.json() as Array<{ result: number | string }>
    const count = Number(result[0]?.result || 0)
    const pttl = Number(result[2]?.result || windowMs)
    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt: Date.now() + (pttl > 0 ? pttl : windowMs),
    }
  } catch {
    return null
  }
}

// ─── API pública ────────────────────────────────────────────────────────────
export type RateLimitConfig = {
  /** Identificador único del rate limit (ej: 'login', 'parent-chat'). */
  name: string
  /** Máximo de requests permitidos en la ventana. */
  limit: number
  /** Ventana de tiempo en milisegundos. */
  windowMs: number
}

/**
 * Comprueba si una IP/usuario está bajo rate limit.
 * @param identifier IP del cliente, user.id, o cualquier string único.
 * @param config configuración del límite.
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const key = `rl:${config.name}:${identifier}`
  const upstash = await upstashRateLimit(key, config.limit, config.windowMs)
  if (upstash) return upstash
  return memoryRateLimit(key, config.limit, config.windowMs)
}

// Presets comunes para reutilizar. Se cuentan por IP: en un taller, una universidad o una clínica muchas
// personas salen por la MISMA IP (Wi-Fi compartido), así que los topes contemplan un grupo, no una sola
// persona. El gasto real lo siguen acotando los topes diarios por usuario y por centro (ARIA, informes, tokens).
export const RATE_LIMITS = {
  // Invitaciones y Libro de Reclamaciones: 30 cada 15 min (anti fuerza bruta; los tokens son aleatorios)
  LOGIN:          { name: 'login',          limit: 30,   windowMs: 15 * 60 * 1000 },
  // Chat con ARIA / VADI: 400 mensajes por hora por red (cada persona tiene además su tope diario)
  AI_CHAT:        { name: 'ai-chat',        limit: 400,  windowMs: 60 * 60 * 1000 },
  // Generación de reportes Word: 120 por hora por red (costoso; cada centro tiene su cupo mensual)
  REPORT_GENERATION: { name: 'report-gen',  limit: 120,  windowMs: 60 * 60 * 1000 },
  // OCR de documentos: 120 por hora por red
  OCR:            { name: 'ocr',            limit: 120,  windowMs: 60 * 60 * 1000 },
  // API genérica: 1500 por minuto por red (un panel abierto hace varias llamadas por pantalla)
  API_GENERIC:    { name: 'api-generic',    limit: 1500, windowMs: 60 * 1000 },
  // Verificación pública de QR: 100 por hora por IP (anti-scraping)
  PUBLIC_VERIFY:  { name: 'public-verify',  limit: 100,  windowMs: 60 * 60 * 1000 },
} as const satisfies Record<string, RateLimitConfig>

/**
 * Helper: extraer IP del request (Vercel/Next.js).
 */
export function getClientIP(req: Request | { headers: Headers | Record<string, string> }): string {
  const headers: any = (req as any).headers
  const get = (k: string): string | null => {
    if (headers instanceof Headers) return headers.get(k)
    return headers?.[k] || headers?.[k.toLowerCase()] || null
  }
  const xff = get('x-forwarded-for') || get('x-real-ip') || get('cf-connecting-ip')
  if (xff) return xff.split(',')[0].trim()
  return 'unknown'
}
