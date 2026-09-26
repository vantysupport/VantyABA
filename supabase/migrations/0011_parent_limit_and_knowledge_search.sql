-- Parent-account limit per centro: plans.max_parents + centros.extra_parents.
-- NULL max_parents = unlimited; 0 = no parent access (Starter) unless extra slots were bought.
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
  select p.max_patients, p.max_parents, c.extra_parents
    into v_pac_limit, v_max_parents, v_extra
  from centros c join plans p on p.id = c.plan_id
  where c.id = v_centro_id;

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

  -- Siblings of an already-admitted family are always allowed.
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

-- Vector search over a single centro's knowledge base (called by server code with the service role).
create or replace function public.buscar_conocimiento(
  query_embedding extensions.vector,
  match_count int default 10,
  similarity_threshold float default 0.5,
  p_centro uuid default null
)
returns table (id uuid, document_id uuid, contenido text, metadata jsonb, centro_id uuid, similarity float)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select k.id, k.document_id, k.contenido, k.metadata, k.centro_id,
         1 - (k.embedding <=> query_embedding) as similarity
  from knowledge_chunks k
  where p_centro is not null
    and k.centro_id = p_centro
    and k.embedding is not null
    and 1 - (k.embedding <=> query_embedding) >= similarity_threshold
  order by k.embedding <=> query_embedding
  limit least(match_count, 50)
$$;
revoke all on function public.buscar_conocimiento(extensions.vector, int, float, uuid) from public, anon, authenticated;
