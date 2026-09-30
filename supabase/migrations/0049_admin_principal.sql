-- Administrador principal: quien creó el centro (centros.owner_id). Solo esa persona puede cambiar el rol o
-- desactivar a otro administrador (jefe/admin), y nadie puede cambiar el rol del principal.
-- Si un centro no tiene owner_id, cualquier jefe del centro cuenta como principal (compatibilidad).

create or replace function public.es_admin_principal(p_centro uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.centros c
    where c.id = p_centro
      and (c.owner_id = auth.uid()
        or (c.owner_id is null and exists (
          select 1 from public.profiles p where p.id = auth.uid() and p.role = 'jefe' and p.centro_id = p_centro)))
  );
$$;
revoke all on function public.es_admin_principal(uuid) from public, anon;
grant execute on function public.es_admin_principal(uuid) to authenticated;

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
    -- El rol del administrador principal no lo cambia nadie.
    if exists (select 1 from public.centros c where c.id = old.centro_id and c.owner_id = old.id) then
      raise exception 'The main administrator role cannot be changed' using errcode = '42501';
    end if;
    -- Dar o quitar el rol de administrador: solo el principal.
    if (old.role in ('jefe', 'admin') or new.role in ('jefe', 'admin')) and not es_admin_principal(old.centro_id) then
      raise exception 'Only the main administrator can change administrator roles' using errcode = '42501';
    end if;
  end if;

  -- Desactivar o reactivar a otro administrador: solo el principal.
  if new.is_active is distinct from old.is_active and old.role in ('jefe', 'admin') and old.id <> auth.uid()
     and not es_admin_principal(old.centro_id) then
    raise exception 'Only the main administrator can deactivate an administrator' using errcode = '42501';
  end if;
  return new;
end;
$$;
