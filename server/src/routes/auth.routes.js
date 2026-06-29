/**
 * auth.routes.js — Authentication routes.
 * Rate limited to 100 req/min per IP.
 *
 * Requirements: 4.1, 4.2, 4.6, 4.7, 4.8, 4.9, 15.6
 */

import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/auth.controller.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 100 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Terlalu banyak permintaan. Coba lagi nanti.' },
});

router.use(authLimiter);

router.post(
  '/register',
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
  [
    body('email').isEmail().normalizeEmail().withMessage('Email tidak valid.'),
    body('password').notEmpty().withMessage('Password wajib diisi.'),
  ],
  ctrl.login
);

router.post('/refresh', ctrl.refresh);
// Logout does NOT require a valid access token — the refresh cookie is enough
// to identify and revoke the session. Requiring authenticate here would block
// logout whenever the access token has already expired, leaving the refresh
// token alive in the DB until it expires naturally.
router.post('/logout', ctrl.logout);
router.get('/me', authenticate, ctrl.me);

export default router;
