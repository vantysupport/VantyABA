import 'server-only'
// Informes que se generan también sin IA. Si el centro (o la familia) no autorizó la IA, las llamadas a Groq
// hechas dentro de conIAOpcional() no salen: devuelven una nota breve en lugar del texto redactado, y el
// informe se arma igual con sus datos (tablas, gráficos, registros). No se envía nada al proveedor.

import { AsyncLocalStorage } from 'node:async_hooks'
import type { NextRequest } from 'next/server'
import { getApiCaller } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { motivoSinIA, type EstadoIA } from '@/lib/ia-consentimiento'

const contexto = new AsyncLocalStorage<{ sinIA: boolean; en: boolean }>()

/** true si la petición en curso no tiene permiso para usar la IA. */
export const iaDesactivadaAhora = () => contexto.getStore()?.sinIA === true

/** Texto que reemplaza a una sección redactada por la IA cuando está desactivada. */
export const notaSinIA = () => contexto.getStore()?.en
  ? 'Automatic writing is not available: AI features are turned off for this center. The responsible professional can complete this section.'
  : 'Redacción automática no disponible: las funciones de IA están desactivadas en este centro. El profesional responsable puede completar esta sección.'

/** Ejecuta el manejador de un informe marcando si la IA está permitida para quien lo pide. */
export async function conIAOpcional<T>(req: NextRequest, fn: () => Promise<T>): Promise<T> {
  const caller = await getApiCaller(req)
  let sinIA = false
  if (caller && caller.role !== 'programador') {
    const [{ data: centro }, { data: perfil }] = await Promise.all([
      caller.centroId ? supabaseAdmin.from('centros').select('ia_estado').eq('id', caller.centroId).maybeSingle() : Promise.resolve({ data: null }),
      supabaseAdmin.from('profiles').select('ia_consentimiento').eq('id', caller.id).maybeSingle(),
    ])
    sinIA = motivoSinIA(caller.role, (centro?.ia_estado ?? null) as EstadoIA, (perfil?.ia_consentimiento ?? null) as EstadoIA) !== null
  }
  const loc = req.headers.get('x-locale') || req.cookies.get('vanty_locale')?.value || 'es'
  return ejecutarConPermisoIA(!sinIA, loc.toLowerCase().startsWith('en'), fn)
}

/** Ejecuta fn con la IA permitida o no (lo usa conIAOpcional; útil también en pruebas). */
export function ejecutarConPermisoIA<T>(permitida: boolean, en: boolean, fn: () => Promise<T>): Promise<T> {
  return contexto.run({ sinIA: !permitida, en }, fn)
}
