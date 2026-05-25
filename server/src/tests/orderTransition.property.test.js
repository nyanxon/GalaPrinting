/**
 * orderTransition.property.test.js — Property-based tests for order status transitions.
 *
 * Feature: backend-integration
 * Property 3: Order status transition
 *
 * Requirements: 5.4, 5.5
 */

// Feature: backend-integration, Property 3: Order status transition

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
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

const ALL_ROLES = ['customer', 'admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'];

// Explicit allowed transitions per role (mirrors orders.service.js TRANSITIONS)
const ALLOWED = {
  cashier:     {
    'Waiting for Payment': ['Payment Accepted', 'Cancelled'],
    'Payment Accepted':    ['Cancelled'],
  },
  cs:          {
    'Payment Accepted':            ['Waiting for Design Approval'],
    'Waiting for Design Approval': ['Design Accepted'],
  },
  operational: { 'Design Accepted': ['On Progress'] },
  qc:          {
    'On Progress':      ['Quality Checking'],
    'Quality Checking': ['In Delivery'],
    'In Delivery':      ['Finished'],
  },
  admin: {
    'Waiting for Payment':         ['Payment Accepted', 'Cancelled'],
    'Payment Accepted':            ['Waiting for Design Approval', 'Cancelled'],
    'Waiting for Design Approval': ['Design Accepted', 'Cancelled'],
    'Design Accepted':             ['On Progress', 'Cancelled'],
    'On Progress':                 ['Quality Checking', 'Cancelled'],
    'Quality Checking':            ['In Delivery', 'Cancelled'],
    'In Delivery':                 ['Finished', 'Cancelled'],
  },
  owner: {
    'Waiting for Payment':         ['Cancelled'],
    'Payment Accepted':            ['Cancelled'],
    'Waiting for Design Approval': ['Cancelled'],
    'Design Accepted':             ['Cancelled'],
    'On Progress':                 ['Cancelled'],
    'Quality Checking':            ['Cancelled'],
    'In Delivery':                 ['Cancelled'],
  },
};

function isAllowed(role, fromStatus, toStatus) {
  const map = ALLOWED[role] || {};
  return (map[fromStatus] || []).includes(toStatus);
}

describe('Property 3: Order status transition', () => {
  it('getAllowedNextStatuses returns only permitted transitions for each role (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_ROLES),
        fc.constantFrom(...ALL_STATUSES),
        (role, currentStatus) => {
          const allowed = getAllowedNextStatuses(currentStatus, role);

          // Every returned status must be in the explicit allowed list
          for (const next of allowed) {
            expect(isAllowed(role, currentStatus, next)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invalid transitions are never in the allowed list (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_ROLES),
        fc.constantFrom(...ALL_STATUSES),
        fc.constantFrom(...ALL_STATUSES),
        (role, currentStatus, targetStatus) => {
          const allowed = getAllowedNextStatuses(currentStatus, role);
          const shouldBeAllowed = isAllowed(role, currentStatus, targetStatus);

          if (shouldBeAllowed) {
            expect(allowed).toContain(targetStatus);
          } else {
            expect(allowed).not.toContain(targetStatus);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('customer role has no allowed transitions (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('customer'),
        fc.constantFrom(...ALL_STATUSES),
        (role, currentStatus) => {
          const allowed = getAllowedNextStatuses(currentStatus, role);
          expect(allowed).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
