-- Patient chat history removal (additive only).
-- Chats linked to an appointment are hidden (soft delete) instead of deleted,
-- because the doctor's consultation thread / prescriptions live in them.
alter table public.sessions add column if not exists hidden_at timestamptz;

create index if not exists sessions_user_visible_idx
  on public.sessions (user_id, updated_at desc) where hidden_at is null;

-- Restrictive policy: direct client DELETEs can never remove a chat that an
-- appointment points to (the app hides those instead). Combined with the
-- existing "Users delete own sessions" permissive policy via AND.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sessions' and policyname = 'Keep consultation-linked sessions'
  ) then
    create policy "Keep consultation-linked sessions" on public.sessions
      as restrictive for delete to authenticated, anon
      using (not exists (select 1 from public.appointments a where a.session_id = sessions.id));
  end if;
end $$;
