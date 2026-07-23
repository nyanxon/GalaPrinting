/**
 * requirePermission.js — Granular permission-checking middleware factory.
 *
 * Must be used AFTER the authenticate middleware (which sets req.user).
 * Queries the user_permissions table to verify the user has the
 * required permission key.
 *
 * Owner role bypasses all permission checks (full access).
 *
 * Usage:
 *   router.get('/reports', authenticate, requirePermission('reports'), handler);
 */

import { query } from '../db/connection.js';

/**
 * @param {string} permissionKey — the permission key to check
 * @returns {import('express').RequestHandler}
 */
export function requirePermission(permissionKey) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        message: 'Token tidak valid atau sudah kedaluwarsa.',
      });
    }

    // Owner bypasses all permission checks
    if (req.user.role === 'owner') return next();

    try {
      const [rows] = await query(
        'SELECT 1 FROM user_permissions WHERE user_id = ? AND permission_key = ? LIMIT 1',
        [req.user.id, permissionKey]
      );

      if (rows.length === 0) {
        return res.status(403).json({
          ok: false,
          message: 'Akses ditolak. Anda tidak memiliki izin ini.',
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
