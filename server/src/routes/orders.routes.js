/**
 * orders.routes.js — Order routes.
 *
 * Requirements: 7.1–7.11
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { uploadPayment, uploadDesign } from '../middleware/upload.js';
import * as ctrl from '../controllers/orders.controller.js';

const router = Router();

const STAFF_ROLES = ['admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'];

// Public
router.get('/track', ctrl.trackOrder);

// Customer
router.post('/',         authenticate, requireRole('customer'), ctrl.createOrder);
router.get('/my',        authenticate, requireRole('customer'), ctrl.listMyOrders);

// Staff-created orders
router.post('/custom',   authenticate, requireRole('cs', 'admin'), ctrl.createCustomOrder);
router.post('/offline',  authenticate, requireRole('offline', 'admin'), ctrl.createOfflineOrder);

// Staff list
router.get('/',          authenticate, requireRole(...STAFF_ROLES), ctrl.listOrders);

// Single order (any authenticated user)
router.get('/:id',       authenticate, ctrl.getOrder);

// Status transitions (staff)
router.patch('/:id/status',   authenticate, requireRole(...STAFF_ROLES), ctrl.updateOrderStatus);
router.patch('/:id/note',     authenticate, requireRole('admin', 'cs'), ctrl.updateAdminNote);
router.patch('/:id/tracking', authenticate, requireRole('qc', 'admin'), ctrl.setTracking);

// Payment proof upload (customer)
router.post(
  '/:id/payment-proof',
  authenticate,
  requireRole('customer'),
  uploadPayment.single('file'),
  ctrl.uploadPaymentProof
);

// Design file upload per order item (customer)
router.post(
  '/:id/items/:itemId/design',
  authenticate,
  requireRole('customer'),
  uploadDesign.single('file'),
  ctrl.uploadDesignFile
);

export default router;
