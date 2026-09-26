-- Compra de tokens extra por las familias (mismos paquetes de platform_settings.token_packs:
-- 1 token = US$0.30, 5 tokens = US$1). Se confirman a mano en /control como las compras del centro.
--   kind 'padre_practica' → planes de "Practicar en casa" extra
--   kind 'padre_aria'     → mensajes de ARIA extra
-- Los tokens comprados no vencen: se usan cuando se acaba la cuota del mes (práctica) o del día (ARIA).

alter table public.compras_tokens drop constraint if exists compras_tokens_kind_check;
alter table public.compras_tokens add constraint compras_tokens_kind_check
  check (kind in ('predictive', 'report', 'padre_practica', 'padre_aria'));
alter table public.compras_tokens add column if not exists para_usuario uuid references public.profiles(id) on delete cascade;

create table if not exists public.tokens_padre_extra (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  centro_id  uuid references public.centros(id) on delete cascade,
  practica   integer not null default 0 check (practica >= 0),
  aria       integer not null default 0 check (aria >= 0),
  updated_at timestamptz not null default now()
);
alter table public.tokens_padre_extra enable row level security;
revoke all on public.tokens_padre_extra from anon, authenticated;

-- Suma o resta tokens extra de forma atómica (nunca baja de 0). Devuelve false si no alcanzaba.
create or replace function public.mover_tokens_padre(p_user uuid, p_centro uuid, p_tipo text, p_delta integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  insert into public.tokens_padre_extra (user_id, centro_id) values (p_user, p_centro) on conflict (user_id) do nothing;
  if p_tipo = 'practica' then
    update public.tokens_padre_extra set practica = practica + p_delta, updated_at = now()
      where user_id = p_user and practica + p_delta >= 0 returning true into ok;
  elsif p_tipo = 'aria' then
    update public.tokens_padre_extra set aria = aria + p_delta, updated_at = now()
      where user_id = p_user and aria + p_delta >= 0 returning true into ok;
  end if;
  return coalesce(ok, false);
end $$;
revoke all on function public.mover_tokens_padre(uuid, uuid, text, integer) from public, anon, authenticated;
