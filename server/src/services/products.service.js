/**
 * products.service.js — Product and category business logic.
 *
 * Requirements: 6.1–6.9
 */

import { randomUUID } from 'crypto';
import { query } from '../db/connection.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function uniqueSlug(base) {
  let slug = slugify(base);
  let suffix = 0;
  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const [rows] = await query('SELECT id FROM products WHERE slug = ?', [candidate]);
    if (rows.length === 0) return candidate;
    suffix++;
  }
}

// ── Products ──────────────────────────────────────────────────────────────────

/**
 * List products with optional pagination and filters.
 * @returns {Promise<{ items: object[], total: number, page: number, limit: number, totalPages: number }>}
 */
export async function listProducts({ page = 1, limit = 10, category, search } = {}) {
  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const offset   = (pageNum - 1) * limitNum;

  const conditions = [];
  const params     = [];

  if (category) {
    conditions.push('c.name = ?');
    params.push(category);
  }
  if (search) {
    conditions.push('p.name LIKE ?');
    params.push(`%${search}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await query(
    `SELECT COUNT(*) AS total
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     ${where}`,
    params
  );
  const total = countRows[0].total;

  const [items] = await query(
    `SELECT p.*, c.name AS category
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  return {
    items,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
}

/**
 * Get a single product by UUID.
 * @returns {Promise<object|null>}
 */
export async function getProductById(id) {
  const [rows] = await query(
    `SELECT p.*, c.name AS category
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.id = ?`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Create a new product.
 * @returns {Promise<object>} created product row
 */
export async function createProduct({ name, categoryId, price, shortDescription, requiresDesign, colors, sizes, materials, imagePath, variantPrices }) {
  const id   = randomUUID();
  const slug = await uniqueSlug(name);

  await query(
    `INSERT INTO products
       (id, category_id, name, slug, price, short_description, requires_design, colors, sizes, materials, image_path, variant_prices)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      categoryId || null,
      name,
      slug,
      price || 0,
      shortDescription || null,
      requiresDesign ? 1 : 0,
      colors ? JSON.stringify(colors) : null,
      sizes  ? JSON.stringify(sizes)  : null,
      materials ? JSON.stringify(materials) : null,
      imagePath || null,
      JSON.stringify(variantPrices) || null,
    ]
  );

  return getProductById(id);
}

/**
 * Update an existing product.
 * @returns {Promise<object|null>} updated product row
 */
export async function updateProduct(id, data) {
  const fields = [];
  const params = [];

  const allowed = ['name', 'category_id', 'price', 'short_description', 'requires_design', 'image_path'];
  const jsonFields = ['colors', 'sizes', 'materials', 'variant_prices'];

  for (const [key, val] of Object.entries(data)) {
    // Support both camelCase (from frontend) and snake_case
    const col = key === 'shortDescription' ? 'short_description'
              : key === 'requiresDesign'   ? 'requires_design'
              : key === 'imagePath'        ? 'image_path'
              : key === 'categoryId'       ? 'category_id'
              : key === 'variantPrices'    ? 'variant_prices'
              : key; // already snake_case (e.g. category_id sent by controller)
    if (allowed.includes(col)) {
      fields.push(`${col} = ?`);
      params.push(val);
    } else if (jsonFields.includes(col)) {
      fields.push(`${col} = ?`);
      params.push(val !== undefined ? JSON.stringify(val) : null);
    }
  }

  if (fields.length === 0) return getProductById(id);

  params.push(id);
  await query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, params);
  return getProductById(id);
}

/**
 * Delete a product by ID.
 * FK ON DELETE SET NULL handles order_items and cart_items automatically.
 */
export async function deleteProduct(id) {
  await query('DELETE FROM products WHERE id = ?', [id]);
}

// ── Categories ────────────────────────────────────────────────────────────────

/**
 * Resolve a category name to its UUID.
 * Returns null if not found.
 * @param {string} name
 * @returns {Promise<string|null>}
 */
export async function resolveCategoryId(name) {
  if (!name) return null;
  const [rows] = await query('SELECT id FROM categories WHERE name = ?', [String(name).trim()]);
  return rows[0]?.id ?? null;
}

/**
 * List all categories.
 * @returns {Promise<object[]>}
 */
export async function listCategories() {
  const [rows] = await query('SELECT id, name FROM categories ORDER BY name ASC');
  return rows;
}

/**
 * Create a new category.
 * @returns {Promise<object>}
 */
export async function createCategory(name) {
  const id = randomUUID();
  await query('INSERT INTO categories (id, name) VALUES (?, ?)', [id, name]);
  const [rows] = await query('SELECT * FROM categories WHERE id = ?', [id]);
  return rows[0];
}

/**
 * Delete a category by ID.
 */
export async function deleteCategory(id) {
  await query('DELETE FROM categories WHERE id = ?', [id]);
}
