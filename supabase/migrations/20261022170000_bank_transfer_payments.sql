-- Bank transfer is the only payment method. Additive only.
--
-- platform_settings: single row (id = 1) holding the bank account patients pay
-- into. Anyone may read it; only platform admins may change it (the admin API
-- uses the service role, the policy below covers direct client writes).
-- payments: one row per transfer a patient reports for an appointment. The
-- patient inserts it as 'pending'; only an admin (service role) approves or
-- rejects, which also marks the appointment paid/confirmed.

create table if not exists public.platform_settings (
  id smallint primary key default 1 check (id = 1),
  bank_name text,
  bank_account_title text,
  bank_account_number text,
  bank_iban text,
  bank_instructions text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id) values (1) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;
drop policy if exists "Anyone reads platform settings" on public.platform_settings;
create policy "Anyone reads platform settings" on public.platform_settings for select using (true);
drop policy if exists "Admins update platform settings" on public.platform_settings;
create policy "Admins update platform settings" on public.platform_settings for update
  using ((select auth.uid()) in (select user_id from public.platform_admins))
  with check ((select auth.uid()) in (select user_id from public.platform_admins));

alter table public.appointments add column if not exists payment_status text not null default 'unpaid'
  check (payment_status in ('unpaid', 'pending', 'paid', 'rejected', 'not_required'));
alter table public.appointments add column if not exists fee_pkr integer not null default 0;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  payer_user_id uuid references auth.users(id) on delete set null,
  method text not null default 'bank_transfer' check (method = 'bank_transfer'),
  amount_pkr integer not null default 0 check (amount_pkr >= 0),
  transfer_reference text not null check (char_length(transfer_reference) between 3 and 100),
  receipt_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_status on public.payments (status, created_at desc);
create index if not exists idx_payments_appointment on public.payments (appointment_id);

alter table public.payments enable row level security;
drop policy if exists "Patients read own payments" on public.payments;
create policy "Patients read own payments" on public.payments for select
  using (payer_user_id = (select auth.uid()));
drop policy if exists "Patients submit own payments" on public.payments;
create policy "Patients submit own payments" on public.payments for insert
  with check (
    payer_user_id = (select auth.uid())
    and status = 'pending' and reviewed_by is null and reviewed_at is null
    and public.is_own_patient(patient_id)
    and exists (select 1 from public.appointments a where a.id = appointment_id and a.patient_id = payments.patient_id)
  );

-- Receipts: private bucket, path "<uid>/<file>". Patient manages own folder;
-- admins read through signed URLs minted with the service role.
insert into storage.buckets (id, name, public) values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do nothing;
drop policy if exists "Patients upload own receipts" on storage.objects;
create policy "Patients upload own receipts" on storage.objects for insert with check (
  bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "Patients read own receipts" on storage.objects;
create policy "Patients read own receipts" on storage.objects for select using (
  bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "Admins read all receipts" on storage.objects;
create policy "Admins read all receipts" on storage.objects for select using (
  bucket_id = 'payment-receipts' and auth.uid() in (select user_id from public.platform_admins)
);

-- Fee is copied from the doctor at booking; payment fields are server-owned.
create or replace function public.appointments_payment_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(d.consultation_fee_pkr, 0) into new.fee_pkr from public.doctors d where d.id = new.doctor_id;
  new.fee_pkr := coalesce(new.fee_pkr, 0);
  new.payment_status := case when new.fee_pkr > 0 then 'unpaid' else 'not_required' end;
  return new;
end;
$$;

create or replace function public.appointments_lock_payment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.payment_status is distinct from old.payment_status or new.fee_pkr is distinct from old.fee_pkr) then
    raise exception 'payment fields are managed by the server';
  end if;
  return new;
end;
$$;

revoke all on function public.appointments_payment_defaults() from public, anon;
revoke all on function public.appointments_lock_payment() from public, anon;

drop trigger if exists appointments_payment_defaults on public.appointments;
create trigger appointments_payment_defaults
  before insert on public.appointments
  for each row execute function public.appointments_payment_defaults();

drop trigger if exists appointments_lock_payment on public.appointments;
create trigger appointments_lock_payment
  before update on public.appointments
  for each row execute function public.appointments_lock_payment();

-- A reported transfer moves the appointment to payment 'pending'.
create or replace function public.payments_mark_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.appointments set payment_status = 'pending', updated_at = now()
  where id = new.appointment_id and payment_status in ('unpaid', 'rejected');
  return new;
end;
$$;
revoke all on function public.payments_mark_pending() from public, anon;
drop trigger if exists payments_mark_pending on public.payments;
create trigger payments_mark_pending
  after insert on public.payments
  for each row execute function public.payments_mark_pending();

-- Backfill bookings made before this migration.
update public.appointments a set fee_pkr = coalesce(d.consultation_fee_pkr, 0)
from public.doctors d where d.id = a.doctor_id and a.fee_pkr = 0;
update public.appointments set payment_status = 'not_required' where fee_pkr = 0 and payment_status = 'unpaid';
