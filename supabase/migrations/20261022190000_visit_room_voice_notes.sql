-- In-app WebRTC visits + async voice notes per appointment.
-- Audio lives in a private bucket; only the server (service role) reads/writes it
-- and hands out short-lived signed URLs to the appointment's doctor/patient.
insert into storage.buckets (id, name, public)
values ('consultation-audio', 'consultation-audio', false)
on conflict (id) do nothing;

create table if not exists public.voice_notes (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  sender_role text not null check (sender_role in ('doctor', 'patient')),
  sender_user_id uuid,
  storage_path text not null,
  duration_seconds integer,
  transcript text,
  transcript_error text,
  created_at timestamptz not null default now(),
  anonymized_at timestamptz
);
create index if not exists voice_notes_appointment_idx on public.voice_notes (appointment_id, created_at);

-- No client policies: all access goes through API routes that check the caller
-- is this appointment's doctor or patient.
alter table public.voice_notes enable row level security;

alter table public.consultations add column if not exists visit_mode text;
