-- Blog público de Vanty ABA (vanty.xyz/blog). Los artículos se escriben desde /control (rol programador)
-- y se guardan con la service role; el público solo puede leer los publicados cuya fecha ya llegó.
-- (No confundir con public.blog_posts: tabla antigua por centro, vacía y sin uso.)

create table if not exists public.blog_articulos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  titulo text not null,
  resumen text not null default '',
  contenido text not null default '',
  portada_url text,
  portada_alt text,
  categoria text not null default 'noticias',
  etiquetas text[] not null default '{}',
  autor_nombre text not null default 'Equipo Vanty',
  estado text not null default 'borrador' check (estado in ('borrador', 'publicado')),
  destacado boolean not null default false,
  publicado_en timestamptz,
  seo_titulo text,
  seo_descripcion text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_articulos_publicados_idx on public.blog_articulos (publicado_en desc) where estado = 'publicado';

alter table public.blog_articulos enable row level security;

drop policy if exists "blog_lectura_publica" on public.blog_articulos;
create policy "blog_lectura_publica" on public.blog_articulos
  for select to anon, authenticated
  using (estado = 'publicado' and publicado_en is not null and publicado_en <= now());

-- Imágenes del blog (portadas y fotos dentro del artículo): públicas, solo imágenes de hasta 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog', 'blog', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
