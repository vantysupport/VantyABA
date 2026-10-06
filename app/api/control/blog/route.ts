// Editor del blog público (vanty.xyz/blog) desde /control. Solo el rol programador con segundo factor (aal2).
// Acciones: listar, obtener, guardar (crear o editar), eliminar y subir_imagen (URL firmada al bucket "blog").

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireProgramador } from '@/lib/require-programador'
import { logAuditEvent } from '@/lib/audit-log'
import { CATEGORIAS, slugDe } from '@/lib/blog'

const str = (v: unknown, max = 300) => String(v ?? '').trim().slice(0, max)
const uuid = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null)
const urlImagen = (v: unknown) => {
  const u = str(v, 1000)
  return /^https:\/\//.test(u) || /^\/(?!\/)/.test(u) ? u : null
}

export async function POST(req: NextRequest) {
  const auth = await requireProgramador(req)
  if (!auth.ok) return NextResponse.json({ error: auth.code }, { status: auth.status })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const audit = (description: string, metadata: Record<string, unknown> = {}) =>
    logAuditEvent({ action: 'update', resource_type: 'config', userId: auth.userId, userEmail: auth.email, userRole: 'programador', description, metadata, req })

  switch (body.action) {
    case 'listar': {
      const { data, error } = await supabaseAdmin.from('blog_articulos')
        .select('id, slug, titulo, resumen, portada_url, categoria, estado, destacado, publicado_en, updated_at, autor_nombre')
        .order('updated_at', { ascending: false }).limit(300)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ articulos: data ?? [] })
    }

    case 'obtener': {
      const id = uuid(body.id)
      if (!id) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      const { data, error } = await supabaseAdmin.from('blog_articulos').select('*').eq('id', id).maybeSingle()
      if (error || !data) return NextResponse.json({ error: error?.message ?? 'not_found' }, { status: 404 })
      return NextResponse.json({ articulo: data })
    }

    case 'guardar': {
      const a = (body.articulo ?? {}) as Record<string, unknown>
      const id = uuid(a.id)
      const titulo = str(a.titulo, 200)
      if (!titulo) return NextResponse.json({ error: 'falta_titulo' }, { status: 400 })
      const slug = slugDe(str(a.slug, 120) || titulo)
      if (!slug) return NextResponse.json({ error: 'slug_invalido' }, { status: 400 })
      const estado = a.estado === 'publicado' ? 'publicado' : 'borrador'
      let publicado_en: string | null = null
      if (a.publicado_en) {
        const f = new Date(String(a.publicado_en))
        if (!Number.isNaN(f.getTime())) publicado_en = f.toISOString()
      }
      if (estado === 'publicado' && !publicado_en) publicado_en = new Date().toISOString()
      const categoria = CATEGORIAS.some(c => c.id === a.categoria) ? String(a.categoria) : 'noticias'
      const etiquetas = (Array.isArray(a.etiquetas) ? a.etiquetas : String(a.etiquetas ?? '').split(','))
        .map(t => str(t, 40).replace(/^#/, '')).filter(Boolean).slice(0, 12)

      // El enlace (slug) no se puede repetir
      const { data: choque } = await supabaseAdmin.from('blog_articulos').select('id').eq('slug', slug).maybeSingle()
      if (choque && choque.id !== id) return NextResponse.json({ error: 'slug_repetido' }, { status: 409 })

      const fila = {
        slug, titulo, estado, publicado_en, categoria, etiquetas,
        resumen: str(a.resumen, 400),
        contenido: String(a.contenido ?? '').slice(0, 200_000),
        portada_url: urlImagen(a.portada_url),
        portada_alt: str(a.portada_alt, 200) || null,
        autor_nombre: str(a.autor_nombre, 80) || 'Equipo Vanty',
        destacado: !!a.destacado,
        seo_titulo: str(a.seo_titulo, 120) || null,
        seo_descripcion: str(a.seo_descripcion, 200) || null,
        updated_at: new Date().toISOString(),
      }
      // Solo un destacado a la vez
      if (fila.destacado) await supabaseAdmin.from('blog_articulos').update({ destacado: false }).eq('destacado', true).neq('id', id ?? '00000000-0000-0000-0000-000000000000')

      const q = id
        ? supabaseAdmin.from('blog_articulos').update(fila).eq('id', id).select('*').single()
        : supabaseAdmin.from('blog_articulos').insert({ ...fila, created_by: auth.userId }).select('*').single()
      const { data, error } = await q
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await audit(id ? 'Blog: artículo editado' : 'Blog: artículo creado', { id: data.id, slug, estado })
      return NextResponse.json({ articulo: data })
    }

    case 'eliminar': {
      const id = uuid(body.id)
      if (!id) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
      const { data } = await supabaseAdmin.from('blog_articulos').select('slug').eq('id', id).maybeSingle()
      const { error } = await supabaseAdmin.from('blog_articulos').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await audit('Blog: artículo eliminado', { id, slug: data?.slug })
      return NextResponse.json({ ok: true })
    }

    case 'subir_imagen': {
      // URL firmada para subir la imagen directo a Storage desde el navegador
      const tipo = str(body.tipo, 40)
      const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' } as Record<string, string>)[tipo]
      if (!ext) return NextResponse.json({ error: 'tipo_no_permitido' }, { status: 400 })
      const base = slugDe(str(body.nombre, 80).replace(/\.[a-z0-9]+$/i, '')) || 'imagen'
      const path = `${new Date().toISOString().slice(0, 7)}/${base}-${Date.now().toString(36)}.${ext}`
      const { data, error } = await supabaseAdmin.storage.from('blog').createSignedUploadUrl(path)
      if (error || !data) return NextResponse.json({ error: error?.message ?? 'storage' }, { status: 500 })
      const url = supabaseAdmin.storage.from('blog').getPublicUrl(path).data.publicUrl
      return NextResponse.json({ path, token: data.token, url })
    }

    default:
      return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
  }
}
