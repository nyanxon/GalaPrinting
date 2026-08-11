/**
 * orders.routes.js — Order routes.
 *
 * Requirements: 7.1–7.11
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { uploadPayment, uploadDesign } from '../middleware/upload.js';
import { STAFF_ROLES } from '../config/roles.js';
import * as ctrl from '../controllers/orders.controller.js';
import { getInvoiceByOrder } from '../controllers/invoice.controller.js';

const router = Router();

// Public
router.get('/track', ctrl.trackOrder);

// Customer + all authenticated roles
const ALL_ROLES = ['customer', 'cashier', 'cs', 'operational', 'qc', 'admin', 'owner', 'offline'];
router.post('/',                authenticate, requireRole(...ALL_ROLES), ctrl.createOrder);
router.get('/my',               authenticate, requireRole(...ALL_ROLES), ctrl.listMyOrders);
router.post('/custom-customer', authenticate, requireRole(...ALL_ROLES), ctrl.createCustomOrderByCustomer);

// Staff-created orders
router.post('/custom',   authenticate, requireRole('cs', 'admin'), ctrl.createCustomOrder);
router.post('/offline',  authenticate, requireRole('offline', 'admin', 'cashier'), ctrl.createOfflineOrder);

// Staff list
router.get('/',          authenticate, requireRole(...STAFF_ROLES), ctrl.listOrders);

// Single order (any authenticated user)
router.get('/:id',       authenticate, ctrl.getOrder);

// Status transitions (staff)
router.patch('/:id/status',          authenticate, requireRole(...STAFF_ROLES), ctrl.updateOrderStatus);
router.patch('/:id/note',            authenticate, requireRole('admin', 'cs'), ctrl.updateAdminNote);
router.patch('/:id/tracking',        authenticate, requireRole('qc', 'admin'), ctrl.setTracking);
router.patch('/:id/delivery-method', authenticate, requireRole('qc', 'cs', 'admin'), ctrl.setDeliveryMethod);
router.patch('/:id/pickup',          authenticate, requireRole('qc', 'admin'), ctrl.setPickupInfo);

// Delete custom order (cs, admin only)
router.delete('/:id', authenticate, requireRole('cs', 'admin'), ctrl.deleteOrder);

// Invoice untuk order (customer & staff bisa lihat)
router.get('/:orderId/invoice', authenticate, getInvoiceByOrder);

// Payment proof upload (semua role yang login)
router.post(
  '/:id/payment-proof',
  authenticate,
  requireRole('customer', 'cashier', 'cs', 'operational', 'qc', 'admin', 'owner', 'offline'),
  uploadPayment.single('file'),
  ctrl.uploadPaymentProof
);

// Design file upload per order item (semua role yang login)
router.post(
  '/:id/items/:itemId/design',
  authenticate,
  requireRole('customer', 'cashier', 'cs', 'operational', 'qc', 'admin', 'owner', 'offline'),
  uploadDesign.single('file'),
  ctrl.uploadDesignFile
);

export default router;
