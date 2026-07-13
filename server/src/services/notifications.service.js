/**
 * notifications.service.js — Notification preferences business logic.
 *
 * Requirements: 7.2, 7.4
 *
 * Preference keys:
 *   order_received     — Pesanan Diterima (new order placed)
 *   payment_accepted   — Pembayaran Telah Diterima
 *   mockup_accepted    — Mockup Diterima (Design Accepted)
 *   order_shipped      — Pesanan Akan Diantar (In Delivery)
 *   order_finished     — Pesanan Selesai
 *   order_cancelled    — Pesanan Dibatalkan
 *   login_new_device   — Notifikasi Login dari Device Baru
 *   login_failed_alert — Alert Percobaan Login Gagal Berkali-kali
 *
 * Note: forgot_password and email_verification are NOT listed here —
 * they are core/mandatory features and are always sent regardless of preferences.
 */

import { query } from '../db/connection.js';

/**
 * Default notification preferences applied when no row exists for a user.
 */
const DEFAULT_PREFS = {
  order_received:     true,
  payment_accepted:   true,
  mockup_accepted:    true,
  order_shipped:      true,
  order_finished:     true,
  order_cancelled:    true,
  login_new_device:   true,
  login_failed_alert: true,
};

/**
 * Retrieve notification preferences for a user.
 * If no row exists, returns DEFAULT_PREFS without inserting (lazy creation).
 * MySQL TINYINT(1) columns are converted to booleans.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getPreferences(userId) {
  const [rows] = await query(
    `SELECT
       order_received,
       payment_accepted,
       mockup_accepted,
       order_shipped,
       order_finished,
       order_cancelled,
       login_new_device,
       login_failed_alert
     FROM notification_preferences
     WHERE user_id = ?`,
    [userId]
  );

  if (rows.length === 0) {
    return { ...DEFAULT_PREFS };
  }

  const r = rows[0];
  return {
    order_received:     Boolean(r.order_received     ?? DEFAULT_PREFS.order_received),
    payment_accepted:   Boolean(r.payment_accepted   ?? DEFAULT_PREFS.payment_accepted),
    mockup_accepted:    Boolean(r.mockup_accepted     ?? DEFAULT_PREFS.mockup_accepted),
    order_shipped:      Boolean(r.order_shipped       ?? DEFAULT_PREFS.order_shipped),
    order_finished:     Boolean(r.order_finished      ?? DEFAULT_PREFS.order_finished),
    order_cancelled:    Boolean(r.order_cancelled     ?? DEFAULT_PREFS.order_cancelled),
    login_new_device:   Boolean(r.login_new_device    ?? DEFAULT_PREFS.login_new_device),
    login_failed_alert: Boolean(r.login_failed_alert  ?? DEFAULT_PREFS.login_failed_alert),
  };
}

/**
 * Upsert notification preferences for a user.
 * Uses INSERT ... ON DUPLICATE KEY UPDATE.
 * Fields absent from `prefs` fall back to the currently stored value.
 *
 * @param {string} userId
 * @param {Partial<typeof DEFAULT_PREFS>} prefs
 * @returns {Promise<object>} Updated preferences
 */
export async function updatePreferences(userId, prefs) {
  const current = await getPreferences(userId);

  const order_received     = prefs.order_received     !== undefined ? Boolean(prefs.order_received)     : current.order_received;
  const payment_accepted   = prefs.payment_accepted   !== undefined ? Boolean(prefs.payment_accepted)   : current.payment_accepted;
  const mockup_accepted    = prefs.mockup_accepted    !== undefined ? Boolean(prefs.mockup_accepted)    : current.mockup_accepted;
  const order_shipped      = prefs.order_shipped      !== undefined ? Boolean(prefs.order_shipped)      : current.order_shipped;
  const order_finished     = prefs.order_finished     !== undefined ? Boolean(prefs.order_finished)     : current.order_finished;
  const order_cancelled    = prefs.order_cancelled    !== undefined ? Boolean(prefs.order_cancelled)    : current.order_cancelled;
  const login_new_device   = prefs.login_new_device   !== undefined ? Boolean(prefs.login_new_device)   : current.login_new_device;
  const login_failed_alert = prefs.login_failed_alert !== undefined ? Boolean(prefs.login_failed_alert) : current.login_failed_alert;

  await query(
    `INSERT INTO notification_preferences
       (user_id, order_received, payment_accepted, mockup_accepted,
        order_shipped, order_finished, order_cancelled,
        login_new_device, login_failed_alert)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       order_received     = VALUES(order_received),
       payment_accepted   = VALUES(payment_accepted),
       mockup_accepted    = VALUES(mockup_accepted),
       order_shipped      = VALUES(order_shipped),
       order_finished     = VALUES(order_finished),
       order_cancelled    = VALUES(order_cancelled),
       login_new_device   = VALUES(login_new_device),
       login_failed_alert = VALUES(login_failed_alert),
       updated_at         = NOW()`,
    [
      userId,
      order_received,
      payment_accepted,
      mockup_accepted,
      order_shipped,
      order_finished,
      order_cancelled,
      login_new_device,
      login_failed_alert,
    ]
  );

  return getPreferences(userId);
}
