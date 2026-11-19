-- Launch security. Apply by hand before merging the app change.
-- Does not delete or rewrite doctor rows.

-- ---------------------------------------------------------------------------
-- 1. Public doctor directory cannot read PII.
-- Anon loses SELECT on the base table. Authenticated users can still read
-- their own row ("Doctors own profile"). Everyone else uses this view.
-- ---------------------------------------------------------------------------
drop policy if exists "Public reads verified doctors" on public.doctors;

revoke select on table public.doctors from anon;

create or replace view public.public_doctors
with (security_invoker = false, security_barrier = true) as
select
  id,
  full_name,
  specialization,
  sub_specialization,
  qualifications,
  experience_years,
  clinic_name,
  city,
  country,
  consultation_fee_pkr,
  accepts_online,
  accepts_walk_in,
  bio,
  avatar_url,
  profile_photo_url,
  pmdc_number,
  languages,
  rating,
  is_active,
  pmdc_verified,
  registration_status,
  accepting_new_patients,
  last_seen_at,
  manual_status_override,
  override_expires_at,
  availability_status,
  is_online
from public.doctors
where pmdc_verified = true
  and is_active = true
  and registration_status = 'verified';

revoke all on table public.public_doctors from public, anon, authenticated;
grant select on table public.public_doctors to anon, authenticated;

-- Owners still read their own full row. Initplan-wrap auth.uid().
drop policy if exists "Doctors own profile" on public.doctors;
create policy "Doctors own profile" on public.doctors
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. A doctor cannot self-verify or inflate rating / consultation counts.
-- service_role (admin API) and platform_admins are allowed through.
-- Direct SQL with no JWT (postgres) is allowed so migrations keep working.
-- ---------------------------------------------------------------------------
create or replace function public.doctors_lock_privileged()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(auth.role(), '');
begin
  if jwt_role in ('service_role', '') then
    return new;
  end if;
  if exists (select 1 from public.platform_admins where user_id = (select auth.uid())) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.pmdc_verified := false;
    new.registration_status := 'pending';
    new.is_active := false;
    new.rating := 0;
    new.total_consultations := 0;
    new.verified_at := null;
    new.verified_by := null;
    return new;
  end if;
  new.pmdc_verified := old.pmdc_verified;
  new.registration_status := old.registration_status;
  new.is_active := old.is_active;
  new.rating := old.rating;
  new.total_consultations := old.total_consultations;
  new.verified_at := old.verified_at;
  new.verified_by := old.verified_by;
  return new;
end;
$$;

drop trigger if exists doctors_lock_privileged on public.doctors;
create trigger doctors_lock_privileged
  before insert or update on public.doctors
  for each row execute function public.doctors_lock_privileged();

revoke all on function public.doctors_lock_privileged() from public, anon, authenticated;

revoke update on table public.doctors from anon, authenticated;
grant update (
  full_name,
  phone,
  whatsapp,
  email,
  clinic_name,
  clinic_address,
  city,
  country,
  specialization,
  sub_specialization,
  qualifications,
  experience_years,
  consultation_fee_pkr,
  accepts_online,
  accepts_walk_in,
  bio,
  avatar_url,
  profile_photo_url,
  languages,
  signature_url,
  is_online,
  availability_status,
  last_seen_at,
  manual_status_override,
  override_expires_at,
  accepting_new_patients,
  max_daily_appointments,
  available_days,
  available_hours_start,
  available_hours_end,
  cnic,
  pmdc_number,
  pmdc_registration_type,
  pmdc_expiry_date,
  pmdc_certificate_url,
  degree_certificate_url,
  cnic_front_url,
  year_of_graduation
) on table public.doctors to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Bank details are not anonymous.
-- ---------------------------------------------------------------------------
drop policy if exists "Anyone reads platform settings" on public.platform_settings;
drop policy if exists "Signed-in reads platform settings" on public.platform_settings;
create policy "Signed-in reads platform settings" on public.platform_settings
  for select to authenticated
  using ((select auth.uid()) is not null);

-- ---------------------------------------------------------------------------
-- 4. Storage size and type limits.
-- ---------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'avatars';

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id in ('doctor-documents', 'payment-receipts');

update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'signatures';

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf']
where id = 'prescriptions';

update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array['audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'video/webm']
where id = 'consultation-audio';

-- ---------------------------------------------------------------------------
-- 5. search_path, initplan auth.uid(), indexes, execute grants.
-- ---------------------------------------------------------------------------
create or replace function public.prescriptions_lock_signed()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'approved' and old.content_hash is not null then
    if new.final_prescription is distinct from old.final_prescription
       or new.doctor_edited_prescription is distinct from old.doctor_edited_prescription
       or new.content_hash is distinct from old.content_hash
       or new.verify_code is distinct from old.verify_code
       or new.doctor_signed_at is distinct from old.doctor_signed_at
       or new.signed_pmdc_number is distinct from old.signed_pmdc_number
       or (new.status is distinct from old.status and new.status <> 'superseded') then
      raise exception 'Signed prescription % is locked; create a new version instead', old.id;
    end if;
  end if;
  if old.status = 'superseded' and new.status is distinct from old.status then
    raise exception 'Superseded prescription % cannot change status', old.id;
  end if;
  return new;
end;
$$;

create or replace function public.profiles_lock_account_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.account_role is not null
     and new.account_role is distinct from old.account_role
     and coalesce(auth.role(), '') in ('authenticated', 'anon') then
    raise exception 'account_role is already set';
  end if;
  return new;
end;
$$;

revoke all on function public.prescriptions_lock_signed() from public, anon, authenticated;
revoke all on function public.profiles_lock_account_role() from public, anon, authenticated;

drop policy if exists "Patients read signed prescriptions" on public.prescriptions;
create policy "Patients read signed prescriptions" on public.prescriptions
  for select to authenticated
  using (status = 'approved' and patient_id in (select id from public.patients where user_id = (select auth.uid())));

drop policy if exists "Doctors read own prescriptions" on public.prescriptions;
create policy "Doctors read own prescriptions" on public.prescriptions
  for select to authenticated
  using (doctor_id in (select id from public.doctors where user_id = (select auth.uid())));

drop policy if exists "Doctors own schedule" on public.doctor_schedules;
create policy "Doctors own schedule" on public.doctor_schedules
  for all to authenticated
  using (doctor_id in (select id from public.doctors where user_id = (select auth.uid())))
  with check (doctor_id in (select id from public.doctors where user_id = (select auth.uid())));

drop policy if exists "Doctors own exceptions" on public.doctor_availability_exceptions;
create policy "Doctors own exceptions" on public.doctor_availability_exceptions
  for all to authenticated
  using (doctor_id in (select id from public.doctors where user_id = (select auth.uid())))
  with check (doctor_id in (select id from public.doctors where user_id = (select auth.uid())));

drop policy if exists "Doctors own presence log" on public.doctor_presence_log;
create policy "Doctors own presence log" on public.doctor_presence_log
  for select to authenticated
  using (doctor_id in (select id from public.doctors where user_id = (select auth.uid())));

drop policy if exists "Doctors read own verification log" on public.doctor_verification_log;
create policy "Doctors read own verification log" on public.doctor_verification_log
  for select to authenticated
  using (doctor_id in (select id from public.doctors where user_id = (select auth.uid())));

drop policy if exists "Admins read own admin row" on public.platform_admins;
create policy "Admins read own admin row" on public.platform_admins
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Own notifications" on public.notifications;
create policy "Own notifications" on public.notifications
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Patients own notify requests" on public.doctor_notify_requests;
create policy "Patients own notify requests" on public.doctor_notify_requests
  for all to authenticated
  using (patient_user_id = (select auth.uid()))
  with check (patient_user_id = (select auth.uid()));

drop policy if exists "Patients own profile" on public.patients;
create policy "Patients own profile" on public.patients
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Doctors manage own documents" on storage.objects;
create policy "Doctors manage own documents" on storage.objects
  for all to authenticated
  using (bucket_id = 'doctor-documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'doctor-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Admins read all doctor documents" on storage.objects;
create policy "Admins read all doctor documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'doctor-documents' and (select auth.uid()) in (select user_id from public.platform_admins));

drop policy if exists "Doctors manage own signature" on storage.objects;
create policy "Doctors manage own signature" on storage.objects
  for all to authenticated
  using (bucket_id = 'signatures' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'signatures' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users manage own avatar" on storage.objects;
create policy "Users manage own avatar" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Patients upload own receipts" on storage.objects;
create policy "Patients upload own receipts" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Patients read own receipts" on storage.objects;
create policy "Patients read own receipts" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Admins read all receipts" on storage.objects;
create policy "Admins read all receipts" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-receipts' and (select auth.uid()) in (select user_id from public.platform_admins));

create index if not exists idx_doctors_user_id on public.doctors (user_id);
create index if not exists idx_doctors_verified_by on public.doctors (verified_by);
create index if not exists idx_patients_user_id on public.patients (user_id);
create index if not exists idx_consultations_appointment on public.consultations (appointment_id);
create index if not exists idx_consultations_doctor on public.consultations (doctor_id);
create index if not exists idx_consultations_patient on public.consultations (patient_id);
create index if not exists idx_prescriptions_consultation on public.prescriptions (consultation_id);
create index if not exists idx_prescriptions_patient on public.prescriptions (patient_id);
create index if not exists idx_audit_prescription on public.clinical_audit_log (prescription_id);
create index if not exists idx_presence_log_doctor on public.doctor_presence_log (doctor_id);
create index if not exists idx_verification_log_doctor on public.doctor_verification_log (doctor_id);
create index if not exists idx_verification_log_changed_by on public.doctor_verification_log (changed_by);
create index if not exists idx_notify_requests_patient on public.doctor_notify_requests (patient_user_id);
create index if not exists idx_payments_appointment on public.payments (appointment_id);
create index if not exists idx_payments_patient on public.payments (patient_id);
create index if not exists idx_payments_payer on public.payments (payer_user_id);
create index if not exists idx_voice_notes_sender on public.voice_notes (sender_user_id);
create index if not exists idx_platform_settings_updated_by on public.platform_settings (updated_by);

-- doctor_booked_slots stays callable by anon (public slot list). Everything else does not.
do $$
declare
  fn record;
begin
  for fn in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    if fn.proname = 'doctor_booked_slots' then
      continue;
    end if;
    execute format('revoke all on function public.%I(%s) from public, anon', fn.proname, fn.args);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Durable rate-limit buckets. Only the service role can write them.
-- ---------------------------------------------------------------------------
create table if not exists public.api_rate_limits (
  bucket text primary key,
  hits integer not null,
  window_start timestamptz not null
);
alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;
