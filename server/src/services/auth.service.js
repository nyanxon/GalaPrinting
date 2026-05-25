/**
 * auth.service.js — Authentication business logic.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.6, 4.7, 4.8, 4.10
 */

import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { query } from '../db/connection.js';
import { hashPassword, comparePassword } from '../utils/hash.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function refreshExpiresAt() {
  // 7 days from now
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Register a new customer account.
 * @returns {Promise<object>} user row (without password_hash)
 */
export async function register({ name, email, phone, password, gender, dob }) {
  // Check unique email
  const [existing] = await query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    const err = new Error('Email sudah terdaftar.');
    err.status = 409;
    throw err;
  }

  const id   = randomUUID();
  const hash = await hashPassword(password);

  // Validate and normalize dob — must be a valid date string (YYYY-MM-DD)
  let dobValue = null;
  if (dob && dob !== '--') {
    const parsed = new Date(dob);
    if (!isNaN(parsed.getTime())) {
      dobValue = dob; // store as YYYY-MM-DD
    }
  }

  await query(
    `INSERT INTO users (id, role, name, email, phone, password_hash, gender, dob)
     VALUES (?, 'customer', ?, ?, ?, ?, ?, ?)`,
    [id, name, email, phone || null, hash, gender || null, dobValue]
  );

  return getUserById(id);
}

/**
 * Validate credentials and return the user row, or null on failure.
 * Returns the user even if soft-deleted so the controller can return
 * the correct "Akun tidak aktif." message (Req 13.7).
 * @returns {Promise<object|null>}
 */
export async function login({ email, password }) {
  // Fetch user regardless of deleted_at so we can distinguish
  // "wrong credentials" from "inactive account"
  const [rows] = await query(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );
  if (rows.length === 0) return null;

  const user = rows[0];
  const valid = await comparePassword(password, user.password_hash);
  if (!valid) return null;

  // Return user row (including deleted_at); controller checks deleted_at
  return user;
}

/**
 * Generate an access + refresh token pair and persist the refresh token.
 * @param {string} userId
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
export async function createTokenPair(userId) {
  const [userRows] = await query(
    'SELECT id, role, name, email FROM users WHERE id = ?',
    [userId]
  );
  if (userRows.length === 0) throw new Error('User not found');
  const user = userRows[0];

  const family       = randomUUID();
  const accessToken  = signAccessToken({ sub: user.id, role: user.role, name: user.name, email: user.email });
  const refreshToken = signRefreshToken(user.id, family);
  const tokenHash    = sha256(refreshToken);

  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, family, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), user.id, tokenHash, family, refreshExpiresAt()]
  );

  return { accessToken, refreshToken };
}

/**
 * Rotate a refresh token (detect reuse, issue new pair).
 * @param {string} token - The raw refresh token from the cookie
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
export async function rotateRefreshToken(token) {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    const err = new Error('Token tidak valid atau sudah kedaluwarsa.');
    err.status = 401;
    throw err;
  }

  const tokenHash = sha256(token);
  const [rows] = await query(
    'SELECT * FROM refresh_tokens WHERE token_hash = ?',
    [tokenHash]
  );

  if (rows.length === 0) {
    const err = new Error('Token tidak valid atau sudah kedaluwarsa.');
    err.status = 401;
    throw err;
  }

  const stored = rows[0];

  // Token reuse detected — invalidate entire family
  if (stored.used_at !== null) {
    await query('DELETE FROM refresh_tokens WHERE family = ?', [stored.family]);
    const err = new Error('Token tidak valid atau sudah kedaluwarsa.');
    err.status = 401;
    throw err;
  }

  // Mark current token as used
  await query('UPDATE refresh_tokens SET used_at = NOW() WHERE id = ?', [stored.id]);

  // Issue new token pair with same family
  const [userRows] = await query(
    'SELECT id, role, name, email FROM users WHERE id = ?',
    [payload.sub]
  );
  if (userRows.length === 0) {
    const err = new Error('Token tidak valid atau sudah kedaluwarsa.');
    err.status = 401;
    throw err;
  }
  const user = userRows[0];

  const newAccessToken  = signAccessToken({ sub: user.id, role: user.role, name: user.name, email: user.email });
  const newRefreshToken = signRefreshToken(user.id, stored.family);
  const newHash         = sha256(newRefreshToken);

  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, family, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), user.id, newHash, stored.family, refreshExpiresAt()]
  );

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

/**
 * Revoke all refresh tokens in the same family as the given token.
 * @param {string} token - The raw refresh token from the cookie
 */
export async function revokeRefreshToken(token) {
  try {
    const tokenHash = sha256(token);
    const [rows] = await query(
      'SELECT family FROM refresh_tokens WHERE token_hash = ?',
      [tokenHash]
    );
    if (rows.length > 0) {
      await query('DELETE FROM refresh_tokens WHERE family = ?', [rows[0].family]);
    }
  } catch {
    // Silently ignore — logout should always succeed
  }
}

/**
 * Get a user by ID, excluding password_hash.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getUserById(id) {
  const [rows] = await query(
    'SELECT id, role, name, email, phone, avatar_url, dob, gender, created_at, updated_at FROM users WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
  return rows[0] || null;
}
