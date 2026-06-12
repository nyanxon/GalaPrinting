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
CREATE TABLE IF NOT EXISTS categories (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
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
CREATE TABLE IF NOT EXISTS analytics_visits (
  id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  visit_date DATE   NOT NULL UNIQUE,
  count      INT    NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS analytics_product_views (
  id         BIGINT   NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  view_date  DATE     NOT NULL,
  count      INT      NOT NULL DEFAULT 0,
  UNIQUE KEY uq_product_date (product_id, view_date),
  CONSTRAINT fk_view_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
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
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gender ENUM('L','P') DEFAULT NULL AFTER phone,
  ADD COLUMN IF NOT EXISTS dob    DATE          DEFAULT NULL AFTER gender;
CREATE TABLE IF NOT EXISTS order_sequence (
  id          INT          NOT NULL DEFAULT 1 PRIMARY KEY,
  last_seq    INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed the single row if it doesn't exist
INSERT IGNORE INTO order_sequence (id, last_seq) VALUES (1, 0);
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

ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_prices JSON DEFAULT NULL AFTER materials;
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
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS promo_code      VARCHAR(50)   DEFAULT NULL AFTER subtotal,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER promo_code;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT NULL AFTER admin_note;
ALTER TABLE order_history ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT NULL;
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

-- Migration 023: Add avatar_url column to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) DEFAULT NULL;
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
-- Migration 025: Add customer_address_title to orders table
-- Stores the address label (e.g. "Rumah", "Kantor") from the customer's saved address

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_address_title VARCHAR(100) DEFAULT NULL AFTER customer_address;
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

-- Migration 023: Enhance promo_codes table with new constraint columns
-- Adds: daily_limit, min_purchase, max_discount, description, is_active

ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS description  VARCHAR(255)  DEFAULT NULL AFTER code,
  ADD COLUMN IF NOT EXISTS daily_limit  INT           DEFAULT NULL AFTER max_uses,
  ADD COLUMN IF NOT EXISTS min_purchase DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER daily_limit,
  ADD COLUMN IF NOT EXISTS max_discount DECIMAL(15,2) DEFAULT NULL AFTER min_purchase,
  ADD COLUMN IF NOT EXISTS is_active    TINYINT(1)    NOT NULL DEFAULT 1 AFTER max_discount,
  ADD COLUMN IF NOT EXISTS updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
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
