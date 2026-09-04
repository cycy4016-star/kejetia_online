-- Kejetia Online — inventory tracking
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- Adds a `stock` column to `products` so sellers can track how many units
-- they have of each item in their store.
--
--   NULL  → seller isn't tracking stock (shown as "In stock", plenty)
--   0     → out of stock
--   > 0   → that many units left (1–5 shows "Only X left")
--
-- Existing products keep working untouched: `stock` stays NULL for them.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock INTEGER
  CHECK (stock IS NULL OR stock >= 0);

-- Speeds up "in stock only" queries once the catalogue grows.
CREATE INDEX IF NOT EXISTS idx_products_stock
  ON products (stock);