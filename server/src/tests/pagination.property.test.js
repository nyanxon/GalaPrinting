/**
 * pagination.property.test.js — Property-based tests for pagination correctness.
 *
 * Feature: backend-integration
 * Property 7: Pagination correctness
 *
 * Requirements: 6.9
 */

// Feature: backend-integration, Property 7: Pagination correctness

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Inline pagination logic that mirrors products.service.js listProducts().
 * We test the pure pagination math without a real DB.
 */
function paginate(allItems, page, limit) {
  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const offset   = (pageNum - 1) * limitNum;
  const items    = allItems.slice(offset, offset + limitNum);
  const total    = allItems.length;

  return {
    items,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
}

describe('Property 7: Pagination correctness', () => {
  it('items.length is always ≤ limit for any page/limit combination (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 0, maxLength: 200 }), // dataset
        fc.integer({ min: 1, max: 50 }),  // page
        fc.integer({ min: 1, max: 100 }), // limit
        (dataset, page, limit) => {
          const result = paginate(dataset, page, limit);

          // Core property: items returned never exceed the requested limit
          expect(result.items.length).toBeLessThanOrEqual(result.limit);

          // Response shape is correct
          expect(typeof result.total).toBe('number');
          expect(typeof result.page).toBe('number');
          expect(typeof result.limit).toBe('number');
          expect(typeof result.totalPages).toBe('number');
          expect(result.page).toBeGreaterThanOrEqual(1);
          expect(result.limit).toBeGreaterThanOrEqual(1);
          expect(result.totalPages).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('totalPages is always ceil(total / limit) (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 0, maxLength: 200 }),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 100 }),
        (dataset, page, limit) => {
          const result = paginate(dataset, page, limit);
          expect(result.totalPages).toBe(Math.ceil(result.total / result.limit));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('items on last page may be fewer than limit but never more (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 1, maxLength: 200 }),
        fc.integer({ min: 1, max: 100 }),
        (dataset, limit) => {
          const clampedLimit = Math.min(100, Math.max(1, limit));
          const lastPage = Math.ceil(dataset.length / clampedLimit);
          const lastResult = paginate(dataset, lastPage, limit);
          expect(lastResult.items.length).toBeLessThanOrEqual(lastResult.limit);
        }
      ),
      { numRuns: 100 }
    );
  });
});
