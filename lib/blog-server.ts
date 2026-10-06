import 'server-only'
// Lectura pública del blog. Usa la clave pública: la política de RLS solo deja ver los artículos publicados
// cuya fecha de publicación ya llegó, así que los borradores y los programados nunca salen de aquí.

import { createClient } from '@supabase/supabase-js'
import { COLUMNAS_LISTA, type Articulo } from '@/lib/blog'
import type { ArticuloLista } from '@/components/blog/Tarjetas'

const publico = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export async function articulosPublicados(limite = 60): Promise<ArticuloLista[]> {
  const { data } = await publico().from('blog_articulos').select(COLUMNAS_LISTA)
    .order('publicado_en', { ascending: false }).limit(limite)
  return (data ?? []) as ArticuloLista[]
}

export async function articuloPorSlug(slug: string): Promise<Articulo | null> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null
  const { data } = await publico().from('blog_articulos').select('*').eq('slug', slug).maybeSingle()
  return (data as Articulo | null) ?? null
}
