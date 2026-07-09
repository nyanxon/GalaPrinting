/**
 * profile.service.js — Customer profile business logic.
 *
 * Requirements: 2.3, 2.4, 2.5, 3.6, 9.2
 */

import { query } from '../db/connection.js';
import { StorageService } from '../utils/storage.js';

const PROFILE_FIELDS = 'id, name, email, phone, dob, gender, avatar_url, role, is_email_verified, created_at, updated_at';

/**
 * Fetch a user's profile by ID.
 * @param {string} userId
 * @returns {Promise<object>} Profile data
 * @throws {Error} 404 if user not found
 */
export async function getProfile(userId) {
  const [rows] = await query(
    `SELECT ${PROFILE_FIELDS} FROM users WHERE id = ? AND deleted_at IS NULL`,
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
 * Only the fields present in `data` are updated.
 *
 * @param {string} userId
 * @param {{ name?: string, phone?: string|null, dob?: string|null, gender?: string|null }} data
 * @returns {Promise<object>} Updated profile data
 * @throws {Error} 422 for validation failures, 404 if user not found
 */
export async function updateProfile(userId, data) {
  const { name, phone, dob, gender } = data;

  // Validate name — must be a non-empty string
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      const err = new Error('Nama wajib diisi.');
      err.status = 422;
      throw err;
    }
  }

  // Validate phone — must match /^[0-9]{8,15}$/ if provided (not null/empty)
  if (phone !== undefined && phone !== null && phone !== '') {
    if (!/^[0-9]{8,15}$/.test(phone)) {
      const err = new Error('Nomor handphone tidak valid.');
      err.status = 422;
      throw err;
    }
  }

  // Build SET clause dynamically — only update fields that were supplied
  const setClauses = [];
  const params = [];

  if (name !== undefined) {
    setClauses.push('name = ?');
    params.push(name.trim());
  }

  if (phone !== undefined) {
    setClauses.push('phone = ?');
    // Treat empty string as NULL
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
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      params
    );
  }

  return getProfile(userId);
}

/**
 * Upload a new avatar for a user.
 * Deletes the old avatar file if one exists, saves the new file,
 * and updates users.avatar_url in the database.
 *
 * @param {string} userId
 * @param {Express.Multer.File} file - Multer file object
 * @returns {Promise<object>} Updated profile data
 * @throws {Error} 404 if user not found
 */
export async function uploadAvatar(userId, file) {
  // Fetch current profile to check for an existing avatar
  const currentProfile = await getProfile(userId);

  // Delete old avatar file if one exists
  if (currentProfile.avatar_url) {
    // avatar_url is like /uploads/avatars/filename.jpg — strip leading slash for StorageService.delete
    const existingAvatarPath = currentProfile.avatar_url.replace(/^\//, '');
    await StorageService.delete(existingAvatarPath);
  }

  // Save the new file to the avatars subdirectory
  const saved = await StorageService.save(file, 'avatars');

  // Update the user's avatar_url in the database
  await query(
    'UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL',
    [saved.url, userId]
  );

  return getProfile(userId);
}
