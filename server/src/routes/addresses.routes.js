/**
 * addresses.routes.js — Address management routes.
 *
 * Requirements: 5.1, 5.3, 5.8, 5.9, 5.11, 9.2, 9.3
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/addresses.controller.js';

const router = Router();

router.get('/',     authenticate, ctrl.listAddresses);
router.post('/',    authenticate, ctrl.createAddress);
router.put('/:id',  authenticate, ctrl.updateAddress);
router.delete('/:id', authenticate, ctrl.deleteAddress);

export default router;
