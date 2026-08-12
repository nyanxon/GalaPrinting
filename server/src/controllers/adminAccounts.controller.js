/**
 * adminAccounts.controller.js — Request handlers untuk permission dinamis.
 *
 * Semua endpoint dilindungi requireRole('owner') di level route.
 */

import * as svc from '../services/adminAccounts.service.js';

/**
 * GET /api/admin-accounts
 */
export async function listAdminAccounts(req, res, next) {
  try {
    const items = await svc.listAdminAccounts({ q: req.query.q });
    return res.json({ ok: true, items });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin-accounts/:userId/promote
 */
export async function promoteAccount(req, res, next) {
  try {
    const user = await svc.promoteAccount(req.params.userId);
    if (!user) {
      return res.status(404).json({ ok: false, message: 'Akun tidak ditemukan.' });
    }
    return res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin-accounts/:userId/revoke
 */
export async function revokeAccount(req, res, next) {
  try {
    const user = await svc.revokeAccount(req.params.userId);
    if (!user) {
      return res.status(404).json({ ok: false, message: 'Akun tidak ditemukan.' });
    }
    return res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/features
 */
export async function listFeatures(_req, res, next) {
  try {
    const categories = svc.listFeatures();
    return res.json({ ok: true, categories });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin-accounts/:userId/permissions
 */
export async function getAccountPermissions(req, res, next) {
  try {
    const { user, permissions } = await svc.getAccountPermissions(req.params.userId);
    if (!user) {
      return res.status(404).json({ ok: false, message: 'Akun tidak ditemukan.' });
    }
    return res.json({ ok: true, user, permissions });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/admin-accounts/:userId/permissions
 * Body: { permissions: [{ feature_key, granted }] }
 */
export async function updateAccountPermissions(req, res, next) {
  try {
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(422).json({ ok: false, message: 'Permissions harus berupa array.' });
    }

    for (const item of permissions) {
      if (!item || typeof item.feature_key !== 'string' || typeof item.granted !== 'boolean') {
        return res.status(422).json({
          ok: false,
          message: 'Setiap permission harus berisi feature_key (string) dan granted (boolean).',
        });
      }
      if (!svc.isValidFeatureKey(item.feature_key)) {
        return res.status(422).json({
          ok: false,
          message: `Feature key tidak dikenali: ${item.feature_key}`,
        });
      }
    }

    await svc.updateAccountPermissions(req.params.userId, permissions);

    const { user, permissions: updated } = await svc.getAccountPermissions(req.params.userId);
    if (!user) {
      return res.status(404).json({ ok: false, message: 'Akun tidak ditemukan.' });
    }
    return res.json({ ok: true, user, permissions: updated });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ ok: false, message: err.message });
    }
    next(err);
  }
}
