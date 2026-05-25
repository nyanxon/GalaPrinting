/**
 * reviews.routes.js — Review routes.
 *
 * Requirements: 10.1–10.5
 */

import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/reviews.controller.js';

const router = Router();

router.get('/', ctrl.listReviews);

// GET /api/reviews/reviewed-items — check which items the customer already reviewed
router.get('/reviewed-items', authenticate, requireRole('customer'), ctrl.getReviewedItems);

router.post(
  '/',
  authenticate,
  requireRole('customer'),
  [
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating harus antara 1 dan 5.'),
  ],
  ctrl.createReview
);

router.delete('/:id', authenticate, ctrl.deleteReview);

export default router;
