/**
 * accounts.controller.js — Request handlers for Account management endpoints.
 *
 * All endpoints require owner role.
 */

import * as svc from '../services/accounts.service.js';

const VALID_ROLES = ['customer', 'admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'];

const VALID_PERMISSION_KEYS = [
  'dashboard', 'orders', 'products', 'categories', 'reviews', 'chats', 'dm',
  'promo', 'homepage', 'accounts', 'revenue', 'reports', 'analytics',
  'invoices', 'customers', 'custom_order', 'order_offline', 'daily_recap',
  'new_order', 'order_list',
];

/**
 * GET /api/admin/accounts
 */
export async function listAccounts(req, res, next) {
  try {
    const result = await svc.listAccounts({
      page:  req.query.page,
      limit: req.query.limit,
      q:     req.query.q,
      role:  req.query.role,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/accounts/:id
 */
export async function getAccount(req, res, next) {
  try {
    const data = await svc.getAccount(req.params.id);
    if (!data) {
      return res.status(404).json({ ok: false, message: 'Akun tidak ditemukan.' });
    }
    return res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/admin/accounts/:id
 */
export async function updateAccount(req, res, next) {
  try {
    const { role, permissions } = req.body;

    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(422).json({ ok: false, message: 'Role tidak valid.' });
    }
    if (permissions !== undefined && !Array.isArray(permissions)) {
      return res.status(422).json({ ok: false, message: 'Permissions harus berupa array.' });
    }
    if (permissions && permissions.some((k) => !VALID_PERMISSION_KEYS.includes(k))) {
      return res.status(422).json({ ok: false, message: 'Permission key tidak valid.' });
    }

    const data = await svc.updateAccount(
      req.params.id,
      { role, permissions: permissions || [] },
      req.user.id
    );

    if (!data) {
      return res.status(404).json({ ok: false, message: 'Akun tidak ditemukan.' });
    }
    return res.json({ ok: true, data });
  } catch (err) {
    if (err.status === 403) {
      return res.status(403).json({ ok: false, message: err.message });
    }
    next(err);
  }
}
