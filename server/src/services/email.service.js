/**
 * email.service.js — All transactional email via Resend SDK.
 *
 * Functions:
 *   sendEmail()                — generic low-level send (awaitable)
 *   sendVerificationEmail()    — email verification link
 *   sendPasswordResetEmail()   — forgot-password reset link
 *   sendOrderNotification()    — order status change (fire-and-forget)
 *   sendNewOrderAdminAlert()   — alert to admin when a new order is placed
 *   sendPromoNotification()    — promo announcement to customer
 *
 * Fire-and-forget functions (sendOrderNotification, sendNewOrderAdminAlert,
 * sendPromoNotification) catch their own errors and NEVER re-throw —
 * email failures must not block the main API flow.
 */

import { Resend } from 'resend';
import { config } from '../config/env.js';

// ── Client init ───────────────────────────────────────────────────────────────

let resendClient = null;

if (config.email.resendApiKey) {
  resendClient = new Resend(config.email.resendApiKey);
} else {
  console.warn('[email] RESEND_API_KEY not set — all email sending disabled');
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const BRAND_COLOR   = '#785E40';
const YEAR          = new Date().getFullYear();

function baseWrapper(bodyHtml) {
  const logoUrl = `${config.email.frontendUrl}/gala-logo2.svg`;
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:10px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:${BRAND_COLOR};padding:20px 32px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;padding-right:14px;">
                  <img src="${logoUrl}" alt="Gala Printing logo"
                       width="48" height="48"
                       style="display:block;border-radius:6px;object-fit:contain;"
                       onerror="this.style.display='none'" />
                </td>
                <td style="vertical-align:middle;">
                  <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                    Gala Printing
                  </h1>
                  <p style="margin:3px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">
                    galaprintofficialbali.co.id
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        ${bodyHtml}
        <!-- Footer -->
        <tr>
          <td style="background:#faf8f5;padding:16px 32px;border-top:1px solid #ede9e4;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
              &copy; ${YEAR} Gala Printing. Semua hak dilindungi.<br/>
              Jl. Tibung Sari Gg. Camplung No.5X, Kwanji, Dalung, Kuta Utara, Badung Regency, Bali — noreply@galaprintofficialbali.co.id
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(href, label) {
  return `
  <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="border-radius:8px;background:${BRAND_COLOR};">
        <a href="${href}"
           style="display:inline-block;padding:14px 28px;color:#fff;font-size:15px;
                  font-weight:700;text-decoration:none;border-radius:8px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

function formatIDR(amount) {
  return typeof amount === 'number'
    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
    : (amount ?? '—');
}

// ── Generic send ──────────────────────────────────────────────────────────────

/**
 * Low-level send — awaitable, throws on failure.
 * @param {{ to: string, subject: string, html: string }} opts
 */
export async function sendEmail({ to, subject, html }) {
  if (!resendClient) {
    console.warn('[email] Skipping send — no API key configured');
    return;
  }
  // Sanitize: never log the full token inside subject/html
  console.log(`[email] Sending "${subject}" → ${to}`);
  try {
    const result = await resendClient.emails.send({
      from: config.email.fromEmail,
      to,
      subject,
      html,
    });
    console.log('[email] Sent OK, id:', result?.data?.id ?? 'unknown');
    return result;
  } catch (err) {
    console.error('[email] Send failed:', err.message);
    throw err;
  }
}

// ── Email Verification ────────────────────────────────────────────────────────

/**
 * Send account email-verification link.
 * @param {{ to: string, name: string, verifyUrl: string }} opts
 */
export async function sendVerificationEmail({ to, name, verifyUrl }) {
  const body = `
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">Verifikasi Email Anda</h2>
    <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
      Halo <strong>${escHtml(name)}</strong>,<br/>
      Terima kasih telah mendaftar di Gala Printing. Klik tombol di bawah untuk
      memverifikasi alamat email Anda dan mengaktifkan akun Anda.
    </p>
    ${ctaButton(verifyUrl, 'Verifikasi Email Saya')}
    <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.6;">
      Link ini berlaku selama <strong>24 jam</strong>.<br/>
      Jika Anda tidak mendaftar, abaikan email ini.
    </p>
    <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">
      Tidak bisa klik tombol? Copy link berikut ke browser:<br/>
      <a href="${verifyUrl}" style="color:${BRAND_COLOR};word-break:break-all;">${verifyUrl}</a>
    </p>
  </td></tr>`;

  return sendEmail({
    to,
    subject: 'Verifikasi Email Anda — Gala Printing',
    html: baseWrapper(body),
  });
}

// ── Forgot / Reset Password ───────────────────────────────────────────────────

/**
 * Send password-reset link.
 * @param {{ to: string, name: string, resetUrl: string }} opts
 */
export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const body = `
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">Reset Password Anda</h2>
    <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
      Halo <strong>${escHtml(name)}</strong>,<br/>
      Kami menerima permintaan untuk mereset password akun Anda di Gala Printing.
      Klik tombol di bawah untuk membuat password baru.
    </p>
    ${ctaButton(resetUrl, 'Reset Password Saya')}
    <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.6;">
      Link ini berlaku selama <strong>1 jam</strong>.<br/>
      Jika Anda tidak meminta reset password, abaikan email ini — password Anda
      tidak akan berubah.
    </p>
    <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">
      Tidak bisa klik tombol? Copy link berikut ke browser:<br/>
      <a href="${resetUrl}" style="color:${BRAND_COLOR};word-break:break-all;">${resetUrl}</a>
    </p>
  </td></tr>`;

  return sendEmail({
    to,
    subject: 'Reset Password Anda — Gala Printing',
    html: baseWrapper(body),
  });
}

// ── Order Notifications ───────────────────────────────────────────────────────

const STATUS_META = {
  'Payment Accepted': { subject: 'Pembayaran Diterima — Gala Printing',   label: 'Pembayaran Diterima' },
  'In Delivery':      { subject: 'Pesanan Sedang Dikirim — Gala Printing', label: 'Pesanan Dikirim' },
  'Finished':         { subject: 'Pesanan Selesai — Gala Printing',        label: 'Pesanan Selesai' },
  'Cancelled':        { subject: 'Pesanan Dibatalkan — Gala Printing',     label: 'Pesanan Dibatalkan' },
};

/**
 * Send order status change notification to customer. Fire-and-forget.
 */
export async function sendOrderNotification(order, notifType) {
  if (!resendClient) return;
  const meta = STATUS_META[notifType];
  if (!meta || !order.customer_email) return;

  const trackRow = order.tracking_number
    ? `<tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;border-top:1px solid #e5e7eb;">Nomor Resi</td>
          <td style="padding:10px 16px;font-size:14px;border-top:1px solid #e5e7eb;">${escHtml(order.tracking_number)}${order.courier_name ? ' (' + escHtml(order.courier_name) + ')' : ''}</td></tr>`
    : '';

  const cancelRow = notifType === 'Cancelled' && order.cancellation_reason
    ? `<tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;border-top:1px solid #e5e7eb;">Alasan</td>
          <td style="padding:10px 16px;font-size:14px;border-top:1px solid #e5e7eb;">${escHtml(order.cancellation_reason)}</td></tr>`
    : '';

  const body = `
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">${meta.label}</h2>
    <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
      Halo <strong>${escHtml(order.customer_name || 'Pelanggan')}</strong>,<br/>
      Berikut adalah update terbaru mengenai pesanan Anda.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#faf8f5;">
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;width:42%;">Nomor Pesanan</td>
        <td style="padding:10px 16px;font-size:14px;font-weight:600;">${escHtml(order.order_number || order.id)}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;border-top:1px solid #e5e7eb;">Status</td>
        <td style="padding:10px 16px;font-size:14px;border-top:1px solid #e5e7eb;">${meta.label}</td>
      </tr>
      <tr style="background:#faf8f5;">
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;border-top:1px solid #e5e7eb;">Total</td>
        <td style="padding:10px 16px;font-size:14px;border-top:1px solid #e5e7eb;">${formatIDR(order.subtotal ?? order.total_price)}</td>
      </tr>
      ${trackRow}${cancelRow}
    </table>
    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
      Terima kasih telah berbelanja di Gala Printing.
    </p>
  </td></tr>`;

  try {
    await sendEmail({ to: order.customer_email, subject: meta.subject, html: baseWrapper(body) });
  } catch (err) {
    console.error('[email] Order notification failed:', err.message);
    // Fire-and-forget — never re-throw
  }
}

/**
 * Alert admin when a new order is placed. Fire-and-forget.
 */
export async function sendNewOrderAdminAlert(order) {
  if (!resendClient || !config.email.adminEmail) return;

  const itemRows = (order.items || []).map((item) =>
    `<tr>
       <td style="padding:6px 12px;border-top:1px solid #f3f3f3;">${escHtml(item.name)}</td>
       <td style="padding:6px 12px;border-top:1px solid #f3f3f3;text-align:center;">${item.quantity}</td>
       <td style="padding:6px 12px;border-top:1px solid #f3f3f3;text-align:right;">${formatIDR(item.price * item.quantity)}</td>
     </tr>`
  ).join('');

  const body = `
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">Pesanan Baru Masuk 🎉</h2>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:20px;">
      <tr style="background:#faf8f5;">
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;width:42%;">Nomor Pesanan</td>
        <td style="padding:10px 16px;font-size:14px;font-weight:600;">${escHtml(order.order_number || order.id)}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;border-top:1px solid #e5e7eb;">Pelanggan</td>
        <td style="padding:10px 16px;font-size:14px;border-top:1px solid #e5e7eb;">${escHtml(order.customer_name || '—')}</td>
      </tr>
      <tr style="background:#faf8f5;">
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;border-top:1px solid #e5e7eb;">Telepon</td>
        <td style="padding:10px 16px;font-size:14px;border-top:1px solid #e5e7eb;">${escHtml(order.customer_phone || '—')}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;border-top:1px solid #e5e7eb;">Total</td>
        <td style="padding:10px 16px;font-size:14px;font-weight:700;border-top:1px solid #e5e7eb;">${formatIDR(order.subtotal)}</td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <tr style="background:#faf8f5;">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Produk</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;">Qty</th>
        <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;">Harga</th>
      </tr>
      ${itemRows || '<tr><td colspan="3" style="padding:12px;color:#9ca3af;font-size:13px;">—</td></tr>'}
    </table>
  </td></tr>`;

  try {
    await sendEmail({
      to: config.email.adminEmail,
      subject: `Pesanan Baru: ${order.order_number || order.id} — Gala Printing`,
      html: baseWrapper(body),
    });
  } catch (err) {
    console.error('[email] Admin alert failed:', err.message);
  }
}

/**
 * Send promo announcement to a customer. Fire-and-forget.
 */
export async function sendPromoNotification(promoData) {
  if (!resendClient) return;
  const { recipientEmail, recipientName, promoCode, promoTitle, promoDescription, discountValue } = promoData;

  const body = `
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">Promo Terbaru untuk Anda! 🎁</h2>
    <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
      Halo <strong>${escHtml(recipientName || 'Pelanggan')}</strong>,<br/>
      Kami memiliki penawaran spesial yang sayang untuk dilewatkan.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#faf8f5;">
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;width:40%;">Judul</td>
        <td style="padding:10px 16px;font-size:14px;font-weight:600;">${escHtml(promoTitle)}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;border-top:1px solid #e5e7eb;">Deskripsi</td>
        <td style="padding:10px 16px;font-size:14px;border-top:1px solid #e5e7eb;">${escHtml(promoDescription)}</td>
      </tr>
      <tr style="background:#faf8f5;">
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;border-top:1px solid #e5e7eb;">Diskon</td>
        <td style="padding:10px 16px;font-size:14px;border-top:1px solid #e5e7eb;">${escHtml(String(discountValue))}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;border-top:1px solid #e5e7eb;">Kode Promo</td>
        <td style="padding:10px 16px;border-top:1px solid #e5e7eb;">
          <span style="background:#fef3c7;color:#b45309;font-size:16px;font-weight:700;
                       padding:6px 14px;border-radius:4px;letter-spacing:0.1em;">
            ${escHtml(promoCode)}
          </span>
        </td>
      </tr>
    </table>
  </td></tr>`;

  try {
    await sendEmail({
      to: recipientEmail,
      subject: 'Promo Terbaru — Gala Printing',
      html: baseWrapper(body),
    });
  } catch (err) {
    console.error('[email] Promo notification failed:', err.message);
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

/** Minimal HTML escape to prevent XSS in email templates */
function escHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
