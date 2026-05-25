/**
 * products.controller.js — Request handlers for product and category endpoints.
 *
 * Requirements: 6.1–6.9
 */

import { validationResult } from 'express-validator';
import * as svc from '../services/products.service.js';
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
    return res.status(400).json({ ok: false, message: 'File gambar wajib diunggah.' });
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
    const { page, limit, category, search } = req.query;
    const result = await svc.listProducts({ page, limit, category, search });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req, res, next) {
  try {
    const product = await svc.getProductById(req.params.id);
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

    const { variantPrices } = body;

    const product = await svc.createProduct({
      name:             body.name,
      categoryId:       body.categoryId || null,
      price:            body.price,
      shortDescription: body.shortDescription,
      requiresDesign:   body.requiresDesign,
      colors:           body.colors,
      sizes:            body.sizes,
      materials:        body.materials,
      imagePath:        body.image || body.imagePath || null,
      variantPrices,
    });
    return res.status(201).json({ ok: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req, res, next) {
  try {
    // Resolve category name → category_id if frontend sends { category: "Stiker" }
    const body = { ...req.body };
    if (body.category && !body.categoryId) {
      const categoryId = await svc.resolveCategoryId(body.category);
      body.category_id = categoryId;
    }

    const { variantPrices } = body;
    const product = await svc.updateProduct(req.params.id, { ...body, variantPrices });
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

export async function deleteCategory(req, res, next) {
  try {
    await svc.deleteCategory(req.params.id);
    return res.json({ ok: true, message: 'Kategori berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
}
