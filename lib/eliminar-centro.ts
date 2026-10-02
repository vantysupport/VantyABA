import 'server-only'
// Elimina un centro con toda su información: datos (rpc borrar_centro), cuentas de su equipo y familias
// (libera los correos), padres vinculados que no pertenecen a nada más y archivos en Storage.
// La usan la consola /control y la persona encargada del centro desde su panel.

import { supabaseAdmin } from '@/lib/supabase-admin'
import { borrarArchivoGuardado, borrarArchivosDePaciente, borrarArchivosDeUsuario } from '@/lib/borrar-archivos'
import { borrarSiHuerfana } from '@/lib/cuenta-huerfana'
import { cancelarSuscripcion, lemonConfigurado } from '@/lib/lemon'

export type ResultadoEliminarCentro =
  | { ok: true; cuentas: number; cuentasFallidas: number; pacientes: number; resultado: unknown }
  | { ok: false; error: 'not_found' | 'has_programador' | string }

/** Encargado del centro: su dueño (owner_id) o, si no tiene, una cuenta de dirección (jefe) del centro. */
export async function esEncargadoDelCentro(userId: string, centroId: string): Promise<boolean> {
  const { data: c } = await supabaseAdmin.from('centros').select('owner_id').eq('id', centroId).maybeSingle()
  if (!c) return false
  if (c.owner_id) return c.owner_id === userId
  const { data: p } = await supabaseAdmin.from('profiles').select('role, centro_id').eq('id', userId).maybeSingle()
  return p?.role === 'jefe' && p.centro_id === centroId
}

export async function eliminarCentro(centroId: string, opts: { operador?: string } = {}): Promise<ResultadoEliminarCentro> {
  const { data: centro } = await supabaseAdmin.from('centros').select('id, name, logo_url, lemon_subscription_id, lemon_estado').eq('id', centroId).maybeSingle()
  if (!centro) return { ok: false, error: 'not_found' }

  const [{ data: perfiles }, { data: hijos }, { data: familias }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, role, avatar_url').eq('centro_id', centroId),
    supabaseAdmin.from('children').select('id, parent_id').eq('centro_id', centroId),
    supabaseAdmin.from('parent_accounts').select('user_id').eq('centro_id', centroId),
  ])
  const cuentas = perfiles ?? []
  // Nunca borrar la cuenta de quien opera la consola ni la de otro programador.
  if (cuentas.some(c => c.id === opts.operador || c.role === 'programador')) return { ok: false, error: 'has_programador' }
  // Padres vinculados a este centro (por sus hijos o su cuenta de familia) cuyo perfil no tiene el
  // centro asignado: tras el borrado, su cuenta se elimina solo si ya no pertenece a nada más.
  const propias = new Set(cuentas.map(c => c.id))
  const padresExtra = [...new Set([...(hijos ?? []).map(h => h.parent_id), ...(familias ?? []).map(f => f.user_id)])]
    .filter((id): id is string => typeof id === 'string' && !propias.has(id))

  // Suscripción vigente: se cancela primero para que no se genere ningún cobro más.
  if (centro.lemon_subscription_id && lemonConfigurado() && !['cancelled', 'expired'].includes(centro.lemon_estado ?? '')) {
    try { await cancelarSuscripcion(centro.lemon_subscription_id) } catch (e) {
      return { ok: false, error: `lemon_cancel_failed: ${e instanceof Error ? e.message : 'error'}` }
    }
  }

  const { data: resultado, error } = await supabaseAdmin.rpc('borrar_centro', { p_centro: centroId })
  if (error) return { ok: false, error: error.message }

  // Cuentas de acceso: libera los correos para que puedan registrarse de nuevo.
  let fallidas = 0
  for (const c of cuentas) {
    await borrarArchivosDeUsuario(c.id, c.avatar_url)
    const { error: e } = await supabaseAdmin.auth.admin.deleteUser(c.id)
    if (e && !/not.?found/i.test(e.message)) fallidas++
  }
  let padresExtraBorrados = 0
  for (const id of padresExtra) {
    const { data: perfil } = await supabaseAdmin.from('profiles').select('avatar_url').eq('id', id).maybeSingle()
    if (await borrarSiHuerfana(id)) { padresExtraBorrados++; await borrarArchivosDeUsuario(id, perfil?.avatar_url) }
  }
  // Archivos: de cada paciente, el logo y la carpeta del centro en Storage.
  for (const h of hijos ?? []) await borrarArchivosDePaciente(h.id)
  await borrarArchivoGuardado(centro.logo_url)
  try {
    const { data: objs } = await supabaseAdmin.storage.from('public-images').list(`centros/${centroId}`, { limit: 1000 })
    if (objs?.length) await supabaseAdmin.storage.from('public-images').remove(objs.map(o => `centros/${centroId}/${o.name}`))
  } catch { /* noop */ }

  return { ok: true, cuentas: cuentas.length - fallidas + padresExtraBorrados, cuentasFallidas: fallidas, pacientes: hijos?.length ?? 0, resultado }
}
