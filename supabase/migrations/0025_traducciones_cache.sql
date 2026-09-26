-- Caché de traducciones automáticas de textos del expediente (nombres de programas, indicaciones…)
-- para mostrarlos en el idioma de la app. Clave = hash del texto original + idioma destino.
create table if not exists public.traducciones_cache (
  hash       text not null,
  idioma     text not null,
  texto      text not null,
  created_at timestamptz not null default now(),
  primary key (hash, idioma)
);
alter table public.traducciones_cache enable row level security;
revoke all on public.traducciones_cache from anon, authenticated;
