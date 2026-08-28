/**
 * activityLog.service.js — Persistence for the Activity Log feature.
 *
 * Endpoints:
 *   POST   /api/activity-log/batch
 *   GET    /api/activity-log
 *   DELETE /api/activity-log/older-than
 *
 * Design notes:
 * - Inserts are DONE in bulk (single multi-row INSERT), never one query per event,
 *   because "all-clicks" instrumentation produces a very high event volume.
 * - Reads always order newest-first and rely on the indexes created in
 *   migration 057 (idx_activity_logs_actor_time, idx_activity_logs_actor_id_time).
 */

import { query } from '../db/connection.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Skip / mangle metadata so nothing huge or non-JSON ends up in the JSON column.
 * @param {object|string|null|undefined} metadata
 * @returns {string|null} JSON string, or null if empty/undefined.
 */
function sanitizeMetadata(metadata) {
  if (metadata === null || metadata === undefined) return null;
  let value = metadata;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      // Not valid JSON — store as a plain { note: ... } object instead.
      value = { note: String(value).slice(0, 2000) };
    }
  }
  try {
    const json = JSON.stringify(value);
    return json.length > 60000 ? JSON.stringify({ note: 'metadata too large', truncated: true }) : json;
  } catch {
    return JSON.stringify({ note: 'metadata unparseable' });
  }
}

/**
 * Insert a batch of pre-enriched events in ONE bulk INSERT query.
 *
 * @param {Array<{
 *   actor_type: string, actor_id?: string, actor_name?: string, actor_role?: string,
 *   action_label: string, page_path?: string, target_type?: string, target_id?: string,
 *   metadata?: object, ip_address?: string
 * }>} events - events already carrying actor info derived from JWT on the server.
 * @returns {Promise<number>} number of inserted rows
 */
export async function insertBatch(events) {
  if (!Array.isArray(events) || events.length === 0) return 0;

  const values = [];
  const placeholders = [];

  for (const ev of events) {
    const actionLabel = typeof ev.action_label === 'string' ? ev.action_label.slice(0, 255) : '';
    if (!actionLabel) continue; // skip events without a label

    const pagePath = typeof ev.page_path === 'string' ? ev.page_path.slice(0, 255) : null;
    const targetType = typeof ev.target_type === 'string' ? ev.target_type.slice(0, 60) : null;
    const targetId = typeof ev.target_id === 'string' ? ev.target_id.slice(0, 60) : null;
    const actorId = typeof ev.actor_id === 'string' && ev.actor_id ? ev.actor_id.slice(0, 36) : null;
    const actorName = typeof ev.actor_name === 'string' && ev.actor_name ? ev.actor_name.slice(0, 120) : null;
    const actorRole = typeof ev.actor_role === 'string' && ev.actor_role ? ev.actor_role.slice(0, 30) : null;
    const metadata = sanitizeMetadata(ev.metadata);
    const ip = typeof ev.ip_address === 'string' ? ev.ip_address.slice(0, 45) : null;

    placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    values.push(
      ev.actor_type === 'admin' ? 'admin' : 'customer',
      actorId,
      actorName,
      actorRole,
      actionLabel,
      pagePath,
      targetType,
      targetId,
      metadata,
      ip
    );
  }

  if (placeholders.length === 0) return 0;

  const sql = `INSERT INTO activity_logs
    (actor_type, actor_id, actor_name, actor_role, action_label,
     page_path, target_type, target_id, metadata, ip_address)
    VALUES ${placeholders.join(', ')}`;

  const [result] = await query(sql, values);
  return result.affectedRows;
}

/**
 * Build the WHERE clause + params for a filtered query.
 * Shared between the paginated list and the PDF dump so both honor the
 * exact same filters.
 */
function buildFilter({ actorType, from, to, actorId, search }) {
  const where = [];
  const params = [];

  if (actorType === 'customer' || actorType === 'admin') {
    where.push('al.actor_type = ?');
    params.push(actorType);
  }

  if (from && ISO_DATE_RE.test(String(from))) {
    where.push('al.created_at >= ?');
    params.push(`${from} 00:00:00`);
  }
  if (to && ISO_DATE_RE.test(String(to))) {
    // include the whole end day (until 23:59:59 of the end date)
    where.push('al.created_at <= ?');
    params.push(`${to} 23:59:59`);
  }

  if (actorId) {
    where.push('al.actor_id = ?');
    params.push(String(actorId));
  }

  if (search && String(search).trim()) {
    where.push('(al.actor_name LIKE ? OR al.action_label LIKE ?)');
    const like = `%${String(search).trim()}%`;
    params.push(like, like);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

/**
 * GET /api/activity-log — paginated, newest first.
 * @param {{ actorType?: string, from?: string, to?: string, actorId?: string,
 *           search?: string, page?: string|number, limit?: string|number,
 *           readerUserId?: string }} filters
 * @returns {Promise<{ items: object[], total: number, page: number, totalPages: number }>}
 */
export async function listLogs({ actorType, from, to, actorId, search, page, limit, readerUserId }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 30));
  const offset = (pageNum - 1) * limitNum;

  const { whereSql, params } = buildFilter({ actorType, from, to, actorId, search });
  const reader = readerUserId || null;

  const [countRows] = await query(
    `SELECT COUNT(*) AS total FROM activity_logs al ${whereSql}`,
    params
  );
  const total = Number(countRows[0].total);

  const [rows] = await query(
    `SELECT al.id, al.actor_type, al.actor_id, al.actor_name, al.actor_role,
            al.action_label, al.page_path, al.target_type, al.target_id,
            al.metadata, al.ip_address,
            (alr.reader_user_id IS NOT NULL) AS is_read,
            (al.created_at + INTERVAL 7 HOUR) AS created_at
     FROM activity_logs al
     LEFT JOIN activity_log_reads alr
       ON alr.log_id = al.id AND alr.reader_user_id = ?
     ${whereSql}
     ORDER BY al.id DESC
     LIMIT ? OFFSET ?`,
    [reader, ...params, limitNum, offset]
  );

  return {
    items: rows.map(decorateRow),
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum) || 0,
  };
}

/**
 * GET /api/activity-log/pdf — ALL rows matching filters (unpaginated) for PDF export.
 * @param {{ actorType?: string, from?: string, to?: string, actorId?: string,
 *           search?: string, readerUserId?: string }} filters
 * @returns {Promise<object[]>}
 */
export async function listLogsForPdf({ actorType, from, to, actorId, search, readerUserId }) {
  const { whereSql, params } = buildFilter({ actorType, from, to, actorId, search });
  const reader = readerUserId || null;

  const [rows] = await query(
    `SELECT al.id, al.actor_type, al.actor_id, al.actor_name, al.actor_role,
            al.action_label, al.page_path, al.target_type, al.target_id,
            al.metadata, al.ip_address,
            (alr.reader_user_id IS NOT NULL) AS is_read,
            (al.created_at + INTERVAL 7 HOUR) AS created_at
     FROM activity_logs al
     LEFT JOIN activity_log_reads alr
       ON alr.log_id = al.id AND alr.reader_user_id = ?
     ${whereSql}
     ORDER BY al.id DESC
     LIMIT 20000`,
    [reader, ...params]
  );

  return rows.map(decorateRow);
}

/**
 * DELETE /api/activity-log/older-than — delete logs older than a cutoff DATETIME (UTC).
 * @param {string} cutoff - DATETIME string in UTC (e.g. '2026-03-01 00:00:00')
 * @returns {Promise<number>} number of deleted rows
 */
export async function deleteOlderThan(cutoff) {
  const [result] = await query(
    'DELETE FROM activity_logs WHERE created_at < ?',
    [cutoff]
  );
  return result.affectedRows;
}

/* ── Per-reader read-state (Fase 5) ─────────────────────────────────────── */

/**
 * Mark a single log as read for the given reader. Insert is idempotent
 * (INSERT IGNORE on the (log_id, reader_user_id) PK).
 * @param {string|number} logId
 * @param {string} readerUserId
 * @returns {Promise<boolean>} true when a new read row was created
 */
export async function markLogRead(logId, readerUserId) {
  if (!logId || !readerUserId) return false;
  const [result] = await query(
    'INSERT IGNORE INTO activity_log_reads (log_id, reader_user_id) VALUES (?, ?)',
    [String(logId), String(readerUserId)]
  );
  return result.affectedRows > 0;
}

/**
 * Mark ALL existing logs as read for the reader (INSERT IGNORE for every row).
 * @param {string} readerUserId
 * @returns {Promise<boolean>}
 */
export async function markAllRead(readerUserId) {
  if (!readerUserId) return false;
  const [result] = await query(
    `INSERT IGNORE INTO activity_log_reads (log_id, reader_user_id)
     SELECT al.id, ? FROM activity_logs al`,
    [String(readerUserId)]
  );
  return result.affectedRows > 0;
}

/**
 * Number of logs the reader has NOT seen yet.
 * @param {string} readerUserId
 * @returns {Promise<number>}
 */
export async function unreadCountFor(readerUserId) {
  if (!readerUserId) return 0;
  const [rows] = await query(
    `SELECT COUNT(*) AS total
     FROM activity_logs al
     LEFT JOIN activity_log_reads alr
       ON alr.log_id = al.id AND alr.reader_user_id = ?
     WHERE alr.reader_user_id IS NULL`,
    [String(readerUserId)]
  );
  return Number(rows[0].total) || 0;
}

/* ── Auto-retention setting (Fase 5) ────────────────────────────────────── */

const RETENTION_KEY = 'activity_log_retention_months';
export const RETENTION_DEFAULT_MONTHS = 0; // 0 = auto-purge OFF

/**
 * Read the persisted auto-retention months (0 = OFF).
 * Lazily returns the default when no row exists.
 * @returns {Promise<{ months: number, enabled: boolean }>}
 */
export async function getRetentionSetting() {
  const [rows] = await query(
    'SELECT setting_value FROM app_settings WHERE setting_key = ?',
    [RETENTION_KEY]
  );
  const raw = rows[0]?.setting_value;
  let months = RETENTION_DEFAULT_MONTHS;
  if (raw !== null && raw !== undefined && raw !== '') {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n)) months = n;
  }
  return { months, enabled: months > 0 };
}

/**
 * Persist the auto-retention months (0 = OFF; accepted values 0, 3, 6, 12).
 * @param {number} months
 * @returns {Promise<{ months: number, enabled: boolean }>}
 */
export async function setRetentionSetting(months) {
  const value = String(months);
  await query(
    'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
    [RETENTION_KEY, value]
  );
  return getRetentionSetting();
}

/**
 * Compute a UTC DATETIME cutoff for a given number of months ago.
 * @param {number} months
 * @returns {string} e.g. '2026-03-01 00:00:00'
 */
export function monthsAgoCutoff(months) {
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return cutoff.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Run the auto-retention purge: read the setting and delete logs older than
 * the configured cutoff (no-op when OFF or 0 months). Returns how many were
 * deleted.
 * @returns {Promise<number>}
 */
export async function purgeOldLogs() {
  const { months } = await getRetentionSetting();
  if (!months) return 0;
  return deleteOlderThan(monthsAgoCutoff(months));
}


/**
 * Convert a raw DB row into the API response shape.
 * Parses the JSON column and formats the time for display.
 */
function decorateRow(row) {
  let metadata = null;
  if (row.metadata) {
    try {
      metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
    } catch {
      metadata = null;
    }
  }
  return {
    id: row.id,
    actorType: row.actor_type,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    actionLabel: row.action_label,
    pagePath: row.page_path,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata,
    ipAddress: row.ip_address,
    read: !!row.is_read,
    createdAt: row.created_at,
  };
}
