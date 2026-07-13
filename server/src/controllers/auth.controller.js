/**
 * auth.controller.js — Request handlers for authentication endpoints.
 *
 * Requirements: 4.1, 4.2, 4.6, 4.7, 4.8, 4.9
 */

import { validationResult } from 'express-validator';
import * as authService from '../services/auth.service.js';
import { sendLoginNewDeviceEmail, sendLoginFailedAlertEmail } from '../services/email.service.js';
import { getPreferences } from '../services/notifications.service.js';
import { query } from '../db/connection.js';

// ── Failed login tracking (in-memory, per IP) ─────────────────────────────────
// Resets on restart — good enough for notifying owners without a Redis dep.
const failedLoginMap = new Map(); // ip → { count, lastAt }
const FAILED_THRESHOLD = 5; // alert after this many consecutive failures per IP

const REFRESH_COOKIE = 'refreshToken';

/** Cookie options dasar (tanpa maxAge — diset dinamis per request) */
const BASE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  secure:   process.env.NODE_ENV === 'production',
  path:     '/',
};

/**
 * Set refresh token cookie dengan maxAge yang sinkron dengan durasi token di DB.
 * @param {import('express').Response} res
 * @param {string} token
 * @param {number} maxAgeMs  Durasi cookie dalam milidetik
 */
function setRefreshCookie(res, token, maxAgeMs) {
  res.cookie(REFRESH_COOKIE, token, {
    ...BASE_COOKIE_OPTIONS,
    maxAge: maxAgeMs,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, BASE_COOKIE_OPTIONS);
}

// ── Existing endpoints ────────────────────────────────────────────────────────

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
    const user = await authService.register({ name, email, phone, password, gender, dob });
    // Register selalu 1 hari — user bisa pilih "ingat saya" saat login berikutnya
    const { accessToken, refreshToken, cookieMaxAge } = await authService.createTokenPair(user.id, false);

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

// POST /api/auth/login
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

    const user = await authService.login({ email, password });

    if (!user) {
      // Track failed attempts per IP and fire alert email if threshold reached
      const key = `${ip}:${email}`;
      const entry = failedLoginMap.get(key) || { count: 0 };
      entry.count += 1;
      entry.lastAt = Date.now();
      failedLoginMap.set(key, entry);

      if (entry.count >= FAILED_THRESHOLD) {
        // Find the user by email to check their preferences and get their email
        const [rows] = await query('SELECT id, email, name FROM users WHERE email = ? LIMIT 1', [email]);
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

      return res.status(401).json({ ok: false, message: 'Email atau password salah.' });
    }

    if (user.deleted_at) {
      return res.status(401).json({ ok: false, message: 'Akun tidak aktif.' });
    }

    // Clear failed attempt counter on successful login
    failedLoginMap.delete(`${ip}:${email}`);

    // rememberMe: true → 30 hari, false/default → 1 hari
    const remember = Boolean(rememberMe);
    const { accessToken, refreshToken, cookieMaxAge } = await authService.createTokenPair(user.id, remember);
    setRefreshCookie(res, refreshToken, cookieMaxAge);

    const { password_hash: _, ...safeUser } = user;

    // Fire login_new_device notification (fire-and-forget, preference-gated)
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
      // Inform the client if the email is not yet verified (soft warning, not a block)
      emailVerified: Boolean(user.is_email_verified),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/refresh
export async function refresh(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      return res.status(401).json({ ok: false, message: 'Token tidak valid atau sudah kedaluwarsa.' });
    }

    const { accessToken, refreshToken, cookieMaxAge } = await authService.rotateRefreshToken(token);

    // Jika refreshToken null, ini adalah grace period response — hanya kirim access token baru
    // tanpa update cookie (cookie masih valid dengan token hasil rotasi sebelumnya).
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

// POST /api/auth/logout
export async function logout(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await authService.revokeRefreshToken(token);
    clearRefreshCookie(res);
    return res.json({ ok: true, message: 'Berhasil keluar.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
export async function me(req, res, next) {
  try {
    const user = await authService.getUserById(req.user.id);
    if (!user) return res.status(404).json({ ok: false, message: 'User tidak ditemukan.' });
    return res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

// ── Email Verification ────────────────────────────────────────────────────────

// GET /api/auth/verify-email?token=xxx
export async function verifyEmail(req, res, next) {
  try {
    const { token } = req.query;
    const result = await authService.verifyEmail(token);
    return res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/resend-verification
// Requires authentication — user must be logged in to request a resend
export async function resendVerification(req, res, next) {
  try {
    const result = await authService.resendVerificationEmail(req.user.id);
    return res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    next(err);
  }
}

// ── Forgot / Reset Password ───────────────────────────────────────────────────

// POST /api/auth/forgot-password
export async function forgotPassword(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ ok: false, message: 'Email tidak valid.' });
    }
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    // Always 200 to prevent user enumeration
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
    const result = await authService.resetPassword(token, password);
    return res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    next(err);
  }
}
