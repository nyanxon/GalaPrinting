-- 050_remove_product_variant_attributes.sql
-- Menghapus fitur atribut varian produk: warna (colors/color), ukuran (sizes/size),
-- bahan (materials/material), dan harga varian (variant_prices).
--
-- YANG DIHAPUS:
--   products.colors / products.sizes / products.materials / products.variant_prices
--   cart_items.color / cart_items.size / cart_items.material
--   order_items.color / order_items.size / order_items.material
--
-- YANG DI-PERTAHANKAN:
--   products.size_type  → ENUM('per_m2','none') default 'none' (Per M2 / Tidak ada)
--   order_items.length_cm / order_items.width_cm (perhitungan panjang × lebar)

-- 1) size_type: semua produk lama bernilai 'fixed' dipindahkan ke 'none'
--    (tabel ukuran dihapus), lalu enum disempitkan menjadi ('per_m2','none').
UPDATE products SET size_type = 'none' WHERE size_type = 'fixed';
ALTER TABLE products
  MODIFY COLUMN size_type ENUM('per_m2','none') NOT NULL DEFAULT 'none';

-- 2) Hapus kolom atribut varian pada tabel products.
ALTER TABLE products
  DROP COLUMN IF EXISTS colors,
  DROP COLUMN IF EXISTS sizes,
  DROP COLUMN IF EXISTS materials,
  DROP COLUMN IF EXISTS variant_prices;

-- 3) Hapus kolom atribut varian pada tabel cart_items.
ALTER TABLE cart_items
  DROP COLUMN IF EXISTS color,
  DROP COLUMN IF EXISTS size,
  DROP COLUMN IF EXISTS material;

-- 4) Hapus kolom atribut varian pada tabel order_items
--    (length_cm/width_cm tetap dipertahankan).
ALTER TABLE order_items
  DROP COLUMN IF EXISTS color,
  DROP COLUMN IF EXISTS size,
  DROP COLUMN IF EXISTS material;

-- DOWN (tidak otomatis dijalankan):
-- ALTER TABLE products ADD COLUMN colors JSON AFTER requires_design;
-- ALTER TABLE products ADD COLUMN sizes JSON AFTER colors;
-- ALTER TABLE products ADD COLUMN materials JSON AFTER sizes;
-- ALTER TABLE products ADD COLUMN variant_prices JSON DEFAULT NULL AFTER materials;
-- ALTER TABLE cart_items ADD COLUMN color VARCHAR(60) AFTER quantity;
-- ALTER TABLE cart_items ADD COLUMN size VARCHAR(60) AFTER color;
-- ALTER TABLE cart_items ADD COLUMN material VARCHAR(100) AFTER size;
-- ALTER TABLE order_items ADD COLUMN color VARCHAR(60) AFTER quantity;
-- ALTER TABLE order_items ADD COLUMN size VARCHAR(60) AFTER color;
-- ALTER TABLE order_items ADD COLUMN material VARCHAR(100) AFTER size;
