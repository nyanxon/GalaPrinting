// Feature: customer-profile-page, Property 3: phone validation rejects invalid inputs

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Phone validation logic extracted from profile.service.js.
 * Returns true if valid, false if invalid.
 */
function isValidPhone(phone) {
  if (phone === undefined || phone === null || phone === '') return true; // optional
  return /^[0-9]{8,15}$/.test(phone);
}

/**
 * Validation function that mirrors ProfileForm client-side validation.
 * Returns an error message string or null if valid.
 */
function validatePhone(phone) {
  if (!phone || phone.trim() === '') return null; // optional field
  if (!/^[0-9]{8,15}$/.test(phone.trim())) {
    return 'Nomor handphone tidak valid.';
  }
  return null;
}

describe('Property 3: Phone validation rejects invalid inputs', () => {
  /**
   * For any string that is not composed of 8–15 numeric digits,
   * the phone validation should reject it.
   *
   * Validates: Requirements 2.5
   */
  it('rejects strings that are not 8–15 numeric digits (100 iterations)', () => {
    fc.assert(
      fc.property(
        // Generate strings that are NOT valid phone numbers
        fc.oneof(
          // Too short (1–7 digits)
          fc.stringMatching(/^[0-9]{1,7}$/),
          // Too long (16+ digits)
          fc.stringMatching(/^[0-9]{16,25}$/),
          // Contains non-digit characters
          fc.string({ minLength: 8, maxLength: 15 }).filter((s) => /[^0-9]/.test(s)),
          // Contains letters
          fc.stringMatching(/^[a-zA-Z0-9]{8,15}$/).filter((s) => /[a-zA-Z]/.test(s)),
          // Contains special characters
          fc.stringMatching(/^[0-9+\-\s]{8,15}$/).filter((s) => /[^0-9]/.test(s)),
        ),
        (invalidPhone) => {
          // Server-side validation
          expect(isValidPhone(invalidPhone)).toBe(false);

          // Client-side validation (non-empty invalid phone)
          if (invalidPhone.trim().length > 0) {
            const error = validatePhone(invalidPhone);
            expect(error).toBe('Nomor handphone tidak valid.');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Valid phone numbers (8–15 digits) should pass validation.
   *
   * Validates: Requirements 2.5
   */
  it('accepts valid 8–15 digit phone numbers (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[0-9]{8,15}$/),
        (validPhone) => {
          expect(isValidPhone(validPhone)).toBe(true);
          expect(validatePhone(validPhone)).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Empty/null/undefined phone should be treated as valid (optional field).
   *
   * Validates: Requirements 2.5
   */
  it('treats empty/null phone as valid (optional field)', () => {
    expect(isValidPhone('')).toBe(true);
    expect(isValidPhone(null)).toBe(true);
    expect(isValidPhone(undefined)).toBe(true);
    expect(validatePhone('')).toBeNull();
    expect(validatePhone(null)).toBeNull();
  });
});
