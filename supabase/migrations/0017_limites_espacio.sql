-- Límites de espacio por plan: archivos (R2) y datos en la base, por centro.
alter table public.plans add column if not exists max_db_mb integer check (max_db_mb is null or max_db_mb > 0);
comment on column public.plans.max_db_mb is 'Datos del centro en la base (MB). NULL = sin límite.';

update public.plans set max_storage_mb = 2048, max_db_mb = 250 where code in ('starter', 'fundador');
update public.plans set max_storage_mb = 4096, max_db_mb = 350 where code = 'professional';
update public.plans set max_storage_mb = 6144, max_db_mb = 500 where code = 'clinic';

-- Bytes que ocupan en la base las filas de un centro (todas las tablas con centro_id).
create or replace function public.centro_db_bytes(p_centro uuid)
returns bigint
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  t record;
  parcial bigint;
  total bigint := 0;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'centro_id'
  loop
    execute format('select coalesce(sum(pg_column_size(x.*)), 0) from public.%I x where x.centro_id = $1', t.table_name)
      into parcial using p_centro;
    total := total + parcial;
  end loop;
  return total;
end;
$$;
revoke execute on function public.centro_db_bytes(uuid) from public, anon, authenticated;

alter table public.centros add column if not exists uso_datos_bytes bigint not null default 0;
alter table public.centros add column if not exists uso_calculado_at timestamptz;

create or replace function public.actualizar_uso_centro(p_centro uuid)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare v bigint;
begin
  v := public.centro_db_bytes(p_centro);
  update public.centros set uso_datos_bytes = v, uso_calculado_at = now() where id = p_centro;
  return v;
end;
$$;
revoke execute on function public.actualizar_uso_centro(uuid) from public, anon, authenticated;

-- Bloquea registros nuevos si el centro superó el límite de datos de su plan (lee el valor guardado).
create or replace function public.bloquear_si_sin_espacio_datos()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uso bigint;
  v_max integer;
begin
  if new.centro_id is null then return new; end if;
  select c.uso_datos_bytes, p.max_db_mb into v_uso, v_max
  from public.centros c left join public.plans p on p.id = c.plan_id
  where c.id = new.centro_id;
  if v_max is not null and v_uso >= v_max::bigint * 1024 * 1024 then
    raise exception 'El centro alcanzó el límite de datos de su plan. Amplía el plan para seguir registrando.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.bloquear_si_sin_espacio_datos() from public, anon, authenticated;

-- Tablas operativas; quedan fuera las del sistema para no bloquear accesos ni cobros.
do $$
declare t record;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'centro_id'
      and c.table_name not in ('profiles','invitaciones','subscription_events','audit_log','audit_logs','alertas_seguridad',
        'ai_balance','ai_usage','aria_usage','token_topups','token_transactions','push_subscriptions','notificaciones',
        'notifications','metricas_diarias','benchmark_snapshots','wsp_sessions','payments','facturas',
        'agente_acciones','agente_alertas','agente_conversaciones')
  loop
    execute format('drop trigger if exists zz_limite_datos on public.%I', t.table_name);
    execute format('create trigger zz_limite_datos before insert on public.%I for each row execute function public.bloquear_si_sin_espacio_datos()', t.table_name);
  end loop;
end $$;

select public.actualizar_uso_centro(id) from public.centros;
