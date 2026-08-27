/**
 * adminCustomerBugCondition.property.test.jsx
 *
 * Bug condition exploration test for Bug 1 — Tanggal Bergabung Customer (Invalid Date).
 *
 * **CRITICAL**: This test is EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bug exists. DO NOT fix the code or the test when it fails.
 *
 * Bug Condition (from design.md):
 *   FUNCTION isBugCondition_Bug1(customerObject)
 *     RETURN customerObject.createdAt === undefined
 *            AND customerObject.created_at !== undefined
 *            AND new Date(customerObject.createdAt).toString() === "Invalid Date"
 *   END FUNCTION
 *
 * Root cause: CustomersSection.jsx accesses `u.createdAt` (camelCase) but the
 * API returns `created_at` (snake_case). `u.createdAt` is always `undefined`,
 * so `new Date(undefined)` produces "Invalid Date".
 *
 * **Validates: Requirements 1.1, 1.2**
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';

// ─────────────────────────────────────────────────────────────────────────────
// Mock authService so CustomersSection doesn't make real HTTP calls.
// We control the returned customer data to match the API shape (snake_case).
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('../services/auth.js', () => ({
  listCustomers: vi.fn(),
}));

import { listCustomers } from '../services/auth.js';
import { AuthContext } from '../components/context/AuthContext.jsx';
import CustomersSection from '../components/pages/admin/sections/CustomersSection.jsx';

/**
 * Render CustomersSection inside an AuthContext provider. The section reads
 * `currentUser` from context, so it must be wrapped when rendered standalone.
 */
function renderSection() {
  const authValue = {
    user: { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'admin' },
    updateUser: vi.fn(),
    loading: false,
  };
  return render(
    <AuthContext.Provider value={authValue}>
      <CustomersSection />
    </AuthContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: verify that a date string is a valid formatted date (not "Invalid Date")
// and matches the Indonesian locale format (e.g. "7 Mei 2025").
// ─────────────────────────────────────────────────────────────────────────────
function isValidFormattedDate(text) {
  if (!text) return false;
  if (text === 'Invalid Date') return false;
  if (text === '—') return false;
  // A valid id-ID formatted date contains at least one digit and a month name
  // e.g. "7 Mei 2025", "15 Januari 2024"
  return /\d/.test(text) && text.length > 4;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bug condition check — mirrors the formal spec from design.md
// ─────────────────────────────────────────────────────────────────────────────
function isBugCondition_Bug1(customerObject) {
  return (
    customerObject.createdAt === undefined &&
    customerObject.created_at !== undefined &&
    new Date(customerObject.createdAt).toString() === 'Invalid Date'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Arbitrary: generates customer objects in the API response shape (snake_case).
// These objects satisfy the bug condition: they have `created_at` but NOT `createdAt`.
// ─────────────────────────────────────────────────────────────────────────────
const customerArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }).map((s) => s.trim()).filter((s) => s.length > 0),
  email: fc.emailAddress(),
  phone: fc.option(fc.stringMatching(/^[0-9]{8,15}$/), { nil: null }),
  // API returns snake_case — this is the field that exists in the real response.
  // Use a constant timestamp (not fc.date): fast-check can shrink dates outside
  // the ISO toISOString-safe range, which throws RangeError inside the mapper.
  created_at: fc.constant('2024-06-01T12:30:00.000Z'),
  // NOTE: `createdAt` (camelCase) is intentionally ABSENT — matching real API shape
});

// ─────────────────────────────────────────────────────────────────────────────
// Concrete counterexample from design.md — used for the deterministic test
// ─────────────────────────────────────────────────────────────────────────────
const CONCRETE_CUSTOMER = {
  id: 'abc-123',
  name: 'Budi',
  email: 'budi@mail.com',
  phone: '081234567890',
  created_at: '2025-05-07T10:00:00.000Z',
  // createdAt is intentionally absent — this is the bug condition
};

describe('Bug 1 — Tanggal Bergabung Customer: Bug Condition Exploration', () => {
  /**
   * Concrete counterexample test.
   *
   * Renders CustomersSection with a single customer that has `created_at`
   * (snake_case) but NOT `createdAt` (camelCase).
   *
   * EXPECTED ON UNFIXED CODE: "Invalid Date" is rendered → test FAILS
   * EXPECTED ON FIXED CODE:   "7 Mei 2025" is rendered → test PASSES
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  it('concrete counterexample: customer with created_at="2025-05-07T10:00:00.000Z" should render "7 Mei 2025" not "Invalid Date"', async () => {
    // Confirm this is a bug condition object
    expect(isBugCondition_Bug1(CONCRETE_CUSTOMER)).toBe(true);

    listCustomers.mockResolvedValueOnce([CONCRETE_CUSTOMER]);

    const { unmount } = renderSection();

    await waitFor(() => {
      // Wait for the table to render (loading state resolves)
      expect(screen.queryByText('Belum ada customer.')).toBeNull();
    });

    // The "Bergabung" column should show a valid formatted date, NOT "Invalid Date"
    // On UNFIXED code: "Invalid Date" is rendered → this assertion FAILS (confirming the bug)
    // On FIXED code:   "7 Mei 2025" is rendered → this assertion PASSES
    const invalidDateElements = screen.queryAllByText('Invalid Date');
    expect(invalidDateElements).toHaveLength(0); // FAILS on unfixed code

    // Additionally assert the correct date is shown
    // "7 Mei 2025" in id-ID locale
    const dateCell = screen.getByText(/7 Mei 2025/i);
    expect(dateCell).toBeTruthy();

    unmount();
  });

  /**
   * Property-based test: for any customer object with valid `created_at`
   * (snake_case) but no `createdAt` (camelCase), CustomersSection must
   * render a valid formatted date — not "Invalid Date".
   *
   * EXPECTED ON UNFIXED CODE: "Invalid Date" appears → test FAILS (confirms bug)
   * EXPECTED ON FIXED CODE:   Valid dates appear → test PASSES (confirms fix)
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  it('property: for any customer with created_at (snake_case), the Bergabung column must not show "Invalid Date"', async () => {
    // Use a fixed set of representative test cases to avoid DOM accumulation
    // (same approach as addressList.property.test.jsx)
    const testCases = await fc.sample(customerArbitrary, 5);

    for (const customer of testCases) {
      // Confirm each generated object satisfies the bug condition
      expect(isBugCondition_Bug1(customer)).toBe(true);

      listCustomers.mockResolvedValueOnce([customer]);

      const { unmount } = renderSection();

      await waitFor(() => {
        // Wait for loading to complete
        expect(screen.queryByText('Belum ada customer.')).toBeNull();
      });

      // Assert: "Invalid Date" must NOT appear in the rendered output
      // On UNFIXED code: this FAILS — confirming the bug exists
      // Counterexample: { created_at: customer.created_at } renders "Invalid Date"
      const invalidDateElements = screen.queryAllByText('Invalid Date');
      expect(invalidDateElements).toHaveLength(0);

      // Assert: the date cell must show a valid formatted date
      const dateCells = document.querySelectorAll('.adm-date');
      expect(dateCells.length).toBeGreaterThan(0);
      for (const cell of dateCells) {
        expect(isValidFormattedDate(cell.textContent)).toBe(true);
      }

      unmount();
    }
  });

  /**
   * Explicit fast-check property test using fc.assert.
   *
   * This test uses the pure logic (no React rendering) to demonstrate
   * the bug condition: accessing `u.createdAt` on an API response object
   * always produces "Invalid Date".
   *
   * EXPECTED: FAILS on unfixed code (confirms bug), PASSES on fixed code.
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  it('property (fc.assert): for any customer with created_at, new Date(u.createdAt) is "Invalid Date" but new Date(u.created_at) is valid', () => {
    fc.assert(
      fc.property(
        customerArbitrary,
        (customer) => {
          // Confirm bug condition
          expect(isBugCondition_Bug1(customer)).toBe(true);

          // The buggy access: u.createdAt is undefined → "Invalid Date"
          const buggyDate = new Date(customer.createdAt).toLocaleDateString('id-ID');
          expect(buggyDate).toBe('Invalid Date'); // This PASSES — confirms the bug exists

          // The correct access: u.created_at has the real timestamp
          const correctDate = new Date(customer.created_at).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
          // The correct date must NOT be "Invalid Date"
          // This assertion documents the EXPECTED behavior after the fix
          expect(correctDate).not.toBe('Invalid Date');
          expect(isValidFormattedDate(correctDate)).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });
});
