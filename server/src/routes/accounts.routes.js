/**
 * accounts.routes.js — Account management routes (owner-only).
 *
 * Provides cross-role user listing, detail with permissions, and
 * role/permission updates.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/accounts.controller.js';

const router = Router();
const guard  = [authenticate, requireRole('owner')];

router.get('/',    ...guard, ctrl.listAccounts);
router.get('/:id', ...guard, ctrl.getAccount);
router.put('/:id', ...guard, ctrl.updateAccount);

export default router;
