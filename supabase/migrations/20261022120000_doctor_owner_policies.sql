-- Owner-scoped policies for telehealth when API routes use the caller's JWT
-- instead of the service role. Apply in the Supabase SQL editor after
-- supabase/schema.sql. Existing policies stay. These add the writes they
-- omitted. Nothing here lets one user read another user's rows.
--
-- Security-definer helpers read across tables so policies do not recurse
-- (patients <-> appointments). Each is STABLE, pinned to search_path public,
-- and executable only by authenticated and service_role.
--
-- Still service-role only (503 "Server not fully configured" when the key is
-- missing): account deletion, admin doctor verification, and sweeps that
-- touch other doctors. generations, artifacts, and waitlist_signups stay
-- closed — those agents are gone and the waitlist has no client policy.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_own_patient(patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.patients p
    where p.id = patient and p.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_own_doctor(doctor uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.doctors d
    where d.id = doctor and d.user_id = (select auth.uid())
  );
$$;

-- The signed-in patient may book only a verified, active doctor.
create or replace function public.patient_books(patient uuid, doctor uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.patients p
    join public.doctors d on d.id = doctor
    where p.id = patient
      and p.user_id = (select auth.uid())
      and d.pmdc_verified = true
      and d.is_active = true
  );
$$;

create or replace function public.appointment_party(uid uuid, patient uuid, doctor uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.patients p where p.id = patient and p.user_id = uid
  ) or exists (
    select 1 from public.doctors d where d.id = doctor and d.user_id = uid
  );
$$;

create or replace function public.can_open_consultation(uid uuid, appointment uuid, doctor uuid, patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointments a
    where a.id = appointment
      and a.doctor_id = doctor
      and a.patient_id = patient
      and public.appointment_party(uid, a.patient_id, a.doctor_id)
  );
$$;

create or replace function public.consultation_party(uid uuid, consultation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.consultations c
    where c.id = consultation
      and public.appointment_party(uid, c.patient_id, c.doctor_id)
  );
$$;

-- Only the doctor assigned on that consultation may write the prescription.
create or replace function public.doctor_can_write_prescription(uid uuid, consultation uuid, doctor uuid, patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.consultations c
    join public.doctors d on d.id = c.doctor_id
    where c.id = consultation
      and c.doctor_id = doctor
      and c.patient_id = patient
      and d.user_id = uid
  );
$$;

-- A doctor may read a patient row only after they share an appointment.
create or replace function public.doctor_treats_patient(uid uuid, patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointments a
    join public.doctors d on d.id = a.doctor_id
    where a.patient_id = patient
      and d.user_id = uid
  );
$$;

-- True when uid and other_user are the patient and the doctor on one appointment or consultation.
create or replace function public.shares_care_with(uid uuid, other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointments a
    join public.patients p on p.id = a.patient_id
    join public.doctors d on d.id = a.doctor_id
    where (p.user_id = uid and d.user_id = other_user)
       or (d.user_id = uid and p.user_id = other_user)
  ) or exists (
    select 1
    from public.consultations c
    join public.patients p on p.id = c.patient_id
    join public.doctors d on d.id = c.doctor_id
    where (p.user_id = uid and d.user_id = other_user)
       or (d.user_id = uid and p.user_id = other_user)
  );
$$;

-- Audit inserts: a party of the linked consultation and/or prescription, or of
-- details.appointment_id. Symptom analysis and emergency detection have no
-- foreign key yet, so those rows are allowed only for actor ai/patient/system.
-- There is no SELECT policy: users cannot read the log.
create or replace function public.can_write_audit(
  uid uuid,
  consultation uuid,
  prescription uuid,
  details jsonb,
  actor text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  appt_text text;
  appt uuid;
begin
  if consultation is not null and prescription is not null then
    return public.consultation_party(uid, consultation)
      and exists (
        select 1
        from public.prescriptions pr
        where pr.id = prescription
          and pr.consultation_id = consultation
          and public.appointment_party(uid, pr.patient_id, pr.doctor_id)
      );
  end if;

  if consultation is not null then
    return public.consultation_party(uid, consultation);
  end if;

  if prescription is not null then
    return exists (
      select 1
      from public.prescriptions pr
      where pr.id = prescription
        and public.appointment_party(uid, pr.patient_id, pr.doctor_id)
    );
  end if;

  appt_text := details->>'appointment_id';
  if appt_text is not null and appt_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    begin
      appt := appt_text::uuid;
    exception
      when invalid_text_representation then
        return false;
    end;
    return exists (
      select 1
      from public.appointments a
      where a.id = appt
        and public.appointment_party(uid, a.patient_id, a.doctor_id)
    );
  end if;

  return actor in ('ai', 'patient', 'system');
end;
$$;

-- The assigned doctor may drop an approved-prescription note into the visit chat.
create or replace function public.doctor_can_message_session(session uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointments a
    join public.doctors d on d.id = a.doctor_id
    where a.session_id = session
      and d.user_id = (select auth.uid())
  );
$$;

-- prescriptions bucket path is `{doctor_id}/{prescription_id}.pdf`.
-- A bad folder or filename returns false instead of raising.
create or replace function public.folder_is_own_doctor(folder text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  doctor uuid;
begin
  if folder is null or folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  begin
    doctor := folder::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;
  return public.is_own_doctor(doctor);
end;
$$;

create or replace function public.patient_can_read_prescription_object(uid uuid, object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  folder text;
  filename text;
  stem text;
  doctor uuid;
  prescription uuid;
begin
  if object_name is null then
    return false;
  end if;
  parts := string_to_array(object_name, '/');
  if array_length(parts, 1) is distinct from 2 then
    return false;
  end if;
  folder := parts[1];
  filename := parts[2];
  if folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  stem := regexp_replace(filename, '\.pdf$', '', 'i');
  if stem !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  begin
    doctor := folder::uuid;
    prescription := stem::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;
  return exists (
    select 1
    from public.prescriptions pr
    join public.patients p on p.id = pr.patient_id
    where pr.id = prescription
      and pr.doctor_id = doctor
      and p.user_id = uid
  );
end;
$$;

-- Boolean only. Registration can detect a duplicate PMDC number without
-- reading any other doctor's row. The unique constraint is the backstop.
create or replace function public.pmdc_number_taken(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when candidate is null or length(btrim(candidate)) = 0 then false
    else exists (
      select 1 from public.doctors d
      where lower(d.pmdc_number) = lower(btrim(candidate))
    )
  end;
$$;

-- Party ids (and the visit session) cannot be retargeted on update.
-- Status changes stay in the policies below.
create or replace function public.appointments_lock_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.patient_id is distinct from old.patient_id
     or new.doctor_id is distinct from old.doctor_id
     or new.session_id is distinct from old.session_id then
    raise exception 'appointment parties are immutable';
  end if;
  return new;
end;
$$;

create or replace function public.consultations_lock_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.appointment_id is distinct from old.appointment_id
     or new.doctor_id is distinct from old.doctor_id
     or new.patient_id is distinct from old.patient_id then
    raise exception 'consultation parties are immutable';
  end if;
  return new;
end;
$$;

create or replace function public.prescriptions_lock_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.consultation_id is distinct from old.consultation_id
     or new.doctor_id is distinct from old.doctor_id
     or new.patient_id is distinct from old.patient_id then
    raise exception 'prescription parties are immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.is_own_patient(uuid) from public, anon;
revoke all on function public.is_own_doctor(uuid) from public, anon;
revoke all on function public.patient_books(uuid, uuid) from public, anon;
revoke all on function public.appointment_party(uuid, uuid, uuid) from public, anon;
revoke all on function public.can_open_consultation(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.consultation_party(uuid, uuid) from public, anon;
revoke all on function public.doctor_can_write_prescription(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.doctor_treats_patient(uuid, uuid) from public, anon;
revoke all on function public.shares_care_with(uuid, uuid) from public, anon;
revoke all on function public.can_write_audit(uuid, uuid, uuid, jsonb, text) from public, anon;
revoke all on function public.doctor_can_message_session(uuid) from public, anon;
revoke all on function public.folder_is_own_doctor(text) from public, anon;
revoke all on function public.patient_can_read_prescription_object(uuid, text) from public, anon;
revoke all on function public.pmdc_number_taken(text) from public, anon;
revoke all on function public.appointments_lock_identity() from public, anon;
revoke all on function public.consultations_lock_identity() from public, anon;
revoke all on function public.prescriptions_lock_identity() from public, anon;

grant execute on function public.is_own_patient(uuid) to authenticated, service_role;
grant execute on function public.is_own_doctor(uuid) to authenticated, service_role;
grant execute on function public.patient_books(uuid, uuid) to authenticated, service_role;
grant execute on function public.appointment_party(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.can_open_consultation(uuid, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.consultation_party(uuid, uuid) to authenticated, service_role;
grant execute on function public.doctor_can_write_prescription(uuid, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.doctor_treats_patient(uuid, uuid) to authenticated, service_role;
grant execute on function public.shares_care_with(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_write_audit(uuid, uuid, uuid, jsonb, text) to authenticated, service_role;
grant execute on function public.doctor_can_message_session(uuid) to authenticated, service_role;
grant execute on function public.folder_is_own_doctor(text) to authenticated, service_role;
grant execute on function public.patient_can_read_prescription_object(uuid, text) to authenticated, service_role;
grant execute on function public.pmdc_number_taken(text) to authenticated, service_role;

drop trigger if exists appointments_lock_identity on public.appointments;
create trigger appointments_lock_identity
  before update on public.appointments
  for each row execute function public.appointments_lock_identity();

drop trigger if exists consultations_lock_identity on public.consultations;
create trigger consultations_lock_identity
  before update on public.consultations
  for each row execute function public.consultations_lock_identity();

drop trigger if exists prescriptions_lock_identity on public.prescriptions;
create trigger prescriptions_lock_identity
  before update on public.prescriptions
  for each row execute function public.prescriptions_lock_identity();

-- ---------------------------------------------------------------------------
-- profiles, sessions, messages
-- ---------------------------------------------------------------------------

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users delete own profile" on public.profiles;
create policy "Users delete own profile" on public.profiles
  for delete to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users insert own sessions" on public.sessions;
create policy "Users insert own sessions" on public.sessions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own sessions" on public.sessions;
create policy "Users update own sessions" on public.sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own sessions" on public.sessions;
create policy "Users delete own sessions" on public.sessions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own messages" on public.messages;
create policy "Users insert own messages" on public.messages
  for insert to authenticated
  with check (
    session_id in (select id from public.sessions where user_id = (select auth.uid()))
  );

drop policy if exists "Users update own messages" on public.messages;
create policy "Users update own messages" on public.messages
  for update to authenticated
  using (
    session_id in (select id from public.sessions where user_id = (select auth.uid()))
  )
  with check (
    session_id in (select id from public.sessions where user_id = (select auth.uid()))
  );

drop policy if exists "Users delete own messages" on public.messages;
create policy "Users delete own messages" on public.messages
  for delete to authenticated
  using (
    session_id in (select id from public.sessions where user_id = (select auth.uid()))
  );

drop policy if exists "Assigned doctor inserts visit messages" on public.messages;
create policy "Assigned doctor inserts visit messages" on public.messages
  for insert to authenticated
  with check (public.doctor_can_message_session(session_id));

-- ---------------------------------------------------------------------------
-- Clinical tables
-- ---------------------------------------------------------------------------

drop policy if exists "Patients insert own profile" on public.patients;
create policy "Patients insert own profile" on public.patients
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Patients update own profile" on public.patients;
create policy "Patients update own profile" on public.patients
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Doctors read treating patients" on public.patients;
create policy "Doctors read treating patients" on public.patients
  for select to authenticated
  using (public.doctor_treats_patient((select auth.uid()), id));

drop policy if exists "Patients book appointments" on public.appointments;
create policy "Patients book appointments" on public.appointments
  for insert to authenticated
  with check (
    status = 'pending'
    and public.patient_books(patient_id, doctor_id)
    and (
      session_id is null
      or exists (
        select 1 from public.sessions s
        where s.id = session_id and s.user_id = (select auth.uid())
      )
    )
  );

-- Patient: cancel, or mark in_progress when they start the call.
-- Assigned doctor: confirm, start, complete, cancel, or no-show.
drop policy if exists "Parties update appointments" on public.appointments;
create policy "Parties update appointments" on public.appointments
  for update to authenticated
  using (public.appointment_party((select auth.uid()), patient_id, doctor_id))
  with check (
    (
      public.is_own_doctor(doctor_id)
      and status in ('confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')
    )
    or (
      public.is_own_patient(patient_id)
      and status in ('cancelled', 'in_progress')
    )
  );

drop policy if exists "Parties insert consultations" on public.consultations;
create policy "Parties insert consultations" on public.consultations
  for insert to authenticated
  with check (
    public.can_open_consultation((select auth.uid()), appointment_id, doctor_id, patient_id)
  );

drop policy if exists "Parties update consultations" on public.consultations;
create policy "Parties update consultations" on public.consultations
  for update to authenticated
  using (public.consultation_party((select auth.uid()), id))
  with check (
    public.consultation_party((select auth.uid()), id)
    and public.can_open_consultation((select auth.uid()), appointment_id, doctor_id, patient_id)
  );

drop policy if exists "Doctors insert prescriptions" on public.prescriptions;
create policy "Doctors insert prescriptions" on public.prescriptions
  for insert to authenticated
  with check (
    public.doctor_can_write_prescription((select auth.uid()), consultation_id, doctor_id, patient_id)
  );

drop policy if exists "Doctors update prescriptions" on public.prescriptions;
create policy "Doctors update prescriptions" on public.prescriptions
  for update to authenticated
  using (
    public.doctor_can_write_prescription((select auth.uid()), consultation_id, doctor_id, patient_id)
  )
  with check (
    public.doctor_can_write_prescription((select auth.uid()), consultation_id, doctor_id, patient_id)
  );

drop policy if exists "Actors insert clinical audit" on public.clinical_audit_log;
create policy "Actors insert clinical audit" on public.clinical_audit_log
  for insert to authenticated
  with check (
    public.can_write_audit((select auth.uid()), consultation_id, prescription_id, details, actor)
  );

drop policy if exists "Doctors insert own presence" on public.doctor_presence_log;
create policy "Doctors insert own presence" on public.doctor_presence_log
  for insert to authenticated
  with check (public.is_own_doctor(doctor_id));

drop policy if exists "Doctors insert own verification log" on public.doctor_verification_log;
create policy "Doctors insert own verification log" on public.doctor_verification_log
  for insert to authenticated
  with check (
    public.is_own_doctor(doctor_id)
    and (changed_by is null or changed_by = (select auth.uid()))
  );

drop policy if exists "Care participants notify each other" on public.notifications;
create policy "Care participants notify each other" on public.notifications
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    or public.shares_care_with((select auth.uid()), user_id)
  );

-- ---------------------------------------------------------------------------
-- Storage: private prescriptions bucket. Upload uses upsert, so insert and
-- update are both required. Path: {doctor_id}/{prescription_id}.pdf
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('prescriptions', 'prescriptions', false)
on conflict (id) do nothing;

drop policy if exists "Doctors upload prescription pdfs" on storage.objects;
create policy "Doctors upload prescription pdfs" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'prescriptions'
    and public.folder_is_own_doctor((storage.foldername(name))[1])
  );

drop policy if exists "Doctors update prescription pdfs" on storage.objects;
create policy "Doctors update prescription pdfs" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'prescriptions'
    and public.folder_is_own_doctor((storage.foldername(name))[1])
  )
  with check (
    bucket_id = 'prescriptions'
    and public.folder_is_own_doctor((storage.foldername(name))[1])
  );

drop policy if exists "Parties read prescription pdfs" on storage.objects;
create policy "Parties read prescription pdfs" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'prescriptions'
    and (
      public.folder_is_own_doctor((storage.foldername(name))[1])
      or public.patient_can_read_prescription_object((select auth.uid()), name)
    )
  );
