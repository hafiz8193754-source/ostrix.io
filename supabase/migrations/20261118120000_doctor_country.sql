-- Practice country for doctors outside Pakistan. Existing rows were registered
-- against the Pakistani city list, so they stay Pakistan. The column is free
-- text (not an enum): the app maps names and ISO codes onto the shared list,
-- and a check constraint would reject a saved alias before that mapping runs.

alter table public.doctors add column if not exists country text;

update public.doctors
set country = 'Pakistan'
where country is null or btrim(country) = '';

alter table public.doctors alter column country set default 'Pakistan';
alter table public.doctors alter column country set not null;
