-- Espacio para archivos (documentos, adjuntos) por plan. NULL = sin límite.
alter table public.plans add column if not exists max_storage_mb integer check (max_storage_mb is null or max_storage_mb > 0);
comment on column public.plans.max_storage_mb is 'Espacio para archivos del centro (MB). NULL = sin límite.';
