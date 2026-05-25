/**
 * core/notifications.js — Notification abstraction layer.
 *
 * Currently a no-op stub. When backend is ready, replace the
 * body of each function with a real API call (email, WhatsApp,
 * push notification, etc.) without touching any caller.
 *
 * Usage:
 *   import { notifyOrderCreated, notifyOrderUpdated } from "../core/notifications.js";
 *   notifyOrderCreated(order);
 */

/**
 * Called when a new order is created (post-checkout).
 * @param {object} order  Full order object
 */
export function notifyOrderCreated(order) {
  // TODO: POST /api/notifications/order-created
  // e.g. send WhatsApp confirmation to order.customer.phone
  _log("order:created", order.orderNumber);
}

/**
 * Called when an order's status changes.
 * @param {object} order      Updated order object
 * @param {string} prevStatus Status before the change
 */
export function notifyOrderStatusChanged(order, prevStatus) {
  // TODO: POST /api/notifications/order-status
  // e.g. send push notification / email to customer
  _log("order:status", `${order.orderNumber} ${prevStatus} → ${order.status}`);
}

/**
 * Called when an admin note is added or updated.
 * @param {object} order  Updated order object
 */
export function notifyAdminNoteUpdated(order) {
  // TODO: POST /api/notifications/admin-note
  _log("order:note", order.orderNumber);
}

/* ── Internal dev logger (stripped in production) ───────── */
function _log(event, detail) {
  if (typeof window !== "undefined" && window.__GALA_DEBUG__) {
    console.info(`[notify] ${event}:`, detail);
  }
}
