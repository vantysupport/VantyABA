import 'server-only'
// Cifrado de datos clínicos a nivel de aplicación (AES-256-GCM).
//
// · Cada centro tiene su propia clave de datos (DEK) de 256 bits, guardada en centro_claves
//   CIFRADA con la clave maestra (VANTY_MASTER_KEY, solo en el servidor / .env.local).
// · Un campo cifrado se guarda como  enc:v1:<centro_id>:<base64(iv | tag | texto cifrado)>
//   El centro_id va como dato autenticado (AAD): si alguien mueve el valor a otro centro, no descifra.
// · Si se pierde la clave maestra, los datos cifrados NO se pueden recuperar.
//
// El cliente de base del servidor (lib/supabase-admin) usa esto para cifrar al escribir y
// descifrar al leer los campos listados en CAMPOS_CIFRADOS, sin que cada ruta tenga que hacerlo.

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'

export const PREFIJO = 'enc:v1:'
const PREFIJO_DEK = 'dek:v1:'

/** Tabla → columnas de texto que se guardan cifradas. */
export const CAMPOS_CIFRADOS: Record<string, string[]> = {
  sesiones_datos_aba: ['notas'],
  programas_aba: ['notas_procedimiento', 'notas_programa'],
  objetivos_cp: ['notas'],
  chat_especialista_admin: ['content'],
  chat_familias: ['content'],
  // Fase 3
  children: ['notas'],
  patient_documents: ['extracted_text'],
  agente_conversaciones: ['titulo', 'contexto', 'mensajes'],
  evaluaciones_iniciales: [
    'respuestas_intake', 'anamnesis_especifica', 'recomendacion_razon', 'recomendacion_resumen', 'recomendacion_areas',
    'mensaje_al_especialista', 'mensaje_amigable_padre', 'documento_md', 'respuesta_especialista',
    'terapias_recomendadas_razon', 'nota_cambio_terapias',
  ],
}

// Cliente propio y sin interceptor (evita la dependencia circular con lib/supabase-admin).
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function claveMaestra(): Buffer | null {
  const b64 = process.env.VANTY_MASTER_KEY
  if (!b64) return null
  const k = Buffer.from(b64, 'base64')
  return k.length === 32 ? k : null
}

export const cifradoActivo = () => !!claveMaestra()

function sellar(clave: Buffer, datos: Buffer, aad?: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', clave, iv)
  if (aad) c.setAAD(Buffer.from(aad))
  const ct = Buffer.concat([c.update(datos), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64')
}

function abrir(clave: Buffer, b64: string, aad?: string): Buffer {
  const raw = Buffer.from(b64, 'base64')
  const d = createDecipheriv('aes-256-gcm', clave, raw.subarray(0, 12))
  if (aad) d.setAAD(Buffer.from(aad))
  d.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([d.update(raw.subarray(28)), d.final()])
}

// ── Claves por centro ────────────────────────────────────────────────────────
const cacheDek = new Map<string, Promise<Buffer>>()

async function crearOLeerDek(centroId: string): Promise<Buffer> {
  const maestra = claveMaestra()
  if (!maestra) throw new Error('VANTY_MASTER_KEY no configurada')
  const leer = async () => {
    const { data, error } = await db.from('centro_claves').select('dek').eq('centro_id', centroId).maybeSingle()
    if (error) throw error
    return data?.dek as string | undefined
  }
  let envuelta = await leer()
  if (!envuelta) {
    const nueva = PREFIJO_DEK + sellar(maestra, randomBytes(32), `dek:${centroId}`)
    await db.from('centro_claves').upsert({ centro_id: centroId, dek: nueva }, { onConflict: 'centro_id', ignoreDuplicates: true })
    envuelta = await leer() // si dos procesos la crearon a la vez, gana la que quedó guardada
  }
  if (!envuelta?.startsWith(PREFIJO_DEK)) throw new Error('Clave del centro inválida')
  return abrir(maestra, envuelta.slice(PREFIJO_DEK.length), `dek:${centroId}`)
}

function dekDe(centroId: string): Promise<Buffer> {
  let p = cacheDek.get(centroId)
  if (!p) {
    p = crearOLeerDek(centroId)
    p.catch(() => cacheDek.delete(centroId))
    cacheDek.set(centroId, p)
  }
  return p
}

// ── API ──────────────────────────────────────────────────────────────────────
const UUID = /^[0-9a-f-]{36}$/i

export const estaCifrado = (v: unknown): v is string => typeof v === 'string' && v.startsWith(PREFIJO)

const PREFIJO_JSON = 'json:'
const PREFIJO_TXT = 'txt:'

/** Cifra un texto (o un objeto/arreglo JSON) para un centro. Vacíos y valores ya cifrados se devuelven tal cual. */
export async function cifrar(centroId: string, valor: unknown): Promise<unknown> {
  if (!cifradoActivo() || !UUID.test(centroId) || valor == null || estaCifrado(valor)) return valor
  let texto: string
  if (typeof valor === 'string') {
    if (valor === '') return valor
    // Un texto que empiece como JSON se marca para no confundirlo al descifrar
    texto = valor.startsWith(PREFIJO_JSON) || valor.startsWith(PREFIJO_TXT) ? PREFIJO_TXT + valor : valor
  } else if (typeof valor === 'object') {
    texto = PREFIJO_JSON + JSON.stringify(valor)
  } else {
    return valor
  }
  const dek = await dekDe(centroId)
  return `${PREFIJO}${centroId}:${sellar(dek, Buffer.from(texto, 'utf8'), centroId)}`
}

/** Descifra un valor; si no está cifrado lo devuelve igual. */
export async function descifrar(valor: unknown): Promise<unknown> {
  if (!estaCifrado(valor)) return valor
  const resto = valor.slice(PREFIJO.length)
  const i = resto.indexOf(':')
  const centroId = resto.slice(0, i)
  if (i < 0 || !UUID.test(centroId)) return valor
  try {
    const dek = await dekDe(centroId)
    const texto = abrir(dek, resto.slice(i + 1), centroId).toString('utf8')
    if (texto.startsWith(PREFIJO_JSON)) return JSON.parse(texto.slice(PREFIJO_JSON.length))
    if (texto.startsWith(PREFIJO_TXT)) return texto.slice(PREFIJO_TXT.length)
    return texto
  } catch {
    return '' // clave incorrecta o dato alterado: nunca devolver el texto cifrado a la pantalla
  }
}

/** Recorre un resultado (objetos/arrays) y descifra todos los textos cifrados que encuentre. */
export async function descifrarProfundo<T>(x: T): Promise<T> {
  if (estaCifrado(x)) return (await descifrar(x)) as T
  if (Array.isArray(x)) return (await Promise.all(x.map(descifrarProfundo))) as T
  if (x && typeof x === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) out[k] = await descifrarProfundo(v)
    return out as T
  }
  return x
}
