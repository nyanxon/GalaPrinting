/**
 * adminAccounts.service.js — Business logic untuk permission dinamis.
 *
 * Endpoint di bawah /api/admin-accounts (owner-only):
 *   - List akun admin/staff (dari users_admin) untuk permission editing
 *   - Search customers (dari users_customer) untuk flow promote
 *   - Promote / revoke akun menjadi admin dinamis (Phase 3: moved between tables)
 *   - Baca & update permission per-akun (admin_permissions)
 *
 * Prinsip: fitur adalah unit independen yang bisa dipasang ke akun manapun
 * lewat permission — TIDAK ada asumsi feature_key ↔ role tertentu.
 */

import { query, pool } from '../db/connection.js';
import { FEATURE_CATEGORIES, ALL_FEATURES } from '../config/features.js';
import { STAFF_ROLES } from '../config/roles.js';
import * as adminAuth from './adminAuth.service.js';

const ADMIN_SAFE_FIELDS =
  'id, role, name, email, phone, is_promoted_admin, must_change_password, is_email_verified, avatar_url, created_at, updated_at, deleted_at';

const CUSTOMER_SAFE_FIELDS =
  'id, name, email, phone, is_email_verified, avatar_url, created_at, updated_at, deleted_at';

// ── Admin account listing ────────────────────────────────────────────────────

/**
 * Daftar semua akun admin/staff (dari users_admin) yang bisa dikelola Owner.
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
    `SELECT ${ADMIN_SAFE_FIELDS} FROM users_admin
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC`,
    params
  );
  return rows;
}

// ── Customer search (for promote flow) ───────────────────────────────────────

/**
 * Search customers in users_customer by name or email.
 * Used by Owner to find a customer to promote.
 *
 * @param {{ q?: string }} [params]
 * @returns {Promise<Array<object>>}
 */
export async function searchCustomers({ q } = {}) {
  const conditions = ['deleted_at IS NULL'];
  const params     = [];

  if (q && q.trim().length > 0) {
    conditions.push('(name LIKE ? OR email LIKE ?)');
    const pattern = `%${q.trim()}%`;
    params.push(pattern, pattern);
  }

  const [rows] = await query(
    `SELECT ${CUSTOMER_SAFE_FIELDS} FROM users_customer
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT 50`,
    params
  );
  return rows;
}

// ── Create new staff account (Owner-only) ────────────────────────────────────

/**
 * Create a brand-new staff account from scratch.
 * Delegates to adminAuth.createStaffAccount which handles validation,
 * hashing, and the must_change_password flag.
 *
 * @param {{ name: string, email: string, role: string, password: string }} data
 * @returns {Promise<object>} the new user row (without password_hash)
 */
export async function createStaffAccount({ name, email, role, password }) {
  if (!STAFF_ROLES.includes(role)) {
    const err = new Error('Role tidak valid.');
    err.status = 422;
    throw err;
  }
  return adminAuth.createStaffAccount({ name, email, role, password });
}

// ── Promote / Revoke ─────────────────────────────────────────────────────────

/**
 * Angkat customer menjadi admin dinamis.
 * Moves the row from users_customer → users_admin in a transaction.
 * Sets is_promoted_admin = 1 and default role = 'admin'.
 * Revokes all existing customer refresh tokens (forces re-login).
 *
 * @param {string} userId
 * @returns {Promise<object|null>} promoted user from users_admin, atau null
 */
export async function promoteAccount(userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [custRows] = await conn.query(
      'SELECT * FROM users_customer WHERE id = ? AND deleted_at IS NULL',
      [userId]
    );
    if (custRows.length === 0) {
      await conn.rollback();
      return null;
    }
    const c = custRows[0];

    await conn.query(
      `INSERT INTO users_admin
        (id, role, name, email, phone, password_hash, gender, dob, avatar_url,
         is_email_verified, email_verification_token, email_verification_expires,
         reset_password_token, reset_password_expires, is_promoted_admin,
         deleted_at, created_at, updated_at)
       VALUES (?, 'admin', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [c.id, c.name, c.email, c.phone, c.password_hash,
       c.gender, c.dob, c.avatar_url,
       c.is_email_verified, c.email_verification_token, c.email_verification_expires,
       c.reset_password_token, c.reset_password_expires,
       c.deleted_at, c.created_at, c.updated_at]
    );

    await conn.query('DELETE FROM users_customer WHERE id = ?', [userId]);
    await conn.query("DELETE FROM refresh_tokens WHERE user_id = ? AND user_type = 'customer'", [userId]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const [rows] = await query(`SELECT ${ADMIN_SAFE_FIELDS} FROM users_admin WHERE id = ?`, [userId]);
  return rows[0] ?? null;
}

/**
 * Cabut status admin dinamis — move the row from users_admin → users_customer.
 * Default role when moving to customers: drops the staff role column entirely.
 * Keeps admin_permissions and user_permissions rows (config preserved for re-promote).
 * Revokes all existing admin refresh tokens (forces re-login).
 *
 * @param {string} userId
 * @returns {Promise<object|null>} revoked user from users_customer, atau null
 */
export async function revokeAccount(userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [adminRows] = await conn.query(
      'SELECT * FROM users_admin WHERE id = ? AND deleted_at IS NULL',
      [userId]
    );
    if (adminRows.length === 0) {
      await conn.rollback();
      return null;
    }
    const a = adminRows[0];

    await conn.query(
      `INSERT INTO users_customer
        (id, name, email, phone, password_hash, gender, dob, avatar_url,
         is_email_verified, email_verification_token, email_verification_expires,
         reset_password_token, reset_password_expires,
         deleted_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.name, a.email, a.phone, a.password_hash,
       a.gender, a.dob, a.avatar_url,
       a.is_email_verified, a.email_verification_token, a.email_verification_expires,
       a.reset_password_token, a.reset_password_expires,
       a.deleted_at, a.created_at, a.updated_at]
    );

    await conn.query('DELETE FROM users_admin WHERE id = ?', [userId]);
    await conn.query("DELETE FROM refresh_tokens WHERE user_id = ? AND user_type = 'admin'", [userId]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const [rows] = await query(
    `SELECT id, 'customer' AS role, name, email, phone, is_email_verified, avatar_url, created_at, updated_at, deleted_at
     FROM users_customer WHERE id = ?`,
    [userId]
  );
  return rows[0] ?? null;
}

// ── Feature registry ─────────────────────────────────────────────────────────

/**
 * Daftar semua fitur dari config/features.js, dikelompokkan per kategori.
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
 */
export function isValidFeatureKey(featureKey) {
  return ALL_FEATURES.some((f) => f.key === featureKey);
}

// ── Permission management ────────────────────────────────────────────────────

/**
 * Daftar permission akun tertentu: feature_key + granted untuk SEMUA fitur
 * yang terdaftar, termasuk yang belum pernah di-set eksplisit (default false).
 *
 * @param {string} userId
 * @returns {Promise<{ user: object|null, permissions: Array<...> }>}
 */
export async function getAccountPermissions(userId) {
  const [userRows] = await query(
    `SELECT id, role, name, email, is_promoted_admin, deleted_at FROM users_admin WHERE id = ?`,
    [userId]
  );
  const user = userRows[0] ?? null;

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
 *
 * @param {string} userId
 * @param {Array<{ feature_key: string, granted: boolean }>} items
 * @returns {Promise<{ user: object|null }>}
 */
export async function updateAccountPermissions(userId, items) {
  const [userRows] = await query('SELECT id FROM users_admin WHERE id = ? AND deleted_at IS NULL', [userId]);
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
