-- ============================================================
-- 051_add_dynamic_product_attributes.sql
-- Fitur atribut produk dinamis (pengganti warna/ukuran/bahan):
--   Nama atribut bebas ditentukan admin per produk — mis. "Warna",
--   "Tipe Laminasi", "Tipe Kertas", "Jenis Bahan", dst.
--   Format JSON: [{"name":"Tipe Laminasi","values":["Glossy","Doff"]}, ...]
--
--   1. products.attributes     → daftar definisi atribut + pilihan nilai
--   2. cart_items.attributes   → pilihan atribut saat menambah ke keranjang
--                                [{"name":"Tipe Laminasi","value":"Glossy"}, ...]
--   3. order_items.attributes  → snapshot pilihan atribut pada pesanan
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS attributes JSON NULL AFTER short_description;

ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS attributes JSON NULL AFTER quantity;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS attributes JSON NULL AFTER quantity;

-- ── DOWN (rollback manual) ────────────────────────────────────
-- ALTER TABLE products    DROP COLUMN IF EXISTS attributes;
-- ALTER TABLE cart_items  DROP COLUMN IF EXISTS attributes;
-- ALTER TABLE order_items DROP COLUMN IF EXISTS attributes;
