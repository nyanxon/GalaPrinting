/**
 * auth.controller.js — Request handlers for authentication endpoints.
 *
 * Split into customer-only and admin-only paths:
 *   - POST /login         → customerAuth (users_customer only)
 *   - POST /admin-login   → adminAuth   (users_admin only)
 *   - POST /register      → customerAuth only
 *   - POST /refresh       → shared (dispatches by user_type on refresh_tokens)
 *   - POST /logout        → shared
 *   - GET  /me            → shared
 *   - GET  /verify-email  → shared (checks both tables)
 *   - POST /resend-verification → shared
 *   - POST /forgot-password    → customer only
 *   - POST /reset-password     → customer only
 *
 * Requirements: 4.1, 4.2, 4.6, 4.7, 4.8, 4.9
 */

import crypto from 'crypto';
import { validationResult } from 'express-validator';
import * as customerAuth from '../services/customerAuth.service.js';
import * as adminAuth from '../services/adminAuth.service.js';
import { sendLoginNewDeviceEmail, sendLoginFailedAlertEmail } from '../services/email.service.js';
import { getPreferences } from '../services/notifications.service.js';
import { query } from '../db/connection.js';
import { STAFF_ROLES } from '../config/roles.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Determine user_type from the refresh token row without rotating it.
 * Returns 'customer' | 'admin' | null.
 */
async function getUserTypeFromRefreshToken(token) {
  if (!token) return null;
  try {
    const tokenHash = sha256(token);
    const [rows] = await query(
      'SELECT user_type FROM refresh_tokens WHERE token_hash = ?',
      [tokenHash]
    );
    return rows.length > 0 ? rows[0].user_type : null;
  } catch {
    return null;
  }
}

/** Return the auth service that matches a user_type. */
function svc(userType) {
  return userType === 'admin' ? adminAuth : customerAuth;
}

// ── Shared cookie helpers ─────────────────────────────────────────────────────

const REFRESH_COOKIE = 'refreshToken';

const BASE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  secure:   process.env.NODE_ENV === 'production',
  path:     '/',
};

function setRefreshCookie(res, token, maxAgeMs) {
  res.cookie(REFRESH_COOKIE, token, {
    ...BASE_COOKIE_OPTIONS,
    maxAge: maxAgeMs,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, BASE_COOKIE_OPTIONS);
}

// ── Failed login tracking (in-memory, per IP) ─────────────────────────────────

const failedLoginMap = new Map();
const FAILED_THRESHOLD = 5;

/**
 * Shared failed-login tracking + alert email.
 * @param {'customer'|'admin'} loginType  Which table was queried.
 */
async function handleFailedLogin({ loginType, email, ip, timeStr }) {
  const key = `${loginType}:${ip}:${email}`;
  const entry = failedLoginMap.get(key) || { count: 0 };
  entry.count += 1;
  entry.lastAt = Date.now();
  failedLoginMap.set(key, entry);

  if (entry.count >= FAILED_THRESHOLD) {
    const table = loginType === 'admin' ? 'users_admin' : 'users_customer';
    const [rows] = await query(`SELECT id, email, name FROM ${table} WHERE email = ? LIMIT 1`, [email]);
    if (rows.length > 0) {
      const targetUser = rows[0];
      (async () => {
        try {
          const prefs = await getPreferences(targetUser.id);
          if (prefs.login_failed_alert) {
            await sendLoginFailedAlertEmail({
              to:       targetUser.email,
              name:     targetUser.name,
              attempts: entry.count,
              ip,
              time:     timeStr,
            });
          }
        } catch (e) {
          console.error('[auth] login_failed_alert email error:', e.message);
        }
      })();
    }
  }
}

function clearFailedLogin({ loginType, email, ip }) {
  failedLoginMap.delete(`${loginType}:${ip}:${email}`);
}

// ── Shared post-login logic ──────────────────────────────────────────────────

/**
 * Issue tokens, set cookie, send notifications, and return the response.
 * Used by both login and adminLogin.
 */
async function completeLogin({ res, user, rememberMe, ip, ua, timeStr }) {
  const remember = Boolean(rememberMe);
  const { accessToken, refreshToken, cookieMaxAge } = await svc(user._userType || 'customer').createTokenPair(user.id, remember);
  setRefreshCookie(res, refreshToken, cookieMaxAge);

  const { password_hash: _, ...safeUser } = user;

  if (user.id) {
    (async () => {
      try {
        const prefs = await getPreferences(user.id);
        if (prefs.login_new_device) {
          await sendLoginNewDeviceEmail({
            to:     user.email,
            name:   user.name,
            device: ua,
            ip,
            time:   timeStr,
          });
        }
      } catch (e) {
        console.error('[auth] login_new_device email error:', e.message);
      }
    })();
  }

  return res.json({
    ok: true,
    accessToken,
    user: safeUser,
    rememberMe: remember,
    emailVerified: Boolean(user.is_email_verified),
    mustChangePassword: Boolean(user.must_change_password),
  });
}

// ── Customer-only endpoints ──────────────────────────────────────────────────

// POST /api/auth/register
export async function register(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const mapped = errors.mapped();
      const firstMsg = Object.values(mapped)[0]?.msg || 'Silahkan masukkan Email dan Password.';
      return res.status(422).json({ ok: false, message: firstMsg, errors: mapped });
    }

    const { name, email, phone, password, gender, dob } = req.body;
    const user = await customerAuth.register({ name, email, phone, password, gender, dob });
    user._userType = 'customer';
    const { accessToken, refreshToken, cookieMaxAge } = await customerAuth.createTokenPair(user.id, false);

    setRefreshCookie(res, refreshToken, cookieMaxAge);
    return res.status(201).json({
      ok: true,
      accessToken,
      user,
      emailVerificationSent: true,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login  (customer only)
export async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const mapped = errors.mapped();
      const firstMsg = Object.values(mapped)[0]?.msg || 'Silahkan masukkan Email dan Password.';
      return res.status(422).json({ ok: false, message: firstMsg, errors: mapped });
    }

    const { email, password, rememberMe } = req.body;
    const ip = req.ip || req.socket?.remoteAddress || '—';
    const ua = req.headers['user-agent'] || 'Tidak diketahui';
    const timeStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });

    const user = await customerAuth.login({ email, password });

    if (!user) {
      await handleFailedLogin({ loginType: 'customer', email, ip, timeStr });
      return res.status(401).json({ ok: false, message: 'Email atau password salah.' });
    }

    if (user.deleted_at) {
      return res.status(401).json({ ok: false, message: 'Akun tidak aktif.' });
    }

    clearFailedLogin({ loginType: 'customer', email, ip });
    user._userType = 'customer';
    return completeLogin({ res, user, rememberMe, ip, ua, timeStr });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/admin-login  (staff only)
export async function adminLogin(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const mapped = errors.mapped();
      const firstMsg = Object.values(mapped)[0]?.msg || 'Silahkan masukkan Email dan Password.';
      return res.status(422).json({ ok: false, message: firstMsg, errors: mapped });
    }

    const { email, password, rememberMe } = req.body;
    const ip = req.ip || req.socket?.remoteAddress || '—';
    const ua = req.headers['user-agent'] || 'Tidak diketahui';
    const timeStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });

    const user = await adminAuth.login({ email, password });

    if (!user) {
      await handleFailedLogin({ loginType: 'admin', email, ip, timeStr });
      return res.status(401).json({ ok: false, message: 'Email atau password salah.' });
    }

    if (user.deleted_at) {
      return res.status(401).json({ ok: false, message: 'Akun tidak aktif.' });
    }

    clearFailedLogin({ loginType: 'admin', email, ip });
    user._userType = 'admin';
    return completeLogin({ res, user, rememberMe, ip, ua, timeStr });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/refresh  (shared)
export async function refresh(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      return res.status(401).json({ ok: false, message: 'Token tidak valid atau sudah kedaluwarsa.' });
    }

    const userType = await getUserTypeFromRefreshToken(token);
    const service = svc(userType);
    const { accessToken, refreshToken, cookieMaxAge } = await service.rotateRefreshToken(token);

    if (refreshToken !== null) {
      setRefreshCookie(res, refreshToken, cookieMaxAge || 24 * 60 * 60 * 1000);
    }

    return res.json({ ok: true, accessToken });
  } catch (err) {
    if (err.status === 401) {
      clearRefreshCookie(res);
      return res.status(401).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

// POST /api/auth/logout  (shared)
export async function logout(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      const userType = await getUserTypeFromRefreshToken(token);
      const service = svc(userType);
      await service.revokeRefreshToken(token);
    }
    clearRefreshCookie(res);
    return res.json({ ok: true, message: 'Berhasil keluar.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me  (shared)
export async function me(req, res, next) {
  try {
    const service = STAFF_ROLES.includes(req.user.role) ? adminAuth : customerAuth;
    const user = await service.getUserById(req.user.id);
    if (!user) return res.status(404).json({ ok: false, message: 'User tidak ditemukan.' });
    return res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

// ── Email Verification ────────────────────────────────────────────────────────

// GET /api/auth/verify-email?token=xxx  (shared — checks both tables)
export async function verifyEmail(req, res, next) {
  try {
    const { token } = req.query;
    let result = await customerAuth.verifyEmail(token);
    if (!result.ok && result.message === 'Link verifikasi tidak valid atau sudah digunakan.') {
      result = await adminAuth.verifyEmail(token);
    }
    return res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/resend-verification  (shared)
export async function resendVerification(req, res, next) {
  try {
    const service = STAFF_ROLES.includes(req.user.role) ? adminAuth : customerAuth;
    const result = await service.resendVerificationEmail(req.user.id);
    return res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    next(err);
  }
}

// ── Forgot / Reset Password (customer only for now) ──────────────────────────

// POST /api/auth/forgot-password
export async function forgotPassword(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ ok: false, message: 'Email tidak valid.' });
    }
    const { email } = req.body;
    const result = await customerAuth.forgotPassword(email);
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/reset-password
export async function resetPassword(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ ok: false, message: 'Password minimal 6 karakter.' });
    }
    const { token, password } = req.body;
    const result = await customerAuth.resetPassword(token, password);
    return res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    next(err);
  }
}

// ── Change Password (authenticated) ────────────────────────────────────────

// POST /api/auth/change-password
export async function changePassword(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const mapped = errors.mapped();
      const firstMsg = Object.values(mapped)[0]?.msg || 'Validasi gagal.';
      return res.status(422).json({ ok: false, message: firstMsg, errors: mapped });
    }

    const { currentPassword, newPassword } = req.body;
    const service = STAFF_ROLES.includes(req.user.role) ? adminAuth : customerAuth;

    const result = await service.changePassword(req.user.id, { currentPassword, newPassword });

    // Issue a fresh token pair so the current session continues seamlessly
    const { accessToken, refreshToken, cookieMaxAge } = await service.createTokenPair(req.user.id, false);
    setRefreshCookie(res, refreshToken, cookieMaxAge);

    return res.json({ ok: true, accessToken, message: result.message });
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json({ ok: false, message: err.message });
    }
    next(err);
  }
}
