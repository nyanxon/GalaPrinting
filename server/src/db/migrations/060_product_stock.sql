-- ============================================================
-- 060_product_stock.sql
-- Fitur stok per kombinasi atribut.
--
-- product_stock menyimpan stok per kombinasi atribut produk:
--   - attribute_combination  → JSON canonical [{name,value}], urutan nama
--     atribut diurutkan alfabetis (lihat server/src/utils/stock.js).
--   - combination_hash       → sha1 hex dari JSON canonical di atas,
--     dihitung aplikasi (bukan generated column) agar lookup konsisten.
--   - Produk tanpa atribut    → 1 baris dengan kombinasi [] (kosong).
--
-- Backfill stok awal (baris stok 0 utk semua kombinasi produk existing)
-- dilakukan oleh server/src/db/backfillProductStock.js yang dipanggil
-- otomatis dari migrate.js — INSERT IGNORE, idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS product_stock (
  id                    CHAR(36)  NOT NULL,
  product_id            CHAR(36)  NOT NULL,
  attribute_combination JSON      NOT NULL,
  combination_hash      CHAR(40)  NOT NULL,
  stock_quantity        INT       NOT NULL DEFAULT 0,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_stock_combination (product_id, combination_hash),
  KEY idx_product_stock_product (product_id),
  CONSTRAINT fk_product_stock_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── DOWN (rollback manual) ────────────────────────────────────
-- DROP TABLE IF EXISTS product_stock;