-- Notificaciones creadas a mano desde /control (programador): texto, pose de ARIA, a quién y cuándo.
-- Se envían como push (celular/web) y aparecen en la campana. Las programadas las despacha una tarea cada 5 min.
create table if not exists public.campanas_notificacion (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  cuerpo          text not null,
  pose            text not null default 'saludo',
  audiencia       text[] not null,            -- directores | especialistas | secretarias | padres
  centro_id       uuid references public.centros(id) on delete cascade, -- null = todos los centros
  programada_para timestamptz not null default now(),
  estado          text not null default 'programada', -- programada | enviando | enviada | cancelada
  destinatarios   int,
  enviados_push   int,
  creada_por      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  enviada_en      timestamptz
);
create index if not exists campanas_pendientes_idx on public.campanas_notificacion (programada_para) where estado = 'programada';
alter table public.campanas_notificacion enable row level security;
revoke all on public.campanas_notificacion from anon, authenticated;
