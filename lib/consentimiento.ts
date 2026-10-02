// Registro del consentimiento del padre/tutor al crear un paciente: quién lo confirmó y cuándo.
import { supabase } from '@/lib/supabase'

export async function datosConsentimiento() {
  const { data: { session } } = await supabase.auth.getSession()
  return { consentimiento_at: new Date().toISOString(), consentimiento_por: session?.user?.id ?? null }
}
