import 'server-only'
// Espacio usado por un centro contra los límites de su plan:
//  · archivos (R2): suma de file_size de documentos de pacientes y adjuntos del chat con familias
//  · datos (base): centros.uso_datos_bytes, recalculado con actualizar_uso_centro() si tiene más de 6 h
// La base bloquea inserciones cuando se supera el límite de datos (trigger zz_limite_datos).

import { supabaseAdmin } from '@/lib/supabase-admin'
import { limitesCentro } from '@/lib/limites-centro'

const RECALCULAR_CADA_MS = 6 * 60 * 60 * 1000
const MB = 1024 * 1024

async function sumar(tabla: 'patient_documents' | 'chat_familias', centroId: string): Promise<number> {
  let total = 0
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabaseAdmin.from(tabla).select('file_size').eq('centro_id', centroId).not('file_size', 'is', null).range(desde, desde + 999)
    if (error || !data?.length) break
    for (const r of data as { file_size: number | null }[]) total += Number(r.file_size || 0)
    if (data.length < 1000) break
  }
  return total
}

export type UsoEspacio = {
  archivos: { used: number; cap: number | null; breakdown: { documentos: number; chats: number } }
  datos: { used: number; cap: number | null; calculadoAt: string | null }
}

export async function usoEspacio(centroId: string, opts: { forzarDatos?: boolean } = {}): Promise<UsoEspacio> {
  const [documentos, chats, { data: c }, plan] = await Promise.all([
    sumar('patient_documents', centroId),
    sumar('chat_familias', centroId),
    supabaseAdmin.from('centros').select('uso_datos_bytes, uso_calculado_at').eq('id', centroId).maybeSingle(),
    limitesCentro(centroId),
  ])

  let datosUsados = Number(c?.uso_datos_bytes || 0)
  let calculadoAt = (c?.uso_calculado_at as string | null) ?? null
  const viejo = !calculadoAt || Date.now() - new Date(calculadoAt).getTime() > RECALCULAR_CADA_MS
  if (opts.forzarDatos || viejo) {
    const { data } = await supabaseAdmin.rpc('actualizar_uso_centro', { p_centro: centroId })
    if (typeof data === 'number' || typeof data === 'string') { datosUsados = Number(data); calculadoAt = new Date().toISOString() }
  }

  return {
    archivos: { used: documentos + chats, cap: plan?.max_storage_mb ? plan.max_storage_mb * MB : null, breakdown: { documentos, chats } },
    datos: { used: datosUsados, cap: plan?.max_db_mb ? plan.max_db_mb * MB : null, calculadoAt },
  }
}

/** ¿Cabe un archivo nuevo de `bytes` en el espacio de archivos del centro? */
export async function cabeArchivo(centroId: string, bytes: number): Promise<{ ok: boolean; used: number; cap: number | null }> {
  const u = await usoEspacio(centroId)
  const { used, cap } = u.archivos
  return { ok: cap == null || used + bytes <= cap, used, cap }
}
