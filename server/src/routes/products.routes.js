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

// Validasi atribut dinamis produk: array of { name: string, values: string[] }
const validateAttributes = body('attributes')
  .optional({ nullable: true })
  .custom((value) => {
    if (value === null || value === undefined || value === '') return true;
    let list = value;
    if (typeof value === 'string') {
      try { list = JSON.parse(value); } catch { throw new Error('Atribut harus berupa array JSON yang valid.'); }
    }
    if (!Array.isArray(list)) throw new Error('Atribut harus berupa array.');
    if (list.length > 30) throw new Error('Maksimal 30 atribut per produk.');
    for (const attr of list) {
      if (!attr || typeof attr !== 'object' || !String(attr.name ?? '').trim()) {
        throw new Error('Setiap atribut wajib memiliki nama.');
      }
      const values = Array.isArray(attr.values) ? attr.values : String(attr.values ?? '').split(',');
      if (values.filter((v) => String(v ?? '').trim()).length === 0) {
        throw new Error(`Atribut "${String(attr.name).trim()}" harus memiliki minimal 1 pilihan nilai.`);
      }
    }
    return true;
  });

// ── Upload ────────────────────────────────────────────────────────────────────
router.post('/upload-image', authenticate, requireRole('admin', 'owner'), uploadProduct.single('image'), ctrl.uploadProductImage);

// ── Products ──────────────────────────────────────────────────────────────────
router.get('/',    ctrl.listProducts);
router.get('/search', ctrl.searchProducts); // WAJIB sebelum /:id
router.post('/stock/batch-available', ctrl.batchCheckStockAvailable); // publik
router.get('/:id/stock/available', ctrl.checkProductStockAvailable); // publik
router.get('/:id/stock', authenticate, requireRole('admin', 'owner'), ctrl.listProductStock);
router.put('/:id/stock', authenticate, requireRole('admin', 'owner'), ctrl.updateProductStock);
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
    validateAttributes,
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
    validateAttributes,
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
