-- Caché de búsquedas de videos de YouTube para las actividades de "Practicar en casa".
-- Es contenido público (no es dato de ningún centro): una misma búsqueda sirve para todos
-- y así se gasta la cuota gratuita de la API de YouTube una sola vez por actividad.
create table if not exists public.videos_actividad (
  consulta   text primary key,
  videos     jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.videos_actividad enable row level security;
-- Sin políticas: solo el servidor (service_role) lee y escribe.
revoke all on public.videos_actividad from anon, authenticated;
