/**
 * users.routes.js — User and staff management routes.
 *
 * Requirements: 13.1–13.7
 */

import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { STAFF_ROLES } from '../config/roles.js';
import * as ctrl from '../controllers/users.controller.js';

const router = Router();

router.get('/customers', authenticate, requireRole('admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'), ctrl.listCustomers);
router.get('/staff',     authenticate, requireRole('admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'), ctrl.listStaff);

router.post(
  '/staff',
  authenticate,
  requireRole('admin'),
  [
    body('name').trim().notEmpty().withMessage('Nama wajib diisi.'),
    body('email').isEmail().normalizeEmail().withMessage('Email tidak valid.'),
    body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter.'),
    body('role').isIn(STAFF_ROLES).withMessage('Role tidak valid.'),
  ],
  ctrl.createStaff
);

router.delete('/:id', authenticate, requireRole('owner'), ctrl.deleteUser);

export default router;
