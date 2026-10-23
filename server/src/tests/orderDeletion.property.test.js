/**
 * orderDeletion.property.test.js — Property-based tests for order deletion rules.
 *
 * Rules:
 *   - admin (Super Admin) may delete an order from any status/source
 *   - cashier may delete only when the order is 'Waiting for Payment'
 *   - cs may delete only custom orders that have not been processed
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getOrderDeletePermission } from '../services/orders.service.js';

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

const ALL_SOURCES = ['online', 'offline', 'custom'];
const ALL_ORDER_TYPES = ['standard', 'custom'];

const CS_BLOCKED_STATUSES = [
  'Payment Accepted',
  'Waiting for Design Approval',
  'On Progress',
  'Ready to Ship',
  'Shipped',
  'Completed',
];

const orderArb = fc.record({
  status: fc.constantFrom(...ALL_STATUSES),
  source: fc.constantFrom(...ALL_SOURCES),
  order_type: fc.constantFrom(...ALL_ORDER_TYPES),
});

describe('Order deletion permissions', () => {
  it('admin can always delete any order', () => {
    fc.assert(
      fc.property(orderArb, (order) => {
        expect(getOrderDeletePermission(order, 'admin').allowed).toBe(true);
      })
    );
  });

  it('cashier can delete only Waiting for Payment orders', () => {
    fc.assert(
      fc.property(orderArb, (order) => {
        const result = getOrderDeletePermission(order, 'cashier');
        if (order.status === 'Waiting for Payment') {
          expect(result.allowed).toBe(true);
        } else {
          expect(result.allowed).toBe(false);
          expect(result.status).toBe(403);
        }
      })
    );
  });

  it('cs follows the legacy custom-order rules', () => {
    fc.assert(
      fc.property(orderArb, (order) => {
        const result = getOrderDeletePermission(order, 'cs');
        const expectedAllowed =
          order.order_type === 'custom' && !CS_BLOCKED_STATUSES.includes(order.status);
        expect(result.allowed).toBe(expectedAllowed);
      })
    );
  });

  it('all other roles are denied', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('owner', 'operational', 'qc', 'offline', 'customer'),
        orderArb,
        (role, order) => {
          const result = getOrderDeletePermission(order, role);
          expect(result.allowed).toBe(false);
          expect(result.status).toBe(403);
        }
      )
    );
  });
});
