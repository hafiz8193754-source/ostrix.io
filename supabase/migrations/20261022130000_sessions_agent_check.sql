-- Match the live sessions_agent_check. The app only creates doctor sessions.
-- builder and farm remain valid so older rows still satisfy the check.
-- prompt_engineer is no longer allowed. Fold any leftover rows into doctor
-- before the constraint is replaced, otherwise the ADD would fail.

update public.sessions
set agent = 'doctor'
where agent not in ('builder', 'farm', 'doctor');

alter table public.sessions drop constraint if exists sessions_agent_check;
alter table public.sessions add constraint sessions_agent_check
  check (agent in ('builder', 'farm', 'doctor'));
