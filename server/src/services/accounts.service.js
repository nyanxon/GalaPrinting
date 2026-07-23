/**
 * accounts.service.js — Business logic for Account management (owner-only).
 *
 * Provides cross-role user listing, detail with permissions, and
 * transactional role + permission updates.
 */

import { query, pool } from '../db/connection.js';

const SAFE_FIELDS = 'id, role, name, email, phone, is_email_verified, avatar_url, created_at, updated_at, deleted_at';

/**
 * List all accounts with pagination, search, and optional role filter.
 *
 * @param {{ page?: number, limit?: number, q?: string, role?: string }} params
 * @returns {Promise<{ items: object[], total: number, page: number, limit: number, totalPages: number }>}
 */
export async function listAccounts({ page = 1, limit = 20, q, role } = {}) {
  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset   = (pageNum - 1) * limitNum;

  const conditions = ['deleted_at IS NULL'];
  const params     = [];

  if (q && q.trim().length > 0) {
    conditions.push('(name LIKE ? OR email LIKE ?)');
    const pattern = `%${q.trim()}%`;
    params.push(pattern, pattern);
  }

  if (role && role.trim().length > 0) {
    const roles = role.split(',').map((r) => r.trim()).filter(Boolean);
    if (roles.length === 1) {
      conditions.push('role = ?');
      params.push(roles[0]);
    } else if (roles.length > 1) {
      conditions.push(`role IN (${roles.map(() => '?').join(',')})`);
      params.push(...roles);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [[{ total }]] = await query(
    `SELECT COUNT(*) AS total FROM users ${where}`,
    params
  );

  const [items] = await query(
    `SELECT ${SAFE_FIELDS} FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  return {
    items,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
}

/**
 * Get a single account with its permissions.
 *
 * @param {string} id
 * @returns {Promise<{ user: object, permissions: string[] } | null>}
 */
export async function getAccount(id) {
  const [rows] = await query(
    `SELECT ${SAFE_FIELDS} FROM users WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  if (rows.length === 0) return null;

  const [permRows] = await query(
    'SELECT permission_key FROM user_permissions WHERE user_id = ?',
    [id]
  );

  // Filter out the __none__ sentinel — it's only used internally to
  // distinguish "never set" from "explicitly cleared".
  const permissions = permRows
    .map((r) => r.permission_key)
    .filter((k) => k !== '__none__');

  return {
    user: rows[0],
    permissions,
  };
}

/**
 * Update an account's role and permissions (transactional).
 *
 * @param {string} id
 * @param {{ role: string, permissions: string[] }} data
 * @param {string} requestingUserId — prevents self-modification
 * @returns {Promise<{ user: object, permissions: string[] } | null>}
 */
export async function updateAccount(id, { role, permissions }, requestingUserId) {
  if (id === requestingUserId) {
    const err = new Error('Anda tidak dapat mengubah akun Anda sendiri.');
    err.status = 403;
    throw err;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Update role
    const [result] = await conn.query(
      'UPDATE users SET role = ? WHERE id = ? AND deleted_at IS NULL',
      [role, id]
    );
    if (result.affectedRows === 0) {
      await conn.rollback();
      return null;
    }

    // 2. Delete old permissions
    await conn.query('DELETE FROM user_permissions WHERE user_id = ?', [id]);

    // 3. Insert new permissions
    //    When owner explicitly clears ALL permissions, insert a __none__ sentinel
    //    so getUserById can distinguish "never set" (0 rows → null → show all)
    //    from "explicitly cleared" (__none__ row → [] → show nothing).
    if (Array.isArray(permissions) && permissions.length > 0) {
      const values = permissions.map((p) => [id, p]);
      await conn.query(
        'INSERT INTO user_permissions (user_id, permission_key) VALUES ?',
        [values]
      );
    } else {
      await conn.query(
        'INSERT INTO user_permissions (user_id, permission_key) VALUES (?, ?)',
        [id, '__none__']
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // Return updated data
  return getAccount(id);
}
