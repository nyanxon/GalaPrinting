-- ============================================================
-- 047_add_product_size_type_and_visibility.sql
-- Fitur tipe ukuran produk & visibilitas produk:
--   1. products.size_type               → ENUM('fixed','per_m2')
--      - 'fixed'  : ukuran memakai size table (sizes + variant_prices)
--      - 'per_m2' : ukuran dihitung panjang x lebar saat order
--                   (size table tidak dipakai)
--   2. products.is_hidden_from_customer → TINYINT(1)
--      - 1: produk disembunyikan dari halaman customer (homepage/product page),
--           tetap tampil di kasir/admin
--      - 0 (default): tampil normal di semua tempat
-- ============================================================

-- ── UP ────────────────────────────────────────────────────────

ALTER TABLE products ADD COLUMN IF NOT EXISTS size_type ENUM('fixed','per_m2') NOT NULL DEFAULT 'fixed' AFTER materials;

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_hidden_from_customer TINYINT(1) NOT NULL DEFAULT 0 AFTER size_type;

-- ── DOWN (rollback manual) ────────────────────────────────────
-- ALTER TABLE products DROP COLUMN IF EXISTS is_hidden_from_customer;
-- ALTER TABLE products DROP COLUMN IF EXISTS size_type;
