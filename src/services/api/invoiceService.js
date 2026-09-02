/**
 * invoiceService.js — Frontend service untuk invoice (Fitur 2 & 4).
 */

import { api } from '../../core/httpClient.js';

/**
 * @typedef {object} Invoice
 * @property {string} id
 * @property {string} invoice_number
 * @property {string} order_id
 * @property {string} order_number
 * @property {string} customer_name
 * @property {string} customer_phone
 * @property {string} customer_email
 * @property {number} subtotal
 * @property {number} discount_amount
 * @property {number} tax_amount
 * @property {number} total
 * @property {'unpaid'|'paid'|'dp'} payment_status
 * @property {string|null} payment_method
 * @property {number|null} dp_amount
 * @property {string|null} notes
 * @property {string} created_by
 * @property {string} creator_name
 * @property {string} created_at
 * @property {string|null} paid_at
 * @property {boolean} locked
 * @property {object[]} items
 */

/**
 * List semua invoice dengan filter opsional.
 * @param {{ page?: number, limit?: number, payment_status?: string }} opts
 * @returns {Promise<{ items: Invoice[], total: number, page: number, totalPages: number }>}
 */
export async function listInvoices({ page = 1, limit = 20, payment_status = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (payment_status) params.set('payment_status', payment_status);
  const res = await api.get(`/api/invoices?${params.toString()}`);
  return res.data;
}

/**
 * Buat invoice baru dari order.
 * @param {{ order_id: string, discount_amount?: number, tax_amount?: number, payment_method?: string, notes?: string }} body
 * @returns {Promise<Invoice>}
 */
export async function createInvoice(body) {
  const res = await api.post('/api/invoices', body);
  return res.data.data;
}

/**
 * Detail invoice by ID.
 * @param {string} id
 * @returns {Promise<Invoice>}
 */
export async function getInvoiceById(id) {
  const res = await api.get(`/api/invoices/${id}`);
  return res.data.data;
}

/**
 * Ambil invoice berdasarkan order ID.
 * @param {string} orderId
 * @returns {Promise<Invoice|null>}
 */
export async function getInvoiceByOrderId(orderId) {
  try {
    const res = await api.get(`/api/orders/${orderId}/invoice`);
    return res.data.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

/**
 * Update invoice (notes, discount, tax, payment_method) — hanya jika belum locked.
 * @param {string} id
 * @param {Partial<Invoice>} fields
 * @returns {Promise<Invoice>}
 */
export async function updateInvoice(id, fields) {
  const res = await api.patch(`/api/invoices/${id}`, fields);
  return res.data.data;
}

/**
 * Update payment status invoice.
 * @param {string} id
 * @param {'unpaid'|'paid'|'dp'} paymentStatus
 * @param {string} [paymentMethod]
 * @param {number|string} [dpAmount] nominal DP, wajib jika paymentStatus = 'dp'
 * @returns {Promise<Invoice>}
 */
export async function updateInvoicePaymentStatus(id, paymentStatus, paymentMethod, dpAmount) {
  const res = await api.patch(`/api/invoices/${id}/payment-status`, {
    payment_status: paymentStatus,
    payment_method: paymentMethod,
    dp_amount: dpAmount,
  });
  return res.data.data;
}

/**
 * Kirim email invoice PDF ke customer.
 * @param {string} id
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function sendInvoiceEmail(id) {
  const res = await api.post(`/api/invoices/${id}/send-email`);
  return res.data;
}

/**
 * Download / buka PDF invoice di tab baru.
 * Fetch menggunakan axios agar Authorization header ikut dikirim (token tidak invalid).
 * @param {string} id
 */
export async function openInvoicePdf(id) {
  try {
    const res = await api.get(`/api/invoices/${id}/pdf`, { responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    // Revoke setelah dibuka agar tidak bocor memori
    if (win) {
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  } catch (err) {
    console.error('[invoice] Failed to open PDF:', err.message);
    throw err;
  }
}

/**
 * Set delivery method pada order.
 * @param {string} orderId
 * @param {'delivery'|'pickup_factory'|'pickup_store'} method
 */
export async function setOrderDeliveryMethod(orderId, method) {
  const res = await api.patch(`/api/orders/${orderId}/delivery-method`, { delivery_method: method });
  return res.data.data;
}

/**
 * Set info pickup (lokasi + jadwal).
 * @param {string} orderId
 * @param {{ pickup_location: string, pickup_ready_at?: string }} opts
 */
export async function setOrderPickupInfo(orderId, opts) {
  const res = await api.patch(`/api/orders/${orderId}/pickup`, opts);
  return res.data.data;
}
