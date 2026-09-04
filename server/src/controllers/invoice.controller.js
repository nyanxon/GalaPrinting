/**
 * invoice.controller.js — Handlers untuk endpoint invoice.
 * Fitur 2 & 4: create, list, detail, update payment-status, generate PDF, kirim email.
 */

import * as svc from '../services/invoice.service.js';
import { generateInvoicePdf } from '../utils/invoicePdf.js';
import { sendInvoiceEmail } from '../services/email.service.js';

/** GET /api/invoices */
export async function listInvoices(req, res, next) {
  try {
    const { page, limit, payment_status } = req.query;
    const result = await svc.listInvoices({ page, limit, payment_status });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

/** POST /api/invoices */
export async function createInvoice(req, res, next) {
  try {
    const { order_id, discount_amount, tax_amount, payment_method, notes } = req.body;
    if (!order_id) {
      return res.status(422).json({ ok: false, message: 'order_id wajib diisi.' });
    }

    const invoice = await svc.createInvoice(order_id, req.user.id, {
      discount_amount,
      tax_amount,
      payment_method,
      notes,
    });

    return res.status(201).json({ ok: true, data: invoice });
  } catch (err) {
    if (err.status === 404 || err.status === 422) {
      return res.status(err.status).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

/** GET /api/invoices/:id */
export async function getInvoice(req, res, next) {
  try {
    const invoice = await svc.getInvoiceById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ ok: false, message: 'Invoice tidak ditemukan.' });
    }
    return res.json({ ok: true, data: invoice });
  } catch (err) {
    next(err);
  }
}

/** GET /api/orders/:orderId/invoice */
export async function getInvoiceByOrder(req, res, next) {
  try {
    const invoice = await svc.getInvoiceByOrderId(req.params.orderId);
    if (!invoice) {
      return res.status(404).json({ ok: false, message: 'Invoice untuk order ini belum dibuat.' });
    }
    return res.json({ ok: true, data: invoice });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/invoices/:id */
export async function updateInvoice(req, res, next) {
  try {
    const invoice = await svc.updateInvoice(req.params.id, req.body);
    return res.json({ ok: true, data: invoice });
  } catch (err) {
    if (err.status === 403 || err.status === 404) {
      return res.status(err.status).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

/** PATCH /api/invoices/:id/payment-status */
export async function updatePaymentStatus(req, res, next) {
  try {
    const { payment_status, payment_method, dp_amount } = req.body;
    if (!payment_status) {
      return res.status(422).json({ ok: false, message: 'payment_status wajib diisi.' });
    }
    if (!['unpaid', 'paid', 'dp'].includes(payment_status)) {
      return res.status(422).json({ ok: false, message: 'payment_status tidak valid. Gunakan: unpaid, paid, atau dp.' });
    }

    const invoice = await svc.updateInvoicePaymentStatus(req.params.id, payment_status, payment_method, dp_amount);

    // Kirim email PDF otomatis jika status berubah jadi paid (fire-and-forget)
    if (payment_status === 'paid' && invoice.customer_email) {
      sendInvoiceEmailAsync(invoice);
    }

    return res.json({ ok: true, data: invoice });
  } catch (err) {
    if (err.status === 403 || err.status === 404) {
      return res.status(err.status).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

/** POST /api/invoices/:id/send-email — generate PDF & kirim ke customer */
export async function sendInvoiceEmailEndpoint(req, res, next) {
  try {
    const invoice = await svc.getInvoiceById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ ok: false, message: 'Invoice tidak ditemukan.' });
    }
    if (!invoice.customer_email) {
      return res.status(422).json({ ok: false, message: 'Customer tidak memiliki email terdaftar.' });
    }

    await sendInvoiceEmailAsync(invoice);
    return res.json({ ok: true, message: 'Email invoice berhasil dikirim.' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/invoices/:id/pdf — stream PDF ke browser / response
 */
export async function downloadInvoicePdf(req, res, next) {
  try {
    const invoice = await svc.getInvoiceById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ ok: false, message: 'Invoice tidak ditemukan.' });
    }

    const { pdfBuffer } = await generateInvoicePdf(invoice);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${invoice.invoice_number}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

// ── Internal helper ───────────────────────────────────────────────────────────

/**
 * Generate PDF dan kirim ke email customer. Fire-and-forget safe.
 */
async function sendInvoiceEmailAsync(invoice) {
  try {
    const { pdfBuffer } = await generateInvoicePdf(invoice);
    await sendInvoiceEmail({ invoice, pdfBuffer });
  } catch (err) {
    console.error('[invoice] Failed to send invoice email:', err.message);
    // Fire-and-forget: jangan re-throw
  }
}
