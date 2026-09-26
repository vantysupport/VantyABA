-- Cerebro IA compartido: el conocimiento de los centros con plan Fundador (base curada por la plataforma)
-- lo usan ARIA y los agentes de TODAS las clínicas, además del conocimiento propio de cada centro.
create or replace function public.buscar_conocimiento_multi(
  query_embedding vector, match_count integer default 10, similarity_threshold double precision default 0.5, p_centros uuid[] default null
) returns table(id uuid, document_id uuid, contenido text, metadata jsonb, centro_id uuid, similarity double precision)
language sql stable security definer set search_path to 'public', 'extensions' as $$
  select k.id, k.document_id, k.contenido, k.metadata, k.centro_id,
         1 - (k.embedding <=> query_embedding) as similarity
  from knowledge_chunks k
  where p_centros is not null
    and k.centro_id = any(p_centros)
    and k.embedding is not null
    and 1 - (k.embedding <=> query_embedding) >= similarity_threshold
  order by k.embedding <=> query_embedding
  limit least(match_count, 50)
$$;
revoke all on function public.buscar_conocimiento_multi(vector, integer, double precision, uuid[]) from public, anon, authenticated;
