/**
 * accounts.service.js — Business logic for Account management (owner-only).
 *
 * Provides cross-role user listing, detail with permissions, and
 * transactional role + permission updates.
 *
 * After the auth split, users are in two tables:
 *   - users_customer (no `role` column — the table IS the role)
 *   - users_admin (has `role` column)
 * This service queries both and handles cross-table role changes.
 */

import { randomUUID } from 'crypto';
import { query, pool } from '../db/connection.js';
import { parsePagination } from '../utils/pagination.js';
import { hashPassword } from '../utils/hash.js';

const CUSTOMER_FIELDS = "id, 'customer' AS role, name, email, phone, is_email_verified, avatar_url, created_at, updated_at, deleted_at";
const ADMIN_FIELDS    = 'id, role, name, email, phone, is_email_verified, avatar_url, created_at, updated_at, deleted_at';

/**
 * Find a user by ID across both tables.
 * Returns { row, userType: 'customer'|'admin' } or null.
 */
async function findUserAny(id) {
  const [adminRows] = await query(
    `SELECT ${ADMIN_FIELDS} FROM users_admin WHERE id = ? AND deleted_at IS NULL`, [id]
  );
  if (adminRows.length > 0) return { row: adminRows[0], userType: 'admin' };

  const [custRows] = await query(
    `SELECT ${CUSTOMER_FIELDS} FROM users_customer WHERE id = ? AND deleted_at IS NULL`, [id]
  );
  if (custRows.length > 0) return { row: custRows[0], userType: 'customer' };

  return null;
}

/**
 * List all accounts with pagination, search, and optional role filter.
 * Uses UNION ALL across both tables.
 */
export async function listAccounts({ page = 1, limit = 20, q, role } = {}) {
  const { pageNum, limitNum, offset } = parsePagination(page, limit, 100, 20);

  const roles = role
    ? role.split(',').map((r) => r.trim()).filter(Boolean)
    : [];

  const isCustomerOnly = roles.length === 1 && roles[0] === 'customer';
  const isStaffOnly    = roles.length > 0 && !isCustomerOnly;

  const conditions = ['deleted_at IS NULL'];
  const params     = [];

  if (q && q.trim().length > 0) {
    conditions.push('(name LIKE ? OR email LIKE ?)');
    const pattern = `%${q.trim()}%`;
    params.push(pattern, pattern);
  }

  if (isStaffOnly) {
    conditions.push(`role IN (${roles.map(() => '?').join(',')})`);
    params.push(...roles);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let baseSql;
  if (isCustomerOnly) {
    baseSql = `SELECT ${CUSTOMER_FIELDS} FROM users_customer ${where}`;
  } else if (isStaffOnly) {
    baseSql = `SELECT ${ADMIN_FIELDS} FROM users_admin ${where}`;
  } else {
    // No filter or mixed — UNION BOTH tables
    baseSql = `
      SELECT * FROM (
        SELECT ${CUSTOMER_FIELDS} FROM users_customer WHERE deleted_at IS NULL
        UNION ALL
        SELECT ${ADMIN_FIELDS} FROM users_admin WHERE deleted_at IS NULL
      ) AS all_users`;
    // Re-apply search filter on the outer query if needed
    if (q && q.trim().length > 0) {
      const outerConditions = [];
      const outerParams = [];
      outerConditions.push('(name LIKE ? OR email LIKE ?)');
      const pattern = `%${q.trim()}%`;
      outerParams.push(pattern, pattern);
      if (roles.length > 0) {
        outerConditions.push(`role IN (${roles.map(() => '?').join(',')})`);
        outerParams.push(...roles);
      }
      baseSql = `SELECT * FROM (${baseSql}) AS filtered WHERE ${outerConditions.join(' AND ')}`;
      params.length = 0;
      params.push(...outerParams);
    }
  }

  const countSql = `SELECT COUNT(*) AS total FROM (${baseSql}) AS cnt`;
  const [[{ total }]] = await query(countSql, params);

  const itemsSql = `${baseSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const [items] = await query(itemsSql, [...params, limitNum, offset]);

  return {
    items,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
}

/**
 * Get a single account with its user_permissions.
 */
export async function getAccount(id) {
  const found = await findUserAny(id);
  if (!found) return null;

  const [permRows] = await query(
    'SELECT permission_key FROM user_permissions WHERE user_id = ?',
    [id]
  );

  const permissions = permRows
    .map((r) => r.permission_key)
    .filter((k) => k !== '__none__');

  return {
    user: found.row,
    permissions,
  };
}

/**
 * Update an account's role and permissions (transactional).
 *
 * Role changes that cross table boundaries (customer ↔ staff) move the row
 * between users_customer and users_admin.
 */
export async function updateAccount(id, { role, permissions }, requestingUserId) {
  if (id === requestingUserId) {
    const err = new Error('Anda tidak dapat mengubah akun Anda sendiri.');
    err.status = 403;
    throw err;
  }

  const found = await findUserAny(id);
  if (!found) return null;

  const { row: current, userType: currentType } = found;
  const isCustomer = (r) => r === 'customer';
  const needsMove  = (currentType === 'customer' && !isCustomer(role))
                  || (currentType === 'admin' && isCustomer(role));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (needsMove) {
      // Cross-table move (promote or revoke)
      if (currentType === 'customer' && !isCustomer(role)) {
        // customer → staff
        await conn.query(
          `INSERT INTO users_admin
            (id, role, name, email, phone, password_hash, gender, dob, avatar_url,
             is_email_verified, email_verification_token, email_verification_expires,
             reset_password_token, reset_password_expires, is_promoted_admin,
             deleted_at, created_at, updated_at)
           SELECT id, ?, name, email, phone, password_hash, gender, dob, avatar_url,
             is_email_verified, email_verification_token, email_verification_expires,
             reset_password_token, reset_password_expires, 0,
             deleted_at, created_at, updated_at
           FROM users_customer WHERE id = ?`,
          [role, id]
        );
        await conn.query('DELETE FROM users_customer WHERE id = ?', [id]);
        await conn.query("DELETE FROM refresh_tokens WHERE user_id = ? AND user_type = 'customer'", [id]);
      } else {
        // staff → customer
        await conn.query(
          `INSERT INTO users_customer
            (id, name, email, phone, password_hash, gender, dob, avatar_url,
             is_email_verified, email_verification_token, email_verification_expires,
             reset_password_token, reset_password_expires,
             deleted_at, created_at, updated_at)
           SELECT id, name, email, phone, password_hash, gender, dob, avatar_url,
             is_email_verified, email_verification_token, email_verification_expires,
             reset_password_token, reset_password_expires,
             deleted_at, created_at, updated_at
           FROM users_admin WHERE id = ?`,
          [id]
        );
        await conn.query('DELETE FROM users_admin WHERE id = ?', [id]);
        await conn.query("DELETE FROM refresh_tokens WHERE user_id = ? AND user_type = 'admin'", [id]);
      }
    } else if (currentType === 'admin' && role !== current.role) {
      // Same-table role change (staff → different staff role)
      await conn.query(
        'UPDATE users_admin SET role = ? WHERE id = ?',
        [role, id]
      );
    }

    // Update user_permissions (shared table, same for both)
    await conn.query('DELETE FROM user_permissions WHERE user_id = ?', [id]);
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

  return getAccount(id);
}

// ── Create customer account (admin-created) ──────────────────────────────────

/**
 * Create a new customer account from the admin dashboard.
 * Does NOT send verification email — the admin hands the password
 * to the customer out-of-band.
 *
 * @param {{ name: string, email: string, phone: string, password: string }} data
 * @returns {Promise<object>} the new customer row (without password_hash)
 */
export async function createCustomerAccount({ name, email, phone, password }) {
  const [existing] = await query('SELECT id FROM users_customer WHERE email = ?', [email]);
  if (existing.length > 0) {
    const err = new Error('Email sudah terdaftar.');
    err.status = 409;
    throw err;
  }

  const id   = randomUUID();
  const hash = await hashPassword(password);

  await query(
    `INSERT INTO users_customer
       (id, name, email, phone, password_hash, is_email_verified)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [id, name, email, phone || null, hash]
  );

  const [rows] = await query(
    `SELECT ${CUSTOMER_FIELDS} FROM users_customer WHERE id = ?`,
    [id]
  );
  return rows[0] ?? null;
}
