-- Uso de la infraestructura para la consola /control (Resumen → Almacenamiento): tamaño de la base,
-- de cada bucket de Storage y las tablas más pesadas. Solo la service role puede llamarla.
create or replace function public.uso_infraestructura()
returns json
language sql
security definer
set search_path = public, storage, pg_catalog
as $$
  select json_build_object(
    'db_bytes', pg_database_size(current_database()),
    'buckets', coalesce((
      select json_agg(b order by b.bytes desc)
      from (
        select bucket_id as bucket, count(*) as objetos, coalesce(sum((metadata->>'size')::bigint), 0) as bytes
        from storage.objects group by bucket_id
      ) b
    ), '[]'::json),
    'tablas', coalesce((
      select json_agg(t)
      from (
        select c.relname as tabla, pg_total_relation_size(c.oid) as bytes
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by pg_total_relation_size(c.oid) desc
        limit 6
      ) t
    ), '[]'::json)
  )
$$;

revoke all on function public.uso_infraestructura() from public, anon, authenticated;
grant execute on function public.uso_infraestructura() to service_role;
