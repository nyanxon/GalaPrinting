/**
 * auth.routes.js — Authentication routes.
 *
 * Rate limits:
 *   - General auth:      100 req/min  (login, register, refresh)
 *   - Forgot password:     5 req/15min (prevent email spam)
 *   - Resend verification: 3 req/min   (prevent spam)
 *   - Reset password:     10 req/15min (prevent brute-force)
 *
 * Requirements: 4.1, 4.2, 4.6, 4.7, 4.8, 4.9, 15.6
 */

import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/auth.controller.js';

const router = Router();

const isProd = process.env.NODE_ENV === 'production';

// General auth limiter (login, register, refresh, logout)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 100 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Terlalu banyak permintaan. Coba lagi nanti.' },
});

// Tight limiter for forgot-password (prevent email bombing)
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProd ? 5 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Terlalu banyak permintaan reset password. Coba lagi dalam 15 menit.' },
});

// Reset-password limiter (prevent brute-force against tokens)
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Terlalu banyak percobaan. Coba lagi nanti.' },
});

// Resend verification limiter (prevent spam)
const resendLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isProd ? 3 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Silakan tunggu sebelum mengirim ulang email verifikasi.' },
});

// ── Routes ───────────────────────────────────────────────────────────────────

router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Nama lengkap wajib diisi.'),
    body('email').isEmail().normalizeEmail().withMessage('Email tidak valid.'),
    body('phone').trim().notEmpty().withMessage('Nomor handphone wajib diisi.')
      .matches(/^[0-9+\-\s]{8,20}$/).withMessage('Nomor handphone tidak valid.'),
    body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter.'),
    body('gender').isIn(['L', 'P']).withMessage('Jenis kelamin wajib dipilih.'),
    body('dob').notEmpty().withMessage('Tanggal lahir wajib diisi.')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Format tanggal lahir tidak valid.'),
  ],
  ctrl.register
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Email tidak valid.'),
    body('password').notEmpty().withMessage('Password wajib diisi.'),
  ],
  ctrl.login
);

router.post(
  '/admin-login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Email tidak valid.'),
    body('password').notEmpty().withMessage('Password wajib diisi.'),
  ],
  ctrl.adminLogin
);

router.post('/refresh', authLimiter, ctrl.refresh);
router.post('/logout',  authLimiter, ctrl.logout);
router.get('/me',       authenticate, ctrl.me);

router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Password lama wajib diisi.'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password baru minimal 6 karakter.'),
  ],
  ctrl.changePassword
);

// Email verification
router.get('/verify-email', ctrl.verifyEmail);
router.post('/resend-verification', resendLimiter, authenticate, ctrl.resendVerification);

// Forgot / reset password
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  [body('email').isEmail().normalizeEmail().withMessage('Email tidak valid.')],
  ctrl.forgotPassword
);

router.post(
  '/reset-password',
  resetPasswordLimiter,
  [
    body('token').notEmpty().withMessage('Token wajib diisi.'),
    body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter.'),
  ],
  ctrl.resetPassword
);

export default router;
