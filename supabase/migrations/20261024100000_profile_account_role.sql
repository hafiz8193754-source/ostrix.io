-- Account role chosen after sign-up/sign-in ("As a Patient" / "As a Doctor").
-- Additive and nullable: NULL means "not chosen yet" and shows the role screen.
-- Admin is NOT a value here: admin access stays a hand-inserted row in
-- platform_admins, so nobody can self-assign it.
alter table public.profiles
  add column if not exists account_role text
  check (account_role is null or account_role in ('patient', 'doctor'));

-- Once set, end users cannot change their role through the API (RLS lets them
-- update their own profile row). Only the service role / SQL editor can.
create or replace function public.profiles_lock_account_role()
returns trigger language plpgsql as $$
begin
  if old.account_role is not null
     and new.account_role is distinct from old.account_role
     and coalesce(auth.role(), '') in ('authenticated', 'anon') then
    raise exception 'account_role is already set';
  end if;
  return new;
end $$;

drop trigger if exists profiles_lock_account_role on public.profiles;
create trigger profiles_lock_account_role
  before update of account_role on public.profiles
  for each row execute function public.profiles_lock_account_role();

-- Backfill existing users so nobody already active is asked to re-pick.
insert into public.profiles (id)
  select distinct d.user_id from public.doctors d where d.user_id is not null
  union select distinct p.user_id from public.patients p where p.user_id is not null
  on conflict (id) do nothing;

update public.profiles pr set account_role = 'doctor'
  where pr.account_role is null and exists (select 1 from public.doctors d where d.user_id = pr.id);

update public.profiles pr set account_role = 'patient'
  where pr.account_role is null and exists (select 1 from public.patients p where p.user_id = pr.id);
