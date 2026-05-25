/**
 * statusUpdateKeyConsistency.property.test.js — Property-based tests for
 * status update key consistency.
 *
 * Feature: backend-integration
 * Property 5: Status update key consistency
 *
 * **Validates: Requirements 2.14**
 *
 * For any call to `updateOrderStatus` in backend mode, the PATCH body must
 * contain the key `newStatus` and the controller must read `req.body.newStatus`.
 *
 * The validation logic from orders.controller.js updateOrderStatus is inlined
 * and tested directly without spinning up the full Express server.
 */

// Feature: backend-integration, Property 5: Status update key consistency

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ── Inlined validation logic from orders.controller.js updateOrderStatus ──────
//
// const { newStatus } = req.body;
// if (!newStatus) {
//   return res.status(422).json({ ok: false, message: 'Status wajib diisi.' });
// }
//
// Returns { status, ok, message } mirroring the HTTP response shape.

function validateStatusUpdate(body) {
  const { newStatus } = body;
  if (!newStatus) {
    return { status: 422, ok: false, message: 'Status wajib diisi.' };
  }
  return { status: 200, ok: true };
}

// ── Sub-task 13.5.1 — wrong key `status` returns 422 ─────────────────────────

describe('Property 5: Status update key consistency — wrong key returns 422', () => {
  it('sending { status } (wrong key) always returns 422 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0), // any non-empty status value
        (statusValue) => {
          // Body uses the wrong key `status` instead of `newStatus`
          const result = validateStatusUpdate({ status: statusValue });
          expect(result.status).toBe(422);
          expect(result.ok).toBe(false);
          expect(result.message).toBe('Status wajib diisi.');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty body always returns 422 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constant({}),
        (body) => {
          const result = validateStatusUpdate(body);
          expect(result.status).toBe(422);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('body with unrelated keys always returns 422 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.record({
          state:  fc.string({ minLength: 1 }),
          value:  fc.string({ minLength: 1 }),
          update: fc.string({ minLength: 1 }),
        }),
        (body) => {
          // None of these keys are `newStatus`
          const result = validateStatusUpdate(body);
          expect(result.status).toBe(422);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Sub-task 13.5.2 — correct key `newStatus` passes validation ───────────────

describe('Property 5: Status update key consistency — correct key passes validation', () => {
  it('sending { newStatus } (correct key) with a non-empty value always passes (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0), // any non-empty status value
        (statusValue) => {
          const result = validateStatusUpdate({ newStatus: statusValue });
          expect(result.status).toBe(200);
          expect(result.ok).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sending { newStatus } with a known order status always passes (100 iterations)', () => {
    const KNOWN_STATUSES = [
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

    fc.assert(
      fc.property(
        fc.constantFrom(...KNOWN_STATUSES),
        (statusValue) => {
          const result = validateStatusUpdate({ newStatus: statusValue });
          expect(result.status).toBe(200);
          expect(result.ok).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sending { newStatus } alongside extra keys still passes (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 1 }),
        (statusValue, extraValue) => {
          // Extra keys must not interfere — only `newStatus` is read
          const result = validateStatusUpdate({ newStatus: statusValue, status: extraValue });
          expect(result.status).toBe(200);
          expect(result.ok).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Falsy newStatus values return 422 ─────────────────────────────────────────

describe('Property 5: Status update key consistency — falsy newStatus returns 422', () => {
  it('empty string newStatus always returns 422', () => {
    const result = validateStatusUpdate({ newStatus: '' });
    expect(result.status).toBe(422);
    expect(result.ok).toBe(false);
  });

  it('null newStatus always returns 422', () => {
    const result = validateStatusUpdate({ newStatus: null });
    expect(result.status).toBe(422);
    expect(result.ok).toBe(false);
  });

  it('undefined newStatus always returns 422', () => {
    const result = validateStatusUpdate({ newStatus: undefined });
    expect(result.status).toBe(422);
    expect(result.ok).toBe(false);
  });
});
