-- Pagos con Lemon Squeezy: suscripción de cada centro, variantes por plan y registro de eventos (idempotencia).
alter table public.centros add column if not exists lemon_subscription_id text;
alter table public.centros add column if not exists lemon_customer_id text;
alter table public.centros add column if not exists lemon_estado text;
alter table public.plans add column if not exists lemon_variant_mensual text;
alter table public.plans add column if not exists lemon_variant_anual text;
alter table public.platform_settings add column if not exists lemon_variant_tokens text;

create table if not exists public.pagos_eventos (
  id uuid primary key default gen_random_uuid(),
  proveedor text not null default 'lemonsqueezy',
  evento text not null,
  firma text not null unique,           -- hash del cuerpo: el mismo aviso no se procesa dos veces
  centro_id uuid references public.centros(id) on delete set null,
  payload jsonb not null,
  procesado boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);
alter table public.pagos_eventos enable row level security;
revoke all on public.pagos_eventos from anon, authenticated;
create index if not exists pagos_eventos_centro_idx on public.pagos_eventos(centro_id, created_at desc);
