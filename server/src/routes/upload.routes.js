/**
 * upload.routes.js — Standalone upload endpoints.
 *
 * Provides generic file upload endpoints for various use cases.
 * Returns the file path/URL that can be used in subsequent API calls.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { uploadDesign, uploadPayment, uploadChat, uploadAvatar, uploadProduct, uploadReview } from '../middleware/upload.js';
import { createUploadHandler } from '../controllers/upload.controller.js';

const router = Router();

router.post('/design',  authenticate, uploadDesign.single('file'),   createUploadHandler('designs'));
router.post('/payment', authenticate, uploadPayment.single('file'),  createUploadHandler('payments'));
router.post('/avatar',  authenticate, uploadAvatar.single('file'),   createUploadHandler('avatars'));
router.post('/chat',    authenticate, uploadChat.single('file'),     createUploadHandler('chat'));
router.post('/product', authenticate, uploadProduct.single('file'),  createUploadHandler('products'));
router.post('/review',  authenticate, uploadReview.single('file'),   createUploadHandler('reviews'));

export default router;
