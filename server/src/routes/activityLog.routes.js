/**
 * activityLog.routes.js — Activity Log routes.
 *
 *   POST   /api/activity-log/batch          optional auth, rate-limited (client telemetry)
 *   GET    /api/activity-log                admin + owner only
 *   GET    /api/activity-log/pdf            admin + owner only
 *   GET    /api/activity-log/unread-count   admin + owner only
 *   POST   /api/activity-log/:id/read       admin + owner only
 *   POST   /api/activity-log/read-all       admin + owner only
 *   DELETE /api/activity-log/older-than     admin + owner only (manual retention)
 *   GET    /api/activity-log/retention      admin + owner only (auto-retention setting)
 *   PUT    /api/activity-log/retention      admin + owner only
 *
 * Requirements: Fitur Activity Log (Fase 1, 4 & 5).
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/activityLog.controller.js';

const router = Router();

// Rate-limit the telemetry intake so a buggy/malicious client cannot flood the
// log table. A normal user with the 5s/20-event flush sends at most a handful
// of batches per minute — 120/min per IP is generous headroom.
const batchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Terlalu banyak permintaan.' },
});

const LOG_ROLES = ['admin', 'owner'];
const guard = [authenticate, requireRole(...LOG_ROLES)];

router.post('/batch', batchLimiter, optionalAuth, ctrl.createBatch);

// Static paths must be registered before the dynamic `/:id/read` route.
router.get('/pdf',            ...guard, ctrl.listLogsForPdf);
router.get('/unread-count',   ...guard, ctrl.unreadCount);
router.post('/read-all',      ...guard, ctrl.markAllRead);
router.get('/retention',      ...guard, ctrl.getRetention);
router.put('/retention',      ...guard, ctrl.updateRetention);
router.delete('/older-than',  ...guard, ctrl.deleteOlderThan);

router.get('/',               ...guard, ctrl.listLogs);
router.post('/:id/read',      ...guard, ctrl.markLogRead);

export default router;
