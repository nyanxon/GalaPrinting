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
import { config } from '../config/env.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from './email.service.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Hitung expires_at untuk refresh token berdasarkan durasi.
 * @param {number} days
 * @returns {string} MySQL DATETIME string
 */
function refreshExpiresAt(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Durasi refresh token dalam milidetik, sesuai rememberMe.
 * @param {boolean} rememberMe
 * @returns {{ days: number, ms: number }}
 */
function getRefreshDuration(rememberMe = false) {
  const days = rememberMe ? 30 : 1;
  const ms   = days * 24 * 60 * 60 * 1000;
  return { days, ms };
}

/**
 * Generate a cryptographically random URL-safe token.
 * Stored in DB as SHA-256 hash for safety; the raw token goes in the email link.
 * @returns {{ raw: string, hashed: string, expiresAt: string }}
 */
function generateToken(hoursValid = 24) {
  const raw      = crypto.randomBytes(32).toString('hex');
  const hashed   = sha256(raw);
  const expires  = new Date(Date.now() + hoursValid * 60 * 60 * 1000);
  const expiresAt = expires.toISOString().slice(0, 19).replace('T', ' ');
  return { raw, hashed, expiresAt };
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Register a new customer account.
 * Sends verification email after creating the user (fire-and-forget — never blocks registration).
 * @returns {Promise<object>} user row (without password_hash)
 */
export async function register({ name, email, phone, password, gender, dob }) {
  const [existing] = await query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    const err = new Error('Email sudah terdaftar.');
    err.status = 409;
    throw err;
  }

  const id   = randomUUID();
  const hash = await hashPassword(password);

  let dobValue = null;
  if (dob && dob !== '--') {
    const parsed = new Date(dob);
    if (!isNaN(parsed.getTime())) dobValue = dob;
  }

  // Generate verification token immediately
  const { raw, hashed, expiresAt } = generateToken(24);

  await query(
    `INSERT INTO users
       (id, role, name, email, phone, password_hash, gender, dob,
        is_email_verified, email_verification_token, email_verification_expires)
     VALUES (?, 'customer', ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [id, name, email, phone || null, hash, gender || null, dobValue, hashed, expiresAt]
  );

  const user = await getUserById(id);

  // Fire-and-forget — never block registration if email fails
  const verifyUrl = `${config.email.frontendUrl}/verify-email?token=${raw}`;
  sendVerificationEmail({ to: email, name, verifyUrl }).catch((err) => {
    console.error('[auth] Verification email send failed:', err.message);
  });

  return user;
}

/**
 * Validate credentials and return the user row, or null on failure.
 */
export async function login({ email, password }) {
  const [rows] = await query('SELECT * FROM users WHERE email = ?', [email]);
  if (rows.length === 0) return null;

  const user  = rows[0];
  const valid = await comparePassword(password, user.password_hash);
  if (!valid) return null;

  return user;
}

/**
 * Generate an access + refresh token pair and persist the refresh token.
 * @param {string}  userId
 * @param {boolean} rememberMe  true → 30 hari, false → 1 hari
 * @returns {{ accessToken: string, refreshToken: string, cookieMaxAge: number }}
 */
export async function createTokenPair(userId, rememberMe = false) {
  const [userRows] = await query(
    'SELECT id, role, name, email FROM users WHERE id = ?',
    [userId]
  );
  if (userRows.length === 0) throw new Error('User not found');
  const user = userRows[0];

  const { days, ms } = getRefreshDuration(rememberMe);
  const family       = randomUUID();
  const accessToken  = signAccessToken({ sub: user.id, role: user.role, name: user.name, email: user.email });
  const refreshToken = signRefreshToken(user.id, family);
  const tokenHash    = sha256(refreshToken);

  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, family, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), user.id, tokenHash, family, refreshExpiresAt(days)]
  );

  return { accessToken, refreshToken, cookieMaxAge: ms };
}

/**
 * Rotate a refresh token (detect reuse, issue new pair).
 * Mempertahankan durasi asli dari token yang dirotasi.
 *
 * Grace period: jika token sudah `used_at` tapi dalam 10 detik terakhir,
 * kembalikan token hasil rotasi sebelumnya (idempotent). Ini menangani
 * race condition dari concurrent refresh request (misal React StrictMode
 * double-mount, atau multiple tab) tanpa false-positive logout.
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
    // Grace period: jika token ini baru dipakai dalam 10 detik terakhir,
    // kemungkinan besar ini adalah concurrent request legitimate (bukan attack).
    // Kembalikan token rotasi terbaru dari family yang sama.
    const usedMs = Date.now() - new Date(stored.used_at).getTime();
    const GRACE_MS = 10_000; // 10 detik

    if (usedMs <= GRACE_MS) {
      // Cari token terbaru di family yang sama (hasil rotasi dari request sebelumnya)
      const [latestRows] = await query(
        `SELECT * FROM refresh_tokens
         WHERE family = ? AND used_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [stored.family]
      );

      if (latestRows.length > 0) {
        // Kembalikan access token baru tanpa rotasi ulang
        const [userRows] = await query(
          'SELECT id, role, name, email FROM users WHERE id = ?',
          [payload.sub]
        );
        if (userRows.length > 0) {
          const user = userRows[0];
          const newAccessToken = signAccessToken({
            sub: user.id, role: user.role, name: user.name, email: user.email,
          });
          const originalExpiresAt = new Date(latestRows[0].expires_at);
          const remainingMs = Math.max(originalExpiresAt - new Date(), 0);
          return { accessToken: newAccessToken, refreshToken: null, cookieMaxAge: remainingMs, reuseDetected: false };
        }
      }
    }

    // Di luar grace period → kemungkinan token theft → hapus seluruh family
    await query('DELETE FROM refresh_tokens WHERE family = ?', [stored.family]);
    const err = new Error('Token tidak valid atau sudah kedaluwarsa.');
    err.status = 401;
    throw err;
  }

  await query('UPDATE refresh_tokens SET used_at = NOW() WHERE id = ?', [stored.id]);

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

  const originalExpiresAt = new Date(stored.expires_at);
  const now               = new Date();
  const remainingMs       = Math.max(originalExpiresAt - now, 0);
  const remainingDays     = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  const expiresAt         = refreshExpiresAt(remainingDays || 1);

  const newAccessToken  = signAccessToken({ sub: user.id, role: user.role, name: user.name, email: user.email });
  const newRefreshToken = signRefreshToken(user.id, stored.family);
  const newHash         = sha256(newRefreshToken);

  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, family, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), user.id, newHash, stored.family, expiresAt]
  );

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, cookieMaxAge: remainingMs };
}

/**
 * Revoke all refresh tokens in the same family as the given token.
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
 * Get a user by ID, excluding password_hash.
 */
export async function getUserById(id) {
  const [rows] = await query(
    `SELECT id, role, name, email, phone, avatar_url, dob, gender,
            is_email_verified, created_at, updated_at
     FROM users WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] || null;
}

// ── Email Verification ────────────────────────────────────────────────────────

/**
 * Verify a user's email using the raw token from the URL.
 * @param {string} rawToken
 * @returns {{ ok: boolean, message: string }}
 */
export async function verifyEmail(rawToken) {
  if (!rawToken) return { ok: false, message: 'Token tidak valid.' };

  const hashed = sha256(rawToken);

  const [rows] = await query(
    `SELECT id, is_email_verified, email_verification_expires
     FROM users WHERE email_verification_token = ?`,
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
    `UPDATE users
     SET is_email_verified = 1,
         email_verification_token = NULL,
         email_verification_expires = NULL
     WHERE id = ?`,
    [user.id]
  );

  return { ok: true, message: 'Email berhasil diverifikasi!' };
}

/**
 * Resend verification email for a user (by email address).
 * Called with already-authenticated user from the controller.
 * @param {string} userId
 * @returns {{ ok: boolean, message: string }}
 */
export async function resendVerificationEmail(userId) {
  const [rows] = await query(
    'SELECT id, email, name, is_email_verified FROM users WHERE id = ? AND deleted_at IS NULL',
    [userId]
  );
  if (rows.length === 0) return { ok: false, message: 'User tidak ditemukan.' };

  const user = rows[0];
  if (user.is_email_verified) {
    return { ok: true, message: 'Email Anda sudah terverifikasi.' };
  }

  const { raw, hashed, expiresAt } = generateToken(24);

  await query(
    `UPDATE users
     SET email_verification_token = ?, email_verification_expires = ?
     WHERE id = ?`,
    [hashed, expiresAt, user.id]
  );

  const verifyUrl = `${config.email.frontendUrl}/verify-email?token=${raw}`;
  await sendVerificationEmail({ to: user.email, name: user.name, verifyUrl });

  return { ok: true, message: 'Email verifikasi telah dikirim ulang.' };
}

// ── Forgot / Reset Password ───────────────────────────────────────────────────

/**
 * Generate a password-reset token and send the reset email.
 * ALWAYS returns a generic success message (prevents user enumeration).
 * @param {string} email
 */
export async function forgotPassword(email) {
  const GENERIC_MSG = 'Jika email terdaftar, link reset password telah dikirim.';

  const [rows] = await query(
    'SELECT id, name FROM users WHERE email = ? AND deleted_at IS NULL',
    [email]
  );

  // Always respond the same — do not reveal whether the email exists
  if (rows.length === 0) return { ok: true, message: GENERIC_MSG };

  const user = rows[0];
  const { raw, hashed, expiresAt } = generateToken(1); // 1 hour validity

  await query(
    `UPDATE users
     SET reset_password_token = ?, reset_password_expires = ?
     WHERE id = ?`,
    [hashed, expiresAt, user.id]
  );

  const resetUrl = `${config.email.frontendUrl}/reset-password?token=${raw}`;

  // Fire-and-forget — never block response if email fails
  sendPasswordResetEmail({ to: email, name: user.name, resetUrl }).catch((err) => {
    console.error('[auth] Password reset email failed:', err.message);
  });

  return { ok: true, message: GENERIC_MSG };
}

/**
 * Reset password using a valid token.
 * Invalidates all existing refresh tokens on success.
 * @param {string} rawToken
 * @param {string} newPassword
 * @returns {{ ok: boolean, message: string }}
 */
export async function resetPassword(rawToken, newPassword) {
  if (!rawToken) return { ok: false, message: 'Token tidak valid.' };

  const hashed = sha256(rawToken);

  const [rows] = await query(
    'SELECT id, reset_password_expires FROM users WHERE reset_password_token = ?',
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
    `UPDATE users
     SET password_hash = ?,
         reset_password_token = NULL,
         reset_password_expires = NULL
     WHERE id = ?`,
    [newHash, user.id]
  );

  // Invalidate ALL refresh tokens so old sessions can't continue
  await query('DELETE FROM refresh_tokens WHERE user_id = ?', [user.id]);

  return { ok: true, message: 'Password berhasil direset. Silakan login dengan password baru Anda.' };
}
