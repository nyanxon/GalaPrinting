/**
 * users.controller.js — Request handlers for user management endpoints.
 *
 * Requirements: 13.1–13.7
 */

import { validationResult } from 'express-validator';
import * as svc from '../services/users.service.js';

export async function listCustomers(req, res, next) {
  try {
    const result = await svc.listCustomers({ page: req.query.page, limit: req.query.limit, q: req.query.q });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function listStaff(req, res, next) {
  try {
    const staff = await svc.listStaff({ q: req.query.q, excludeUserId: req.user.id });
    return res.json({ ok: true, data: staff });
  } catch (err) {
    next(err);
  }
}

export async function createStaff(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ ok: false, message: 'Validasi gagal.', errors: errors.mapped() });
    }
    const user = await svc.createStaff(req.body);
    return res.status(201).json({ ok: true, data: user });
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

export async function updateRole(req, res, next) {
  try {
    const user = await svc.updateUserRole(req.params.id, req.body.role, req.user.id);
    if (!user) {
      return res.status(404).json({ ok: false, message: 'User tidak ditemukan.' });
    }
    return res.json({ ok: true, data: user });
  } catch (err) {
    if (err.status === 403) {
      return res.status(403).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

export async function deleteUser(req, res, next) {
  try {
    await svc.softDeleteUser(req.params.id);
    return res.json({ ok: true, message: 'User berhasil dinonaktifkan.' });
  } catch (err) {
    next(err);
  }
}
