import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, unauthorized, forbidden } from '@/lib/api-auth'

// Save a push subscription for a user
export async function POST(request: NextRequest) {
  try {
    const caller = await getApiCaller(request)
    if (!caller) return unauthorized()
    const { userId, subscription } = await request.json()

    if (!userId || !subscription) {
      return NextResponse.json({ error: 'userId y subscription son requeridos' }, { status: 400 })
    }
    // A user may only register their own devices.
    if (userId !== caller.id) return forbidden()

    // Upsert — if same endpoint already exists, update it
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        subscription,
        centro_id: caller.centroId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,endpoint' })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

// Delete a subscription (when user revokes permission)
export async function DELETE(request: NextRequest) {
  try {
    const caller = await getApiCaller(request)
    if (!caller) return unauthorized()
    const { userId, endpoint } = await request.json()
    if (userId !== caller.id) return forbidden()
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}
