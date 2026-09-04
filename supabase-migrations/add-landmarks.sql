-- ============================================================
-- Kejetia Online — user landmarks (photo pins on the map)
--
-- Any signed-in user can pin a spot and photograph a store front,
-- stall or landmark. It publishes instantly to the public map so
-- everyone can browse landmarks and jump to the store they show.
--
-- Run AFTER 00-base-schema.sql and add-rls-hardening.sql.
-- Idempotent: safe to run more than once.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.landmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  notes       TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT 'landmark',
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  photo_url   TEXT,
  store_id    UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Anyone (signed in or not) may view the public map layer.
ALTER TABLE public.landmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS landmarks_select_all ON public.landmarks;
CREATE POLICY landmarks_select_all ON public.landmarks
  FOR SELECT USING (true);

-- Signed-in users may add their own landmarks.
DROP POLICY IF EXISTS landmarks_insert_own ON public.landmarks;
CREATE POLICY landmarks_insert_own ON public.landmarks
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS landmarks_update_own ON public.landmarks;
CREATE POLICY landmarks_update_own ON public.landmarks
  FOR UPDATE USING (auth.uid() = created_by);

-- ── landmark-photos Storage bucket (public read, upload own) ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('landmark-photos', 'landmark-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS landmark_photos_select ON storage.objects;
CREATE POLICY landmark_photos_select ON storage.objects
  FOR SELECT USING (bucket_id = 'landmark-photos');

DROP POLICY IF EXISTS landmark_photos_insert_own ON storage.objects;
CREATE POLICY landmark_photos_insert_own ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'landmark-photos' AND owner_id = auth.uid());

DROP POLICY IF EXISTS landmark_photos_delete_own ON storage.objects;
CREATE POLICY landmark_photos_delete_own ON storage.objects
  FOR DELETE USING (bucket_id = 'landmark-photos' AND owner_id = auth.uid());
