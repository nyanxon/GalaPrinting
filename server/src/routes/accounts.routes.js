/**
 * accounts.routes.js — Account management routes.
 *
 * Owner-only:
 *   GET    /api/admin/accounts            — list all accounts
 *   GET    /api/admin/accounts/:id        — get account detail
 *   PUT    /api/admin/accounts/:id        — update role + permissions
 *
 * Staff (owner, admin, cs):
 *   POST   /api/admin/accounts/customers  — create customer account
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/accounts.controller.js';

const router = Router();
const ownerGuard  = [authenticate, requireRole('owner')];
const staffGuard  = [authenticate, requireRole('owner', 'admin', 'cs')];

router.get('/',          ...ownerGuard, ctrl.listAccounts);
router.get('/:id',       ...ownerGuard, ctrl.getAccount);
router.put('/:id',       ...ownerGuard, ctrl.updateAccount);

// Customer creation — owner, admin, and cs can create customer accounts
router.post('/customers', ...staffGuard, ctrl.createCustomerAccount);

export default router;
