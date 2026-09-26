-- 0005_storage.sql
-- Recreates the 7 storage buckets and baseline authenticated-access policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-covers', 'blog-covers', true, null, null)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-files', 'chat-files', true, null, null)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', true, null, null)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('knowledge-base', 'knowledge-base', false, 104857600, array['application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patient-documents', 'patient-documents', true, null, null)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-images', 'public-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-images', 'store-images', true, null, null)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Baseline policies: authenticated users can read/write within any of these buckets.
-- Path-prefix scoping by centro_id (once app code namespaces uploads as <centro_id>/...)
-- is deferred to a later phase per SPEC.md Step 4.
create policy "blog-covers_authenticated_rw" on storage.objects for all to authenticated
  using (bucket_id = 'blog-covers')
  with check (bucket_id = 'blog-covers');
create policy "blog-covers_public_read" on storage.objects for select to anon
  using (bucket_id = 'blog-covers');
create policy "chat-files_authenticated_rw" on storage.objects for all to authenticated
  using (bucket_id = 'chat-files')
  with check (bucket_id = 'chat-files');
create policy "chat-files_public_read" on storage.objects for select to anon
  using (bucket_id = 'chat-files');
create policy "chat-media_authenticated_rw" on storage.objects for all to authenticated
  using (bucket_id = 'chat-media')
  with check (bucket_id = 'chat-media');
create policy "chat-media_public_read" on storage.objects for select to anon
  using (bucket_id = 'chat-media');
create policy "knowledge-base_authenticated_rw" on storage.objects for all to authenticated
  using (bucket_id = 'knowledge-base')
  with check (bucket_id = 'knowledge-base');
create policy "patient-documents_authenticated_rw" on storage.objects for all to authenticated
  using (bucket_id = 'patient-documents')
  with check (bucket_id = 'patient-documents');
create policy "patient-documents_public_read" on storage.objects for select to anon
  using (bucket_id = 'patient-documents');
create policy "public-images_authenticated_rw" on storage.objects for all to authenticated
  using (bucket_id = 'public-images')
  with check (bucket_id = 'public-images');
create policy "public-images_public_read" on storage.objects for select to anon
  using (bucket_id = 'public-images');
create policy "store-images_authenticated_rw" on storage.objects for all to authenticated
  using (bucket_id = 'store-images')
  with check (bucket_id = 'store-images');
create policy "store-images_public_read" on storage.objects for select to anon
  using (bucket_id = 'store-images');
