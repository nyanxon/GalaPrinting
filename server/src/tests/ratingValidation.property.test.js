/**
 * ratingValidation.property.test.js — Property-based tests for review rating validation.
 *
 * Feature: backend-integration
 * Property 8: Rating validation
 *
 * Requirements: 10.3
 */

// Feature: backend-integration, Property 8: Rating validation

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Simulates the rating validation logic from reviews.service.js.
 */
function validateRating(rating) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { status: 422, ok: false, message: 'Rating harus antara 1 dan 5.' };
  }
  return { status: 200, ok: true };
}

describe('Property 8: Rating validation', () => {
  it('ratings below 1 always return 422 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 0 }),
        (rating) => {
          const result = validateRating(rating);
          expect(result.status).toBe(422);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ratings above 5 always return 422 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 6, max: 1000 }),
        (rating) => {
          const result = validateRating(rating);
          expect(result.status).toBe(422);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('non-integer values always return 422 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.float({ min: Math.fround(1.1), max: Math.fround(4.9), noNaN: true }).filter((n) => !Number.isInteger(n)),
          fc.string({ minLength: 1, maxLength: 5 }),
          fc.constant(null),
          fc.constant(undefined),
          fc.constant(NaN),
        ),
        (rating) => {
          const result = validateRating(rating);
          expect(result.status).toBe(422);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('valid ratings 1–5 are always accepted (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (rating) => {
          const result = validateRating(rating);
          expect(result.status).toBe(200);
          expect(result.ok).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
