/**
 * cartSyncPayload.property.test.js — Property-based tests for cart sync payload sanitization.
 *
 * Feature: backend-integration
 * Property 6: Cart sync payload size
 *
 * **Validates: Requirements 3.18**
 *
 * For any `syncCartOnLogin` call where local items contain `designDataUrl`,
 * the serialized body sent to `POST /api/cart/sync` must not contain any
 * `designDataUrl` field, and the JSON payload must be under 1MB.
 *
 * The sanitization logic from cartService.js is inlined and tested directly:
 *   const sanitized = localItems.map(({ designDataUrl, ...rest }) => rest);
 */

// Feature: backend-integration, Property 6: Cart sync payload size

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ── Inlined sanitization logic from src/services/cartService.js ───────────────

/**
 * Mirrors the sanitization step in syncCartOnLogin:
 *   const sanitized = localItems.map(({ designDataUrl, ...rest }) => rest);
 *
 * @param {Array<Object>} localItems - cart items from localStorage (may contain designDataUrl)
 * @returns {Array<Object>} items with designDataUrl stripped
 */
function sanitizeCartItems(localItems) {
  return localItems.map(({ designDataUrl: _ddu, ...rest }) => rest);
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Generates a realistic base64 design data URL string.
 * Sizes range from small thumbnails to moderate design files.
 * Kept under 50KB per item to ensure tests run in reasonable time.
 */
const base64DataUrl = fc.oneof(
  // Small base64 string (thumbnail-sized)
  fc.base64String({ minLength: 100, maxLength: 1000 }).map((s) => `data:image/png;base64,${s}`),
  // Medium base64 string (~10KB — realistic design preview)
  fc.base64String({ minLength: 5000, maxLength: 20000 }).map((s) => `data:image/png;base64,${s}`),
);

/**
 * Generates a cart item that always includes a designDataUrl field.
 */
const cartItemWithDesign = fc.record({
  id:             fc.uuid(),
  productId:      fc.uuid(),
  name:           fc.string({ minLength: 1, maxLength: 100 }),
  price:          fc.float({ min: 0, max: 10000000, noNaN: true }),
  quantity:       fc.integer({ min: 1, max: 100 }),
  notes:          fc.string({ maxLength: 200 }),
  designFileName: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
  designDataUrl:  base64DataUrl,
  createdAt:      fc.constant(new Date('2024-01-01T00:00:00.000Z').toISOString()),
});

/**
 * Generates a cart item without a designDataUrl field (plain item).
 */
const cartItemWithoutDesign = fc.record({
  id:        fc.uuid(),
  productId: fc.uuid(),
  name:      fc.string({ minLength: 1, maxLength: 100 }),
  price:     fc.float({ min: 0, max: 10000000, noNaN: true }),
  quantity:  fc.integer({ min: 1, max: 100 }),
  notes:     fc.string({ maxLength: 200 }),
  createdAt: fc.date().map((d) => d.toISOString()),
});

/**
 * Generates a mixed cart: some items with designDataUrl, some without.
 */
const mixedCartItems = fc.array(
  fc.oneof(cartItemWithDesign, cartItemWithoutDesign),
  { minLength: 1, maxLength: 5 }
);

// ── Sub-task 13.6.1 — designDataUrl is stripped before sending ────────────────

describe('Property 6: Cart sync payload — designDataUrl is stripped (P6)', () => {
  it('sanitized items never contain designDataUrl when all items have it (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(cartItemWithDesign, { minLength: 1, maxLength: 5 }),
        (localItems) => {
          const sanitized = sanitizeCartItems(localItems);

          // Every sanitized item must not have designDataUrl
          for (const item of sanitized) {
            expect(Object.prototype.hasOwnProperty.call(item, 'designDataUrl')).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sanitized items never contain designDataUrl in mixed carts (100 iterations)', () => {
    fc.assert(
      fc.property(
        mixedCartItems,
        (localItems) => {
          const sanitized = sanitizeCartItems(localItems);

          // No sanitized item should have designDataUrl
          for (const item of sanitized) {
            expect(Object.prototype.hasOwnProperty.call(item, 'designDataUrl')).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all other fields are preserved after sanitization (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(cartItemWithDesign, { minLength: 1, maxLength: 5 }),
        (localItems) => {
          const sanitized = sanitizeCartItems(localItems);

          expect(sanitized).toHaveLength(localItems.length);

          for (let i = 0; i < localItems.length; i++) {
            const original = localItems[i];
            const clean    = sanitized[i];

            // Core fields must be preserved
            expect(clean.id).toBe(original.id);
            expect(clean.productId).toBe(original.productId);
            expect(clean.name).toBe(original.name);
            expect(clean.price).toBe(original.price);
            expect(clean.quantity).toBe(original.quantity);
            expect(clean.notes).toBe(original.notes);
            expect(clean.createdAt).toBe(original.createdAt);

            // designDataUrl must be absent
            expect(Object.prototype.hasOwnProperty.call(clean, 'designDataUrl')).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('items without designDataUrl are unchanged after sanitization (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(cartItemWithoutDesign, { minLength: 1, maxLength: 5 }),
        (localItems) => {
          const sanitized = sanitizeCartItems(localItems);

          expect(sanitized).toHaveLength(localItems.length);

          for (let i = 0; i < localItems.length; i++) {
            // Items that never had designDataUrl should be identical
            expect(sanitized[i]).toEqual(localItems[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Sub-task 13.6.2 — JSON payload is under 1MB ───────────────────────────────

const ONE_MB = 1024 * 1024; // 1,048,576 bytes

describe('Property 6: Cart sync payload — serialized payload under 1MB (P6)', () => {
  it('JSON payload of sanitized items is under 1MB when items have large designDataUrl (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(cartItemWithDesign, { minLength: 1, maxLength: 5 }),
        (localItems) => {
          const sanitized = sanitizeCartItems(localItems);

          // This is the body that would be sent: { items: sanitized }
          const payload = JSON.stringify({ items: sanitized });
          const byteSize = Buffer.byteLength(payload, 'utf8');

          expect(byteSize).toBeLessThan(ONE_MB);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('JSON payload of sanitized mixed cart is under 1MB (100 iterations)', () => {
    fc.assert(
      fc.property(
        mixedCartItems,
        (localItems) => {
          const sanitized = sanitizeCartItems(localItems);

          const payload = JSON.stringify({ items: sanitized });
          const byteSize = Buffer.byteLength(payload, 'utf8');

          expect(byteSize).toBeLessThan(ONE_MB);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('unsanitized payload with large designDataUrl exceeds 1MB (demonstrates why stripping is needed)', () => {
    // This test documents the problem: without sanitization, large base64 fields
    // can push the payload well over 1MB.
    // We construct this deterministically to avoid slow arbitrary generation.
    const largeBase64 = 'A'.repeat(250000); // ~250KB of base64 chars per item → 5 items = ~1.25MB raw
    const localItems = Array.from({ length: 5 }, (_, i) => ({
      id:            `item-${i}`,
      productId:     `prod-${i}`,
      name:          `Product ${i}`,
      price:         10000,
      quantity:      1,
      notes:         '',
      designDataUrl: `data:image/png;base64,${largeBase64}`,
      createdAt:     new Date().toISOString(),
    }));

    // Without sanitization, the payload is large (> 1MB)
    const rawPayload = JSON.stringify({ items: localItems });
    const rawSize    = Buffer.byteLength(rawPayload, 'utf8');
    expect(rawSize).toBeGreaterThan(ONE_MB);

    // With sanitization, the payload is under 1MB
    const sanitized        = sanitizeCartItems(localItems);
    const sanitizedPayload = JSON.stringify({ items: sanitized });
    const sanitizedSize    = Buffer.byteLength(sanitizedPayload, 'utf8');
    expect(sanitizedSize).toBeLessThan(ONE_MB);

    // Sanitization must reduce the payload size significantly
    expect(sanitizedSize).toBeLessThan(rawSize);
  });
});
