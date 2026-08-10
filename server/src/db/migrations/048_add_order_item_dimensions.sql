-- 048_add_order_item_dimensions.sql
-- Produk per m²: cashier memasukkan panjang × lebar saat order offline.
-- Simpan dimensi mentah (cm) agar harga bisa di-resolve ulang di server dan
-- ditampilkan di resi/invoice. `order_items.size` menyimpan teks "P × L cm".
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS length_cm DECIMAL(10,2) NULL AFTER material;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS width_cm  DECIMAL(10,2) NULL AFTER length_cm;

-- DOWN:
-- ALTER TABLE order_items DROP COLUMN width_cm;
-- ALTER TABLE order_items DROP COLUMN length_cm;
