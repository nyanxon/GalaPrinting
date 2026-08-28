/**
 * optionalAuth.js — Attach req.user from the Bearer token IF one is present,
 * but never reject the request when the token is missing/invalid.
 *
 * Used by public-ish endpoints (e.g. POST /api/activity-log/batch) so that
 * clicks from not-yet-logged-in users can still be logged — attributed to a
 * 'customer' actor with NULL actor_id/name — while logged-in users get their
 * identity resolved from the JWT.
 */

import { verifyAccessToken } from '../utils/jwt.js';

export function optionalAuth(req, _res, next) {
  const authHeader = req.headers['authorization'];
  // sendBeacon (used on page-close flush) cannot set custom headers, so the
  // access token can optionally arrive as a query param (?access_token=...).
  const queryToken = typeof req.query?.access_token === 'string' ? req.query.access_token : null;
  const rawToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : queryToken;

  if (rawToken) {
    try {
      const payload = verifyAccessToken(rawToken);
      req.user = {
        id: payload.sub,
        role: payload.role,
        name: payload.name,
        email: payload.email,
      };
    } catch {
      // Invalid/expired token — treat as anonymous; do NOT fail the request.
    }
  }
  next();
}
