/**
 * analytics.controller.js — Request handlers for analytics endpoints.
 *
 * Requirements: 12.1–12.7
 */

import * as svc from '../services/analytics.service.js';

export async function getRevenue(req, res, next) {
  try {
    const data = await svc.getRevenue();
    return res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getMonthly(req, res, next) {
  try {
    const data = await svc.getMonthlyStats();
    return res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getVisits(req, res, next) {
  try {
    const data = await svc.getVisits();
    return res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getTotalVisits(req, res, next) {
  try {
    const total = await svc.getTotalVisits();
    return res.json({ ok: true, data: { total } });
  } catch (err) {
    next(err);
  }
}

export async function getTopProductViews(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 5;
    const data = await svc.getTopProductViews(limit);
    return res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getBestSellers(req, res, next) {
  try {
    const data = await svc.getBestSellers();
    return res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function recordVisit(req, res, next) {
  try {
    await svc.recordVisit();
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function recordProductView(req, res, next) {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(422).json({ ok: false, message: 'productId wajib diisi.' });
    }
    await svc.recordProductView(productId);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
