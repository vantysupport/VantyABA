import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApiCaller, unauthorized } from '@/lib/api-auth'
import { storageObjectOf } from '@/lib/file-url'

// DELETE: quita la foto de perfil de quien llama (y borra el archivo si es suyo).
export async function DELETE(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()

  const { data: perfil } = await supabaseAdmin.from('profiles').select('avatar_url').eq('id', caller.id).maybeSingle()
  const { error } = await supabaseAdmin.from('profiles').update({ avatar_url: null, updated_at: new Date().toISOString() }).eq('id', caller.id)
  if (error) return NextResponse.json({ error: 'No se pudo quitar la foto' }, { status: 500 })

  // Solo se borra el archivo si está en la carpeta de avatares de esta persona.
  const obj = storageObjectOf(perfil?.avatar_url)
  if (obj && obj.bucket === 'public-images' && obj.path.includes(`/avatars/${caller.id}/`)) {
    await supabaseAdmin.storage.from(obj.bucket).remove([obj.path]).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
