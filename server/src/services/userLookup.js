/**
 * userLookup.js — Shared helpers for looking up users across both tables.
 *
 * After the users → users_customer / users_admin split, some code paths
 * need to find a user without knowing which table they're in. These helpers
 * query both tables efficiently.
 */

import { query } from '../db/connection.js';

const ADMIN_FIELDS =
  'id, role, name, email, phone, gender, dob, avatar_url, is_email_verified, is_promoted_admin, created_at, updated_at, deleted_at';

const CUSTOMER_FIELDS =
  "id, 'customer' AS role, name, email, phone, gender, dob, avatar_url, is_email_verified, created_at, updated_at, deleted_at";

/**
 * Find a user by ID across both tables. Returns the row with a synthetic
 * `user_type` field ('customer' | 'admin'), or null.
 *
 * Tries users_admin first (smaller table, more likely in admin contexts).
 */
export async function findUserById(id) {
  const [adminRows] = await query(
    `SELECT ${ADMIN_FIELDS}, 'admin' AS user_type FROM users_admin WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  if (adminRows.length > 0) return adminRows[0];

  const [custRows] = await query(
    `SELECT ${CUSTOMER_FIELDS}, 'customer' AS user_type FROM users_customer WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return custRows[0] || null;
}

/**
 * Find a user by email across both tables. Returns the row with `user_type`,
 * or null. Checks uniqueness — if the same email exists in both tables
 * (shouldn't happen but defensive), returns the admin row.
 */
export async function findUserByEmail(email) {
  const [adminRows] = await query(
    `SELECT ${ADMIN_FIELDS}, 'admin' AS user_type FROM users_admin WHERE email = ? AND deleted_at IS NULL`,
    [email]
  );
  if (adminRows.length > 0) return adminRows[0];

  const [custRows] = await query(
    `SELECT ${CUSTOMER_FIELDS}, 'customer' AS user_type FROM users_customer WHERE email = ? AND deleted_at IS NULL`,
    [email]
  );
  return custRows[0] || null;
}

/**
 * Check if a user ID exists in users_customer.
 */
export async function existsInCustomers(id) {
  const [rows] = await query('SELECT 1 FROM users_customer WHERE id = ?', [id]);
  return rows.length > 0;
}

/**
 * Check if a user ID exists in users_admin.
 */
export async function existsInAdmins(id) {
  const [rows] = await query('SELECT 1 FROM users_admin WHERE id = ?', [id]);
  return rows.length > 0;
}

/**
 * Check if a user ID exists in either table.
 */
export async function existsInEitherTable(id) {
  if (await existsInAdmins(id)) return true;
  return existsInCustomers(id);
}
