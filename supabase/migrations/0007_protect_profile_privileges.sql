-- raw_user_meta_data is attacker-controlled via the public signUp endpoint, so it must never
-- decide role or centro. New users start powerless; server code (service role) assigns them.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, email, full_name, role, centro_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'padre',
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- FOR ALL on own row allowed delete + re-insert with an arbitrary role/centro.
drop policy if exists "Usuarios ven su propio perfil" on public.profiles;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role = 'programador' or not (is_admin() and same_centro(new.centro_id)) then
      new.role := 'padre';
      new.centro_id := null;
    end if;
    return new;
  end if;

  if new.role is distinct from old.role or new.centro_id is distinct from old.centro_id then
    if not (is_admin() and same_centro(old.centro_id))
       or new.centro_id is distinct from old.centro_id
       or new.role = 'programador'
       or old.role = 'programador' then
      raise exception 'Not allowed to change role or centro' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_privileges on public.profiles;
create trigger trg_protect_profile_privileges
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privileges();
