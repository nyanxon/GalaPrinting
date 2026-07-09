/**
 * upload.routes.js — Standalone upload endpoints.
 *
 * Provides generic file upload endpoints for various use cases.
 * Returns the file path/URL that can be used in subsequent API calls.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { uploadDesign, uploadPayment, uploadChat, uploadAvatar, uploadProduct, uploadReview } from '../middleware/upload.js';
import { StorageService } from '../utils/storage.js';

const router = Router();

/**
 * POST /api/upload/design — Upload design file (customer/staff)
 * Usage: Custom order, design submission
 */
router.post('/design', authenticate, uploadDesign.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(422).json({ ok: false, message: 'File wajib diunggah.' });
    }
    const { path, url, fileName } = await StorageService.save(req.file, 'designs');
    return res.json({ ok: true, path, url, fileName });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/upload/payment — Upload payment proof (customer)
 * Usage: Payment proof submission
 */
router.post('/payment', authenticate, uploadPayment.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(422).json({ ok: false, message: 'File wajib diunggah.' });
    }
    const { path, url, fileName } = await StorageService.save(req.file, 'payments');
    return res.json({ ok: true, path, url, fileName });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/upload/avatar — Upload avatar (authenticated users)
 * Usage: Profile picture update
 */
router.post('/avatar', authenticate, uploadAvatar.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(422).json({ ok: false, message: 'File wajib diunggah.' });
    }
    const { path, url, fileName } = await StorageService.save(req.file, 'avatars');
    return res.json({ ok: true, path, url, fileName });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/upload/chat — Upload chat file (customer/staff)
 * Usage: Chat message attachment
 */
router.post('/chat', authenticate, uploadChat.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(422).json({ ok: false, message: 'File wajib diunggah.' });
    }
    const { path, url, fileName } = await StorageService.save(req.file, 'chat');
    return res.json({ ok: true, path, url, fileName });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/upload/product — Upload product image (admin only)
 * Usage: Product catalog management
 */
router.post('/product', authenticate, uploadProduct.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(422).json({ ok: false, message: 'File wajib diunggah.' });
    }
    const { path, url, fileName } = await StorageService.save(req.file, 'products');
    return res.json({ ok: true, path, url, fileName });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/upload/review — Upload review photo (customer)
 * Usage: Product review with photo
 */
router.post('/review', authenticate, uploadReview.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(422).json({ ok: false, message: 'File wajib diunggah.' });
    }
    const { path, url, fileName } = await StorageService.save(req.file, 'reviews');
    return res.json({ ok: true, path, url, fileName });
  } catch (err) {
    next(err);
  }
});

export default router;
