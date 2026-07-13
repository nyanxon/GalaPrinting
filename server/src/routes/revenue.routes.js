/**
 * revenue.routes.js — Daily revenue recap routes.
 * All endpoints require JWT authentication and cashier/admin/owner role.
 *
 * Requirements: 6.1
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/revenue.controller.js';

const router = Router();
const guard = [authenticate, requireRole('cashier', 'admin', 'owner')];

router.get('/daily-recap',              ...guard, ctrl.getDailyRecap);
router.post('/manual-transaction',       ...guard, ctrl.createManualTransaction);
router.put('/manual-transaction/:id',    ...guard, ctrl.updateManualTransaction);
router.delete('/manual-transaction/:id', ...guard, ctrl.deleteManualTransaction);

export default router;
