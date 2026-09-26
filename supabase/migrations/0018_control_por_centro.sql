-- Control por centro desde /control: límites propios (encima del plan) y funciones activables por centro.
--   centros.limites  → {"max_patients":30,"max_storage_mb":4096,...}  (clave ausente = usa la del plan)
--   centros.features → {"pagos":false,...}                            (clave ausente = según plan/plataforma)
alter table public.centros add column if not exists limites jsonb not null default '{}'::jsonb;
alter table public.centros add column if not exists features jsonb not null default '{}'::jsonb;

-- Límite efectivo de un centro: el propio si existe, si no el de su plan. NULL = sin límite.
create or replace function public.limite_centro(p_centro uuid, p_clave text)
returns integer
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_propio text;
  v_plan integer;
begin
  select c.limites ->> p_clave into v_propio from public.centros c where c.id = p_centro;
  if v_propio is not null and v_propio ~ '^\d+$' then return v_propio::integer; end if;
  execute format('select p.%I from public.centros c join public.plans p on p.id = c.plan_id where c.id = $1', p_clave)
    into v_plan using p_centro;
  return v_plan;
end;
$$;
revoke execute on function public.limite_centro(uuid, text) from public, anon, authenticated;

-- Pacientes y familias: usan el límite efectivo del centro.
create or replace function public.enforce_padre_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_centro_id uuid := new.centro_id;
  v_pac_limit int;
  v_pac_count int;
  v_role text;
  v_created timestamptz;
  v_max_parents int;
  v_extra int;
  v_before int;
begin
  v_pac_limit := public.limite_centro(v_centro_id, 'max_patients');
  v_max_parents := public.limite_centro(v_centro_id, 'max_parents');
  select c.extra_parents into v_extra from centros c where c.id = v_centro_id;

  if v_pac_limit is not null and v_pac_limit > 0 then
    select count(*) into v_pac_count from children where centro_id = v_centro_id;
    if v_pac_count >= v_pac_limit then
      raise exception 'El centro alcanzó el número máximo de pacientes.' using errcode = 'P0001';
    end if;
  end if;

  if exists (select 1 from profiles where id = auth.uid() and role in ('jefe','admin','especialista','terapeuta','secretaria','programador')) then
    return new;
  end if;

  select role, created_at into v_role, v_created from profiles where id = new.parent_id;
  if v_role is distinct from 'padre' or v_max_parents is null then
    return new;
  end if;

  if exists (select 1 from children where parent_id = new.parent_id) then
    return new;
  end if;

  select count(*) into v_before
  from profiles
  where role = 'padre' and centro_id = v_centro_id and created_at < v_created;

  if v_before >= v_max_parents + coalesce(v_extra, 0) then
    raise exception 'El centro alcanzó el número máximo de cuentas de familias.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Datos: usa el límite efectivo del centro.
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
  select c.uso_datos_bytes into v_uso from public.centros c where c.id = new.centro_id;
  v_max := public.limite_centro(new.centro_id, 'max_db_mb');
  if v_max is not null and v_uso >= v_max::bigint * 1024 * 1024 then
    raise exception 'El centro alcanzó el límite de datos de su plan. Amplía el plan para seguir registrando.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
