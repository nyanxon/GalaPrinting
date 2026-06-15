/**
 * export.routes.js — Data export routes (owner + admin only).
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { exportDatabase, exportUploads, exportAll } from '../controllers/export.controller.js';

const router = Router();

// GET /api/export/database — full database snapshot (JSON)
router.get('/database', authenticate, requireRole('owner', 'admin'), exportDatabase);

// GET /api/export/uploads  — all uploaded files as a ZIP
router.get('/uploads',  authenticate, requireRole('owner', 'admin'), exportUploads);

// GET /api/export/all      — one ZIP: Photo/ folder + DB/ folder
router.get('/all',      authenticate, requireRole('owner', 'admin'), exportAll);

export default router;
