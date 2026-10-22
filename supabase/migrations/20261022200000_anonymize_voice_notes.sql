-- Adds voice_notes to anonymize_account(): notes stay (audio + transcript are
-- medical content), the sender link is detached and anonymized_at stamped.
-- Same function body as 20261022180000 plus the voice_notes update.
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
