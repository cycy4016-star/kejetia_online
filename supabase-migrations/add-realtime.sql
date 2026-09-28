-- ============================================================
-- Kejetia Online — enable Supabase Realtime
-- ------------------------------------------------------------
-- Run AFTER the base schema, add-products-stock.sql,
-- add-store-reviews.sql and add-rls-hardening.sql.
-- Idempotent: safe to run more than once.
--
-- What this fixes
--   The chat page (frontend/app/chat/[id]/page.js) subscribes to
--   `postgres_changes` on `messages`, and live store/product maps
--   subscribe on `stores`/`products`/`landmarks`. Supabase only
--   delivers those events for tables that have been added to the
--   `supabase_realtime` publication — otherwise the subscriptions
--   silently never fire and "data isn't synced".
--
--   Adding the tables here publishes every INSERT/UPDATE/DELETE
--   to subscribed clients. Row-level security still applies to
--   Realtime deliveries, so the public-read policies in
--   add-rls-hardening.sql govern exactly what each user receives.
-- ============================================================

DO $$
BEGIN
  -- messages + conversations (live chat)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;

  -- stores + products (marketplace stays live)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stores;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;

  -- landmarks (map pins) + reviews (rating aggregates push live to cards)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'landmarks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.landmarks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reviews'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
  END IF;
END $$;