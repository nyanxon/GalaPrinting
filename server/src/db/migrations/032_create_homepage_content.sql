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
VALUES ('00000000-0000-0000-0000-000000000001', 'LANDING PAGE', '4+ PAGE', NULL, NULL, 1);

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
