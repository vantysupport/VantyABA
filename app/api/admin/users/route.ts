import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { profileLimitCheck } from '@/lib/profile-limits'
import { getApiCaller, hasRole, ROLES, rowInCentro, notFound } from '@/lib/api-auth'
import { borrarArchivosDeUsuario } from '@/lib/borrar-archivos'
import { esEncargadoDelCentro } from '@/lib/eliminar-centro'
import { sendEmail, buildEmailReset } from '@/lib/email'
import { appBaseUrl } from '@/lib/auth-emails'
import { getCentroBranding } from '@/lib/centro-branding'

// Solo jefe/admin del centro pueden gestionar usuarios, y solo los de SU centro.
async function requireAdmin(req: NextRequest): Promise<{ ok: true; reason: string; centroId: string; id: string } | { ok: false; reason: string }> {
  const caller = await getApiCaller(req)
  if (!caller) return { ok: false, reason: 'sesión inválida o expirada' }
  if (!hasRole(caller, ROLES.admins)) return { ok: false, reason: 'requiere rol jefe/admin' }
  return { ok: true, reason: '', centroId: caller.centroId, id: caller.id }
}

const VALID_ROLES = ['jefe', 'especialista', 'padre', 'admin', 'secretaria']
const ROLES_ADMIN = ['jefe', 'admin']
// Acciones que afectan el acceso de una cuenta: sobre un administrador, solo las hace el administrador principal.
const ACCIONES_SENSIBLES = ['update_role', 'toggle_active', 'delete_user', 'change_password']

// GET: List all users with their profiles
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.ok) return NextResponse.json({ error: `No autorizado (${auth.reason})` }, { status: 403 })
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('centro_id', auth.centroId)
    if (profileError) throw profileError
    const centroIds = new Set((profiles || []).map(p => p.id))

    // Recorre todas las páginas de auth y se queda solo con las cuentas de este centro.
    const centroUsers: User[] = []
    for (let page = 1; page <= 50; page++) {
      const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
      if (authError) throw authError
      for (const u of authUsers.users) if (centroIds.has(u.id)) centroUsers.push(u)
      if (authUsers.users.length < 1000) break
    }

    // Teléfono de respaldo para familias: el que dejaron en su ficha de padre/tutor.
    const { data: fichas } = await supabaseAdmin.from('parent_accounts').select('user_id, telefono').eq('centro_id', auth.centroId).not('telefono', 'is', null)
    const telFicha = new Map<string, string>()
    for (const f of (fichas || []) as { user_id: string; telefono: string | null }[]) if (f.telefono && !telFicha.has(f.user_id)) telFicha.set(f.user_id, f.telefono)

    // Administrador principal: el dueño del centro (o, si no tiene, sus cuentas de dirección).
    const { data: centroRow } = await supabaseAdmin.from('centros').select('owner_id').eq('id', auth.centroId).maybeSingle()
    const esPrincipal = (id: string, role?: string | null) => centroRow?.owner_id ? centroRow.owner_id === id : role === 'jefe'
    const soyPrincipal = esPrincipal(auth.id, profiles?.find(p => p.id === auth.id)?.role)

    const usersWithProfiles = centroUsers.map(user => {
      const profile = profiles?.find(p => p.id === user.id)
      const proveedores = (user.identities || []).map(i => i.provider)
      return {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed: !!user.email_confirmed_at,
        providers: proveedores.length ? [...new Set(proveedores)] : [user.app_metadata?.provider || 'email'],
        phone_alt: telFicha.get(user.id) || null,
        profile: profile || null,
        principal: esPrincipal(user.id, profile?.role),
      }
    })

    return NextResponse.json({ data: usersWithProfiles, soyPrincipal })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

// POST: Manage users
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.ok) return NextResponse.json({ error: `No autorizado (${auth.reason})` }, { status: 403 })
    const body = await request.json()
    const { action, userId, newPassword, tokens, email, role, specialty, full_name, is_active } = body

    // Toda acción sobre una cuenta existente exige que pertenezca al centro del admin.
    if (action !== 'create_user' && action !== 'send_reset_email') {
      if (!(await rowInCentro('profiles', userId, auth.centroId))) return notFound()
    }
    // Administrador principal (quien creó el centro): nadie más gestiona su cuenta, y solo él puede
    // dar, quitar o desactivar el rol de administrador de otra persona.
    const principal = await esEncargadoDelCentro(auth.id, auth.centroId)
    const soloPrincipal = (msg: string) => NextResponse.json({ error: msg, code: 'solo_admin_principal' }, { status: 403 })
    if (userId && action !== 'create_user' && action !== 'send_reset_email') {
      const { data: objetivo } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).maybeSingle()
      const objetivoPrincipal = await esEncargadoDelCentro(userId, auth.centroId)
      const tocaAcceso = ACCIONES_SENSIBLES.includes(action) || (action === 'update_profile' && is_active !== undefined)
      if (objetivoPrincipal && userId !== auth.id && action !== 'update_tokens') {
        return soloPrincipal('Es el administrador principal del centro: solo esa persona puede gestionar su cuenta.')
      }
      if (objetivoPrincipal && userId === auth.id && (action === 'update_role' || action === 'delete_user')) {
        return soloPrincipal('El administrador principal no puede quitarse el rol ni eliminarse desde aquí. Para cerrar el centro usa Configuración → Centro.')
      }
      if (!principal && userId !== auth.id && tocaAcceso && ROLES_ADMIN.includes(objetivo?.role ?? '')) {
        return soloPrincipal('Solo el administrador principal puede cambiar el rol, desactivar o eliminar a otro administrador.')
      }
    }
    if ((action === 'update_role' || action === 'create_user') && ROLES_ADMIN.includes(role) && !principal) {
      return soloPrincipal('Solo el administrador principal puede dar el rol de administrador.')
    }

    if (action === 'send_reset_email') {
      const { data: target } = await supabaseAdmin.from('profiles').select('id').eq('email', email || '').eq('centro_id', auth.centroId).maybeSingle()
      if (!email || !target) return notFound()
    }

    if (action === 'change_password') {
      if (!userId || !newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: 'Contraseña debe tener al menos 6 caracteres' }, { status: 400 })
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword })
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Contraseña actualizada correctamente' })
    }

    if (action === 'update_tokens') {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ tokens })
        .eq('id', userId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'update_role') {
      if (!VALID_ROLES.includes(role)) {
        return NextResponse.json({ error: 'Rol no válido' }, { status: 400 })
      }
      // Bloqueo duro de límite (excluye al propio usuario que cambia de rol).
      const lim = await profileLimitCheck(role, auth.centroId, userId)
      if (lim.blocked) {
        return NextResponse.json({ error: `Límite de "${lim.key}" alcanzado (${lim.current}/${lim.limit}). Solo el programador puede ampliarlo.` }, { status: 409 })
      }
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ role })
        .eq('id', userId)
      if (error) throw error
      return NextResponse.json({ success: true, message: `Rol actualizado a "${role}"` })
    }

    if (action === 'update_profile') {
      const updates: Record<string, any> = {}
      if (full_name !== undefined) updates.full_name = full_name
      if (specialty !== undefined) updates.specialty = specialty
      if (is_active !== undefined) updates.is_active = is_active
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'toggle_active') {
      const { data: current } = await supabaseAdmin
        .from('profiles')
        .select('is_active, role')
        .eq('id', userId)
        .single()
      // null = activo (así lo muestra la interfaz)
      const newActive = current?.is_active === false
      // Reactivar ocupa un cupo del plan: solo si hay lugar libre
      if (newActive) {
        const lim = await profileLimitCheck(current?.role || '', auth.centroId, userId)
        if (lim.blocked) {
          return NextResponse.json({
            error: `Sin cupo: ${lim.current}/${lim.limit} ${lim.key === 'padre' ? 'familias' : 'miembros del equipo'} activos. Desactivá a otro o ampliá el plan.`,
            code: 'seat_limit',
          }, { status: 409 })
        }
      }
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ is_active: newActive })
        .eq('id', userId)
      if (error) throw error
      return NextResponse.json({ success: true, is_active: newActive })
    }

    if (action === 'send_reset_email') {
      // generateLink solo crea el enlace, no envía nada: el correo lo mandamos nosotros por SMTP.
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email })
      if (error) throw error
      const tokenHash = data?.properties?.hashed_token
      if (!tokenHash) throw new Error('No se pudo generar el enlace de recuperación')
      // Nunca desde el Host de la petición: se puede falsificar para robar el token.
      const base = appBaseUrl()
      if (!base) return NextResponse.json({ error: 'Falta configurar NEXT_PUBLIC_SITE_URL' }, { status: 500 })
      const link = `${base}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
      const centro = await getCentroBranding({ centroId: auth.centroId })
      const en = body.locale === 'en'
      const { subject, html } = buildEmailReset(link, centro.name, en)
      const sent = await sendEmail(email, subject, html, centro.name)
      if (!sent) {
        return NextResponse.json({ error: en ? 'The email could not be sent. Check the mail settings (GMAIL_USER / GMAIL_PASS).' : 'No se pudo enviar el correo. Revisa la configuración de correo (GMAIL_USER / GMAIL_PASS).' }, { status: 502 })
      }
      return NextResponse.json({ success: true, message: en ? 'Password email sent' : 'Correo para cambiar la contraseña enviado' })
    }

    if (action === 'confirm_email') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email_confirm: true
      })
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'create_user') {
      if (!email || !newPassword || !role) {
        return NextResponse.json({ error: 'Email, contraseña y rol son requeridos' }, { status: 400 })
      }
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
      }
      // Validar formato email básico
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'El formato del email no es válido' }, { status: 400 })
      }
      if (!VALID_ROLES.includes(role)) {
        return NextResponse.json({ error: 'Rol no válido' }, { status: 400 })
      }
      // Bloqueo duro de límite de perfiles (plan del centro).
      const lim = await profileLimitCheck(role, auth.centroId)
      if (lim.blocked) {
        return NextResponse.json({ error: `Límite de "${lim.key}" alcanzado (${lim.current}/${lim.limit}). Solo el programador puede ampliarlo.` }, { status: 409 })
      }
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: newPassword,
        email_confirm: true,
      })
      if (createErr) {
        // Mensajes de error claros en español
        if (createErr.message?.includes('already been registered') || createErr.message?.includes('already exists') || createErr.message?.includes('duplicate')) {
          return NextResponse.json({ error: `Ya existe un usuario con el email ${email}. Usá un email diferente.` }, { status: 400 })
        }
        if (createErr.message?.includes('invalid') && createErr.message?.includes('email')) {
          return NextResponse.json({ error: 'El email ingresado no es válido.' }, { status: 400 })
        }
        throw createErr
      }
      // Upsert profile: si Supabase ya lo creó via trigger, lo actualiza con los datos correctos
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: newUser.user.id,
          email,
          full_name: full_name || email.split('@')[0],
          nombre_confirmado: !!full_name,
          role,
          tokens: 0,
          is_active: true,
          specialty: specialty || null,
          centro_id: auth.centroId,
        }, { onConflict: 'id' })
      if (profileErr) {
        // Rollback: eliminar el usuario de auth para no dejar huérfanos
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        throw profileErr
      }
      return NextResponse.json({ success: true, message: 'Usuario creado exitosamente' })
    }

    if (action === 'delete_user') {
      if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
      // Desvincular pacientes de este padre (NO se borran los pacientes).
      await supabaseAdmin.from('children').update({ parent_id: null }).eq('parent_id', userId).eq('centro_id', auth.centroId)
      // Borrado definitivo de sus archivos (adjuntos que subió al chat del equipo y su foto)
      const { data: perfilBorrado } = await supabaseAdmin.from('profiles').select('avatar_url').eq('id', userId).maybeSingle()
      await borrarArchivosDeUsuario(userId, perfilBorrado?.avatar_url)
      // Borrar perfil y luego la cuenta de auth.
      await supabaseAdmin.from('profiles').delete().eq('id', userId)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Usuario eliminado' })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}
