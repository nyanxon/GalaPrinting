-- Migration 057: Create activity_logs table (Fitur Activity Log).
--
-- Menyimpan snapshot aksi dari semua user (customer + admin/staff).
-- - Tidak ada FK ke users_customer / users_admin (sengaja):
--   log harus tetap ada walau akunnya nanti dihapus. actor_name / actor_role
--   disimpan sebagai snapshot, bukan di-join tiap saat dibaca.
-- - created_at memakai waktu UTC (sesuai koneksi mysql2 timezone '+00:00').
--   Konversi ke WIB (UTC+7) dilakukan saat pembacaan bila perlu.

CREATE TABLE IF NOT EXISTS activity_logs (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_type  ENUM('customer','admin') NOT NULL,
  actor_id    CHAR(36)   NULL,
  actor_name  VARCHAR(120) NULL,
  actor_role  VARCHAR(30)  NULL,
  action_label VARCHAR(255) NOT NULL,
  page_path   VARCHAR(255) NULL,
  target_type VARCHAR(60) NULL,
  target_id   VARCHAR(60) NULL,
  metadata    JSON NULL,
  ip_address  VARCHAR(45) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_activity_logs_actor_time ON activity_logs (actor_type, created_at);
CREATE INDEX idx_activity_logs_actor_id_time ON activity_logs (actor_id, created_at);
