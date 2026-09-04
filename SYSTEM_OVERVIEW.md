# Kejetia Online — System Overview

A plain-language guide to how the platform works: the pieces that run it, how
user data flows through it, how security works, what the free limits are, and
how it grows. Written for founders, engineers, and future teammates.

---

## 1. The big picture: three machines

Deployed, the platform runs on **two computers** (plus GitHub as the code
locker). There is no separate "backend server" in this architecture.

| Piece | What it runs | Analogy |
|---|---|---|
| **Vercel** | The website — all the Next.js/React code a visitor's browser downloads and runs. Hosts the pages, the API routes, and previews. | The **shop front + cashier desk**. |
| **Supabase** | The database, login system (Auth), file storage, and realtime chat. One managed Postgres database with superpowers bolted on. | The **back office**: ledger, key cabinet, stockroom, messenger. |
| **GitHub** | Just stores the code. Vercel pulls from GitHub and deploys it. | The **blueprint filing cabinet**. |

What used to be the "backend" is now two things, and both live *inside*
Supabase:

1. **Row Level Security (RLS)** — rules stored *in the database* that decide
   who can read/write what. This is the security wall *and* the business
   logic.
2. **Triggers & functions** — small programs that run automatically when data
   changes. Example already in production: when a review is added, a trigger
   recomputes the store's rating and review count.

When real server-side code is needed later (sending an email digest, bulk
import, PDF invoice), it goes in **Vercel serverless functions** (the existing
`frontend/app/api/` folders — currently empty shells) or **Supabase Edge
Functions**. Both are free at launch scale.

The old `backend/` folder (Express, one `/api/health` endpoint) is a stub —
nothing flows through it. It is retired from the architecture and exists only
in the repo for historical reference.

---

## 2. How user data flows (the journey)

Every table below is real Postgres. In **mock mode** (no Supabase env vars
set), the exact same code runs against `localStorage` in the visitor's own
browser — perfect for development, useless for a real product. Set the two env
vars and the same code talks to the cloud database instead.

**A buyer signs up.** Supabase Auth creates a locked-away identity row in
`auth.users` (you can't touch it). The app then creates a row in `profiles`
(name, phone, role = `buyer`). Two tables on purpose: credentials are private,
the profile is safe to show.

**A seller creates a store.** One row in `stores`: name, description, phone,
WhatsApp number, and **latitude/longitude** — this is what powers every map
pin in the app. The `owner_id` column links it to the seller's profile. RLS
says: anyone can view a store, only the owner can edit it.

**The seller lists products.** One row in `products` per item: name, price,
`stock` (blank = plenty, 0 = out, 1–5 = low), `old_price` (a higher "was"
price turns the item into a −% deal everywhere). Product **photos** are
stored as URLs pointing into Supabase Storage — never as image data inside the
database row (see the storage section below).

**A buyer reviews a store.** One row in `reviews` → the **trigger** fires →
recomputes `stores.rating` and `stores.review_count`. The rating you see on
the homepage, search, and map is *derived from actual reviews*, not hand-typed.

**Chat.** One `conversations` row links a buyer to a store, and `messages`
rows carry the conversation. Supabase **Realtime** pushes new messages to open
screens instantly — no refresh needed.

**The map.** Stores carry coordinates. The app renders them on free CARTO/OSM
tiles, with a geo-referenced Kejetia image overlay at high zoom, an in-market
walking graph (`lib/kejetia-graph.js`), and Google-Maps deep links for turn-by-
turn. The map is the product's differentiator and also its biggest growth
opportunity (see "Limitations").

---

## 3. Security: why the anon key being public is fine

The Supabase **anon key** ships in the browser. Anyone can read it. That is
*by design* — the wall is not secrecy, it's **RLS**. Every query the browser
makes is filtered through "who is asking?" (`auth.uid()`):

```sql
-- Anyone may see stores, but ONLY the owner may edit them
CREATE POLICY stores_select ON stores FOR SELECT USING (true);
CREATE POLICY stores_update ON stores FOR UPDATE
  USING (owner_id = auth.uid());
```

A hacker with the anon key can *try* anything — the database refuses
everything their identity doesn't allow. This is why the RLS audit in
`supabase-migrations/add-rls-hardening.sql` matters: **every table must have
correct policies before real users onboard.** Missing policies in Supabase
default to *deny everything*, which is safe but confusing; the audit makes
each table explicitly right.

Supabase Storage works the same way: the `product-images` bucket is public for
reading (so `<img>` tags work) but only the store owner can upload into their
own folder path.

---

## 4. Capacity: how many users fit, and where the ceilings are

Verified numbers (2026, free tiers).

### The onboarding constraint: auth emails

Every email signup with confirmation enabled sends a verification email.
Supabase's built-in free sender is capped at **2 auth emails per hour,
project-wide** — shared by signups *and* password resets across the entire
platform.

| Path | Realistic daily ceiling | Notes |
|---|---|---|
| Email + confirmation (free sender) | **~40–48/day** | The launch default. ~1,300/month — right for onboarding real traders one by one. |
| Magic link / OTP | 30/hr project-wide | Sent by email, so the 2/hr sender caps it anyway. |
| Google / Apple / WhatsApp OAuth | **thousands/day** | No email sent at all — the 2/hr cap vanishes. Best spike-buster. |
| Custom SMTP (Resend, Brevo) | ~100–300/day | Raises auth email cap to 30/hr (720/day); the SMTP provider's own free daily cap binds first. |
| Email confirmation OFF | thousands/day | Removes the cap but is unsafe: no address verification, no account recovery. Not recommended. |

**Bottom line:** launch with confirmation on at ~48/day. The day a marketing
push could spike signups, flip on **Google OAuth** (free, dashboard toggle +
small code tweak) or wire a free **SMTP** — both are documented in this file's
upgrade path.

### Storage & database

| Resource | Free limit | What it means |
|---|---|---|
| Database | 500 MB | Tens of thousands of user/store/product/review rows — plenty. |
| File storage | 1 GB | Product photos live here. After client-side compression (<500 KB each), **~5–10k photos**. |
| Data egress | 5 GB/mo | ~5k image-heavy page views / ~50k light views. The first limit a growing marketplace hits. |
| Monthly active users | 50k | Not a launch constraint. |
| Inactivity pause | 7 days | Free projects pause after a week of no traffic, then wake on demand. Not an issue while live. |

### Vercel Hobby

100 GB bandwidth/mo, 1M function invocations/mo, 4h active CPU. The pages are
mostly static + client-rendered, so usage is tiny at launch.

### The honest flags

- **No African Supabase region.** Closest is eu-west-1 (Ireland) / eu-central-1
  (Frankfurt), ~100 ms from Ghana. Pick the region at project creation — it
  can never be changed afterward.
- **Maps run on free community services** (OSRM routing, CARTO/OSM tiles).
  Free but rate-limited and with no SLA. Fine at launch; budget for a paid
  tiles/routing provider when the map becomes the flagship (it will).
- **WhatsApp links are manual deep links** (`wa.me`). No delivery tracking,
  read receipts, or templates. The WhatsApp Business API (paid, Meta-approved)
  is the upgrade path.
- **"Free forever" is a myth.** The honest upgrade path, in order:
  1. Custom SMTP (Resend/Brevo free tier) — unlocks hundreds of signups/day.
  2. Supabase Pro ($25/mo) — when you approach 500 MB DB or 5 GB egress.
  3. Vercel Pro ($20/mo) — when bandwidth approaches 100 GB.
  By then the platform should have revenue to carry them.

---

## 5. Running the stack

### Modes

- **Mock mode (dev):** no Supabase env vars → everything persisted to
  `localStorage` under `kejetia_v2_*`. Tables start empty (demo data was
  removed at launch). Great for pure UI work.
- **Real mode (production):** set `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` → the `inMockMode()` switch flips and the
  same code talks to Postgres.

### Migrations (`supabase-migrations/`)

Run each once in the Supabase SQL editor, in this exact order:

1. `00-base-schema.sql` — the six core tables (`profiles`, `stores`,
   `products`, `conversations`, `messages`, `user_locations`) + the
   signup → profile trigger.
2. `add-products-stock.sql` — `products.stock` column + index.
3. `add-store-reviews.sql` — `products.old_price`, `reviews` table, rating
   trigger, reviews RLS.
4. `add-rls-hardening.sql` — RLS policies for every remaining table +
   the public `product-images` storage bucket.

### Deploy

Vercel: import the GitHub repo, set the two env vars, deploy. Supabase: create
the project (pick **eu-west-1**), run the migrations, and the site is live —
the browser talks to the database directly, so no backend provisioning is
needed.