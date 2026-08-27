/**
 * adminAuth.service.js — Authentication logic for admin/staff accounts.
 *
 * Operates exclusively against the `users_admin` table.
 * JWT payload reads `role` from the row (admin/owner/cashier/cs/operational/qc/offline).
 */

import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { query } from '../db/connection.js';
import { hashPassword, comparePassword } from '../utils/hash.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { config } from '../config/env.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from './email.service.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function refreshExpiresAt(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function getRefreshDuration(rememberMe = false) {
  const days = rememberMe ? 30 : 1;
  const ms   = days * 24 * 60 * 60 * 1000;
  return { days, ms };
}

function generateToken(hoursValid = 24) {
  const raw      = crypto.randomBytes(32).toString('hex');
  const hashed   = sha256(raw);
  const expires  = new Date(Date.now() + hoursValid * 60 * 60 * 1000);
  const expiresAt = expires.toISOString().slice(0, 19).replace('T', ' ');
  return { raw, hashed, expiresAt };
}

// ── User lookups ─────────────────────────────────────────────────────────────

/**
 * Look up an admin/staff by ID. Returns the row with its role column, without password_hash.
 */
async function findUserById(id) {
  const [rows] = await query(
    `SELECT id, role, name, email, phone, avatar_url, dob, gender,
            is_email_verified, is_promoted_admin, must_change_password,
            created_at, updated_at
     FROM users_admin WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] || null;
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Validate admin/staff credentials. Returns the user row or null.
 */
export async function login({ email, password }) {
  const [rows] = await query('SELECT * FROM users_admin WHERE email = ?', [email]);
  if (rows.length === 0) return null;

  const user  = rows[0];
  const valid = await comparePassword(password, user.password_hash);
  if (!valid) return null;

  return user;
}

/**
 * Generate access + refresh token pair for an admin/staff user.
 */
export async function createTokenPair(userId, rememberMe = false) {
  const user = await findUserById(userId);
  if (!user) throw new Error('User not found');

  const { days, ms } = getRefreshDuration(rememberMe);
  const family       = randomUUID();
  const accessToken  = signAccessToken({ sub: user.id, role: user.role, name: user.name, email: user.email });
  const refreshToken = signRefreshToken(user.id, family);
  const tokenHash    = sha256(refreshToken);

  await query(
    `INSERT INTO refresh_tokens (id, user_id, user_type, token_hash, family, expires_at)
     VALUES (?, ?, 'admin', ?, ?, ?)`,
    [randomUUID(), user.id, tokenHash, family, refreshExpiresAt(days)]
  );

  return { accessToken, refreshToken, cookieMaxAge: ms };
}

/**
 * Rotate an admin refresh token (detect reuse, issue new pair).
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
  const [rows] = await query('SELECT * FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);

  if (rows.length === 0) {
    const err = new Error('Token tidak valid atau sudah kedaluwarsa.');
    err.status = 401;
    throw err;
  }

  const stored = rows[0];

  if (stored.used_at !== null) {
    const usedMs = Date.now() - new Date(stored.used_at).getTime();
    const GRACE_MS = 10_000;

    if (usedMs <= GRACE_MS) {
      const [latestRows] = await query(
        `SELECT * FROM refresh_tokens
         WHERE family = ? AND used_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [stored.family]
      );

      if (latestRows.length > 0) {
        const user = await findUserById(payload.sub);
        if (user) {
          const newAccessToken = signAccessToken({
            sub: user.id, role: user.role, name: user.name, email: user.email,
          });
          const originalExpiresAt = new Date(latestRows[0].expires_at);
          const remainingMs = Math.max(originalExpiresAt - new Date(), 0);
          return { accessToken: newAccessToken, refreshToken: null, cookieMaxAge: remainingMs, reuseDetected: false };
        }
      }
    }

    await query('DELETE FROM refresh_tokens WHERE family = ?', [stored.family]);
    const err = new Error('Token tidak valid atau sudah kedaluwarsa.');
    err.status = 401;
    throw err;
  }

  await query('UPDATE refresh_tokens SET used_at = NOW() WHERE id = ?', [stored.id]);

  const user = await findUserById(payload.sub);
  if (!user) {
    const err = new Error('Token tidak valid atau sudah kedaluwarsa.');
    err.status = 401;
    throw err;
  }

  const originalExpiresAt = new Date(stored.expires_at);
  const now               = new Date();
  const remainingMs       = Math.max(originalExpiresAt - now, 0);
  const remainingDays     = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  const expiresAt         = refreshExpiresAt(remainingDays || 1);

  const newAccessToken  = signAccessToken({ sub: user.id, role: user.role, name: user.name, email: user.email });
  const newRefreshToken = signRefreshToken(user.id, stored.family);
  const newHash         = sha256(newRefreshToken);

  await query(
    `INSERT INTO refresh_tokens (id, user_id, user_type, token_hash, family, expires_at)
     VALUES (?, ?, 'admin', ?, ?, ?)`,
    [randomUUID(), user.id, newHash, stored.family, expiresAt]
  );

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, cookieMaxAge: remainingMs };
}

/**
 * Revoke all refresh tokens in the same family.
 */
export async function revokeRefreshToken(token) {
  try {
    const tokenHash = sha256(token);
    const [rows] = await query('SELECT family FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
    if (rows.length > 0) {
      await query('DELETE FROM refresh_tokens WHERE family = ?', [rows[0].family]);
    }
  } catch {
    // Silently ignore — logout should always succeed
  }
}

/**
 * Get an admin/staff by ID, excluding password_hash. Attaches user_permissions.
 */
export async function getUserById(id) {
  const user = await findUserById(id);
  if (!user) return null;

  const [permRows] = await query(
    'SELECT permission_key FROM user_permissions WHERE user_id = ?',
    [id]
  );

  if (permRows.length === 0) {
    user.permissions = null;
  } else {
    const keys = permRows.map((r) => r.permission_key).filter((k) => k !== '__none__');
    user.permissions = keys;
  }

  return user;
}

// ── Email Verification ────────────────────────────────────────────────────────

export async function verifyEmail(rawToken) {
  if (!rawToken) return { ok: false, message: 'Token tidak valid.' };

  const hashed = sha256(rawToken);

  const [rows] = await query(
    `SELECT id, is_email_verified, email_verification_expires
     FROM users_admin WHERE email_verification_token = ?`,
    [hashed]
  );

  if (rows.length === 0) {
    return { ok: false, message: 'Link verifikasi tidak valid atau sudah digunakan.' };
  }

  const user = rows[0];

  if (user.is_email_verified) {
    return { ok: true, message: 'Email sudah terverifikasi sebelumnya.' };
  }

  const now = new Date();
  if (user.email_verification_expires && new Date(user.email_verification_expires) < now) {
    return { ok: false, message: 'Link verifikasi sudah kedaluwarsa. Silakan minta link baru.' };
  }

  await query(
    `UPDATE users_admin
     SET is_email_verified = 1,
         email_verification_token = NULL,
         email_verification_expires = NULL
     WHERE id = ?`,
    [user.id]
  );

  return { ok: true, message: 'Email berhasil diverifikasi!' };
}

export async function resendVerificationEmail(userId) {
  const [rows] = await query(
    "SELECT id, email, name, is_email_verified FROM users_admin WHERE id = ? AND deleted_at IS NULL",
    [userId]
  );
  if (rows.length === 0) return { ok: false, message: 'User tidak ditemukan.' };

  const user = rows[0];
  if (user.is_email_verified) {
    return { ok: true, message: 'Email Anda sudah terverifikasi.' };
  }

  const { raw, hashed, expiresAt } = generateToken(24);

  await query(
    `UPDATE users_admin
     SET email_verification_token = ?, email_verification_expires = ?
     WHERE id = ?`,
    [hashed, expiresAt, user.id]
  );

  const verifyUrl = `${config.email.frontendUrl}/verify-email?token=${raw}`;
  await sendVerificationEmail({ to: user.email, name: user.name, verifyUrl });

  return { ok: true, message: 'Email verifikasi telah dikirim ulang.' };
}

// ── Forgot / Reset Password ───────────────────────────────────────────────────

export async function forgotPassword(email) {
  const GENERIC_MSG = 'Jika email terdaftar, link reset password telah dikirim.';

  const [rows] = await query(
    'SELECT id, name FROM users_admin WHERE email = ? AND deleted_at IS NULL',
    [email]
  );

  if (rows.length === 0) return { ok: true, message: GENERIC_MSG };

  const user = rows[0];
  const { raw, hashed, expiresAt } = generateToken(1);

  await query(
    `UPDATE users_admin
     SET reset_password_token = ?, reset_password_expires = ?
     WHERE id = ?`,
    [hashed, expiresAt, user.id]
  );

  const resetUrl = `${config.email.frontendUrl}/reset-password?token=${raw}`;

  sendPasswordResetEmail({ to: email, name: user.name, resetUrl }).catch((err) => {
    console.error('[adminAuth] Password reset email failed:', err.message);
  });

  return { ok: true, message: GENERIC_MSG };
}

export async function resetPassword(rawToken, newPassword) {
  if (!rawToken) return { ok: false, message: 'Token tidak valid.' };

  const hashed = sha256(rawToken);

  const [rows] = await query(
    'SELECT id, reset_password_expires FROM users_admin WHERE reset_password_token = ?',
    [hashed]
  );

  if (rows.length === 0) {
    return { ok: false, message: 'Link reset password tidak valid atau sudah digunakan.' };
  }

  const user = rows[0];
  const now  = new Date();

  if (user.reset_password_expires && new Date(user.reset_password_expires) < now) {
    return { ok: false, message: 'Link reset password sudah kedaluwarsa. Silakan minta link baru.' };
  }

  const newHash = await hashPassword(newPassword);

  await query(
    `UPDATE users_admin
     SET password_hash = ?,
         reset_password_token = NULL,
         reset_password_expires = NULL
     WHERE id = ?`,
    [newHash, user.id]
  );

  await query("DELETE FROM refresh_tokens WHERE user_id = ? AND user_type = 'admin'", [user.id]);

  return { ok: true, message: 'Password berhasil direset. Silakan login dengan password baru Anda.' };
}

// ── Account creation (Owner-only) ────────────────────────────────────────────

/**
 * Create a brand-new staff account from scratch (not promote).
 * Owner sets the initial password directly. The account is flagged
 * must_change_password = true so the staff member must change it on
 * first login.
 *
 * @param {{ name, email, role, password }} data
 * @returns {Promise<object>} the new user row (without password_hash)
 */
export async function createStaffAccount({ name, email, role, password }) {
  const [existing] = await query('SELECT id FROM users_admin WHERE email = ?', [email]);
  if (existing.length > 0) {
    const err = new Error('Email sudah terdaftar.');
    err.status = 409;
    throw err;
  }

  const id   = randomUUID();
  const hash = await hashPassword(password);

  await query(
    `INSERT INTO users_admin
       (id, role, name, email, password_hash, must_change_password)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [id, role, name, email, hash]
  );

  return findUserById(id);
}

// ── Change password (authenticated) ──────────────────────────────────────────

/**
 * Change password for a logged-in admin/staff user.
 * Verifies the current password, hashes the new one, clears
 * must_change_password, and invalidates all existing refresh tokens.
 *
 * @param {string} userId
 * @param {{ currentPassword, newPassword }} data
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function changePassword(userId, { currentPassword, newPassword }) {
  const [rows] = await query(
    'SELECT id, password_hash FROM users_admin WHERE id = ? AND deleted_at IS NULL',
    [userId]
  );
  if (rows.length === 0) {
    return { ok: false, message: 'User tidak ditemukan.' };
  }

  const user = rows[0];
  const valid = await comparePassword(currentPassword, user.password_hash);
  if (!valid) {
    const err = new Error('Password lama salah.');
    err.status = 401;
    throw err;
  }

  const newHash = await hashPassword(newPassword);

  await query(
    `UPDATE users_admin
     SET password_hash = ?, must_change_password = 0
     WHERE id = ?`,
    [newHash, userId]
  );

  // Invalidate all existing refresh tokens (forces re-login with new password)
  await query("DELETE FROM refresh_tokens WHERE user_id = ? AND user_type = 'admin'", [userId]);

  return { ok: true, message: 'Password berhasil diubah.' };
}
