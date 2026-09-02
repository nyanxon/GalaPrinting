-- 062_add_orders_created_by_admin.sql
-- Tambah kolom created_by_admin_id ke tabel orders untuk melacak
-- siapa (CS/admin) yang membuat order offline.

ALTER TABLE orders
  ADD COLUMN created_by_admin_id CHAR(36) DEFAULT NULL
  AFTER admin_note;
