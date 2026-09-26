-- Registro de notificaciones push programadas ya enviadas (recordatorios, rachas, resúmenes):
-- la clave única evita mandar dos veces el mismo aviso cuando la tarea corre cada hora.
create table if not exists public.push_enviados (
  clave      text primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists push_enviados_created_idx on public.push_enviados (created_at);

alter table public.push_enviados enable row level security;
-- Solo el servidor (service role) la usa; sin políticas para usuarios.
revoke all on public.push_enviados from anon, authenticated;
