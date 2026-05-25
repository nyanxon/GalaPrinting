/**
 * auth.property.test.js — Property-based tests for auth service.
 *
 * Feature: backend-integration
 * Property 1: Token family invalidation
 *
 * Requirements: 4.10
 */

// Feature: backend-integration, Property 1: Token family invalidation

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import crypto from 'crypto';

// ── Inline minimal implementation for property testing ────────────────────────
// We test the token-family-invalidation logic in isolation without a real DB.

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * In-memory refresh token store that mirrors the DB logic in auth.service.js.
 */
function createTokenStore() {
  const tokens = new Map(); // tokenHash → { id, userId, family, usedAt }

  return {
    insert(id, userId, tokenHash, family) {
      tokens.set(tokenHash, { id, userId, family, usedAt: null });
    },
    findByHash(tokenHash) {
      return tokens.get(tokenHash) || null;
    },
    markUsed(tokenHash) {
      const t = tokens.get(tokenHash);
      if (t) t.usedAt = new Date();
    },
    deleteFamily(family) {
      for (const [hash, t] of tokens.entries()) {
        if (t.family === family) tokens.delete(hash);
      }
    },
    countByFamily(family) {
      let count = 0;
      for (const t of tokens.values()) {
        if (t.family === family) count++;
      }
      return count;
    },
  };
}

/**
 * Simulates rotateRefreshToken logic from auth.service.js.
 * Returns { ok: true, newToken } or throws with status 401.
 */
function rotateToken(store, rawToken) {
  const tokenHash = sha256(rawToken);
  const stored = store.findByHash(tokenHash);

  if (!stored) {
    const err = new Error('Token tidak valid.');
    err.status = 401;
    throw err;
  }

  if (stored.usedAt !== null) {
    // Token reuse — invalidate entire family
    store.deleteFamily(stored.family);
    const err = new Error('Token tidak valid.');
    err.status = 401;
    throw err;
  }

  store.markUsed(tokenHash);

  // Issue new token in same family
  const newToken = crypto.randomUUID();
  const newHash  = sha256(newToken);
  store.insert(crypto.randomUUID(), stored.userId, newHash, stored.family);

  return { ok: true, newToken };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Property 1: Token family invalidation', () => {
  it('using a refresh token twice invalidates the entire family (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),   // userId
        fc.uuid(),   // family
        (userId, family) => {
          const store = createTokenStore();

          // Issue initial token
          const initialToken = crypto.randomUUID();
          const initialHash  = sha256(initialToken);
          store.insert(crypto.randomUUID(), userId, initialHash, family);

          // First use — should succeed and issue a new token
          const { newToken } = rotateToken(store, initialToken);

          // Second use of the ORIGINAL token — should throw 401 and delete family
          let secondUseError = null;
          try {
            rotateToken(store, initialToken);
          } catch (err) {
            secondUseError = err;
          }

          // Assert: second use threw 401
          expect(secondUseError).not.toBeNull();
          expect(secondUseError.status).toBe(401);

          // Assert: entire family is deleted (no tokens remain for this family)
          expect(store.countByFamily(family)).toBe(0);

          // Assert: the new token issued after first rotation is also gone
          const newHash = sha256(newToken);
          expect(store.findByHash(newHash)).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('using a valid token once succeeds and the old token cannot be reused', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (userId, family) => {
          const store = createTokenStore();
          const token = crypto.randomUUID();
          store.insert(crypto.randomUUID(), userId, sha256(token), family);

          // First use succeeds
          const result = rotateToken(store, token);
          expect(result.ok).toBe(true);

          // Original token is now marked used — reuse should fail
          let err = null;
          try {
            rotateToken(store, token);
          } catch (e) {
            err = e;
          }
          expect(err).not.toBeNull();
          expect(err.status).toBe(401);
        }
      ),
      { numRuns: 100 }
    );
  });
});
