/**
 * promo.controller.js — Request handlers for promo code endpoints.
 *
 * Requirements: 2.2, 2.3, 2.9
 */

import * as svc from '../services/promo.service.js';

// ── Customer: validate ────────────────────────────────────────────────────────

/**
 * POST /api/promo/validate
 * Body: { code: string, subtotal: number }
 */
export async function validatePromoCode(req, res, next) {
  try {
    const { code, subtotal } = req.body;

    if (!code || String(code).trim() === '') {
      return res.status(422).json({ ok: false, message: 'Kode promo wajib diisi.' });
    }

    const subtotalNum = Number(subtotal);
    if (!Number.isFinite(subtotalNum) || subtotalNum <= 0) {
      return res.status(422).json({ ok: false, message: 'Subtotal tidak valid.' });
    }

    const result = await svc.validatePromoCode(code, subtotalNum);

    if (result.ok === false) {
      return res.status(422).json({ ok: false, message: result.message });
    }

    return res.status(200).json({
      ok: true,
      discount: result.discount,
      discountAmount: result.discountAmount,
      finalSubtotal: result.finalSubtotal,
    });
  } catch (err) {
    next(err);
  }
}

// ── Admin/Owner: CRUD ─────────────────────────────────────────────────────────

/**
 * GET /api/promo
 * List all promo codes.
 */
export async function listPromoCodes(req, res, next) {
  try {
    const promos = await svc.listPromoCodes();
    return res.json({ ok: true, data: promos });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/promo
 * Create a new promo code.
 */
export async function createPromoCode(req, res, next) {
  try {
    const promo = await svc.createPromoCode(req.body);
    return res.status(201).json({ ok: true, data: promo });
  } catch (err) {
    if (err.status === 422) return res.status(422).json({ ok: false, message: err.message });
    if (err.status === 409) return res.status(409).json({ ok: false, message: err.message });
    next(err);
  }
}

/**
 * PUT /api/promo/:id
 * Update a promo code.
 */
export async function updatePromoCode(req, res, next) {
  try {
    const promo = await svc.updatePromoCode(req.params.id, req.body);
    return res.json({ ok: true, data: promo });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ ok: false, message: err.message });
    if (err.status === 422) return res.status(422).json({ ok: false, message: err.message });
    if (err.status === 409) return res.status(409).json({ ok: false, message: err.message });
    next(err);
  }
}

/**
 * DELETE /api/promo/:id
 * Delete a promo code.
 */
export async function deletePromoCode(req, res, next) {
  try {
    await svc.deletePromoCode(req.params.id);
    return res.json({ ok: true, message: 'Kode promo berhasil dihapus.' });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ ok: false, message: err.message });
    next(err);
  }
}

/**
 * GET /api/promo/:id/usage
 * Get usage log for a specific promo code.
 */
export async function getPromoUsageLog(req, res, next) {
  try {
    const log = await svc.getPromoUsageLog(req.params.id);
    return res.json({ ok: true, data: log });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/promo/stats
 * Get aggregated usage stats for all promo codes.
 */
export async function getPromoStats(req, res, next) {
  try {
    const stats = await svc.getPromoStats();
    return res.json({ ok: true, data: stats });
  } catch (err) {
    next(err);
  }
}
