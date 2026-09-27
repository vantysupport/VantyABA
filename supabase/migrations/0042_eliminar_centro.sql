-- Eliminar un centro con toda su información (desde /control, solo programador con 2FA).
--
-- Las relaciones con centros están protegidas (ON DELETE NO ACTION, ver 0021), así que no basta con
-- borrar la fila del centro. borrar_centro() vacía cada tabla que apunta al centro, en el orden que
-- permitan sus dependencias, y al final borra el centro (lo demás cae por CASCADE / SET NULL).
-- Todo ocurre en una sola transacción: si algo falla, no se borra nada.
--
-- Las cuentas de acceso (auth.users, es decir los correos) se eliminan después desde la ruta con la
-- API de administración, igual que los archivos en R2 / Storage.

-- audit_log es de solo agregar (trigger audit_log_immutable) y su cadena de hashes no debe romperse:
-- se conservan sus filas y solo se quita la relación, dejando centro_id como referencia histórica.
alter table public.audit_log drop constraint if exists audit_log_centro_id_fkey;

create or replace function public.borrar_centro(p_centro uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n bigint;
  total bigint := 0;
  pendientes text[];
  pasada int := 0;
  avance boolean;
begin
  if not exists (select 1 from centros where id = p_centro) then
    raise exception 'centro_not_found' using errcode = 'P0002';
  end if;

  -- Varias pasadas: una tabla puede quedar bloqueada por otra que aún tiene filas del centro.
  loop
    pasada := pasada + 1;
    pendientes := '{}';
    avance := false;
    for r in
      select c.conrelid::regclass as tabla, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.confrelid = 'public.centros'::regclass
        and c.confdeltype in ('a', 'r') and array_length(c.conkey, 1) = 1
    loop
      begin
        execute format('delete from %s where %I = $1', r.tabla, r.col) using p_centro;
        get diagnostics n = row_count;
        if n > 0 then total := total + n; avance := true; end if;
      exception when foreign_key_violation then
        pendientes := pendientes || r.tabla::text;
      end;
    end loop;
    exit when cardinality(pendientes) = 0;
    if not avance or pasada >= 12 then
      raise exception 'centro_delete_blocked: %', array_to_string(pendientes, ', ') using errcode = '23503';
    end if;
  end loop;

  delete from centros where id = p_centro;
  return jsonb_build_object('filas', total, 'pasadas', pasada);
end;
$$;

revoke all on function public.borrar_centro(uuid) from public, anon, authenticated;
grant execute on function public.borrar_centro(uuid) to service_role;
