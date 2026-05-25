/**
 * promo.service.js — Promo code management, validation, and usage tracking.
 *
 * Requirements: 2.2, 2.3, 2.7, 2.8
 */

import { randomUUID } from 'crypto';
import { query } from '../db/connection.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Map a raw DB row to a clean promo object.
 */
function mapPromo(row) {
  return {
    id:           row.id,
    code:         row.code,
    description:  row.description ?? null,
    type:         row.type,
    value:        Number(row.value),
    maxUses:      row.max_uses   ?? null,
    usageCount:   Number(row.usage_count ?? 0),
    dailyLimit:   row.daily_limit  ?? null,
    minPurchase:  Number(row.min_purchase ?? 0),
    maxDiscount:  row.max_discount ?? null,
    isActive:     Boolean(row.is_active ?? 1),
    expiresAt:    row.expires_at ?? null,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at ?? null,
  };
}

// ── Admin CRUD ────────────────────────────────────────────────────────────────

/**
 * List all promo codes with usage stats.
 */
export async function listPromoCodes() {
  const [rows] = await query(
    `SELECT p.*,
            COUNT(l.id) AS log_count
     FROM promo_codes p
     LEFT JOIN promo_usage_log l ON l.promo_code_id = p.id
     GROUP BY p.id
     ORDER BY p.created_at DESC`
  );
  return rows.map(mapPromo);
}

/**
 * Get a single promo code by ID.
 */
export async function getPromoById(id) {
  const [rows] = await query('SELECT * FROM promo_codes WHERE id = ?', [id]);
  if (rows.length === 0) {
    const err = new Error('Kode promo tidak ditemukan.');
    err.status = 404;
    throw err;
  }
  return mapPromo(rows[0]);
}

/**
 * Create a new promo code.
 *
 * @param {{
 *   code: string,
 *   description?: string,
 *   type: 'percentage'|'fixed',
 *   value: number,
 *   maxUses?: number|null,
 *   dailyLimit?: number|null,
 *   minPurchase?: number,
 *   maxDiscount?: number|null,
 *   expiresAt?: string|null,
 *   isActive?: boolean,
 * }} data
 */
export async function createPromoCode(data) {
  const {
    code, description, type, value,
    maxUses, dailyLimit, minPurchase, maxDiscount,
    expiresAt, isActive = true,
  } = data;

  // Validate required fields
  if (!code || String(code).trim().length === 0) {
    const err = new Error('Kode promo wajib diisi.');
    err.status = 422;
    throw err;
  }
  if (!['percentage', 'fixed'].includes(type)) {
    const err = new Error('Tipe diskon tidak valid. Gunakan "percentage" atau "fixed".');
    err.status = 422;
    throw err;
  }
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    const err = new Error('Nilai diskon harus lebih dari 0.');
    err.status = 422;
    throw err;
  }
  if (type === 'percentage' && Number(value) > 100) {
    const err = new Error('Persentase diskon tidak boleh melebihi 100%.');
    err.status = 422;
    throw err;
  }

  // Check unique code
  const [existing] = await query(
    'SELECT id FROM promo_codes WHERE UPPER(code) = UPPER(?)',
    [String(code).trim()]
  );
  if (existing.length > 0) {
    const err = new Error('Kode promo sudah digunakan.');
    err.status = 409;
    throw err;
  }

  const id = randomUUID();
  await query(
    `INSERT INTO promo_codes
       (id, code, description, type, value, max_uses, daily_limit, min_purchase, max_discount, is_active, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      String(code).trim().toUpperCase(),
      description || null,
      type,
      Number(value),
      maxUses   != null ? Number(maxUses)   : null,
      dailyLimit != null ? Number(dailyLimit) : null,
      Number(minPurchase ?? 0),
      maxDiscount != null ? Number(maxDiscount) : null,
      isActive ? 1 : 0,
      expiresAt || null,
    ]
  );

  return getPromoById(id);
}

/**
 * Update an existing promo code.
 */
export async function updatePromoCode(id, data) {
  // Verify exists
  await getPromoById(id);

  const {
    code, description, type, value,
    maxUses, dailyLimit, minPurchase, maxDiscount,
    expiresAt, isActive,
  } = data;

  if (type && !['percentage', 'fixed'].includes(type)) {
    const err = new Error('Tipe diskon tidak valid.');
    err.status = 422;
    throw err;
  }
  if (value !== undefined && (!Number.isFinite(Number(value)) || Number(value) <= 0)) {
    const err = new Error('Nilai diskon harus lebih dari 0.');
    err.status = 422;
    throw err;
  }

  // Check unique code if changing
  if (code) {
    const [existing] = await query(
      'SELECT id FROM promo_codes WHERE UPPER(code) = UPPER(?) AND id != ?',
      [String(code).trim(), id]
    );
    if (existing.length > 0) {
      const err = new Error('Kode promo sudah digunakan.');
      err.status = 409;
      throw err;
    }
  }

  const setClauses = [];
  const params = [];

  if (code !== undefined)        { setClauses.push('code = ?');         params.push(String(code).trim().toUpperCase()); }
  if (description !== undefined) { setClauses.push('description = ?');  params.push(description || null); }
  if (type !== undefined)        { setClauses.push('type = ?');          params.push(type); }
  if (value !== undefined)       { setClauses.push('value = ?');         params.push(Number(value)); }
  if (maxUses !== undefined)     { setClauses.push('max_uses = ?');      params.push(maxUses != null ? Number(maxUses) : null); }
  if (dailyLimit !== undefined)  { setClauses.push('daily_limit = ?');   params.push(dailyLimit != null ? Number(dailyLimit) : null); }
  if (minPurchase !== undefined) { setClauses.push('min_purchase = ?');  params.push(Number(minPurchase)); }
  if (maxDiscount !== undefined) { setClauses.push('max_discount = ?');  params.push(maxDiscount != null ? Number(maxDiscount) : null); }
  if (isActive !== undefined)    { setClauses.push('is_active = ?');     params.push(isActive ? 1 : 0); }
  if (expiresAt !== undefined)   { setClauses.push('expires_at = ?');    params.push(expiresAt || null); }

  if (setClauses.length > 0) {
    params.push(id);
    await query(`UPDATE promo_codes SET ${setClauses.join(', ')} WHERE id = ?`, params);
  }

  return getPromoById(id);
}

/**
 * Delete a promo code (and its usage log via CASCADE).
 */
export async function deletePromoCode(id) {
  await getPromoById(id); // throws 404 if not found
  await query('DELETE FROM promo_codes WHERE id = ?', [id]);
}

// ── Usage Log ─────────────────────────────────────────────────────────────────

/**
 * Get usage log for a specific promo code.
 */
export async function getPromoUsageLog(promoCodeId) {
  const [rows] = await query(
    `SELECT l.*, p.code AS promo_code
     FROM promo_usage_log l
     JOIN promo_codes p ON p.id = l.promo_code_id
     WHERE l.promo_code_id = ?
     ORDER BY l.used_at DESC`,
    [promoCodeId]
  );
  return rows;
}

/**
 * Get aggregated usage stats for all promo codes.
 */
export async function getPromoStats() {
  const [rows] = await query(
    `SELECT
       p.id,
       p.code,
       p.description,
       p.type,
       p.value,
       p.is_active,
       p.usage_count,
       p.daily_limit,
       p.max_uses,
       COUNT(l.id)                    AS total_uses,
       SUM(l.discount_amount)         AS total_discount_given,
       MAX(l.used_at)                 AS last_used_at,
       COUNT(DISTINCT l.user_id)      AS unique_users
     FROM promo_codes p
     LEFT JOIN promo_usage_log l ON l.promo_code_id = p.id
     GROUP BY p.id
     ORDER BY total_uses DESC`
  );
  return rows;
}

// ── Validation (customer-facing) ──────────────────────────────────────────────

/**
 * Validate a promo code against the database and compute the discount.
 * Enhanced with daily_limit, min_purchase, max_discount checks.
 *
 * @param {string} code      The promo code string entered by the customer
 * @param {number} subtotal  The order subtotal before any discount
 * @returns {Promise<
 *   | { ok: true,  discount: string, discountAmount: number, finalSubtotal: number, promoCodeId: string }
 *   | { ok: false, message: string }
 * >}
 */
export async function validatePromoCode(code, subtotal) {
  const [rows] = await query(
    'SELECT * FROM promo_codes WHERE UPPER(code) = UPPER(?)',
    [code]
  );

  if (rows.length === 0) {
    return { ok: false, message: 'Kode promo tidak ditemukan.' };
  }

  const row = rows[0];

  // Check active status
  if (!row.is_active) {
    return { ok: false, message: 'Kode promo tidak aktif.' };
  }

  // Check expiry
  if (row.expires_at !== null && new Date(row.expires_at) < new Date()) {
    return { ok: false, message: 'Kode promo sudah kedaluwarsa.' };
  }

  // Check total usage limit
  if (row.max_uses !== null && row.usage_count >= row.max_uses) {
    return { ok: false, message: 'Kode promo sudah mencapai batas penggunaan.' };
  }

  // Check daily limit — count uses today
  if (row.daily_limit !== null) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const [dailyRows] = await query(
      `SELECT COUNT(*) AS count FROM promo_usage_log
       WHERE promo_code_id = ? AND DATE(used_at) = ?`,
      [row.id, today]
    );
    const usesToday = Number(dailyRows[0].count);
    if (usesToday >= row.daily_limit) {
      return { ok: false, message: `Kode promo hanya berlaku untuk ${row.daily_limit} orang pertama per hari. Kuota hari ini sudah habis.` };
    }
  }

  // Check minimum purchase
  if (row.min_purchase > 0 && subtotal < Number(row.min_purchase)) {
    const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(row.min_purchase);
    return { ok: false, message: `Minimal pembelanjaan ${formatted} untuk menggunakan kode promo ini.` };
  }

  // Compute discount
  let discountAmount;
  if (row.type === 'percentage') {
    discountAmount = subtotal * (Number(row.value) / 100);
  } else {
    discountAmount = Math.min(Number(row.value), subtotal);
  }

  // Apply max_discount cap
  if (row.max_discount !== null) {
    discountAmount = Math.min(discountAmount, Number(row.max_discount));
  }

  discountAmount = Math.round(discountAmount); // round to nearest rupiah
  const finalSubtotal = Math.max(0, subtotal - discountAmount);

  return {
    ok: true,
    discount: row.code,
    discountAmount,
    finalSubtotal,
    promoCodeId: row.id,
  };
}

/**
 * Increment the usage counter for a promo code.
 * Accepts an optional connection so it can participate in a caller's transaction.
 *
 * @param {string} promoCodeId  UUID of the promo code row
 * @param {import('mysql2/promise').PoolConnection} [conn]  Optional transaction connection
 */
export async function incrementUsage(promoCodeId, conn) {
  const executor = conn
    ? (sql, params) => conn.execute(sql, params)
    : query;

  await executor(
    'UPDATE promo_codes SET usage_count = usage_count + 1 WHERE id = ?',
    [promoCodeId]
  );
}

/**
 * Record a promo usage log entry.
 * Called after an order is successfully created.
 *
 * @param {{
 *   promoCodeId: string,
 *   orderId: string,
 *   userId?: string|null,
 *   customerName?: string|null,
 *   customerEmail?: string|null,
 *   discountAmount: number,
 *   orderSubtotal: number,
 * }} data
 * @param {import('mysql2/promise').PoolConnection} [conn]
 */
export async function recordUsageLog(data, conn) {
  const executor = conn
    ? (sql, params) => conn.execute(sql, params)
    : query;

  const {
    promoCodeId, orderId, userId, customerName,
    customerEmail, discountAmount, orderSubtotal,
  } = data;

  await executor(
    `INSERT INTO promo_usage_log
       (id, promo_code_id, order_id, user_id, customer_name, customer_email, discount_amount, order_subtotal)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      promoCodeId,
      orderId,
      userId || null,
      customerName || null,
      customerEmail || null,
      Number(discountAmount),
      Number(orderSubtotal),
    ]
  );
}
