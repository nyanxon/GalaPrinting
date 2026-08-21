-- ============================================================
-- schema_full_001_051.sql
-- GABUNGAN SELURUH MIGRASI 001 s/d 051 (dijalankan berurutan)
--
-- FUNGSI:
--   1. Setup database BARU dari nol (semua tabel + kolom final).
--   2. "Memperbaiki" database lama yang tabel/kolomnya kurang,
--      karena semua CREATE TABLE memakai IF NOT EXISTS dan
--      ALTER TABLE memakai ADD/DROP COLUMN IF NOT EXISTS.
--
-- CARA PAKAI (phpMyAdmin):
--   - Klik nama database aplikasi di panel kiri (PENTING!
--     jangan sampai "No database selected").
--   - Tab Import -> pilih file ini -> Go.
--
-- SYARAT: MariaDB (sintaks ADD COLUMN IF NOT EXISTS tidak
--         didukung MySQL murni).
--
-- File ini TIDAK diletakkan di folder migrations/ agar tidak
-- dijalankan ulang oleh `npm run migrate`.
-- Sumber resmi tetap: server/src/db/migrations/*.sql
-- ============================================================

-- ############################################
-- # FILE: 001_create_users.sql
-- ############################################
CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  role          ENUM('customer','admin','owner','cashier','cs','operational','qc','offline')
                NOT NULL DEFAULT 'customer',
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(191) NOT NULL UNIQUE,
  phone         VARCHAR(30),
  password_hash VARCHAR(255) NOT NULL,
  deleted_at    DATETIME     DEFAULT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 002_create_categories.sql
-- ############################################
CREATE TABLE IF NOT EXISTS categories (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 003_create_products.sql
-- ############################################
CREATE TABLE IF NOT EXISTS products (
  id                CHAR(36)       NOT NULL PRIMARY KEY,
  category_id       CHAR(36)       DEFAULT NULL,
  name              VARCHAR(191)   NOT NULL,
  slug              VARCHAR(191)   NOT NULL UNIQUE,
  price             DECIMAL(15,2)  NOT NULL DEFAULT 0,
  short_description VARCHAR(500),
  requires_design   TINYINT(1)     NOT NULL DEFAULT 0,
  colors            JSON,
  sizes             JSON,
  materials         JSON,
  image_path        VARCHAR(500),
  created_at        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_category FOREIGN KEY (category_id)
    REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 004_create_orders.sql
-- ############################################
CREATE TABLE IF NOT EXISTS orders (
  id                  CHAR(36)      NOT NULL PRIMARY KEY,
  order_number        VARCHAR(50)   NOT NULL UNIQUE,
  order_type          ENUM('standard','custom') NOT NULL DEFAULT 'standard',
  source              ENUM('online','offline','custom') NOT NULL DEFAULT 'online',
  customer_id         CHAR(36)      DEFAULT NULL,
  customer_name       VARCHAR(120),
  customer_phone      VARCHAR(30),
  customer_address    TEXT,
  status              VARCHAR(60)   NOT NULL DEFAULT 'Waiting for Payment',
  subtotal            DECIMAL(15,2) NOT NULL DEFAULT 0,
  admin_note          TEXT,
  tracking_number     VARCHAR(100),
  courier_name        VARCHAR(100),
  payment_proof_path  VARCHAR(500),
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_customer FOREIGN KEY (customer_id)
    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 005_create_order_items.sql
-- ############################################
CREATE TABLE IF NOT EXISTS order_items (
  id               CHAR(36)      NOT NULL PRIMARY KEY,
  order_id         CHAR(36)      NOT NULL,
  product_id       CHAR(36)      DEFAULT NULL,
  name             VARCHAR(191)  NOT NULL,
  price            DECIMAL(15,2) NOT NULL,
  quantity         INT           NOT NULL DEFAULT 1,
  color            VARCHAR(60),
  size             VARCHAR(60),
  material         VARCHAR(100),
  notes            TEXT,
  design_file_path VARCHAR(500),
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_item_order   FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 006_create_order_history.sql
-- ############################################
CREATE TABLE IF NOT EXISTS order_history (
  id          CHAR(36)    NOT NULL PRIMARY KEY,
  order_id    CHAR(36)    NOT NULL,
  from_status VARCHAR(60),
  to_status   VARCHAR(60) NOT NULL,
  actor_id    CHAR(36)    DEFAULT NULL,
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_history_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_history_actor FOREIGN KEY (actor_id) REFERENCES users(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 007_create_cart_items.sql
-- ############################################
CREATE TABLE IF NOT EXISTS cart_items (
  id               CHAR(36)      NOT NULL PRIMARY KEY,
  user_id          CHAR(36)      NOT NULL,
  product_id       CHAR(36)      DEFAULT NULL,
  name             VARCHAR(191)  NOT NULL,
  price            DECIMAL(15,2) NOT NULL,
  quantity         INT           NOT NULL DEFAULT 1,
  color            VARCHAR(60),
  size             VARCHAR(60),
  material         VARCHAR(100),
  notes            TEXT,
  design_file_path VARCHAR(500),
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_cart_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 008_create_conversations.sql
-- ############################################
CREATE TABLE IF NOT EXISTS conversations (
  id                CHAR(36)     NOT NULL PRIMARY KEY,
  customer_id       CHAR(36)     NOT NULL,
  customer_name     VARCHAR(120) NOT NULL,
  assigned_admin_id CHAR(36)     DEFAULT NULL,
  last_at           DATETIME     DEFAULT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_conv_customer FOREIGN KEY (customer_id)       REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_conv_admin    FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 009_create_messages.sql
-- ############################################
CREATE TABLE IF NOT EXISTS messages (
  id              CHAR(36)    NOT NULL PRIMARY KEY,
  conversation_id CHAR(36)    NOT NULL,
  sender_id       CHAR(36)    NOT NULL,
  sender_role     VARCHAR(20) NOT NULL,
  type            ENUM('text','file') NOT NULL DEFAULT 'text',
  content         TEXT,
  file_path       VARCHAR(500),
  file_name       VARCHAR(255),
  file_size       BIGINT,
  mime_type       VARCHAR(100),
  read_at         DATETIME    DEFAULT NULL,
  created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_msg_conv   FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id)       REFERENCES users(id)         ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 010_create_reviews.sql
-- ############################################
CREATE TABLE IF NOT EXISTS reviews (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  product_id    CHAR(36)     DEFAULT NULL,
  customer_id   CHAR(36)     NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  rating        TINYINT      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_product  FOREIGN KEY (product_id)  REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_review_customer FOREIGN KEY (customer_id) REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 011_create_analytics_visits.sql
-- ############################################
CREATE TABLE IF NOT EXISTS analytics_visits (
  id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  visit_date DATE   NOT NULL UNIQUE,
  count      INT    NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 012_create_analytics_product_views.sql
-- ############################################
CREATE TABLE IF NOT EXISTS analytics_product_views (
  id         BIGINT   NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  view_date  DATE     NOT NULL,
  count      INT      NOT NULL DEFAULT 0,
  UNIQUE KEY uq_product_date (product_id, view_date),
  CONSTRAINT fk_view_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 013_create_refresh_tokens.sql
-- ############################################
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  user_id    CHAR(36)     NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  family     CHAR(36)     NOT NULL,
  used_at    DATETIME     DEFAULT NULL,
  expires_at DATETIME     NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_rt_family (family),
  INDEX idx_rt_hash   (token_hash(64))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 014_add_gender_dob_to_users.sql
-- ############################################
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gender ENUM('L','P') DEFAULT NULL AFTER phone,
  ADD COLUMN IF NOT EXISTS dob    DATE          DEFAULT NULL AFTER gender;

-- ############################################
-- # FILE: 015_create_order_sequence.sql
-- ############################################
CREATE TABLE IF NOT EXISTS order_sequence (
  id          INT          NOT NULL DEFAULT 1 PRIMARY KEY,
  last_seq    INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed the single row if it doesn't exist
INSERT IGNORE INTO order_sequence (id, last_seq) VALUES (1, 0);

-- ############################################
-- # FILE: 016_add_status_check_constraint.sql
-- ############################################
-- Migration 016: Add CHECK constraint to orders.status
-- NOTE (MariaDB): Avoid stored procedures because PHPMyAdmin often fails with "near ''" for CREATE PROCEDURE blocks.
-- Idempotent-ish: if constraint exists, attempt to drop it using dynamic SQL.

-- Ensure status column shape first (safe to re-run)
ALTER TABLE orders
  MODIFY COLUMN status VARCHAR(60) NOT NULL DEFAULT 'Waiting for Payment';

-- Try to drop constraint if it exists (dynamic SQL; harmless if it doesn't)
SET @drop_stmt := (
  SELECT CONCAT('ALTER TABLE orders DROP CONSTRAINT chk_orders_status')
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND CONSTRAINT_NAME = 'chk_orders_status'
    AND CONSTRAINT_TYPE = 'CHECK'
  LIMIT 1
);

SET @does_exist := (@drop_stmt IS NOT NULL);

SET @sql := IF(@does_exist, @drop_stmt, 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add constraint (if it exists already, this may fail; but the drop attempt above should handle it)
ALTER TABLE orders
  ADD CONSTRAINT chk_orders_status CHECK (
    status IN (
      'Waiting for Payment',
      'Payment Accepted',
      'Waiting for Design Approval',
      'Design Accepted',
      'On Progress',
      'Quality Checking',
      'In Delivery',
      'Finished',
      'Cancelled'
    )
  );

-- ############################################
-- # FILE: 017_add_variant_prices_to_products.sql
-- ############################################
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_prices JSON DEFAULT NULL AFTER materials;

-- ############################################
-- # FILE: 018_create_promo_codes.sql
-- ############################################
CREATE TABLE IF NOT EXISTS promo_codes (
  id          CHAR(36)      NOT NULL PRIMARY KEY,
  code        VARCHAR(50)   NOT NULL UNIQUE,
  type        ENUM('percentage','fixed') NOT NULL DEFAULT 'percentage',
  value       DECIMAL(10,2) NOT NULL,
  max_uses    INT           DEFAULT NULL,
  usage_count INT           NOT NULL DEFAULT 0,
  expires_at  DATETIME      DEFAULT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 019_add_promo_to_orders.sql
-- ############################################
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS promo_code      VARCHAR(50)   DEFAULT NULL AFTER subtotal,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER promo_code;

-- ############################################
-- # FILE: 020_add_cancellation_reason_to_orders.sql
-- ############################################
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT NULL AFTER admin_note;

-- ############################################
-- # FILE: 021_add_cancellation_reason_to_order_history.sql
-- ############################################
ALTER TABLE order_history ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT NULL;

-- ############################################
-- # FILE: 022_enhance_conversations_for_dm.sql
-- ############################################
-- Migration 022: Enhance conversations table for staff DM support
-- NOTE (MariaDB): Avoid stored procedures because PHPMyAdmin often fails with "near ''" for CREATE PROCEDURE blocks.

-- Make customer_id nullable so DM conversations (which have no customer) can be stored
ALTER TABLE conversations
  MODIFY COLUMN customer_id CHAR(36) NULL;

-- Add conversation_type discriminator column (idempotent)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS conversation_type ENUM('customer_chat', 'staff_dm') NOT NULL DEFAULT 'customer_chat'
    AFTER assigned_admin_id;

-- Add DM participant columns (idempotent)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS dm_participant_a CHAR(36) NULL AFTER conversation_type,
  ADD COLUMN IF NOT EXISTS dm_participant_b CHAR(36) NULL AFTER dm_participant_a;

-- Backfill all existing rows with conversation_type = 'customer_chat'
UPDATE conversations SET conversation_type = 'customer_chat'
  WHERE conversation_type IS NULL OR conversation_type = '';

-- Create unique index only if it does not already exist (MariaDB-compatible via dynamic SQL)
SET @create_idx_stmt := (
  SELECT CONCAT('CREATE UNIQUE INDEX uq_dm_participants ON conversations (dm_participant_a, dm_participant_b)')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'conversations'
    AND INDEX_NAME   = 'uq_dm_participants'
  LIMIT 1
);

-- If the index exists, do nothing; otherwise create it
SET @idx_exists := (@create_idx_stmt IS NOT NULL);
SET @sql := IF(@idx_exists, 'SELECT 1', 'CREATE UNIQUE INDEX uq_dm_participants ON conversations (dm_participant_a, dm_participant_b)');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ############################################
-- # FILE: 023_add_avatar_url_to_users.sql
-- ############################################
-- Migration 023: Add avatar_url column to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) DEFAULT NULL;

-- ############################################
-- # FILE: 024_create_addresses.sql
-- ############################################
-- Migration 024: Create addresses table
CREATE TABLE IF NOT EXISTS addresses (
  id           CHAR(36)     NOT NULL PRIMARY KEY,
  user_id      CHAR(36)     NOT NULL,
  title        VARCHAR(100) NOT NULL,
  name         VARCHAR(120) NOT NULL,
  phone        VARCHAR(30)  NOT NULL,
  full_address TEXT         NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_addresses_user_id (user_id),
  CONSTRAINT fk_address_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 025_add_address_title_to_orders.sql
-- ############################################
-- Migration 025: Add customer_address_title to orders table
-- Stores the address label (e.g. "Rumah", "Kantor") from the customer's saved address

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_address_title VARCHAR(100) DEFAULT NULL AFTER customer_address;

-- ############################################
-- # FILE: 026_add_order_ref_to_reviews.sql
-- ############################################
-- Migration 026: Add order_id and order_item_id to reviews for spam prevention
-- Enforces one review per order item (1 order = 1 review per item)

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS order_id      CHAR(36) DEFAULT NULL AFTER product_id,
  ADD COLUMN IF NOT EXISTS order_item_id CHAR(36) DEFAULT NULL AFTER order_id;

-- MariaDB/PHPMyAdmin: avoid stored procedures; use dynamic SQL instead
SET @create_key_stmt := (
  SELECT CONCAT('ALTER TABLE reviews ADD UNIQUE KEY uq_review_customer_order_item (customer_id, order_item_id)')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'reviews'
    AND INDEX_NAME   = 'uq_review_customer_order_item'
  LIMIT 1
);

-- If index exists -> create_stmt will be non-null -> run SELECT 1 (no-op)
-- If index doesn't exist -> create_stmt null -> run ALTER ...
SET @sql := IF(@create_key_stmt IS NOT NULL, 'SELECT 1', 'ALTER TABLE reviews ADD UNIQUE KEY uq_review_customer_order_item (customer_id, order_item_id)');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ############################################
-- # FILE: 027_enhance_promo_codes.sql
-- ############################################
-- Migration 023: Enhance promo_codes table with new constraint columns
-- Adds: daily_limit, min_purchase, max_discount, description, is_active

ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS description  VARCHAR(255)  DEFAULT NULL AFTER code,
  ADD COLUMN IF NOT EXISTS daily_limit  INT           DEFAULT NULL AFTER max_uses,
  ADD COLUMN IF NOT EXISTS min_purchase DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER daily_limit,
  ADD COLUMN IF NOT EXISTS max_discount DECIMAL(15,2) DEFAULT NULL AFTER min_purchase,
  ADD COLUMN IF NOT EXISTS is_active    TINYINT(1)    NOT NULL DEFAULT 1 AFTER max_discount,
  ADD COLUMN IF NOT EXISTS updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- ############################################
-- # FILE: 028_create_promo_usage_log.sql
-- ############################################
-- Migration 024: Create promo_usage_log table
-- Tracks every time a promo code is used: who used it, when, and on which order

CREATE TABLE IF NOT EXISTS promo_usage_log (
  id            CHAR(36)      NOT NULL PRIMARY KEY,
  promo_code_id CHAR(36)      NOT NULL,
  order_id      CHAR(36)      NOT NULL,
  user_id       CHAR(36)      DEFAULT NULL,
  customer_name VARCHAR(120)  DEFAULT NULL,
  customer_email VARCHAR(120) DEFAULT NULL,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  order_subtotal  DECIMAL(15,2) NOT NULL DEFAULT 0,
  used_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pul_promo_code_id (promo_code_id),
  INDEX idx_pul_used_at       (used_at),
  INDEX idx_pul_user_id       (user_id),
  CONSTRAINT fk_pul_promo FOREIGN KEY (promo_code_id)
    REFERENCES promo_codes(id) ON DELETE CASCADE,
  CONSTRAINT fk_pul_order FOREIGN KEY (order_id)
    REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 029_create_notification_preferences.sql
-- ############################################
-- Migration 025: Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id              CHAR(36) NOT NULL PRIMARY KEY,
  payment_accepted     TINYINT(1) NOT NULL DEFAULT 1,
  order_shipped        TINYINT(1) NOT NULL DEFAULT 1,
  order_finished       TINYINT(1) NOT NULL DEFAULT 1,
  order_cancelled      TINYINT(1) NOT NULL DEFAULT 1,
  promo_news           TINYINT(1) NOT NULL DEFAULT 0,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_pref_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 030_add_hidden_by_admin_to_conversations.sql
-- ############################################
-- Migration 030: Add hidden_by_admin flag to conversations
-- Allows admin to "close" (hide) a chat from the list without deleting messages.
-- The conversation and all its history remain accessible via search.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS hidden_by_admin TINYINT(1) NOT NULL DEFAULT 0
    AFTER last_at;

-- ############################################
-- # FILE: 031_expand_image_path_to_text.sql
-- ############################################
-- Migration 031: Expand image_path from VARCHAR(500) to TEXT
-- Reason: image_path stores a JSON array of up to 8 URLs.
-- 8 URLs × ~60 chars each = ~480 chars minimum, but with longer UUIDs
-- and full paths the JSON string can easily exceed 500 chars, causing
-- truncation and only the first image being recoverable.
ALTER TABLE products
  MODIFY COLUMN image_path TEXT DEFAULT NULL;

-- ############################################
-- # FILE: 032_create_homepage_content.sql
-- ############################################
-- ============================================================
-- 032_create_homepage_content.sql
-- Tables for dynamic homepage content management:
--   1. homepage_hero         — Landing page banner
--   2. homepage_design_items — Design showcase (gallery, max 4)
--   3. homepage_cat_banners  — Category banner per product section
-- ============================================================

-- ── 1. Hero / Landing Page Banner ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS homepage_hero (
  id          CHAR(36)      NOT NULL PRIMARY KEY,
  title       VARCHAR(255)  DEFAULT NULL,
  subtitle    VARCHAR(500)  DEFAULT NULL,
  image_path  TEXT          DEFAULT NULL,
  cta_url     VARCHAR(500)  DEFAULT NULL,
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed a default row so the frontend always has something to fetch
INSERT IGNORE INTO homepage_hero (id, title, subtitle, image_path, cta_url, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', NULL, NULL, NULL, NULL, 1);

-- ── 2. Design Showcase Items (replaces category quick-links grid) ─────────────
CREATE TABLE IF NOT EXISTS homepage_design_items (
  id          CHAR(36)      NOT NULL PRIMARY KEY,
  title       VARCHAR(255)  DEFAULT NULL,
  image_path  TEXT          NOT NULL,
  link_url    VARCHAR(500)  DEFAULT NULL,
  sort_order  INT           NOT NULL DEFAULT 0,
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3. Category Section Banners ───────────────────────────────────────────────
-- One row per product-category section (keyed by category_id or a slug).
-- When a category section is rendered, it looks up its banner here.
CREATE TABLE IF NOT EXISTS homepage_cat_banners (
  id           CHAR(36)      NOT NULL PRIMARY KEY,
  category_id  CHAR(36)      DEFAULT NULL,   -- NULL = "Produk" (uncategorised)
  title        VARCHAR(255)  DEFAULT NULL,
  image_path   TEXT          DEFAULT NULL,
  link_url     VARCHAR(500)  DEFAULT NULL,
  cta_text     VARCHAR(100)  DEFAULT 'Lihat Semua →',
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hcb_category FOREIGN KEY (category_id)
    REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 033_hero_multi_banner.sql
-- ############################################
-- ============================================================
-- 033_hero_multi_banner.sql
-- Converts homepage_hero from a single-row table to a
-- multi-row carousel table (up to 8 slides).
-- ============================================================

-- 1. Add sort_order column if it doesn't exist yet
ALTER TABLE homepage_hero
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- 2. Update the seeded default row to have explicit sort_order = 0
UPDATE homepage_hero
SET sort_order = 0
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Note: is_active per-slide allows hiding individual slides without deletion.
-- The LIMIT 1 in getHero() is now replaced by listHeroBanners()
-- which returns all active rows ordered by sort_order ASC.

-- ############################################
-- # FILE: 034_add_financials_to_orders.sql
-- ############################################
-- ============================================================
-- 034_add_financials_to_orders.sql
-- Adds financial tracking columns to the orders table.
-- shipping_cost  — what the customer paid for delivery
-- tax_amount     — any tax applied to the order
-- refund_amount  — amount refunded (partial or full)
-- payment_method — e.g. "Transfer Bank", "QRIS", "COD"
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_cost  DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount     DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_amount  DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)   DEFAULT NULL;

-- ############################################
-- # FILE: 035_add_photos_to_reviews.sql
-- ############################################
-- Add photo_url column to reviews for customer review photo uploads
ALTER TABLE reviews
  ADD COLUMN photo_url TEXT DEFAULT NULL
  COMMENT 'Optional photo uploaded by customer with their review';

-- ############################################
-- # FILE: 036_create_revenue_reset_log.sql
-- ############################################
-- 036_create_revenue_reset_log.sql
-- Audit table: records every time an owner performs a revenue data reset.
-- This is the only permanent record of the action after the data is gone.

CREATE TABLE IF NOT EXISTS revenue_reset_log (
  id           CHAR(36)     NOT NULL PRIMARY KEY,
  performed_by CHAR(36)     DEFAULT NULL COMMENT 'user.id of the owner who triggered the reset',
  performed_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  orders_deleted   INT      NOT NULL DEFAULT 0  COMMENT 'number of order rows removed',
  visits_deleted   INT      NOT NULL DEFAULT 0  COMMENT 'number of analytics_visits rows removed',
  views_deleted    INT      NOT NULL DEFAULT 0  COMMENT 'number of analytics_product_views rows removed',
  note         TEXT         DEFAULT NULL        COMMENT 'optional reason entered by owner',
  CONSTRAINT fk_reset_actor FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 037_add_email_verification_and_password_reset.sql
-- ############################################
-- Migration 037: Add email verification and password reset fields to users table
-- Adds 5 new columns (all nullable, backward-compatible with existing rows)

ALTER TABLE users
  ADD COLUMN is_email_verified        TINYINT(1)   NOT NULL DEFAULT 0        AFTER email,
  ADD COLUMN email_verification_token VARCHAR(255) DEFAULT NULL               AFTER is_email_verified,
  ADD COLUMN email_verification_expires DATETIME   DEFAULT NULL               AFTER email_verification_token,
  ADD COLUMN reset_password_token     VARCHAR(255) DEFAULT NULL               AFTER email_verification_expires,
  ADD COLUMN reset_password_expires   DATETIME     DEFAULT NULL               AFTER reset_password_token;

-- Index for fast token lookups (token columns are hashed so VARCHAR(255) is fine)
CREATE INDEX idx_users_verification_token ON users (email_verification_token(191));
CREATE INDEX idx_users_reset_token        ON users (reset_password_token(191));

-- ############################################
-- # FILE: 038_create_order_approvals.sql
-- ############################################
-- ============================================================
-- 038_create_order_approvals.sql
-- Fitur 1: Tabel approval per tahap order supaya status bisa di-lock
-- setelah di-ACC oleh admin yang berwenang.
-- ============================================================

CREATE TABLE IF NOT EXISTS order_approvals (
  id            CHAR(36)      NOT NULL PRIMARY KEY,
  order_id      CHAR(36)      NOT NULL,
  stage         VARCHAR(60)   NOT NULL COMMENT 'Status yang di-approve, e.g. Payment Accepted',
  approved_by   CHAR(36)      NOT NULL COMMENT 'user_id yang meng-approve',
  approved_role VARCHAR(40)   NOT NULL COMMENT 'role saat approve, e.g. cashier',
  approved_name VARCHAR(120)  NOT NULL DEFAULT '' COMMENT 'Nama admin snapshot saat approve',
  approved_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_order_stage (order_id, stage),
  CONSTRAINT fk_approval_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_approval_user  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 039_add_delivery_method_to_orders.sql
-- ############################################
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

-- ############################################
-- # FILE: 040_create_invoices.sql
-- ############################################
-- ============================================================
-- 040_create_invoices.sql
-- Fitur 2: Tabel invoices untuk cashier
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  id              CHAR(36)      NOT NULL PRIMARY KEY,
  invoice_number  VARCHAR(50)   NOT NULL UNIQUE
                  COMMENT 'Format: INV/YYYY/MM/NNNNNN',
  order_id        CHAR(36)      NOT NULL,
  customer_id     CHAR(36)      DEFAULT NULL,
  subtotal        DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount      DECIMAL(15,2) NOT NULL DEFAULT 0,
  total           DECIMAL(15,2) NOT NULL DEFAULT 0,
  payment_status  ENUM('unpaid','paid','partial') NOT NULL DEFAULT 'unpaid',
  payment_method  VARCHAR(60)   DEFAULT NULL,
  notes           TEXT          DEFAULT NULL,
  created_by      CHAR(36)      DEFAULT NULL COMMENT 'cashier user_id (null for auto-generated)',
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at         DATETIME      DEFAULT NULL,
  pdf_path        VARCHAR(500)  DEFAULT NULL COMMENT 'Path ke file PDF jika disimpan',
  locked          TINYINT(1)    NOT NULL DEFAULT 0
                  COMMENT '1 = invoice sudah paid & locked, tidak bisa diedit',
  CONSTRAINT fk_invoice_order    FOREIGN KEY (order_id)    REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sequence untuk nomor invoice
CREATE TABLE IF NOT EXISTS invoice_sequence (
  id       INT  NOT NULL PRIMARY KEY DEFAULT 1,
  last_seq INT  NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO invoice_sequence (id, last_seq) VALUES (1, 0);

-- ############################################
-- # FILE: 041_expand_notification_preferences.sql
-- ############################################
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

-- ############################################
-- # FILE: 042_create_manual_revenue_transactions.sql
-- ############################################
-- ============================================================
-- 042_create_manual_revenue_transactions.sql
-- Fitur: Rekap Data Harian — tabel untuk transaksi pendapatan manual
-- ============================================================

CREATE TABLE IF NOT EXISTS manual_revenue_transactions (
  id               CHAR(36)        NOT NULL,
  transaction_date DATE            NOT NULL,
  source_category  ENUM(
    'offline_store',
    'shopee',
    'tokopedia',
    'tiktok_shop'
  )                                NOT NULL,
  amount           DECIMAL(15, 2)  NOT NULL,
  notes            TEXT            DEFAULT NULL,
  created_by       CHAR(36)        NOT NULL,
  updated_by       CHAR(36)        DEFAULT NULL,
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,
  deleted_at       DATETIME        DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX idx_mrt_date_category (transaction_date, source_category),
  CONSTRAINT fk_mrt_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_mrt_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 043_fix_invoices_created_by_nullable.sql
-- ############################################
-- ============================================================
-- 043_fix_invoices_created_by_nullable.sql
-- Fix: autoCreateInvoice gagal karena created_by NOT NULL
-- tapi function mengisi null (auto-generated, no creator).
-- ============================================================

-- 1. Drop foreign key constraint
SET @fk_name = (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'created_by'
    AND REFERENCED_TABLE_NAME = 'users'
  LIMIT 1
);
SET @sql = IF(@fk_name IS NOT NULL, CONCAT('ALTER TABLE invoices DROP FOREIGN KEY `', @fk_name, '`'), 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Make created_by nullable
ALTER TABLE invoices MODIFY COLUMN created_by CHAR(36) DEFAULT NULL COMMENT 'cashier user_id (null for auto-generated)';

-- ############################################
-- # FILE: 044_add_customer_email_to_orders.sql
-- ############################################
-- Add customer_email column to orders table for offline order email support
ALTER TABLE orders ADD COLUMN customer_email VARCHAR(255) NULL AFTER customer_address;

-- ############################################
-- # FILE: 045_create_user_permissions.sql
-- ############################################
-- Migration 045: Create user_permissions table for granular access control.
-- Many-to-many: each row grants one permission key to one user.

CREATE TABLE IF NOT EXISTS user_permissions (
  id              INT          AUTO_INCREMENT PRIMARY KEY,
  user_id         CHAR(36)     NOT NULL,
  permission_key  VARCHAR(50)  NOT NULL,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_permission (user_id, permission_key),
  CONSTRAINT fk_userperm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ############################################
-- # FILE: 046_add_customer_broker_pricing.sql
-- ############################################
-- ============================================================
-- 046_add_customer_broker_pricing.sql
-- Fitur harga Customer vs Broker:
--   1. products.price          → rename menjadi price_customer
--   2. products.price_broker   → harga untuk broker (diisi = harga customer dulu)
--   3. orders.customer_type    → ENUM('customer','broker') — dari dropdown cashier
--
-- NOTE:
--   - order_items.product_id & order_items.notes (keterangan) SUDAH ada sejak
--     migrasi 005 — tidak perlu diubah di sini.
--   - order_items.price dipakai sebagai snapshot harga satuan (unit price)
--     sesuai customer_type saat order dibuat (tidak live-reference).
-- ============================================================

-- ── UP ────────────────────────────────────────────────────────

-- 1. Rename kolom harga lama menjadi harga customer (data lama dipertahankan).
--    Idempotent: hanya berjalan jika kolom `price` masih ada (migrasi ini bisa
--    dijalankan berulang kali oleh migrate.js).
SET @has_old_price := (SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'price');

SET @rename_sql := IF(@has_old_price > 0,
  'ALTER TABLE products CHANGE COLUMN price price_customer DECIMAL(15,2) NOT NULL DEFAULT 0',
  'DO 0');

PREPARE rename_stmt FROM @rename_sql;
EXECUTE rename_stmt;
DEALLOCATE PREPARE rename_stmt;

-- 2. Tambah harga broker — default dulu sama dengan harga customer.
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_broker DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER price_customer;

-- 3. Isi harga broker dari harga customer untuk produk yang belum pernah diisi.
UPDATE products SET price_broker = price_customer WHERE price_broker <= 0;

-- 4. Tipe pembeli per order offline (customer / broker).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_type ENUM('customer','broker') NOT NULL DEFAULT 'customer' AFTER customer_name;

-- ── DOWN (rollback manual) ────────────────────────────────────
-- ALTER TABLE orders DROP COLUMN IF EXISTS customer_type;
-- ALTER TABLE products DROP COLUMN IF EXISTS price_broker;
-- ALTER TABLE products CHANGE COLUMN price_customer price DECIMAL(15,2) NOT NULL DEFAULT 0;

-- ############################################
-- # FILE: 047_add_product_size_type_and_visibility.sql
-- ############################################
-- ============================================================
-- 047_add_product_size_type_and_visibility.sql
-- Fitur tipe ukuran produk & visibilitas produk:
--   1. products.size_type               → ENUM('fixed','per_m2')
--      - 'fixed'  : ukuran memakai size table (sizes + variant_prices)
--      - 'per_m2' : ukuran dihitung panjang x lebar saat order
--                   (size table tidak dipakai)
--   2. products.is_hidden_from_customer → TINYINT(1)
--      - 1: produk disembunyikan dari halaman customer (homepage/product page),
--           tetap tampil di kasir/admin
--      - 0 (default): tampil normal di semua tempat
-- ============================================================

-- ── UP ────────────────────────────────────────────────────────

ALTER TABLE products ADD COLUMN IF NOT EXISTS size_type ENUM('fixed','per_m2') NOT NULL DEFAULT 'fixed' AFTER materials;

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_hidden_from_customer TINYINT(1) NOT NULL DEFAULT 0 AFTER size_type;

-- ── DOWN (rollback manual) ────────────────────────────────────
-- ALTER TABLE products DROP COLUMN IF EXISTS is_hidden_from_customer;
-- ALTER TABLE products DROP COLUMN IF EXISTS size_type;

-- ############################################
-- # FILE: 048_add_order_item_dimensions.sql
-- ############################################
-- 048_add_order_item_dimensions.sql
-- Produk per m²: cashier memasukkan panjang × lebar saat order offline.
-- Simpan dimensi mentah (cm) agar harga bisa di-resolve ulang di server dan
-- ditampilkan di resi/invoice. `order_items.size` menyimpan teks "P × L cm".
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS length_cm DECIMAL(10,2) NULL AFTER material;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS width_cm  DECIMAL(10,2) NULL AFTER length_cm;

-- DOWN:
-- ALTER TABLE order_items DROP COLUMN width_cm;
-- ALTER TABLE order_items DROP COLUMN length_cm;

-- ############################################
-- # FILE: 049_create_features_and_admin_permissions.sql
-- ############################################
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

-- ############################################
-- # FILE: 050_remove_product_variant_attributes.sql
-- ############################################
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

-- ############################################
-- # FILE: 051_add_dynamic_product_attributes.sql
-- ############################################
-- ============================================================
-- 051_add_dynamic_product_attributes.sql
-- Fitur atribut produk dinamis (pengganti warna/ukuran/bahan):
--   Nama atribut bebas ditentukan admin per produk — mis. "Warna",
--   "Tipe Laminasi", "Tipe Kertas", "Jenis Bahan", dst.
--   Format JSON: [{"name":"Tipe Laminasi","values":["Glossy","Doff"]}, ...]
--
--   1. products.attributes     → daftar definisi atribut + pilihan nilai
--   2. cart_items.attributes   → pilihan atribut saat menambah ke keranjang
--                                [{"name":"Tipe Laminasi","value":"Glossy"}, ...]
--   3. order_items.attributes  → snapshot pilihan atribut pada pesanan
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS attributes JSON NULL AFTER short_description;

ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS attributes JSON NULL AFTER quantity;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS attributes JSON NULL AFTER quantity;

-- ── DOWN (rollback manual) ────────────────────────────────────
-- ALTER TABLE products    DROP COLUMN IF EXISTS attributes;
-- ALTER TABLE cart_items  DROP COLUMN IF EXISTS attributes;
-- ALTER TABLE order_items DROP COLUMN IF EXISTS attributes;
