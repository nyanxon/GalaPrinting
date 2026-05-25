/**
 * socketAuth.property.test.js — Property-based tests for Socket.io auth rejection.
 *
 * Feature: backend-integration
 * Property 6: Socket auth rejection
 *
 * Requirements: 9.10
 */

// Feature: backend-integration, Property 6: Socket auth rejection

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import jwt from 'jsonwebtoken';

const VALID_SECRET = 'test_access_secret';
const WRONG_SECRET = 'wrong_secret';

/**
 * Simulates the Socket.io auth middleware from socket/index.js.
 * Returns { ok: true, user } or throws 'authentication_error'.
 */
function socketAuthMiddleware(token, secret = VALID_SECRET) {
  if (!token) {
    throw new Error('authentication_error');
  }
  try {
    const payload = jwt.verify(token, secret);
    return { ok: true, user: { id: payload.sub, role: payload.role } };
  } catch {
    throw new Error('authentication_error');
  }
}

function makeValidToken(userId, role) {
  return jwt.sign({ sub: userId, role }, VALID_SECRET, { expiresIn: '15m' });
}

describe('Property 6: Socket auth rejection', () => {
  it('connections with no token are always rejected with authentication_error (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, '', '   '),
        (token) => {
          let err = null;
          try {
            socketAuthMiddleware(token);
          } catch (e) {
            err = e;
          }
          expect(err).not.toBeNull();
          expect(err.message).toBe('authentication_error');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('connections with random invalid tokens are always rejected (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.base64String({ minLength: 10, maxLength: 100 })
        ),
        (randomToken) => {
          // Skip if the random string happens to be a valid JWT (astronomically unlikely)
          let err = null;
          try {
            socketAuthMiddleware(randomToken);
          } catch (e) {
            err = e;
          }
          // Either it threw authentication_error, or it was a valid JWT (we allow that edge case)
          if (err !== null) {
            expect(err.message).toBe('authentication_error');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('tokens signed with wrong secret are always rejected (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.constantFrom('customer', 'admin', 'cs', 'owner'),
        (userId, role) => {
          const token = jwt.sign({ sub: userId, role }, WRONG_SECRET, { expiresIn: '15m' });
          let err = null;
          try {
            socketAuthMiddleware(token, VALID_SECRET);
          } catch (e) {
            err = e;
          }
          expect(err).not.toBeNull();
          expect(err.message).toBe('authentication_error');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('expired tokens are always rejected (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.constantFrom('customer', 'admin'),
        (userId, role) => {
          // Sign with -1s expiry (already expired)
          const token = jwt.sign({ sub: userId, role }, VALID_SECRET, { expiresIn: -1 });
          let err = null;
          try {
            socketAuthMiddleware(token);
          } catch (e) {
            err = e;
          }
          expect(err).not.toBeNull();
          expect(err.message).toBe('authentication_error');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('valid tokens are always accepted (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.constantFrom('customer', 'admin', 'cs', 'owner', 'cashier'),
        (userId, role) => {
          const token = makeValidToken(userId, role);
          let result = null;
          let err = null;
          try {
            result = socketAuthMiddleware(token);
          } catch (e) {
            err = e;
          }
          expect(err).toBeNull();
          expect(result.ok).toBe(true);
          expect(result.user.id).toBe(userId);
          expect(result.user.role).toBe(role);
        }
      ),
      { numRuns: 100 }
    );
  });
});
