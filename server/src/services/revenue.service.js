/**
 * Ubah nilai tanggal dari DB menjadi kunci string YYYY-MM-DD.
 *
 * mysql2 mengembalikan kolom DATE/DATETIME sebagai objek Date, bukan string.
 * Tanpa normalisasi ini, `pay_date`/`transaction_date` tidak akan pernah
 * cocok dengan kunci iterasi tanggal (mis. "2026-07-26"), sehingga seluruh
 * transaksi ter-drop dan semua total menjadi 0 di PDF rekap.
 *
 * @param {Date|string} value
 * @returns {string} Kunci tanggal berformat YYYY-MM-DD
 */
function toDateKey(value) {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(value);
  return s.length > 10 ? s.slice(0, 10) : s;
}

/**
 * Hitung rekap pendapatan untuk rentang tanggal.
 *
 * @param {string} start - format YYYY-MM-DD
 * @param {string} end   - format YYYY-MM-DD
 * @returns {Promise<Array<{ date: string, website_total: number, manual_by_category: object, grand_total: number, website_transactions: object[], manual_transactions: object[] }>>}
 */
export async function getRecapRange(start, end) {
  const [websiteRows] = await query(
    `SELECT o.id, o.order_number, o.customer_id, o.subtotal, o.status, o.source,
            DATE(oh.created_at + INTERVAL 7 HOUR) AS pay_date,
            oh.created_at AS paid_at
     FROM orders o
     INNER JOIN order_history oh
       ON oh.order_id = o.id AND oh.to_status = 'Payment Accepted'
     WHERE DATE(oh.created_at + INTERVAL 7 HOUR) BETWEEN ? AND ?
       AND o.status != 'Cancelled'
     ORDER BY oh.created_at ASC`,
    [start, end]
  );

  const [manualRows] = await query(
    `SELECT id, transaction_date, source_category, amount, notes,
            created_by, updated_by, created_at, updated_at
     FROM manual_revenue_transactions
     WHERE transaction_date BETWEEN ? AND ?
       AND deleted_at IS NULL
       AND source_category != 'offline_store'
     ORDER BY transaction_date ASC, created_at ASC`,
    [start, end]
  );

  // Group website rows by date
  const websiteByDate = {};
  for (const row of websiteRows) {
    const d = toDateKey(row.pay_date);
    if (!websiteByDate[d]) websiteByDate[d] = [];
    websiteByDate[d].push(row);
  }

  // Group manual rows by date
  const manualByDate = {};
  for (const row of manualRows) {
    const d = toDateKey(row.transaction_date);
    if (!manualByDate[d]) manualByDate[d] = [];
    manualByDate[d].push(row);
  }

  // Build per-day results — iterate using YYYY-MM-DD strings to avoid
  // timezone drift (toISOString() uses UTC, which shifts dates in WIB).
  const results = [];
  let current = start;
  while (current <= end) {
    const wRows = websiteByDate[current] ?? [];
    const mRows = manualByDate[current] ?? [];

    const website_total = wRows.reduce((s, r) => s + parseFloat(r.subtotal ?? 0), 0);
    const manual_by_category = { shopee: 0, tokopedia: 0, tiktok_shop: 0 };
    for (const r of mRows) {
      if (r.source_category in manual_by_category) {
        manual_by_category[r.source_category] += parseFloat(r.amount ?? 0);
      }
    }
    const manual_sum = Object.values(manual_by_category).reduce((a, b) => a + b, 0);

    results.push({
      date: current,
      website_total,
      manual_by_category,
      grand_total: website_total + manual_sum,
      website_transactions: wRows,
      manual_transactions: mRows,
    });

    // Advance by 1 day using pure string arithmetic (YYYY-MM-DD)
    // Avoid toISOString() which uses UTC and shifts dates in WIB
    const parts = current.split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) + 1);
    current = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return results;
}

/**
 * revenue.service.js — Business logic for daily revenue recap.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 4.1, 4.2, 5.1
 */

import { query } from '../db/connection.js';
import { randomUUID } from 'crypto';

/**
 * Hitung rekap pendapatan harian untuk satu tanggal.
 *
 * @param {string} date - format YYYY-MM-DD
 * @returns {Promise<{
 *   date: string,
 *   website_total: number,
 *   manual_by_category: { shopee: number, tokopedia: number, tiktok_shop: number },
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
     WHERE DATE(oh.created_at + INTERVAL 7 HOUR) = ?
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
       AND source_category != 'offline_store'
     ORDER BY created_at ASC`,
    [date]
  );

  // Aggregate per source category
  const manual_by_category = {
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
