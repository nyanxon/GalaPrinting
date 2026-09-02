/**
 * products.controller.js — Request handlers for product and category endpoints.
 *
 * Requirements: 6.1–6.9
 */

import { validationResult } from 'express-validator';
import * as svc from '../services/products.service.js';
import * as stockSvc from '../services/stock.service.js';
import { StorageService } from '../utils/storage.js';

// ── Upload ────────────────────────────────────────────────────────────────────

/**
 * POST /api/upload/product
 * Accepts a single product image file, persists it via StorageService, and
 * returns the permanent server URL.
 *
 * Requirements: 1.1, 1.2, 1.7
 */
export async function uploadProductImage(req, res, next) {
  if (!req.file) {
    return res.status(422).json({ ok: false, message: 'File gambar wajib diunggah.' });
  }
  try {
    const saved = await StorageService.save(req.file, 'products');
    return res.json({ ok: true, url: saved.url });
  } catch (err) {
    next(err);
  }
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function listProducts(req, res, next) {
  try {
    const { page, limit, category, search, visible } = req.query;
    const result = await svc.listProducts({ page, limit, category, search, visible });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req, res, next) {
  try {
    const product = await svc.getProductById(req.params.id, { visible: req.query.visible });
    if (!product) {
      return res.status(404).json({ ok: false, message: 'Produk tidak ditemukan.' });
    }
    return res.json({ ok: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ ok: false, message: 'Validasi gagal.', errors: errors.mapped() });
    }

    // Resolve category name → category_id if frontend sends { category: "Stiker" }
    const body = { ...req.body };
    if (body.category && !body.categoryId) {
      const categoryId = await svc.resolveCategoryId(body.category);
      body.categoryId = categoryId;
    }

    const product = await svc.createProduct({
      name:             body.name,
      categoryId:       body.categoryId || null,
      price:            body.price,
      priceCustomer:    body.priceCustomer ?? body.price_customer,
      priceBroker:      body.priceBroker ?? body.price_broker,
      shortDescription: body.shortDescription,
      requiresDesign:   body.requiresDesign,
      imagePath:        body.image || body.imagePath || null,
      sizeType:         body.sizeType ?? body.size_type ?? 'none',
      isHiddenFromCustomer: body.isHiddenFromCustomer ?? body.is_hidden_from_customer ?? false,
      attributes:       body.attributes ?? null,
    });
    return res.status(201).json({ ok: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function searchProducts(req, res, next) {
  try {
    const { q, limit } = req.query;
    const items = await svc.searchProducts(q, limit);
    return res.json({ ok: true, items });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ ok: false, message: 'Validasi gagal.', errors: errors.mapped() });
    }

    // Resolve category name → category_id if frontend sends { category: "Stiker" }
    const body = { ...req.body };
    if (body.category && !body.categoryId) {
      const categoryId = await svc.resolveCategoryId(body.category);
      body.category_id = categoryId;
    }
    // Remove the raw category name — the DB column is category_id only
    delete body.category;

    const product = await svc.updateProduct(req.params.id, body);
    if (!product) {
      return res.status(404).json({ ok: false, message: 'Produk tidak ditemukan.' });
    }
    return res.json({ ok: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    await svc.deleteProduct(req.params.id);
    return res.json({ ok: true, message: 'Produk berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
}

// ── Product stock ─────────────────────────────────────────────────────────────

/** GET /api/products/:id/stock — daftar stok per kombinasi (admin). */
export async function listProductStock(req, res, next) {
  try {
    const product = await svc.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ ok: false, message: 'Produk tidak ditemukan.' });
    }
    const items = await stockSvc.listProductStock(req.params.id);
    return res.json({ ok: true, data: items });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/products/:id/stock — set stok satu atau banyak kombinasi.
 * Body: { stocks: [{ combination: {name,value}[], stock: number }] }
 *       atau { combination, stock } (satu kombinasi).
 * stock harus bilangan bulat >= 0.
 */
export async function updateProductStock(req, res, next) {
  try {
    const product = await svc.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ ok: false, message: 'Produk tidak ditemukan.' });
    }

    let stocks;
    if (Array.isArray(req.body?.stocks)) {
      stocks = req.body.stocks;
    } else if (req.body && 'combination' in req.body) {
      stocks = [req.body];
    } else {
      return res.status(422).json({ ok: false, message: 'Badan request harus berisi { stocks } atau { combination, stock }.' });
    }

    for (const entry of stocks) {
      const qty = Number(entry?.stock);
      if (!Number.isInteger(qty) || qty < 0) {
        return res.status(422).json({ ok: false, message: 'Nilai stok harus berupa bilangan bulat >= 0.' });
      }
      await stockSvc.setProductStock(req.params.id, entry.combination, qty);
    }

    const data = await stockSvc.listProductStock(req.params.id);
    return res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/products/:id/stock/available?combination=<JSON>
 * Cek stok real-time satu kombinasi di detail produk (publik).
 * combination default '[]' jika tidak dikirim.
 */
export async function checkProductStockAvailable(req, res, next) {
  try {
    const product = await svc.getProductById(req.params.id, { visible: req.query.visible });
    if (!product) {
      return res.status(404).json({ ok: false, message: 'Produk tidak ditemukan.' });
    }

    let combination = [];
    if (req.query.combination) {
      try {
        combination = JSON.parse(req.query.combination);
      } catch {
        return res.status(422).json({ ok: false, message: 'Parameter combination harus berupa JSON array yang valid.' });
      }
    }

    const stock = await stockSvc.getStock(req.params.id, combination);
    const canonical = stockSvc.canonicalCombination(combination);
    return res.json({ ok: true, data: { productId: req.params.id, combination: canonical, stock, available: stock > 0 } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/products/stock/batch-available — cek stok banyak kombinasi
 * (validasi checkout/cart).
 * Body: { items: [{ key: string, productId: string, combination: array }] }
 * Response data mengembalikan key yang sama per item, stock 0 untuk yang
 * belum punya baris stok (fail-safe).
 */
export async function batchCheckStockAvailable(req, res, next) {
  try {
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const stocks = await stockSvc.batchGetStocks(
      rawItems.map((it) => ({ productId: it?.productId, combination: it?.combination }))
    );
    const data = rawItems.map((it) => {
      const key = it?.key ?? null;
      const canonical = stockSvc.canonicalCombination(it?.combination);
      const stock = it?.productId
        ? stocks.get(`${it.productId}:${stockSvc.hashCombination(canonical)}`) ?? 0
        : 0;
      return { key, productId: it?.productId ?? null, combination: canonical, stock };
    });
    return res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function listCategories(req, res, next) {
  try {
    const categories = await svc.listCategories();
    return res.json({ ok: true, data: categories });
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ ok: false, message: 'Validasi gagal.', errors: errors.mapped() });
    }
    const category = await svc.createCategory(req.body.name);
    return res.status(201).json({ ok: true, data: category });
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ ok: false, message: 'Validasi gagal.', errors: errors.mapped() });
    }
    const category = await svc.updateCategory(req.params.id, req.body.name);
    if (!category) {
      return res.status(404).json({ ok: false, message: 'Kategori tidak ditemukan.' });
    }
    return res.json({ ok: true, data: category });
  } catch (err) {
    next(err);
  }
}

export async function deleteCategory(req, res, next) {
  try {
    await svc.deleteCategory(req.params.id);
    return res.json({ ok: true, message: 'Kategori berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
}
