/**
 * export.routes.js — Data export routes (owner + admin only).
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { exportDatabase } from '../controllers/export.controller.js';

const router = Router();

// GET /api/export/database — full database snapshot (JSON)
router.get('/database', authenticate, requireRole('owner', 'admin'), exportDatabase);

export default router;
