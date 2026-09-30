// Proveedores de IA (API compatible con OpenAI). Groq es el principal; DeepInfra, el respaldo automático
// cuando Groq se queda sin cupo, falla o no está configurado. Mismos modelos abiertos (gpt-oss) en ambos.
// Variables: GROQ_API_KEY, DEEPINFRA_API_KEY y, opcionalmente, DEEPINFRA_MODEL / DEEPINFRA_MODEL_FAST /
// DEEPINFRA_VISION_MODEL si DeepInfra cambia el nombre de un modelo.

export type IdProveedor = 'groq' | 'deepinfra'
export type ProveedorIA = { id: IdProveedor; url: string; key: string }

const URLS: Record<IdProveedor, string> = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  deepinfra: 'https://api.deepinfra.com/v1/openai/chat/completions',
}

/** Proveedores configurados, en orden de preferencia. */
export function proveedoresIA(): ProveedorIA[] {
  const lista: ProveedorIA[] = []
  if (process.env.GROQ_API_KEY) lista.push({ id: 'groq', url: URLS.groq, key: process.env.GROQ_API_KEY })
  if (process.env.DEEPINFRA_API_KEY) lista.push({ id: 'deepinfra', url: URLS.deepinfra, key: process.env.DEEPINFRA_API_KEY })
  return lista
}

/** Nombre del modelo equivalente en DeepInfra (los modelos de Groq sin equivalente usan el principal). */
export function modeloDeepInfra(modeloGroq: string): string {
  const principal = process.env.DEEPINFRA_MODEL || 'openai/gpt-oss-120b'
  const rapido = process.env.DEEPINFRA_MODEL_FAST || 'openai/gpt-oss-20b'
  return modeloGroq === 'openai/gpt-oss-20b' ? rapido : principal
}

/** Modelo de visión (lectura de documentos) en DeepInfra. */
export const modeloVisionDeepInfra = () => process.env.DEEPINFRA_VISION_MODEL || 'Qwen/Qwen2.5-VL-32B-Instruct'
