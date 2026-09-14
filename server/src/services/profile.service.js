/**
 * profile.service.js — Profile business logic for both customers and staff.
 *
 * Requirements: 2.3, 2.4, 2.5, 3.6, 9.2
 *
 * Operates on users_customer or users_admin based on the caller's role.
 */

import { query } from '../db/connection.js';
import { StorageService } from '../utils/storage.js';

const CUSTOMER_FIELDS = "id, name, email, phone, dob, gender, avatar_url, 'customer' AS role, is_email_verified, created_at, updated_at";
const ADMIN_FIELDS    = "id, name, email, phone, dob, gender, avatar_url, role, is_email_verified, created_at, updated_at";

function isAdminRole(role) {
  return role && role !== 'customer';
}

function tableFor(role) {
  return isAdminRole(role) ? 'users_admin' : 'users_customer';
}

function fieldsFor(role) {
  return isAdminRole(role) ? ADMIN_FIELDS : CUSTOMER_FIELDS;
}

/**
 * Fetch a user's profile by ID and role.
 */
export async function getProfile(userId, role) {
  const table = tableFor(role);
  const [rows] = await query(
    `SELECT ${fieldsFor(role)} FROM ${table} WHERE id = ? AND deleted_at IS NULL`,
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
 * Update a user's profile fields (name, phone, dob, gender).
 */
export async function updateProfile(userId, role, data) {
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

    const table = tableFor(role);
    await query(
      `UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      params
    );
  }

  return getProfile(userId, role);
}

/**
 * Upload a new avatar for a user.
 */
export async function uploadAvatar(userId, role, file) {
  const currentProfile = await getProfile(userId, role);

  if (currentProfile.avatar_url) {
    const existingAvatarPath = currentProfile.avatar_url.replace(/^\//, '');
    await StorageService.delete(existingAvatarPath);
  }

  const saved = await StorageService.save(file, 'avatars');

  const table = tableFor(role);
  await query(
    `UPDATE ${table} SET avatar_url = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
    [saved.url, userId]
  );

  return getProfile(userId, role);
}
