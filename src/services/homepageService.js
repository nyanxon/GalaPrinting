/**
 * homepageService.js — Frontend API calls for dynamic Homepage content.
 *
 * Endpoints (all via /api/homepage/…):
 *   GET  /hero
 *   PUT  /hero
 *   GET  /design-items          (public — active only)
 *   GET  /design-items/all      (admin — all)
 *   POST /design-items
 *   PUT  /design-items/:id
 *   PUT  /design-items/reorder
 *   DEL  /design-items/:id
 *   GET  /cat-banners
 *   GET  /cat-banners/map
 *   POST /cat-banners            (upsert)
 *   PUT  /cat-banners
 *   DEL  /cat-banners/:id
 *   POST /upload-image
 */

import { api, resolveApiUrl } from '../core/httpClient.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveImageUrl(path) {
  if (!path) return null;
  return resolveApiUrl(path) || path;
}

function normalizeHero(raw) {
  if (!raw) return null;
  return {
    ...raw,
    imageUrl: resolveImageUrl(raw.image_path),
  };
}

function normalizeDesignItem(raw) {
  if (!raw) return null;
  return {
    ...raw,
    imageUrl: resolveImageUrl(raw.image_path),
    linkUrl:  raw.link_url  || null,
    sortOrder: raw.sort_order ?? 0,
    isActive:  Boolean(raw.is_active),
  };
}

function normalizeCatBanner(raw) {
  if (!raw) return null;
  return {
    ...raw,
    imageUrl:     resolveImageUrl(raw.image_path),
    linkUrl:      raw.link_url      || null,
    ctaText:      raw.cta_text      || 'Lihat Semua →',
    categoryId:   raw.category_id   || null,
    categoryName: raw.category_name || null,
  };
}

// ── Image Upload ──────────────────────────────────────────────────────────────

/**
 * Upload a homepage image file.
 * @param {File} file
 * @returns {Promise<string>} server URL
 */
export async function uploadHomepageImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  const res = await api.post('/api/homepage/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  if (!res.data.ok) throw new Error(res.data.message || 'Upload gagal.');
  return res.data.url;
}

// ── Hero ──────────────────────────────────────────────────────────────────────

export async function getHero() {
  const res = await api.get('/api/homepage/hero');
  return normalizeHero(res.data.data);
}

/**
 * Save (upsert) the hero banner.
 * @param {{ id?, title?, subtitle?, imagePath?, ctaUrl? }} data
 */
export async function saveHero(data) {
  const res = await api.put('/api/homepage/hero', data);
  return normalizeHero(res.data.data);
}

// ── Design Showcase Items ─────────────────────────────────────────────────────

/** Public — active items only (max 4 shown on homepage). */
export async function listDesignItems() {
  const res = await api.get('/api/homepage/design-items');
  return (res.data.data || []).map(normalizeDesignItem);
}

/** Admin — all items including inactive. */
export async function listAllDesignItems() {
  const res = await api.get('/api/homepage/design-items/all');
  return (res.data.data || []).map(normalizeDesignItem);
}

export async function createDesignItem(data) {
  const res = await api.post('/api/homepage/design-items', data);
  return normalizeDesignItem(res.data.data);
}

export async function updateDesignItem(id, data) {
  const res = await api.put(`/api/homepage/design-items/${id}`, data);
  return normalizeDesignItem(res.data.data);
}

export async function deleteDesignItem(id) {
  await api.delete(`/api/homepage/design-items/${id}`);
  return { ok: true };
}

/**
 * Reorder design items.
 * @param {Array<{ id: string, sortOrder: number }>} items
 */
export async function reorderDesignItems(items) {
  const res = await api.put('/api/homepage/design-items/reorder', { items });
  return res.data;
}

// ── Category Banners ──────────────────────────────────────────────────────────

export async function listCatBanners() {
  const res = await api.get('/api/homepage/cat-banners');
  return (res.data.data || []).map(normalizeCatBanner);
}

/**
 * Returns an object keyed by category_id (or '__uncategorised__').
 * @returns {Promise<Record<string, object>>}
 */
export async function getCatBannersMap() {
  const res = await api.get('/api/homepage/cat-banners/map');
  const raw = res.data.data || {};
  const out = {};
  for (const [key, val] of Object.entries(raw)) {
    out[key] = normalizeCatBanner(val);
  }
  return out;
}

export async function saveCatBanner(data) {
  const res = await api.post('/api/homepage/cat-banners', data);
  return normalizeCatBanner(res.data.data);
}

export async function deleteCatBanner(id) {
  await api.delete(`/api/homepage/cat-banners/${id}`);
  return { ok: true };
}
