/**
 * requireRole.js — Role-based access control middleware factory.
 * Returns 403 if req.user.role is not in the allowed list.
 *
 * Requirements: 5.2, 5.3
 */

/**
 * @param {...string} roles - Allowed roles (e.g. 'admin', 'owner')
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        message: 'Token tidak valid atau sudah kedaluwarsa.',
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        ok: false,
        message: 'Akses ditolak.',
      });
    }
    next();
  };
}
