/**
 * profile.routes.js — Customer profile routes.
 *
 * Requirements: 2.3, 2.4, 2.5, 3.6, 9.1, 9.2
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { uploadAvatar } from '../middleware/upload.js';
import * as ctrl from '../controllers/profile.controller.js';
import * as notifCtrl from '../controllers/notifications.controller.js';

const router = Router();

// GET /api/profile — fetch the authenticated customer's profile
router.get('/', authenticate, ctrl.getProfile);

// PUT /api/profile — update biodata (name, phone, dob, gender)
router.put('/', authenticate, ctrl.updateProfile);

// POST /api/profile/avatar — upload profile photo (multipart/form-data)
router.post('/avatar', authenticate, uploadAvatar.single('avatar'), ctrl.uploadAvatar);

// GET /api/profile/notifications — fetch notification preferences
router.get('/notifications', authenticate, notifCtrl.getPreferences);

// PUT /api/profile/notifications — update notification preferences
router.put('/notifications', authenticate, notifCtrl.updatePreferences);

export default router;
