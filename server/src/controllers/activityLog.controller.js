/**
 * activityLog.controller.js — Request handlers for the Activity Log feature.
 *
 * Endpoints:
 *   POST   /api/activity-log/batch          (auth optional, rate-limited)
 *   GET    /api/activity-log                (admin + owner)
 *   GET    /api/activity-log/pdf            (admin + owner)
 *   DELETE /api/activity-log/older-than     (admin + owner)
 *
 * Security note: actor_type / actor_id / actor_name / actor_role are ALWAYS
 * derived from the JWT (req.user) on the server, NEVER trusted from the body,
 * so a client cannot forge who performed an action.
 */

import { STAFF_ROLES } from '../config/roles.js';
import * as svc from '../services/activityLog.service.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BATCH = 100;

/**
 * POST /api/activity-log/batch
 * Body: { events: [ { actionLabel, pagePath, targetType, targetId, metadata, clientTimestamp } ] }
 *
 * Auth is OPTIONAL: public-page clicks may come from users who are not logged
 * in yet (they are still attributed to 'customer' with a NULL actor_id/name).
 */
export async function createBatch(req, res) {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : null;
    if (!events) {
      return res.status(422).json({ ok: false, message: 'Body harus berupa { events: [...] }.' });
    }
    if (events.length > MAX_BATCH) {
      return res.status(422).json({ ok: false, message: `Maksimal ${MAX_BATCH} event per request.` });
    }

    // Derive actor from JWT (req.user set by authenticate when present).
    const isStaff = req.user && STAFF_ROLES.includes(req.user.role);
    const actorType = isStaff ? 'admin' : 'customer';
    const actorId = req.user ? req.user.id : null;
    const actorName = req.user ? (req.user.name || null) : null;
    const actorRole = isStaff ? req.user.role : null;

    const ipAddress = req.ip || req.socket?.remoteAddress || null;

    const enriched = events.map((ev) => ({
      actor_type: actorType,
      actor_id: actorId,
      actor_name: actorName,
      actor_role: actorRole,
      action_label: typeof ev?.actionLabel === 'string' ? ev.actionLabel : '',
      page_path: typeof ev?.pagePath === 'string' ? ev.pagePath : null,
      target_type: typeof ev?.targetType === 'string' ? ev.targetType : null,
      target_id: typeof ev?.targetId === 'string' ? ev.targetId : null,
      metadata: ev?.metadata ?? null,
      ip_address: ipAddress,
    }));

    const inserted = await svc.insertBatch(enriched);
    return res.status(200).json({ ok: true, inserted });
  } catch (err) {
    // Logging must never break the user's request flow — fall back to 200.
    console.error('[activity-log] batch save error:', err?.message);
    return res.status(200).json({ ok: true, inserted: 0, skipped: true });
  }
}

/**
 * GET /api/activity-log — paginated list (admin + owner only).
 */
export async function listLogs(req, res, next) {
  try {
    const { actorType, from, to, actorId, search, page, limit } = req.query;

    if (actorType && actorType !== 'customer' && actorType !== 'admin') {
      return res.status(422).json({ ok: false, message: 'actorType harus customer atau admin.' });
    }
    if (from && !ISO_DATE_RE.test(from)) {
      return res.status(422).json({ ok: false, message: 'from harus berformat YYYY-MM-DD.' });
    }
    if (to && !ISO_DATE_RE.test(to)) {
      return res.status(422).json({ ok: false, message: 'to harus berformat YYYY-MM-DD.' });
    }
    if (from && to && from > to) {
      return res.status(422).json({ ok: false, message: 'Tanggal awal tidak boleh lebih besar dari tanggal akhir.' });
    }

    const result = await svc.listLogs({
      actorType, from, to, actorId, search, page, limit,
      readerUserId: req.user?.id,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/activity-log/pdf — raw rows for PDF export (admin + owner only).
 * Returns rows as JSON; the PDF generation happens client-side (jsPDF),
 * reusing the same styling approach as the frontend recap export.
 */
export async function listLogsForPdf(req, res, next) {
  try {
    const { actorType, from, to, actorId, search } = req.query;

    if (actorType && actorType !== 'customer' && actorType !== 'admin') {
      return res.status(422).json({ ok: false, message: 'actorType harus customer atau admin.' });
    }
    if (from && !ISO_DATE_RE.test(from)) {
      return res.status(422).json({ ok: false, message: 'from harus berformat YYYY-MM-DD.' });
    }
    if (to && !ISO_DATE_RE.test(to)) {
      return res.status(422).json({ ok: false, message: 'to harus berformat YYYY-MM-DD.' });
    }

    const items = await svc.listLogsForPdf({
      actorType, from, to, actorId, search, readerUserId: req.user?.id,
    });
    return res.json({ ok: true, items });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/activity-log/older-than?months=1|3|6
 * Manual retention: owner/admin can delete logs older than a chosen number of months.
 */
export async function deleteOlderThan(req, res, next) {
  try {
    const months = parseInt(req.query.months, 10);
    if (![1, 3, 6].includes(months)) {
      return res.status(422).json({ ok: false, message: 'months harus 1, 3, atau 6.' });
    }

    const cutoffStr = svc.monthsAgoCutoff(months);
    const deleted = await svc.deleteOlderThan(cutoffStr);
    return res.json({ ok: true, deleted, cutoff: cutoffStr });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/activity-log/:id/read — mark one log as read for the current reader.
 */
export async function markLogRead(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const readerId = req.user?.id;
    if (!Number.isInteger(id) || !readerId) {
      return res.status(422).json({ ok: false, message: 'ID log tidak valid.' });
    }
    const created = await svc.markLogRead(id, readerId);
    return res.json({ ok: true, read: true, created });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/activity-log/read-all — mark every log as read for the current reader.
 */
export async function markAllRead(req, res, next) {
  try {
    const created = await svc.markAllRead(req.user?.id);
    return res.json({ ok: true, marked: created });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/activity-log/unread-count — unread log count for the current reader.
 */
export async function unreadCount(req, res, next) {
  try {
    const count = await svc.unreadCountFor(req.user?.id);
    return res.json({ ok: true, count });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/activity-log/retention — current auto-retention setting.
 */
export async function getRetention(req, res, next) {
  try {
    const setting = await svc.getRetentionSetting();
    return res.json({ ok: true, ...setting });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/activity-log/retention — set auto-retention months (0|3|6|12).
 */
export async function updateRetention(req, res, next) {
  try {
    const months = parseInt(req.body?.months, 10);
    if (![0, 3, 6, 12].includes(months)) {
      return res.status(422).json({ ok: false, message: 'months harus 0, 3, 6, atau 12 (0 = nonaktif).' });
    }
    const setting = await svc.setRetentionSetting(months);
    return res.json({ ok: true, ...setting });
  } catch (err) {
    next(err);
  }
}
