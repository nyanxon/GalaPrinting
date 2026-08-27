-- 053_split_users_customer_admin.sql
-- Splits the monolithic `users` table into two independent tables:
--   users_customer  (customers only — no `role` column needed)
--   users_admin     (staff: admin/owner/cashier/cs/operational/qc/offline)
-- The old `users` table is kept intact for now (dropped in a later migration
-- after all FKs and code paths have been migrated).

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Create users_customer
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users_customer (
  id                         CHAR(36)     NOT NULL PRIMARY KEY,
  name                       VARCHAR(120) NOT NULL,
  email                      VARCHAR(191) NOT NULL UNIQUE,
  phone                      VARCHAR(30)  DEFAULT NULL,
  password_hash              VARCHAR(255) NOT NULL,
  gender                     ENUM('L','P') DEFAULT NULL,
  dob                        DATE          DEFAULT NULL,
  avatar_url                 VARCHAR(500) DEFAULT NULL,
  is_email_verified          TINYINT(1)   NOT NULL DEFAULT 0,
  email_verification_token   VARCHAR(255) DEFAULT NULL,
  email_verification_expires DATETIME     DEFAULT NULL,
  reset_password_token       VARCHAR(255) DEFAULT NULL,
  reset_password_expires     DATETIME     DEFAULT NULL,
  deleted_at                 DATETIME     DEFAULT NULL,
  created_at                 DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_uc_verification_token (email_verification_token(191)),
  INDEX idx_uc_reset_token        (reset_password_token(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Create users_admin
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users_admin (
  id                         CHAR(36)     NOT NULL PRIMARY KEY,
  role                       ENUM('admin','owner','cashier','cs','operational','qc','offline')
                             NOT NULL DEFAULT 'admin',
  name                       VARCHAR(120) NOT NULL,
  email                      VARCHAR(191) NOT NULL UNIQUE,
  phone                      VARCHAR(30)  DEFAULT NULL,
  password_hash              VARCHAR(255) NOT NULL,
  gender                     ENUM('L','P') DEFAULT NULL,
  dob                        DATE          DEFAULT NULL,
  avatar_url                 VARCHAR(500) DEFAULT NULL,
  is_email_verified          TINYINT(1)   NOT NULL DEFAULT 0,
  email_verification_token   VARCHAR(255) DEFAULT NULL,
  email_verification_expires DATETIME     DEFAULT NULL,
  reset_password_token       VARCHAR(255) DEFAULT NULL,
  reset_password_expires     DATETIME     DEFAULT NULL,
  is_promoted_admin          TINYINT(1)   NOT NULL DEFAULT 0
                             COMMENT '1 = diangkat Owner jadi admin dengan permission dinamis',
  deleted_at                 DATETIME     DEFAULT NULL,
  created_at                 DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ua_verification_token (email_verification_token(191)),
  INDEX idx_ua_reset_token        (reset_password_token(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Backfill users_customer from users (role = 'customer')
-- ──────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO users_customer
  (id, name, email, phone, password_hash, gender, dob, avatar_url,
   is_email_verified, email_verification_token, email_verification_expires,
   reset_password_token, reset_password_expires,
   deleted_at, created_at, updated_at)
SELECT
  id, name, email, phone, password_hash, gender, dob, avatar_url,
  is_email_verified, email_verification_token, email_verification_expires,
  reset_password_token, reset_password_expires,
  deleted_at, created_at, updated_at
FROM users
WHERE role = 'customer';

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Backfill users_admin from users (role != 'customer')
-- ──────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO users_admin
  (id, role, name, email, phone, password_hash, gender, dob, avatar_url,
   is_email_verified, email_verification_token, email_verification_expires,
   reset_password_token, reset_password_expires, is_promoted_admin,
   deleted_at, created_at, updated_at)
SELECT
  id, role, name, email, phone, password_hash, gender, dob, avatar_url,
  is_email_verified, email_verification_token, email_verification_expires,
  reset_password_token, reset_password_expires, is_promoted_admin,
  deleted_at, created_at, updated_at
FROM users
WHERE role != 'customer';

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Add user_type to refresh_tokens and backfill
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE refresh_tokens
  ADD COLUMN user_type ENUM('customer','admin') NOT NULL DEFAULT 'customer'
  AFTER user_id;

UPDATE refresh_tokens rt
  JOIN users u ON u.id = rt.user_id
SET rt.user_type = CASE WHEN u.role = 'customer' THEN 'customer' ELSE 'admin' END
WHERE rt.user_type = 'customer';

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. Drop FK from refresh_tokens (application code validates existence now)
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE refresh_tokens
  DROP FOREIGN KEY fk_rt_user;
