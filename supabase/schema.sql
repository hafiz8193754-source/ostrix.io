-- Ostrix database schema
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent text not null check (agent in ('builder', 'farm')),
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists generations_user_day on public.generations (user_id, agent, created_at);

-- Row Level Security: users can only read their own history.
-- Writes happen from the server with the service-role key (bypasses RLS).
alter table public.generations enable row level security;

drop policy if exists "Users read own generations" on public.generations;
create policy "Users read own generations"
  on public.generations for select
  using (auth.uid() = user_id);

-- Sidebar session list — metadata only (title/timestamps). Message content
-- stays client-side/ephemeral, same as before this table existed.
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent text not null check (agent in ('builder', 'farm')),
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sessions_user_updated on public.sessions (user_id, updated_at desc);

alter table public.sessions enable row level security;

drop policy if exists "Users read own sessions" on public.sessions;
create policy "Users read own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

-- Pro plan waitlist (Billing tab). Writes only via the server's service-role
-- client, so no insert/select policies are needed for anon/authenticated roles.
create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.waitlist_signups enable row level security;

-- Full message content per session (sidebar sessions used to be metadata-only —
-- this upgrades them so reopening a session restores the actual thread).
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  role text not null check (role in ('user', 'agent', 'form')),
  content jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_session_created on public.messages (session_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "Users read own messages" on public.messages;
create policy "Users read own messages"
  on public.messages for select
  using (session_id in (select id from public.sessions where user_id = auth.uid()));

-- ===== Doctor & Clinical Agent =====
-- Decision-support only. AI never diagnoses or prescribes directly — every
-- prescription is a 'draft' until a PMDC-verified doctor reviews and signs it.

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  full_name text not null,
  pmdc_number text unique not null,
  pmdc_verified boolean not null default false,
  specialization text not null,
  sub_specialization text,
  qualifications text not null,
  experience_years integer not null default 0,
  clinic_name text,
  clinic_address text,
  city text not null,
  phone text not null,
  whatsapp text,
  email text,
  consultation_fee_pkr integer not null default 0,
  available_days text[] not null default '{}',
  available_hours_start time,
  available_hours_end time,
  accepts_online boolean not null default true,
  accepts_walk_in boolean not null default true,
  bio text,
  avatar_url text,
  rating numeric(2,1) not null default 0,
  total_consultations integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.specializations (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  display_name text not null,
  urdu_name text,
  description text,
  common_symptoms text[] not null default '{}',
  icon text
);

insert into public.specializations (name, display_name, urdu_name, common_symptoms) values
  ('general_physician', 'General Physician', 'جنرل فزیشن', array['fever', 'cough', 'cold', 'body pain', 'weakness', 'headache', 'flu', 'infection']),
  ('cardiologist', 'Cardiologist', 'ماہر امراض قلب', array['chest pain', 'heart', 'blood pressure', 'palpitation', 'shortness of breath', 'BP']),
  ('dermatologist', 'Dermatologist', 'ماہر امراض جلد', array['skin', 'rash', 'acne', 'allergy', 'eczema', 'hair loss', 'itching']),
  ('orthopedic', 'Orthopedic Surgeon', 'ماہر ہڈیوں', array['bone', 'fracture', 'joint pain', 'knee', 'back pain', 'spine', 'arthritis']),
  ('gynecologist', 'Gynecologist', 'ماہر امراض نسواں', array['pregnancy', 'periods', 'menstrual', 'PCOS', 'fertility', 'women health']),
  ('pediatrician', 'Pediatrician', 'ماہر اطفال', array['child', 'baby', 'infant', 'vaccination', 'child fever', 'growth']),
  ('ent', 'ENT Specialist', 'ماہر کان ناک گلا', array['ear', 'nose', 'throat', 'hearing', 'sinus', 'tonsil', 'snoring']),
  ('dentist', 'Dentist', 'ماہر دندان', array['tooth', 'teeth', 'cavity', 'gums', 'dental', 'braces', 'root canal']),
  ('ophthalmologist', 'Eye Specialist', 'ماہر امراض چشم', array['eye', 'vision', 'glasses', 'cataract', 'blurry vision', 'red eye']),
  ('neurologist', 'Neurologist', 'ماہر اعصاب', array['migraine', 'seizure', 'numbness', 'dizziness', 'memory', 'nerve', 'brain']),
  ('psychiatrist', 'Psychiatrist', 'ماہر نفسیات', array['anxiety', 'depression', 'stress', 'insomnia', 'mental health', 'panic']),
  ('urologist', 'Urologist', 'ماہر امراض گردہ', array['kidney', 'urinary', 'bladder', 'stone', 'prostate']),
  ('pulmonologist', 'Pulmonologist', 'ماہر امراض سینہ', array['asthma', 'breathing', 'lungs', 'TB', 'tuberculosis', 'chronic cough']),
  ('gastroenterologist', 'Gastroenterologist', 'ماہر معدہ و آنت', array['stomach', 'digestion', 'liver', 'hepatitis', 'acidity', 'ulcer', 'nausea', 'vomiting']),
  ('endocrinologist', 'Endocrinologist', 'ماہر ہارمونز', array['diabetes', 'sugar', 'thyroid', 'hormones', 'weight gain']),
  ('oncologist', 'Oncologist', 'ماہر سرطان', array['cancer', 'tumor', 'chemotherapy', 'lump']),
  ('nephrologist', 'Nephrologist', 'ماہر امراض گردہ', array['kidney failure', 'dialysis', 'creatinine', 'kidney disease']),
  ('rheumatologist', 'Rheumatologist', 'ماہر جوڑوں', array['arthritis', 'lupus', 'joint swelling', 'autoimmune']),
  ('emergency', 'Emergency Medicine', 'ایمرجنسی', array['emergency', 'accident', 'bleeding', 'unconscious', 'severe pain', 'poisoning', 'burn'])
on conflict (name) do nothing;

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  full_name text not null,
  age integer,
  gender text check (gender in ('male', 'female', 'other')),
  phone text,
  blood_group text,
  known_allergies text[] not null default '{}',
  chronic_conditions text[] not null default '{}',
  current_medications text[] not null default '{}',
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  appointment_date date not null,
  appointment_time time not null,
  type text not null check (type in ('online', 'walk_in')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  symptoms_description text,
  ai_suggested_specialization text,
  ai_symptom_analysis jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id),
  patient_id uuid not null references public.patients(id),
  call_started_at timestamptz,
  call_ended_at timestamptz,
  call_duration_seconds integer,
  call_recording_url text,
  call_recording_consent_patient boolean not null default false,
  call_recording_consent_doctor boolean not null default false,
  ai_visit_summary text,
  ai_transcript text,
  doctor_notes text,
  diagnosis text,
  follow_up_date date,
  follow_up_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id),
  patient_id uuid not null references public.patients(id),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'approved', 'rejected', 'revised')),
  ai_generated_prescription jsonb not null default '{}'::jsonb,
  doctor_edited_prescription jsonb,
  final_prescription jsonb,
  doctor_signature_hash text,
  doctor_signed_at timestamptz,
  doctor_pmdc_number text not null,
  rejection_reason text,
  pdf_url text,
  warnings text[] not null default '{}',
  drug_interactions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prescription JSONB shape (ai_generated_prescription / doctor_edited_prescription / final_prescription):
-- {
--   "diagnosis": "...",
--   "medications": [
--     { "name": "Augmentin 625mg (Amoxicillin/Clavulanate)", "dosage": "1 tablet", "frequency": "3 times daily",
--       "duration": "7 days", "route": "oral", "instructions": "Take after meals", "quantity": 21, "warnings": [] }
--   ],
--   "lab_tests": [{ "name": "CBC", "reason": "..." }],
--   "advice": ["Rest for 3 days", "Increase fluid intake"],
--   "follow_up": "After 7 days if symptoms persist",
--   "emergency_instructions": "Visit ER if temperature exceeds 103°F",
--   "drug_interaction_warnings": [],
--   "contraindication_flags": []
-- }

create table if not exists public.clinical_audit_log (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid references public.consultations(id),
  prescription_id uuid references public.prescriptions(id),
  actor text not null check (actor in ('ai', 'doctor', 'patient', 'system')),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

alter table public.doctors enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.consultations enable row level security;
alter table public.prescriptions enable row level security;
alter table public.clinical_audit_log enable row level security;

drop policy if exists "Doctors own profile" on public.doctors;
create policy "Doctors own profile" on public.doctors for all using (auth.uid() = user_id);

-- Anyone signed in can browse verified, active doctors for the directory —
-- writes still only ever happen from the server via the service-role client.
drop policy if exists "Public reads verified doctors" on public.doctors;
create policy "Public reads verified doctors" on public.doctors for select
  using (pmdc_verified = true and is_active = true);

drop policy if exists "Patients own profile" on public.patients;
create policy "Patients own profile" on public.patients for all using (auth.uid() = user_id);

drop policy if exists "Appointment access" on public.appointments;
create policy "Appointment access" on public.appointments for select using (
  patient_id in (select id from public.patients where user_id = auth.uid()) or
  doctor_id in (select id from public.doctors where user_id = auth.uid())
);

drop policy if exists "Consultation access" on public.consultations;
create policy "Consultation access" on public.consultations for select using (
  patient_id in (select id from public.patients where user_id = auth.uid()) or
  doctor_id in (select id from public.doctors where user_id = auth.uid())
);

drop policy if exists "Prescription access" on public.prescriptions;
create policy "Prescription access" on public.prescriptions for select using (
  patient_id in (select id from public.patients where user_id = auth.uid()) or
  doctor_id in (select id from public.doctors where user_id = auth.uid())
);

create index if not exists idx_doctors_specialization on public.doctors (specialization, city, is_active);
create index if not exists idx_doctors_pmdc on public.doctors (pmdc_number);
create index if not exists idx_appointments_patient on public.appointments (patient_id, appointment_date);
create index if not exists idx_appointments_doctor on public.appointments (doctor_id, appointment_date);
create index if not exists idx_prescriptions_status on public.prescriptions (status, doctor_id);
create index if not exists idx_audit_consultation on public.clinical_audit_log (consultation_id, created_at);

-- ===== Doctor registration wizard + presence detection =====
-- Two separate concepts, never conflated in code:
--   verification (pmdc_verified / registration_status) — set ONLY by an admin
--     via /admin/doctors after checking pmdc.org.pk by hand. Gates all
--     clinical features.
--   presence (is_online / availability_status) — detected automatically via
--     heartbeat + schedule. Purely operational, no legal weight, and can
--     never make an unverified doctor bookable.

alter table public.doctors add column if not exists registration_status text not null default 'pending'
  check (registration_status in ('pending','under_review','verified','rejected','suspended'));
alter table public.doctors add column if not exists registration_note text;
alter table public.doctors add column if not exists rejection_reason text;
alter table public.doctors add column if not exists verified_at timestamptz;
alter table public.doctors add column if not exists verified_by uuid references auth.users(id);
alter table public.doctors add column if not exists pmdc_registration_type text
  check (pmdc_registration_type in ('provisional','full','specialist'));
alter table public.doctors add column if not exists pmdc_expiry_date date;
alter table public.doctors add column if not exists pmdc_expiry_warned_at timestamptz;
alter table public.doctors add column if not exists cnic text;
alter table public.doctors add column if not exists year_of_graduation integer;
alter table public.doctors add column if not exists pmdc_certificate_url text;
alter table public.doctors add column if not exists degree_certificate_url text;
alter table public.doctors add column if not exists cnic_front_url text;
alter table public.doctors add column if not exists profile_photo_url text;
alter table public.doctors add column if not exists languages text[] not null default array['English','Urdu'];

-- Presence fields
alter table public.doctors add column if not exists is_online boolean not null default false;
alter table public.doctors add column if not exists availability_status text not null default 'offline'
  check (availability_status in ('available','busy','on_break','offline','do_not_disturb'));
alter table public.doctors add column if not exists last_seen_at timestamptz;
alter table public.doctors add column if not exists manual_status_override text
  check (manual_status_override in ('available','busy','on_break','do_not_disturb'));
alter table public.doctors add column if not exists override_expires_at timestamptz;
alter table public.doctors add column if not exists accepting_new_patients boolean not null default true;
alter table public.doctors add column if not exists max_daily_appointments integer not null default 20;

-- Weekly recurring schedule — the source of truth going forward. The legacy
-- available_days/available_hours_start/available_hours_end columns on
-- doctors are kept (nothing that already reads them breaks) and get a
-- best-effort summary written back to them whenever a schedule is saved.
create table if not exists public.doctor_schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  consultation_type text not null default 'both' check (consultation_type in ('online','walk_in','both')),
  slot_duration_minutes integer not null default 20,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

-- One-off exceptions: leave days, extra clinics, holidays
create table if not exists public.doctor_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  exception_date date not null,
  is_available boolean not null default false,
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz not null default now(),
  unique (doctor_id, exception_date)
);

-- Presence heartbeat log (uptime stats / debugging)
create table if not exists public.doctor_presence_log (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  status text not null,
  changed_at timestamptz not null default now(),
  source text not null check (source in ('heartbeat','manual','schedule','timeout','logout'))
);

-- Verification audit: every registration_status change, who did it, why
create table if not exists public.doctor_verification_log (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  previous_status text,
  new_status text not null,
  changed_by uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now()
);

-- Which signed-in users can review/verify doctors. Insert your own user_id
-- manually after running this — there is no other way to approve anyone.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'verifier' check (role in ('verifier','superadmin')),
  created_at timestamptz not null default now()
);

-- In-app notifications only — no email/SMS/push.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- "Notify me when available" requests from the patient-facing directory.
-- Drained by the presence sweep endpoint whenever a doctor's presence flips
-- to available (there's no cron in this app — the sweep already runs on
-- every patient search, so it's the natural place to also fire these).
create table if not exists public.doctor_notify_requests (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  notified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_doctors_presence on public.doctors (availability_status, pmdc_verified, is_active);
create index if not exists idx_doctors_reg_status on public.doctors (registration_status, created_at desc);
create index if not exists idx_schedules_doctor_day on public.doctor_schedules (doctor_id, day_of_week, is_active);
create index if not exists idx_exceptions_doctor_date on public.doctor_availability_exceptions (doctor_id, exception_date);
create index if not exists idx_notif_user on public.notifications (user_id, is_read, created_at desc);
create index if not exists idx_notify_requests_doctor on public.doctor_notify_requests (doctor_id, notified);

alter table public.doctor_schedules enable row level security;
alter table public.doctor_availability_exceptions enable row level security;
alter table public.doctor_presence_log enable row level security;
alter table public.doctor_verification_log enable row level security;
alter table public.platform_admins enable row level security;
alter table public.notifications enable row level security;
alter table public.doctor_notify_requests enable row level security;

drop policy if exists "Doctors own schedule" on public.doctor_schedules;
create policy "Doctors own schedule" on public.doctor_schedules for all using (
  doctor_id in (select id from public.doctors where user_id = auth.uid())
);

-- Patients need to read schedules/exceptions too, to compute "next available"
-- in the directory — read-only, scoped to verified+active doctors only.
drop policy if exists "Public reads verified doctor schedules" on public.doctor_schedules;
create policy "Public reads verified doctor schedules" on public.doctor_schedules for select using (
  doctor_id in (select id from public.doctors where pmdc_verified = true and is_active = true)
);

drop policy if exists "Doctors own exceptions" on public.doctor_availability_exceptions;
create policy "Doctors own exceptions" on public.doctor_availability_exceptions for all using (
  doctor_id in (select id from public.doctors where user_id = auth.uid())
);

drop policy if exists "Public reads verified doctor exceptions" on public.doctor_availability_exceptions;
create policy "Public reads verified doctor exceptions" on public.doctor_availability_exceptions for select using (
  doctor_id in (select id from public.doctors where pmdc_verified = true and is_active = true)
);

drop policy if exists "Doctors own presence log" on public.doctor_presence_log;
create policy "Doctors own presence log" on public.doctor_presence_log for select using (
  doctor_id in (select id from public.doctors where user_id = auth.uid())
);

drop policy if exists "Doctors read own verification log" on public.doctor_verification_log;
create policy "Doctors read own verification log" on public.doctor_verification_log for select using (
  doctor_id in (select id from public.doctors where user_id = auth.uid())
);

drop policy if exists "Admins read own admin row" on public.platform_admins;
create policy "Admins read own admin row" on public.platform_admins for select using (auth.uid() = user_id);

drop policy if exists "Own notifications" on public.notifications;
create policy "Own notifications" on public.notifications for all using (auth.uid() = user_id);

drop policy if exists "Patients own notify requests" on public.doctor_notify_requests;
create policy "Patients own notify requests" on public.doctor_notify_requests for all using (auth.uid() = patient_user_id);

-- ===== Storage: doctor-documents bucket =====
-- Create the bucket by hand first: Supabase dashboard → Storage → New bucket
-- → name "doctor-documents" → Private. Then run this block. Each doctor may
-- only read/write objects under a path prefixed with their own user id
-- ({user_id}/pmdc_certificate.pdf etc) — admins can read everything to
-- review submitted documents.

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

-- ===== Shell rebuild: 4-agent model, profiles, artifacts =====
-- Widen the agent lineup from (builder, farm) to the 4 sidebar agents.
-- Additive — existing builder/farm rows are unaffected.

alter table public.sessions drop constraint if exists sessions_agent_check;
alter table public.sessions add constraint sessions_agent_check
  check (agent in ('prompt_engineer', 'builder', 'farm', 'doctor'));

alter table public.generations drop constraint if exists generations_agent_check;
alter table public.generations add constraint generations_agent_check
  check (agent in ('prompt_engineer', 'builder', 'farm', 'doctor'));

-- Per-user profile + settings (Settings modal: appearance, language, chat
-- defaults, masked API keys — stored as one jsonb blob rather than a column
-- per setting, since the set of settings will keep growing).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile" on public.profiles for all using (auth.uid() = id);

-- Structured artifacts (generated code, plans, prescriptions, etc.) tied to
-- the message that produced them — additive alongside the existing pattern
-- of embedding a `site`/`plan` directly in the message's jsonb content;
-- this table exists for agents that produce a distinct downloadable/streamed
-- artifact rather than an inline card.
create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  type text not null,
  content jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_artifacts_message on public.artifacts (message_id);

alter table public.artifacts enable row level security;

drop policy if exists "Users read own artifacts" on public.artifacts;
create policy "Users read own artifacts" on public.artifacts for select using (
  message_id in (
    select m.id from public.messages m
    join public.sessions s on s.id = m.session_id
    where s.user_id = auth.uid()
  )
);

-- ===== Storage: avatars bucket =====
-- Create the bucket by hand first: Supabase dashboard → Storage → New bucket
-- → name "avatars" → Public (profile photos are meant to be publicly
-- viewable, unlike doctor-documents). Then run this block.

drop policy if exists "Public reads avatars" on storage.objects;
create policy "Public reads avatars" on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "Users manage own avatar" on storage.objects;
create policy "Users manage own avatar" on storage.objects for all using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

-- ===== Assistant Doctor: voice intake, real calling, signature reuse, PDF delivery =====

-- Doctors can save a signature once and reuse it on future approvals instead
-- of redrawing every time.
alter table public.doctors add column if not exists signature_url text;

-- Links a booking back to the chat session (sidebar history) it originated
-- from, so an approved prescription can be delivered as a message in that
-- same conversation, not just as a standalone download link.
alter table public.appointments add column if not exists session_id uuid references public.sessions(id) on delete set null;

-- Twilio's conference/call identifier for a consultation (the first Doctor
-- round's schema had call_recording_url/ai_transcript already but no SID —
-- needed now that calling is real, not a stub).
alter table public.consultations add column if not exists twilio_call_sid text;

create index if not exists idx_appointments_session on public.appointments (session_id);

-- Create the "signatures" bucket by hand first: Supabase dashboard → Storage
-- → New bucket → name "signatures" → Private. Each doctor may only
-- read/write their own signature, mirroring doctor-documents' folder-scoped
-- policy. The PDF generator reads it via the service-role client (bypasses
-- RLS), so no separate read grant is needed there.
drop policy if exists "Doctors manage own signature" on storage.objects;
create policy "Doctors manage own signature" on storage.objects for all using (
  bucket_id = 'signatures' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'signatures' and (storage.foldername(name))[1] = auth.uid()::text
);

-- Create the "prescriptions" bucket by hand too → Private, no policy needed:
-- it's only ever written by the approval route (service-role client, bypasses
-- RLS) and only ever read through the existing ownership-checked
-- /api/doctor/prescription/pdf route, never directly from Storage.
