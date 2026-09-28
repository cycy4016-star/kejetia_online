# Kejetia Online — Fixes Summary

Date: 21 Sep 2026
Scope: two reported issue areas — **(1) data sync / cross-user visibility** and
**(2) the map system + location tracker**.

---

## 1. "Data isn't synced — users can't see stores created by other users"

### Root cause (three independent problems)
1. **App silently runs in per-browser mock mode.** When
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing (or
   still the placeholder `your_supabase_project_url`), the app falls back to a
   `localStorage`-backed demo database. Every browser then only ever sees its
   own data — cross-user visibility is impossible, with no warning shown.
2. **Supabase Realtime was never enabled.** The frontend subscribed with
   `postgres_changes`, but none of the tables were added to the
   `supabase_realtime` publication, so subscriptions silently never fired.
3. **The mock realtime client was a no-op stub.** `channel()` did nothing, so
   even two tabs of the same browser couldn't sync.

### Fixes applied
| File | Change |
|---|---|
| `frontend/lib/supabase.js` | Rewrote the mock layer: realtime via `BroadcastChannel` + `storage`-event fallback (with dedupe and `column=eq.value` filters), signup now mirrors the Postgres `profiles` trigger, deferred `update`/`delete` to match caller chaining, change events published for `insert`/`update`/`delete`, per-channel `removeChannel`. |
| `frontend/components/ModeBanner.js` *(new)* | Amber (dev) / red (prod) banner when the app is running in mock mode so deployments can't silently ship wrong. Rendered in `frontend/app/layout.js`. |
| `supabase-migrations/add-realtime.sql` *(new)* | Idempotent migration adding `messages`, `conversations`, `stores`, `products`, `landmarks`, `reviews` to the `supabase_realtime` publication. |
| `frontend/app/page.js`, `app/search/page.js`, `app/store/[id]/page.js`, `app/chat/page.js` | Live `postgres_changes` refresh on marketplace + conversations so other users' data appears without a manual reload. |
| `DEPLOYMENT.md` | Migration ordering (6 = realtime), cross-user sync sanity checks, troubleshooting section. |

**Operator action:** set both env vars on Vercel/Render and redeploy (removes the
red banner), then run `supabase-migrations/add-realtime.sql` in the SQL Editor.

---

## 2. Map system + location tracker

### Root cause
The map UI was fully styled (user dots, clusters, "N users on the map" counter),
but the **`user_locations` table had no data path**: nothing ever wrote to it,
nothing read it, it wasn't in the Realtime publication, and it had no RLS,
no `updated_at` heartbeat, and no unique-per-user row. Result: the tracker
"worked" except it always showed **0 users**. Two further map bugs: the map's
"Try again" button could never rebuild a failed map, and `StoreMap.js` had a
wrong market center + deprecated tile URL.

### Fixes applied
| File | Change |
|---|---|
| `frontend/hooks/useLiveLocations.js` *(new)* | The tracker's read + write path: fetches and live-subscribes to `user_locations`; when a **signed-in** user has granted geolocation, publishes via a ~60s heartbeat (real mode: `upsert` on `user_id`; mock mode: update-or-insert). Anonymous visitors are read-only. Dots expire after ~10 min of silence. Enrichment joins `profiles` for names. |
| `supabase-migrations/add-user-locations.sql` *(new)* | Idempotent migration: `updated_at` heartbeat + trigger, unique index on `user_id`, RLS (public read / owner write), table added to `supabase_realtime`. |
| `frontend/app/search/page.js` | Uses the hook (active only while the Map view is open) and passes `userLocations` into `LiveMap`. |
| `frontend/app/store/[id]/page.js` | Same, gated to the Map tab. |
| `frontend/components/maps/LiveMap.js` | Retry fix: `initNonce` state re-runs the one-time map init, so "Try again" actually rebuilds the map instead of leaving a blank container. |
| `frontend/components/maps/StoreMap.js` | Imports the correct `KEJETIA_CENTER` from `lib/map-geo.js` instead of a hardcoded wrong value; uses the modern OSM tile URL. |
| `DEPLOYMENT.md` | Migration 7 row, live-user-dot sanity check, troubleshooting entry for "map shows 0 users". |

**Operator action:** run `supabase-migrations/add-user-locations.sql` in the
Supabase SQL Editor (migration 7).

---

## Verification
- `npm.cmd run build` (via `npm.cmd` — PowerShell blocks plain `npm`) completes
  with all 10 routes compiled; lint + type check pass.
- Live sanity scripts (done manually / to redo after deploy):
  1. Two browsers/incognito → seller A and seller B create stores → each sees
     the other's store within ~1–2 s with no reload (real + mock modes).
  2. Two windows on `/search` Map view → allow location in one → the other
     shows a blue dot and a higher "users on the map" counter within seconds
     (requires migrations 6 + 7).

## Environment notes
- Repo root (this summary lives there too) is the nested
  `kejetia_online-main/kejetia_online-main/` directory. No git repo present —
  changes are on disk only.
- `npm.cmd install` reports 3 dependency vulnerabilities (2 high, 1 critical) —
  pre-existing, out of scope of these fixes.
- `npm` (PowerShell wrapper) fails on this machine due to execution policy —
  use `npm.cmd`.