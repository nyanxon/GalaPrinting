/**
 * analytics.routes.js — Analytics routes.
 * Public tracking endpoints are rate-limited to 60 req/min per IP.
 *
 * Requirements: 12.1–12.7
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/analytics.controller.js';

const router = Router();

const trackingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Terlalu banyak permintaan.' },
});

// Strict rate-limit for the destructive reset endpoint: max 3 per hour per IP
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Terlalu banyak percobaan reset. Coba lagi dalam 1 jam.' },
});

// Protected analytics (owner + admin)
router.get('/revenue',          authenticate, requireRole('owner', 'admin'), ctrl.getRevenue);
router.get('/monthly',          authenticate, requireRole('owner', 'admin'), ctrl.getMonthly);
router.get('/visits',           authenticate, requireRole('owner', 'admin'), ctrl.getVisits);
router.get('/visits/total',     authenticate, requireRole('owner', 'admin'), ctrl.getTotalVisits);
router.get('/product-views',    authenticate, requireRole('owner', 'admin'), ctrl.getTopProductViews);
router.get('/best-sellers',     authenticate, requireRole('owner', 'admin'), ctrl.getBestSellers);

// Revenue data reset — owner ONLY, rate-limited, requires explicit confirmation body
router.post('/reset', resetLimiter, authenticate, requireRole('owner'), ctrl.resetRevenueData);

// Public tracking (rate limited)
router.post('/visit',        trackingLimiter, ctrl.recordVisit);
router.post('/product-view', trackingLimiter, ctrl.recordProductView);

export default router;
