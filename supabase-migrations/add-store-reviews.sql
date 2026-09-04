-- ============================================================
-- Kejetia Online — Store reviews & honest ratings
-- ------------------------------------------------------------
-- 1. Products: ensure the `old_price` (sale / "was" price) column exists.
-- 2. New `reviews` table: one row per buyer review of a store.
-- 3. Trigger keeps stores.rating / stores.review_count in sync whenever a
--    review is inserted or deleted, so cards, search and the homepage always
--    show numbers that actually match the reviews.
-- ============================================================

-- Sale pricing (used by seller dashboards, deals surfaces & enquiry text).
ALTER TABLE products ADD COLUMN IF NOT EXISTS old_price NUMERIC(12, 2);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  author_name TEXT NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reviews_store_idx ON reviews (store_id, created_at DESC);

-- Recompute a store's aggregate from its reviews.
CREATE OR REPLACE FUNCTION public.refresh_store_rating(target_store UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_rating NUMERIC;
  total_reviews INTEGER;
BEGIN
  SELECT ROUND(AVG(rating)::NUMERIC, 1), COUNT(*)::INTEGER
    INTO avg_rating, total_reviews
    FROM reviews
   WHERE store_id = target_store;

  UPDATE stores
     SET rating = avg_rating,
         review_count = total_reviews
   WHERE id = target_store;
END;
$$;

-- Fire after insert/delete on reviews.
CREATE OR REPLACE FUNCTION public.reviews_rating_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_store_rating(OLD.store_id);
    RETURN OLD;
  END IF;
  PERFORM public.refresh_store_rating(NEW.store_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_rating_trigger ON reviews;
CREATE TRIGGER reviews_rating_trigger
  AFTER INSERT OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.reviews_rating_trigger_fn();

-- Row Level Security — anyone may read reviews, anyone may add one.
-- (In production, consider requiring a signed-in buyer or a verified
-- WhatsApp conversation before allowing inserts to deter review spam.)
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reviews_select ON reviews;
CREATE POLICY reviews_select ON reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS reviews_insert ON reviews;
CREATE POLICY reviews_insert ON reviews
  FOR INSERT WITH CHECK (
    rating BETWEEN 1 AND 5
    AND length(btrim(author_name)) >= 2
  );

-- A reviewer may delete their own review.
DROP POLICY IF EXISTS reviews_delete_own ON reviews;
CREATE POLICY reviews_delete_own ON reviews
  FOR DELETE USING (auth.uid() IS NOT NULL AND author_id = auth.uid());
