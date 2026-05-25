/**
 * auth.js — JWT Bearer token verification middleware.
 * Attaches req.user = { id, role, name, email } on success.
 * Returns 401 on missing or invalid token.
 *
 * Requirements: 4.4, 4.5
 */

import { verifyAccessToken } from '../utils/jwt.js';

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
    next();
  } catch {
    return res.status(401).json({
      ok: false,
      message: 'Token tidak valid atau sudah kedaluwarsa.',
    });
  }
}
