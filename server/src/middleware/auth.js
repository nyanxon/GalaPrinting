/**
 * auth.js — JWT Bearer token verification middleware.
 * Attaches req.user = { id, role, name, email } on success.
 * Returns 401 on missing or invalid token.
 *
 * For staff accounts with must_change_password = true, all protected
 * routes are blocked (403) except:
 *   - GET  /api/auth/me
 *   - POST /api/auth/change-password
 *
 * Requirements: 4.4, 4.5
 */

import { verifyAccessToken } from '../utils/jwt.js';
import { query } from '../db/connection.js';
import { STAFF_ROLES } from '../config/roles.js';

const MUST_CHANGE_PASSWORD_EXCEPTIONS = [
  '/api/auth/me',
  '/api/auth/change-password',
];

export function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      ok: false,
      message: 'Token tidak valid atau sudah kedaluwarsa.',
    });
  }

  const token = authHeader.slice(7); // strip "Bearer "
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id:    payload.sub,
      role:  payload.role,
      name:  payload.name,
      email: payload.email,
    };
  } catch {
    return res.status(401).json({
      ok: false,
      message: 'Token tidak valid atau sudah kedaluwarsa.',
    });
  }

  // ── must_change_password enforcement (staff only) ──────────────────────────
  // Customers never have this column, so skip the check for non-staff roles.
  // The extra DB query is indexed on PK and only fires for staff tokens.
  if (!STAFF_ROLES.includes(req.user.role)) {
    return next();
  }

  const originalUrl = req.originalUrl.split('?')[0];
  if (MUST_CHANGE_PASSWORD_EXCEPTIONS.includes(originalUrl)) {
    return next();
  }

  query(
    'SELECT must_change_password FROM users_admin WHERE id = ? AND deleted_at IS NULL',
    [req.user.id]
  )
    .then(([rows]) => {
      if (rows.length === 0 || rows[0].must_change_password === 0) {
        return next();
      }
      return res.status(403).json({
        ok: false,
        message: 'Anda harus mengubah password terlebih dahulu.',
        mustChangePassword: true,
      });
    })
    .catch(() => {
      // If the query fails, don't block the request — let the route
      // handler deal with it. This is a safety net, not a hard gate.
      next();
    });
}
