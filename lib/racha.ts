// Racha de práctica en casa (estilo Duolingo): días seguidos en los que la familia registró actividad
// con el niño — práctica de programas ABA, tareas para casa completadas o actividades del plan de engagement.

import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'

export type Racha = { dias: number; hoy: boolean }

const menosDias = (fecha: string, n: number) => {
  const d = new Date(`${fecha}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10)
}

/** Días con actividad (YYYY-MM-DD) de esos niños en los últimos `ventana` días. */
export async function diasConActividad(childIds: string[], hoy: string, ventana = 90): Promise<Set<string>> {
  const dias = new Set<string>()
  if (childIds.length === 0) return dias
  const desde = menosDias(hoy, ventana)
  const [practica, tareas, engagement] = await Promise.all([
    supabaseAdmin.from('programa_practica_casa').select('fecha').in('child_id', childIds).gte('fecha', desde),
    supabaseAdmin.from('tareas_hogar').select('fecha_completada').in('child_id', childIds).eq('completada', true).gte('fecha_completada', desde),
    supabaseAdmin.from('engagement_actividades').select('fecha').in('child_id', childIds).eq('completada', true).gte('fecha', desde),
  ])
  for (const r of practica.data ?? []) if (r.fecha) dias.add(String(r.fecha).slice(0, 10))
  for (const r of tareas.data ?? []) if (r.fecha_completada) dias.add(String(r.fecha_completada).slice(0, 10))
  for (const r of engagement.data ?? []) if (r.fecha) dias.add(String(r.fecha).slice(0, 10))
  return dias
}

/** Racha actual: cuenta hacia atrás desde hoy (o desde ayer si hoy todavía no practicaron). */
export function calcularRacha(dias: Set<string>, hoy: string): Racha {
  const practicoHoy = dias.has(hoy)
  let n = 0
  let cursor = practicoHoy ? hoy : menosDias(hoy, 1)
  while (dias.has(cursor)) { n++; cursor = menosDias(cursor, 1) }
  return { dias: n, hoy: practicoHoy }
}

export async function rachaDe(childIds: string[], hoy: string): Promise<Racha> {
  return calcularRacha(await diasConActividad(childIds, hoy), hoy)
}
