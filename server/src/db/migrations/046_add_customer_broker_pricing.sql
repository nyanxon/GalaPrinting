-- ============================================================
-- 046_add_customer_broker_pricing.sql
-- Fitur harga Customer vs Broker:
--   1. products.price          → rename menjadi price_customer
--   2. products.price_broker   → harga untuk broker (diisi = harga customer dulu)
--   3. orders.customer_type    → ENUM('customer','broker') — dari dropdown cashier
--
-- NOTE:
--   - order_items.product_id & order_items.notes (keterangan) SUDAH ada sejak
--     migrasi 005 — tidak perlu diubah di sini.
--   - order_items.price dipakai sebagai snapshot harga satuan (unit price)
--     sesuai customer_type saat order dibuat (tidak live-reference).
-- ============================================================

-- ── UP ────────────────────────────────────────────────────────

-- 1. Rename kolom harga lama menjadi harga customer (data lama dipertahankan).
--    Idempotent: hanya berjalan jika kolom `price` masih ada (migrasi ini bisa
--    dijalankan berulang kali oleh migrate.js).
SET @has_old_price := (SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'price');

SET @rename_sql := IF(@has_old_price > 0,
  'ALTER TABLE products CHANGE COLUMN price price_customer DECIMAL(15,2) NOT NULL DEFAULT 0',
  'DO 0');

PREPARE rename_stmt FROM @rename_sql;
EXECUTE rename_stmt;
DEALLOCATE PREPARE rename_stmt;

-- 2. Tambah harga broker — default dulu sama dengan harga customer.
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_broker DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER price_customer;

-- 3. Isi harga broker dari harga customer untuk produk yang belum pernah diisi.
UPDATE products SET price_broker = price_customer WHERE price_broker <= 0;

-- 4. Tipe pembeli per order offline (customer / broker).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_type ENUM('customer','broker') NOT NULL DEFAULT 'customer' AFTER customer_name;

-- ── DOWN (rollback manual) ────────────────────────────────────
-- ALTER TABLE orders DROP COLUMN IF EXISTS customer_type;
-- ALTER TABLE products DROP COLUMN IF EXISTS price_broker;
-- ALTER TABLE products CHANGE COLUMN price_customer price DECIMAL(15,2) NOT NULL DEFAULT 0;
