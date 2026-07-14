/**
 * revenue.service.js — Business logic for daily revenue recap.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 4.1, 4.2, 5.1
 */

import { query } from '../db/connection.js';
import { randomUUID } from 'crypto';

const SOURCE_CATEGORIES = ['offline_store', 'shopee', 'tokopedia', 'tiktok_shop'];

/**
 * Hitung rekap pendapatan harian untuk satu tanggal.
 *
 * @param {string} date - format YYYY-MM-DD
 * @returns {Promise<{
 *   date: string,
 *   website_total: number,
 *   manual_by_category: { offline_store: number, shopee: number, tokopedia: number, tiktok_shop: number },
 *   grand_total: number,
 *   website_transactions: object[],
 *   manual_transactions: object[],
 * }>}
 */
export async function getDailyRecap(date) {
  // ── 1. Website orders (based on Payment Accepted date) ─────────────────
  const [websiteRows] = await query(
    `SELECT o.id, o.order_number, o.customer_id, o.subtotal, o.status,
            oh.created_at AS paid_at
     FROM orders o
     INNER JOIN order_history oh
       ON oh.order_id = o.id AND oh.to_status = 'Payment Accepted'
     WHERE DATE(oh.created_at) = ?
       AND o.status != 'Cancelled'
     ORDER BY oh.created_at ASC`,
    [date]
  );

  const website_total = websiteRows.reduce((sum, row) => sum + parseFloat(row.subtotal ?? 0), 0);

  // ── 2. Manual transactions ───────────────────────────────────────────────
  const [manualRows] = await query(
    `SELECT id, transaction_date, source_category, amount, notes,
            created_by, updated_by, created_at, updated_at
     FROM manual_revenue_transactions
     WHERE transaction_date = ?
       AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [date]
  );

  // Aggregate per source category
  const manual_by_category = {
    offline_store: 0,
    shopee: 0,
    tokopedia: 0,
    tiktok_shop: 0,
  };

  for (const row of manualRows) {
    if (row.source_category in manual_by_category) {
      manual_by_category[row.source_category] += parseFloat(row.amount ?? 0);
    }
  }

  // ── 3. Grand total ───────────────────────────────────────────────────────
  const manual_sum = Object.values(manual_by_category).reduce((a, b) => a + b, 0);
  const grand_total = website_total + manual_sum;

  return {
    date,
    website_total,
    manual_by_category,
    grand_total,
    website_transactions: websiteRows,
    manual_transactions: manualRows,
  };
}

/**
 * Buat satu entri transaksi manual baru.
 *
 * @param {{ transaction_date: string, source_category: string, amount: number, notes?: string, userId: string }} data
 * @returns {Promise<object>} Entri yang baru dibuat
 */
export async function createManualTransaction({ transaction_date, source_category, amount, notes, userId }) {
  const id = randomUUID();
  const truncatedNotes = notes ? String(notes).slice(0, 500) : null;
  const now = new Date();

  await query(
    `INSERT INTO manual_revenue_transactions
       (id, transaction_date, source_category, amount, notes, created_by, updated_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [id, transaction_date, source_category, amount, truncatedNotes, userId, now, now]
  );

  const [[newEntry]] = await query(
    `SELECT id, transaction_date, source_category, amount, notes,
            created_by, updated_by, created_at, updated_at
     FROM manual_revenue_transactions
     WHERE id = ?`,
    [id]
  );

  return newEntry;
}

/**
 * Perbarui entri transaksi manual yang sudah ada.
 *
 * @param {string} id
 * @param {{ transaction_date: string, source_category: string, amount: number, notes?: string, userId: string }} data
 * @returns {Promise<object>} Entri yang sudah diperbarui
 * @throws {{ status: 404 }} Jika entri tidak ditemukan atau sudah dihapus
 */
export async function updateManualTransaction(id, { transaction_date, source_category, amount, notes, userId }) {
  const truncatedNotes = notes ? String(notes).slice(0, 500) : null;
  const now = new Date();

  const [result] = await query(
    `UPDATE manual_revenue_transactions
     SET transaction_date = ?,
         source_category  = ?,
         amount           = ?,
         notes            = ?,
         updated_by       = ?,
         updated_at       = ?
     WHERE id = ?
       AND deleted_at IS NULL`,
    [transaction_date, source_category, amount, truncatedNotes, userId, now, id]
  );

  if (result.affectedRows === 0) {
    const err = new Error('Transaksi tidak ditemukan.');
    err.status = 404;
    throw err;
  }

  const [[updatedEntry]] = await query(
    `SELECT id, transaction_date, source_category, amount, notes,
            created_by, updated_by, created_at, updated_at
     FROM manual_revenue_transactions
     WHERE id = ?`,
    [id]
  );

  return updatedEntry;
}

/**
 * Soft-delete transaksi manual (isi deleted_at, jangan hapus baris).
 *
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<void>}
 * @throws {{ status: 404 }} Jika entri tidak ditemukan atau sudah dihapus
 */
export async function deleteManualTransaction(id, userId) {
  const [result] = await query(
    `UPDATE manual_revenue_transactions
     SET deleted_at  = NOW(),
         updated_by  = ?,
         updated_at  = NOW()
     WHERE id = ?
       AND deleted_at IS NULL`,
    [userId, id]
  );

  if (result.affectedRows === 0) {
    const err = new Error('Transaksi tidak ditemukan.');
    err.status = 404;
    throw err;
  }
}
