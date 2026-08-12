/**
 * features.routes.js — Katalog fitur (owner-only).
 *
 *   GET /api/features — semua fitur dikelompokkan per kategori
 *                       dari config/features.js
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { listFeatures } from '../controllers/adminAccounts.controller.js';

const router = Router();

router.get('/', authenticate, requireRole('owner'), listFeatures);

export default router;
