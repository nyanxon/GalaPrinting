/**
 * reviews.service.js — Review business logic.
 *
 * Requirements: 10.1–10.5
 */

import { randomUUID } from 'crypto';
import { query } from '../db/connection.js';

export async function listReviews({ productId } = {}) {
  const conditions = [];
  const params     = [];

  if (productId) {
    conditions.push('r.product_id = ?');
    params.push(productId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await query(
    `SELECT r.*, p.name AS product_name
     FROM reviews r
     LEFT JOIN products p ON r.product_id = p.id
     ${where}
     ORDER BY r.created_at DESC`,
    params
  );
  return rows;
}

/**
 * Create a review.
 *
 * @param {{
 *   productId?: string|null,
 *   orderId?: string|null,
 *   orderItemId?: string|null,
 *   customerId: string,
 *   customerName: string,
 *   rating: number,
 *   comment?: string,
 * }} data
 */
export async function createReview({ productId, orderId, orderItemId, customerId, customerName, rating, comment }) {
  if (rating < 1 || rating > 5) {
    const err = new Error('Rating harus antara 1 dan 5.');
    err.status = 422;
    throw err;
  }

  // Spam prevention: one review per customer per order item
  if (orderItemId) {
    const [existing] = await query(
      'SELECT id FROM reviews WHERE customer_id = ? AND order_item_id = ?',
      [customerId, orderItemId]
    );
    if (existing.length > 0) {
      const err = new Error('Anda sudah memberikan ulasan untuk item ini.');
      err.status = 409;
      throw err;
    }
  }

  // If productId not provided but orderId + orderItemId are, try to resolve it
  let resolvedProductId = productId || null;
  if (!resolvedProductId && orderItemId) {
    const [itemRows] = await query(
      'SELECT product_id FROM order_items WHERE id = ?',
      [orderItemId]
    );
    if (itemRows.length > 0 && itemRows[0].product_id) {
      resolvedProductId = itemRows[0].product_id;
    }
  }

  const id = randomUUID();
  await query(
    `INSERT INTO reviews (id, product_id, order_id, order_item_id, customer_id, customer_name, rating, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      resolvedProductId,
      orderId || null,
      orderItemId || null,
      customerId,
      customerName,
      rating,
      comment || null,
    ]
  );

  const [rows] = await query('SELECT * FROM reviews WHERE id = ?', [id]);
  return rows[0];
}

export async function getReviewById(id) {
  const [rows] = await query('SELECT * FROM reviews WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function deleteReview(id) {
  await query('DELETE FROM reviews WHERE id = ?', [id]);
}

/**
 * Check which order items a customer has already reviewed.
 * Returns a Set of order_item_ids that have been reviewed.
 *
 * @param {string} customerId
 * @param {string[]} orderItemIds
 * @returns {Promise<Set<string>>}
 */
export async function getReviewedItemIds(customerId, orderItemIds) {
  if (!orderItemIds || orderItemIds.length === 0) return new Set();

  const placeholders = orderItemIds.map(() => '?').join(', ');
  const [rows] = await query(
    `SELECT order_item_id FROM reviews
     WHERE customer_id = ? AND order_item_id IN (${placeholders})`,
    [customerId, ...orderItemIds]
  );
  return new Set(rows.map((r) => r.order_item_id));
}
