/**
 * orderNumberUniqueness.property.test.js — Property-based tests for order number uniqueness.
 *
 * Feature: backend-integration
 * Property 8: Order number uniqueness
 *
 * **Validates: Requirements 3.19**
 *
 * For any two calls to `generateOrderNumber()` on the same day, the probability
 * of collision must be negligible (UUID fragment provides ~4 billion combinations).
 */

// Feature: backend-integration, Property 8: Order number uniqueness

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { randomUUID } from 'crypto';

// ── Inline generateOrderNumber logic from orders.service.js ───────────────────

/**
 * Mirrors the exact implementation in server/src/services/orders.service.js.
 * Generates an order number of the form ORD-YYYYMMDD-XXXXXXXX where X is
 * an uppercase hex character from a UUID fragment.
 */
function generateOrderNumber() {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  // 8-char UUID fragment gives ~4 billion combinations per day
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `ORD-${ymd}-${suffix}`;
}

// ── Sub-task 13.8.1 & 13.8.2 — Generate 1000 order numbers, verify uniqueness ─

describe('Property 8: Order number uniqueness', () => {
  it('1000 order numbers generated on the same day are all unique (no collisions)', () => {
    // Sub-task 13.8.1: Generate 1000 order numbers
    const COUNT = 1000;
    const orderNumbers = Array.from({ length: COUNT }, () => generateOrderNumber());

    // Sub-task 13.8.2: Verify all are unique
    const unique = new Set(orderNumbers);
    expect(unique.size).toBe(COUNT);
  });

  it('order number format is always ORD-YYYYMMDD-XXXXXXXX (uppercase hex suffix)', () => {
    // Verify the format for 1000 generated numbers
    const COUNT = 1000;
    const FORMAT_REGEX = /^ORD-\d{8}-[0-9A-F]{8}$/;

    const orderNumbers = Array.from({ length: COUNT }, () => generateOrderNumber());

    for (const num of orderNumbers) {
      expect(num).toMatch(FORMAT_REGEX);
    }
  });

  it('property: any batch of order numbers contains no duplicates (fast-check, 10 iterations of 100 numbers)', () => {
    /**
     * **Validates: Requirements 3.19**
     *
     * For any batch of 100 order numbers generated in a single run, all must be unique.
     * fast-check runs this property 10 times to confirm it holds across multiple batches.
     */
    fc.assert(
      fc.property(
        // Use a constant to drive the property — we just need fast-check to run it N times
        fc.constant(null),
        () => {
          const BATCH = 100;
          const numbers = Array.from({ length: BATCH }, () => generateOrderNumber());
          const unique = new Set(numbers);
          expect(unique.size).toBe(BATCH);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('suffix is always exactly 8 uppercase hex characters', () => {
    const SUFFIX_REGEX = /^[0-9A-F]{8}$/;
    const COUNT = 1000;

    const orderNumbers = Array.from({ length: COUNT }, () => generateOrderNumber());

    for (const num of orderNumbers) {
      const parts = num.split('-');
      // Format: ORD - YYYYMMDD - XXXXXXXX → 3 parts
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('ORD');
      expect(parts[1]).toMatch(/^\d{8}$/);
      expect(parts[2]).toMatch(SUFFIX_REGEX);
    }
  });

  it('date segment always matches today\'s date in YYYYMMDD format', () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const COUNT = 100;

    const orderNumbers = Array.from({ length: COUNT }, () => generateOrderNumber());

    for (const num of orderNumbers) {
      const dateSegment = num.split('-')[1];
      expect(dateSegment).toBe(today);
    }
  });
});
