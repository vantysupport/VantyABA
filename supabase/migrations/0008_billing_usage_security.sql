-- ─── Platform-wide settings (replaces the old app_settings singleton; programador only) ───
create table public.platform_settings (
  id int primary key default 1 check (id = 1),
  maintenance boolean not null default false,
  maintenance_msg text,
  trial_days int not null default 14 check (trial_days between 0 and 90),
  login_max_failures int not null default 5,
  login_lockout_minutes int not null default 15,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
insert into public.platform_settings (id) values (1);
alter table public.platform_settings enable row level security;
create policy platform_settings_read on public.platform_settings for select to anon, authenticated using (true);
-- Only the fields the public UI needs; lockout thresholds stay server-side.
revoke all on public.platform_settings from anon, authenticated;
grant select (maintenance, maintenance_msg, trial_days) on public.platform_settings to anon, authenticated;

-- ─── Add-on pricing (pricing images: extra AI tokens at an extra price, +parent for Starter) ───
alter table public.plans
  add column extra_ai_pack_size int not null default 10,
  add column extra_ai_pack_price_pen numeric,
  add column extra_parent_price_pen numeric;

alter table public.centros
  add column paid_until date,
  add column extra_parents int not null default 0 check (extra_parents >= 0);

-- ─── Subscription tracking (manual payment activation, seguimiento) ───
create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros(id) on delete cascade,
  event text not null check (event in ('trial_started','trial_extended','plan_requested','payment_confirmed','plan_changed','suspended','reactivated','addon_purchased')),
  plan_id uuid references public.plans(id),
  amount_pen numeric,
  reference text,
  note text,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index on public.subscription_events (centro_id, created_at desc);
alter table public.subscription_events enable row level security;
create policy subscription_events_admin_read on public.subscription_events for select to authenticated
  using (is_admin() and same_centro(centro_id));

-- ─── AI quota: monthly allowance from the plan, then a non-expiring purchased balance ───
create table public.ai_usage (
  centro_id uuid not null references public.centros(id) on delete cascade,
  kind text not null check (kind in ('report','predictive')),
  period_start date not null,
  used int not null default 0,
  primary key (centro_id, kind, period_start)
);
alter table public.ai_usage enable row level security;
create policy ai_usage_staff_read on public.ai_usage for select to authenticated
  using (is_staff() and same_centro(centro_id));

create table public.ai_balance (
  centro_id uuid not null references public.centros(id) on delete cascade,
  kind text not null check (kind in ('report','predictive')),
  extra_remaining int not null default 0 check (extra_remaining >= 0),
  primary key (centro_id, kind)
);
alter table public.ai_balance enable row level security;
create policy ai_balance_staff_read on public.ai_balance for select to authenticated
  using (is_staff() and same_centro(centro_id));

create table public.token_topups (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros(id) on delete cascade,
  kind text not null check (kind in ('report','predictive','parent_slot')),
  amount int not null check (amount <> 0),
  price_pen numeric,
  note text,
  granted_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index on public.token_topups (centro_id, created_at desc);
alter table public.token_topups enable row level security;
create policy token_topups_admin_read on public.token_topups for select to authenticated
  using (is_admin() and same_centro(centro_id));

-- Atomic check-and-consume; only server code (service role) may call it.
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
begin
  select case p_kind when 'report' then p.max_ai_reports when 'predictive' then p.max_predictive_tokens end
    into v_limit
  from centros c join plans p on p.id = c.plan_id
  where c.id = p_centro and c.status in ('trial','active');
  if v_limit is null then
    return jsonb_build_object('allowed', false, 'reason', 'no_active_plan');
  end if;

  insert into ai_usage (centro_id, kind, period_start) values (p_centro, p_kind, v_period)
    on conflict do nothing;
  select used into v_used from ai_usage
    where centro_id = p_centro and kind = p_kind and period_start = v_period for update;

  if v_used < v_limit then
    update ai_usage set used = used + 1 where centro_id = p_centro and kind = p_kind and period_start = v_period;
    return jsonb_build_object('allowed', true, 'used', v_used + 1, 'limit', v_limit, 'source', 'plan');
  end if;

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
revoke all on function public.consume_ai_quota(uuid, text) from public, anon, authenticated;

create or replace function public.grant_ai_topup(p_centro uuid, p_kind text, p_amount int, p_price numeric, p_note text, p_actor uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into token_topups (centro_id, kind, amount, price_pen, note, granted_by)
    values (p_centro, p_kind, p_amount, p_price, p_note, p_actor);
  if p_kind = 'parent_slot' then
    update centros set extra_parents = greatest(0, extra_parents + p_amount) where id = p_centro;
  else
    insert into ai_balance (centro_id, kind, extra_remaining) values (p_centro, p_kind, greatest(0, p_amount))
      on conflict (centro_id, kind) do update set extra_remaining = greatest(0, ai_balance.extra_remaining + p_amount);
  end if;
  insert into subscription_events (centro_id, event, amount_pen, note, actor_id)
    values (p_centro, 'addon_purchased', p_price, p_kind || ' x' || p_amount || coalesce(' · ' || p_note, ''), p_actor);
end;
$$;
revoke all on function public.grant_ai_topup(uuid, text, int, numeric, text, uuid) from public, anon, authenticated;

-- ─── Retrospective: tamper-evident, append-only audit log ───
-- Columns match what lib/audit-log.ts writes (the legacy table lacked them, so every audit insert silently failed).
alter table public.audit_log
  add column if not exists user_email text,
  add column if not exists user_role text,
  add column if not exists child_id uuid,
  add column if not exists description text,
  add column if not exists metadata jsonb not null default '{}',
  add column if not exists success boolean not null default true,
  add column if not exists error_message text,
  add column if not exists seq bigint generated always as identity,
  add column if not exists prev_hash text,
  add column if not exists hash text;
create unique index if not exists audit_log_seq_idx on public.audit_log (seq);

create or replace function public.audit_log_row_hash(r public.audit_log)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(
    coalesce(r.prev_hash, '') || '|' || r.id::text || '|' || r.created_at::text || '|' ||
    coalesce(r.user_id::text, '') || '|' || coalesce(r.action, '') || '|' || coalesce(r.resource_type, '') || '|' ||
    coalesce(r.resource_id::text, '') || '|' || coalesce(r.centro_id::text, '') || '|' ||
    coalesce(r.description, '') || '|' || r.metadata::text || '|' || r.success::text,
    'sha256'), 'hex')
$$;

create or replace function public.audit_log_chain()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform pg_advisory_xact_lock(hashtext('audit_log_chain'));
  new.created_at := coalesce(new.created_at, now());
  select hash into new.prev_hash from audit_log order by seq desc limit 1;
  new.prev_hash := coalesce(new.prev_hash, 'GENESIS');
  new.hash := audit_log_row_hash(new);
  return new;
end;
$$;
create trigger trg_audit_log_chain before insert on public.audit_log
  for each row execute function public.audit_log_chain();

create or replace function public.audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only' using errcode = '42501';
end;
$$;
create trigger trg_audit_log_immutable before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();

-- Returns the first seq whose hash or link does not verify (null = chain intact).
create or replace function public.audit_log_verify()
returns table (checked bigint, first_broken_seq bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  with ordered as (
    select a.seq, a.hash, a.prev_hash, audit_log_row_hash(a) as recomputed,
           lag(a.hash) over (order by a.seq) as expected_prev
    from audit_log a
  )
  select count(*)::bigint,
         min(seq) filter (where hash is distinct from recomputed
                          or prev_hash is distinct from coalesce(expected_prev, 'GENESIS'))
  from ordered
$$;
revoke all on function public.audit_log_verify() from public, anon, authenticated;

-- ─── Reactive: security events (IDS feed) ───
alter table public.alertas_seguridad add column if not exists ip_address text;
create index if not exists alertas_seguridad_tipo_time_idx on public.alertas_seguridad (tipo, "timestamp" desc);
create index if not exists alertas_seguridad_ip_time_idx on public.alertas_seguridad (ip_address, "timestamp" desc);
