/**
 * promo.routes.js — Promo code routes.
 *
 * Requirements: 2.9
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/promo.controller.js';

const router = Router();

// ── Customer ──────────────────────────────────────────────────────────────────
// POST /api/promo/validate — validate a promo code against a subtotal
router.post('/validate', authenticate, requireRole('customer'), ctrl.validatePromoCode);

// ── Admin / Owner ─────────────────────────────────────────────────────────────
// GET  /api/promo/stats   — aggregated usage stats (must be before /:id)
router.get('/stats',    authenticate, requireRole('admin', 'owner'), ctrl.getPromoStats);

// GET  /api/promo         — list all promo codes
router.get('/',         authenticate, requireRole('admin', 'owner'), ctrl.listPromoCodes);

// POST /api/promo         — create a new promo code
router.post('/',        authenticate, requireRole('admin', 'owner'), ctrl.createPromoCode);

// PUT  /api/promo/:id     — update a promo code
router.put('/:id',      authenticate, requireRole('admin', 'owner'), ctrl.updatePromoCode);

// DELETE /api/promo/:id   — delete a promo code
router.delete('/:id',   authenticate, requireRole('admin', 'owner'), ctrl.deletePromoCode);

// GET  /api/promo/:id/usage — usage log for a specific promo code
router.get('/:id/usage', authenticate, requireRole('admin', 'owner'), ctrl.getPromoUsageLog);

export default router;
