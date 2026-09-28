# Kejetia Online — Deployment Runbook

Exact steps to take the platform from this repo to a live site.
**Total time: ~30 minutes** (most of it waiting on providers). No code
changes needed — the app is deploy-ready.

---

## Prerequisites

- [x] GitHub repo: `https://github.com/scantyragna/kejetia_online` (pushed)
- [ ] A GitHub account — already used above
- [ ] A Vercel account (sign up free at vercel.com — GitHub login works)
- [ ] A Supabase account (sign up free at supabase.com)

---

## Step 1 — Create the Supabase project (5 min)

1. Go to **supabase.com → New project**.
2. Pick a name (e.g. `kejetia-online`) and a strong database password
   (save it somewhere safe — it's the database master password).
3. **Region: pick `West EU (Ireland)`** — the closest region to Ghana.
   ⚠️ The region can never be changed after creation.
4. Create the project and wait ~2 minutes for it to provision.

## Step 2 — Run the database migrations (5 min)

In Supabase, open **SQL Editor → New query** and run these files
**in order, one at a time** (copy the file contents in):

| Order | File | What it creates |
|---|---|---|
| 1 | `supabase-migrations/00-base-schema.sql` | The six core tables (`profiles`, `stores`, `products`, `conversations`, `messages`, `user_locations`) + the signup → profile trigger |
| 2 | `supabase-migrations/add-products-stock.sql` | `products.stock` inventory column |
| 3 | `supabase-migrations/add-store-reviews.sql` | `products.old_price`, `reviews` table, rating-recompute trigger, reviews RLS |
| 4 | `supabase-migrations/add-rls-hardening.sql` | Row Level Security on every table + the public `product-images` Storage bucket |
| 5 | `supabase-migrations/add-landmarks.sql` | `landmarks` table (photo pins), its RLS, and the public `landmark-photos` Storage bucket |
| 6 | `supabase-migrations/add-realtime.sql` | Adds `messages`, `conversations`, `stores`, `products`, `landmarks`, `reviews` to the `supabase_realtime` publication — **required** for live chat and for stores/products appearing on other users' screens without a refresh |
| 7 | `supabase-migrations/add-user-locations.sql` | Makes the live map's "users on the map" tracker work: `updated_at` heartbeat on `user_locations`, one row per user, RLS (public read / owner write), and the table added to the `supabase_realtime` publication |

Each should finish with a green success banner. If one errors, stop and
report it — the next migration depends on the previous one.

> ⚠️ **Step 6 is not optional.** Without the realtime migration the
> app still works, but chat messages and marketplace updates will not appear
> unless a user manually reloads the page — the exact "data isn't synced"
> symptom. Run it and verify with two browsers/incognito windows.
>
> ⚠️ **Step 7 makes the map's location tracker live.** Before it, the
> `user_locations` table exists but nothing ever writes to, reads from or
> receives updates about it, so the map's user dots / "N users on the map"
> counter always show **0 users** even when people are actually browsing.

## Step 3 — Grab the two keys (2 min)

Supabase → **Settings → API** (or the homepage's Connect modal):
copy

- **Project URL** — looks like `https://xxxxxxxx.supabase.co`
- **anon public key** (the `publishable` one, NOT `service_role`)

These are *public by design* — safe to put in the browser and on Vercel.

## Step 4 — Deploy on Vercel (10 min)

1. Go to **vercel.com → Add New… → Project**.
2. Import the `kejetia_online` GitHub repo. Vercel auto-detects
   Next.js — leave the default settings (framework: Next.js, root:
   `frontend/` if it asks).
3. **Environment Variables** — add exactly two:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |

4. Click **Deploy**. First build takes a few minutes.
5. When it finishes you get a live URL like `kejetia-online.vercel.app`.
   **Visit it — the homepage should load with the map.**

## Step 5 — Sanity checks on the live site (5 min)

- [ ] `/` loads, maps render (free CARTO/OSM tiles — no key needed)
- [ ] **No red banner** at the top of the page (a red "Database not connected"
  banner means the Supabase env vars are missing and the site is running in
  per-browser demo mode — see below)
- [ ] Sign up as a **seller** → you land in store onboarding
- [ ] Create the store, add a product **with a photo** →
  photo uploads to Storage (check Supabase → Storage → `product-images`)
- [ ] Sign up as a buyer → open the store → the **Chat** tab works
  (this confirms conversations/messages RLS is correct)
- [ ] Add a store review → the store's rating updates (trigger check)
- [ ] **Cross-user sync:** in a second browser/incognito window sign up a
  different seller and create a store with a product — the first window's
  homepage and search should show it within a second or two (no refresh).
  Two windows chatting should show both sides instantly.
- [ ] **Live user dots:** with two browsers open on `/search` (Map view), allow
  location in one of them — the other should show that person as a blue dot
  and a raised "users on the map" counter within a few seconds (requires
  migrations 6 + 7).

## If users can't see each other's data (the #1 support issue)

This is almost always one of two things:

1. **The deployed site is running in mock mode.** When
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing
   (or still the placeholder), the app silently falls back to a browser-local
   demo database. Every user then sees *only their own browser's data* — other
   people's stores, products and chats simply do not exist on their screen.
   Fix: set both env vars in Vercel/Render **and redeploy**, then run
   migration 6 (and 7, see below). A red banner on the live site is the tell.
2. **Realtime migration not run.** With real mode correctly configured but
   migration 6 skipped, data is shared but updates arrive only on page
   reload. Run `add-realtime.sql` in the SQL Editor.
3. **Map shows 0 users (location tracker).** Live user dots need migration 7
   (`add-user-locations.sql`) for the realtime delivery + RLS + heartbeat.
   Behavior checks: dots appear only for signed-in users who granted
   geolocation; a dot disappears ~10 minutes after that user's page closes;
   anonymous visitors see the map read-only.

## Step 6 — Go live on your own domain (optional, later)

Vercel → your project → **Settings → Domains** — add your domain
(e.g. `kejetiaonline.com`, ~$8–15/yr). Vercel issues the SSL
certificate automatically.

---

## After launch — notes & limits

- **Free email sender: 2 auth emails/hour** (~48 signups/day). When you
  run a marketing push, add Google OAuth (Suppabase → Authentication →
  Providers → Google) or a free SMTP (Resend/Brevo) — see
  `SYSTEM_OVERVIEW.md` §4 for the full capacity table.
- **Photos are compressed client-side to < 500 KB** and stored in the
  `product-images` bucket — keep that compression; it's what keeps the
  1 GB bucket and the 500 MB database usable.
- **Free project pauses after 7 days of inactivity**, then wakes on the
  next request. A live storefront won't hit this.
- Region, project name and database password can't be changed after
  creation — only re-create the project.