/**
 * invoice.service.js — Invoice management (cashier).
 * Fitur 2: generate invoice dari order, update payment_status, lock jika paid.
 */

import { randomUUID } from 'crypto';
import { query, pool } from '../db/connection.js';
import { parsePagination } from '../utils/pagination.js';

/**
 * Generate invoice number: INV/YYYY/MM/NNNNNN.
 * Atomic via SELECT ... FOR UPDATE di transaksi caller.
 * @param {import('mysql2/promise').PoolConnection} conn
 */
async function generateInvoiceNumber(conn) {
  const [[row]] = await conn.execute(
    'SELECT last_seq FROM invoice_sequence WHERE id = 1 FOR UPDATE'
  );
  const newSeq = row.last_seq + 1;
  await conn.execute('UPDATE invoice_sequence SET last_seq = ? WHERE id = 1', [newSeq]);
  const seq = String(newSeq).padStart(6, '0');

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');

  return `INV/${yyyy}/${mm}/${seq}`;
}

/**
 * Generate invoice dari order. Hitung total = subtotal - discount + tax.
 * Fitur: cashier bisa edit item/harga sebelum finalize (TODO di controller/frontend).
 * @param {string} orderId
 * @param {string} createdBy  Cashier user_id
 * @param {object} opts       { discount_amount?, tax_amount?, payment_method?, notes? }
 */
export async function createInvoice(orderId, createdBy, opts = {}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Ambil order untuk dapat subtotal, customer_id
    const [[order]] = await conn.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      const err = new Error('Order tidak ditemukan.');
      err.status = 404;
      throw err;
    }

    // Cek apakah sudah ada invoice untuk order ini
    const [[existingInv]] = await conn.execute('SELECT id FROM invoices WHERE order_id = ?', [orderId]);
    if (existingInv) {
      const err = new Error('Invoice untuk order ini sudah dibuat.');
      err.status = 422;
      throw err;
    }

    const invoiceNumber = await generateInvoiceNumber(conn);
    const id = randomUUID();

    const subtotal = Number(order.subtotal || 0);
    const discountAmount = Number(opts.discount_amount ?? order.discount_amount ?? 0);
    const taxAmount = Number(opts.tax_amount ?? order.tax_amount ?? 0);
    const total = subtotal - discountAmount + taxAmount;

    await conn.execute(
      `INSERT INTO invoices
         (id, invoice_number, order_id, customer_id, subtotal, discount_amount, tax_amount, total, payment_status, payment_method, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        invoiceNumber,
        orderId,
        order.customer_id || null,
        subtotal,
        discountAmount,
        taxAmount,
        total,
        'unpaid',
        opts.payment_method || null,
        opts.notes || null,
        createdBy,
      ]
    );

    await conn.commit();
    return getInvoiceById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Ambil invoice by ID + join order & customer.
 * @param {string} id
 */
export async function getInvoiceById(id) {
  const [rows] = await query(
    `SELECT
       i.*,
       o.order_number,
       o.customer_name,
       o.customer_phone,
       o.customer_address,
       o.discounts AS order_discounts,
       u.email AS customer_email,
       creator.name AS creator_name
     FROM invoices i
     LEFT JOIN orders o ON i.order_id = o.id
     LEFT JOIN users_customer u ON i.customer_id = u.id
     LEFT JOIN users_admin creator ON i.created_by = creator.id
     WHERE i.id = ?
     LIMIT 1`,
    [id]
  );
  if (rows.length === 0) return null;

  // Ambil item dari order terkait
  const [items] = await query('SELECT * FROM order_items WHERE order_id = ?', [rows[0].order_id]);
  return { ...rows[0], items };
}

/**
 * Ambil invoice berdasarkan order_id.
 * @param {string} orderId
 */
export async function getInvoiceByOrderId(orderId) {
  const [rows] = await query(
    `SELECT
       i.*,
       o.order_number,
       o.customer_name,
       o.customer_phone,
       o.customer_address,
       o.discounts AS order_discounts,
       u.email AS customer_email,
       creator.name AS creator_name
     FROM invoices i
     LEFT JOIN orders o ON i.order_id = o.id
     LEFT JOIN users_customer u ON i.customer_id = u.id
     LEFT JOIN users_admin creator ON i.created_by = creator.id
     WHERE i.order_id = ?
     LIMIT 1`,
    [orderId]
  );
  if (rows.length === 0) return null;

  const [items] = await query('SELECT * FROM order_items WHERE order_id = ?', [rows[0].order_id]);
  return { ...rows[0], items };
}

/**
 * List semua invoice dengan pagination + filter payment_status.
 * @param {{ page?, limit?, payment_status? }}
 */
export async function listInvoices({ page = 1, limit = 20, payment_status } = {}) {
  const { pageNum, limitNum, offset } = parsePagination(page, limit, 2000, 20);

  let whereClause = '';
  const params = [];
  if (payment_status) {
    whereClause = 'WHERE i.payment_status = ?';
    params.push(payment_status);
  }

  const [[{ total }]] = await query(
    `SELECT COUNT(*) AS total FROM invoices i ${whereClause}`,
    params
  );

  const [items] = await query(
    `SELECT
       i.id,
       i.invoice_number,
       i.order_id,
       o.order_number,
       i.customer_id,
       o.customer_name,
       i.total,
       i.payment_status,
       i.payment_method,
       i.created_at,
       i.paid_at,
       i.locked
     FROM invoices i
     LEFT JOIN orders o ON i.order_id = o.id
     ${whereClause}
     ORDER BY i.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  return {
    items,
    total: Number(total),
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(Number(total) / limitNum),
  };
}

/**
 * Update status pembayaran invoice. Jika paid, lock invoice & set paid_at.
 * @param {string} id
 * @param {string} newStatus  'unpaid'|'paid'|'dp'
 * @param {string} paymentMethod
 * @param {number} [dpAmount] nominal DP, WAJIB diisi jika newStatus = 'dp'
 *                            (harus > 0 dan < total). Nilai DP dipertahankan
 *                            sebagai histori walau status berubah ke status lain.
 */
export async function updateInvoicePaymentStatus(id, newStatus, paymentMethod, dpAmount) {
  const invoice = await getInvoiceById(id);
  if (!invoice) {
    const err = new Error('Invoice tidak ditemukan.');
    err.status = 404;
    throw err;
  }

  // Jika sudah locked (paid), tidak bisa diubah
  if (invoice.locked) {
    const err = new Error('Invoice sudah paid dan locked, tidak bisa diubah.');
    err.status = 403;
    throw err;
  }

  // Validasi status
  if (!['unpaid', 'paid', 'dp'].includes(newStatus)) {
    const err = new Error('payment_status tidak valid. Gunakan: unpaid, paid, atau dp.');
    err.status = 422;
    throw err;
  }

  const total = Number(invoice.total || 0);

  // Nominal DP wajib & masuk akal saat status = DP
  let dpAmountValue = null;
  if (newStatus === 'dp') {
    const dp = Number(dpAmount);
    if (!dpAmount || Number.isNaN(dp) || !Number.isFinite(dp)) {
      const err = new Error('Nominal DP wajib diisi.'); err.status = 422; throw err;
    }
    if (dp <= 0) {
      const err = new Error('Nominal DP harus lebih dari 0.'); err.status = 422; throw err;
    }
    if (dp >= total) {
      const err = new Error('Nominal DP harus lebih kecil dari total tagihan (jika lunas, gunakan status Lunas).');
      err.status = 422; throw err;
    }
    dpAmountValue = dp;
  } else {
    // Pertahankan dp_amount sebagai histori (tidak direset).
    dpAmountValue = invoice.dp_amount != null
      ? Number(invoice.dp_amount)
      : null;
  }

  const locked = newStatus === 'paid' ? 1 : 0;
  const paidAt = newStatus === 'paid' ? new Date() : null;

  await query(
    `UPDATE invoices
     SET payment_status = ?, payment_method = ?, dp_amount = ?, locked = ?, paid_at = ?
     WHERE id = ?`,
    [newStatus, paymentMethod || invoice.payment_method, dpAmountValue, locked, paidAt, id]
  );

  return getInvoiceById(id);
}

/**
 * Update notes atau fields lain invoice (hanya jika belum locked).
 * @param {string} id
 * @param {object} fields  { notes?, discount_amount?, tax_amount?, payment_method? }
 */
export async function updateInvoice(id, fields) {
  const invoice = await getInvoiceById(id);
  if (!invoice) {
    const err = new Error('Invoice tidak ditemukan.');
    err.status = 404;
    throw err;
  }

  if (invoice.locked) {
    const err = new Error('Invoice sudah paid dan locked, tidak bisa diedit.');
    err.status = 403;
    throw err;
  }

  const updates = [];
  const params = [];

  if (fields.notes !== undefined) {
    updates.push('notes = ?');
    params.push(fields.notes || null);
  }
  if (fields.discount_amount !== undefined) {
    updates.push('discount_amount = ?');
    params.push(Number(fields.discount_amount));
  }
  if (fields.tax_amount !== undefined) {
    updates.push('tax_amount = ?');
    params.push(Number(fields.tax_amount));
  }
  if (fields.payment_method !== undefined) {
    updates.push('payment_method = ?');
    params.push(fields.payment_method || null);
  }

  // Recalculate total jika ada perubahan discount/tax
  if (fields.discount_amount !== undefined || fields.tax_amount !== undefined) {
    const subtotal = Number(invoice.subtotal);
    const discount = Number(fields.discount_amount ?? invoice.discount_amount ?? 0);
    const tax = Number(fields.tax_amount ?? invoice.tax_amount ?? 0);
    const total = subtotal - discount + tax;
    updates.push('total = ?');
    params.push(total);
  }

  if (updates.length === 0) {
    return invoice; // Tidak ada perubahan
  }

  params.push(id);
  await query(`UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`, params);
  return getInvoiceById(id);
}
