-- Idioma en que se generó el plan de "Practicar en casa" y sus traducciones guardadas
-- (se traduce una sola vez por idioma y se reutiliza).
alter table public.engagement_planes add column if not exists idioma text not null default 'es';
alter table public.engagement_planes add column if not exists traducciones jsonb not null default '{}'::jsonb;
