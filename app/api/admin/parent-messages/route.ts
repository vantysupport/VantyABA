import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, hasRole, ROLES, canAccessChild, rowInCentro, unauthorized, forbidden, notFound } from '@/lib/api-auth'
import { getCentroBranding } from '@/lib/centro-branding'
import { internalApiHeaders } from '@/lib/calendar-integration'

export async function GET(request: NextRequest) {
  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending_approval'

    const { data, error } = await supabaseAdmin
      .from('parent_message_approvals')
      .select(`
        *,
        children!fk_pma_child(name, birth_date),
        profiles!fk_pma_parent(full_name, email)
      `)
      .eq('status', status)
      .eq('centro_id', caller.centroId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const body = await request.json()
    const { child_id, parent_id, source, source_title, ai_message, ai_analysis, session_data } = body
    if (!(await canAccessChild(caller, child_id))) return notFound()
    if (parent_id && !(await rowInCentro('profiles', parent_id, caller.centroId))) return notFound()

    const { data, error } = await supabaseAdmin
      .from('parent_message_approvals')
      .insert([{
        child_id, parent_id, source, source_title,
        ai_message,
        edited_message: ai_message,
        ai_analysis, session_data,
        status: 'pending_approval',
        centro_id: caller.centroId,
        created_at: new Date().toISOString(),
      }])
      .select()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const caller = await getApiCaller(request)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const body = await request.json()
    const { id, edited_message, action } = body
    if (!(await rowInCentro('parent_message_approvals', id, caller.centroId))) return notFound()

    if (action === 'approve') {
      const { data: record, error: fetchError } = await supabaseAdmin
        .from('parent_message_approvals')
        .select('*, children(name), profiles(full_name)')
        .eq('id', id)
        .single()

      if (fetchError || !record) throw new Error('Mensaje no encontrado')

      const messageToSend = edited_message || record.edited_message || record.ai_message
      const childName = (record as any).children?.name || 'su hijo/a'

      // Notify parent
      const formType = (record as any).session_data?.form_type || record.source || 'parent_form'
      await supabaseAdmin.from('notifications').insert([{
        user_id: record.parent_id,
        title: `📋 Mensaje sobre ${childName}`,
        message: messageToSend,
        type: 'parent_message',
        centro_id: caller.centroId,
        metadata: {
          source: record.source,
          source_title: record.source_title,
          child_id: record.child_id,
          ai_analysis: record.ai_analysis,
          form_type: formType,
        },
        is_read: false,
        created_at: new Date().toISOString(),
      }])

      const { data, error } = await supabaseAdmin
        .from('parent_message_approvals')
        .update({ edited_message: messageToSend, status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', id).select()

      if (error) throw error

      // 🔔 Send push notification to parent
      try {
        const childName = (record as any).children?.name || 'tu hijo/a'
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/push`, {
          method: 'POST',
          headers: internalApiHeaders(),
          body: JSON.stringify({
            userId: record.parent_id,
            title: `📋 Mensaje sobre ${childName}`,
            body: messageToSend.length > 100 ? messageToSend.slice(0, 97) + '...' : messageToSend,
            url: '/padre',
          }),
        })
      } catch (pushErr) {
        // Non-critical — log but don't fail the approval
        console.error('Push notification error (non-critical):', pushErr)
      }

      return NextResponse.json({ data })

    } else if (action === 'reject') {
      const { data, error } = await supabaseAdmin
        .from('parent_message_approvals')
        .update({ status: 'rejected', approved_at: new Date().toISOString() })
        .eq('id', id).select()
      if (error) throw error
      return NextResponse.json({ data })

    } else {
      const { data, error } = await supabaseAdmin
        .from('parent_message_approvals')
        .update({ edited_message })
        .eq('id', id).select()
      if (error) throw error
      return NextResponse.json({ data })
    }
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
    if (!(await rowInCentro('parent_message_approvals', id, caller.centroId))) return notFound()
    const { error } = await supabaseAdmin.from('parent_message_approvals').delete().eq('id', id).eq('centro_id', caller.centroId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}
