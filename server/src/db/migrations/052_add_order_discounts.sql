-- ============================================================
-- 052_add_order_discounts.sql
-- Fitur diskon manual order offline (cashier):
--   Diskon per baris: { "type": "percentage"|"nominal", "value": number, "label": string }
--   - order_items.discounts : rincian diskon yang scope-nya item itu sendiri
--   - orders.discounts      : rincian diskon yang scope-nya subtotal seluruh order
--   Total gabungan tetap ditulis ke orders.discount_amount yang sudah ada
--   (migrasi 019) agar invoice & laporan profit tetap konsisten.
-- ============================================================

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS discounts JSON NULL AFTER attributes;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discounts JSON NULL AFTER discount_amount;

-- ↓↓↓ DOWN (rollback manual) ↓↓↓
-- ALTER TABLE orders     DROP COLUMN IF EXISTS discounts;
-- ALTER TABLE order_items DROP COLUMN IF EXISTS discounts;
