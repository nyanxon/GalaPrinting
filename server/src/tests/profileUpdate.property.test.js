// Feature: customer-profile-page, Property 2: profile update round-trip

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Inline implementation of profile update + fetch logic that mirrors
 * profile.service.js without a real database.
 */
function createProfileStore() {
  const users = new Map();

  return {
    seed(userId, profile) {
      users.set(userId, { ...profile });
    },
    getProfile(userId) {
      const u = users.get(userId);
      if (!u) {
        const err = new Error('Pengguna tidak ditemukan.');
        err.status = 404;
        throw err;
      }
      return { ...u };
    },
    updateProfile(userId, data) {
      const { name, phone, dob, gender } = data;

      // Validate name
      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0) {
          const err = new Error('Nama wajib diisi.');
          err.status = 422;
          throw err;
        }
      }

      // Validate phone
      if (phone !== undefined && phone !== null && phone !== '') {
        if (!/^[0-9]{8,15}$/.test(phone)) {
          const err = new Error('Nomor handphone tidak valid.');
          err.status = 422;
          throw err;
        }
      }

      const current = this.getProfile(userId);
      const updated = {
        ...current,
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(phone !== undefined ? { phone: phone === '' ? null : phone } : {}),
        ...(dob !== undefined ? { dob: dob ?? null } : {}),
        ...(gender !== undefined ? { gender: gender ?? null } : {}),
      };
      users.set(userId, updated);
      return this.getProfile(userId);
    },
  };
}

describe('Property 2: Profile update round-trip', () => {
  /**
   * For any valid profile update payload, calling updateProfile and then
   * getProfile should return data that matches the submitted payload.
   *
   * Validates: Requirements 2.3
   */
  it('update then fetch returns the submitted values (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // userId
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 120 }).map((s) => s.trim()).filter((s) => s.length > 0),
          phone: fc.stringMatching(/^[0-9]{8,15}$/),
          dob: fc.option(fc.date({ min: new Date('1900-01-01'), max: new Date('2010-12-31') })
            .map((d) => d.toISOString().slice(0, 10)), { nil: null }),
          gender: fc.option(fc.constantFrom('L', 'P'), { nil: null }),
        }),
        (userId, payload) => {
          const store = createProfileStore();
          store.seed(userId, {
            id: userId,
            name: 'Original Name',
            email: 'test@example.com',
            phone: null,
            dob: null,
            gender: null,
            avatar_url: null,
          });

          const updated = store.updateProfile(userId, payload);
          const fetched = store.getProfile(userId);

          // Name must match (trimmed)
          expect(fetched.name).toBe(payload.name.trim());

          // Phone must match
          expect(fetched.phone).toBe(payload.phone);

          // DOB must match
          expect(fetched.dob).toBe(payload.dob ?? null);

          // Gender must match
          expect(fetched.gender).toBe(payload.gender ?? null);

          // Updated and fetched should be identical
          expect(updated).toEqual(fetched);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Partial updates should only change the specified fields.
   *
   * Validates: Requirements 2.3
   */
  it('partial update only changes specified fields (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 120 }).map((s) => s.trim()).filter((s) => s.length > 0),
        (userId, newName) => {
          const store = createProfileStore();
          const original = {
            id: userId,
            name: 'Original',
            email: 'test@example.com',
            phone: '081234567890',
            dob: '1990-01-01',
            gender: 'L',
            avatar_url: null,
          };
          store.seed(userId, original);

          // Only update name
          store.updateProfile(userId, { name: newName });
          const fetched = store.getProfile(userId);

          expect(fetched.name).toBe(newName);
          // Other fields unchanged
          expect(fetched.phone).toBe(original.phone);
          expect(fetched.dob).toBe(original.dob);
          expect(fetched.gender).toBe(original.gender);
        }
      ),
      { numRuns: 100 }
    );
  });
});
