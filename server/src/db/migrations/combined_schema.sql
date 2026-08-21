-- ============================================================================
-- combined_schema.sql — Gala Printing, skema final gabungan (fresh install)
-- ============================================================================
-- Digenerate dari server/src/db/migrations/001..051 (state final per 2026-08-21).
--
-- PENTING:
--   1. File ini HANYA untuk fresh install / rebuild database dari nol.
--      JANGAN dijalankan oleh migrate.js — migrate.js otomatis menjalankan
--      SEMUA file .sql di folder ini urut abjad, dan "combined_schema.sql"
--      akan tereksekusi TERAKHIR (setelah 051_) sehingga error karena tabel
--      sudah ada. Jalankan manual, mis:
--        mysql -u <user> -p <db_name> < combined_schema.sql
--   2. Statement yang saling meniadakan (CREATE lalu DROP kolom/tabel dari
--      migration eksperimen yang sudah dibatalkan) sudah DILEBUR menjadi
--      bentuk finalnya. Komentar section tetap dipertahankan agar bisa
--      ditelusuri asal tiap bagian.
--   3. Tidak ada file migration individual yang diubah.
--
-- Riwayat nomor 051: tidak pernah ada konflik di repo. "051_drop_cart_items.sql"
-- (peninggalan pivot ke portfolio yang di-rollback) TIDAK PERNAH ter-commit —
-- tidak ada di working tree maupun git history. Satu-satunya 051 valid adalah
-- 051_add_dynamic_product_attributes.sql. Tabel cart_items TETAP ADA.
-- ============================================================================

SET NAMES utf8mb4;

-- === 001_create_users.sql ===
-- (+ kolom dari 014_add_gender_dob_to_users, 023_add_avatar_url_to_users,
--    037_add_email_verification_and_password_reset,
--    049_create_features_and_admin_permissions [is_promoted_admin] — digabung)
CREATE TABLE IF NOT EXISTS users (
  id                        CHAR(36)     NOT NULL PRIMARY KEY,
  role                      ENUM('customer','admin','owner','cashier','cs','operational','qc','offline')
                            NOT NULL DEFAULT 'customer',
  name                      VARCHAR(120) NOT NULL,
  email                     VARCHAR(191) NOT NULL UNIQUE,
  is_email_verified         TINYINT(1)   NOT NULL DEFAULT 0,
  email_verification_token  VARCHAR(255) DEFAULT NULL,
  email_verification_expires DATETIME    DEFAULT NULL,
  reset_password_token      VARCHAR(255) DEFAULT NULL,
  reset_password_expires    DATETIME     DEFAULT NULL,
  phone                     VARCHAR(30),
  gender                    ENUM('L','P') DEFAULT NULL,
  dob                       DATE          DEFAULT NULL,
  password_hash             VARCHAR(255) NOT NULL,
  deleted_at                DATETIME     DEFAULT NULL,
  created_at                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  avatar_url                VARCHAR(500) DEFAULT NULL,
  is_promoted_admin         TINYINT(1)   NOT NULL DEFAULT 0
                            COMMENT '1 = diangkat Owner jadi admin dengan permission dinamis',
  INDEX idx_users_verification_token (email_verification_token(191)),
  INDEX idx_users_reset_token        (reset_password_token(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === 002_create_categories.sql ===
CREATE TABLE IF NOT EXISTS categories (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === 003_create_products.sql ===
-- State final setelah: 017 (variant_prices — lalu dihapus 050),
-- 031 (image_path VARCHAR->TEXT), 046 (price -> price_customer + price_broker),
-- 047 (size_type, is_hidden_from_customer), 050 (DROP colors/sizes/materials/
-- variant_prices; size_type jadi ENUM('per_m2','none')), 051 (+ attributes JSON).
CREATE TABLE IF NOT EXISTS products (
  id                     CHAR(36)       NOT NULL PRIMARY KEY,
  category_id            CHAR(36)       DEFAULT NULL,
  name                   VARCHAR(191)   NOT NULL,
  slug                   VARCHAR(191)   NOT NULL UNIQUE,
  price_customer         DECIMAL(15,2)  NOT NULL DEFAULT 0,
  price_broker           DECIMAL(15,2)  NOT NULL DEFAULT 0,
  short_description      VARCHAR(500),
  requires_design        TINYINT(1)     NOT NULL DEFAULT 0,
  attributes             JSON           DEFAULT NULL
                         COMMENT '[{"name":"...","values":["..."]}] atribut dinamis',
  image_path             TEXT           DEFAULT NULL,
  size_type              ENUM('per_m2','none') NOT NULL DEFAULT 'none',
  is_hidden_from_customer TINYINT(1)    NOT NULL DEFAULT 0,
  created_at             DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_category FOREIGN KEY (category_id)
    REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === 004_create_orders.sql ===
-- (+ 016 CHECK status; 019 promo_code/discount_amount; 020 cancellation_reason;
--    025 customer_address_title; 034 financials; 039 delivery_method;
--    044 customer_email; 046 customer_type — semua digabung)
CREATE TABLE IF NOT EXISTS orders (
  id                     CHAR(36)      NOT NULL PRIMARY KEY,
  order_number           VARCHAR(50)   NOT NULL UNIQUE,
  order_type             ENUM('standard','custom') NOT NULL DEFAULT 'standard',
  source                 ENUM('online','offline','custom') NOT NULL DEFAULT 'online',
  customer_id            CHAR(36)      DEFAULT NULL,
  customer_name          VARCHAR(120),
  customer_type          ENUM('customer','broker') NOT NULL DEFAULT 'customer',
  customer_phone         VARCHAR(30),
  customer_address       TEXT,
  customer_email         VARCHAR(255)  DEFAULT NULL,
  customer_address_title VARCHAR(100)  DEFAULT NULL,
  status                 VARCHAR(60)   NOT NULL DEFAULT 'Waiting for Payment',
  subtotal               DECIMAL(15,2) NOT NULL DEFAULT 0,
  promo_code             VARCHAR(50)   DEFAULT NULL,
  discount_amount        DECIMAL(15,2) NOT NULL DEFAULT 0,
  admin_note             TEXT,
  cancellation_reason    TEXT          DEFAULT NULL,
  tracking_number        VARCHAR(100),
  courier_name           VARCHAR(100),
  payment_proof_path     VARCHAR(500),
  created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  shipping_cost          DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount             DECIMAL(15,2) NOT NULL DEFAULT 0,
  refund_amount          DECIMAL(15,2) NOT NULL DEFAULT 0,
  payment_method         VARCHAR(50)   DEFAULT NULL,
  delivery_method        ENUM('delivery','pickup_factory','pickup_store')
                         NOT NULL DEFAULT 'delivery',
  pickup_location        VARCHAR(191)  DEFAULT NULL
                         COMMENT 'Lokasi pengambilan (untuk pickup)',
  pickup_ready_at        DATETIME      DEFAULT NULL
                         COMMENT 'Jadwal siap diambil customer',
  CONSTRAINT fk_order_customer FOREIGN KEY (customer_id)
    REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_orders_status CHECK (
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
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === 005_create_order_items.sql ===
-- (+ 048 length_cm/width_cm; 050 DROP color/size/material;
--    051 + attributes JSON — digabung)
CREATE TABLE IF NOT EXISTS order_items (
  id               CHAR(36)      NOT NULL PRIMARY KEY,
  order_id         CHAR(36)      NOT NULL,
  product_id       CHAR(36)      DEFAULT NULL,
  name             VARCHAR(191)  NOT NULL,
  price            DECIMAL(15,2) NOT NULL COMMENT 'Snapshot harga satuan',
  quantity         INT           NOT NULL DEFAULT 1,
  attributes       JSON          DEFAULT NULL
                   COMMENT '[{"name":"...","value":"..."}] snapshot atribut',
  length_cm        DECIMAL(10,2) DEFAULT NULL,
  width_cm         DECIMAL(10,2) DEFAULT NULL,
  notes            TEXT,
  design_file_path VARCHAR(500),
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_item_order   FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === 006_create_order_history.sql ===
-- (+ 021 cancellation_reason — digabung)
CREATE TABLE IF NOT EXISTS order_history (
  id                  CHAR(36)    NOT NULL PRIMARY KEY,
  order_id            CHAR(36)    NOT NULL,
  from_status         VARCHAR(60),
  to_status           VARCHAR(60) NOT NULL,
  actor_id            CHAR(36)    DEFAULT NULL,
  created_at          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancellation_reason TEXT        DEFAULT NULL,
  CONSTRAINT fk_history_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_history_actor FOREIGN KEY (actor_id) REFERENCES users(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === 007_create_cart_items.sql ===
-- (+ 050 DROP color/size/material; 051 + attributes JSON — digabung.
--  Tabel ini TETAP ADA; drop-table-nya hanya ada di migration pivot 051 yang
--  tidak pernah ter-commit dan sudah dibatalkan.)
CREATE TABLE IF NOT EXISTS cart_items (
  id               CHAR(36)      NOT NULL PRIMARY KEY,
  user_id          CHAR(36)      NOT NULL,
  product_id       CHAR(36)      DEFAULT NULL,
  name             VARCHAR(191)  NOT NULL,
  price            DECIMAL(15,2) NOT NULL,
  quantity         INT           NOT NULL DEFAULT 1,
  attributes       JSON          DEFAULT NULL
                   COMMENT '[{"name":"...","value":"..."}] pilihan atribut',
  notes            TEXT,
  design_file_path VARCHAR(500),
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_cart_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === 008_create_conversations.sql ===
-- (+ 022 customer_id nullable + conversation_type + dm_participant_a/b +
--    uq_dm_participants; 030 hidden_by_admin — digabung)
CREATE TABLE IF NOT EXISTS conversations (
  id                CHAR(36)     NOT NULL PRIMARY KEY,
  customer_id       CHAR(36)     NULL,
  customer_name     VARCHAR(120) NOT NULL,
  assigned_admin_id CHAR(36)     DEFAULT NULL,
  conversation_type ENUM('customer_chat','staff_dm') NOT NULL DEFAULT 'customer_chat',
  dm_participant_a  CHAR(36)     NULL,
  dm_participant_b  CHAR(36)     NULL,
  last_at           DATETIME     DEFAULT NULL,
  hidden_by_admin   TINYINT(1)   NOT NULL DEFAULT 0,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX uq_dm_participants (dm_participant_a, dm_participant_b),
  CONSTRAINT fk_conv_customer FOREIGN KEY (customer_id)       REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_conv_admin    FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === 009_create_messages.sql ===
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

-- === 010_create_reviews.sql ===
-- (+ 026 order_id/order_item_id + uq_review_customer_order_item;
--    035 photo_url — digabung)
CREATE TABLE IF NOT EXISTS reviews (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  product_id    CHAR(36)     DEFAULT NULL,
  order_id      CHAR(36)     DEFAULT NULL,
  order_item_id CHAR(36)     DEFAULT NULL,
  customer_id   CHAR(36)     NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  rating        TINYINT      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  photo_url     TEXT         DEFAULT NULL
                COMMENT 'Optional photo uploaded by customer with their review',
  UNIQUE KEY uq_review_customer_order_item (customer_id, order_item_id),
  CONSTRAINT fk_review_product  FOREIGN KEY (product_id)  REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_review_customer FOREIGN KEY (customer_id) REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === 011_create_analytics_visits.sql ===
CREATE TABLE IF NOT EXISTS analytics_visits (
  id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  visit_date DATE   NOT NULL UNIQUE,
  count      INT    NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === 012_create_analytics_product_views.sql ===
CREATE TABLE IF NOT EXISTS analytics_product_views (
  id         BIGINT   NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  view_date  DATE     NOT NULL,
  count      INT      NOT NULL DEFAULT 0,
  UNIQUE KEY uq_product_date (product_id, view_date),
  CONSTRAINT fk_view_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === 013_create_refresh_tokens.sql ===
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

-- === 014_add_gender_dob_to_users.sql ===
-- Digabung ke CREATE TABLE users (section 001).

-- === 015_create_order_sequence.sql ===
CREATE TABLE IF NOT EXISTS order_sequence (
  id          INT          NOT NULL DEFAULT 1 PRIMARY KEY,
  last_seq    INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO order_sequence (id, last_seq) VALUES (1, 0);

-- === 016_add_status_check_constraint.sql ===
-- Digabung sebagai CONSTRAINT chk_orders_status di CREATE TABLE orders (section 004).

-- === 017_add_variant_prices_to_products.sql ===
-- Digabung lalu DINIHKAN: variant_prices ditambahkan di sini dulu, kemudian
-- di-DROP lagi oleh 050_remove_product_variant_attributes. Tidak ada di skema final.

-- === 018_create_promo_codes.sql ===
-- (+ 027_enhance_promo_codes — digabung)
CREATE TABLE IF NOT EXISTS promo_codes (
  id           CHAR(36)      NOT NULL PRIMARY KEY,
  code         VARCHAR(50)   NOT NULL UNIQUE,
  description  VARCHAR(255)  DEFAULT NULL,
  type         ENUM('percentage','fixed') NOT NULL DEFAULT 'percentage',
  value        DECIMAL(10,2) NOT NULL,
  max_uses     INT           DEFAULT NULL,
  daily_limit  INT           DEFAULT NULL,
  min_purchase DECIMAL(15,2) NOT NULL DEFAULT 0,
  max_discount DECIMAL(15,2) DEFAULT NULL,
  is_active    TINYINT(1)    NOT NULL DEFAULT 1,
  usage_count  INT           NOT NULL DEFAULT 0,
  expires_at   DATETIME      DEFAULT NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === 019_add_promo_to_orders.sql ===
-- Digabung ke CREATE TABLE orders (section 004).

-- === 020_add_cancellation_reason_to_orders.sql ===
-- Digabung ke CREATE TABLE orders (section 004).

-- === 021_add_cancellation_reason_to_order_history.sql ===
-- Digabung ke CREATE TABLE order_history (section 006).

-- === 022_enhance_conversations_for_dm.sql ===
-- Digabung ke CREATE TABLE conversations (section 008).

-- === 023_add_avatar_url_to_users.sql ===
-- Digabung ke CREATE TABLE users (section 001).

-- === 024_create_addresses.sql ===
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

-- === 025_add_address_title_to_orders.sql ===
-- Digabung ke CREATE TABLE orders (section 004).

-- === 026_add_order_ref_to_reviews.sql ===
-- Digabung ke CREATE TABLE reviews (section 010).

-- === 027_enhance_promo_codes.sql ===
-- Digabung ke CREATE TABLE promo_codes (section 018).

-- === 028_create_promo_usage_log.sql ===
CREATE TABLE IF NOT EXISTS promo_usage_log (
  id              CHAR(36)      NOT NULL PRIMARY KEY,
  promo_code_id   CHAR(36)      NOT NULL,
  order_id        CHAR(36)      NOT NULL,
  user_id         CHAR(36)      DEFAULT NULL,
  customer_name   VARCHAR(120)  DEFAULT NULL,
  customer_email  VARCHAR(120)  DEFAULT NULL,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  order_subtotal  DECIMAL(15,2) NOT NULL DEFAULT 0,
  used_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pul_promo_code_id (promo_code_id),
  INDEX idx_pul_used_at       (used_at),
  INDEX idx_pul_user_id       (user_id),
  CONSTRAINT fk_pul_promo FOREIGN KEY (promo_code_id)
    REFERENCES promo_codes(id) ON DELETE CASCADE,
  CONSTRAINT fk_pul_order FOREIGN KEY (order_id)
    REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === 029_create_notification_preferences.sql ===
-- (+ 041_expand_notification_preferences — digabung)
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id              CHAR(36) NOT NULL PRIMARY KEY,
  payment_accepted     TINYINT(1) NOT NULL DEFAULT 1,
  order_shipped        TINYINT(1) NOT NULL DEFAULT 1,
  order_finished       TINYINT(1) NOT NULL DEFAULT 1,
  order_cancelled      TINYINT(1) NOT NULL DEFAULT 1,
  promo_news           TINYINT(1) NOT NULL DEFAULT 0,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  order_received       TINYINT(1) NOT NULL DEFAULT 1
                       COMMENT 'Notifikasi saat pesanan baru diterima',
  mockup_accepted      TINYINT(1) NOT NULL DEFAULT 1
                       COMMENT 'Notifikasi saat mockup / desain diterima',
  login_new_device     TINYINT(1) NOT NULL DEFAULT 1
                       COMMENT 'Notifikasi login dari device baru',
  login_failed_alert   TINYINT(1) NOT NULL DEFAULT 1
                       COMMENT 'Alert percobaan login gagal berkali-kali',
  CONSTRAINT fk_notif_pref_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === 030_add_hidden_by_admin_to_conversations.sql ===
-- Digabung ke CREATE TABLE conversations (section 008).

-- === 031_expand_image_path_to_text.sql ===
-- Digabung: products.image_path langsung dibuat TEXT (section 003).

-- === 032_create_homepage_content.sql ===
-- (+ 033_hero_multi_banner sort_order pada homepage_hero — digabung)

-- ── 1. Hero / Landing Page Banner (multi-slide carousel) ─────────────────────
CREATE TABLE IF NOT EXISTS homepage_hero (
  id          CHAR(36)      NOT NULL PRIMARY KEY,
  title       VARCHAR(255)  DEFAULT NULL,
  subtitle    VARCHAR(500)  DEFAULT NULL,
  image_path  TEXT          DEFAULT NULL,
  cta_url     VARCHAR(500)  DEFAULT NULL,
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sort_order  INT           NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default row supaya frontend selalu punya yang bisa di-fetch
INSERT IGNORE INTO homepage_hero (id, title, subtitle, image_path, cta_url, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', NULL, NULL, NULL, NULL, 1);

-- ── 2. Design Showcase Items ─────────────────────────────────────────────────
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

-- ── 3. Category Section Banners ──────────────────────────────────────────────
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

-- === 033_hero_multi_banner.sql ===
-- Digabung ke CREATE TABLE homepage_hero (section 032). UPDATE seed tidak
-- diperlukan untuk fresh install (sort_order default sudah 0).

-- === 034_add_financials_to_orders.sql ===
-- Digabung ke CREATE TABLE orders (section 004).

-- === 035_add_photos_to_reviews.sql ===
-- Digabung ke CREATE TABLE reviews (section 010).

-- === 036_create_revenue_reset_log.sql ===
CREATE TABLE IF NOT EXISTS revenue_reset_log (
  id             CHAR(36)     NOT NULL PRIMARY KEY,
  performed_by   CHAR(36)     DEFAULT NULL COMMENT 'user.id of the owner who triggered the reset',
  performed_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  orders_deleted INT          NOT NULL DEFAULT 0  COMMENT 'number of order rows removed',
  visits_deleted INT          NOT NULL DEFAULT 0  COMMENT 'number of analytics_visits rows removed',
  views_deleted  INT          NOT NULL DEFAULT 0  COMMENT 'number of analytics_product_views rows removed',
  note           TEXT         DEFAULT NULL        COMMENT 'optional reason entered by owner',
  CONSTRAINT fk_reset_actor FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === 037_add_email_verification_and_password_reset.sql ===
-- Digabung ke CREATE TABLE users (section 001), termasuk index prefix token.

-- === 038_create_order_approvals.sql ===
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

-- === 039_add_delivery_method_to_orders.sql ===
-- Digabung ke CREATE TABLE orders (section 004).

-- === 040_create_invoices.sql ===
-- (+ 043_fix_invoices_created_by_nullable — created_by nullable & tanpa FK
--    ke users, sesuai state final; invoice_sequence + seed)
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
  id       INT  NOT NULL DEFAULT 1 PRIMARY KEY,
  last_seq INT  NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO invoice_sequence (id, last_seq) VALUES (1, 0);

-- === 041_expand_notification_preferences.sql ===
-- Digabung ke CREATE TABLE notification_preferences (section 029).

-- === 042_create_manual_revenue_transactions.sql ===
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

-- === 043_fix_invoices_created_by_nullable.sql ===
-- Digabung: invoices.created_by sudah nullable dan tanpa FK sejak awal
-- (section 040). Blok dynamic-SQL drop-FK tidak diperlukan di fresh install.

-- === 044_add_customer_email_to_orders.sql ===
-- Digabung ke CREATE TABLE orders (section 004).

-- === 045_create_user_permissions.sql ===
CREATE TABLE IF NOT EXISTS user_permissions (
  id              INT          AUTO_INCREMENT PRIMARY KEY,
  user_id         CHAR(36)     NOT NULL,
  permission_key  VARCHAR(50)  NOT NULL,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_permission (user_id, permission_key),
  CONSTRAINT fk_userperm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === 046_add_customer_broker_pricing.sql ===
-- Digabung: products.price -> price_customer + price_broker (section 003),
-- orders.customer_type (section 004). UPDATE backfill tidak diperlukan
-- untuk fresh install (default sudah benar).

-- === 047_add_product_size_type_and_visibility.sql ===
-- Digabung ke CREATE TABLE products (section 003); enum size_type memakai
-- bentuk final hasil penyempitan oleh 050: ENUM('per_m2','none') DEFAULT 'none'.

-- === 048_add_order_item_dimensions.sql ===
-- Digabung ke CREATE TABLE order_items (section 005).

-- === 049_create_features_and_admin_permissions.sql ===
-- (kolom users.is_promoted_admin digabung ke section 001)

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

-- === 050_remove_product_variant_attributes.sql ===
-- Sudah direfleksikan sebagai state final: kolom colors/sizes/materials/
-- variant_prices (products) dan color/size/material (cart_items, order_items)
-- TIDAK dibuat sama sekali; size_type final ENUM('per_m2','none') DEFAULT 'none'.
-- UPDATE/MODIFY/DROP dari migration ini tidak diperlukan di fresh install.

-- === 051_add_dynamic_product_attributes.sql ===
-- Digabung: products.attributes / cart_items.attributes / order_items.attributes
-- JSON (lihat section 003, 005, 007). Ini satu-satunya migration 051 yang valid;
-- "051_drop_cart_items.sql" peninggalan pivot tidak pernah ada di repo.

-- ============================ AKHIR SKEMA ===================================
-- Total: 29 tabel.
-- ============================================================================
