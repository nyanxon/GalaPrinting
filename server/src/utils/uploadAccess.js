/**
 * uploadAccess.js — Customer-only upload rules (FASE 2D D5).
 *
 * Staff behaviour is intentionally unchanged: staff may upload payment proofs
 * and design files regardless of order status or invoice state.
 *
 * These helpers run AFTER ownership has been verified by assertCanAccessOrder()
 * and BEFORE the temporary upload is persisted.
 */

import { STAFF_ROLES } from '../config/roles.js';

/** Statuses where a customer may upload/replace a payment proof. */
export const CUSTOMER_PAYMENT_PROOF_STATUSES = Object.freeze([
  'Waiting for Design Approval',
  'Design Accepted',
  'Waiting for Payment',
]);

/** Statuses where a customer may upload/replace an order-item design file. */
export const CUSTOMER_DESIGN_UPLOAD_STATUSES = Object.freeze([
  'Waiting for Design Approval',
]);

export const UPLOAD_FORBIDDEN_MESSAGE = Object.freeze({
  payment_proof_status:
    'Bukti pembayaran hanya dapat diunggah saat status Waiting for Design Approval, Design Accepted, atau Waiting for Payment.',
  payment_proof_paid:
    'Bukti pembayaran tidak dapat diunggah karena invoice sudah lunas atau terkunci.',
  design_status:
    'File desain hanya dapat diunggah atau diganti saat status Waiting for Design Approval.',
  unknown_kind: 'Jenis unggahan tidak dikenal.',
});

export class UploadAccessError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.name = 'UploadAccessError';
    this.status = status;
  }
}

export function isStaffRole(user) {
  return STAFF_ROLES.includes(user?.role);
}

/**
 * Enforce customer upload rules. Staff always pass.
 *
 * @param {{ id?: string, role?: string }|null|undefined} user
 * @param {object|null|undefined} order
 * @param {{ payment_status?: string, locked?: number|boolean }|null|undefined} invoice
 *   Required for payment proofs; ignored for design uploads.
 * @param {'payment_proof'|'design'} kind
 * @throws {UploadAccessError} 403 when a customer is not allowed to upload
 */
export function assertCustomerUploadAllowed(user, order, invoice, kind) {
  if (isStaffRole(user)) return;

  if (user?.role !== 'customer') {
    throw new UploadAccessError(UPLOAD_FORBIDDEN_MESSAGE.unknown_kind, 403);
  }

  if (kind === 'payment_proof') {
    if (!CUSTOMER_PAYMENT_PROOF_STATUSES.includes(order?.status)) {
      throw new UploadAccessError(UPLOAD_FORBIDDEN_MESSAGE.payment_proof_status, 403);
    }

    const paid = invoice?.payment_status === 'paid';
    const locked = invoice?.locked === true || Number(invoice?.locked) === 1;
    if (paid || locked) {
      throw new UploadAccessError(UPLOAD_FORBIDDEN_MESSAGE.payment_proof_paid, 403);
    }
    return;
  }

  if (kind === 'design') {
    if (!CUSTOMER_DESIGN_UPLOAD_STATUSES.includes(order?.status)) {
      throw new UploadAccessError(UPLOAD_FORBIDDEN_MESSAGE.design_status, 403);
    }
    return;
  }

  throw new UploadAccessError(UPLOAD_FORBIDDEN_MESSAGE.unknown_kind, 403);
}
