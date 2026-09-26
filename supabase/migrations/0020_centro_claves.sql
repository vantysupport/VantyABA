-- Clave de datos (DEK) de cada centro, cifrada con la clave maestra del servidor (VANTY_MASTER_KEY).
create table if not exists public.centro_claves (
  centro_id uuid primary key references public.centros(id) on delete cascade,
  dek text not null check (dek like 'dek:v1:%'),
  created_at timestamptz not null default now()
);
alter table public.centro_claves enable row level security;
revoke all on public.centro_claves from anon, authenticated;
