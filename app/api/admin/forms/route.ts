import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, canAccessChild, rowInCentro, unauthorized, forbidden, notFound } from '@/lib/api-auth'
import { notifyAsync, sendWspToParent, buildParentMessage } from '@/lib/notifications'
import { getCentroBranding } from '@/lib/centro-branding'

// GET: List forms assigned to parents (optionally filter by parent_id or status)
export async function GET(request: NextRequest) {
  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  const isStaff = hasRole(caller, ROLES.staff)
  if (!isStaff && caller.role !== 'padre') return forbidden()
  try {
    const { searchParams } = new URL(request.url)
    const parentId = searchParams.get('parent_id')
    const childId = searchParams.get('child_id')
    const status = searchParams.get('status')

    let query = supabaseAdmin
      .from('parent_forms')
      .select('*, profiles!fk_pf_parent(full_name, email), children!fk_pf_child(name)')
      .order('created_at', { ascending: false })

    // Staff: solo su centro. Padre: solo sus propios formularios.
    if (isStaff) query = query.eq('centro_id', caller.centroId!)
    else query = query.eq('parent_id', caller.id)
    if (parentId) query = query.eq('parent_id', parentId)
    if (childId) query = query.eq('child_id', childId)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

// POST: Admin sends a form to a parent
export async function POST(request: NextRequest) {
  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const body = await request.json()
    const { parent_id, child_id, form_type, form_title, form_description, message_to_parent, deadline } = body
    if (child_id && !(await canAccessChild(caller, child_id))) return notFound()
    if (parent_id && !(await rowInCentro('profiles', parent_id, caller.centroId))) return notFound()

    const { data, error } = await supabaseAdmin
      .from('parent_forms')
      .insert([{
        parent_id,
        child_id,
        form_type,
        form_title,
        form_description,
        message_to_parent,
        deadline,
        status: 'pending',
        centro_id: caller.centroId,
        created_at: new Date().toISOString(),
      }])
      .select()

    if (error) throw error

    // Also create a notification for the parent (best-effort)
    if (parent_id) {
      try {
        await supabaseAdmin.from('notifications').insert([{
          user_id: parent_id,
          title: '📋 Nuevo formulario para completar',
          message: `${form_title} - ${message_to_parent || 'Por favor completa este formulario.'}`,
          type: 'form_request',
          is_read: false,
          centro_id: caller.centroId,
          created_at: new Date().toISOString(),
        }])
      } catch (_e) { /* best-effort */ }
    }

    // WhatsApp al admin del centro — formulario subido/enviado
    const centro = await getCentroBranding({ childId: child_id })
    notifyAsync({
      tipo: 'formulario_nuevo',
      vars: {
        tipo: form_title || form_type || 'Formulario',
        paciente: child_id || '',
        especialista: '',
      },
      centro,
    })

    // WhatsApp directo al padre — nuevo formulario para completar
    if (parent_id) {
      try {
        const { data: pProf } = await supabaseAdmin
          .from('profiles').select('phone, wsp_notif, full_name').eq('id', parent_id).maybeSingle()
        if ((pProf as any)?.phone && (pProf as any)?.wsp_notif !== false) {
          // Obtener nombre del paciente
          let pName = child_id || 'su hijo/a'
          if (child_id) {
            const { data: ch } = await supabaseAdmin.from('children').select('name').eq('id', child_id).maybeSingle()
            if ((ch as any)?.name) pName = (ch as any).name
          }
          const msg = buildParentMessage('formulario_nuevo', { tipo: form_title || form_type || 'Formulario', paciente: pName }, centro)
          sendWspToParent((pProf as any).phone, msg).catch(() => {})
        }
      } catch { /* silencioso */ }
    }


    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

// PATCH: Update form status or save responses
export async function PATCH(request: NextRequest) {
  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  try {
    const body = await request.json()
    const { id, status, responses, completed_at } = body
    const { data: form } = await supabaseAdmin.from('parent_forms').select('centro_id, parent_id').eq('id', id || '').maybeSingle()
    const ok = !!form && (
      (hasRole(caller, ROLES.staff) && form.centro_id === caller.centroId) ||
      (caller.role === 'padre' && form.parent_id === caller.id)
    )
    if (!ok) return notFound()

    const updateData: any = {}
    if (status) updateData.status = status
    if (responses) updateData.responses = responses
    if (completed_at) updateData.completed_at = completed_at

    const { data, error } = await supabaseAdmin
      .from('parent_forms')
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const { id } = await request.json()
    if (!(await rowInCentro('parent_forms', id, caller.centroId))) return notFound()
    const { error } = await supabaseAdmin.from('parent_forms').delete().eq('id', id).eq('centro_id', caller.centroId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}
