/**
 * homepage.routes.js — Routes for dynamic Homepage content management.
 *
 * Public  (GET)  : hero, design-items, cat-banners
 * Admin   (write): require authenticate + requireRole('admin','owner')
 */

import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import multer from 'multer';
import os from 'os';
import * as ctrl from '../controllers/homepage.controller.js';

const router = Router();

// ── Multer for homepage image uploads (10 MB, images only) ───────────────────
const uploadHomepage = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error(`Tipe file '${file.mimetype}' tidak didukung.`);
      err.status = 415;
      cb(err, false);
    }
  },
});

// ── Image Upload ──────────────────────────────────────────────────────────────
router.post(
  '/upload-image',
  authenticate,
  requireRole('admin', 'owner'),
  uploadHomepage.single('image'),
  ctrl.uploadHomepageImage
);

// ── Hero ──────────────────────────────────────────────────────────────────────
router.get('/hero', ctrl.getHero);

router.put(
  '/hero',
  authenticate,
  requireRole('admin', 'owner'),
  ctrl.saveHero
);

// ── Design Showcase Items ─────────────────────────────────────────────────────
router.get('/design-items',     ctrl.listDesignItems);         // public
router.get('/design-items/all', authenticate, requireRole('admin', 'owner'), ctrl.listAllDesignItems); // admin

router.post(
  '/design-items',
  authenticate,
  requireRole('admin', 'owner'),
  [body('imagePath').trim().notEmpty().withMessage('Gambar wajib diunggah.')],
  ctrl.createDesignItem
);

router.put(
  '/design-items/reorder',
  authenticate,
  requireRole('admin', 'owner'),
  ctrl.reorderDesignItems
);

router.put(
  '/design-items/:id',
  authenticate,
  requireRole('admin', 'owner'),
  ctrl.updateDesignItem
);

router.delete(
  '/design-items/:id',
  authenticate,
  requireRole('admin', 'owner'),
  ctrl.deleteDesignItem
);

// ── Category Banners ──────────────────────────────────────────────────────────
router.get('/cat-banners',     ctrl.listCatBanners);   // public
router.get('/cat-banners/map', ctrl.getCatBannersMap); // public — keyed map

router.post(
  '/cat-banners',
  authenticate,
  requireRole('admin', 'owner'),
  ctrl.saveCatBanner
);

router.put(
  '/cat-banners',
  authenticate,
  requireRole('admin', 'owner'),
  ctrl.saveCatBanner
);

router.delete(
  '/cat-banners/:id',
  authenticate,
  requireRole('admin', 'owner'),
  ctrl.deleteCatBanner
);

export default router;
