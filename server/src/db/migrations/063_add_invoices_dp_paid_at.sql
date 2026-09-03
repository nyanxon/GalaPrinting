-- 063_add_invoices_dp_paid_at.sql
-- Tambah kolom dp_paid_at (tanggal DP diterima) pada invoices.
-- Digunakan di nota A4 & histori: saat invoice di-set DP, dp_paid_at diisi
-- timestamp. dp_paid_at dipertahankan sebagai histori walau status berubah
-- (mis. DP -> LUNAS), agar tetap bisa ditampilkan nominal & tanggal DP.
-- Tanggal pelunasan = paid_at (kolom yang sudah ada).

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS dp_paid_at DATETIME NULL DEFAULT NULL
  AFTER dp_amount;
