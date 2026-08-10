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
 * @param {object} opts
 * @param {number} [opts.page=1]
 * @param {number} [opts.limit=10]
 * @param {string} [opts.category]
 * @param {string} [opts.search]
 * @param {boolean|string} [opts.visible] - when truthy, only return products
 *   visible on the public storefront (is_hidden_from_customer = 0).
 * @returns {Promise<{ items: object[], total: number, page: number, limit: number, totalPages: number }>}
 */
export async function listProducts({ page = 1, limit = 10, category, search, visible } = {}) {
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
  if (visible === true || visible === 1 || visible === 'true' || visible === '1') {
    conditions.push('p.is_hidden_from_customer = 0');
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
 * @param {string} id
 * @param {object} [opts]
 * @param {boolean|string} [opts.visible] - when truthy, a product hidden from
 *   the storefront (is_hidden_from_customer = 1) is treated as not found.
 * @returns {Promise<object|null>}
 */
export async function getProductById(id, { visible } = {}) {
  const publicOnly = visible === true || visible === 1 || visible === 'true' || visible === '1';
  const [rows] = await query(
    `SELECT p.*, c.name AS category
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.id = ?
     ${publicOnly ? 'AND p.is_hidden_from_customer = 0' : ''}`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Search products by name keyword (for cashier autocomplete).
 * Returns a lightweight projection: id, name, both prices, category,
 * plus attributes (colors/sizes/materials) and variant_prices so the
 * cashier form can render dropdowns and resolve variant pricing.
 * @param {string} q - keyword
 * @param {number} [limit=10]
 * @returns {Promise<object[]>}
 */
export async function searchProducts(q, limit = 10) {
  const keyword = String(q || '').trim();
  if (!keyword) return [];
  const maxLimit = Math.min(15, Math.max(1, parseInt(limit, 10) || 10));

  const [rows] = await query(
    `SELECT p.id, p.name, p.price_customer, p.price_broker, c.name AS category,
            p.colors, p.sizes, p.materials, p.variant_prices,
            p.size_type, p.is_hidden_from_customer
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.name LIKE ?
     ORDER BY p.name ASC
     LIMIT ?`,
    [`%${keyword}%`, maxLimit]
  );
  return rows;
}

/**
 * Batch-fetch products by ids (used by cashier order to resolve prices
 * server-side instead of trusting prices sent by the client).
 * Includes variant_prices so size+material can re-price the unit price.
 * @param {string[]} ids
 * @returns {Promise<object[]>}
 */
export async function getProductsByIds(ids) {
  const clean = (Array.isArray(ids) ? ids : []).filter(Boolean);
  if (clean.length === 0) return [];
  const placeholders = clean.map(() => '?').join(', ');
  const [rows] = await query(
    `SELECT p.id, p.name, p.price_customer, p.price_broker, p.category_id,
            p.colors, p.sizes, p.materials, p.variant_prices,
            p.size_type, p.is_hidden_from_customer
     FROM products p
     WHERE p.id IN (${placeholders})`,
    clean
  );
  return rows;
}

/**
 * Create a new product.
 * @returns {Promise<object>} created product row
 */
export async function createProduct({ name, categoryId, price, priceCustomer, priceBroker, shortDescription, requiresDesign, colors, sizes, materials, imagePath, variantPrices, sizeType, isHiddenFromCustomer }) {
  const id   = randomUUID();
  const slug = await uniqueSlug(name);

  // Normalize sizeType — default to 'fixed' for legacy products
  const normalizedSizeType = sizeType === 'per_m2' ? 'per_m2' : 'fixed';

  // Normalize imagePath: accept Array, JSON string, or plain URL string.
  // Always persist as a JSON array string so multiple images are supported.
  let normalizedImagePath = null;
  if (imagePath) {
    if (Array.isArray(imagePath)) {
      normalizedImagePath = JSON.stringify(imagePath);
    } else if (typeof imagePath === 'string') {
      try {
        const parsed = JSON.parse(imagePath);
        normalizedImagePath = Array.isArray(parsed) ? imagePath : JSON.stringify([imagePath]);
      } catch {
        normalizedImagePath = JSON.stringify([imagePath]);
      }
    }
  }

  await query(
    `INSERT INTO products
       (id, category_id, name, slug, price_customer, price_broker, short_description, requires_design, colors, sizes, materials, image_path, variant_prices, size_type, is_hidden_from_customer)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      categoryId || null,
      name,
      slug,
      priceCustomer ?? price ?? 0,
      priceBroker ?? priceCustomer ?? price ?? 0,
      shortDescription || null,
      requiresDesign ? 1 : 0,
      colors ? JSON.stringify(colors) : null,
      sizes  ? JSON.stringify(sizes)  : null,
      materials ? JSON.stringify(materials) : null,
      normalizedImagePath,
      variantPrices != null ? JSON.stringify(variantPrices) : null,
      normalizedSizeType,
      isHiddenFromCustomer ? 1 : 0,
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

  const allowed    = ['name', 'category_id', 'price_customer', 'price_broker', 'short_description', 'requires_design', 'image_path', 'size_type', 'is_hidden_from_customer'];
  const jsonFields = ['colors', 'sizes', 'materials', 'variant_prices'];

  for (const [key, val] of Object.entries(data)) {
    // Support both camelCase (from frontend) and snake_case
    const col = key === 'shortDescription' ? 'short_description'
              : key === 'requiresDesign'   ? 'requires_design'
              : key === 'imagePath'        ? 'image_path'
              : key === 'image'            ? 'image_path'   // frontend sends 'image' as JSON array string
              : key === 'categoryId'       ? 'category_id'
              : key === 'priceCustomer'    ? 'price_customer'
              : key === 'priceBroker'      ? 'price_broker'
              : key === 'variantPrices'    ? 'variant_prices'
              : key === 'sizeType'         ? 'size_type'
              : key === 'isHiddenFromCustomer' ? 'is_hidden_from_customer'
              : key; // already snake_case (e.g. category_id sent by controller)
    if (allowed.includes(col)) {
      fields.push(`${col} = ?`);
      if (col === 'requires_design' || col === 'is_hidden_from_customer') {
        // Coerce boolean to 0/1 for TINYINT column
        params.push(val ? 1 : 0);
      } else if (col === 'size_type') {
        // Only accept the two known ENUM values
        params.push(val === 'per_m2' ? 'per_m2' : 'fixed');
      } else if (col === 'image_path') {
        // Normalize: accept Array, JSON string, or plain string.
        // Always persist as a JSON array string so multiple images are preserved.
        if (Array.isArray(val)) {
          params.push(JSON.stringify(val));
        } else if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            // Already a valid JSON array — keep as-is
            params.push(Array.isArray(parsed) ? val : JSON.stringify([val]));
          } catch {
            // Plain URL string — wrap in array
            params.push(JSON.stringify([val]));
          }
        } else {
          params.push(val);
        }
      } else {
        params.push(val);
      }
    } else if (jsonFields.includes(col)) {
      fields.push(`${col} = ?`);
      // null → SQL NULL; everything else → JSON string
      params.push(val != null ? JSON.stringify(val) : null);
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
 * Update a category name.
 * @param {string} id
 * @param {string} name
 * @returns {Promise<object|null>}
 */
export async function updateCategory(id, name) {
  const trimmed = String(name).trim();
  await query('UPDATE categories SET name = ? WHERE id = ?', [trimmed, id]);
  const [rows] = await query('SELECT * FROM categories WHERE id = ?', [id]);
  return rows[0] || null;
}

/**
 * Delete a category by ID.
 */
export async function deleteCategory(id) {
  await query('DELETE FROM categories WHERE id = ?', [id]);
}
