-- Buckets the doctor flow needs but that were never created on this project:
-- doctor-documents (registration uploads), signatures (saved doctor signature),
-- avatars (profile photos). Idempotent.
insert into storage.buckets (id, name, public)
values ('doctor-documents', 'doctor-documents', false),
       ('signatures', 'signatures', false),
       ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Doctors manage own documents" on storage.objects;
create policy "Doctors manage own documents" on storage.objects for all using (
  bucket_id = 'doctor-documents' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'doctor-documents' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Admins read all doctor documents" on storage.objects;
create policy "Admins read all doctor documents" on storage.objects for select using (
  bucket_id = 'doctor-documents' and auth.uid() in (select user_id from public.platform_admins)
);

drop policy if exists "Doctors manage own signature" on storage.objects;
create policy "Doctors manage own signature" on storage.objects for all using (
  bucket_id = 'signatures' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'signatures' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Public reads avatars" on storage.objects;
create policy "Public reads avatars" on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "Users manage own avatar" on storage.objects;
create policy "Users manage own avatar" on storage.objects for all using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
