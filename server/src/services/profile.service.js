/**
 * profile.service.js — Customer profile business logic.
 *
 * Requirements: 2.3, 2.4, 2.5, 3.6, 9.2
 *
 * Operates on users_customer only (customer-facing profile).
 */

import { query } from '../db/connection.js';
import { StorageService } from '../utils/storage.js';

const PROFILE_FIELDS = "id, name, email, phone, dob, gender, avatar_url, 'customer' AS role, is_email_verified, created_at, updated_at";

/**
 * Fetch a customer's profile by ID.
 */
export async function getProfile(userId) {
  const [rows] = await query(
    `SELECT ${PROFILE_FIELDS} FROM users_customer WHERE id = ? AND deleted_at IS NULL`,
    [userId]
  );

  if (rows.length === 0) {
    const err = new Error('Pengguna tidak ditemukan.');
    err.status = 404;
    throw err;
  }

  return rows[0];
}

/**
 * Update a customer's profile fields (name, phone, dob, gender).
 */
export async function updateProfile(userId, data) {
  const { name, phone, dob, gender } = data;

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      const err = new Error('Nama wajib diisi.');
      err.status = 422;
      throw err;
    }
  }

  if (phone !== undefined && phone !== null && phone !== '') {
    if (!/^[0-9]{8,15}$/.test(phone)) {
      const err = new Error('Nomor handphone tidak valid.');
      err.status = 422;
      throw err;
    }
  }

  const setClauses = [];
  const params = [];

  if (name !== undefined) {
    setClauses.push('name = ?');
    params.push(name.trim());
  }

  if (phone !== undefined) {
    setClauses.push('phone = ?');
    params.push(phone === '' ? null : phone);
  }

  if (dob !== undefined) {
    setClauses.push('dob = ?');
    params.push(dob ?? null);
  }

  if (gender !== undefined) {
    setClauses.push('gender = ?');
    params.push(gender ?? null);
  }

  if (setClauses.length > 0) {
    setClauses.push('updated_at = NOW()');
    params.push(userId);

    await query(
      `UPDATE users_customer SET ${setClauses.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      params
    );
  }

  return getProfile(userId);
}

/**
 * Upload a new avatar for a customer.
 */
export async function uploadAvatar(userId, file) {
  const currentProfile = await getProfile(userId);

  if (currentProfile.avatar_url) {
    const existingAvatarPath = currentProfile.avatar_url.replace(/^\//, '');
    await StorageService.delete(existingAvatarPath);
  }

  const saved = await StorageService.save(file, 'avatars');

  await query(
    'UPDATE users_customer SET avatar_url = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL',
    [saved.url, userId]
  );

  return getProfile(userId);
}
