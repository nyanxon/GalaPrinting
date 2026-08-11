/**
 * users.service.js — User and staff management business logic.
 *
 * Requirements: 13.1–13.7
 */

import { randomUUID } from 'crypto';
import { query } from '../db/connection.js';
import { hashPassword } from '../utils/hash.js';
import { parsePagination } from '../utils/pagination.js';

const SAFE_FIELDS = 'id, role, name, email, phone, created_at, updated_at, deleted_at';

export async function listCustomers({ page = 1, limit = 20, q } = {}) {
  const { pageNum, limitNum, offset } = parsePagination(page, limit, 100, 20);

  const hasSearch = q && q.trim().length > 0;
  const searchPattern = hasSearch ? `%${q.trim()}%` : null;

  const countSql = hasSearch
    ? "SELECT COUNT(*) AS total FROM users WHERE role = 'customer' AND deleted_at IS NULL AND (name LIKE ? OR phone LIKE ?)"
    : "SELECT COUNT(*) AS total FROM users WHERE role = 'customer' AND deleted_at IS NULL";
  const countParams = hasSearch ? [searchPattern, searchPattern] : [];

  const [countRows] = await query(countSql, countParams);
  const total = countRows[0].total;

  const itemsSql = hasSearch
    ? `SELECT ${SAFE_FIELDS} FROM users
       WHERE role = 'customer' AND deleted_at IS NULL AND (name LIKE ? OR phone LIKE ?)
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    : `SELECT ${SAFE_FIELDS} FROM users
       WHERE role = 'customer' AND deleted_at IS NULL
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

  const conditions = ["role != 'customer'", 'deleted_at IS NULL'];
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
    `SELECT ${SAFE_FIELDS} FROM users
     WHERE ${conditions.join(' AND ')}
     ORDER BY role ASC, name ASC`,
    params
  );
  return rows;
}

export async function createStaff({ name, email, phone, password, role }) {
  const [existing] = await query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    const err = new Error('Email sudah terdaftar.');
    err.status = 409;
    throw err;
  }

  const id   = randomUUID();
  const hash = await hashPassword(password);

  await query(
    `INSERT INTO users (id, role, name, email, phone, password_hash)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, role, name, email, phone || null, hash]
  );

  const [rows] = await query(`SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`, [id]);
  return rows[0];
}

export async function softDeleteUser(id) {
  await query('UPDATE users SET deleted_at = NOW() WHERE id = ?', [id]);
}
