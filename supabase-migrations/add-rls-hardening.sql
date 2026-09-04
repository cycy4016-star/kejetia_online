-- ============================================================
-- Kejetia Online — Row Level Security hardening + image storage
-- ------------------------------------------------------------
-- Run this AFTER the base schema, add-products-stock.sql and
-- add-store-reviews.sql. Safe to run more than once.
--
-- Every section is guarded so the file works even if a base
-- table is missing in the project. Policy model:
--
--   • Anyone may READ public marketplace data (stores, products,
--     reviews, product images).
--   • WRITES are locked to the acting user via auth.uid():
--       profiles      → the user's own row
--       stores        → owner_id = auth.uid()
--       products      → the store owner
--       conversations → the buyer or the store owner
--       messages      → a participant of the conversation
--   • Product photos go in the public `product-images` Storage
--     bucket, uploaded only by the store owner into their folder.
-- ============================================================

-- ── PROFILES ────────────────────────────────────────────────
-- Any signed-in user may read profiles (chat needs the buyer's
-- name); each user may only insert/update their own row.
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS profiles_select_auth ON public.profiles;
    CREATE POLICY profiles_select_auth ON public.profiles
      FOR SELECT USING (auth.uid() IS NOT NULL);

    DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
    CREATE POLICY profiles_insert_self ON public.profiles
      FOR INSERT WITH CHECK (id = auth.uid());

    DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
    CREATE POLICY profiles_update_self ON public.profiles
      FOR UPDATE USING (id = auth.uid());
  END IF;
END $$;

-- ── STORES ──────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.stores') IS NOT NULL THEN
    ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS stores_select_public ON public.stores;
    CREATE POLICY stores_select_public ON public.stores
      FOR SELECT USING (true);

    DROP POLICY IF EXISTS stores_insert_owner ON public.stores;
    CREATE POLICY stores_insert_owner ON public.stores
      FOR INSERT WITH CHECK (owner_id = auth.uid());

    DROP POLICY IF EXISTS stores_update_owner ON public.stores;
    CREATE POLICY stores_update_owner ON public.stores
      FOR UPDATE USING (owner_id = auth.uid());

    DROP POLICY IF EXISTS stores_delete_owner ON public.stores;
    CREATE POLICY stores_delete_owner ON public.stores
      FOR DELETE USING (owner_id = auth.uid());
  END IF;
END $$;

-- ── PRODUCTS ────────────────────────────────────────────────
-- Public read; only the owner of the parent store writes.
DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS products_select_public ON public.products;
    CREATE POLICY products_select_public ON public.products
      FOR SELECT USING (true);

    DROP POLICY IF EXISTS products_insert_owner ON public.products;
    CREATE POLICY products_insert_owner ON public.products
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = products.store_id AND s.owner_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS products_update_owner ON public.products;
    CREATE POLICY products_update_owner ON public.products
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = products.store_id AND s.owner_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS products_delete_owner ON public.products;
    CREATE POLICY products_delete_owner ON public.products
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = products.store_id AND s.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── CONVERSATIONS ───────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.conversations') IS NOT NULL THEN
    ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS conversations_select_participant ON public.conversations;
    CREATE POLICY conversations_select_participant ON public.conversations
      FOR SELECT USING (
        buyer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = conversations.store_id AND s.owner_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS conversations_insert_participant ON public.conversations;
    CREATE POLICY conversations_insert_participant ON public.conversations
      FOR INSERT WITH CHECK (
        buyer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = conversations.store_id AND s.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── MESSAGES ────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.messages') IS NOT NULL THEN
    ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS messages_select_participant ON public.messages;
    CREATE POLICY messages_select_participant ON public.messages
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = messages.conversation_id
            AND (
              c.buyer_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.stores s
                WHERE s.id = c.store_id AND s.owner_id = auth.uid()
              )
            )
        )
      );

    DROP POLICY IF EXISTS messages_insert_participant ON public.messages;
    CREATE POLICY messages_insert_participant ON public.messages
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = messages.conversation_id
            AND (
              c.buyer_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.stores s
                WHERE s.id = c.store_id AND s.owner_id = auth.uid()
              )
            )
        )
      );
  END IF;
END $$;

-- ── REVIEWS ─────────────────────────────────────────────────
-- Already covered by add-store-reviews.sql (public read, anyone
-- may add with a name, delete own). Left intact.

-- ── PRODUCT-IMAGE STORAGE ───────────────────────────────────
-- Public bucket so <img> tags load straight from the CDN URL.
-- Uploads land in `{store_id}/{file}.jpg` and are only allowed
-- for the owner of that store.
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_images_select ON storage.objects;
CREATE POLICY product_images_select ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS product_images_insert ON storage.objects;
CREATE POLICY product_images_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT s.id::text FROM public.stores s WHERE s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS product_images_update_own ON storage.objects;
CREATE POLICY product_images_update_own ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-images' AND owner_id = auth.uid());

DROP POLICY IF EXISTS product_images_delete_own ON storage.objects;
CREATE POLICY product_images_delete_own ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images' AND owner_id = auth.uid());