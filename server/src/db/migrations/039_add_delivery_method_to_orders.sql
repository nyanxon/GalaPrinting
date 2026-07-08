-- ============================================================
-- 039_add_delivery_method_to_orders.sql
-- Fitur 3: Tambah kolom delivery_method ke tabel orders
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_method  ENUM('delivery','pickup_factory','pickup_store')
                                            NOT NULL DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS pickup_location  VARCHAR(191) DEFAULT NULL
                            COMMENT 'Lokasi pengambilan (untuk pickup)',
  ADD COLUMN IF NOT EXISTS pickup_ready_at  DATETIME DEFAULT NULL
                            COMMENT 'Jadwal siap diambil customer';
