/**
 * addresses.service.js — Address management business logic.
 *
 * Requirements: 5.1, 5.3, 5.8, 5.9, 5.11, 9.2, 9.3
 */

import { randomUUID } from 'crypto';
import { query } from '../db/connection.js';

const MAX_ADDRESSES = 10;

/**
 * List all addresses belonging to a user, ordered by creation date ascending.
 *
 * @param {string} userId
 * @returns {Promise<object[]>} Array of address objects
 */
export async function listAddresses(userId) {
  const [rows] = await query(
    'SELECT id, user_id, title, name, phone, full_address, created_at, updated_at FROM addresses WHERE user_id = ? ORDER BY created_at ASC',
    [userId]
  );
  return rows;
}

/**
 * Create a new address for a user.
 * Validates required fields and enforces the 10-address limit.
 *
 * @param {string} userId
 * @param {{ title: string, name: string, phone: string, full_address: string }} data
 * @returns {Promise<object>} The newly created address
 * @throws {Error} 422 if validation fails or address limit is reached
 */
export async function createAddress(userId, data) {
  const { title, name, phone, full_address } = data;

  // Validate required fields
  if (!title || String(title).trim().length === 0) {
    const err = new Error('Judul alamat wajib diisi.');
    err.status = 422;
    throw err;
  }
  if (!name || String(name).trim().length === 0) {
    const err = new Error('Nama wajib diisi.');
    err.status = 422;
    throw err;
  }
  if (!phone || String(phone).trim().length === 0) {
    const err = new Error('Nomor telepon wajib diisi.');
    err.status = 422;
    throw err;
  }
  if (!full_address || String(full_address).trim().length === 0) {
    const err = new Error('Alamat lengkap wajib diisi.');
    err.status = 422;
    throw err;
  }

  // Enforce 10-address limit
  const [countRows] = await query(
    'SELECT COUNT(*) AS total FROM addresses WHERE user_id = ?',
    [userId]
  );
  if (countRows[0].total >= MAX_ADDRESSES) {
    const err = new Error('Batas maksimal 10 alamat telah tercapai.');
    err.status = 422;
    throw err;
  }

  const id = randomUUID();

  await query(
    'INSERT INTO addresses (id, user_id, title, name, phone, full_address) VALUES (?, ?, ?, ?, ?, ?)',
    [id, userId, title.trim(), name.trim(), phone.trim(), full_address.trim()]
  );

  const [rows] = await query(
    'SELECT id, user_id, title, name, phone, full_address, created_at, updated_at FROM addresses WHERE id = ?',
    [id]
  );
  return rows[0];
}

/**
 * Update an existing address.
 * Validates ownership and required fields.
 *
 * @param {string} userId
 * @param {string} addressId
 * @param {{ title: string, name: string, phone: string, full_address: string }} data
 * @returns {Promise<object>} The updated address
 * @throws {Error} 404 if not found, 403 if not owner, 422 if validation fails
 */
export async function updateAddress(userId, addressId, data) {
  // Fetch address to verify existence and ownership
  const [existing] = await query(
    'SELECT id, user_id FROM addresses WHERE id = ?',
    [addressId]
  );

  if (existing.length === 0) {
    const err = new Error('Alamat tidak ditemukan.');
    err.status = 404;
    throw err;
  }

  if (existing[0].user_id !== userId) {
    const err = new Error('Akses ditolak.');
    err.status = 403;
    throw err;
  }

  const { title, name, phone, full_address } = data;

  // Validate required fields
  if (!title || String(title).trim().length === 0) {
    const err = new Error('Judul alamat wajib diisi.');
    err.status = 422;
    throw err;
  }
  if (!name || String(name).trim().length === 0) {
    const err = new Error('Nama wajib diisi.');
    err.status = 422;
    throw err;
  }
  if (!phone || String(phone).trim().length === 0) {
    const err = new Error('Nomor telepon wajib diisi.');
    err.status = 422;
    throw err;
  }
  if (!full_address || String(full_address).trim().length === 0) {
    const err = new Error('Alamat lengkap wajib diisi.');
    err.status = 422;
    throw err;
  }

  await query(
    `UPDATE addresses
     SET title = ?, name = ?, phone = ?, full_address = ?, updated_at = NOW()
     WHERE id = ?`,
    [title.trim(), name.trim(), phone.trim(), full_address.trim(), addressId]
  );

  const [rows] = await query(
    'SELECT id, user_id, title, name, phone, full_address, created_at, updated_at FROM addresses WHERE id = ?',
    [addressId]
  );
  return rows[0];
}

/**
 * Delete an address.
 * Validates ownership before deletion.
 *
 * @param {string} userId
 * @param {string} addressId
 * @returns {Promise<void>}
 * @throws {Error} 404 if not found, 403 if not owner
 */
export async function deleteAddress(userId, addressId) {
  // Fetch address to verify existence and ownership
  const [existing] = await query(
    'SELECT id, user_id FROM addresses WHERE id = ?',
    [addressId]
  );

  if (existing.length === 0) {
    const err = new Error('Alamat tidak ditemukan.');
    err.status = 404;
    throw err;
  }

  if (existing[0].user_id !== userId) {
    const err = new Error('Akses ditolak.');
    err.status = 403;
    throw err;
  }

  await query('DELETE FROM addresses WHERE id = ?', [addressId]);
}
