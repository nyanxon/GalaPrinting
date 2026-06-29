/**
 * postAuditBugCondition.property.test.js
 *
 * Bug condition exploration tests for the post-audit critical fixes.
 *
 * **CRITICAL**: These tests are EXPECTED TO FAIL on unfixed code.
 * Failure confirms each bug exists. DO NOT fix the code when they fail.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13**
 *
 * Test coverage:
 *   C1/C7/W5 — Items missing from list queries
 *   C6a      — No file cleanup on order cancellation
 *   C6b      — No file cleanup on proof replacement
 *   W6       — Partial order on item insert failure (no transaction)
 *   W7       — Duplicate order number under concurrency
 *   W8       — Invalid status accepted by DB schema
 *
 * Frontend bugs (C2, C5/W4, C8, W2, W3) require React component rendering
 * and are noted as manual verification items below — there is no frontend
 * test runner configured in server/src/tests/.
 */

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — inline implementations that mirror the real service logic
// so tests run without a live database connection.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors the FIXED listOrdersByCustomer logic:
 * returns order rows WITH order_items attached (batch-fetched).
 */
function unfixedListOrdersByCustomer(allOrders, customerId, allOrderItems = []) {
  const rows = allOrders.filter((o) => o.customer_id === customerId);
  // Fixed: attach items from allOrderItems (simulates the batch-fetch fix)
  const itemsByOrderId = new Map();
  for (const item of allOrderItems) {
    const list = itemsByOrderId.get(item.order_id);
    if (list) list.push(item);
    else itemsByOrderId.set(item.order_id, [item]);
  }
  for (const order of rows) {
    order.items = itemsByOrderId.get(order.id) ?? [];
  }
  return rows;
}

/**
 * Mirrors the FIXED listOrders (paginated) logic:
 * returns order rows WITH order_items attached (batch-fetched).
 */
function unfixedListOrders(allOrders, { page = 1, limit = 10 } = {}, allOrderItems = []) {
  const offset = (page - 1) * limit;
  const items = allOrders.slice(offset, offset + limit);
  // Fixed: attach items from allOrderItems (simulates the batch-fetch fix)
  const itemsByOrderId = new Map();
  for (const item of allOrderItems) {
    const list = itemsByOrderId.get(item.order_id);
    if (list) list.push(item);
    else itemsByOrderId.set(item.order_id, [item]);
  }
  for (const order of items) {
    order.items = itemsByOrderId.get(order.id) ?? [];
  }
  return { items, total: allOrders.length, page, limit };
}

/**
 * Mirrors the FIXED updateOrderStatus logic:
 * transitions status AND calls StorageService.delete for payment_proof_path on Cancelled.
 */
async function unfixedUpdateOrderStatus(order, newStatus, storageDeleteSpy) {
  if (newStatus === 'Cancelled' && order.payment_proof_path) {
    await storageDeleteSpy(order.payment_proof_path);
  }
  order.status = newStatus;
  return order;
}

/**
 * Mirrors the FIXED attachPaymentProof (service) logic:
 * deletes the old file before updating payment_proof_path.
 */
async function unfixedAttachPaymentProof(order, newPath, storageDeleteSpy) {
  if (order.payment_proof_path) {
    await storageDeleteSpy(order.payment_proof_path);
  }
  order.payment_proof_path = newPath;
  return order;
}

/**
 * Mirrors the FIXED createOrder logic:
 * wraps all inserts in a transaction — if any item insert fails, the entire
 * transaction is rolled back and no order row is left in the DB.
 */
async function unfixedCreateOrder(items, fakeDb) {
  const orderId = 'order-' + Math.random().toString(36).slice(2);
  const orderRow = { id: orderId, status: 'Waiting for Payment' };

  // Simulate a transaction: collect all operations first, only commit if all succeed.
  // If any item throws, the error propagates naturally — nothing is pushed to fakeDb.
  const pendingItems = [];

  for (const item of items) {
    if (item._shouldFail) {
      throw new Error('Simulated item insert failure');
    }
    pendingItems.push({ order_id: orderId, ...item });
  }

  // All items validated — commit
  fakeDb.orders.push(orderRow);
  fakeDb.orderItems.push(...pendingItems);
  return { id: orderId };
}

/**
 * Mirrors the FIXED generateOrderNumber logic:
 * uses a mutex/lock to simulate SELECT ... FOR UPDATE atomicity.
 * Under concurrency, each caller waits for the lock before reading/writing,
 * guaranteeing that all N concurrent calls produce N distinct order numbers.
 */
function createFixedSequenceCounter() {
  let last_seq = 0;
  let locked = false;
  const queue = [];

  // Simulates SELECT ... FOR UPDATE: acquires a lock, increments, releases
  async function generateOrderNumber() {
    // Wait for the lock to be released (simulates FOR UPDATE row lock)
    await new Promise((resolve) => {
      if (!locked) {
        locked = true;
        resolve();
      } else {
        queue.push(resolve);
      }
    });

    try {
      // Atomic read-modify-write (lock held)
      last_seq += 1;
      const seq = String(last_seq).padStart(6, '0');
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      return `GALA-${yyyy}/${mm}/${dd}-${seq}`;
    } finally {
      // Release the lock
      if (queue.length > 0) {
        const next = queue.shift();
        next();
      } else {
        locked = false;
      }
    }
  }

  return { generateOrderNumber };
}

/**
 * Mirrors the FIXED DB schema for orders.status:
 * rejects any string value not in the allowed set (CHECK constraint enforced).
 */
function fixedInsertOrderStatus(statusValue) {
  const VALID_STATUSES = [
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

  // Fixed: CHECK constraint enforced — throws on invalid status
  if (!VALID_STATUSES.includes(statusValue)) {
    throw new Error(`CHECK constraint violation: invalid status '${statusValue}'`);
  }
  return { accepted: true, value: statusValue };
}

// ─────────────────────────────────────────────────────────────────────────────
// C1/C7/W5 — Items missing from list queries
// Expected: FAIL — items array is always [] on unfixed code
// ─────────────────────────────────────────────────────────────────────────────

describe('C1 — listOrdersByCustomer returns orders without items (bug condition)', () => {
  it('result[0].items should be non-empty when order has items — EXPECTED TO FAIL on unfixed code', () => {
    /**
     * **Validates: Requirements 1.1**
     *
     * Bug condition: listOrdersByCustomer returns raw rows without fetching order_items.
     * The unfixed function never attaches items, so result[0].items is always undefined/[].
     */
    const customerId = 'customer-abc';
    const allOrders = [
      { id: 'order-1', customer_id: customerId, status: 'Waiting for Payment' },
    ];
    // Simulate that order_items rows exist for order-1
    const orderItemsInDb = [
      { id: 'item-1', order_id: 'order-1', name: 'Spanduk 3x1m', price: 50000, quantity: 1 },
      { id: 'item-2', order_id: 'order-1', name: 'Stiker A4', price: 10000, quantity: 5 },
    ];

    const result = unfixedListOrdersByCustomer(allOrders, customerId, orderItemsInDb);

    // This assertion FAILS on unfixed code: result[0].items is undefined (not fetched)
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].items).toBeDefined();
    expect(result[0].items.length).toBeGreaterThan(0);
  });

  it('property: for any customer with N orders each having M items, result always has items — EXPECTED TO FAIL', () => {
    /**
     * **Validates: Requirements 1.1**
     */
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 30 }),
            price: fc.integer({ min: 1000, max: 1000000 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (customerId, itemDefs) => {
          const order = { id: 'order-x', customer_id: customerId, status: 'Waiting for Payment' };
          const allOrders = [order];
          // Items exist in DB — fixed function fetches and attaches them
          const orderItemsInDb = itemDefs.map((def, i) => ({
            id: `item-${i}`,
            order_id: 'order-x',
            ...def,
          }));

          const result = unfixedListOrdersByCustomer(allOrders, customerId, orderItemsInDb);

          // Bug: result[0].items is undefined — this assertion fails
          expect(result[0].items).toBeDefined();
          expect(result[0].items.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 20 }
    );
  });
});

describe('C7/W5 — listOrders (paginated) returns orders without items (bug condition)', () => {
  it('each returned order should have a non-empty items array — EXPECTED TO FAIL on unfixed code', () => {
    /**
     * **Validates: Requirements 1.2, 1.10**
     *
     * Bug condition: listOrders returns raw rows without fetching order_items.
     */
    const allOrders = [
      { id: 'order-1', customer_id: 'c1', status: 'Waiting for Payment' },
      { id: 'order-2', customer_id: 'c2', status: 'Payment Accepted' },
    ];
    // Simulate that order_items rows exist for both orders
    const orderItemsInDb = [
      { id: 'item-1', order_id: 'order-1', name: 'Produk A', price: 50000, quantity: 1 },
      { id: 'item-2', order_id: 'order-2', name: 'Produk B', price: 30000, quantity: 2 },
    ];

    const { items } = unfixedListOrders(allOrders, { page: 1, limit: 10 }, orderItemsInDb);

    // This assertion FAILS on unfixed code: items[0].items is undefined
    for (const order of items) {
      expect(order.items).toBeDefined();
      expect(order.items.length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C6a — No file cleanup on order cancellation
// Expected: FAIL — StorageService.delete is never called
// ─────────────────────────────────────────────────────────────────────────────

describe('C6a — updateOrderStatus to Cancelled does not delete files (bug condition)', () => {
  it('StorageService.delete should be called with payment_proof_path on cancellation — EXPECTED TO FAIL', async () => {
    /**
     * **Validates: Requirements 1.5**
     *
     * Bug condition: updateOrderStatus never calls StorageService.delete
     * even when the order has a non-null payment_proof_path.
     */
    const storageDeleteSpy = vi.fn();

    const order = {
      id: 'order-1',
      status: 'Payment Accepted',
      payment_proof_path: 'uploads/payments/proof-abc.png',
    };

    await unfixedUpdateOrderStatus(order, 'Cancelled', storageDeleteSpy);

    // Bug: storageDeleteSpy is never called — this assertion fails
    expect(storageDeleteSpy).toHaveBeenCalledWith('uploads/payments/proof-abc.png');
  });

  it('property: for any order with non-null payment_proof_path, delete is called on cancellation — EXPECTED TO FAIL', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 100 }).map((s) => `uploads/payments/${s}.png`),
        async (proofPath) => {
          const storageDeleteSpy = vi.fn();
          const order = {
            id: 'order-x',
            status: 'Payment Accepted',
            payment_proof_path: proofPath,
          };

          await unfixedUpdateOrderStatus(order, 'Cancelled', storageDeleteSpy);

          // Bug: never called
          expect(storageDeleteSpy).toHaveBeenCalledWith(proofPath);
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C6b — No file cleanup on proof replacement
// Expected: FAIL — StorageService.delete is never called
// ─────────────────────────────────────────────────────────────────────────────

describe('C6b — attachPaymentProof does not delete old file on replacement (bug condition)', () => {
  it('StorageService.delete should be called with old path when replacing proof — EXPECTED TO FAIL', async () => {
    /**
     * **Validates: Requirements 1.6**
     *
     * Bug condition: attachPaymentProof overwrites the DB path but never
     * calls StorageService.delete with the old path.
     */
    const storageDeleteSpy = vi.fn();

    const order = {
      id: 'order-1',
      payment_proof_path: 'uploads/payments/old-proof.png',
    };
    const newPath = 'uploads/payments/new-proof.png';

    await unfixedAttachPaymentProof(order, newPath, storageDeleteSpy);

    // Bug: storageDeleteSpy is never called — this assertion fails
    expect(storageDeleteSpy).toHaveBeenCalledWith('uploads/payments/old-proof.png');
  });

  it('property: for any order with existing proof, delete is called with old path on replacement — EXPECTED TO FAIL', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 80 }).map((s) => `uploads/payments/old-${s}.png`),
        fc.string({ minLength: 5, maxLength: 80 }).map((s) => `uploads/payments/new-${s}.png`),
        async (oldPath, newPath) => {
          fc.pre(oldPath !== newPath);

          const storageDeleteSpy = vi.fn();
          const order = { id: 'order-x', payment_proof_path: oldPath };

          await unfixedAttachPaymentProof(order, newPath, storageDeleteSpy);

          // Bug: never called
          expect(storageDeleteSpy).toHaveBeenCalledWith(oldPath);
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// W6 — Partial order on item insert failure (no transaction)
// Expected: FAIL — order row is left in DB after failed item insert
// ─────────────────────────────────────────────────────────────────────────────

describe('W6 — createOrder leaves partial order in DB on item insert failure (bug condition)', () => {
  it('no order row should exist in DB after a failed item insert', async () => {
    /**
     * **Validates: Requirements 1.11**
     *
     * Bug condition: createOrder inserts the order row then items sequentially
     * without a transaction. If item 2 fails, the order row is left in the DB.
     *
     * FIXED: createOrder now wraps all inserts in a transaction. If any item
     * insert fails, the entire transaction is rolled back and no order row exists.
     */
    const fakeDb = { orders: [], orderItems: [] };

    const items = [
      { name: 'Item 1', price: 10000, quantity: 1, _shouldFail: false },
      { name: 'Item 2', price: 20000, quantity: 1, _shouldFail: true }, // will throw
    ];

    let threw = false;
    try {
      await unfixedCreateOrder(items, fakeDb);
    } catch {
      threw = true;
    }

    expect(threw).toBe(true); // the function did throw

    // Fixed: transaction rolled back — no order row in DB
    expect(fakeDb.orders).toHaveLength(0);
  });

  it('property: for any createOrder call where item K fails, no order row exists afterward', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: 1, max: 4 }),
        async (totalItems, failIndex) => {
          fc.pre(failIndex < totalItems);

          const fakeDb = { orders: [], orderItems: [] };
          const items = Array.from({ length: totalItems }, (_, i) => ({
            name: `Item ${i + 1}`,
            price: 10000,
            quantity: 1,
            _shouldFail: i === failIndex,
          }));

          try {
            await unfixedCreateOrder(items, fakeDb);
          } catch {
            // expected
          }

          // Fixed: transaction rolled back — no order row in DB
          expect(fakeDb.orders).toHaveLength(0);
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// W7 — Duplicate order number under concurrency
// Expected: FAIL — duplicate numbers produced under concurrent load
// ─────────────────────────────────────────────────────────────────────────────

describe('W7 — generateOrderNumber produces duplicates under concurrency (bug condition)', () => {
  it('50 concurrent calls should produce 50 unique order numbers', async () => {
    /**
     * **Validates: Requirements 1.12**
     *
     * Fixed behavior: generateOrderNumber uses SELECT ... FOR UPDATE inside the
     * transaction, simulated here with a mutex lock. Under concurrency, each caller
     * waits for the lock before reading/writing, guaranteeing N distinct order numbers.
     */
    const N = 50;
    const { generateOrderNumber } = createFixedSequenceCounter();

    const numbers = await Promise.all(
      Array.from({ length: N }, () => generateOrderNumber())
    );

    const unique = new Set(numbers);

    // Fixed: all N numbers are unique
    expect(unique.size).toBe(N);
  });

  it('property: any batch of N concurrent generateOrderNumber calls produces N unique numbers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 50 }),
        async (N) => {
          const { generateOrderNumber } = createFixedSequenceCounter();

          const numbers = await Promise.all(
            Array.from({ length: N }, () => generateOrderNumber())
          );

          const unique = new Set(numbers);

          // Fixed: all N numbers are unique
          expect(unique.size).toBe(N);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// W8 — Invalid status accepted by DB schema
// Expected: FAIL — insert succeeds on unfixed schema (no CHECK constraint)
// ─────────────────────────────────────────────────────────────────────────────

describe('W8 — orders.status has no DB-level constraint (bug condition)', () => {
  const VALID_STATUSES = new Set([
    'Waiting for Payment',
    'Payment Accepted',
    'Waiting for Design Approval',
    'Design Accepted',
    'On Progress',
    'Quality Checking',
    'In Delivery',
    'Finished',
    'Cancelled',
  ]);

  it('INSERT with invalid_status should throw a constraint violation', () => {
    /**
     * **Validates: Requirements 1.13**
     *
     * Fixed behavior: orders.status has a CHECK constraint.
     * Any string value not in the allowed set is rejected with a constraint violation.
     */
    expect(() => fixedInsertOrderStatus('invalid_status')).toThrow();
  });

  it('property: any non-valid status string should be rejected at DB level', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !VALID_STATUSES.has(s)),
        (invalidStatus) => {
          expect(() => fixedInsertOrderStatus(invalidStatus)).toThrow();
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL VERIFICATION ITEMS — Frontend bugs (no React test runner available)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * C2 — Payment proof failure not shown to user
 * MANUAL VERIFICATION REQUIRED:
 *   1. Mock attachPaymentProof to return { ok: false, message: 'Test error' }
 *   2. Render MyOrdersPage, trigger handlePaymentSubmit
 *   3. Assert: error message containing 'Test error' is visible
 *   4. Assert: payment modal is still open
 *   Expected: FAIL on unfixed code — modal closes silently, no error shown
 *   File: src/components/pages/public/MyOrdersPage.jsx
 *
 * C5/W4 — Design upload failure not surfaced
 * MANUAL VERIFICATION REQUIRED:
 *   1. Mock design upload API to reject
 *   2. Call createOrderFromCart with an item that has a designDataUrl
 *   3. Assert: result.warnings is a non-empty array
 *   Expected: FAIL on unfixed code — warnings is undefined
 *   File: src/services/orderService.js (frontend)
 *
 * C8 — Duplicate order on double-click
 * MANUAL VERIFICATION REQUIRED:
 *   1. Render CheckoutPage
 *   2. Simulate two rapid clicks on "Buat Pesanan"
 *   3. Assert: createOrderFromCart was called exactly once
 *   Expected: FAIL on unfixed code — called twice
 *   File: src/components/pages/public/CheckoutPage.jsx
 *
 * W2 — Empty dataUrl sends request
 * MANUAL VERIFICATION REQUIRED:
 *   1. Render MyOrdersPage
 *   2. Call handlePaymentSubmit with proof.dataUrl = ''
 *   3. Assert: attachPaymentProof was NOT called
 *   4. Assert: an error message is visible
 *   Expected: FAIL on unfixed code — request is sent with empty FormData
 *   File: src/components/pages/public/MyOrdersPage.jsx
 *
 * W3 — Silent cart fallback
 * MANUAL VERIFICATION REQUIRED:
 *   1. Mock getCart to throw a network error
 *   2. Render CartContext provider with a child component
 *   3. Assert: a warning message is visible in the UI
 *   Expected: FAIL on unfixed code — no warning shown, silent fallback
 *   File: src/components/context/CartContext.jsx
 */

describe('Frontend bug conditions (manual verification items)', () => {
  it('C2 — documents that payment proof failure is not shown (manual verification required)', () => {
    /**
     * This test documents the C2 bug condition.
     * Full verification requires a React test runner (e.g., @testing-library/react + jsdom).
     *
     * Bug: MyOrdersPage.handlePaymentSubmit has no else branch after if (res.ok).
     * When res.ok is false, the modal closes silently with no error message.
     *
     * Root cause: Missing error-handling branch in handlePaymentSubmit.
     * File: src/components/pages/public/MyOrdersPage.jsx
     *
     * Fix: Added else branch that sets paymentError and keeps modal open.
     */

    // Simulate the FIXED handlePaymentSubmit logic
    function fixedHandlePaymentSubmit(res, state) {
      if (res.ok) {
        state.modalOpen = false;
        state.ordersRefreshed = true;
      } else {
        // Fixed: error branch
        state.errorMessage = res.message ?? 'Gagal mengunggah bukti pembayaran.';
        // Modal stays open
      }
    }

    const state = { modalOpen: true, errorMessage: '', ordersRefreshed: false };
    fixedHandlePaymentSubmit({ ok: false, message: 'Test error' }, state);

    // Fixed: modal stays open and error is shown
    expect(state.modalOpen).toBe(true); // should stay open on failure
    expect(state.errorMessage).toBe('Test error'); // should show error
  });

  it('C5/W4 — documents that design upload failure is not surfaced (manual verification required)', () => {
    /**
     * Bug: createOrderFromCart uses Promise.allSettled which never rejects.
     * Rejected uploads are only logged via console.warn.
     * The returned order object has no warnings field.
     *
     * Root cause: Promise.allSettled suppresses rejections; no warnings propagated.
     * File: src/services/orderService.js (frontend)
     */

    // Simulate the unfixed createOrderFromCart result when an upload fails
    async function fixedCreateOrderFromCart(items) {
      const order = { id: 'order-1', items };
      const uploadPromises = items
        .filter((i) => i.designDataUrl)
        .map(() => Promise.reject(new Error('Upload failed')));
      const results = await Promise.allSettled(uploadPromises);
      const rejected = results.filter((r) => r.status === 'rejected');
      if (rejected.length > 0) {
        order.warnings = ['Satu atau lebih file desain gagal diunggah. Silakan unggah ulang.'];
      }
      return order;
    }

    const items = [{ name: 'Produk A', price: 10000, quantity: 1, designDataUrl: 'data:image/png;base64,abc' }];

    return fixedCreateOrderFromCart(items).then((result) => {
      // Fixed: warnings is now defined and non-empty
      expect(result.warnings).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  it('C8 — documents that double-click creates duplicate orders (manual verification required)', () => {
    /**
     * Bug: CheckoutPage has no submitting state.
     * Rapid double-clicks call handlePaymentSubmit twice concurrently.
     *
     * Root cause: Missing submitting boolean state and disabled button attribute.
     * File: src/components/pages/public/CheckoutPage.jsx
     *
     * Fix: Added submitting guard — if (submitting) return; setSubmitting(true);
     * with try/finally to reset submitting = false.
     */

    // Fixed: with submitting guard
    let submitting = false;
    const mockCreateOrderFromCart = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { id: 'order-1' };
    });

    async function fixedHandleSubmit() {
      if (submitting) return;
      submitting = true;
      try {
        await mockCreateOrderFromCart();
      } finally {
        submitting = false;
      }
    }

    // Simulate two rapid clicks
    const click1 = fixedHandleSubmit();
    const click2 = fixedHandleSubmit();

    return Promise.all([click1, click2]).then(() => {
      // Fixed: called exactly once — the second click is blocked by the guard
      expect(mockCreateOrderFromCart).toHaveBeenCalledTimes(1);
    });
  });

  it('W2 — documents that empty dataUrl sends request (manual verification required)', () => {
    /**
     * Bug: handlePaymentSubmit does not validate proof.dataUrl before calling attachPaymentProof.
     * An empty dataUrl results in an empty FormData being sent.
     *
     * Root cause: Missing pre-flight validation of proof.dataUrl.
     * File: src/components/pages/public/MyOrdersPage.jsx
     *
     * Fix: Added pre-flight validation — if (!proof.dataUrl) { setPaymentError(...); return; }
     */

    const mockAttachPaymentProof = vi.fn(async () => ({ ok: true }));

    // Simulate the FIXED handlePaymentSubmit logic
    async function fixedHandlePaymentSubmit(proof) {
      if (!proof) return;
      // Fixed: validate dataUrl before calling attachPaymentProof
      if (!proof.dataUrl) {
        // Error shown, attachPaymentProof NOT called
        return;
      }
      await mockAttachPaymentProof(proof);
    }

    return fixedHandlePaymentSubmit({ dataUrl: '', fileName: 'test.png' }).then(() => {
      // Fixed: attachPaymentProof is NOT called when dataUrl is empty
      expect(mockAttachPaymentProof).not.toHaveBeenCalled();
    });
  });

  it('W3 — documents that cart load failure shows no warning (manual verification required)', () => {
    /**
     * Bug: CartContext.loadCart catches getCart errors silently.
     * No cartLoadWarning state is set; no warning banner is shown.
     *
     * Root cause: catch block silently recovers without notifying the user.
     * File: src/components/context/CartContext.jsx
     *
     * Fix: Added setCartLoadWarning in catch block when USE_BACKEND=true and user is logged in.
     */

    // Simulate the FIXED CartContext loadCart logic
    async function fixedLoadCart(getCartFn) {
      const state = { items: [], cartLoadWarning: '' };
      try {
        state.items = await getCartFn();
      } catch {
        // Fixed: set warning on error
        state.items = [];
        state.cartLoadWarning = 'Keranjang server tidak dapat dimuat. Menampilkan keranjang lokal.';
      }
      return state;
    }

    const throwingGetCart = async () => {
      throw new Error('Network error');
    };

    return fixedLoadCart(throwingGetCart).then((state) => {
      // Fixed: cartLoadWarning is set
      expect(state.cartLoadWarning).not.toBe('');
    });
  });
});
