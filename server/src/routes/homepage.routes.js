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
import { uploadHomepage } from '../middleware/upload.js';
import * as ctrl from '../controllers/homepage.controller.js';

const router = Router();

// ── Image Upload (central multer config — 10 MB, images only) ─────────────────
router.post(
  '/upload-image',
  authenticate,
  requireRole('admin', 'owner'),
  uploadHomepage.single('image'),
  ctrl.uploadHomepageImage
);

// ── Hero Banners (carousel — up to 8 slides) ──────────────────────────────────
router.get('/hero',     ctrl.listHeroBanners);   // public — active slides
router.get('/hero/all', authenticate, requireRole('admin', 'owner'), ctrl.listAllHeroBanners); // admin

router.post(
  '/hero',
  authenticate,
  requireRole('admin', 'owner'),
  ctrl.createHeroBanner
);

router.put(
  '/hero/reorder',
  authenticate,
  requireRole('admin', 'owner'),
  ctrl.reorderHeroBanners
);

router.put(
  '/hero/:id',
  authenticate,
  requireRole('admin', 'owner'),
  ctrl.updateHeroBanner
);

router.delete(
  '/hero/:id',
  authenticate,
  requireRole('admin', 'owner'),
  ctrl.deleteHeroBanner
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
