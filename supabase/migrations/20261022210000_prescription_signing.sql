-- Phase 2: signed, versioned, verifiable prescriptions.
-- * Patients can only ever read SIGNED (approved) prescriptions — drafts,
--   revisions, rejected and superseded rows stay doctor-only (fixes the old
--   "Prescription access" policy which let a patient read drafts directly).
-- * A signed prescription is immutable (trigger). Changing it means a new
--   version row (supersedes_id) which, once signed, marks the old one superseded.
-- * verify_code + content_hash power the public /verify/[code] page, which is
--   served by the server (service role) and never exposes patient identity.

alter table public.prescriptions drop constraint if exists prescriptions_status_check;
alter table public.prescriptions add constraint prescriptions_status_check
  check (status in ('draft', 'pending_review', 'approved', 'rejected', 'revised', 'superseded'));

alter table public.prescriptions
  add column if not exists version integer not null default 1,
  add column if not exists supersedes_id uuid references public.prescriptions(id) on delete set null,
  add column if not exists superseded_by uuid references public.prescriptions(id) on delete set null,
  add column if not exists content_hash text,
  add column if not exists verify_code text,
  add column if not exists signed_by_doctor_id uuid,
  add column if not exists signed_doctor_name text,
  add column if not exists signed_doctor_specialty text,
  add column if not exists signed_pmdc_number text,
  add column if not exists signature_path text,
  add column if not exists anonymized_at timestamptz;
create unique index if not exists prescriptions_verify_code_key on public.prescriptions (verify_code) where verify_code is not null;

drop policy if exists "Prescription access" on public.prescriptions;
create policy "Patients read signed prescriptions" on public.prescriptions for select
  using (status = 'approved' and patient_id in (select id from public.patients where user_id = auth.uid()));
create policy "Doctors read own prescriptions" on public.prescriptions for select
  using (doctor_id in (select id from public.doctors where user_id = auth.uid()));

-- Signed content is locked. Allowed after signing: superseding, PDF path,
-- anonymization of the snapshot identity fields.
create or replace function public.prescriptions_lock_signed()
returns trigger language plpgsql as $$
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
drop trigger if exists prescriptions_lock_signed on public.prescriptions;
create trigger prescriptions_lock_signed before update on public.prescriptions
  for each row execute function public.prescriptions_lock_signed();

-- anonymize_account: previous body (20261022200000) + signed-prescription identity detach.
create or replace function public.anonymize_account(target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pat_ids uuid[];
  doc_ids uuid[];
  pdfs text[];
begin
  select coalesce(array_agg(id), '{}') into pat_ids from public.patients where user_id = target;
  select coalesce(array_agg(id), '{}') into doc_ids from public.doctors where user_id = target;

  select coalesce(array_agg(doctor_id::text || '/' || id::text || '.pdf') filter (where pdf_url is not null), '{}') into pdfs
  from public.prescriptions where patient_id = any(pat_ids) or doctor_id = any(doc_ids);

  update public.patients set
    full_name = 'Deleted patient', phone = null, emergency_contact_name = null,
    emergency_contact_phone = null, user_id = null, anonymized_at = now(), updated_at = now()
  where id = any(pat_ids);

  update public.doctors set
    full_name = 'Deleted doctor', phone = '', whatsapp = null, email = null, cnic = null,
    clinic_name = null, clinic_address = null, bio = null, avatar_url = null, profile_photo_url = null,
    pmdc_certificate_url = null, degree_certificate_url = null, cnic_front_url = null, signature_url = null,
    pmdc_number = 'deleted-' || id::text, is_active = false, is_online = false,
    availability_status = 'offline', accepting_new_patients = false,
    user_id = null, anonymized_at = now(), updated_at = now()
  where id = any(doc_ids);

  -- Open bookings can't happen anymore; history stays.
  update public.appointments set status = 'cancelled', updated_at = now()
  where (patient_id = any(pat_ids) or doctor_id = any(doc_ids)) and status in ('pending', 'confirmed');

  update public.consultations set call_recording_url = null, twilio_call_sid = null
  where patient_id = any(pat_ids) or doctor_id = any(doc_ids);

  -- PDFs print the name; the structured prescription stays (doctor_pmdc_number kept for legal validity).
  update public.prescriptions set pdf_url = null
  where patient_id = any(pat_ids) or doctor_id = any(doc_ids);

  -- Signed prescriptions keep their content + hash (the verify page still
  -- confirms integrity); the identity snapshot of a deleted doctor and the
  -- stored signature image are detached.
  update public.prescriptions set signed_doctor_name = 'Deleted doctor', signature_path = null,
    signed_by_doctor_id = null, anonymized_at = now()
  where doctor_id = any(doc_ids);
  update public.prescriptions set anonymized_at = coalesce(anonymized_at, now())
  where patient_id = any(pat_ids);

  update public.payments set receipt_path = null where payer_user_id = target;

  -- Voice notes are medical content: keep audio + transcript, detach the sender.
  update public.voice_notes set sender_user_id = null, anonymized_at = now()
  where sender_user_id = target
     or appointment_id in (select id from public.appointments where patient_id = any(pat_ids) or doctor_id = any(doc_ids));

  return jsonb_build_object('patients', to_jsonb(pat_ids), 'doctors', to_jsonb(doc_ids), 'pdfs', to_jsonb(pdfs));
end;
$$;
revoke all on function public.anonymize_account(uuid) from public, anon, authenticated;
grant execute on function public.anonymize_account(uuid) to service_role;
