-- ============================================================
-- Kejetia Online — live "users on the map" location tracker
-- ------------------------------------------------------------
-- Run AFTER 00-base-schema.sql and add-rls-hardening.sql
-- (and ideally add-realtime.sql). Idempotent + guarded, safe to
-- run more than once.
--
-- Backs the map's live user dots ("N users on the map", blue dots
-- with clustering). Before this migration the `user_locations`
-- table had no way to work:
--
--   1. No `updated_at` heartbeat  → nothing could expire stale
--      positions, and Realtime clients couldn't order by recency.
--   2. No unique-per-user row     → the tracker's upsert would
--      pile up rows instead of keeping one "last known location".
--   3. No RLS policies            → any anon key holder could
--      INSERT/UPDATE/DELETE anyone's row.
--   4. Not in supabase_realtime   → location changes never reached
--      other browsers, so dots never appeared live.
--
-- The front-end read path lives in frontend/hooks/useLiveLocations.js
-- (fetch + Realtime subscription + geolocation-gated publishing).
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.user_locations') IS NULL THEN
    RETURN;
  END IF;

  -- ── Heartbeat column ────────────────────────────────────────
  ALTER TABLE public.user_locations
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

  DROP TRIGGER IF EXISTS user_locations_set_updated_at ON public.user_locations;
  CREATE TRIGGER user_locations_set_updated_at
    BEFORE UPDATE ON public.user_locations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

  -- One row per user → the tracker's upsert is "last known location".
  CREATE UNIQUE INDEX IF NOT EXISTS user_locations_user_id_key
    ON public.user_locations (user_id);

  -- ── RLS: public read, owner write (mirrors stores/products) ─
  ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS user_locations_select_all ON public.user_locations;
  CREATE POLICY user_locations_select_all ON public.user_locations
    FOR SELECT USING (true);

  DROP POLICY IF EXISTS user_locations_insert_own ON public.user_locations;
  CREATE POLICY user_locations_insert_own ON public.user_locations
    FOR INSERT WITH CHECK (user_id = auth.uid());

  DROP POLICY IF EXISTS user_locations_update_own ON public.user_locations;
  CREATE POLICY user_locations_update_own ON public.user_locations
    FOR UPDATE USING (user_id = auth.uid());

  DROP POLICY IF EXISTS user_locations_delete_own ON public.user_locations;
  CREATE POLICY user_locations_delete_own ON public.user_locations
    FOR DELETE USING (user_id = auth.uid());

  -- ── Realtime: a location shared on one device reaches all ──
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations;
  END IF;
END $$;