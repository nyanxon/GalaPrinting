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
      VALUES ('00000000-0000-0000-0000-000000000001', NULL, NULL, NULL, NULL, 0, 0)
    `);

    // Clear the old placeholder text from the seed row if it still has the
    // default "LANDING PAGE / 4+ PAGE" dummy content — replace with NULL so
    // the hero falls back to the empty/no-content state instead of showing
    // the placeholder text to end users.
    await query(`
      UPDATE homepage_hero
      SET title = NULL, subtitle = NULL
      WHERE id = '00000000-0000-0000-0000-000000000001'
        AND title = 'LANDING PAGE'
        AND subtitle = '4+ PAGE'
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

    // Note: no FK constraint on category_id — categoryId is resolved to UUID
    // in the service layer before insert, so we don't need a hard DB constraint
    // that can cause unhelpful 500 errors.

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
