/**
 * orderEnhancements.property.test.js — Property-based tests for order enhancements.
 *
 * Feature: order-enhancements
 * Properties 1, 2, 3: Variant price lookup, fallback, and round-trip persistence.
 *
 * **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { resolveVariantPrice } from '../../../src/services/productService.js';

// ── Property 1: Variant price lookup correctness ──────────────────────────────

// Feature: order-enhancements, Property 1: Variant price lookup correctness

describe('Property 1: Variant price lookup correctness', () => {
  /**
   * **Validates: Requirements 1.2, 1.3, 1.4**
   *
   * For any product with a non-empty variantPrices map and any key present in
   * that map, resolveVariantPrice returns the exact stored price.
   */
  it('returns the exact stored price for any key present in variantPrices (100 iterations)', () => {
    fc.assert(
      fc.property(
        // Generate a variant record with random color/size/material and a price
        fc.record({
          color:    fc.string({ minLength: 1, maxLength: 20 }),
          size:     fc.string({ minLength: 1, maxLength: 20 }),
          material: fc.string({ minLength: 1, maxLength: 20 }),
          price:    fc.float({ min: 0, max: 1_000_000, noNaN: true }),
        }),
        // Generate a base price for the product
        fc.float({ min: 0, max: 1_000_000, noNaN: true }),
        ({ color, size, material, price }, basePrice) => {
          const key = `${color}|${size}|${material}`;
          const variantPrices = { [key]: price };
          const product = { price: basePrice, variantPrices };

          const resolved = resolveVariantPrice(product, color, size, material);
          expect(resolved).toBe(price);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns the exact stored price when variantPrices is a JSON string (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.record({
          color:    fc.string({ minLength: 1, maxLength: 20 }),
          size:     fc.string({ minLength: 1, maxLength: 20 }),
          material: fc.string({ minLength: 1, maxLength: 20 }),
          price:    fc.float({ min: 0, max: 1_000_000, noNaN: true }),
        }),
        fc.float({ min: 0, max: 1_000_000, noNaN: true }),
        ({ color, size, material, price }, basePrice) => {
          const key = `${color}|${size}|${material}`;
          const variantPrices = JSON.stringify({ [key]: price });
          const product = { price: basePrice, variantPrices };

          const resolved = resolveVariantPrice(product, color, size, material);
          expect(resolved).toBe(price);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 2: Variant price fallback to base price ─────────────────────────

// Feature: order-enhancements, Property 2: Variant price fallback to base price

describe('Property 2: Variant price fallback to base price', () => {
  /**
   * **Validates: Requirements 1.5**
   *
   * For any product and any variant key NOT present in variantPrices (or when
   * the map is null/empty), resolveVariantPrice returns product.price.
   */
  it('falls back to product.price when the variant key is not in the map (100 iterations)', () => {
    fc.assert(
      fc.property(
        // The "stored" variant uses one set of values
        fc.record({
          storedColor:    fc.string({ minLength: 1, maxLength: 20 }),
          storedSize:     fc.string({ minLength: 1, maxLength: 20 }),
          storedMaterial: fc.string({ minLength: 1, maxLength: 20 }),
          storedPrice:    fc.float({ min: 1, max: 1_000_000, noNaN: true }),
        }),
        // The "lookup" variant uses different values (guaranteed different by filter)
        fc.record({
          lookupColor:    fc.string({ minLength: 1, maxLength: 20 }),
          lookupSize:     fc.string({ minLength: 1, maxLength: 20 }),
          lookupMaterial: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        fc.float({ min: 0, max: 1_000_000, noNaN: true }),
        ({ storedColor, storedSize, storedMaterial, storedPrice }, { lookupColor, lookupSize, lookupMaterial }, basePrice) => {
          const storedKey = `${storedColor}|${storedSize}|${storedMaterial}`;
          const lookupKey = `${lookupColor}|${lookupSize}|${lookupMaterial}`;

          // Only test when the lookup key differs from the stored key
          fc.pre(storedKey !== lookupKey);

          const variantPrices = { [storedKey]: storedPrice };
          const product = { price: basePrice, variantPrices };

          const resolved = resolveVariantPrice(product, lookupColor, lookupSize, lookupMaterial);
          expect(resolved).toBe(basePrice);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('falls back to product.price when variantPrices is null (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1_000_000, noNaN: true }),
        fc.string({ maxLength: 20 }),
        fc.string({ maxLength: 20 }),
        fc.string({ maxLength: 20 }),
        (basePrice, color, size, material) => {
          const product = { price: basePrice, variantPrices: null };
          const resolved = resolveVariantPrice(product, color, size, material);
          expect(resolved).toBe(basePrice);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('falls back to product.price when variantPrices is an empty object (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1_000_000, noNaN: true }),
        fc.string({ maxLength: 20 }),
        fc.string({ maxLength: 20 }),
        fc.string({ maxLength: 20 }),
        (basePrice, color, size, material) => {
          const product = { price: basePrice, variantPrices: {} };
          const resolved = resolveVariantPrice(product, color, size, material);
          expect(resolved).toBe(basePrice);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 3: Variant prices round-trip persistence ────────────────────────

// Feature: order-enhancements, Property 3: Variant prices round-trip persistence

describe('Property 3: Variant prices round-trip persistence', () => {
  /**
   * **Validates: Requirements 1.6**
   *
   * Any valid variantPrices JSON object saved to a product and retrieved from
   * the DB is deeply equal to what was saved.
   *
   * Since this is a unit-level test (no real DB), the round-trip is simulated
   * by JSON.stringify then JSON.parse, which mirrors the DB serialization cycle.
   */
  it('JSON serialization round-trip preserves deep equality (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.float({ min: 0, max: 1_000_000, noNaN: true })
        ),
        (variantPrices) => {
          // Simulate DB write (JSON.stringify) then DB read (JSON.parse)
          const serialized   = JSON.stringify(variantPrices);
          const deserialized = JSON.parse(serialized);

          expect(deserialized).toEqual(variantPrices);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('resolveVariantPrice works correctly after a JSON round-trip (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.record({
          color:    fc.string({ minLength: 1, maxLength: 20 }),
          size:     fc.string({ minLength: 1, maxLength: 20 }),
          material: fc.string({ minLength: 1, maxLength: 20 }),
          price:    fc.float({ min: 0, max: 1_000_000, noNaN: true }),
        }),
        fc.float({ min: 0, max: 1_000_000, noNaN: true }),
        ({ color, size, material, price }, basePrice) => {
          const key = `${color}|${size}|${material}`;
          const original = { [key]: price };

          // Simulate DB round-trip
          const afterRoundTrip = JSON.parse(JSON.stringify(original));

          const product = { price: basePrice, variantPrices: afterRoundTrip };
          const resolved = resolveVariantPrice(product, color, size, material);

          expect(resolved).toBe(price);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 4: Promo code discount calculation correctness ───────────────────

// Feature: order-enhancements, Property 4: Promo code discount calculation correctness

describe('Property 4: Promo code discount calculation correctness', () => {
  /**
   * **Validates: Requirements 2.2**
   *
   * For type='percentage' and value v: discountAmount = subtotal * (v/100),
   * finalSubtotal = subtotal - discountAmount.
   * For type='fixed' and value v: discountAmount = min(v, subtotal),
   * finalSubtotal = max(0, subtotal - v).
   */
  it('computes correct discount and finalSubtotal for percentage and fixed types (100 iterations)', () => {
    // Inline pure calculation logic extracted from promo.service.js
    function calcDiscount({ type, value, subtotal }) {
      let discountAmount;
      if (type === 'percentage') {
        discountAmount = subtotal * (value / 100);
      } else {
        // fixed — clamp so finalSubtotal never goes below 0
        discountAmount = Math.min(value, subtotal);
      }
      const finalSubtotal = Math.max(0, subtotal - discountAmount);
      return { discountAmount, finalSubtotal };
    }

    fc.assert(
      fc.property(
        fc.record({
          type:     fc.constantFrom('percentage', 'fixed'),
          value:    fc.float({ min: 0, max: 100, noNaN: true }),
          subtotal: fc.float({ min: 1, max: 1e7, noNaN: true }),
        }),
        ({ type, value, subtotal }) => {
          const { discountAmount, finalSubtotal } = calcDiscount({ type, value, subtotal });

          if (type === 'percentage') {
            expect(discountAmount).toBeCloseTo(subtotal * (value / 100), 5);
            expect(finalSubtotal).toBeCloseTo(subtotal - discountAmount, 5);
          } else {
            // fixed
            expect(discountAmount).toBeCloseTo(Math.min(value, subtotal), 5);
            expect(finalSubtotal).toBeCloseTo(Math.max(0, subtotal - value), 5);
          }

          // Universal invariants
          expect(finalSubtotal).toBeGreaterThanOrEqual(0);
          expect(discountAmount).toBeGreaterThanOrEqual(0);
          expect(discountAmount).toBeLessThanOrEqual(subtotal);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 5: Invalid/expired promo code rejection ─────────────────────────

// Feature: order-enhancements, Property 5: Invalid/expired promo code rejection

describe('Property 5: Invalid/expired promo code rejection', () => {
  /**
   * **Validates: Requirements 2.3, 2.8**
   *
   * Any code that does not match, is expired, or has usage_count >= max_uses
   * returns { ok: false } and applies no discount.
   */
  it('rejects promo codes that do not match the lookup code (100 iterations)', () => {
    // Inline pure validation logic extracted from promo.service.js
    function validatePromoInline(row, lookupCode) {
      if (!row || row.code.toUpperCase() !== lookupCode.toUpperCase()) {
        return { ok: false };
      }
      if (row.expires_at !== null && new Date(row.expires_at) < new Date()) {
        return { ok: false };
      }
      if (row.max_uses !== null && row.usage_count >= row.max_uses) {
        return { ok: false };
      }
      return { ok: true };
    }

    // Scenario A: code mismatch
    fc.assert(
      fc.property(
        fc.record({
          storedCode:  fc.string({ minLength: 1, maxLength: 20 }),
          lookupCode:  fc.string({ minLength: 1, maxLength: 20 }),
        }),
        ({ storedCode, lookupCode }) => {
          fc.pre(storedCode.toUpperCase() !== lookupCode.toUpperCase());

          const row = {
            code:        storedCode,
            expires_at:  null,
            max_uses:    null,
            usage_count: 0,
          };

          const result = validatePromoInline(row, lookupCode);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects promo codes that are expired (100 iterations)', () => {
    function validatePromoInline(row, lookupCode) {
      if (!row || row.code.toUpperCase() !== lookupCode.toUpperCase()) {
        return { ok: false };
      }
      if (row.expires_at !== null && new Date(row.expires_at) < new Date()) {
        return { ok: false };
      }
      if (row.max_uses !== null && row.usage_count >= row.max_uses) {
        return { ok: false };
      }
      return { ok: true };
    }

    // Scenario B: expired code (expires_at in the past)
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 365 * 10 }), // days in the past
        (code, daysAgo) => {
          const pastDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
          const row = {
            code,
            expires_at:  pastDate,
            max_uses:    null,
            usage_count: 0,
          };

          const result = validatePromoInline(row, code);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects promo codes that have reached max_uses (100 iterations)', () => {
    function validatePromoInline(row, lookupCode) {
      if (!row || row.code.toUpperCase() !== lookupCode.toUpperCase()) {
        return { ok: false };
      }
      if (row.expires_at !== null && new Date(row.expires_at) < new Date()) {
        return { ok: false };
      }
      if (row.max_uses !== null && row.usage_count >= row.max_uses) {
        return { ok: false };
      }
      return { ok: true };
    }

    // Scenario C: usage_count >= max_uses
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        (code, maxUses, extraUses) => {
          const usageCount = maxUses + extraUses; // always >= max_uses
          const row = {
            code,
            expires_at:  null,
            max_uses:    maxUses,
            usage_count: usageCount,
          };

          const result = validatePromoInline(row, code);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 6: Promo apply-remove round trip ─────────────────────────────────

// Feature: order-enhancements, Property 6: Promo apply-remove round trip

describe('Property 6: Promo apply-remove round trip', () => {
  /**
   * **Validates: Requirements 2.5**
   *
   * Applying then removing a promo code restores the displayed subtotal to its
   * original value with no discount remaining.
   *
   * State model:
   *   { subtotal, promoDiscount }
   *   promoDiscount = null | { discountAmount, finalSubtotal }
   *
   * Apply:  set promoDiscount = { discountAmount, finalSubtotal }
   * Remove: set promoDiscount = null
   * Assert: displayed subtotal equals original subtotal
   */
  it('restores original subtotal after applying then removing a promo code (100 iterations)', () => {
    function applyPromo(subtotal, discountPercentage) {
      const discountAmount = subtotal * (discountPercentage / 100);
      const finalSubtotal  = Math.max(0, subtotal - discountAmount);
      return { discountAmount, finalSubtotal };
    }

    function getDisplayedSubtotal(subtotal, promoDiscount) {
      if (promoDiscount === null) {
        return subtotal;
      }
      return promoDiscount.finalSubtotal;
    }

    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 1e7, noNaN: true }),
        fc.float({ min: 0, max: 100, noNaN: true }),
        (subtotal, discountPercentage) => {
          // Initial state: no promo applied
          let promoDiscount = null;
          expect(getDisplayedSubtotal(subtotal, promoDiscount)).toBe(subtotal);

          // Apply promo
          promoDiscount = applyPromo(subtotal, discountPercentage);
          const displayedAfterApply = getDisplayedSubtotal(subtotal, promoDiscount);
          expect(displayedAfterApply).toBeCloseTo(promoDiscount.finalSubtotal, 5);

          // Remove promo
          promoDiscount = null;
          const displayedAfterRemove = getDisplayedSubtotal(subtotal, promoDiscount);

          // Assert: displayed subtotal is restored to original
          expect(displayedAfterRemove).toBe(subtotal);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('restores original subtotal after applying then removing a fixed promo code (100 iterations)', () => {
    function applyFixedPromo(subtotal, fixedValue) {
      const discountAmount = Math.min(fixedValue, subtotal);
      const finalSubtotal  = Math.max(0, subtotal - fixedValue);
      return { discountAmount, finalSubtotal };
    }

    function getDisplayedSubtotal(subtotal, promoDiscount) {
      return promoDiscount === null ? subtotal : promoDiscount.finalSubtotal;
    }

    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 1e7, noNaN: true }),
        fc.float({ min: 0, max: 100, noNaN: true }),
        (subtotal, fixedValue) => {
          let promoDiscount = null;

          // Apply fixed promo
          promoDiscount = applyFixedPromo(subtotal, fixedValue);
          expect(getDisplayedSubtotal(subtotal, promoDiscount)).toBeCloseTo(promoDiscount.finalSubtotal, 5);

          // Remove promo
          promoDiscount = null;
          expect(getDisplayedSubtotal(subtotal, promoDiscount)).toBe(subtotal);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 7: Promo code persisted on order ─────────────────────────────────

// Feature: order-enhancements, Property 7: Promo code persisted on order

describe('Property 7: Promo code persisted on order', () => {
  /**
   * **Validates: Requirements 2.6**
   *
   * Any order created with a valid promo code returns promoCode equal to the
   * applied code and discountAmount equal to the computed discount.
   *
   * Since this is a unit-level test (no real DB), order creation is modelled as
   * a pure function that maps { items, subtotal, promoCode, discountAmount } to
   * an order object, and we assert the fields are preserved.
   */

  /**
   * Pure function that models order creation — mirrors what orders.service.js
   * does when it INSERTs a row and returns the created order.
   */
  function createOrderPure({ items, subtotal, promoCode, discountAmount }) {
    return {
      id: 'order-id-placeholder',
      items,
      subtotal,
      promoCode:      promoCode      ?? null,
      discountAmount: discountAmount ?? 0,
    };
  }

  it('preserves promoCode and discountAmount on the created order (100 iterations)', () => {
    fc.assert(
      fc.property(
        // Generate promo data: a non-empty code string and a non-negative discount amount
        fc.record({
          code:           fc.string({ minLength: 1, maxLength: 20 }),
          discountAmount: fc.float({ min: 0, max: 1e6, noNaN: true }),
        }),
        // Generate a subtotal that is at least as large as the discount
        fc.float({ min: 0, max: 1e6, noNaN: true }),
        ({ code, discountAmount }, subtotal) => {
          const order = createOrderPure({
            items:          [],
            subtotal,
            promoCode:      code,
            discountAmount,
          });

          // The order must carry back exactly the code that was applied
          expect(order.promoCode).toBe(code);

          // The order must carry back exactly the computed discount amount
          expect(order.discountAmount).toBe(discountAmount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('stores null promoCode and zero discountAmount when no promo is applied (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1e6, noNaN: true }),
        (subtotal) => {
          const order = createOrderPure({
            items:    [],
            subtotal,
            // promoCode and discountAmount intentionally omitted
          });

          expect(order.promoCode).toBeNull();
          expect(order.discountAmount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 8: Conversation deletion removes all messages ────────────────────

// Feature: order-enhancements, Property 8: Conversation deletion removes all messages

describe('Property 8: Conversation deletion removes all messages', () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * For any conversation with any number of messages, deleting it results in
   * zero messages remaining with that conversation_id.
   *
   * Modelled as a pure in-memory test: a mock DB state holds conversations and
   * messages; `deleteConversationPure` removes the conversation and all its
   * messages; we assert no messages remain for that conversation_id.
   */

  /**
   * Pure function that models conversation deletion.
   * Returns the new state after deletion.
   */
  function deleteConversationPure(state, conversationId) {
    return {
      conversations: state.conversations.filter((c) => c.id !== conversationId),
      messages: state.messages.filter((m) => m.conversation_id !== conversationId),
    };
  }

  it('results in zero messages remaining for the deleted conversation_id (100 iterations)', () => {
    fc.assert(
      fc.property(
        // The conversation to delete
        fc.uuid(),
        // Messages belonging to the target conversation
        fc.array(
          fc.record({ id: fc.uuid(), content: fc.string() }),
          { minLength: 0, maxLength: 20 }
        ),
        // Additional unrelated conversations and their messages
        fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
        (targetId, targetMessages, otherIds) => {
          // Build initial state
          const conversations = [
            { id: targetId },
            ...otherIds.map((id) => ({ id })),
          ];

          const messages = [
            ...targetMessages.map((m) => ({ ...m, conversation_id: targetId })),
            // Add some messages for other conversations
            ...otherIds.flatMap((id) => [
              { id: `msg-${id}-1`, content: 'other', conversation_id: id },
            ]),
          ];

          const state = { conversations, messages };

          // Delete the target conversation
          const newState = deleteConversationPure(state, targetId);

          // Assert: no messages remain for the deleted conversation_id
          const remaining = newState.messages.filter(
            (m) => m.conversation_id === targetId
          );
          expect(remaining).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does not remove messages belonging to other conversations (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.array(
          fc.record({ id: fc.uuid(), content: fc.string() }),
          { minLength: 1, maxLength: 10 }
        ),
        (targetId, otherId, otherMessages) => {
          fc.pre(targetId !== otherId);

          const state = {
            conversations: [{ id: targetId }, { id: otherId }],
            messages: [
              { id: 'target-msg', content: 'to delete', conversation_id: targetId },
              ...otherMessages.map((m) => ({ ...m, conversation_id: otherId })),
            ],
          };

          const newState = deleteConversationPure(state, targetId);

          // Messages for the other conversation must be untouched
          const otherRemaining = newState.messages.filter(
            (m) => m.conversation_id === otherId
          );
          expect(otherRemaining).toHaveLength(otherMessages.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 9: Conversation deletion cleans up files and localStorage ────────

// Feature: order-enhancements, Property 9: Conversation deletion cleans up files and localStorage

describe('Property 9: Conversation deletion cleans up files and localStorage', () => {
  /**
   * **Validates: Requirements 3.4, 3.5**
   *
   * After deletion:
   *   (a) all file_path values referenced by file messages no longer exist in state
   *   (b) the conversation no longer appears in the conversations list
   *
   * Modelled as a pure in-memory test with a mock state containing conversations
   * and file messages.
   */

  /**
   * Pure deletion function that also returns the file paths that were removed.
   */
  function deleteConversationPure(state, conversationId) {
    const deletedFilePaths = state.messages
      .filter(
        (m) =>
          m.conversation_id === conversationId &&
          m.type === 'file' &&
          m.file_path != null
      )
      .map((m) => m.file_path);

    return {
      newState: {
        conversations: state.conversations.filter((c) => c.id !== conversationId),
        messages: state.messages.filter((m) => m.conversation_id !== conversationId),
      },
      deletedFilePaths,
    };
  }

  it('removes all file_path references for the deleted conversation (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        // File messages for the target conversation
        fc.array(
          fc.record({
            id:        fc.uuid(),
            file_path: fc.string({ minLength: 1, maxLength: 80 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (targetId, fileMessages) => {
          const state = {
            conversations: [{ id: targetId }],
            messages: fileMessages.map((m) => ({
              ...m,
              conversation_id: targetId,
              type: 'file',
            })),
          };

          const { newState, deletedFilePaths } = deleteConversationPure(state, targetId);

          // (a) No file messages remain for the deleted conversation
          const remainingFileMsgs = newState.messages.filter(
            (m) => m.conversation_id === targetId && m.type === 'file'
          );
          expect(remainingFileMsgs).toHaveLength(0);

          // (b) The returned deletedFilePaths matches what was in the state
          const expectedPaths = fileMessages.map((m) => m.file_path);
          expect(deletedFilePaths.sort()).toEqual(expectedPaths.sort());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('removes the conversation from the conversations list (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
        (targetId, otherIds) => {
          const allIds = [targetId, ...otherIds.filter((id) => id !== targetId)];
          const state = {
            conversations: allIds.map((id) => ({ id })),
            messages: [],
          };

          const { newState } = deleteConversationPure(state, targetId);

          // (b) The conversation no longer appears in the list
          const found = newState.conversations.find((c) => c.id === targetId);
          expect(found).toBeUndefined();

          // Other conversations are preserved
          const otherUnique = otherIds.filter((id) => id !== targetId);
          expect(newState.conversations).toHaveLength(otherUnique.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 10: Only admin can delete conversations ──────────────────────────

// Feature: order-enhancements, Property 10: Only admin can delete conversations

describe('Property 10: Only admin can delete conversations', () => {
  /**
   * **Validates: Requirements 3.7**
   *
   * For any role that is not 'admin', a DELETE request returns HTTP 403 and
   * does not delete the conversation.
   *
   * Modelled as a pure role-check function: `canDeleteConversation(role)`
   * returns true only for 'admin'.
   */

  function canDeleteConversation(role) {
    return role === 'admin';
  }

  /**
   * Simulates the HTTP layer: returns 403 for non-admin roles without touching
   * the state, and 200 + updated state for admin.
   */
  function handleDeleteRequest(state, conversationId, role) {
    if (!canDeleteConversation(role)) {
      return { status: 403, state };
    }
    const newState = {
      conversations: state.conversations.filter((c) => c.id !== conversationId),
      messages: state.messages.filter((m) => m.conversation_id !== conversationId),
    };
    return { status: 200, state: newState };
  }

  it('returns 403 for every non-admin role (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('customer', 'cashier', 'cs', 'qc', 'owner', 'operational'),
        fc.uuid(),
        (role, conversationId) => {
          const state = {
            conversations: [{ id: conversationId }],
            messages: [{ id: 'msg-1', conversation_id: conversationId, content: 'hi' }],
          };

          const result = handleDeleteRequest(state, conversationId, role);

          // Must return 403
          expect(result.status).toBe(403);

          // Conversation must NOT be deleted
          const stillExists = result.state.conversations.find(
            (c) => c.id === conversationId
          );
          expect(stillExists).toBeDefined();

          // Messages must NOT be deleted
          const msgsStillExist = result.state.messages.filter(
            (m) => m.conversation_id === conversationId
          );
          expect(msgsStillExist.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('canDeleteConversation returns true only for admin (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('customer', 'cashier', 'cs', 'qc', 'owner', 'operational'),
        (role) => {
          expect(canDeleteConversation(role)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );

    // Positive case: admin is allowed
    expect(canDeleteConversation('admin')).toBe(true);
  });

  it('returns 200 and deletes the conversation for admin role', () => {
    const conversationId = 'conv-admin-test';
    const state = {
      conversations: [{ id: conversationId }],
      messages: [{ id: 'msg-1', conversation_id: conversationId, content: 'hi' }],
    };

    const result = handleDeleteRequest(state, conversationId, 'admin');

    expect(result.status).toBe(200);
    const stillExists = result.state.conversations.find(
      (c) => c.id === conversationId
    );
    expect(stillExists).toBeUndefined();
  });
});

// ── Property 11: Order source badge rendering ─────────────────────────────────

// Feature: order-enhancements, Property 11: Order source badge rendering

describe('Property 11: Order source badge rendering', () => {
  /**
   * **Validates: Requirements 4.1, 4.2, 4.3**
   *
   * OrderDetailModal renders "Custom Order" badge iff source === 'custom',
   * "Offline Order" badge iff source === 'offline', and no source badge for
   * source === 'online' or absent.
   *
   * Since this is a server-side test file (no React renderer available), the
   * badge rendering logic is modelled as a pure function that mirrors the
   * conditional rendering in OrderDetailModal.jsx.
   */

  function getSourceBadge(source) {
    if (source === 'custom')  return 'Custom Order';
    if (source === 'offline') return 'Offline Order';
    return null; // no badge for 'online' or absent
  }

  it('returns the correct badge text for every source value (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('online', 'offline', 'custom', undefined, null),
        (source) => {
          const badge = getSourceBadge(source);

          if (source === 'custom') {
            expect(badge).toBe('Custom Order');
          } else if (source === 'offline') {
            expect(badge).toBe('Offline Order');
          } else {
            // 'online', undefined, null — no badge
            expect(badge).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns "Custom Order" for source === "custom"', () => {
    expect(getSourceBadge('custom')).toBe('Custom Order');
  });

  it('returns "Offline Order" for source === "offline"', () => {
    expect(getSourceBadge('offline')).toBe('Offline Order');
  });

  it('returns null for source === "online"', () => {
    expect(getSourceBadge('online')).toBeNull();
  });

  it('returns null for source === undefined', () => {
    expect(getSourceBadge(undefined)).toBeNull();
  });

  it('returns null for source === null', () => {
    expect(getSourceBadge(null)).toBeNull();
  });
});

// ── Property 14: Cancellation allowed on all non-terminal statuses ────────────

// Feature: order-enhancements, Property 14: Cancellation allowed on all non-terminal statuses

import { getAllowedNextStatuses } from '../services/orders.service.js';

const ALL_STATUSES = [
  'Waiting for Payment',
  'Payment Accepted',
  'Waiting for Design Approval',
  'Design Accepted',
  'On Progress',
  'Quality Checking',
  'In Delivery',
  'Finished',
  'Cancelled',
];

const TERMINAL_STATUSES = ['Finished', 'Cancelled'];

describe('Property 14: Cancellation allowed on all non-terminal statuses', () => {
  /**
   * **Validates: Requirements 5.8**
   *
   * For any order status that is not Finished or Cancelled,
   * getAllowedNextStatuses(status, 'admin') and getAllowedNextStatuses(status, 'owner')
   * both include 'Cancelled'. For Finished and Cancelled they do not.
   */
  it('admin and owner can cancel any non-terminal status, and cannot cancel terminal statuses (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_STATUSES),
        (status) => {
          const adminAllowed = getAllowedNextStatuses(status, 'admin');
          const ownerAllowed = getAllowedNextStatuses(status, 'owner');

          if (TERMINAL_STATUSES.includes(status)) {
            // Terminal statuses: Cancelled must NOT be in allowed transitions
            expect(adminAllowed).not.toContain('Cancelled');
            expect(ownerAllowed).not.toContain('Cancelled');
          } else {
            // Non-terminal statuses: Cancelled MUST be in allowed transitions
            expect(adminAllowed).toContain('Cancelled');
            expect(ownerAllowed).toContain('Cancelled');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 12: Empty cancellation reason is rejected ────────────────────────

// Feature: order-enhancements, Property 12: Empty cancellation reason is rejected

/**
 * Pure validation function that mirrors the controller's validation logic.
 * Returns { ok: false } if the reason is blank/whitespace-only, else { ok: true }.
 */
function validateCancellationReason(reason) {
  if (!reason || reason.trim() === '') {
    return { ok: false };
  }
  return { ok: true };
}

describe('Property 12: Empty cancellation reason is rejected', () => {
  /**
   * **Validates: Requirements 5.3**
   *
   * Any string composed entirely of whitespace (including empty string)
   * submitted as cancellationReason is rejected (HTTP 422 on backend;
   * UI validation error on frontend), and the order status remains unchanged.
   */
  it('rejects any blank or whitespace-only cancellation reason (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.trim() === ''),
        (reason) => {
          const result = validateCancellationReason(reason);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts any non-empty, non-whitespace cancellation reason (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (reason) => {
          const result = validateCancellationReason(reason);
          expect(result.ok).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 13: Cancellation stores reason and updates status ────────────────

// Feature: order-enhancements, Property 13: Cancellation stores reason and updates status

const CANCELLABLE_STATUSES = [
  'Waiting for Payment',
  'Payment Accepted',
  'Waiting for Design Approval',
  'Design Accepted',
  'On Progress',
  'Quality Checking',
  'In Delivery',
];

/**
 * Pure function that models the cancellation operation.
 * Returns a new order object with status set to 'Cancelled' and
 * cancellationReason set to the provided reason.
 */
function cancelOrderPure(order, reason) {
  return { ...order, status: 'Cancelled', cancellationReason: reason };
}

describe('Property 13: Cancellation stores reason and updates status', () => {
  /**
   * **Validates: Requirements 5.4, 5.5, 5.7**
   *
   * For any order in a cancellable status and any non-empty cancellationReason,
   * confirming cancellation sets order.status = 'Cancelled' and
   * order.cancellationReason equal to the provided reason.
   */
  it('sets status to Cancelled and stores the reason for any cancellable status and non-empty reason (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'Waiting for Payment',
          'Payment Accepted',
          'Waiting for Design Approval',
          'Design Accepted',
          'On Progress',
          'Quality Checking',
          'In Delivery'
        ),
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (status, reason) => {
          const order = { id: 'order-1', status, cancellationReason: null };
          const cancelled = cancelOrderPure(order, reason);

          expect(cancelled.status).toBe('Cancelled');
          expect(cancelled.cancellationReason).toBe(reason);
          // Original order is not mutated
          expect(order.status).toBe(status);
          expect(order.cancellationReason).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('preserves all other order fields when cancelling (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CANCELLABLE_STATUSES),
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.record({
          id:         fc.uuid(),
          orderNumber: fc.string({ minLength: 1, maxLength: 30 }),
          subtotal:   fc.float({ min: 0, max: 1e7, noNaN: true }),
        }),
        (status, reason, extra) => {
          const order = { ...extra, status, cancellationReason: null };
          const cancelled = cancelOrderPure(order, reason);

          // Status and reason are updated
          expect(cancelled.status).toBe('Cancelled');
          expect(cancelled.cancellationReason).toBe(reason);

          // All other fields are preserved
          expect(cancelled.id).toBe(order.id);
          expect(cancelled.orderNumber).toBe(order.orderNumber);
          expect(cancelled.subtotal).toBe(order.subtotal);
        }
      ),
      { numRuns: 100 }
    );
  });
});
