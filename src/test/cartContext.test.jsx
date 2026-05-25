// Feature: vanilla-to-react-migration, Property 4: Cart add/remove round trip
// Feature: vanilla-to-react-migration, Property 5: Cart item count is non-negative
import { describe, it, expect } from 'vitest';
import { render, act, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { CartContext, CartProvider } from '../components/context/CartContext.jsx';
import { useContext } from 'react';

// Consumer that displays current items as JSON
function CartConsumer() {
  const { items } = useContext(CartContext);
  return (
    <div data-testid="cart-items">{JSON.stringify(items)}</div>
  );
}

// Component that exposes cart actions for testing
function CartController({ onMount }) {
  const ctx = useContext(CartContext);
  if (onMount) onMount(ctx);
  return null;
}

function renderCart() {
  let capturedCtx = null;

  const { unmount } = render(
    <CartProvider>
      <CartController onMount={(ctx) => { capturedCtx = ctx; }} />
      <CartConsumer />
    </CartProvider>
  );

  return { getCtx: () => capturedCtx, unmount };
}

function getItems() {
  return JSON.parse(screen.getByTestId('cart-items').textContent);
}

describe('CartContext', () => {
  it('starts with an empty cart', () => {
    const { unmount } = render(
      <CartProvider>
        <CartConsumer />
      </CartProvider>
    );
    expect(getItems()).toEqual([]);
    unmount();
  });

  /**
   * Property 4: Cart add/remove round trip
   * Validates: Requirements 4.2, 4.5
   *
   * For any initial cart state and any cart item, adding that item and then
   * removing it by its id SHALL return the cart to a state with the same items
   * as before the add.
   */
  it('Property 4: Cart add/remove round trip', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string(),
            price: fc.nat(),
          })
        ),
        fc.record({
          id: fc.uuid(),
          name: fc.string(),
          price: fc.nat(),
        }),
        (initialItems, newItem) => {
          // Ensure newItem id doesn't collide with initialItems
          fc.pre(!initialItems.some((i) => i.id === newItem.id));

          const { getCtx, unmount } = renderCart();

          // Populate initial items
          act(() => {
            for (const item of initialItems) {
              getCtx().addItem(item);
            }
          });

          const beforeAdd = getItems();

          // Add the new item
          act(() => {
            getCtx().addItem(newItem);
          });

          // Remove it by id
          act(() => {
            getCtx().removeItem(newItem.id);
          });

          const afterRoundTrip = getItems();

          expect(afterRoundTrip).toEqual(beforeAdd);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Cart item count is non-negative
   * Validates: Requirements 4.2
   *
   * For any sequence of addItem and removeItem calls on CartContext,
   * the length of items SHALL never be negative.
   */
  it('Property 5: Cart item count is non-negative', () => {
    // Arbitraries for operations
    const itemArb = fc.record({
      id: fc.uuid(),
      name: fc.string(),
      price: fc.nat(),
    });

    const addOpArb = itemArb.map((item) => ({ type: 'add', item }));
    const removeOpArb = fc.string().map((id) => ({ type: 'remove', id }));
    const opArb = fc.oneof(addOpArb, removeOpArb);

    fc.assert(
      fc.property(
        fc.array(opArb, { minLength: 1, maxLength: 50 }),
        (ops) => {
          const { getCtx, unmount } = renderCart();

          let neverNegative = true;

          for (const op of ops) {
            act(() => {
              if (op.type === 'add') {
                getCtx().addItem(op.item);
              } else {
                getCtx().removeItem(op.id);
              }
            });

            const currentItems = getItems();
            if (currentItems.length < 0) {
              neverNegative = false;
              break;
            }
          }

          unmount();
          expect(neverNegative).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
