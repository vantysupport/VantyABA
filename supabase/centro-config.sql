-- supabase/centro-config.sql
-- Configuración global del centro (fila única). Por ahora: la moneda.
-- Ejecutar una vez en el SQL editor de Supabase.

create table if not exists centro_config (
  id integer primary key default 1,
  moneda text not null default 'PEN',
  updated_at timestamptz not null default now(),
  constraint centro_config_singleton check (id = 1)
);

-- Fila única inicial (no falla si ya existe)
insert into centro_config (id, moneda) values (1, 'PEN')
on conflict (id) do nothing;
