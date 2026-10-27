/**
 * orderStatuses.js — Backend source of truth for the order status vocabulary.
 *
 * The frontend mirrors this list in `src/services/orderStatusConfig.js`; the
 * parity test guards both sides against drift. Keeping the list server-side
 * lets request validation reject unknown `expectedStatus` values with 400
 * without importing browser code into the server.
 */

export const ORDER_STATUSES = Object.freeze([
  'Waiting for Design Approval',
  'Design Accepted',
  'Waiting for Payment',
  'Payment Accepted',
  'On Progress',
  'Quality Checking',
  'In Delivery',
  'Finished',
  'Cancelled',
]);

/** Message returned when optimistic concurrency detects a stale status. */
export const STATUS_CHANGED_MESSAGE = 'Status order sudah berubah. Muat ulang data.';

const ORDER_STATUS_SET = new Set(ORDER_STATUSES);

/**
 * @param {unknown} value
 * @returns {boolean} true only for a known status string
 */
export function isValidOrderStatus(value) {
  return typeof value === 'string' && ORDER_STATUS_SET.has(value);
}
