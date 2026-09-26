// lib/supabase-admin.ts — cliente con la clave de servicio (SOLO servidor: API routes y server actions).
//
// Pasa por un interceptor de red que aplica el cifrado de datos clínicos (lib/cifrado):
//  · al ESCRIBIR (insert/upsert/update) en una tabla de CAMPOS_CIFRADOS, cifra esas columnas;
//  · al LEER cualquier resultado, descifra los textos cifrados que traiga.
// Así ninguna ruta tiene que acordarse de cifrar o descifrar por su cuenta.

import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { CAMPOS_CIFRADOS, PREFIJO, cifrar, cifradoActivo, descifrarProfundo } from '@/lib/cifrado'

const REST = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`

type Fila = Record<string, unknown>

async function cifrarFilas(filas: Fila[], campos: string[], centroFallback: string | null) {
  for (const f of filas) {
    const centro = (typeof f.centro_id === 'string' ? f.centro_id : null) ?? centroFallback
    if (!centro) continue
    for (const c of campos) if (c in f) f[c] = await cifrar(centro, f[c])
  }
}

// Para un UPDATE sin centro_id en el cuerpo: averigua el centro de las filas afectadas (mismos filtros).
async function centroDeFiltro(url: URL, headers: HeadersInit | undefined): Promise<string | null> {
  const u = new URL(url)
  u.searchParams.set('select', 'centro_id')
  u.searchParams.delete('columns')
  const h = new Headers(headers)
  h.delete('Prefer'); h.delete('Content-Type'); h.delete('Content-Length')
  h.set('Accept', 'application/json') // siempre una lista (una edición con .single() pide un objeto)
  const res = await fetch(u, { method: 'GET', headers: h })
  if (!res.ok) return null
  const json = await res.json().catch(() => [])
  const filas = (Array.isArray(json) ? json : [json]) as { centro_id?: string | null }[]
  const centros = [...new Set(filas.map(f => f.centro_id).filter(Boolean))]
  return centros.length === 1 ? (centros[0] as string) : null
}

const fetchCifrado: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  const esRest = url.href.startsWith(REST)
  let body = init?.body

  // Escritura: cifrar columnas sensibles
  const tabla = esRest ? decodeURIComponent(url.pathname.slice(new URL(REST).pathname.length)) : ''
  const campos = CAMPOS_CIFRADOS[tabla]
  const metodo = (init?.method || 'GET').toUpperCase()
  const cuerpo = typeof body === 'string' ? body : null
  if (campos && cifradoActivo() && (metodo === 'POST' || metodo === 'PATCH') && cuerpo && campos.some(c => cuerpo.includes(`"${c}"`))) {
    try {
      const datos = JSON.parse(cuerpo) as Fila | Fila[]
      const filas = Array.isArray(datos) ? datos : [datos]
      const sinCentro = filas.some(f => typeof f.centro_id !== 'string')
      const centro = sinCentro && metodo === 'PATCH' ? await centroDeFiltro(url, init?.headers) : null
      await cifrarFilas(filas, campos, centro)
      body = JSON.stringify(Array.isArray(datos) ? filas : filas[0])
    } catch { /* si algo falla, se guarda como venía */ }
  }

  const res = await fetch(input, { ...init, body })

  // Lectura: descifrar lo que venga cifrado.
  // Respuestas sin cuerpo (204 al borrar/actualizar sin devolver filas) pasan tal cual:
  // no se pueden reconstruir con cuerpo y romperían la operación.
  if (!esRest || [101, 204, 205, 304].includes(res.status) || !(res.headers.get('content-type') || '').includes('json')) return res
  const texto = await res.text()
  if (!texto.includes(PREFIJO)) return new Response(texto, { status: res.status, statusText: res.statusText, headers: res.headers })
  let salida = texto
  try { salida = JSON.stringify(await descifrarProfundo(JSON.parse(texto))) } catch { /* devolver tal cual */ }
  const headers = new Headers(res.headers)
  headers.delete('content-length')
  return new Response(salida, { status: res.status, statusText: res.statusText, headers })
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchCifrado },
  }
)
