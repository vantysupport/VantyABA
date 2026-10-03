-- App de Android: versión publicada y notas de la versión (se editan desde /control → Plataforma).
-- { version_code, version_name, notas, url_apk, obligatoria }
alter table public.platform_settings add column if not exists app_android jsonb not null default '{}'::jsonb;

-- Bucket público para el APK (descarga directa fuera de Google Play). Solo el servidor sube archivos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('app', 'app', true, 52428800, array['application/vnd.android.package-archive', 'application/octet-stream'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
