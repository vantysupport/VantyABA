-- Celulares con la app de Android registrados para recibir avisos por Firebase Cloud Messaging.
create table if not exists public.app_dispositivos (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plataforma text not null default 'android',
  updated_at timestamptz not null default now()
);
create index if not exists app_dispositivos_user_idx on public.app_dispositivos(user_id);
alter table public.app_dispositivos enable row level security;
drop policy if exists app_dispositivos_propios on public.app_dispositivos;
create policy app_dispositivos_propios on public.app_dispositivos for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Contenido de cada aviso para la app. Por Firebase (Google) solo viaja el id de esta fila; el celular lee el
-- texto aquí con la sesión de la persona (RLS), así ningún nombre ni dato de salud pasa por Google.
create table if not exists public.app_avisos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  cuerpo text not null default '',
  url text,
  pose text,
  tag text,
  insistente boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists app_avisos_user_idx on public.app_avisos(user_id, created_at desc);
alter table public.app_avisos enable row level security;
drop policy if exists app_avisos_propios on public.app_avisos;
create policy app_avisos_propios on public.app_avisos for select to authenticated using (user_id = auth.uid());
