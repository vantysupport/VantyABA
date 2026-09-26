-- Fill centro_id on insert when the caller didn't send it, so legacy code paths keep working.
-- Derivation order: related child, then owning/related profiles, then the inserting user.
-- RLS WITH CHECK still runs after this, so deriving from another center's child is rejected.
create or replace function public.set_centro_id()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  j jsonb := to_jsonb(new);
  v uuid;
  k text;
begin
  if new.centro_id is not null then
    return new;
  end if;

  if j ? 'child_id' and j->>'child_id' is not null then
    select centro_id into v from children where id = (j->>'child_id')::uuid;
  end if;

  if v is null then
    foreach k in array array['parent_id', 'user_id', 'sender_id', 'specialist_id', 'professional_id', 'created_by', 'uploaded_by', 'filled_by']
    loop
      if j ? k and j->>k is not null then
        select centro_id into v from profiles where id = (j->>k)::uuid;
        exit when v is not null;
      end if;
    end loop;
  end if;

  if v is null and auth.uid() is not null then
    select centro_id into v from profiles where id = auth.uid();
  end if;

  new.centro_id := v;
  return new;
end;
$$;

do $$
declare r record;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'centro_id' and t.table_type = 'BASE TABLE'
      and c.table_name not in ('profiles')
  loop
    execute format('drop trigger if exists trg_00_set_centro_id on public.%I', r.table_name);
    execute format('create trigger trg_00_set_centro_id before insert on public.%I for each row execute function public.set_centro_id()', r.table_name);
  end loop;
end $$;
