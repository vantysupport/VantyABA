-- 0003_functions_and_triggers.sql
-- RLS helper functions (recreated exactly from functions.json unless noted) and triggers.
-- Runs after 0002 so the tables these LANGUAGE SQL functions query already exist.

CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('jefe','admin','especialista','terapeuta','secretaria')
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('jefe','admin')
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_parent_of(p_child_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.children
    WHERE id = p_child_id AND parent_id = auth.uid()
  )
$function$;

CREATE OR REPLACE FUNCTION public.auth_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT role::text FROM public.profiles WHERE id = auth.uid() LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public._apply_rls(p_table text, p_policy text, p_using text, p_check text DEFAULT NULL::text, p_for text DEFAULT 'ALL'::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_full text := format('public.%I', p_table);
  v_check_clause text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
  ) THEN
    RAISE NOTICE '[RLS] tabla % no existe — se omite', p_table;
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', v_full);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %s', p_policy, v_full);

  IF p_for = 'SELECT' OR p_for = 'DELETE' THEN
    EXECUTE format(
      'CREATE POLICY %I ON %s FOR %s TO authenticated USING (%s)',
      p_policy, v_full, p_for, p_using
    );
  ELSIF p_for = 'INSERT' THEN
    v_check_clause := COALESCE(p_check, p_using);
    EXECUTE format(
      'CREATE POLICY %I ON %s FOR INSERT TO authenticated WITH CHECK (%s)',
      p_policy, v_full, v_check_clause
    );
  ELSE
    v_check_clause := COALESCE(p_check, p_using);
    EXECUTE format(
      'CREATE POLICY %I ON %s FOR %s TO authenticated USING (%s) WITH CHECK (%s)',
      p_policy, v_full, p_for, p_using, v_check_clause
    );
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_session(p_session_id text, p_stale_seconds integer DEFAULT 30)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_current text;
  v_at timestamptz;
begin
  if v_uid is null then
    return 'no_auth';
  end if;

  select active_session_id, active_session_at
    into v_current, v_at
    from public.profiles
    where id = v_uid
    for update;

  if v_current is null
     or v_current = p_session_id
     or v_at is null
     or v_at < now() - make_interval(secs => p_stale_seconds) then
    update public.profiles
      set active_session_id = p_session_id,
          active_session_at = now()
      where id = v_uid;
    return 'claimed';
  else
    return 'in_use';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.heartbeat_session(p_session_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;
  update public.profiles
    set active_session_at = now()
    where id = v_uid and active_session_id = p_session_id;
  return found;
end;
$function$;

CREATE OR REPLACE FUNCTION public.release_session(p_session_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.profiles
    set active_session_id = null,
        active_session_at = null
    where active_session_id = p_session_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_db_size()
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select pg_database_size(current_database());
$function$;

-- New helper: is the given centro the caller's own centro?
create or replace function public.same_centro(target_centro_id uuid)
returns boolean language sql stable security definer as $$
  select target_centro_id is not null
    and target_centro_id = (select centro_id from public.profiles where id = auth.uid())
$$;

-- handle_new_user: modified so it no longer hardcodes role = 'padre'. Reads role/centro_id
-- from signup metadata if present (for the future invite-link flow), falling back to
-- 'padre'/null to preserve today's self-serve-parent-signup behavior.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, centro_id)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'padre'),
    (new.raw_user_meta_data->>'centro_id')::uuid
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;

-- enforce_padre_limit: modified to read limits from the child's centro's plan instead of
-- the (dropped) global app_settings.limits singleton.
create or replace function public.enforce_padre_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role      text;
  v_created   timestamptz;
  v_limit     int;
  v_before    int;
  v_pac_limit int;
  v_pac_count int;
  v_is_staff  boolean;
  v_centro_id uuid;
begin
  v_centro_id := new.centro_id;

  select p.max_patients into v_pac_limit
  from public.centros c
  join public.plans p on p.id = c.plan_id
  where c.id = v_centro_id;

  if v_pac_limit is not null and v_pac_limit > 0 then
    select count(*) into v_pac_count from public.children where centro_id = v_centro_id;
    if v_pac_count >= v_pac_limit then
      raise exception 'El centro alcanzo el numero maximo de pacientes.'
        using errcode = 'P0001';
    end if;
  end if;

  v_is_staff := exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('jefe','admin','especialista','terapeuta','secretaria','programador')
  );
  if v_is_staff then
    return new;
  end if;

  select role, created_at into v_role, v_created
  from public.profiles where id = new.parent_id;
  if v_role is distinct from 'padre' then
    return new;
  end if;

  select p.max_parents into v_limit
  from public.centros c
  join public.plans p on p.id = c.plan_id
  where c.id = v_centro_id;

  if v_limit is null or v_limit <= 0 then
    return new;
  end if;

  if exists (select 1 from public.children where parent_id = new.parent_id) then
    return new;
  end if;

  select count(*) into v_before
  from public.profiles
  where role = 'padre' and created_at < v_created;

  if v_before >= v_limit then
    raise exception 'El centro alcanzo el numero maximo de cuentas de familias.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

-- Triggers from misc.json
create trigger blog_posts_updated_at before update on public.blog_posts for each row execute function public.set_updated_at();
create trigger trg_enforce_padre_limit before insert on public.children for each row execute function public.enforce_padre_limit();

-- JUDGMENT CALL / necessary completion: misc.json only captured public-schema triggers,
-- but handle_new_user() is designed to fire on auth.users inserts (that is the whole point
-- of self-serve signup). The old project must have had an equivalent auth-schema trigger
-- that this export did not capture. Recreated here so signup actually populates profiles.
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
