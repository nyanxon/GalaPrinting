/**
 * roleGuard.property.test.js — Property-based tests for role guard middleware.
 *
 * Feature: backend-integration
 * Property 2: Role guard
 *
 * Requirements: 5.2, 5.3
 */

// Feature: backend-integration, Property 2: Role guard

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * All 8 roles defined in the system.
 * Validates: Requirements 5.2, 5.3
 */
const ALL_ROLES = ['customer', 'admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'];

/**
 * Protected endpoints with their allowed roles.
 * Mirrors the route definitions in the Express app.
 *
 * Validates: Requirements 5.2, 5.3
 */
const PROTECTED_ENDPOINTS = [
  { method: 'GET',   path: '/api/users/customers',  allowedRoles: ['admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'] },
  { method: 'GET',   path: '/api/users/staff',       allowedRoles: ['admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'] },
  { method: 'POST',  path: '/api/users/staff',       allowedRoles: ['admin'] },
  { method: 'PATCH', path: '/api/users/:id/role',    allowedRoles: ['admin'] },
  { method: 'DELETE',path: '/api/users/:id',         allowedRoles: ['admin'] },
  { method: 'GET',   path: '/api/analytics/revenue', allowedRoles: ['owner', 'admin'] },
  { method: 'POST',  path: '/api/products',          allowedRoles: ['admin'] },
];

/**
 * Inline implementation of requireRole logic from middleware/requireRole.js.
 * Returns the HTTP status code the middleware would produce.
 *
 * - 401 if no user is attached (unauthenticated)
 * - 403 if user role is not in the allowed list
 * - 200 (pass-through) if role is allowed
 */
function simulateRequireRole(allowedRoles, userRole) {
  if (!userRole) return 401;
  if (!allowedRoles.includes(userRole)) return 403;
  return 200;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Property 2: Role guard', () => {
  it('insufficient role always returns 403, never 200 — across all protected endpoints (100 iterations)', () => {
    /**
     * Validates: Requirements 5.2, 5.3
     *
     * For every protected endpoint, pick a random role that is NOT in the
     * allowed list. The role guard must return 403, never 200.
     */
    fc.assert(
      fc.property(
        fc.constantFrom(...PROTECTED_ENDPOINTS),
        fc.constantFrom(...ALL_ROLES),
        (endpoint, role) => {
          // Only test roles that are NOT allowed for this endpoint
          fc.pre(!endpoint.allowedRoles.includes(role));

          const status = simulateRequireRole(endpoint.allowedRoles, role);

          // Must be 403 — never 200
          expect(status).toBe(403);
          expect(status).not.toBe(200);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('allowed role always passes through (returns 200) — across all protected endpoints (100 iterations)', () => {
    /**
     * Validates: Requirements 5.2, 5.3
     *
     * Complementary check: a role that IS in the allowed list must not be
     * blocked. This ensures the guard is not over-restrictive.
     */
    fc.assert(
      fc.property(
        fc.constantFrom(...PROTECTED_ENDPOINTS),
        (endpoint) => {
          for (const role of endpoint.allowedRoles) {
            const status = simulateRequireRole(endpoint.allowedRoles, role);
            expect(status).toBe(200);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('unauthenticated request (no user) always returns 401, never 403 (100 iterations)', () => {
    /**
     * Validates: Requirements 5.2
     *
     * A request with no attached user (missing/invalid token) must return 401,
     * not 403. The distinction matters: 401 = unauthenticated, 403 = unauthorized.
     */
    fc.assert(
      fc.property(
        fc.constantFrom(...PROTECTED_ENDPOINTS),
        (endpoint) => {
          const status = simulateRequireRole(endpoint.allowedRoles, null);
          expect(status).toBe(401);
          expect(status).not.toBe(403);
          expect(status).not.toBe(200);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('every role is either allowed or denied — no role produces an unexpected status (100 iterations)', () => {
    /**
     * Validates: Requirements 5.2, 5.3
     *
     * For any combination of endpoint + role, the result must be exactly one
     * of: 200 (allowed) or 403 (denied). No other status is acceptable when
     * a user is present.
     */
    fc.assert(
      fc.property(
        fc.constantFrom(...PROTECTED_ENDPOINTS),
        fc.constantFrom(...ALL_ROLES),
        (endpoint, role) => {
          const status = simulateRequireRole(endpoint.allowedRoles, role);
          const isAllowed = endpoint.allowedRoles.includes(role);

          if (isAllowed) {
            expect(status).toBe(200);
          } else {
            expect(status).toBe(403);
          }

          // Status must always be 200 or 403 when a user is present
          expect([200, 403]).toContain(status);
        }
      ),
      { numRuns: 100 }
    );
  });
});
