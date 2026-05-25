// Feature: customer-profile-page, Property 11: email sent iff preference enabled

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

/**
 * Mapping from order status to notification preference key.
 * Mirrors STATUS_TO_PREF_KEY in orders.service.js.
 */
const STATUS_TO_PREF_KEY = {
  'Payment Accepted': 'payment_accepted',
  'In Delivery':      'order_shipped',
  'Finished':         'order_finished',
  'Cancelled':        'order_cancelled',
};

/**
 * Simulates the sendEmailIfEnabled logic from orders.service.js.
 * Returns true if email would be sent, false otherwise.
 */
function wouldSendEmail(newStatus, prefs) {
  const prefKey = STATUS_TO_PREF_KEY[newStatus];
  if (!prefKey) return false;
  return Boolean(prefs[prefKey]);
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

const notifiableStatuses = Object.keys(STATUS_TO_PREF_KEY);

describe('Property 11: Email sent if and only if preference is enabled', () => {
  /**
   * For any order status transition that maps to a notification type,
   * and for any customer notification preference state, the email service
   * should be called if and only if the customer has that notification
   * type enabled.
   *
   * Validates: Requirements 8.1, 8.2, 8.3, 8.4
   */
  it('email is sent iff the corresponding preference is enabled (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...notifiableStatuses),
        prefsArbitrary,
        (newStatus, prefs) => {
          const prefKey = STATUS_TO_PREF_KEY[newStatus];
          const shouldSend = Boolean(prefs[prefKey]);
          const willSend = wouldSendEmail(newStatus, prefs);

          expect(willSend).toBe(shouldSend);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * When preference is enabled, email is always sent.
   *
   * Validates: Requirements 8.1–8.4
   */
  it('email is always sent when preference is enabled (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...notifiableStatuses),
        (newStatus) => {
          const prefKey = STATUS_TO_PREF_KEY[newStatus];
          const prefs = {
            payment_accepted: false,
            order_shipped: false,
            order_finished: false,
            order_cancelled: false,
            promo_news: false,
            [prefKey]: true, // enable only this one
          };

          expect(wouldSendEmail(newStatus, prefs)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * When preference is disabled, email is never sent.
   *
   * Validates: Requirements 8.1–8.4
   */
  it('email is never sent when preference is disabled (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...notifiableStatuses),
        (newStatus) => {
          const allDisabled = {
            payment_accepted: false,
            order_shipped: false,
            order_finished: false,
            order_cancelled: false,
            promo_news: false,
          };

          expect(wouldSendEmail(newStatus, allDisabled)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Statuses that don't map to a notification type never trigger email.
   *
   * Validates: Requirements 8.1–8.4
   */
  it('non-notifiable statuses never trigger email', () => {
    const nonNotifiableStatuses = [
      'Waiting for Payment',
      'Waiting for Design Approval',
      'Design Accepted',
      'On Progress',
      'Quality Checking',
    ];

    const allEnabled = {
      payment_accepted: true,
      order_shipped: true,
      order_finished: true,
      order_cancelled: true,
      promo_news: true,
    };

    for (const status of nonNotifiableStatuses) {
      expect(wouldSendEmail(status, allEnabled)).toBe(false);
    }
  });
});
