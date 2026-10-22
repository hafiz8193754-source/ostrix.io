# Ostrix

See a doctor from home. A patient describes symptoms, books a PMDC-verified doctor, joins a call, and downloads a prescription that doctor has signed.

Stack: Next.js (App Router) · Supabase (auth, database, storage) · xAI Grok · Twilio Voice.

---

## 1. Set up Supabase

1. Open your Supabase project → **SQL Editor → New query**.
2. Paste `supabase/schema.sql` and **Run**.
3. Paste `supabase/migrations/20261022120000_doctor_owner_policies.sql` and **Run**. That migration is what lets patient and doctor routes write with the signed-in user's JWT (profiles, visits, appointments, consultations, prescriptions, presence, notifications, and the private `prescriptions` PDF bucket).
4. **Authentication → Providers → Email**: Email is enabled. For easier testing, turn off "Confirm email".
5. **Project Settings → API**: copy
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` only if you need account deletion, admin doctor verification, or sweeps of other doctors

Create the private `doctor-documents` and `signatures` buckets and the public `avatars` bucket if they are not already there. The migration creates the private `prescriptions` bucket.

## 2. Keys

- **xAI API key** (symptom intake, visit summaries, prescription drafts): [console.x.ai](https://console.x.ai) → API Keys → `XAI_API_KEY`. Requests go to `https://api.x.ai/v1/chat/completions`. Optional `XAI_MODEL` overrides the default `grok-4.7` used for visit summaries and prescription drafts. Optional `XAI_FAST_MODEL` overrides the default `grok-4.20-0309-non-reasoning` used for the studio intake chat. Those routes allow 90 seconds.
- **Claude fallback** (optional): used only when `XAI_API_KEY` is unset and `ANTHROPIC_API_KEY` is set.
- **Twilio Voice** (optional until someone places a call): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, and `NEXT_PUBLIC_APP_URL`.

## 3. Run locally

```bash
cp .env.example .env.local   # then fill in your real values
npm install
npm run dev                  # open http://localhost:3000
```

Create an account, then open **Talk to a doctor**. Doctors register at `/doctor/register`. An admin verifies them from `/admin/doctors`, which needs the service-role key.

## Where things live

| Path | What it is |
| --- | --- |
| `lib/ai.ts` | Grok chat-completions client. Claude is used only when `XAI_API_KEY` is unset |
| `lib/clinical.ts` | Patients, appointments, consultations, prescriptions, presence |
| `lib/serverAuth.ts` | Verifies the session and returns `{ user, token, db }` for that request |
| `app/studio/page.tsx` | Patient intake |
| `app/doctor/dashboard/page.tsx` | Doctor's day: appointments, calls, prescriptions |
| `app/api/doctor/*` | Analyze, book, register, call, prescribe |
| `supabase/schema.sql` | Base schema |
| `supabase/migrations/20261022120000_doctor_owner_policies.sql` | Owner-scoped writes and prescription storage |

## Security notes

- `XAI_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `TWILIO_AUTH_TOKEN` are server-only.
- Signed-in routes verify the session with the anon key and query with that user's JWT, so RLS applies. After the migration, a patient and their doctor can complete a visit without the service-role key.
- Account deletion, admin verification, and sweeps of other doctors return `503` with `Server not fully configured` when the service-role key is missing. Signed-out callers still get `401`.
- Never commit `.env.local`.
