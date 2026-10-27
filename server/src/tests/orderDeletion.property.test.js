/**
 * orderDeletion.property.test.js — Property-based tests for order deletion rules.
 *
 * Rules:
 *   - admin (Super Admin) may delete an order from any status/source
 *   - cashier may delete only when the order is 'Waiting for Payment'
 *   - cs may delete only custom orders that have not been processed
 */

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

vi.hoisted(() => {
  Object.assign(process.env, {
    DB_HOST: '127.0.0.1',
    DB_NAME: 'gala_test',
    DB_USER: 'root',
    DB_PASSWORD: '',
    JWT_ACCESS_SECRET: 'test-access',
    JWT_REFRESH_SECRET: 'test-refresh',
  });
});

vi.mock('../db/connection.js', () => ({
  query: vi.fn(),
  pool: { getConnection: vi.fn() },
}));

const { getOrderDeletePermission } = await import('../services/orders.service.js');

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

const CS_CUSTOM_DELETABLE_STATUSES = [
  'Waiting for Design Approval',
  'Design Accepted',
  'Waiting for Payment',
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

  it('cs may delete only custom orders in the D3 status allowlist', () => {
    fc.assert(
      fc.property(orderArb, (order) => {
        const result = getOrderDeletePermission(order, 'cs');
        const expectedAllowed =
          order.order_type === 'custom' && CS_CUSTOM_DELETABLE_STATUSES.includes(order.status);
        expect(result.allowed).toBe(expectedAllowed);
        if (!expectedAllowed) expect(result.status).toBe(403);
      })
    );
  });

  it('cs is denied with 403 for non-custom orders', () => {
    fc.assert(
      fc.property(orderArb, (order) => {
        if (order.order_type === 'custom') return;
        const result = getOrderDeletePermission(order, 'cs');
        expect(result.allowed).toBe(false);
        expect(result.status).toBe(403);
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
