/**
 * homepage.service.js — Business logic for dynamic homepage content.
 *
 * Tables:
 *   homepage_hero          — single hero/banner row
 *   homepage_design_items  — up to 4 design showcase items
 *   homepage_cat_banners   — per-category section banners
 */

import { randomUUID } from 'crypto';
import { query } from '../db/connection.js';

// ── Hero Banners (carousel — multiple slides) ─────────────────────────────────

/** Return all active hero slides ordered by sort_order (public). */
export async function listHeroBanners() {
  const [rows] = await query(
    'SELECT * FROM homepage_hero WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC'
  );
  return rows;
}

/** Return all hero slides including inactive (admin). */
export async function listAllHeroBanners() {
  const [rows] = await query(
    'SELECT * FROM homepage_hero ORDER BY sort_order ASC, created_at ASC'
  );
  return rows;
}

/** Create a new hero slide. */
export async function createHeroBanner({ title, subtitle, imagePath, ctaUrl, sortOrder }) {
  const id = randomUUID();
  await query(
    `INSERT INTO homepage_hero (id, title, subtitle, image_path, cta_url, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [id, title || null, subtitle || null, imagePath || null, ctaUrl || null, sortOrder ?? 0]
  );
  const [rows] = await query('SELECT * FROM homepage_hero WHERE id = ?', [id]);
  return rows[0];
}

/** Update an existing hero slide. */
export async function updateHeroBanner(id, { title, subtitle, imagePath, ctaUrl, sortOrder, isActive }) {
  const fields = [];
  const params = [];

  if (title     !== undefined) { fields.push('title = ?');       params.push(title     || null); }
  if (subtitle  !== undefined) { fields.push('subtitle = ?');    params.push(subtitle  || null); }
  if (imagePath !== undefined) { fields.push('image_path = ?');  params.push(imagePath || null); }
  if (ctaUrl    !== undefined) { fields.push('cta_url = ?');     params.push(ctaUrl    || null); }
  if (sortOrder !== undefined) { fields.push('sort_order = ?');  params.push(sortOrder); }
  if (isActive  !== undefined) { fields.push('is_active = ?');   params.push(isActive ? 1 : 0); }

  if (fields.length > 0) {
    params.push(id);
    await query(`UPDATE homepage_hero SET ${fields.join(', ')} WHERE id = ?`, params);
  }
  const [rows] = await query('SELECT * FROM homepage_hero WHERE id = ?', [id]);
  return rows[0] || null;
}

/** Delete a hero slide. */
export async function deleteHeroBanner(id) {
  await query('DELETE FROM homepage_hero WHERE id = ?', [id]);
}

/** Reorder hero slides. @param {Array<{id:string, sortOrder:number}>} items */
export async function reorderHeroBanners(items) {
  for (const { id, sortOrder } of items) {
    await query('UPDATE homepage_hero SET sort_order = ? WHERE id = ?', [sortOrder, id]);
  }
}

// Keep a single-row legacy shim so existing callers (if any) don't crash.
/** @deprecated Use listHeroBanners() instead. */
export async function getHero() {
  const [rows] = await query(
    'SELECT * FROM homepage_hero WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC LIMIT 1'
  );
  return rows[0] || null;
}

// ── Design Showcase Items ─────────────────────────────────────────────────────

/** Return all active design items ordered by sort_order. */
export async function listDesignItems() {
  const [rows] = await query(
    'SELECT * FROM homepage_design_items WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC'
  );
  return rows;
}

/** Return all design items (admin view — includes inactive). */
export async function listAllDesignItems() {
  const [rows] = await query(
    'SELECT * FROM homepage_design_items ORDER BY sort_order ASC, created_at ASC'
  );
  return rows;
}

/** Create a new design item. */
export async function createDesignItem({ title, imagePath, linkUrl, sortOrder }) {
  const id = randomUUID();
  await query(
    `INSERT INTO homepage_design_items (id, title, image_path, link_url, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [id, title || null, imagePath, linkUrl || null, sortOrder ?? 0]
  );
  const [rows] = await query('SELECT * FROM homepage_design_items WHERE id = ?', [id]);
  return rows[0];
}

/** Update an existing design item. */
export async function updateDesignItem(id, { title, imagePath, linkUrl, sortOrder, isActive }) {
  const fields = [];
  const params = [];

  if (title      !== undefined) { fields.push('title = ?');       params.push(title      || null); }
  if (imagePath  !== undefined) { fields.push('image_path = ?');  params.push(imagePath  || null); }
  if (linkUrl    !== undefined) { fields.push('link_url = ?');    params.push(linkUrl    || null); }
  if (sortOrder  !== undefined) { fields.push('sort_order = ?');  params.push(sortOrder); }
  if (isActive   !== undefined) { fields.push('is_active = ?');   params.push(isActive ? 1 : 0); }

  if (fields.length === 0) {
    const [rows] = await query('SELECT * FROM homepage_design_items WHERE id = ?', [id]);
    return rows[0] || null;
  }

  params.push(id);
  await query(`UPDATE homepage_design_items SET ${fields.join(', ')} WHERE id = ?`, params);
  const [rows] = await query('SELECT * FROM homepage_design_items WHERE id = ?', [id]);
  return rows[0] || null;
}

/** Delete a design item. */
export async function deleteDesignItem(id) {
  await query('DELETE FROM homepage_design_items WHERE id = ?', [id]);
}

/**
 * Reorder design items.
 * @param {Array<{ id: string, sortOrder: number }>} items
 */
export async function reorderDesignItems(items) {
  for (const { id, sortOrder } of items) {
    await query('UPDATE homepage_design_items SET sort_order = ? WHERE id = ?', [sortOrder, id]);
  }
}

// ── Category Banners ──────────────────────────────────────────────────────────

/** Return all category banners (admin view). */
export async function listCatBanners() {
  const [rows] = await query(
    `SELECT b.*, c.name AS category_name
     FROM homepage_cat_banners b
     LEFT JOIN categories c ON b.category_id = c.id
     ORDER BY b.created_at ASC`
  );
  return rows;
}

/** Return the banner for a specific category_id (or null-category for uncategorised). */
export async function getCatBanner(categoryId) {
  if (categoryId) {
    const [rows] = await query(
      'SELECT * FROM homepage_cat_banners WHERE category_id = ? LIMIT 1',
      [categoryId]
    );
    return rows[0] || null;
  }
  const [rows] = await query(
    'SELECT * FROM homepage_cat_banners WHERE category_id IS NULL LIMIT 1'
  );
  return rows[0] || null;
}

/** Return banners keyed by category_id for bulk frontend lookup. */
export async function getCatBannersMap() {
  const banners = await listCatBanners();
  const map = {};
  for (const b of banners) {
    map[b.category_id ?? '__uncategorised__'] = b;
  }
  return map;
}

/** Create or update a category banner (upsert by category_id). */
export async function saveCatBanner({ categoryId, title, imagePath, linkUrl, ctaText }) {
  const existing = await getCatBanner(categoryId || null);

  if (existing) {
    const fields = [];
    const params = [];

    if (title     !== undefined) { fields.push('title = ?');       params.push(title     || null); }
    if (imagePath !== undefined) { fields.push('image_path = ?');  params.push(imagePath || null); }
    if (linkUrl   !== undefined) { fields.push('link_url = ?');    params.push(linkUrl   || null); }
    if (ctaText   !== undefined) { fields.push('cta_text = ?');    params.push(ctaText   || 'Lihat Semua →'); }

    if (fields.length > 0) {
      params.push(existing.id);
      await query(`UPDATE homepage_cat_banners SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    const [rows] = await query('SELECT * FROM homepage_cat_banners WHERE id = ?', [existing.id]);
    return rows[0] || null;
  }

  const id = randomUUID();
  await query(
    `INSERT INTO homepage_cat_banners (id, category_id, title, image_path, link_url, cta_text)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, categoryId || null, title || null, imagePath || null, linkUrl || null, ctaText || 'Lihat Semua →']
  );
  const [rows] = await query('SELECT * FROM homepage_cat_banners WHERE id = ?', [id]);
  return rows[0] || null;
}

/** Delete a category banner by id. */
export async function deleteCatBanner(id) {
  await query('DELETE FROM homepage_cat_banners WHERE id = ?', [id]);
}
