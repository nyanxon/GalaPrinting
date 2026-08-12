/**
 * adminAccounts.routes.js — Endpoint permission dinamis (owner-only).
 *
 *   GET  /api/admin-accounts
 *   POST /api/admin-accounts/:userId/promote
 *   POST /api/admin-accounts/:userId/revoke
 *   GET  /api/admin-accounts/:userId/permissions
 *   PUT  /api/admin-accounts/:userId/permissions
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/adminAccounts.controller.js';

const router = Router();

const guard = [authenticate, requireRole('owner')];

router.get('/', ...guard, ctrl.listAdminAccounts);
router.post('/:userId/promote', ...guard, ctrl.promoteAccount);
router.post('/:userId/revoke', ...guard, ctrl.revokeAccount);
router.get('/:userId/permissions', ...guard, ctrl.getAccountPermissions);
router.put('/:userId/permissions', ...guard, ctrl.updateAccountPermissions);

export default router;
