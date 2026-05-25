/**
 * reviews.controller.js — Request handlers for review endpoints.
 *
 * Requirements: 10.1–10.5
 */

import { validationResult } from 'express-validator';
import * as svc from '../services/reviews.service.js';

export async function listReviews(req, res, next) {
  try {
    const reviews = await svc.listReviews({ productId: req.query.productId });
    return res.json({ ok: true, data: reviews });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reviews/reviewed-items?orderItemIds=id1,id2,...
 * Returns which order item IDs the current customer has already reviewed.
 */
export async function getReviewedItems(req, res, next) {
  try {
    const ids = (req.query.orderItemIds || '').split(',').filter(Boolean);
    const reviewed = await svc.getReviewedItemIds(req.user.id, ids);
    return res.json({ ok: true, data: [...reviewed] });
  } catch (err) {
    next(err);
  }
}

export async function createReview(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ ok: false, message: 'Validasi gagal.', errors: errors.mapped() });
    }

    const { productId, orderId, orderItemId, rating, comment } = req.body;
    const review = await svc.createReview({
      productId,
      orderId,
      orderItemId,
      customerId:   req.user.id,
      customerName: req.user.name,
      rating:       parseInt(rating, 10),
      comment,
    });
    return res.status(201).json({ ok: true, data: review });
  } catch (err) {
    if (err.status === 422) {
      return res.status(422).json({ ok: false, message: err.message });
    }
    if (err.status === 409) {
      return res.status(409).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

export async function deleteReview(req, res, next) {
  try {
    const review = await svc.getReviewById(req.params.id);
    if (!review) {
      return res.status(404).json({ ok: false, message: 'Ulasan tidak ditemukan.' });
    }

    // Only admin or the review author can delete
    if (req.user.role !== 'admin' && review.customer_id !== req.user.id) {
      return res.status(403).json({ ok: false, message: 'Akses ditolak.' });
    }

    await svc.deleteReview(req.params.id);
    return res.json({ ok: true, message: 'Ulasan berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
}
