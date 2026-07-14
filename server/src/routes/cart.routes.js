/**
 * cart.routes.js — Cart routes (require authentication, open to all roles).
 *
 * Requirements: 8.1–8.7
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/cart.controller.js';

const router = Router();

router.use(authenticate);

router.get('/',                  ctrl.getCart);
router.post('/items',            ctrl.addItem);
router.patch('/items/:itemId',   ctrl.updateItemQty);
router.delete('/items/:itemId',  ctrl.removeItem);
router.delete('/',               ctrl.clearCart);
router.post('/sync',             ctrl.syncCart);

export default router;
