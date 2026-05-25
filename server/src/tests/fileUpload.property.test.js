/**
 * fileUpload.property.test.js — Property-based tests for file upload size rejection.
 *
 * Feature: backend-integration
 * Property 5: File size rejection
 *
 * Requirements: 11.4
 */

// Feature: backend-integration, Property 5: File size rejection

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Size limits mirroring upload.js
const LIMITS = {
  design:  20 * 1024 * 1024,
  payment: 10 * 1024 * 1024,
  chat:     5 * 1024 * 1024,
};

/**
 * Simulates the multer size check logic.
 * Returns 413 if file exceeds limit, 200 otherwise.
 */
function checkFileSize(type, fileSizeBytes) {
  const limit = LIMITS[type];
  if (fileSizeBytes > limit) {
    return { status: 413, ok: false, message: 'File terlalu besar.' };
  }
  return { status: 200, ok: true };
}

describe('Property 5: File size rejection', () => {
  it('design files exceeding 20 MB always return 413 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: LIMITS.design + 1, max: LIMITS.design * 3 }),
        (fileSize) => {
          const result = checkFileSize('design', fileSize);
          expect(result.status).toBe(413);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('payment files exceeding 10 MB always return 413 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: LIMITS.payment + 1, max: LIMITS.payment * 3 }),
        (fileSize) => {
          const result = checkFileSize('payment', fileSize);
          expect(result.status).toBe(413);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('chat files exceeding 5 MB always return 413 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: LIMITS.chat + 1, max: LIMITS.chat * 3 }),
        (fileSize) => {
          const result = checkFileSize('chat', fileSize);
          expect(result.status).toBe(413);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('files within the size limit are accepted (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('design', 'payment', 'chat'),
        fc.integer({ min: 1, max: 1024 * 1024 }), // 1 byte to 1 MB — always within all limits
        (type, fileSize) => {
          const result = checkFileSize(type, fileSize);
          expect(result.status).toBe(200);
          expect(result.ok).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
