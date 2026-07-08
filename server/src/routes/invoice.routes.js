/**
 * invoice.routes.js — Routes untuk invoice (Fitur 2 & 4).
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/invoice.controller.js';

const router = Router();

// Cashier & admin bisa list/create/update invoice
const INVOICE_ROLES = ['cashier', 'admin', 'owner'];
const VIEW_ROLES = ['cashier', 'admin', 'owner', 'cs', 'operational', 'qc', 'offline'];

router.get('/',         authenticate, requireRole(...VIEW_ROLES), ctrl.listInvoices);
router.post('/',        authenticate, requireRole(...INVOICE_ROLES), ctrl.createInvoice);
router.get('/:id',      authenticate, requireRole(...VIEW_ROLES), ctrl.getInvoice);
router.patch('/:id',    authenticate, requireRole(...INVOICE_ROLES), ctrl.updateInvoice);
router.patch('/:id/payment-status', authenticate, requireRole(...INVOICE_ROLES), ctrl.updatePaymentStatus);
router.post('/:id/send-email',      authenticate, requireRole(...INVOICE_ROLES), ctrl.sendInvoiceEmailEndpoint);
router.get('/:id/pdf',              authenticate, requireRole(...VIEW_ROLES), ctrl.downloadInvoicePdf);

export default router;
