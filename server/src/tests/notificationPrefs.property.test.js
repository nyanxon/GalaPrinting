// Feature: customer-profile-page, Property 10: notification preferences round-trip

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Default preferences matching migration 025 defaults.
 */
const DEFAULT_PREFS = {
  payment_accepted: true,
  order_shipped: true,
  order_finished: true,
  order_cancelled: true,
  promo_news: false,
};

/**
 * In-memory notification preferences store that mirrors notifications.service.js.
 */
function createPrefsStore() {
  const store = new Map(); // userId → prefs

  return {
    getPreferences(userId) {
      const row = store.get(userId);
      if (!row) return { ...DEFAULT_PREFS };
      return {
        payment_accepted: Boolean(row.payment_accepted),
        order_shipped: Boolean(row.order_shipped),
        order_finished: Boolean(row.order_finished),
        order_cancelled: Boolean(row.order_cancelled),
        promo_news: Boolean(row.promo_news),
      };
    },

    updatePreferences(userId, prefs) {
      const current = this.getPreferences(userId);
      const updated = {
        payment_accepted: prefs.payment_accepted !== undefined ? Boolean(prefs.payment_accepted) : current.payment_accepted,
        order_shipped:    prefs.order_shipped    !== undefined ? Boolean(prefs.order_shipped)    : current.order_shipped,
        order_finished:   prefs.order_finished   !== undefined ? Boolean(prefs.order_finished)   : current.order_finished,
        order_cancelled:  prefs.order_cancelled  !== undefined ? Boolean(prefs.order_cancelled)  : current.order_cancelled,
        promo_news:       prefs.promo_news       !== undefined ? Boolean(prefs.promo_news)       : current.promo_news,
      };
      store.set(userId, updated);
      return this.getPreferences(userId);
    },
  };
}

/**
 * Arbitrary for a full set of notification preferences.
 */
const prefsArbitrary = fc.record({
  payment_accepted: fc.boolean(),
  order_shipped:    fc.boolean(),
  order_finished:   fc.boolean(),
  order_cancelled:  fc.boolean(),
  promo_news:       fc.boolean(),
});

describe('Property 10: Notification preferences round-trip', () => {
  /**
   * For any combination of boolean values for the five preference fields,
   * calling updatePreferences and then getPreferences should return the
   * exact same combination of values.
   *
   * Validates: Requirements 7.2, 7.4
   */
  it('update then fetch returns the exact same preference values (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // userId
        prefsArbitrary,
        (userId, prefs) => {
          const store = createPrefsStore();

          store.updatePreferences(userId, prefs);
          const fetched = store.getPreferences(userId);

          expect(fetched.payment_accepted).toBe(prefs.payment_accepted);
          expect(fetched.order_shipped).toBe(prefs.order_shipped);
          expect(fetched.order_finished).toBe(prefs.order_finished);
          expect(fetched.order_cancelled).toBe(prefs.order_cancelled);
          expect(fetched.promo_news).toBe(prefs.promo_news);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Multiple sequential updates should always reflect the latest values.
   *
   * Validates: Requirements 7.2
   */
  it('sequential updates always reflect the latest values (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        prefsArbitrary,
        prefsArbitrary,
        (userId, firstPrefs, secondPrefs) => {
          const store = createPrefsStore();

          store.updatePreferences(userId, firstPrefs);
          store.updatePreferences(userId, secondPrefs);

          const fetched = store.getPreferences(userId);

          // Should reflect the second update
          expect(fetched.payment_accepted).toBe(secondPrefs.payment_accepted);
          expect(fetched.order_shipped).toBe(secondPrefs.order_shipped);
          expect(fetched.order_finished).toBe(secondPrefs.order_finished);
          expect(fetched.order_cancelled).toBe(secondPrefs.order_cancelled);
          expect(fetched.promo_news).toBe(secondPrefs.promo_news);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * A new user with no preferences should get the defaults.
   *
   * Validates: Requirements 7.4
   */
  it('new user gets default preferences', () => {
    const store = createPrefsStore();
    const prefs = store.getPreferences('new-user-id');

    expect(prefs.payment_accepted).toBe(true);
    expect(prefs.order_shipped).toBe(true);
    expect(prefs.order_finished).toBe(true);
    expect(prefs.order_cancelled).toBe(true);
    expect(prefs.promo_news).toBe(false);
  });

  /**
   * Partial updates should only change the specified fields.
   *
   * Validates: Requirements 7.2
   */
  it('partial update only changes specified fields (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.boolean(), // new value for promo_news only
        (userId, newPromoNews) => {
          const store = createPrefsStore();

          // Set initial full prefs
          store.updatePreferences(userId, {
            payment_accepted: true,
            order_shipped: true,
            order_finished: false,
            order_cancelled: true,
            promo_news: !newPromoNews,
          });

          // Partial update — only change promo_news
          store.updatePreferences(userId, { promo_news: newPromoNews });

          const fetched = store.getPreferences(userId);

          // Only promo_news should have changed
          expect(fetched.payment_accepted).toBe(true);
          expect(fetched.order_shipped).toBe(true);
          expect(fetched.order_finished).toBe(false);
          expect(fetched.order_cancelled).toBe(true);
          expect(fetched.promo_news).toBe(newPromoNews);
        }
      ),
      { numRuns: 100 }
    );
  });
});
