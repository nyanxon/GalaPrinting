/**
 * auth.controller.js — Request handlers for authentication endpoints.
 *
 * Requirements: 4.1, 4.2, 4.6, 4.7, 4.8, 4.9
 */

import { validationResult } from 'express-validator';
import * as authService from '../services/auth.service.js';

const REFRESH_COOKIE = 'refreshToken';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, COOKIE_OPTIONS);
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
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
    const { accessToken, refreshToken } = await authService.createTokenPair(user.id);

    setRefreshCookie(res, refreshToken);
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

    const { email, password } = req.body;
    const user = await authService.login({ email, password });

    if (!user) {
      return res.status(401).json({ ok: false, message: 'Email atau password salah.' });
    }

    if (user.deleted_at) {
      return res.status(401).json({ ok: false, message: 'Akun tidak aktif.' });
    }

    const { accessToken, refreshToken } = await authService.createTokenPair(user.id);
    setRefreshCookie(res, refreshToken);

    const { password_hash: _, ...safeUser } = user;
    return res.json({
      ok: true,
      accessToken,
      user: safeUser,
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

    const { accessToken, refreshToken } = await authService.rotateRefreshToken(token);
    setRefreshCookie(res, refreshToken);
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
