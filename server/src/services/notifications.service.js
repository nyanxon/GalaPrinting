/**
 * notifications.service.js — Notification preferences business logic.
 *
 * Requirements: 7.2, 7.4
 */

import { query } from '../db/connection.js';

/**
 * Default notification preferences applied when no row exists for a user.
 * Matches the column defaults in migration 025_create_notification_preferences.sql.
 */
const DEFAULT_PREFS = {
  payment_accepted: true,
  order_shipped: true,
  order_finished: true,
  order_cancelled: true,
  promo_news: false,
};

/**
 * Retrieve notification preferences for a user.
 * If no row exists in the database, returns DEFAULT_PREFS without inserting
 * (lazy creation — the row is only written on first explicit update).
 *
 * MySQL TINYINT(1) columns are returned as 0/1; these are converted to booleans.
 *
 * @param {string} userId
 * @returns {Promise<{
 *   payment_accepted: boolean,
 *   order_shipped: boolean,
 *   order_finished: boolean,
 *   order_cancelled: boolean,
 *   promo_news: boolean,
 * }>}
 */
export async function getPreferences(userId) {
  const [rows] = await query(
    `SELECT payment_accepted, order_shipped, order_finished, order_cancelled, promo_news
     FROM notification_preferences
     WHERE user_id = ?`,
    [userId]
  );

  if (rows.length === 0) {
    return { ...DEFAULT_PREFS };
  }

  const row = rows[0];
  return {
    payment_accepted: Boolean(row.payment_accepted),
    order_shipped: Boolean(row.order_shipped),
    order_finished: Boolean(row.order_finished),
    order_cancelled: Boolean(row.order_cancelled),
    promo_news: Boolean(row.promo_news),
  };
}

/**
 * Upsert notification preferences for a user.
 * Uses INSERT ... ON DUPLICATE KEY UPDATE so the row is created on first call
 * and updated on subsequent calls.
 *
 * Fields not present in `prefs` fall back to the current stored value (or the
 * default if no row exists yet).
 *
 * @param {string} userId
 * @param {Partial<{
 *   payment_accepted: boolean,
 *   order_shipped: boolean,
 *   order_finished: boolean,
 *   order_cancelled: boolean,
 *   promo_news: boolean,
 * }>} prefs
 * @returns {Promise<{
 *   payment_accepted: boolean,
 *   order_shipped: boolean,
 *   order_finished: boolean,
 *   order_cancelled: boolean,
 *   promo_news: boolean,
 * }>} The updated preferences
 */
export async function updatePreferences(userId, prefs) {
  // Fetch current values so we can fall back to them for omitted fields
  const current = await getPreferences(userId);

  const payment_accepted = prefs.payment_accepted !== undefined
    ? Boolean(prefs.payment_accepted)
    : current.payment_accepted;

  const order_shipped = prefs.order_shipped !== undefined
    ? Boolean(prefs.order_shipped)
    : current.order_shipped;

  const order_finished = prefs.order_finished !== undefined
    ? Boolean(prefs.order_finished)
    : current.order_finished;

  const order_cancelled = prefs.order_cancelled !== undefined
    ? Boolean(prefs.order_cancelled)
    : current.order_cancelled;

  const promo_news = prefs.promo_news !== undefined
    ? Boolean(prefs.promo_news)
    : current.promo_news;

  await query(
    `INSERT INTO notification_preferences
       (user_id, payment_accepted, order_shipped, order_finished, order_cancelled, promo_news)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       payment_accepted = VALUES(payment_accepted),
       order_shipped    = VALUES(order_shipped),
       order_finished   = VALUES(order_finished),
       order_cancelled  = VALUES(order_cancelled),
       promo_news       = VALUES(promo_news),
       updated_at       = NOW()`,
    [userId, payment_accepted, order_shipped, order_finished, order_cancelled, promo_news]
  );

  return getPreferences(userId);
}
