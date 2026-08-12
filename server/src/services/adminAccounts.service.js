/**
 * adminAccounts.service.js — Business logic untuk permission dinamis.
 *
 * Endpoint di bawah /api/admin-accounts (owner-only):
 *   - List akun yang bisa dipromosikan (termasuk status is_promoted_admin)
 *   - Promote / revoke akun menjadi admin dinamis
 *   - Baca & update permission per-akun (admin_permissions)
 *
 * Prinsip: fitur adalah unit independen yang bisa dipasang ke akun manapun
 * lewat permission — TIDAK ada asumsi feature_key ↔ role tertentu.
 */

import { query, pool } from '../db/connection.js';
import { FEATURE_CATEGORIES, ALL_FEATURES } from '../config/features.js';

const SAFE_FIELDS =
  'id, role, name, email, phone, is_promoted_admin, is_email_verified, avatar_url, created_at, updated_at, deleted_at';

/**
 * Daftar semua akun yang bisa dipromosikan Owner.
 *
 * @param {{ q?: string }} [params]
 * @returns {Promise<Array<object>>}
 */
export async function listAdminAccounts({ q } = {}) {
  const conditions = ['role != ?', 'deleted_at IS NULL'];
  const params     = ['owner'];

  if (q && q.trim().length > 0) {
    conditions.push('(name LIKE ? OR email LIKE ?)');
    const pattern = `%${q.trim()}%`;
    params.push(pattern, pattern);
  }

  const [rows] = await query(
    `SELECT ${SAFE_FIELDS} FROM users
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC`,
    params
  );
  return rows;
}

/**
 * Angkat akun menjadi admin dinamis (is_promoted_admin = true).
 * Data permission lama TIDAK dihapus — tetap disimpan.
 *
 * @param {string} userId
 * @returns {Promise<object|null>} user setelah update, atau null jika tidak ditemukan
 */
export async function promoteAccount(userId) {
  const [result] = await query(
    'UPDATE users SET is_promoted_admin = 1 WHERE id = ? AND deleted_at IS NULL',
    [userId]
  );
  if (result.affectedRows === 0) return null;

  const [rows] = await query(`SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`, [userId]);
  return rows[0] ?? null;
}

/**
 * Cabut status admin dinamis (is_promoted_admin = false).
 * Sesuai rekomendasi: permission yang sudah di-set TIDAK dihapus, hanya
 * flag yang dinonaktifkan — supaya kalau di-promote lagi, konfigurasi
 * sebelumnya tidak hilang.
 *
 * @param {string} userId
 * @returns {Promise<object|null>} user setelah update, atau null jika tidak ditemukan
 */
export async function revokeAccount(userId) {
  const [result] = await query(
    'UPDATE users SET is_promoted_admin = 0 WHERE id = ? AND deleted_at IS NULL',
    [userId]
  );
  if (result.affectedRows === 0) return null;

  const [rows] = await query(`SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`, [userId]);
  return rows[0] ?? null;
}

/**
 * Daftar semua fitur dari config/features.js, dikelompokkan per kategori.
 *
 * @returns {Array<{ category: string, features: Array<{ key: string, label: string, description: string|null }> }>}
 */
export function listFeatures() {
  return Object.values(FEATURE_CATEGORIES).map((group) => ({
    category: group.category,
    features: group.features.map((f) => ({
      key: f.key,
      label: f.label,
      description: f.description ?? null,
    })),
  }));
}

/**
 * Validasi feature_key terhadap registry config/features.js.
 *
 * @param {string} featureKey
 * @returns {boolean}
 */
export function isValidFeatureKey(featureKey) {
  return ALL_FEATURES.some((f) => f.key === featureKey);
}

/**
 * Daftar permission akun tertentu: feature_key + granted untuk SEMUA fitur
 * yang terdaftar, termasuk yang belum pernah di-set eksplisit (default false).
 *
 * @param {string} userId
 * @returns {Promise<{ user: object|null, permissions: Array<{ feature_key: string, label: string, category: string, granted: boolean }> }>}
 */
export async function getAccountPermissions(userId) {
  const [userRows] = await query(
    `SELECT id, role, name, email, is_promoted_admin, deleted_at FROM users WHERE id = ?`,
    [userId]
  );
  const user = userRows[0] ?? null;

  // Don't query permissions for a non-existent account.
  if (!user) {
    return { user, permissions: [] };
  }

  const [permRows] = await query(
    'SELECT feature_key, granted FROM admin_permissions WHERE user_id = ?',
    [userId]
  );

  const grantedMap = new Map(permRows.map((r) => [r.feature_key, Boolean(r.granted)]));

  const permissions = ALL_FEATURES.map((f) => ({
    feature_key: f.key,
    label: f.label,
    category: f.category,
    granted: grantedMap.get(f.key) ?? false,
  }));

  return { user, permissions };
}

/**
 * Upsert permission akun tertentu.
 * Setiap item { feature_key, granted } di-insert kalau belum ada,
 * atau di-update kalau sudah ada (unique (user_id, feature_key)).
 *
 * @param {string} userId
 * @param {Array<{ feature_key: string, granted: boolean }>} items
 * @returns {Promise<{ user: object|null }>} — gunakan getAccountPermissions untuk hasil lengkap
 */
export async function updateAccountPermissions(userId, items) {
  const [userRows] = await query('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL', [userId]);
  if (userRows.length === 0) {
    const err = new Error('Akun tidak ditemukan.');
    err.status = 404;
    throw err;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const { feature_key, granted } of items) {
      await conn.query(
        `INSERT INTO admin_permissions (user_id, feature_key, granted)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE granted = VALUES(granted)`,
        [userId, feature_key, granted ? 1 : 0]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return { user: userRows[0] };
}
