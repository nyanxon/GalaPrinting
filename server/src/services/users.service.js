/**
 * users.service.js — User and staff management business logic.
 *
 * Requirements: 13.1–13.7
 *
 * After the auth split:
 *   - Customers live in users_customer (no `role` column — the table IS the role)
 *   - Staff live in users_admin (has `role` column)
 */

import { randomUUID } from 'crypto';
import { query } from '../db/connection.js';
import { hashPassword } from '../utils/hash.js';
import { parsePagination } from '../utils/pagination.js';

const CUSTOMER_FIELDS = 'id, name, email, phone, created_at, updated_at, deleted_at';
const STAFF_FIELDS    = 'id, role, name, email, phone, created_at, updated_at, deleted_at';

export async function listCustomers({ page = 1, limit = 20, q } = {}) {
  const { pageNum, limitNum, offset } = parsePagination(page, limit, 100, 20);

  const hasSearch = q && q.trim().length > 0;
  const searchPattern = hasSearch ? `%${q.trim()}%` : null;

  const countSql = hasSearch
    ? 'SELECT COUNT(*) AS total FROM users_customer WHERE deleted_at IS NULL AND (name LIKE ? OR phone LIKE ?)'
    : 'SELECT COUNT(*) AS total FROM users_customer WHERE deleted_at IS NULL';
  const countParams = hasSearch ? [searchPattern, searchPattern] : [];

  const [countRows] = await query(countSql, countParams);
  const total = countRows[0].total;

  const itemsSql = hasSearch
    ? `SELECT ${CUSTOMER_FIELDS} FROM users_customer
       WHERE deleted_at IS NULL AND (name LIKE ? OR phone LIKE ?)
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    : `SELECT ${CUSTOMER_FIELDS} FROM users_customer
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`;
  const itemsParams = hasSearch
    ? [searchPattern, searchPattern, limitNum, offset]
    : [limitNum, offset];

  const [items] = await query(itemsSql, itemsParams);

  return { items, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
}

export async function listStaff({ q, excludeUserId } = {}) {
  const hasSearch  = q && q.trim().length > 0;
  const hasExclude = excludeUserId && excludeUserId.trim().length > 0;

  const conditions = ['deleted_at IS NULL'];
  const params     = [];

  if (hasSearch) {
    conditions.push('name LIKE ?');
    params.push(`%${q.trim()}%`);
  }

  if (hasExclude) {
    conditions.push('id != ?');
    params.push(excludeUserId);
  }

  const [rows] = await query(
    `SELECT ${STAFF_FIELDS} FROM users_admin
     WHERE ${conditions.join(' AND ')}
     ORDER BY role ASC, name ASC`,
    params
  );
  return rows;
}

export async function createStaff({ name, email, phone, password, role }) {
  // Check both tables for duplicate email
  const [existingAdmin] = await query('SELECT id FROM users_admin WHERE email = ?', [email]);
  if (existingAdmin.length > 0) {
    const err = new Error('Email sudah terdaftar.');
    err.status = 409;
    throw err;
  }
  const [existingCust] = await query('SELECT id FROM users_customer WHERE email = ?', [email]);
  if (existingCust.length > 0) {
    const err = new Error('Email sudah terdaftar.');
    err.status = 409;
    throw err;
  }

  const id   = randomUUID();
  const hash = await hashPassword(password);

  await query(
    `INSERT INTO users_admin (id, role, name, email, phone, password_hash)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, role, name, email, phone || null, hash]
  );

  const [rows] = await query(`SELECT ${STAFF_FIELDS} FROM users_admin WHERE id = ?`, [id]);
  return rows[0];
}

export async function softDeleteUser(id) {
  // Try both tables — caller may not know which table the user is in
  const [adminResult] = await query('UPDATE users_admin SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [id]);
  if (adminResult.affectedRows > 0) return;

  await query('UPDATE users_customer SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [id]);
}
