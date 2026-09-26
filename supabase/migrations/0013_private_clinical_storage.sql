-- 0013_private_clinical_storage.sql
-- Clinical documents and chat attachments stop being public. Files are read through
-- /api/files (permission check + short-lived signed URL); direct client access to
-- storage.objects is limited to the patient's family / the patient's centro staff
-- (patient-documents) and to the uploader's centro staff (chat-files).

update storage.buckets set public = false where id in ('patient-documents', 'chat-files', 'chat-media');

drop policy if exists "patient-documents_public_read" on storage.objects;
drop policy if exists "chat-files_public_read" on storage.objects;
drop policy if exists "chat-media_public_read" on storage.objects;
drop policy if exists "patient-documents_authenticated_rw" on storage.objects;
drop policy if exists "chat-files_authenticated_rw" on storage.objects;
drop policy if exists "chat-media_authenticated_rw" on storage.objects;

-- <child_id>/... : the child's parent, or staff of the child's centro.
create or replace function public.storage_child_access(p_folder text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.children c
    join public.profiles me on me.id = auth.uid()
    where c.id::text = p_folder
      and (c.parent_id = auth.uid()
           or (c.centro_id = me.centro_id and me.role in ('jefe','admin','especialista','terapeuta','secretaria')))
  )
$$;

-- chat/<user_id>/... and avatars/<user_id>.<ext> : the owner, or staff of the owner's centro.
create or replace function public.storage_same_centro_user(p_user text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user = auth.uid()::text or exists (
    select 1
    from public.profiles owner
    join public.profiles me on me.id = auth.uid()
    where owner.id::text = p_user
      and owner.centro_id = me.centro_id
      and me.role in ('jefe','admin','especialista','terapeuta','secretaria')
  )
$$;

revoke all on function public.storage_child_access(text) from public, anon;
revoke all on function public.storage_same_centro_user(text) from public, anon;
grant execute on function public.storage_child_access(text) to authenticated;
grant execute on function public.storage_same_centro_user(text) to authenticated;

create policy "patient-documents_scoped" on storage.objects for all to authenticated
  using (bucket_id = 'patient-documents' and public.storage_child_access((storage.foldername(name))[1]))
  with check (bucket_id = 'patient-documents' and public.storage_child_access((storage.foldername(name))[1]));

-- Reading chat files follows the owner's centro; writing only into your own folder.
create policy "chat-files_scoped_read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-files' and (
    ((storage.foldername(name))[1] = 'chat' and public.storage_same_centro_user((storage.foldername(name))[2]))
    or ((storage.foldername(name))[1] = 'avatars' and public.storage_same_centro_user(split_part(storage.filename(name), '.', 1)))
  ));
create policy "chat-files_own_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-files' and (
    ((storage.foldername(name))[1] = 'chat' and (storage.foldername(name))[2] = auth.uid()::text)
    or ((storage.foldername(name))[1] = 'avatars' and split_part(storage.filename(name), '.', 1) = auth.uid()::text)
  ));
create policy "chat-files_own_update" on storage.objects for update to authenticated
  using (bucket_id = 'chat-files' and (
    ((storage.foldername(name))[1] = 'chat' and (storage.foldername(name))[2] = auth.uid()::text)
    or ((storage.foldername(name))[1] = 'avatars' and split_part(storage.filename(name), '.', 1) = auth.uid()::text)
  ));
create policy "chat-files_own_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-files' and (
    ((storage.foldername(name))[1] = 'chat' and (storage.foldername(name))[2] = auth.uid()::text)
    or ((storage.foldername(name))[1] = 'avatars' and split_part(storage.filename(name), '.', 1) = auth.uid()::text)
  ));

-- chat-media is written and read only by the server (service role) → no client policies.
