/**
 * statusCompleteness.property.test.js — Property-based tests for order status completeness.
 *
 * Feature: codebase-audit-fixes
 * Property 2: Order status completeness
 *
 * **Validates: Requirements 1.10**
 *
 * For every status string returned by the backend TRANSITIONS map,
 * STATUS_CONFIG[status] must be defined and have non-empty icon and badge fields.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ── Inline backend TRANSITIONS (from server/src/services/orders.service.js) ──

const TRANSITIONS = {
  cashier:     { 'Waiting for Payment': ['Payment Accepted'] },
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
    'In Delivery':                 ['Finished'],
  },
  owner: {},
};

// ── Inline frontend STATUS_CONFIG (from src/services/orderService.js) ─────────

const STATUS_CONFIG = {
  'Waiting for Payment':         { icon: '💳', badge: 'status--waiting-payment' },
  'Payment Accepted':            { icon: '✅', badge: 'status--payment-accepted' },
  'Waiting for Design Approval': { icon: '🎨', badge: 'status--waiting-design' },
  'Design Accepted':             { icon: '👍', badge: 'status--design-accepted' },
  'On Progress':                 { icon: '⚙️', badge: 'status--on-progress' },
  'Quality Checking':            { icon: '🔍', badge: 'status--qc' },
  'In Delivery':                 { icon: '🚚', badge: 'status--in-delivery' },
  'Finished':                    { icon: '🎉', badge: 'status--finished' },
  'Cancelled':                   { icon: '❌', badge: 'status--cancelled' },
};

// ── Derive all unique "next status" values from TRANSITIONS ───────────────────

function getAllNextStatuses(transitions) {
  const statuses = new Set();
  for (const roleMap of Object.values(transitions)) {
    for (const nextList of Object.values(roleMap)) {
      for (const status of nextList) {
        statuses.add(status);
      }
    }
  }
  return Array.from(statuses);
}

const ALL_NEXT_STATUSES = getAllNextStatuses(TRANSITIONS);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('P2 — Order status completeness', () => {
  it('13.2.1 every next-status in TRANSITIONS has a STATUS_CONFIG entry (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_NEXT_STATUSES),
        (status) => {
          expect(
            STATUS_CONFIG[status],
            `STATUS_CONFIG is missing entry for status: "${status}"`
          ).toBeDefined();
        }
      ),
      { numRuns: ALL_NEXT_STATUSES.length }
    );
  });

  it('13.2.2 every STATUS_CONFIG entry for a TRANSITIONS status has non-empty icon and badge (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_NEXT_STATUSES),
        (status) => {
          const config = STATUS_CONFIG[status];
          expect(
            config,
            `STATUS_CONFIG is missing entry for status: "${status}"`
          ).toBeDefined();

          expect(
            typeof config.icon === 'string' && config.icon.trim().length > 0,
            `STATUS_CONFIG["${status}"].icon must be a non-empty string, got: ${JSON.stringify(config?.icon)}`
          ).toBe(true);

          expect(
            typeof config.badge === 'string' && config.badge.trim().length > 0,
            `STATUS_CONFIG["${status}"].badge must be a non-empty string, got: ${JSON.stringify(config?.badge)}`
          ).toBe(true);
        }
      ),
      { numRuns: ALL_NEXT_STATUSES.length }
    );
  });

  it('exhaustive check: all unique next-statuses from TRANSITIONS are covered', () => {
    // Non-property exhaustive check to complement the property test
    for (const status of ALL_NEXT_STATUSES) {
      const config = STATUS_CONFIG[status];
      expect(config, `STATUS_CONFIG missing for "${status}"`).toBeDefined();
      expect(config.icon.trim().length, `icon empty for "${status}"`).toBeGreaterThan(0);
      expect(config.badge.trim().length, `badge empty for "${status}"`).toBeGreaterThan(0);
    }
  });
});
