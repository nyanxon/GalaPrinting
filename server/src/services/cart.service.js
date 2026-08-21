/**
 * cart.service.js — Cart management business logic.
 *
 * Requirements: 8.1–8.7
 */

import { randomUUID } from 'crypto';
import { query } from '../db/connection.js';
import { sumSelectedAttributeModifiers } from './products.service.js';

/**
 * Parse selected attribute values dari payload client menjadi array bersih.
 * Format: [{ name: "Tipe Laminasi", value: "Glossy" }, ...]
 * Menerima array atau JSON string. Returns [] when empty/invalid.
 */
function parseSelectedList(raw) {
  if (!raw) return [];
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((a) => {
      if (!a || typeof a !== 'object') return null;
      const name = String(a.name ?? '').trim();
      const value = String(a.value ?? '').trim();
      if (!name || !value) return null;
      return { name: name.slice(0, 100), value: value.slice(0, 200) };
    })
    .filter(Boolean)
    .slice(0, 30);
}

/**
 * Hitung finalPrice item cart di server:
 *   finalPrice = harga dasar produk (price_customer)
 *              + sum(priceModifier atribut affectsPrice=true sesuai value terpilih)
 *
 * Harga TIDAK dipercaya dari client saat product_id valid — ini sekaligus
 * snapshot harga agar konsisten walau harga produk berubah nanti.
 * Fallback ke harga dari client hanya jika produk sudah terhapus / item manual.
 *
 * @param {object} item  Payload add-to-cart
 * @param {{ name: string, value: string }[]} selected  Atribut terpilih (hasil parseSelectedList)
 * @returns {Promise<number>}
 */
async function resolveFinalPrice(item, selected) {
  const fallback = Math.max(0, Number(item.price) || 0);
  const productId = item.productId ?? item.product_id ?? null;
  if (!productId) return fallback;

  const [rows] = await query(
    'SELECT price_customer, attributes FROM products WHERE id = ?',
    [productId]
  );
  if (rows.length === 0) return fallback; // Produk dihapus — pakai harga client

  const base = Number(rows[0].price_customer) || 0;
  const modifier = sumSelectedAttributeModifiers(rows[0].attributes, selected);
  return base + modifier;
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
  const selected = parseSelectedList(item.attributes);
  const attributes = selected.length > 0 ? JSON.stringify(selected) : null;
  // finalPrice dihitung server-side & disimpan sebagai snapshot di kolom price
  const finalPrice = await resolveFinalPrice(item, selected);
  await query(
    `INSERT INTO cart_items
       (id, user_id, product_id, name, price, quantity, attributes, notes, design_file_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      item.productId || null,
      item.name,
      finalPrice,
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
