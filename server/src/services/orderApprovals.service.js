/**
 * orderApprovals.service.js — Approval/locking per stage untuk setiap order.
 *
 * Fitur 1: setelah admin approve suatu tahap, status di tahap itu di-lock.
 * Admin lain masih bisa lihat order-nya tapi tidak bisa ubah status di tahap yg sama.
 */

import { randomUUID } from 'crypto';
import { query } from '../db/connection.js';

/**
 * Map: status → nama "tahap" yang diwakilinya.
 * Kalau status ini sudah ada di order_approvals, maka perubahan ke status itu di-lock.
 */
export const APPROVAL_STAGE_FOR_STATUS = {
  'Payment Accepted':           'Payment Accepted',
  'Waiting for Design Approval':'Waiting for Design Approval',
  'Design Accepted':            'Design Accepted',
  'On Progress':                'On Progress',
  'Quality Checking':           'Quality Checking',
  'In Delivery':                'In Delivery',
  'Finished':                   'Finished',
};

/**
 * Cek apakah suatu tahap (stage) pada order sudah di-approve/locked.
 * @param {string} orderId
 * @param {string} stage  Nama stage, e.g. "Payment Accepted"
 * @returns {Promise<object|null>} Row approval atau null jika belum di-approve
 */
export async function getApproval(orderId, stage) {
  const [rows] = await query(
    `SELECT oa.*, u.name AS approver_name_live
     FROM order_approvals oa
     LEFT JOIN users_admin u ON u.id = oa.approved_by
     WHERE oa.order_id = ? AND oa.stage = ?
     LIMIT 1`,
    [orderId, stage]
  );
  return rows[0] || null;
}

/**
 * Ambil semua approval untuk satu order (untuk ditampilkan di frontend).
 * @param {string} orderId
 * @returns {Promise<object[]>}
 */
export async function getApprovalsByOrderId(orderId) {
  const [rows] = await query(
    `SELECT oa.*, u.name AS approver_name_live
     FROM order_approvals oa
     LEFT JOIN users_admin u ON u.id = oa.approved_by
     WHERE oa.order_id = ?
     ORDER BY oa.approved_at ASC`,
    [orderId]
  );
  return rows;
}

/**
 * Catat approval untuk suatu stage. Dipanggil setelah updateOrderStatus berhasil.
 * Jika sudah ada (UNIQUE constraint), abaikan.
 * @param {string} orderId
 * @param {string} stage      Status yang baru saja di-set
 * @param {string} actorId    User ID yang melakukan perubahan
 * @param {string} actorRole  Role saat approve
 * @param {string} actorName  Nama admin saat approve
 * @returns {Promise<object>} Baris approval yang baru dibuat
 */
export async function recordApproval(orderId, stage, actorId, actorRole, actorName) {
  const id = randomUUID();
  try {
    await query(
      `INSERT IGNORE INTO order_approvals
         (id, order_id, stage, approved_by, approved_role, approved_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, orderId, stage, actorId, actorRole, actorName || '']
    );
  } catch (err) {
    // INSERT IGNORE menangani duplikat, throw hanya jika error lain
    if (!err.message?.includes('Duplicate')) throw err;
  }
  return getApproval(orderId, stage);
}

/**
 * Guard: lempar error 403 jika tahap sudah di-lock (sudah di-approve sebelumnya).
 * Dipanggil di awal updateOrderStatus.
 * @param {string} orderId
 * @param {string} newStatus  Status yang ingin di-set
 */
export async function assertNotLocked(orderId, newStatus) {
  const stage = APPROVAL_STAGE_FOR_STATUS[newStatus];
  if (!stage) return; // Status ini tidak masuk skema approval, lewati

  const existing = await getApproval(orderId, stage);
  if (existing) {
    const approvedAt = new Date(existing.approved_at).toLocaleString('id-ID');
    const err = new Error(
      `Tahap "${stage}" sudah di-ACC oleh ${existing.approved_name || 'admin'} pada ${approvedAt}. Status tidak dapat diubah kembali.`
    );
    err.status = 403;
    err.approvalData = existing;
    throw err;
  }
}
