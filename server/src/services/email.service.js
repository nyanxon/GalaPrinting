/**
 * email.service.js — Transactional email notifications via Resend SDK.
 *
 * All calls are fire-and-forget: callers should NOT await sendOrderNotification.
 * Failures are logged to console.error and never re-thrown, so email errors
 * cannot block the main order-status-update flow.
 */

import { Resend } from 'resend';
import { config } from '../config/env.js';

// ---------------------------------------------------------------------------
// Lazy initialisation — only create the client if an API key is configured.
// ---------------------------------------------------------------------------
let resendClient = null;

if (config.email.resendApiKey) {
  resendClient = new Resend(config.email.resendApiKey);
} else {
  console.warn('[email] RESEND_API_KEY not set — email notifications disabled');
}

// ---------------------------------------------------------------------------
// Mapping: order status → notification preference key + email metadata
// ---------------------------------------------------------------------------
const STATUS_TO_NOTIF = {
  'Payment Accepted': {
    prefKey: 'payment_accepted',
    subject: 'Pembayaran Diterima - Gala Printing',
    template: 'payment-accepted',
  },
  'In Delivery': {
    prefKey: 'order_shipped',
    subject: 'Pesanan Dikirim - Gala Printing',
    template: 'order-shipped',
  },
  Finished: {
    prefKey: 'order_finished',
    subject: 'Pesanan Selesai - Gala Printing',
    template: 'order-finished',
  },
  Cancelled: {
    prefKey: 'order_cancelled',
    subject: 'Pesanan Dibatalkan - Gala Printing',
    template: 'order-cancelled',
  },
};

// ---------------------------------------------------------------------------
// HTML builder — simple inline-styled email body
// ---------------------------------------------------------------------------
function buildEmailHtml(order, notifType) {
  const statusLabels = {
    'Payment Accepted': 'Pembayaran Diterima',
    'In Delivery': 'Pesanan Dikirim',
    Finished: 'Pesanan Selesai',
    Cancelled: 'Pesanan Dibatalkan',
  };

  const statusLabel = statusLabels[notifType] || notifType;
  const formattedPrice =
    typeof order.total_price === 'number'
      ? new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
        }).format(order.total_price)
      : order.total_price;

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${statusLabel} - Gala Printing</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a56db;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">
                Gala Printing
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">${statusLabel}</h2>
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                Halo <strong>${order.customer_name || 'Pelanggan'}</strong>,<br />
                Berikut adalah informasi terbaru mengenai pesanan Anda.
              </p>
              <!-- Order details table -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:24px;">
                <tr style="background-color:#f9fafb;">
                  <td style="padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;
                             text-transform:uppercase;letter-spacing:0.05em;width:40%;">
                    Nomor Pesanan
                  </td>
                  <td style="padding:12px 16px;color:#111827;font-size:14px;font-weight:600;">
                    ${order.order_number || order.id}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;
                             text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid #e5e7eb;">
                    Status
                  </td>
                  <td style="padding:12px 16px;color:#111827;font-size:14px;border-top:1px solid #e5e7eb;">
                    ${statusLabel}
                  </td>
                </tr>
                <tr style="background-color:#f9fafb;">
                  <td style="padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;
                             text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid #e5e7eb;">
                    Total Harga
                  </td>
                  <td style="padding:12px 16px;color:#111827;font-size:14px;border-top:1px solid #e5e7eb;">
                    ${formattedPrice}
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
                Jika Anda memiliki pertanyaan, silakan hubungi tim kami.<br />
                Terima kasih telah berbelanja di Gala Printing.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                &copy; ${new Date().getFullYear()} Gala Printing. Semua hak dilindungi.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send an order status notification email.
 *
 * This function is fire-and-forget — callers must NOT await it.
 * Any Resend error is caught and logged; it is never re-thrown.
 *
 * @param {object} order - Order object from the database.
 * @param {string} order.id
 * @param {string} order.order_number
 * @param {string} order.customer_email
 * @param {string} order.customer_name
 * @param {string} order.status
 * @param {number} order.total_price
 * @param {string} notifType - The new order status string (e.g. 'Payment Accepted').
 */
export async function sendOrderNotification(order, notifType) {
  // Email disabled — no API key configured
  if (!resendClient) return;

  // Unknown status — no mapping defined
  const mapping = STATUS_TO_NOTIF[notifType];
  if (!mapping) return;

  // Guard: need a recipient address
  if (!order.customer_email) {
    console.warn('[email] Order has no customer_email — skipping notification');
    return;
  }

  const html = buildEmailHtml(order, notifType);

  try {
    await resendClient.emails.send({
      from: config.email.fromEmail,
      to: order.customer_email,
      subject: mapping.subject,
      html,
    });
  } catch (err) {
    console.error('[email] Failed to send notification:', err.message);
    // Do NOT re-throw — email failure must not block the API response
  }
}

/**
 * Send a promo announcement email.
 *
 * This function is fire-and-forget — callers must NOT await it.
 * Any Resend error is caught and logged; it is never re-thrown.
 *
 * @param {object} promoData
 * @param {string} promoData.recipientEmail
 * @param {string} promoData.recipientName
 * @param {string} promoData.promoCode
 * @param {string} promoData.promoTitle
 * @param {string} promoData.promoDescription
 * @param {string|number} promoData.discountValue
 */
export async function sendPromoNotification(promoData) {
  // Email disabled — no API key configured
  if (!resendClient) return;

  const {
    recipientEmail,
    recipientName,
    promoCode,
    promoTitle,
    promoDescription,
    discountValue,
  } = promoData;

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Promo Terbaru - Gala Printing</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a56db;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">
                Gala Printing
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Promo Terbaru untuk Anda!</h2>
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                Halo <strong>${recipientName || 'Pelanggan'}</strong>,<br />
                Kami memiliki penawaran spesial yang sayang untuk dilewatkan.
              </p>
              <!-- Promo details table -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:24px;">
                <tr style="background-color:#f9fafb;">
                  <td style="padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;
                             text-transform:uppercase;letter-spacing:0.05em;width:40%;">
                    Judul Promo
                  </td>
                  <td style="padding:12px 16px;color:#111827;font-size:14px;font-weight:600;">
                    ${promoTitle}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;
                             text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid #e5e7eb;">
                    Deskripsi
                  </td>
                  <td style="padding:12px 16px;color:#374151;font-size:14px;border-top:1px solid #e5e7eb;">
                    ${promoDescription}
                  </td>
                </tr>
                <tr style="background-color:#f9fafb;">
                  <td style="padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;
                             text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid #e5e7eb;">
                    Diskon
                  </td>
                  <td style="padding:12px 16px;color:#111827;font-size:14px;border-top:1px solid #e5e7eb;">
                    ${discountValue}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;
                             text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid #e5e7eb;">
                    Kode Promo
                  </td>
                  <td style="padding:12px 16px;border-top:1px solid #e5e7eb;">
                    <span style="background-color:#eff6ff;color:#1a56db;font-size:16px;font-weight:700;
                                 padding:6px 12px;border-radius:4px;letter-spacing:0.1em;">
                      ${promoCode}
                    </span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
                Gunakan kode promo di atas saat checkout untuk mendapatkan diskon.<br />
                Terima kasih telah berbelanja di Gala Printing.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                &copy; ${new Date().getFullYear()} Gala Printing. Semua hak dilindungi.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    await resendClient.emails.send({
      from: config.email.fromEmail,
      to: recipientEmail,
      subject: 'Promo Terbaru - Gala Printing',
      html,
    });
  } catch (err) {
    console.error('[email] Failed to send promo notification:', err.message);
    // Do NOT re-throw — email failure must not block the API response
  }
}
