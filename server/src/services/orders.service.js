/**
 * orders.service.js — Order management business logic.
 *
 * Requirements: 7.1–7.11
 */

import { randomUUID } from 'crypto';
import { query, pool } from '../db/connection.js';
import { StorageService } from '../utils/storage.js';
import { parsePagination } from '../utils/pagination.js';
import { incrementUsage, recordUsageLog } from './promo.service.js';
import {
  sendOrderNotification,
  sendNewOrderAdminAlert,
  sendOrderReceivedEmail,
  sendMockupAcceptedEmail,
  sendInvoiceEmail,
} from './email.service.js';
import { getPreferences } from './notifications.service.js';
import { assertNotLocked, recordApproval, APPROVAL_STAGE_FOR_STATUS } from './orderApprovals.service.js';
import { generateInvoicePdf } from '../utils/invoicePdf.js';

// ── Status transition rules ───────────────────────────────────────────────────

const TRANSITIONS = {
  cashier:     {
    'Waiting for Payment': ['Payment Accepted', 'Cancelled'],
    'Payment Accepted':    [], // Setelah Payment Accepted, cashier tidak bisa membatalkan
  },
  cs:          {
    // Standard flow
    'Payment Accepted':            ['Waiting for Design Approval'],
    'Waiting for Design Approval': ['Design Accepted'],
    // Custom order flow (CS-first): Design Accepted → Waiting for Payment
    'Design Accepted':             ['Waiting for Payment'],
  },
  operational: {
    'Design Accepted': ['On Progress'],
    // Custom order flow: Payment Accepted → On Progress
    'Payment Accepted': ['On Progress'],
  },
  qc:          {
    'On Progress':      ['Quality Checking'],
    'Quality Checking': ['In Delivery', 'On Progress'], // QC reject → back to Operational
    'In Delivery':      ['Finished'],
  },
  admin:       {
    'Waiting for Payment':        ['Payment Accepted', 'Cancelled'],
    'Payment Accepted':           ['Waiting for Design Approval', 'On Progress', 'Cancelled'],
    'Waiting for Design Approval': ['Design Accepted', 'Cancelled'],
    'Design Accepted':            ['On Progress', 'Waiting for Payment', 'Cancelled'],
    'On Progress':                ['Quality Checking', 'Cancelled'],
    'Quality Checking':           ['In Delivery', 'On Progress', 'Cancelled'], // QC reject → back to Operational
    'In Delivery':                ['Finished', 'Cancelled'],
  },
  owner: {
    'Waiting for Payment':         ['Cancelled'],
    'Payment Accepted':            ['Cancelled'],
    'Waiting for Design Approval': ['Cancelled'],
    'Design Accepted':             ['Cancelled'],
    'On Progress':                 ['Cancelled'],
    'Quality Checking':            ['Cancelled'],
    'In Delivery':                 ['Cancelled'],
  },
};

export function getAllowedNextStatuses(currentStatus, role) {
  const map = TRANSITIONS[role] || {};
  return map[currentStatus] || [];
}

// ── Email notification mapping ────────────────────────────────────────────────

/**
 * Maps an order status string to the corresponding notification preference key.
 * Only statuses that trigger customer emails are listed here.
 * NOTE: 'Payment Accepted' is handled separately via invoice email (with PDF attachment).
 */
const STATUS_TO_PREF_KEY = {
  'Design Accepted':  'mockup_accepted',
  'In Delivery':      'order_shipped',
  'Finished':         'order_finished',
  'Cancelled':        'order_cancelled',
};

/**
 * Fire-and-forget helper: fetch the customer's email, check their notification
 * preferences, and send an order status email if the relevant preference is on.
 *
 * Must NOT be awaited by the caller — any error is caught and logged internally.
 *
 * @param {object} updatedOrder  The order object returned by getOrderById()
 * @param {string} newStatus     The new order status string
 * @param {string} customerId    The customer's user ID
 */
async function sendEmailIfEnabled(updatedOrder, newStatus, customerId) {
  try {
    const prefKey = STATUS_TO_PREF_KEY[newStatus];
    if (!prefKey) return; // Status does not trigger an email

    const prefs = await getPreferences(customerId);
    if (!prefs[prefKey]) return; // Customer has this notification disabled

    // Fetch the customer's email address from the users table
    const [userRows] = await query('SELECT email, name FROM users WHERE id = ?', [customerId]);
    if (userRows.length === 0) return;

    const orderWithEmail = {
      ...updatedOrder,
      customer_email: userRows[0].email,
      customer_name: updatedOrder.customer_name || userRows[0].name,
    };

    if (newStatus === 'Design Accepted') {
      // Use dedicated mockup-accepted email
      sendMockupAcceptedEmail({
        customerEmail: orderWithEmail.customer_email,
        customerName:  orderWithEmail.customer_name,
        orderNumber:   orderWithEmail.order_number,
      });
      return;
    }

    // All other statuses use the generic order notification email
    sendOrderNotification(orderWithEmail, newStatus);
  } catch (err) {
    console.error('[orders] sendEmailIfEnabled error:', err.message);
    // Do NOT re-throw — email failure must not block the API response
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalize selected attribute values into a storable JSON string.
 * Format: [{ name: "Tipe Laminasi", value: "Glossy" }, ...]
 * Returns null when empty/invalid.
 */
function normalizeSelectedAttributes(raw) {
  if (!raw) return null;
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(list)) return null;
  const cleaned = list
    .map((a) => {
      if (!a || typeof a !== 'object') return null;
      const name = String(a.name ?? '').trim();
      const value = String(a.value ?? '').trim();
      if (!name || !value) return null;
      return { name: name.slice(0, 100), value: value.slice(0, 200) };
    })
    .filter(Boolean)
    .slice(0, 30);
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

/**
 * Generate a sequential order number in format: GALA-YYYY/MM/DD-NNNNNN
 * Uses SELECT ... FOR UPDATE inside the caller's transaction to guarantee
 * atomicity — the row lock is held until the transaction commits/rolls back,
 * preventing duplicate order numbers under concurrent load (fixes W7).
 *
 * @param {import('mysql2/promise').PoolConnection} conn  Active transaction connection
 */
async function generateOrderNumber(conn) {
  // Acquire row lock — no other transaction can read or write this row until commit/rollback
  const [[row]] = await conn.execute(
    'SELECT last_seq FROM order_sequence WHERE id = 1 FOR UPDATE'
  );
  const newSeq = row.last_seq + 1;
  await conn.execute(
    'UPDATE order_sequence SET last_seq = ? WHERE id = 1',
    [newSeq]
  );
  const seq = String(newSeq).padStart(6, '0');

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');

  return `GALA-${yyyy}/${mm}/${dd}-${seq}`;
}

async function insertHistoryEntry(orderId, fromStatus, toStatus, actorId, cancellationReason) {
  await query(
    `INSERT INTO order_history (id, order_id, from_status, to_status, actor_id, cancellation_reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [randomUUID(), orderId, fromStatus || null, toStatus, actorId || null, cancellationReason || null]
  );
}

/**
 * Batch-fetch order items for a list of orders and attach them in-place.
 * Executes a single IN-query instead of N individual queries (fixes C1/C7/W5).
 *
 * @param {object[]} orders  Array of order rows (mutated in-place)
 * @returns {object[]}       The same array with `items` attached to each order
 */
async function attachItemsToOrders(orders) {
  if (orders.length === 0) return orders;

  const ids = orders.map((o) => o.id);
  // pool.execute() does not expand arrays for IN clauses — build placeholders manually
  const placeholders = ids.map(() => '?').join(', ');
  const [itemRows] = await query(
    `SELECT * FROM order_items WHERE order_id IN (${placeholders})`,
    ids
  );

  // Group items by order_id
  const itemsByOrderId = new Map();
  for (const item of itemRows) {
    const list = itemsByOrderId.get(item.order_id);
    if (list) {
      list.push(item);
    } else {
      itemsByOrderId.set(item.order_id, [item]);
    }
  }

  // Attach grouped items to each order
  for (const order of orders) {
    order.items = itemsByOrderId.get(order.id) ?? [];
  }

  return orders;
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Create a new order with items and initial history entry.
 * All inserts are wrapped in a single DB transaction — if any item insert
 * fails, the entire transaction is rolled back and no partial order is left.
 */
export async function createOrder({ customer, items, subtotal, source = 'online', orderType = 'standard', initialStatus, promoCode, discountAmount, adminNote, customerType = 'customer' }) {
  const id     = randomUUID();
  const status = initialStatus || 'Waiting for Payment';

  // For offline orders starting at 'On Progress', record all prior steps as completed
  const OFFLINE_PRIOR_STEPS = [
    'Waiting for Payment',
    'Payment Accepted',
    'Waiting for Design Approval',
    'Design Accepted',
  ];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Generate the order number INSIDE the transaction using SELECT ... FOR UPDATE.
    // The row lock on order_sequence is held until commit/rollback, guaranteeing
    // that concurrent transactions cannot produce duplicate order numbers (fixes W7).
    const orderNumber = await generateOrderNumber(conn);

    await conn.execute(
      `INSERT INTO orders
         (id, order_number, order_type, source, customer_id, customer_name, customer_type, customer_phone, customer_address, customer_address_title, customer_email, status, subtotal, promo_code, discount_amount, admin_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orderNumber,
        orderType,
        source,
        customer?.id || null,
        customer?.name || null,
        customerType === 'broker' ? 'broker' : 'customer',
        customer?.phone || null,
        customer?.address || null,
        customer?.addressTitle || null,
        customer?.email || null,
        status,
        subtotal || 0,
        promoCode || null,
        Number(discountAmount) || 0,
        adminNote || null,
      ]
    );

    // Insert order items
    for (const item of (items || [])) {
      await conn.execute(
        `INSERT INTO order_items
           (id, order_id, product_id, name, price, quantity, attributes, length_cm, width_cm, notes, design_file_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          id,
          item.productId ?? item.product_id ?? null,
          item.name,
          item.price,
          item.quantity || 1,
          normalizeSelectedAttributes(item.attributes),
          item.lengthCm ?? item.length_cm ?? null,
          item.widthCm  ?? item.width_cm  ?? null,
          item.notes || null,
          item.designFilePath || null,
        ]
      );
    }

    // Increment promo code usage inside the transaction + record usage log
    if (promoCode) {
      const [promoRows] = await conn.execute(
        'SELECT id FROM promo_codes WHERE UPPER(code) = UPPER(?)',
        [promoCode]
      );
      if (promoRows.length > 0) {
        const promoCodeId = promoRows[0].id;
        await incrementUsage(promoCodeId, conn);
        // Record usage log (fire-and-forget after commit — done outside transaction below)
        // Store for post-commit logging
        conn._pendingPromoLog = {
          promoCodeId,
          orderId: id,
          userId: customer?.id || null,
          customerName: customer?.name || null,
          customerEmail: customer?.email || null,
          discountAmount: Number(discountAmount) || 0,
          orderSubtotal: subtotal || 0,
        };
      }
    }

    // For offline orders: backfill prior steps as completed before the initial status
    if (source === 'offline' && OFFLINE_PRIOR_STEPS.includes(status) === false) {
      const priorSteps = OFFLINE_PRIOR_STEPS.slice(0, OFFLINE_PRIOR_STEPS.indexOf(status) + 1);
      // If status is 'On Progress', all 4 prior steps are completed
      const stepsToBackfill = status === 'On Progress' ? OFFLINE_PRIOR_STEPS : priorSteps;
      let prevStep = null;
      for (const step of stepsToBackfill) {
        await conn.execute(
          `INSERT INTO order_history (id, order_id, from_status, to_status, actor_id)
           VALUES (?, ?, ?, ?, ?)`,
          [randomUUID(), id, prevStep, step, null]
        );
        prevStep = step;
      }
      // Final entry: transition to the actual initial status
      await conn.execute(
        `INSERT INTO order_history (id, order_id, from_status, to_status, actor_id)
         VALUES (?, ?, ?, ?, ?)`,
        [randomUUID(), id, prevStep, status, null]
      );
    } else {
      // Normal initial history entry
      await conn.execute(
        `INSERT INTO order_history (id, order_id, from_status, to_status, actor_id)
         VALUES (?, ?, ?, ?, ?)`,
        [randomUUID(), id, null, status, customer?.id || null]
      );
    }

    await conn.commit();

    // Record promo usage log after successful commit (outside transaction)
    if (conn._pendingPromoLog) {
      recordUsageLog(conn._pendingPromoLog).catch((err) => {
        console.error('[promo] Failed to record usage log:', err.message);
      });
    }
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const createdOrder = await getOrderById(id);

  // Fire-and-forget admin alert for new orders
  sendNewOrderAdminAlert(createdOrder).catch(() => {});

  // Auto-create invoice for every new order (fire-and-forget)
  autoCreateInvoice(createdOrder).catch((err) => {
    console.error('[orders] Auto-create invoice failed:', err.message);
  });

  // Send "Pesanan Diterima" email to customer if preference is enabled
  if (createdOrder.customer_id) {
    (async () => {
      try {
        const [userRows] = await query('SELECT email, name FROM users WHERE id = ?', [createdOrder.customer_id]);
        if (!userRows.length) return;
        const prefs = await getPreferences(createdOrder.customer_id);
        if (!prefs.order_received) return;
        await sendOrderReceivedEmail({
          customerEmail: userRows[0].email,
          customerName:  createdOrder.customer_name || userRows[0].name,
          orderNumber:   createdOrder.order_number,
          subtotal:      createdOrder.subtotal,
          items:         createdOrder.items || [],
        });
      } catch (err) {
        console.error('[orders] order_received email failed:', err.message);
      }
    })();
  }

  return createdOrder;
}

/**
 * List orders with pagination and optional status filter.
 */
export async function listOrders({ page = 1, limit = 20, status } = {}) {
  // Staff can request up to 2000 orders at once (for "list all" views).
  // The default 20 cap stays for paginated views.
  const { pageNum, limitNum, offset } = parsePagination(page, limit, 2000, 20);

  const conditions = [];
  const params     = [];

  if (status) {
    conditions.push('o.status = ?');
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await query(`SELECT COUNT(*) AS total FROM orders o ${where}`, params);
  const total = countRows[0].total;

  const [items] = await query(
    `SELECT o.* FROM orders o ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  await attachItemsToOrders(items);

  return { items, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
}

/**
 * List orders belonging to a specific customer.
 */
export async function listOrdersByCustomer({ customerId, customerPhone } = {}) {
  if (customerId) {
    const [rows] = await query(
      'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC',
      [customerId]
    );
    await attachItemsToOrders(rows);
    return rows;
  }
  if (customerPhone) {
    const [rows] = await query(
      'SELECT * FROM orders WHERE customer_phone = ? ORDER BY created_at DESC',
      [customerPhone]
    );
    await attachItemsToOrders(rows);
    return rows;
  }
  return [];
}

/**
 * Find an order by order number + optional phone verification (public tracking).
 * If phone is omitted or null, matches by order number only.
 */
export async function findOrder({ orderNumber, phone }) {
  let row;
  if (phone) {
    const [rows] = await query(
      'SELECT * FROM orders WHERE order_number = ? AND customer_phone = ?',
      [orderNumber, phone]
    );
    row = rows[0] || null;
  } else {
    // No phone — match by order number only
    const [rows] = await query(
      'SELECT * FROM orders WHERE order_number = ?',
      [orderNumber]
    );
    row = rows[0] || null;
  }

  if (!row) return null;

  // Attach items and history (same as getOrderById)
  const [[items], [history]] = await Promise.all([
    query('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC', [row.id]),
    query('SELECT * FROM order_history WHERE order_id = ? ORDER BY created_at ASC', [row.id]),
  ]);

  // Build timelineMap from actual history — same logic as getOrderById
  const timelineMap = {};
  for (const h of history) {
    if (h.to_status && !timelineMap[h.to_status]) {
      timelineMap[h.to_status] = h.created_at;
    }
  }

  return { ...row, items, history, timelineMap };
}

/**
 * Get a single order with its items, history, and approvals.
 */
export async function getOrderById(id) {
  const [orders] = await query('SELECT * FROM orders WHERE id = ?', [id]);
  if (orders.length === 0) return null;

  const order = orders[0];

  // Run items, history, and approvals queries in parallel
  const [[items], [history], [approvals]] = await Promise.all([
    query('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC', [id]),
    query('SELECT * FROM order_history WHERE order_id = ? ORDER BY created_at ASC', [id]),
    query(
      `SELECT oa.*, u.name AS approver_name_live
       FROM order_approvals oa
       LEFT JOIN users u ON u.id = oa.approved_by
       WHERE oa.order_id = ? ORDER BY oa.approved_at ASC`,
      [id]
    ),
  ]);

  // Build timeline from actual history records.
  // Each status that appears as to_status in history is considered "done",
  // timestamped by when that transition was recorded.
  // This is what the frontend uses to render ✓ checkmarks accurately.
  const timelineMap = {};
  for (const h of history) {
    if (h.to_status && !timelineMap[h.to_status]) {
      // First occurrence wins (earliest timestamp for that status)
      timelineMap[h.to_status] = h.created_at;
    }
  }

  return { ...order, items, history, approvals, timelineMap };
}

/**
 * Advance an order to a new status, enforcing role-based transition rules.
 * Fitur 1: cek approval lock sebelum update — tolak 403 jika tahap sudah di-ACC.
 *
 * @param {string} id
 * @param {string} newStatus
 * @param {string} actorId
 * @param {string} actorRole
 * @param {string|null} cancellationReason
 * @param {string|null} actorName  Nama admin (untuk approval record snapshot)
 */
export async function updateOrderStatus(id, newStatus, actorId, actorRole, cancellationReason, actorName) {
  const order = await getOrderById(id);
  if (!order) {
    const err = new Error('Pesanan tidak ditemukan.');
    err.status = 404;
    throw err;
  }

  const allowed = getAllowedNextStatuses(order.status, actorRole);
  if (!allowed.includes(newStatus)) {
    const err = new Error(
      `Role '${actorRole}' tidak diizinkan mengubah status dari '${order.status}' ke '${newStatus}'.`
    );
    err.status = 403;
    throw err;
  }

  // Fitur 1: cek apakah tahap ini sudah di-lock (sudah di-approve sebelumnya)
  if (newStatus !== 'Cancelled') {
    await assertNotLocked(id, newStatus);
  }

  const prevStatus = order.status;
  if (newStatus === 'Cancelled') {
    await query('UPDATE orders SET status = ?, cancellation_reason = ? WHERE id = ?', [newStatus, cancellationReason || null, id]);
  } else {
    await query('UPDATE orders SET status = ? WHERE id = ?', [newStatus, id]);
  }
  await insertHistoryEntry(id, prevStatus, newStatus, actorId, cancellationReason);

  // Fitur 1: simpan approval record untuk stage ini
  if (newStatus !== 'Cancelled' && APPROVAL_STAGE_FOR_STATUS[newStatus]) {
    await recordApproval(id, newStatus, actorId, actorRole, actorName || actorRole);
  }

  // Delete uploaded files when an order is cancelled (fix C6a)
  if (newStatus === 'Cancelled') {
    const filesToDelete = [];

    if (order.payment_proof_path) {
      filesToDelete.push(order.payment_proof_path);
    }

    // Collect design file paths from order items
    const [itemRows] = await query(
      'SELECT design_file_path FROM order_items WHERE order_id = ? AND design_file_path IS NOT NULL',
      [id]
    );
    for (const item of itemRows) {
      if (item.design_file_path) {
        filesToDelete.push(item.design_file_path);
      }
    }

    // Delete all collected files (StorageService.delete silently ignores missing files)
    await Promise.all(filesToDelete.map((p) => StorageService.delete(p)));
  }

  const updatedOrder = await getOrderById(id);

  // ── Payment Accepted: auto-create invoice synchronously, mark paid, send invoice email ──
  if (newStatus === 'Payment Accepted') {
    try {
      // 1. Ensure invoice exists (may have been auto-created on order creation)
      let [[inv]] = await query('SELECT id FROM invoices WHERE order_id = ?', [id]);
      if (!inv) {
        await autoCreateInvoice(updatedOrder);
        [[inv]] = await query('SELECT id FROM invoices WHERE order_id = ?', [id]);
      }

      if (inv) {
        const invoiceId = inv.id;

        // 2. Mark invoice as paid with current timestamp (the exact time cashier accepted)
        const [[invRow]] = await query('SELECT payment_status, locked FROM invoices WHERE id = ?', [invoiceId]);
        if (invRow && !invRow.locked) {
          await query(
            `UPDATE invoices
             SET payment_status = 'paid', locked = 1, paid_at = NOW()
             WHERE id = ?`,
            [invoiceId]
          );
        }

        // 3. Send invoice email fire-and-forget (email tidak boleh blokir response)
        const recipientEmail = order.customer_email || null;
        if (recipientEmail) {
          (async () => {
            try {
              const [invRows] = await query(
                `SELECT i.*,
                        o.order_number, o.customer_name, o.customer_phone, o.customer_address,
                        COALESCE(u.email, o.customer_email) AS customer_email, creator.name AS creator_name
                 FROM invoices i
                 LEFT JOIN orders o ON i.order_id = o.id
                 LEFT JOIN users u ON i.customer_id = u.id
                 LEFT JOIN users creator ON i.created_by = creator.id
                 WHERE i.id = ?`,
                [invoiceId]
              );
              if (!invRows.length) return;
              const [itemRows] = await query('SELECT * FROM order_items WHERE order_id = ?', [id]);
              const fullInvoice = { ...invRows[0], items: itemRows };

              // For logged-in customers, respect notification preferences;
              // for offline customers with email, always send
              if (order.customer_id) {
                const prefs = await getPreferences(order.customer_id);
                if (!prefs.payment_accepted) return;
              }

              const { pdfBuffer } = await generateInvoicePdf(fullInvoice);
              await sendInvoiceEmail({ invoice: fullInvoice, pdfBuffer });
            } catch (err) {
              console.error('[orders] Invoice email failed:', err.message);
            }
          })();
        }
      }
    } catch (err) {
      // Invoice creation failure must NOT block the status update response
      console.error('[orders] Payment Accepted post-processing failed:', err.message);
    }
  }

  // Fire-and-forget email notification — only for logged-in customers
  if (order.customer_id) {
    sendEmailIfEnabled(updatedOrder, newStatus, order.customer_id);
  }

  return updatedOrder;
}

/**
 * Update the admin note on an order.
 */
export async function updateAdminNote(id, note) {
  await query('UPDATE orders SET admin_note = ? WHERE id = ?', [note, id]);
  return getOrderById(id);
}

/**
 * Set tracking number and courier; auto-advance to "In Delivery" if applicable.
 * Fitur 3: hanya berlaku untuk delivery — kalau pickup, update lokasi & jadwal.
 */
export async function setTrackingNumber(id, trackingNumber, courierName, actorId) {
  const order = await getOrderById(id);
  if (!order) {
    const err = new Error('Pesanan tidak ditemukan.');
    err.status = 404;
    throw err;
  }

  await query(
    'UPDATE orders SET tracking_number = ?, courier_name = ? WHERE id = ?',
    [trackingNumber, courierName || null, id]
  );

  // Auto-advance to "In Delivery" if currently "Quality Checking"
  if (order.status === 'Quality Checking') {
    await query('UPDATE orders SET status = ? WHERE id = ?', ['In Delivery', id]);
    await insertHistoryEntry(id, 'Quality Checking', 'In Delivery', actorId);
  }

  return getOrderById(id);
}

/**
 * Set pickup info untuk delivery_method = pickup_factory / pickup_store.
 * @param {string} id
 * @param {{ pickup_location: string, pickup_ready_at?: Date }} opts
 */
export async function setPickupInfo(id, opts) {
  const order = await getOrderById(id);
  if (!order) {
    const err = new Error('Pesanan tidak ditemukan.');
    err.status = 404;
    throw err;
  }

  await query(
    'UPDATE orders SET pickup_location = ?, pickup_ready_at = ? WHERE id = ?',
    [opts.pickup_location || null, opts.pickup_ready_at || null, id]
  );

  return getOrderById(id);
}

/**
 * Update delivery_method pada order.
 * @param {string} id
 * @param {'delivery'|'pickup_factory'|'pickup_store'} method
 */
export async function setDeliveryMethod(id, method) {
  const allowed = ['delivery', 'pickup_factory', 'pickup_store'];
  if (!allowed.includes(method)) {
    const err = new Error('delivery_method tidak valid.');
    err.status = 422;
    throw err;
  }

  await query('UPDATE orders SET delivery_method = ? WHERE id = ?', [method, id]);
  return getOrderById(id);
}

/**
 * Attach a payment proof file path to an order.
 * Deletes the old proof file (if any) before persisting the new path.
 * @param {string} id  Order UUID
 * @param {string} proofPath  Server-side path from StorageService.save() — NEVER from client input
 */
export async function attachPaymentProof(id, proofPath) {
  // Fetch current order to check for an existing proof path (fix C6b)
  const [rows] = await query('SELECT payment_proof_path FROM orders WHERE id = ?', [id]);
  if (rows.length > 0 && rows[0].payment_proof_path) {
    await StorageService.delete(rows[0].payment_proof_path);
  }

  await query('UPDATE orders SET payment_proof_path = ? WHERE id = ?', [proofPath, id]);
  return getOrderById(id);
}

/**
 * Attach a design file path to a specific order item.
 * @param {string} itemId  Order item UUID
 * @param {string} filePath  Server-side path from StorageService.save()
 */
export async function attachDesignFile(itemId, filePath) {
  await query('UPDATE order_items SET design_file_path = ? WHERE id = ?', [filePath, itemId]);
}

// ── Auto-invoice helper ────────────────────────────────────────────────────────

/**
 * Delete a custom order and its related data.
 * Only allowed for CS/admin on custom orders that haven't been paid yet.
 * @param {string} id  Order UUID
 * @returns {object} The deleted order row
 */
export async function deleteOrder(id) {
  const [[order]] = await query('SELECT * FROM orders WHERE id = ?', [id]);
  if (!order) {
    const err = new Error('Pesanan tidak ditemukan.');
    err.status = 404;
    throw err;
  }
  if (order.order_type !== 'custom') {
    const err = new Error('Hanya pesanan custom yang bisa dihapus.');
    err.status = 400;
    throw err;
  }
  const paidStatuses = ['Payment Accepted', 'Waiting for Design Approval', 'On Progress', 'Ready to Ship', 'Shipped', 'Completed'];
  if (paidStatuses.includes(order.status)) {
    const err = new Error('Pesanan yang sudah diproses tidak bisa dihapus.');
    err.status = 400;
    throw err;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Delete related records in dependency order
    const [invRows] = await conn.execute('SELECT id FROM invoices WHERE order_id = ?', [id]);
    for (const inv of invRows) {
      await conn.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [inv.id]);
    }
    await conn.execute('DELETE FROM invoices WHERE order_id = ?', [id]);
    await conn.execute('DELETE FROM order_items WHERE order_id = ?', [id]);
    await conn.execute('DELETE FROM order_history WHERE order_id = ?', [id]);
    await conn.execute('DELETE FROM orders WHERE id = ?', [id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return order;
}

/**
 * Otomatis buat invoice untuk order baru yang baru saja dibuat.
 * Dipanggil fire-and-forget dari createOrder().
 * Tidak throw — semua error dicatch di caller.
 * @param {object} order  Hasil dari getOrderById()
 */
async function autoCreateInvoice(order) {
  // Cek apakah sudah ada invoice untuk order ini
  const [[existing]] = await query('SELECT id FROM invoices WHERE order_id = ?', [order.id]);
  if (existing) return; // Sudah ada, skip

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Generate invoice number
    const [[row]] = await conn.execute('SELECT last_seq FROM invoice_sequence WHERE id = 1 FOR UPDATE');
    const newSeq = row.last_seq + 1;
    await conn.execute('UPDATE invoice_sequence SET last_seq = ? WHERE id = 1', [newSeq]);
    const seq = String(newSeq).padStart(6, '0');
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const invoiceNumber = `INV/${yyyy}/${mm}/${seq}`;

    const id = randomUUID();
    const subtotal = Number(order.subtotal || 0);
    const discountAmount = Number(order.discount_amount || 0);
    const taxAmount = 0;
    const total = subtotal - discountAmount + taxAmount;

    await conn.execute(
      `INSERT INTO invoices
         (id, invoice_number, order_id, customer_id, subtotal, discount_amount, tax_amount, total, payment_status, payment_method, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        invoiceNumber,
        order.id,
        order.customer_id || null,
        subtotal,
        discountAmount,
        taxAmount,
        total,
        'unpaid',
        null,
        null,
        null, // auto-generated — no creator
      ]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
