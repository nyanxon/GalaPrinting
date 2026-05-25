// Feature: customer-profile-page, Property 7: address creation round-trip
// Feature: customer-profile-page, Property 8: address deletion removes entry

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import crypto from 'crypto';

/**
 * In-memory address store that mirrors addresses.service.js logic.
 */
function createAddressStore() {
  const addresses = new Map(); // id → address

  return {
    listAddresses(userId) {
      return [...addresses.values()]
        .filter((a) => a.user_id === userId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    },

    createAddress(userId, data) {
      const { title, name, phone, full_address } = data;

      // Validate required fields
      if (!title || String(title).trim().length === 0) {
        const err = new Error('Judul alamat wajib diisi.');
        err.status = 422;
        throw err;
      }
      if (!name || String(name).trim().length === 0) {
        const err = new Error('Nama wajib diisi.');
        err.status = 422;
        throw err;
      }
      if (!phone || String(phone).trim().length === 0) {
        const err = new Error('Nomor telepon wajib diisi.');
        err.status = 422;
        throw err;
      }
      if (!full_address || String(full_address).trim().length === 0) {
        const err = new Error('Alamat lengkap wajib diisi.');
        err.status = 422;
        throw err;
      }

      // Enforce 10-address limit
      const userAddresses = this.listAddresses(userId);
      if (userAddresses.length >= 10) {
        const err = new Error('Batas maksimal 10 alamat telah tercapai.');
        err.status = 422;
        throw err;
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const address = {
        id,
        user_id: userId,
        title: title.trim(),
        name: name.trim(),
        phone: phone.trim(),
        full_address: full_address.trim(),
        created_at: now,
        updated_at: now,
      };
      addresses.set(id, address);
      return { ...address };
    },

    deleteAddress(userId, addressId) {
      const address = addresses.get(addressId);
      if (!address) {
        const err = new Error('Alamat tidak ditemukan.');
        err.status = 404;
        throw err;
      }
      if (address.user_id !== userId) {
        const err = new Error('Akses ditolak.');
        err.status = 403;
        throw err;
      }
      addresses.delete(addressId);
    },
  };
}

/**
 * Arbitrary for a valid address payload.
 */
const validAddressArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }).map((s) => s.trim()).filter((s) => s.length > 0),
  name: fc.string({ minLength: 1, maxLength: 120 }).map((s) => s.trim()).filter((s) => s.length > 0),
  phone: fc.stringMatching(/^[0-9]{8,15}$/),
  full_address: fc.string({ minLength: 1, maxLength: 500 }).map((s) => s.trim()).filter((s) => s.length > 0),
});

// ── Property 7: Address creation round-trip ───────────────────────────────────

describe('Property 7: Address creation round-trip', () => {
  /**
   * For any valid address payload, calling createAddress and then
   * listAddresses should return a list that contains an entry matching
   * the submitted data.
   *
   * Validates: Requirements 5.3
   */
  it('created address appears in listAddresses (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // userId
        validAddressArb,
        (userId, addressData) => {
          const store = createAddressStore();

          const created = store.createAddress(userId, addressData);
          const list = store.listAddresses(userId);

          // The created address must appear in the list
          const found = list.find((a) => a.id === created.id);
          expect(found).toBeDefined();

          // The found entry must match the submitted data
          expect(found.title).toBe(addressData.title.trim());
          expect(found.name).toBe(addressData.name.trim());
          expect(found.phone).toBe(addressData.phone.trim());
          expect(found.full_address).toBe(addressData.full_address.trim());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Creating multiple addresses for the same user accumulates them all.
   *
   * Validates: Requirements 5.3
   */
  it('multiple creates accumulate in the list (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(validAddressArb, { minLength: 1, maxLength: 5 }),
        (userId, addressDataList) => {
          const store = createAddressStore();

          for (const data of addressDataList) {
            store.createAddress(userId, data);
          }

          const list = store.listAddresses(userId);
          expect(list.length).toBe(addressDataList.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Creating more than 10 addresses throws a 422 error.
   *
   * Validates: Requirements 5.8
   */
  it('enforces 10-address limit', () => {
    const store = createAddressStore();
    const userId = crypto.randomUUID();
    const data = { title: 'Test', name: 'Test', phone: '08123456789', full_address: 'Test Address' };

    for (let i = 0; i < 10; i++) {
      store.createAddress(userId, { ...data, title: `Alamat ${i + 1}` });
    }

    let err = null;
    try {
      store.createAddress(userId, data);
    } catch (e) {
      err = e;
    }

    expect(err).not.toBeNull();
    expect(err.status).toBe(422);
    expect(err.message).toBe('Batas maksimal 10 alamat telah tercapai.');
  });
});

// ── Property 8: Address deletion removes entry ────────────────────────────────

describe('Property 8: Address deletion removes entry', () => {
  /**
   * For any address that exists in the store, calling deleteAddress with
   * its ID and then listAddresses should return a list that does NOT
   * contain that address.
   *
   * Validates: Requirements 5.11
   */
  it('deleted address is absent from listAddresses (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // userId
        validAddressArb,
        (userId, addressData) => {
          const store = createAddressStore();

          const created = store.createAddress(userId, addressData);

          // Verify it exists before deletion
          const beforeDelete = store.listAddresses(userId);
          expect(beforeDelete.some((a) => a.id === created.id)).toBe(true);

          // Delete it
          store.deleteAddress(userId, created.id);

          // Verify it's gone
          const afterDelete = store.listAddresses(userId);
          expect(afterDelete.some((a) => a.id === created.id)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Deleting an address belonging to another user throws 403.
   *
   * Validates: Requirements 9.3
   */
  it('cross-user deletion throws 403 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // ownerUserId
        fc.uuid(), // attackerUserId
        validAddressArb,
        (ownerUserId, attackerUserId, addressData) => {
          fc.pre(ownerUserId !== attackerUserId);

          const store = createAddressStore();
          const created = store.createAddress(ownerUserId, addressData);

          let err = null;
          try {
            store.deleteAddress(attackerUserId, created.id);
          } catch (e) {
            err = e;
          }

          expect(err).not.toBeNull();
          expect(err.status).toBe(403);

          // Address should still exist
          const list = store.listAddresses(ownerUserId);
          expect(list.some((a) => a.id === created.id)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
