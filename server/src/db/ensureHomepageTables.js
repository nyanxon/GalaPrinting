/**
 * ensureHomepageTables.js
 *
 * Creates the three homepage content tables if they don't exist yet.
 * Called once at server startup so production deployments that haven't
 * run `npm run migrate` still get the tables automatically.
 *
 * All statements use CREATE TABLE IF NOT EXISTS — safe to call repeatedly.
 */

import { query } from './connection.js';

export async function ensureHomepageTables() {
  try {
    // ── 1. homepage_hero ──────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS homepage_hero (
        id          CHAR(36)      NOT NULL PRIMARY KEY,
        title       VARCHAR(255)  DEFAULT NULL,
        subtitle    VARCHAR(500)  DEFAULT NULL,
        image_path  TEXT          DEFAULT NULL,
        cta_url     VARCHAR(500)  DEFAULT NULL,
        sort_order  INT           NOT NULL DEFAULT 0,
        is_active   TINYINT(1)    NOT NULL DEFAULT 1,
        updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Seed the default placeholder row (IGNORE = no-op if it already exists)
    await query(`
      INSERT IGNORE INTO homepage_hero (id, title, subtitle, image_path, cta_url, sort_order, is_active)
      VALUES ('00000000-0000-0000-0000-000000000001', 'LANDING PAGE', '4+ PAGE', NULL, NULL, 0, 0)
    `);

    // ── 2. homepage_design_items ──────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS homepage_design_items (
        id          CHAR(36)      NOT NULL PRIMARY KEY,
        title       VARCHAR(255)  DEFAULT NULL,
        image_path  TEXT          NOT NULL,
        link_url    VARCHAR(500)  DEFAULT NULL,
        sort_order  INT           NOT NULL DEFAULT 0,
        is_active   TINYINT(1)    NOT NULL DEFAULT 1,
        updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── 3. homepage_cat_banners ───────────────────────────────────────────────
    // FK on category_id — only add if categories table exists
    await query(`
      CREATE TABLE IF NOT EXISTS homepage_cat_banners (
        id           CHAR(36)      NOT NULL PRIMARY KEY,
        category_id  CHAR(36)      DEFAULT NULL,
        title        VARCHAR(255)  DEFAULT NULL,
        image_path   TEXT          DEFAULT NULL,
        link_url     VARCHAR(500)  DEFAULT NULL,
        cta_text     VARCHAR(100)  DEFAULT 'Lihat Semua \u2192',
        updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Add FK separately — IF NOT EXISTS not supported for constraints in older MySQL,
    // so we catch the duplicate-key error silently.
    try {
      await query(`
        ALTER TABLE homepage_cat_banners
          ADD CONSTRAINT fk_hcb_category
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      `);
    } catch {
      // Constraint already exists — safe to ignore
    }

    // Add sort_order to homepage_hero if the column was added by migration 033
    // but the table was created by an older version of this function without it.
    try {
      await query(`
        ALTER TABLE homepage_hero ADD COLUMN sort_order INT NOT NULL DEFAULT 0
      `);
    } catch {
      // Column already exists — safe to ignore
    }

    console.log('[homepage] Tables verified/created OK');
  } catch (err) {
    // Non-fatal — log but don't crash the server
    console.error('[homepage] WARNING: Could not ensure homepage tables:', err.message);
  }
}
