/**
 * homepage.controller.js — Request handlers for Homepage Management endpoints.
 */

import { validationResult } from 'express-validator';
import * as svc from '../services/homepage.service.js';
import { StorageService } from '../utils/storage.js';

// ── Image Upload ──────────────────────────────────────────────────────────────

/**
 * POST /api/homepage/upload-image
 * Accepts a single image and returns a persistent URL.
 */
export async function uploadHomepageImage(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ ok: false, message: 'File gambar wajib diunggah.' });
  }
  try {
    const saved = await StorageService.save(req.file, 'homepage');
    return res.json({ ok: true, url: saved.url });
  } catch (err) {
    next(err);
  }
}

// ── Hero Banners (carousel) ───────────────────────────────────────────────────

/** GET /api/homepage/hero — public: all active slides */
export async function listHeroBanners(req, res, next) {
  try {
    const banners = await svc.listHeroBanners();
    return res.json({ ok: true, data: banners });
  } catch (err) {
    next(err);
  }
}

/** GET /api/homepage/hero/all — admin: all including inactive */
export async function listAllHeroBanners(req, res, next) {
  try {
    const banners = await svc.listAllHeroBanners();
    return res.json({ ok: true, data: banners });
  } catch (err) {
    next(err);
  }
}

/** POST /api/homepage/hero — admin */
export async function createHeroBanner(req, res, next) {
  try {
    const { title, subtitle, imagePath, ctaUrl, sortOrder } = req.body;
    const banner = await svc.createHeroBanner({ title, subtitle, imagePath, ctaUrl, sortOrder });
    return res.status(201).json({ ok: true, data: banner });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/homepage/hero/:id — admin */
export async function updateHeroBanner(req, res, next) {
  try {
    const { title, subtitle, imagePath, ctaUrl, sortOrder, isActive } = req.body;
    const banner = await svc.updateHeroBanner(req.params.id, { title, subtitle, imagePath, ctaUrl, sortOrder, isActive });
    if (!banner) return res.status(404).json({ ok: false, message: 'Banner tidak ditemukan.' });
    return res.json({ ok: true, data: banner });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/homepage/hero/:id — admin */
export async function deleteHeroBanner(req, res, next) {
  try {
    await svc.deleteHeroBanner(req.params.id);
    return res.json({ ok: true, message: 'Banner berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/homepage/hero/reorder — admin */
export async function reorderHeroBanners(req, res, next) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ ok: false, message: 'items harus berupa array.' });
    }
    await svc.reorderHeroBanners(items);
    return res.json({ ok: true, message: 'Urutan berhasil disimpan.' });
  } catch (err) {
    next(err);
  }
}

// Legacy single-hero shim (kept for backward compat)
/** GET /api/homepage/hero/single — deprecated */
export async function getHero(req, res, next) {
  try {
    const hero = await svc.getHero();
    return res.json({ ok: true, data: hero });
  } catch (err) {
    next(err);
  }
}

// ── Design Items ──────────────────────────────────────────────────────────────

/** GET /api/homepage/design-items — public (active only) */
export async function listDesignItems(req, res, next) {
  try {
    const items = await svc.listDesignItems();
    return res.json({ ok: true, data: items });
  } catch (err) {
    next(err);
  }
}

/** GET /api/homepage/design-items/all — admin (all including inactive) */
export async function listAllDesignItems(req, res, next) {
  try {
    const items = await svc.listAllDesignItems();
    return res.json({ ok: true, data: items });
  } catch (err) {
    next(err);
  }
}

/** POST /api/homepage/design-items — admin */
export async function createDesignItem(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ ok: false, message: 'Validasi gagal.', errors: errors.mapped() });
    }
    const { title, imagePath, linkUrl, sortOrder } = req.body;
    const item = await svc.createDesignItem({ title, imagePath, linkUrl, sortOrder });
    return res.status(201).json({ ok: true, data: item });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/homepage/design-items/:id — admin */
export async function updateDesignItem(req, res, next) {
  try {
    const { title, imagePath, linkUrl, sortOrder, isActive } = req.body;
    const item = await svc.updateDesignItem(req.params.id, { title, imagePath, linkUrl, sortOrder, isActive });
    if (!item) return res.status(404).json({ ok: false, message: 'Item tidak ditemukan.' });
    return res.json({ ok: true, data: item });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/homepage/design-items/:id — admin */
export async function deleteDesignItem(req, res, next) {
  try {
    await svc.deleteDesignItem(req.params.id);
    return res.json({ ok: true, message: 'Item berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/homepage/design-items/reorder — admin */
export async function reorderDesignItems(req, res, next) {
  try {
    const { items } = req.body; // [{ id, sortOrder }]
    if (!Array.isArray(items)) {
      return res.status(400).json({ ok: false, message: 'items harus berupa array.' });
    }
    await svc.reorderDesignItems(items);
    return res.json({ ok: true, message: 'Urutan berhasil disimpan.' });
  } catch (err) {
    next(err);
  }
}

// ── Category Banners ──────────────────────────────────────────────────────────

/** GET /api/homepage/cat-banners — public (all banners for frontend) */
export async function listCatBanners(req, res, next) {
  try {
    const banners = await svc.listCatBanners();
    return res.json({ ok: true, data: banners });
  } catch (err) {
    next(err);
  }
}

/** GET /api/homepage/cat-banners/map — public (keyed by category_id) */
export async function getCatBannersMap(req, res, next) {
  try {
    const map = await svc.getCatBannersMap();
    return res.json({ ok: true, data: map });
  } catch (err) {
    next(err);
  }
}

/** POST/PUT /api/homepage/cat-banners — admin (upsert by categoryId) */
export async function saveCatBanner(req, res, next) {
  try {
    const { categoryId, title, imagePath, linkUrl, ctaText } = req.body;
    const banner = await svc.saveCatBanner({ categoryId, title, imagePath, linkUrl, ctaText });
    return res.json({ ok: true, data: banner });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/homepage/cat-banners/:id — admin */
export async function deleteCatBanner(req, res, next) {
  try {
    await svc.deleteCatBanner(req.params.id);
    return res.json({ ok: true, message: 'Banner berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
}
