/**
 * revenue.controller.js — Request handlers for daily revenue recap endpoints.
 *
 * Endpoints:
 *   GET    /api/revenue/daily-recap
 *   POST   /api/revenue/manual-transaction
 *   PUT    /api/revenue/manual-transaction/:id
 *   DELETE /api/revenue/manual-transaction/:id
 *
 * Requirements: 2.1, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2
 */

import * as svc from '../services/revenue.service.js';

const VALID_CATEGORIES = ['offline_store', 'shopee', 'tokopedia', 'tiktok_shop'];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validasi body transaksi manual.
 *
 * @param {{ transaction_date: any, source_category: any, amount: any }} body
 * @returns {string|null} Pesan error pertama, atau null jika valid.
 */
function validateTransactionBody({ transaction_date, source_category, amount }) {
  if (!transaction_date || !ISO_DATE_RE.test(transaction_date)) {
    return 'Tanggal transaksi wajib diisi dan harus berformat YYYY-MM-DD.';
  }

  if (!source_category || !VALID_CATEGORIES.includes(source_category)) {
    return 'Kategori sumber tidak valid.';
  }

  const numericAmount = Number(amount);
  if (amount === undefined || amount === null || amount === '' || isNaN(numericAmount) || numericAmount <= 0) {
    return 'Nominal transaksi wajib diisi dan harus lebih dari 0.';
  }

  return null;
}

/**
 * GET /api/revenue/recap-range?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
export async function getRecapRange(req, res, next) {
  try {
    const { start, end } = req.query;
    if (!start || !ISO_DATE_RE.test(start) || !end || !ISO_DATE_RE.test(end)) {
      return res.status(422).json({ ok: false, message: 'Parameter start dan end wajib berformat YYYY-MM-DD.' });
    }
    if (start > end) {
      return res.status(422).json({ ok: false, message: 'Tanggal awal tidak boleh lebih besar dari tanggal akhir.' });
    }
    const data = await svc.getRecapRange(start, end);
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/revenue/daily-recap?date=YYYY-MM-DD
 *
 * Requirement 2.1, 2.6
 */
export async function getDailyRecap(req, res, next) {
  try {
    const rawDate = req.query.date;
    const date =
      rawDate && ISO_DATE_RE.test(rawDate)
        ? rawDate
        : (() => {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          })();

    const data = await svc.getDailyRecap(date);
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/revenue/manual-transaction
 *
 * Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
export async function createManualTransaction(req, res, next) {
  try {
    const body = { ...req.body };

    // Potong notes sebelum validasi (requirement 3.6)
    if (typeof body.notes === 'string') {
      body.notes = body.notes.slice(0, 500);
    }

    const errorMsg = validateTransactionBody(body);
    if (errorMsg) {
      return res.status(422).json({ ok: false, message: errorMsg });
    }

    const data = await svc.createManualTransaction({
      ...body,
      userId: req.user.id,
    });

    return res.status(201).json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/revenue/manual-transaction/:id
 *
 * Requirements 4.1, 4.2, 4.3, 4.4
 */
export async function updateManualTransaction(req, res, next) {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    // Potong notes sebelum validasi (requirement 3.6)
    if (typeof body.notes === 'string') {
      body.notes = body.notes.slice(0, 500);
    }

    const errorMsg = validateTransactionBody(body);
    if (errorMsg) {
      return res.status(422).json({ ok: false, message: errorMsg });
    }

    const data = await svc.updateManualTransaction(id, {
      ...body,
      userId: req.user.id,
    });

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

/**
 * DELETE /api/revenue/manual-transaction/:id
 *
 * Requirements 5.1, 5.2
 */
export async function deleteManualTransaction(req, res, next) {
  try {
    const { id } = req.params;

    await svc.deleteManualTransaction(id, req.user.id);

    return res.status(200).json({ ok: true, message: 'Transaksi berhasil dihapus.' });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ ok: false, message: err.message });
    }
    next(err);
  }
}
