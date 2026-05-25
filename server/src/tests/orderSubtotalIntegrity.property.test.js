/**
 * orderSubtotalIntegrity.property.test.js — Property-based tests for order subtotal validation.
 *
 * Feature: backend-integration
 * Property 4: Order subtotal integrity
 *
 * **Validates: Requirements 2.13**
 *
 * For any POST /api/orders request where `subtotal` differs from
 * `sum(item.price * item.quantity)` by more than 1, the response status must be 422.
 *
 * Since we can't easily spin up the full Express server in tests, the validation
 * logic from orders.controller.js createOrder is inlined and tested directly.
 */

// Feature: backend-integration, Property 4: Order subtotal integrity

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Inlined validation logic from orders.controller.js createOrder.
 * Returns { status, ok, message } mirroring the HTTP response shape.
 */
function validateOrderSubtotal({ items, subtotal }) {
  if (!Array.isArray(items) || items.length === 0) {
    return { status: 422, ok: false, message: 'Pesanan harus memiliki minimal 1 item.' };
  }

  const computed = items.reduce(
    (sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 1),
    0
  );

  if (Math.abs(computed - Number(subtotal || 0)) > 1) {
    return { status: 422, ok: false, message: 'Subtotal tidak sesuai dengan total item.' };
  }

  return { status: 201, ok: true };
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Generates a valid items array and its exact computed subtotal.
 * Each item has a non-negative integer price and a positive integer quantity.
 */
const validItemsWithSubtotal = fc
  .array(
    fc.record({
      price:    fc.integer({ min: 0, max: 1_000_000 }),
      quantity: fc.integer({ min: 1, max: 100 }),
    }),
    { minLength: 1, maxLength: 10 }
  )
  .map((items) => {
    const computed = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    return { items, computed };
  });

// ── Sub-task 13.4.1 — mismatched subtotal returns 422 ────────────────────────

describe('Property 4: Order subtotal integrity — mismatched subtotal returns 422', () => {
  it('subtotal differing by more than 1 always returns 422 (100 iterations)', () => {
    fc.assert(
      fc.property(
        validItemsWithSubtotal,
        // Generate a delta strictly greater than 1 (positive or negative)
        fc.oneof(
          fc.float({ min: Math.fround(1.01), max: Math.fround(1_000_000), noNaN: true }),   // positive excess
          fc.float({ min: Math.fround(-1_000_000), max: Math.fround(-1.01), noNaN: true }), // negative excess
        ),
        ({ items, computed }, delta) => {
          const subtotal = computed + delta;
          const result = validateOrderSubtotal({ items, subtotal });
          expect(result.status).toBe(422);
          expect(result.ok).toBe(false);
          expect(result.message).toBe('Subtotal tidak sesuai dengan total item.');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('subtotal that is wildly off always returns 422 (100 iterations)', () => {
    fc.assert(
      fc.property(
        validItemsWithSubtotal,
        fc.integer({ min: 2, max: 10_000_000 }),
        ({ items, computed }, excess) => {
          // Subtotal is computed + excess where excess > 1
          const subtotal = computed + excess;
          const result = validateOrderSubtotal({ items, subtotal });
          expect(result.status).toBe(422);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Sub-task 13.4.2 — tolerance of 1 unit is accepted ────────────────────────

describe('Property 4: Order subtotal integrity — tolerance of 1 unit is accepted', () => {
  it('subtotal within 1 unit of computed total always returns 201 (100 iterations)', () => {
    fc.assert(
      fc.property(
        validItemsWithSubtotal,
        // Delta in the range [-1, 1] (inclusive)
        fc.float({ min: -1, max: 1, noNaN: true }),
        ({ items, computed }, delta) => {
          const subtotal = computed + delta;
          const result = validateOrderSubtotal({ items, subtotal });
          expect(result.status).toBe(201);
          expect(result.ok).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('exact computed subtotal always returns 201 (100 iterations)', () => {
    fc.assert(
      fc.property(
        validItemsWithSubtotal,
        ({ items, computed }) => {
          const result = validateOrderSubtotal({ items, subtotal: computed });
          expect(result.status).toBe(201);
          expect(result.ok).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary: difference of exactly 1 is accepted', () => {
    // items: 1 item with price=100, quantity=1 → computed=100
    const items = [{ price: 100, quantity: 1 }];

    // subtotal = 101 → diff = 1 → accepted
    expect(validateOrderSubtotal({ items, subtotal: 101 }).status).toBe(201);
    // subtotal = 99  → diff = 1 → accepted
    expect(validateOrderSubtotal({ items, subtotal: 99 }).status).toBe(201);
  });

  it('boundary: difference of 1.01 is rejected', () => {
    // items: 1 item with price=100, quantity=1 → computed=100
    const items = [{ price: 100, quantity: 1 }];

    // subtotal = 101.01 → diff = 1.01 → rejected
    expect(validateOrderSubtotal({ items, subtotal: 101.01 }).status).toBe(422);
    // subtotal = 98.99  → diff = 1.01 → rejected
    expect(validateOrderSubtotal({ items, subtotal: 98.99 }).status).toBe(422);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('Property 4: Order subtotal integrity — edge cases', () => {
  it('empty items array always returns 422 regardless of subtotal', () => {
    fc.assert(
      fc.property(
        fc.float({ noNaN: true }),
        (subtotal) => {
          const result = validateOrderSubtotal({ items: [], subtotal });
          expect(result.status).toBe(422);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('null or undefined subtotal treated as 0 — only accepted when computed is within 1', () => {
    // Single item price=0, quantity=1 → computed=0; subtotal=null → diff=0 → accepted
    const zeroItems = [{ price: 0, quantity: 1 }];
    expect(validateOrderSubtotal({ items: zeroItems, subtotal: null }).status).toBe(201);
    expect(validateOrderSubtotal({ items: zeroItems, subtotal: undefined }).status).toBe(201);

    // Single item price=100, quantity=1 → computed=100; subtotal=null (0) → diff=100 → rejected
    const nonZeroItems = [{ price: 100, quantity: 1 }];
    expect(validateOrderSubtotal({ items: nonZeroItems, subtotal: null }).status).toBe(422);
    expect(validateOrderSubtotal({ items: nonZeroItems, subtotal: undefined }).status).toBe(422);
  });
});
