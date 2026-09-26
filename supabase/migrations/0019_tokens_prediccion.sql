-- Tokens de análisis predictivo (y reportes IA): límite propio por centro, saldo y compras.

-- Límites de IA también se pueden fijar por centro (centros.limites.max_predictive_tokens / max_ai_reports).
create or replace function public.consume_ai_quota(p_centro uuid, p_kind text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_period date := date_trunc('month', now())::date;
  v_limit int;
  v_used int;
  v_extra int;
  v_status text;
begin
  select status into v_status from centros where id = p_centro;
  if v_status is null or v_status not in ('trial', 'active') then
    return jsonb_build_object('allowed', false, 'reason', 'no_active_plan');
  end if;
  v_limit := public.limite_centro(p_centro, case p_kind when 'report' then 'max_ai_reports' when 'predictive' then 'max_predictive_tokens' end);

  insert into ai_usage (centro_id, kind, period_start) values (p_centro, p_kind, v_period) on conflict do nothing;
  select used into v_used from ai_usage where centro_id = p_centro and kind = p_kind and period_start = v_period for update;

  -- Sin límite o dentro del plan
  if v_limit is null or v_used < v_limit then
    update ai_usage set used = used + 1 where centro_id = p_centro and kind = p_kind and period_start = v_period;
    return jsonb_build_object('allowed', true, 'used', v_used + 1, 'limit', v_limit, 'source', 'plan');
  end if;

  -- Tokens comprados
  update ai_balance set extra_remaining = extra_remaining - 1
    where centro_id = p_centro and kind = p_kind and extra_remaining > 0
    returning extra_remaining into v_extra;
  if found then
    update ai_usage set used = used + 1 where centro_id = p_centro and kind = p_kind and period_start = v_period;
    return jsonb_build_object('allowed', true, 'used', v_used + 1, 'limit', v_limit, 'source', 'extra', 'extra_remaining', v_extra);
  end if;

  return jsonb_build_object('allowed', false, 'reason', 'quota_exhausted', 'used', v_used, 'limit', v_limit);
end;
$$;
revoke execute on function public.consume_ai_quota(uuid, text) from public, anon, authenticated;

-- Saldo sin consumir (para mostrarlo y para revisar antes de generar).
create or replace function public.ai_quota_estado(p_centro uuid, p_kind text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_limit int;
  v_used int;
  v_extra int;
begin
  v_limit := public.limite_centro(p_centro, case p_kind when 'report' then 'max_ai_reports' when 'predictive' then 'max_predictive_tokens' end);
  select coalesce(used, 0) into v_used from ai_usage where centro_id = p_centro and kind = p_kind and period_start = date_trunc('month', now())::date;
  select coalesce(extra_remaining, 0) into v_extra from ai_balance where centro_id = p_centro and kind = p_kind;
  v_used := coalesce(v_used, 0); v_extra := coalesce(v_extra, 0);
  return jsonb_build_object(
    'limit', v_limit, 'used', v_used, 'extra', v_extra,
    'disponible', case when v_limit is null then null else greatest(0, v_limit - v_used) + v_extra end
  );
end;
$$;
revoke execute on function public.ai_quota_estado(uuid, text) from public, anon, authenticated;

-- Paquetes de tokens a la venta (editables desde /control).
alter table public.platform_settings add column if not exists token_packs jsonb not null
  default '[{"tokens":1,"usd":0.3},{"tokens":5,"usd":1}]'::jsonb;

-- Compras de tokens: hoy se confirman a mano en /control; luego las marcará la pasarela de pago.
create table if not exists public.compras_tokens (
  id          uuid primary key default gen_random_uuid(),
  centro_id   uuid not null references public.centros(id) on delete cascade,
  kind        text not null default 'predictive' check (kind in ('predictive', 'report')),
  tokens      integer not null check (tokens between 1 and 10000),
  precio_usd  numeric(10,2) not null check (precio_usd >= 0),
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'pagada', 'cancelada')),
  proveedor   text,            -- pasarela de pago (cuando exista) o 'manual'
  referencia  text,            -- id de la transacción / comprobante
  solicitada_por uuid references public.profiles(id) on delete set null,
  confirmada_por uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  pagada_at   timestamptz
);
create index if not exists compras_tokens_centro_idx on public.compras_tokens (centro_id, created_at desc);
create index if not exists compras_tokens_pendientes_idx on public.compras_tokens (estado) where estado = 'pendiente';
alter table public.compras_tokens enable row level security;
revoke all on public.compras_tokens from anon, authenticated;
