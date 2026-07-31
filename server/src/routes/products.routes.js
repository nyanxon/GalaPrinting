/**
 * products.routes.js — Product and category routes.
 *
 * Requirements: 6.1–6.9
 */

import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { uploadProduct } from '../middleware/upload.js';
import * as ctrl from '../controllers/products.controller.js';

const router = Router();

// ── Upload ────────────────────────────────────────────────────────────────────
router.post('/upload-image', authenticate, requireRole('admin', 'owner'), uploadProduct.single('image'), ctrl.uploadProductImage);

// ── Products ──────────────────────────────────────────────────────────────────
router.get('/',    ctrl.listProducts);
router.get('/search', ctrl.searchProducts); // WAJIB sebelum /:id
router.get('/:id', ctrl.getProduct);

router.post(
  '/',
  authenticate,
  requireRole('admin', 'owner'),
  [
    body('name').trim().notEmpty().withMessage('Nama produk wajib diisi.'),
    body('priceCustomer').optional().isFloat({ min: 0 }).withMessage('Harga customer harus berupa angka ≥ 0.'),
    body('price_customer').optional().isFloat({ min: 0 }).withMessage('Harga customer harus berupa angka ≥ 0.'),
    body('priceBroker').optional().isFloat({ min: 0 }).withMessage('Harga broker harus berupa angka ≥ 0.'),
    body('price_broker').optional().isFloat({ min: 0 }).withMessage('Harga broker harus berupa angka ≥ 0.'),
  ],
  ctrl.createProduct
);

router.put(
  '/:id',
  authenticate,
  requireRole('admin', 'owner'),
  [
    body('priceCustomer').optional().isFloat({ min: 0 }).withMessage('Harga customer harus berupa angka ≥ 0.'),
    body('price_customer').optional().isFloat({ min: 0 }).withMessage('Harga customer harus berupa angka ≥ 0.'),
    body('priceBroker').optional().isFloat({ min: 0 }).withMessage('Harga broker harus berupa angka ≥ 0.'),
    body('price_broker').optional().isFloat({ min: 0 }).withMessage('Harga broker harus berupa angka ≥ 0.'),
  ],
  ctrl.updateProduct
);

router.delete(
  '/:id',
  authenticate,
  requireRole('admin', 'owner'),
  ctrl.deleteProduct
);

// ── Categories (mounted at /api/categories via separate route) ────────────────
// These are exported separately and mounted in app.js under /api/categories
export { router as productRouter };

// Category router
import { Router as CatRouter } from 'express';
const catRouter = CatRouter();

import * as catCtrl from '../controllers/products.controller.js';

catRouter.get('/', catCtrl.listCategories);

catRouter.post(
  '/',
  authenticate,
  requireRole('admin', 'owner'),
  [body('name').trim().notEmpty().withMessage('Nama kategori wajib diisi.')],
  catCtrl.createCategory
);

catRouter.put(
  '/:id',
  authenticate,
  requireRole('admin', 'owner'),
  [body('name').trim().notEmpty().withMessage('Nama kategori wajib diisi.')],
  catCtrl.updateCategory
);

catRouter.delete(
  '/:id',
  authenticate,
  requireRole('admin', 'owner'),
  catCtrl.deleteCategory
);

export { catRouter as categoryRouter };
export default router;
