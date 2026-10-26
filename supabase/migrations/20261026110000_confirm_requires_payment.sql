-- A booking may only move to 'confirmed' once its payment is settled:
-- payment_status 'paid', or 'not_required' for free bookings. Applies to
-- client sessions AND the service role (the API routes use it), so the rule
-- holds even if app code is wrong. Admin payment approval sets paid +
-- confirmed in one update, which passes. Only database owners (migrations,
-- SQL editor) are exempt.
-- Additive and reversible:
--   drop trigger if exists appointments_confirm_requires_payment on public.appointments;
--   drop function if exists public.appointments_confirm_requires_payment();

create or replace function public.appointments_confirm_requires_payment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon', 'service_role')
     and new.status = 'confirmed'
     and new.status is distinct from old.status
     and new.payment_status not in ('paid', 'not_required') then
    raise exception 'appointment cannot be confirmed until payment is approved'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.appointments_confirm_requires_payment() from public, anon;

drop trigger if exists appointments_confirm_requires_payment on public.appointments;
create trigger appointments_confirm_requires_payment
  before update on public.appointments
  for each row execute function public.appointments_confirm_requires_payment();
