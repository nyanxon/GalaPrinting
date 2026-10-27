import { STAFF_ROLES } from '../config/roles.js';

export class OrderAccessError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'OrderAccessError';
    this.status = status;
  }
}

/**
 * Assert user can access a specific order.
 * - Staff (STAFF_ROLES): allowed
 * - Customer: only if order.customer_id === user.id
 * - Otherwise: throw 404 (not 403)
 */
export function assertCanAccessOrder(user, order) {
  if (!order) {
    const err = new OrderAccessError(404, 'Pesanan tidak ditemukan.');
    throw err;
  }

  if (!user) {
    const err = new OrderAccessError(404, 'Pesanan tidak ditemukan.');
    throw err;
  }

  // Staff allowed
  if (STAFF_ROLES.includes(user.role)) {
    return;
  }

  // Customer - must own the order
  if (user.role === 'customer') {
    if (order.customer_id && order.customer_id === user.id) {
      return;
    }
    // For guest orders (no customer_id), deny as 404 per requirement
    const err = new OrderAccessError(404, 'Pesanan tidak ditemukan.');
    throw err;
  }

  // Other roles - treat as not allowed, return 404
  const err = new OrderAccessError(404, 'Pesanan tidak ditemukan.');
  throw err;
}

export function canAccessOrder(user, order) {
  try {
    assertCanAccessOrder(user, order);
    return true;
  } catch {
    return false;
  }
}
