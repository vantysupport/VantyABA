-- Hotfixes applied directly to the legacy single-center production project "Santi"
-- (bqltwillimwnbhtpgvps) on 2026-09-22. Not part of the Vanty 2.0 migrations in ./migrations.

-- 1) anon had full DML grants on every table carrying an allow_all_* RLS policy (qual = true),
--    so anyone holding the public anon key could read/modify/delete clinical data without logging in.
do $$
declare r record;
begin
  for r in
    select distinct tablename from pg_policies
    where schemaname = 'public' and policyname like 'allow_all_%'
  loop
    execute format('revoke all on public.%I from anon', r.tablename);
  end loop;
end $$;

-- 2) profiles RLS let any authenticated user update their own row, including role
--    (e.g. padre -> jefe). Only jefe/admin (or server-side service role) may change roles now.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role is distinct from 'padre' and (new.role = 'programador' or not is_admin()) then
      new.role := 'padre';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role then
    if not is_admin() or new.role = 'programador' or old.role = 'programador' then
      raise exception 'Not allowed to change role' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_role on public.profiles;
create trigger trg_protect_profile_role
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

-- Still open in this legacy project (fixed properly in Vanty 2.0 by design): any authenticated
-- user can read/write other families' rows through the allow_all_* policies.
