-- ============================================================
-- 041_expand_notification_preferences.sql
-- Tambah kolom notifikasi baru ke tabel notification_preferences
-- ============================================================

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS order_received     TINYINT(1) NOT NULL DEFAULT 1
    COMMENT 'Notifikasi saat pesanan baru diterima',
  ADD COLUMN IF NOT EXISTS mockup_accepted    TINYINT(1) NOT NULL DEFAULT 1
    COMMENT 'Notifikasi saat mockup / desain diterima',
  ADD COLUMN IF NOT EXISTS login_new_device   TINYINT(1) NOT NULL DEFAULT 1
    COMMENT 'Notifikasi login dari device baru',
  ADD COLUMN IF NOT EXISTS login_failed_alert TINYINT(1) NOT NULL DEFAULT 1
    COMMENT 'Alert percobaan login gagal berkali-kali';
