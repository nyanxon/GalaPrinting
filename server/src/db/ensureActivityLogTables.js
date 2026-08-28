/**
 * ensureActivityLogTables.js
 *
 * Creates the two Fase 5 Activity Log helper tables if they don't exist yet:
 *   - activity_log_reads  (per-reader read-state / unread badge)
 *   - app_settings        (auto-retention setting)
 *
 * Called once at server startup so production deployments that haven't run
 * `npm run migrate` still get the tables automatically. Handles the case
 * where a manual migration created one table but not the other.
 *
 * All statements use CREATE TABLE IF NOT EXISTS — safe to call repeatedly.
 */

import { query } from './connection.js';

export async function ensureActivityLogTables() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS activity_log_reads (
        log_id          BIGINT      NOT NULL,
        reader_user_id  CHAR(36)    NOT NULL,
        read_at         DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (log_id, reader_user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key   VARCHAR(100) NOT NULL,
        setting_value VARCHAR(255) NULL,
        updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('[activity-log] Tables verified/created OK');
  } catch (err) {
    // Non-fatal — log but don't crash the server
    console.error('[activity-log] WARNING: Could not ensure activity log tables:', err.message);
  }
}
