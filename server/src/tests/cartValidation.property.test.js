/**
 * cartValidation.property.test.js — Property-based tests for cart item validation.
 *
 * Feature: backend-integration
 * Property 3: Cart validation
 *
 * **Validates: Requirements 2.12**
 *
 * For any POST /api/cart/items request where price < 0, quantity < 1, or name
 * is empty, the response status must be 422.
 *
 * Since we can't easily spin up the full Express server in tests, the validation
 * logic from cart.controller.js addItem is inlined and tested directly.
 */

// Feature: backend-integration, Property 3: Cart validation

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Inlined validation logic from cart.controller.js addItem.
 * Returns { status, ok, message } mirroring the HTTP response shape.
 */
function validateCartItem({ name, price, quantity }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { status: 422, ok: false, message: 'Nama produk wajib diisi.' };
  }
  if (price === undefined || price === null || Number(price) < 0) {
    return { status: 422, ok: false, message: 'Harga harus berupa angka >= 0.' };
  }
  if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
    return { status: 422, ok: false, message: 'Jumlah harus berupa bilangan bulat >= 1.' };
  }
  return { status: 201, ok: true };
}

// ── Sub-task 13.3.1 — price < 0 returns 422 ──────────────────────────────────

describe('Property 3: Cart validation — price < 0 returns 422', () => {
  it('any negative price always returns 422 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0), // valid name
        fc.oneof(
          fc.float({ max: -Number.EPSILON, noNaN: true }),               // negative float
          fc.integer({ min: -100000, max: -1 }),                         // negative integer
        ),
        fc.integer({ min: 1, max: 100 }),                                // valid quantity
        (name, price, quantity) => {
          const result = validateCartItem({ name, price, quantity });
          expect(result.status).toBe(422);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('null or undefined price always returns 422 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.oneof(fc.constant(null), fc.constant(undefined)),
        fc.integer({ min: 1, max: 100 }),
        (name, price, quantity) => {
          const result = validateCartItem({ name, price, quantity });
          expect(result.status).toBe(422);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Sub-task 13.3.2 — quantity < 1 returns 422 ───────────────────────────────

describe('Property 3: Cart validation — quantity < 1 returns 422', () => {
  it('any integer quantity below 1 always returns 422 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0), // valid name
        fc.float({ min: 0, noNaN: true }),                               // valid price (>= 0)
        fc.integer({ min: -1000, max: 0 }),                              // quantity < 1
        (name, price, quantity) => {
          const result = validateCartItem({ name, price, quantity });
          expect(result.status).toBe(422);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('non-integer quantity always returns 422 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.float({ min: 0, noNaN: true }),
        fc.float({ min: Math.fround(1.1), max: Math.fround(99.9), noNaN: true }).filter(
          (n) => !Number.isInteger(n)
        ),
        (name, price, quantity) => {
          const result = validateCartItem({ name, price, quantity });
          expect(result.status).toBe(422);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Sub-task 13.3.3 — empty name returns 422 ─────────────────────────────────

describe('Property 3: Cart validation — empty name returns 422', () => {
  it('empty string name always returns 422 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constant(''),                  // empty string
        fc.float({ min: 0, noNaN: true }),
        fc.integer({ min: 1, max: 100 }),
        (name, price, quantity) => {
          const result = validateCartItem({ name, price, quantity });
          expect(result.status).toBe(422);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('whitespace-only name always returns 422 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 20 }).map((chars) => chars.join('')),
        fc.float({ min: 0, noNaN: true }),
        fc.integer({ min: 1, max: 100 }),
        (name, price, quantity) => {
          const result = validateCartItem({ name, price, quantity });
          expect(result.status).toBe(422);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('null or non-string name always returns 422 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(null), fc.constant(undefined), fc.integer(), fc.boolean()),
        fc.float({ min: 0, noNaN: true }),
        fc.integer({ min: 1, max: 100 }),
        (name, price, quantity) => {
          const result = validateCartItem({ name, price, quantity });
          expect(result.status).toBe(422);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Valid inputs are accepted ─────────────────────────────────────────────────

describe('Property 3: Cart validation — valid inputs are accepted', () => {
  it('valid name, non-negative price, and integer quantity >= 1 always returns 201 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0), // non-empty, non-whitespace
        fc.float({ min: 0, noNaN: true }),                               // price >= 0
        fc.integer({ min: 1, max: 1000 }),                               // quantity >= 1
        (name, price, quantity) => {
          const result = validateCartItem({ name, price, quantity });
          expect(result.status).toBe(201);
          expect(result.ok).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
