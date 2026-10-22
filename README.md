# Ostrix

One platform, many specialist AI agents. Phase 1 ships two agents:

- **Website Builder** — plain-language brief in; complete multi-file project out (HTML, CSS, JavaScript, and backend `/api` functions where needed), with live preview, code download, GitHub repo creation, and one-click Vercel deploy.
- **Farm & Soil Advisor** — crop, district, acreage, and an optional soil photo in; a full season plan out (fertilizer quantities, irrigation, seed, pests, yield, cost) with a lab-test disclaimer on every plan.

Stack: Next.js (App Router) · Supabase (auth + database) · Claude API · Vercel.

---

## 1. Set up Supabase (10 minutes)

1. Go to your Supabase dashboard → your project.
2. **SQL Editor → New query** → paste the contents of `supabase/schema.sql` → **Run**.
3. **Authentication → Providers → Email**: make sure Email is enabled.
   (Optional for easier testing: turn OFF "Confirm email" so signups work instantly.)
4. **Project Settings → API**: copy these three values:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server only — treat like a password)

## 2. Get your tokens

- **Claude API key**: console.anthropic.com → API Keys → `ANTHROPIC_API_KEY`
- **Vercel token** (powers the one-click deploy): vercel.com → your avatar → **Settings → Tokens → Create** → `VERCEL_TOKEN`
- **GitHub token** (optional — creates a repo for every deployed site): github.com → **Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate**, tick the `repo` scope → `GITHUB_TOKEN`

## 3. Run locally

```bash
cp .env.local .env.local   # then fill in your real values
npm install
npm run dev                  # open http://localhost:3000
```

Create an account on the login page, then try both agents in the studio.

## 4. Deploy Ostrix itself to Vercel

1. Push this folder to a GitHub repository:
   ```bash
   git init && git add . && git commit -m "Ostrix v0.1"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/ostrix.git
   git push -u origin main
   ```
2. On vercel.com → **Add New → Project** → import that repo.
3. In the import screen, open **Environment Variables** and add every variable from your `.env.local`.
4. Click **Deploy**. Your product is live at `https://ostrix-yourname.vercel.app` (attach a custom domain later in Project → Settings → Domains).

## Where things live

| Path | What it is |
| --- | --- |
| `lib/brand.js` | Product name/tagline — rename the whole product here |
| `app/api/builder/route.js` | Website Builder agent (server-side, quota-enforced) |
| `app/api/farm/route.js` | Farm Advisor agent (multimodal, quota-enforced) |
| `app/api/deploy/route.js` | GitHub repo creation + Vercel live deploy |
| `app/studio/page.js` | The main app UI |
| `supabase/schema.sql` | Database schema (usage tracking, RLS) |
| `FREE_DAILY_BUILDS/PLANS` | Free-tier limits, set via env vars |

## Security notes

- `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_TOKEN`, `GITHUB_TOKEN` are **server-only**: they are read inside API routes and never sent to the browser.
- Every agent route verifies the user's Supabase session token and enforces per-day quotas before spending any API credit.
- Never commit `.env.local` (it's already in `.gitignore`).

## Costs at launch

Vercel Hobby: free · Supabase: free tier · Claude API: pay per use (your $5 credit covers testing; expect ~$0.05–0.30 per generated site depending on size).
