/**
 * cart.controller.js — Request handlers for cart endpoints.
 *
 * Requirements: 8.1–8.7
 */

import * as svc from '../services/cart.service.js';

export async function getCart(req, res, next) {
  try {
    const items = await svc.getCart(req.user.id);
    return res.json({ ok: true, data: items });
  } catch (err) {
    next(err);
  }
}

export async function addItem(req, res, next) {
  try {
    const { name, price, quantity } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(422).json({ ok: false, message: 'Nama produk wajib diisi.' });
    }
    if (price === undefined || price === null || Number(price) < 0) {
      return res.status(422).json({ ok: false, message: 'Harga harus berupa angka >= 0.' });
    }
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
      return res.status(422).json({ ok: false, message: 'Jumlah harus berupa bilangan bulat >= 1.' });
    }
    const item = await svc.addItem(req.user.id, req.body);
    return res.status(201).json({ ok: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function updateItemQty(req, res, next) {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity < 1) {
      return res.status(422).json({ ok: false, message: 'Jumlah harus minimal 1.' });
    }
    const item = await svc.updateItemQty(req.user.id, req.params.itemId, quantity);
    return res.json({ ok: true, data: item });
  } catch (err) {
    if (err.status === 403) {
      return res.status(403).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

export async function removeItem(req, res, next) {
  try {
    await svc.removeItem(req.user.id, req.params.itemId);
    return res.json({ ok: true, message: 'Item berhasil dihapus.' });
  } catch (err) {
    if (err.status === 403) {
      return res.status(403).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

export async function clearCart(req, res, next) {
  try {
    await svc.clearCart(req.user.id);
    return res.json({ ok: true, message: 'Keranjang berhasil dikosongkan.' });
  } catch (err) {
    next(err);
  }
}

export async function syncCart(req, res, next) {
  try {
    const items = await svc.syncCart(req.user.id, req.body.items || []);
    return res.json({ ok: true, data: items });
  } catch (err) {
    next(err);
  }
}
