/**
 * cart.service.js — Cart management business logic.
 *
 * Requirements: 8.1–8.7
 */

import { randomUUID } from 'crypto';
import { query } from '../db/connection.js';

/**
 * Normalize selected attribute values into a storable JSON string.
 * Format: [{ name: "Tipe Laminasi", value: "Glossy" }, ...]
 * Returns null when empty/invalid.
 */
function normalizeSelectedAttributes(raw) {
  if (!raw) return null;
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(list)) return null;
  const cleaned = list
    .map((a) => {
      if (!a || typeof a !== 'object') return null;
      const name = String(a.name ?? '').trim();
      const value = String(a.value ?? '').trim();
      if (!name || !value) return null;
      return { name: name.slice(0, 100), value: value.slice(0, 200) };
    })
    .filter(Boolean)
    .slice(0, 30);
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

/**
 * Get all cart items for a user.
 */
export async function getCart(userId) {
  const [rows] = await query(
    `SELECT ci.*, p.name AS product_name, p.image_path
     FROM cart_items ci
     LEFT JOIN products p ON ci.product_id = p.id
     WHERE ci.user_id = ?
     ORDER BY ci.created_at ASC`,
    [userId]
  );
  return rows;
}

/**
 * Add an item to the user's cart.
 */
export async function addItem(userId, item) {
  const id = randomUUID();
  const attributes = normalizeSelectedAttributes(item.attributes);
  await query(
    `INSERT INTO cart_items
       (id, user_id, product_id, name, price, quantity, attributes, notes, design_file_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      item.productId || null,
      item.name,
      item.price,
      item.quantity || 1,
      attributes,
      item.notes || null,
      item.designFilePath || null,
    ]
  );
  const [rows] = await query('SELECT * FROM cart_items WHERE id = ?', [id]);
  return rows[0];
}

/**
 * Update the quantity of a cart item, verifying ownership.
 */
export async function updateItemQty(userId, itemId, quantity) {
  const [rows] = await query(
    'SELECT id FROM cart_items WHERE id = ? AND user_id = ?',
    [itemId, userId]
  );
  if (rows.length === 0) {
    const err = new Error('Item tidak ditemukan atau bukan milik Anda.');
    err.status = 403;
    throw err;
  }
  await query('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, itemId]);
  const [updated] = await query('SELECT * FROM cart_items WHERE id = ?', [itemId]);
  return updated[0];
}

/**
 * Remove a cart item, verifying ownership.
 */
export async function removeItem(userId, itemId) {
  const [rows] = await query(
    'SELECT id FROM cart_items WHERE id = ? AND user_id = ?',
    [itemId, userId]
  );
  if (rows.length === 0) {
    const err = new Error('Item tidak ditemukan atau bukan milik Anda.');
    err.status = 403;
    throw err;
  }
  await query('DELETE FROM cart_items WHERE id = ?', [itemId]);
}

/**
 * Clear all cart items for a user.
 */
export async function clearCart(userId) {
  await query('DELETE FROM cart_items WHERE user_id = ?', [userId]);
}

/**
 * Sync localStorage cart items into the server cart.
 * Only merges if the server cart is currently empty.
 */
export async function syncCart(userId, items) {
  const existing = await getCart(userId);
  if (existing.length > 0) {
    // Server cart already has items — skip sync
    return existing;
  }

  for (const item of (items || [])) {
    await addItem(userId, item);
  }

  return getCart(userId);
}
