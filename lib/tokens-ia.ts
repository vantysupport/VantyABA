import 'server-only'
// Tokens de análisis del centro: los usan Predicciones, Patrones ABA, Objetivos IA, Reportes IA y los análisis IA de evaluaciones.
// 1 generación exitosa = 1 token. Primero los del mes (límite del plan o propio del centro),
// después los comprados. Sin tokens → 402 con code 'quota_exhausted' (la UI ofrece comprar).

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { iaDesactivadaAhora } from '@/lib/ia-contexto'
import { avisarTokensAgotados } from '@/lib/correo-tokens'

/** Devuelve la respuesta 402 si el centro no tiene tokens; null si puede generar. */
export async function sinTokens(centroId: string | null, en: boolean): Promise<NextResponse | null> {
  // Informe generado sin IA (el centro no la activó): no usa tokens de análisis
  if (!centroId || iaDesactivadaAhora()) return null
  const { data } = await supabaseAdmin.rpc('ai_quota_estado', { p_centro: centroId, p_kind: 'predictive' })
  const disp = (data as { disponible: number | null } | null)?.disponible
  if (disp == null || disp > 0) return null
  avisarTokensAgotados('analisis', { centroId })
  return NextResponse.json({
    error: en
      ? 'Your center has no analysis tokens left this month. Buy more to continue.'
      : 'Tu centro no tiene tokens de análisis este mes. Compra más para continuar.',
    code: 'quota_exhausted',
  }, { status: 402 })
}

/** Descuenta 1 token (llamar solo cuando la generación salió bien). */
export async function descontarToken(centroId: string | null): Promise<unknown> {
  if (!centroId || iaDesactivadaAhora()) return null
  const { data } = await supabaseAdmin.rpc('consume_ai_quota', { p_centro: centroId, p_kind: 'predictive' })
  return data ?? null
}
