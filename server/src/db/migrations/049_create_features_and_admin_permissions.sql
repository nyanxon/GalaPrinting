-- ============================================================
-- 049_create_features_and_admin_permissions.sql
-- Sistem Permission Dinamis (Step 1) — skema database.
--
-- Purely additive: TIDAK mengubah tabel/kolom/data yang sudah ada.
--   1. Tabel features        — master daftar semua fitur/menu sistem.
--   2. Tabel admin_permissions — permission dinamis per-akun.
--   3. Kolom users.is_promoted_admin — penanda akun yang diangkat Owner
--      menjadi admin dinamis (berbeda dari role hardcode yang sudah ada).
-- ============================================================

-- 1. Master list semua fitur yang ada di sistem
CREATE TABLE IF NOT EXISTS features (
  id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `key`       VARCHAR(100) NOT NULL UNIQUE
              COMMENT 'Identifier fitur, misal orders.view',
  label       VARCHAR(150) NOT NULL
              COMMENT 'Nama tampilan untuk UI Owner',
  category    VARCHAR(100) NOT NULL
              COMMENT 'Pengelompokan, misal Orders / Products / Revenue',
  description TEXT         DEFAULT NULL
              COMMENT 'Penjelasan singkat fitur ini',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Permission per-akun (Owner mengatur via dashboard)
CREATE TABLE IF NOT EXISTS admin_permissions (
  id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     CHAR(36)     NOT NULL,
  feature_key VARCHAR(100) NOT NULL,
  granted     TINYINT(1)   NOT NULL DEFAULT 0
              COMMENT '1 = fitur boleh diakses; 0 = tidak',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_permission (user_id, feature_key),
  CONSTRAINT fk_adminperm_user    FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_adminperm_feature FOREIGN KEY (feature_key) REFERENCES features(`key`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Penanda akun yang diangkat Owner menjadi admin dinamis
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_promoted_admin TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = diangkat Owner jadi admin dengan permission dinamis';
