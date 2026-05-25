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
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, COOKIE_OPTIONS);
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, sameSite: 'strict' });
}

// POST /api/auth/register
export async function register(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ ok: false, message: 'Validasi gagal.', errors: errors.mapped() });
    }

    const { name, email, phone, password, gender, dob } = req.body;
    const user = await authService.register({ name, email, phone, password, gender, dob });
    const { accessToken, refreshToken } = await authService.createTokenPair(user.id);

    setRefreshCookie(res, refreshToken);
    return res.status(201).json({ ok: true, accessToken, user });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
export async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ ok: false, message: 'Validasi gagal.', errors: errors.mapped() });
    }

    const { email, password } = req.body;
    const user = await authService.login({ email, password });

    if (!user) {
      return res.status(401).json({ ok: false, message: 'Email atau password salah.' });
    }

    // Check soft-deleted
    if (user.deleted_at) {
      return res.status(401).json({ ok: false, message: 'Akun tidak aktif.' });
    }

    const { accessToken, refreshToken } = await authService.createTokenPair(user.id);
    setRefreshCookie(res, refreshToken);

    // Return user without password_hash
    const { password_hash: _, ...safeUser } = user;
    return res.json({ ok: true, accessToken, user: safeUser });
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
    if (token) {
      await authService.revokeRefreshToken(token);
    }
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
    if (!user) {
      return res.status(404).json({ ok: false, message: 'User tidak ditemukan.' });
    }
    return res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}
