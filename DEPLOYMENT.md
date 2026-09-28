# Kejetia Online — Deployment Runbook (Render, full-stack)

Exact steps to take the platform from this repo to a live site on **Render**,
where one web service hosts both the frontend and the backend (Next.js API
routes in `app/api/*`) and one managed Postgres database stores everything.

**Total time: ~20 minutes** (most of it waiting on Render to build/deploy).
No code changes needed — the app is deploy-ready.

---

## Architecture in one paragraph

There is **no separate backend server**. The Next.js app in `frontend/` is the
whole stack:

- Browser JS talks to our own API routes (`/api/query`, `/api/auth/*`,
  `/api/events`, `/api/media/*`) instead of Supabase.
- Those routes run SQL against Render Postgres and enforce authorization
  server-side (this replaces Supabase's Row Level Security).
- Realtime (live map, chat, cross-user sync) is HTTP polling of
  `/api/events` (~2s) from the browser.
- Images (photos) are stored as `BYTEA` in the `media` table and served via
  `/api/media/{bucket}/{key}` — no object store needed.
- The schema lives in `frontend/db/schema.sql` and is applied automatically
  on container boot by `frontend/scripts/migrate.mjs` (idempotent).

Two environment variables drive everything:

| Variable | Where | Meaning |
|---|---|---|
| `NEXT_PUBLIC_DB_MODE` | build-time (Render env) | `postgres` = real backend; unset = browser-local mock mode |
| `DATABASE_URL` | server-only | Postgres connection string (injected automatically by the Blueprint) |

---

## Prerequisites

- [x] GitHub repo: `https://github.com/scantyragna/kejetia_online` (pushed)
- [ ] A Render account (sign up free at render.com — GitHub login works)

---

## Step 1 — Deploy on Render with the Blueprint (5 min)

The repo contains `render.yaml` — a **Blueprint** that provisions both the web
service and the Postgres database in one go.

1. Go to **render.com → New → Blueprint** (or "Blueprint" on the dashboard).
2. Pick the `kejetia_online` GitHub repo. Render reads `render.yaml` and shows:
   - **kejetia-online-web** (Docker web service, root `frontend/`)
   - **kejetia-db** (Postgres)
3. Click **Apply**. Render creates the database, builds the image and deploys.
4. The Blueprint already wires:
   - `DATABASE_URL` → the database's `connectionString`
   - `NEXT_PUBLIC_DB_MODE=postgres` → **required**, switches the app out of mock mode
   - `PORT=3000`
5. When the build finishes you get a live URL like
   `https://kejetia-online-web.onrender.com`. **Visit it — the homepage should
   load with the map.**

> ⚠️ **Free Postgres expires after 30 days.** For "deploy always" persistent
> hosting, upgrade `kejetia-db` to a paid plan (Render → Databases →
> kejetia-db → Settings → Plan) **before** the 30-day window closes. After
> expiry the site loses all data and the database must be recreated.

Other important first deploys:

- **First build takes 3–6 minutes** (Docker image + `npm run build`).
- The container runs `node scripts/migrate.mjs` at boot, which applies
  `db/schema.sql` automatically. You do **not** need to run migrations by hand.
- If a deploy ever fails, check **Render → kejetia-online-web → Logs**:
  a `[migrate] Failed to apply schema` line would indicate a SQL/DB problem.

## Step 2 — Sanity checks on the live site (5 min)

- [ ] `/` loads, maps render (free CARTO/OSRM tiles — no key needed)
- [ ] **No red banner** at the top of the page (a red "Database not connected"
  banner means `NEXT_PUBLIC_DB_MODE` is not `postgres` and the site is
  running per-browser mock mode — see below)
- [ ] Sign up as a **seller** → you land in store onboarding
- [ ] Create the store, add a product **with a photo** → photo uploads to
  Postgres (the upload returns an `/api/media/product-images/...` URL)
- [ ] Sign up as a buyer → open the store → the **Chat** tab works
- [ ] Add a store review → the store's rating updates (server trigger)
- [ ] **Cross-user sync:** in a second browser/incognito window sign up a
  different seller and create a store with a product — the first window's
  homepage and search should show it within a few seconds (no refresh).
  Two windows chatting should show both sides instantly.
- [ ] **Live user dots:** with two browsers open on `/search` (Map view), allow
  location in one of them — the other should show that person as a blue dot
  within a few seconds.

## If users can't see each other's data (the #1 support issue)

The deployed site is running in **mock mode**. When `NEXT_PUBLIC_DB_MODE` is
not exactly `postgres` (e.g. the env var was added after the build, or the
Blueprint's `value: postgres` was removed), the app silently falls back to a
browser-local demo database. Every user then sees *only their own browser's
data*.

- **The tell:** a red "Database not connected" banner at the very top of the
  live site.
- **The fix:** set/keep `NEXT_PUBLIC_DB_MODE=postgres` on the service's
  **Environment** tab, then **Deploy → Clear build cache & deploy**, and
  confirm `DATABASE_URL` is populated (Blueprint services show it as
  "managed from database kejetia-db"). A successful `migrate.mjs` log line
  (`[migrate] Schema is up to date.`) confirms the backend is live.

---

## Step 3 — Local development (no cloud needed)

```bash
cd frontend
npm.cmd install
npm.cmd run dev          # mock mode: browser-local data, works offline
```

To run against a real Postgres locally:

```bash
# 1. point at any Postgres (Render DB, Neon, local)
$env:DATABASE_URL = "postgres://..."
# 2. apply the schema once
node ./scripts/migrate.mjs
# 3. set NEXT_PUBLIC_DB_MODE=postgres in frontend/.env.local, restart dev
npm.cmd run dev
```

> `frontend/.env.local` ships with `NEXT_PUBLIC_DB_MODE` commented out so the
> default is mock mode (no database required). Uncomment it only when a
> `DATABASE_URL` is actually reachable.

---

## After launch — notes & limits

- **Photos are compressed client-side to < 500 KB** (`frontend/lib/media.js`)
  and stored in Postgres as `BYTEA`. That compression keeps the database
  small — keep it; raw phone photos (multi-MB) would bloat the DB and slow
  the site.
- **Realtime is HTTP polling (~2s)** — instant enough for chat and the live
  map, but if chat ever needs true sub-second delivery consider a WebSocket
  layer (e.g. a small Node service). Fine for now.
- **Auth** is app-managed: users + sessions live in Postgres, passwords are
  bcrypt-hashed, and login sets an httpOnly cookie (`kj_session`, 30 days).
  There is no email verification/confirmation — signup logs you straight in.
- **Free instances sleep after ~15 min of inactivity** and wake on the next
  request (first load after an idle period may take ~30 s). Render's paid
  instance types keep it always-hot.
- **Regions:** pick a region close to your users when creating the database
  (e.g. `Frankfurt` for Ghana/Europe) — it cannot be changed after creation.