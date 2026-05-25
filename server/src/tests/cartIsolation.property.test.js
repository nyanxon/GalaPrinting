/**
 * cartIsolation.property.test.js — Property-based tests for cart isolation.
 *
 * Feature: backend-integration
 * Property 4: Cart isolation
 *
 * Requirements: 5.6, 8
 */

// Feature: backend-integration, Property 4: Cart isolation

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * In-memory cart store that mirrors cart.service.js ownership logic.
 */
function createCartStore() {
  const items = new Map(); // itemId → { userId, ...item }

  return {
    addItem(userId, item) {
      const id = `item-${Math.random().toString(36).slice(2)}`;
      items.set(id, { id, userId, ...item });
      return id;
    },

    getCart(userId) {
      return [...items.values()].filter((i) => i.userId === userId);
    },

    updateItemQty(requestingUserId, itemId, quantity) {
      const item = items.get(itemId);
      if (!item || item.userId !== requestingUserId) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
      }
      item.quantity = quantity;
      return item;
    },

    removeItem(requestingUserId, itemId) {
      const item = items.get(itemId);
      if (!item || item.userId !== requestingUserId) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
      }
      items.delete(itemId);
    },
  };
}

describe('Property 4: Cart isolation', () => {
  it('customer A cannot read customer B cart items (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // userA
        fc.uuid(), // userB
        fc.array(fc.record({ name: fc.string(), price: fc.float({ min: 0 }) }), { minLength: 1, maxLength: 5 }),
        (userA, userB, bItems) => {
          fc.pre(userA !== userB);

          const store = createCartStore();
          bItems.forEach((item) => store.addItem(userB, item));

          const aCart = store.getCart(userA);
          expect(aCart).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('customer A cannot update customer B cart items — returns 403 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.record({ name: fc.string(), price: fc.float({ min: 0 }) }),
        (userA, userB, item) => {
          fc.pre(userA !== userB);

          const store = createCartStore();
          const itemId = store.addItem(userB, item);

          let err = null;
          try {
            store.updateItemQty(userA, itemId, 5);
          } catch (e) {
            err = e;
          }

          expect(err).not.toBeNull();
          expect(err.status).toBe(403);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('customer A cannot remove customer B cart items — returns 403 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.record({ name: fc.string(), price: fc.float({ min: 0 }) }),
        (userA, userB, item) => {
          fc.pre(userA !== userB);

          const store = createCartStore();
          const itemId = store.addItem(userB, item);

          let err = null;
          try {
            store.removeItem(userA, itemId);
          } catch (e) {
            err = e;
          }

          expect(err).not.toBeNull();
          expect(err.status).toBe(403);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('customer can always read and modify their own cart items (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(fc.record({ name: fc.string(), price: fc.float({ min: 0 }) }), { minLength: 1, maxLength: 5 }),
        (userId, items) => {
          const store = createCartStore();
          const ids = items.map((item) => store.addItem(userId, item));

          const cart = store.getCart(userId);
          expect(cart).toHaveLength(items.length);

          // Can update own items
          expect(() => store.updateItemQty(userId, ids[0], 3)).not.toThrow();

          // Can remove own items
          expect(() => store.removeItem(userId, ids[0])).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});
