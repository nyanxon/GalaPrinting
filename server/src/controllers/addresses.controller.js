/**
 * addresses.controller.js — Request handlers for address management endpoints.
 *
 * Requirements: 5.1, 5.3, 5.8, 5.9, 5.11, 9.2, 9.3
 */

import * as svc from '../services/addresses.service.js';

export async function listAddresses(req, res, next) {
  try {
    const addresses = await svc.listAddresses(req.user.id);
    return res.json({ ok: true, data: addresses });
  } catch (err) {
    next(err);
  }
}

export async function createAddress(req, res, next) {
  try {
    const address = await svc.createAddress(req.user.id, req.body);
    return res.status(201).json({ ok: true, data: address });
  } catch (err) {
    if (err.status === 422) {
      return res.status(422).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

export async function updateAddress(req, res, next) {
  try {
    const address = await svc.updateAddress(req.user.id, req.params.id, req.body);
    return res.json({ ok: true, data: address });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ ok: false, message: err.message });
    }
    if (err.status === 403) {
      return res.status(403).json({ ok: false, message: err.message });
    }
    if (err.status === 422) {
      return res.status(422).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

export async function deleteAddress(req, res, next) {
  try {
    await svc.deleteAddress(req.user.id, req.params.id);
    return res.json({ ok: true, message: 'Alamat berhasil dihapus.' });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ ok: false, message: err.message });
    }
    if (err.status === 403) {
      return res.status(403).json({ ok: false, message: err.message });
    }
    next(err);
  }
}
