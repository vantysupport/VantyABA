import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCentroBranding } from '@/lib/centro-branding'
import { estadoInvitacion, invitacionPorToken } from '@/lib/invitaciones'
import { InvitacionForm, type InvitacionInfo } from './InvitacionForm'

export const dynamic = 'force-dynamic'

export default async function InvitarPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params
  const { error } = await searchParams
  const inv = await invitacionPorToken(token)

  let info: InvitacionInfo | null = null
  if (inv) {
    const [centro, { data: estadoCentro }, { data: child }] = await Promise.all([
      getCentroBranding({ centroId: inv.centro_id }),
      supabaseAdmin.from('centros').select('status').eq('id', inv.centro_id).maybeSingle(),
      inv.child_id
        ? supabaseAdmin.from('children').select('name').eq('id', inv.child_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    const estado = estadoInvitacion(inv)
    info = {
      token,
      role: inv.role,
      email: inv.email,
      specialty: inv.specialty,
      centroNombre: centro.name,
      centroLogo: centro.logoUrl,
      paciente: (child as { name?: string } | null)?.name ?? null,
      expiresAt: inv.expires_at,
      estado: estadoCentro?.status === 'suspended' ? 'suspendido' : estado,
    }
  }

  return <InvitacionForm info={info} errorOAuth={typeof error === 'string' ? error.slice(0, 40) : null} />
}
