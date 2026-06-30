/**
 * analytics.controller.js — Request handlers for analytics endpoints.
 *
 * All protected endpoints now accept optional query params:
 *   from       — YYYY-MM-DD, start of date range
 *   to         — YYYY-MM-DD, end of date range
 *   categoryId — UUID, filter by product category
 *   customerId — UUID, filter by customer
 *   status     — single order status string
 *
 * Requirements: 12.1–12.7
 */

import * as svc from '../services/analytics.service.js';

/** Extract and validate filter params from req.query */
function extractFilters(query) {
  const filters = {};
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;

  if (query.from && isoDate.test(query.from)) filters.from = query.from;
  if (query.to   && isoDate.test(query.to))   filters.to   = query.to;
  if (query.categoryId) filters.categoryId = String(query.categoryId);
  if (query.customerId) filters.customerId = String(query.customerId);
  if (query.status)     filters.status     = String(query.status);

  return filters;
}

export async function getRevenue(req, res, next) {
  try {
    const data = await svc.getRevenue(extractFilters(req.query));
    return res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getMonthly(req, res, next) {
  try {
    const data = await svc.getMonthlyStats(extractFilters(req.query));
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
    const data = await svc.getBestSellers(extractFilters(req.query));
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

export async function resetRevenueData(req, res, next) {
  try {
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : null;
    const result = await svc.resetAllRevenueData({ actorId: req.user.id, note });

    console.log(
      `[analytics] Revenue reset by user ${req.user.id} (${req.user.name}): ` +
      `${result.ordersDeleted} orders, ${result.visitsDeleted} visits, ${result.viewsDeleted} product views deleted.`
    );

    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
}
