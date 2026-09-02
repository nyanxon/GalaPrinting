-- ============================================================
-- 061_invoice_dp.sql
-- Fitur: Ganti status "Partial" -> "DP" + nominal DP pada invoice.
--
-- Perubahan:
--   1. invoices.payment_status : ENUM('unpaid','paid','partial') -> ENUM('unpaid','paid','dp')
--      Data existing ber-status 'partial' di-rename ke 'dp'.
--   2. invoices.dp_amount      : kolom BARU (DECIMAL) untuk nominal DP yang sudah dibayar.
--      Sisa pembayaran dihitung on-the-fly (total - dp_amount), tidak disimpan.
--   3. Metode pembayaran COD: TIDAK diubah di DB (payment_method adalah VARCHAR
--      bebas, bukan enum). Data lama ber-metode COD dibiarkan apa adanya;
--      hanya opsi dropdown frontend yang dihapus.
--
-- Idempotent (aman dijalankan berulang oleh migrate.js).
-- ============================================================

-- 1. Tambah kolom nominal DP (idempotent).
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS dp_amount DECIMAL(15,2) NULL DEFAULT NULL
  AFTER total;

-- 2. Rename data existing ber-status 'partial' -> 'dp'.
UPDATE invoices SET payment_status = 'dp' WHERE payment_status = 'partial';

-- 3. Ubah ENUM payment_status: hapus 'partial', tambah 'dp'.
--    Idempotent: hanya MODIFY jika enum belum memuat 'dp' (mis. sudah dijalankan).
SET @has_dp_enum := (SELECT
  CASE WHEN COLUMN_TYPE LIKE '%''dp''%' THEN 1 ELSE 0 END
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'payment_status');

SET @enum_sql := IF(@has_dp_enum = 0,
  'ALTER TABLE invoices MODIFY COLUMN payment_status ENUM(''unpaid'',''paid'',''dp'') NOT NULL DEFAULT ''unpaid''',
  'DO 0');

PREPARE enum_stmt FROM @enum_sql;
EXECUTE enum_stmt;
DEALLOCATE PREPARE enum_stmt;

-- ── DOWN (rollback manual) ────────────────────────────────────
-- ALTER TABLE invoices DROP COLUMN IF EXISTS dp_amount;
-- UPDATE invoices SET payment_status = 'partial' WHERE payment_status = 'dp';
-- ALTER TABLE invoices MODIFY COLUMN payment_status ENUM('unpaid','paid','partial') NOT NULL DEFAULT 'unpaid';
