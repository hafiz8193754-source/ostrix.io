-- Booking slots + SMS/WhatsApp reminders. Additive only (no drops/deletes).

-- 1) No double booking: one active appointment per doctor per date+time.
create unique index if not exists appointments_active_slot_uniq
  on public.appointments (doctor_id, appointment_date, appointment_time)
  where status not in ('cancelled', 'no_show');

-- 2) Public, privacy-safe view of which slots are taken (date+time only,
--    verified active doctors only) so the slot picker can hide them.
create or replace function public.doctor_booked_slots(p_doctor_id uuid, p_from date, p_to date)
returns table (appointment_date date, appointment_time time)
language sql
stable
security definer
set search_path = public
as $$
  select a.appointment_date, a.appointment_time
  from public.appointments a
  join public.doctors d on d.id = a.doctor_id
  where a.doctor_id = p_doctor_id
    and d.pmdc_verified = true and d.is_active = true
    and a.appointment_date between p_from and p_to
    and a.status not in ('cancelled', 'no_show');
$$;
grant execute on function public.doctor_booked_slots(uuid, date, date) to anon, authenticated;

-- 3) Reminder log: one row per appointment/kind/channel so the cron is idempotent.
create table if not exists public.appointment_reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  kind text not null check (kind in ('booked', 'confirmed', 'one_hour')),
  channel text not null check (channel in ('sms', 'whatsapp')),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now(),
  unique (appointment_id, kind, channel)
);
alter table public.appointment_reminders enable row level security;
-- No policies: only the service role (server) reads/writes this table.
create index if not exists idx_appointment_reminders_appt on public.appointment_reminders (appointment_id);
