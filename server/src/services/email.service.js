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
import { escapeHtml } from '../utils/escapeHtml.js';
import { BRAND_COLOR } from '../config/brand.js';

// ── Client init ───────────────────────────────────────────────────────────────

let resendClient = null;

if (config.email.resendApiKey) {
  resendClient = new Resend(config.email.resendApiKey);
} else {
  console.warn('[email] RESEND_API_KEY not set — all email sending disabled');
}

// ── Shared helpers ────────────────────────────────────────────────────────────

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
      Halo <strong>${escapeHtml(name)}</strong>,<br/>
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
      Halo <strong>${escapeHtml(name)}</strong>,<br/>
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
          <td style="padding:10px 16px;font-size:14px;border-top:1px solid #e5e7eb;">${escapeHtml(order.tracking_number)}${order.courier_name ? ' (' + escapeHtml(order.courier_name) + ')' : ''}</td></tr>`
    : '';

  const cancelRow = notifType === 'Cancelled' && order.cancellation_reason
    ? `<tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;border-top:1px solid #e5e7eb;">Alasan</td>
          <td style="padding:10px 16px;font-size:14px;border-top:1px solid #e5e7eb;">${escapeHtml(order.cancellation_reason)}</td></tr>`
    : '';

  const body = `
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">${meta.label}</h2>
    <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
      Halo <strong>${escapeHtml(order.customer_name || 'Pelanggan')}</strong>,<br/>
      Berikut adalah update terbaru mengenai pesanan Anda.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#faf8f5;">
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;width:42%;">Nomor Pesanan</td>
        <td style="padding:10px 16px;font-size:14px;font-weight:600;">${escapeHtml(order.order_number || order.id)}</td>
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
       <td style="padding:6px 12px;border-top:1px solid #f3f3f3;">${escapeHtml(item.name)}</td>
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
        <td style="padding:10px 16px;font-size:14px;font-weight:600;">${escapeHtml(order.order_number || order.id)}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;border-top:1px solid #e5e7eb;">Pelanggan</td>
        <td style="padding:10px 16px;font-size:14px;border-top:1px solid #e5e7eb;">${escapeHtml(order.customer_name || '—')}</td>
      </tr>
      <tr style="background:#faf8f5;">
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;border-top:1px solid #e5e7eb;">Telepon</td>
        <td style="padding:10px 16px;font-size:14px;border-top:1px solid #e5e7eb;">${escapeHtml(order.customer_phone || '—')}</td>
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
 * Kirim email invoice PDF ke customer saat pembayaran diterima.
 * Isi email: pesanan telah diterima, pengecekan pembayaran sedang dilakukan.
 * Lampiran: PDF invoice A4.
 * @param {{ invoice: object, pdfBuffer: Buffer }} opts
 */
export async function sendInvoiceEmail({ invoice, pdfBuffer }) {
  if (!resendClient) return;
  const to = invoice.customer_email;
  if (!to) return;

  const subject = `Pesanan Diterima — ${escapeHtml(invoice.invoice_number)} — Gala Printing`;

  // Build item rows for the invoice table
  const itemRows = (invoice.items || []).map((item) =>
    `<tr>
       <td style="padding:8px 14px;border-top:1px solid #e5e7eb;">${escapeHtml(item.name || '—')}</td>
       <td style="padding:8px 14px;border-top:1px solid #e5e7eb;text-align:center;">${item.quantity ?? 1}</td>
       <td style="padding:8px 14px;border-top:1px solid #e5e7eb;text-align:right;">${formatIDR(Number(item.price ?? 0))}</td>
       <td style="padding:8px 14px;border-top:1px solid #e5e7eb;text-align:right;">${formatIDR(Number(item.price ?? 0) * Number(item.quantity ?? 1))}</td>
     </tr>`
  ).join('');

  const body = `
  <tr><td style="padding:32px;">
    <!-- Greeting -->
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:800;">
      Pesanan Anda Telah Kami Terima! 🎉
    </h2>
    <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.7;">
      Halo <strong>${escapeHtml(invoice.customer_name || 'Pelanggan')}</strong>,<br/>
      Terima kasih telah mempercayakan pesanan Anda kepada <strong>Gala Printing</strong>.
      Kami telah menerima pesanan Anda dan saat ini sedang melakukan
      <strong>pengecekan pembayaran</strong>. Anda akan mendapat konfirmasi
      selanjutnya setelah verifikasi selesai.
    </p>

    <!-- Status badge -->
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background:#dcfce7;border:1px solid #bbf7d0;border-radius:8px;
                   padding:10px 20px;color:#166534;font-size:14px;font-weight:700;">
          ✅ Pembayaran Diterima — Pengecekan Sedang Berlangsung
        </td>
      </tr>
    </table>

    <!-- Order summary -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr style="background:#faf8f5;">
        <td style="padding:10px 16px;color:#6b7280;font-size:12px;font-weight:700;
                   text-transform:uppercase;letter-spacing:.04em;width:42%;">No. Invoice</td>
        <td style="padding:10px 16px;font-size:14px;font-weight:700;">${escapeHtml(invoice.invoice_number)}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#6b7280;font-size:12px;font-weight:700;
                   text-transform:uppercase;letter-spacing:.04em;border-top:1px solid #e5e7eb;">No. Pesanan</td>
        <td style="padding:10px 16px;font-size:14px;border-top:1px solid #e5e7eb;">${escapeHtml(invoice.order_number || '—')}</td>
      </tr>
      <tr style="background:#faf8f5;">
        <td style="padding:10px 16px;color:#6b7280;font-size:12px;font-weight:700;
                   text-transform:uppercase;letter-spacing:.04em;border-top:1px solid #e5e7eb;">Total</td>
        <td style="padding:10px 16px;font-size:15px;font-weight:800;color:${BRAND_COLOR};
                   border-top:1px solid #e5e7eb;">${formatIDR(Number(invoice.total ?? invoice.subtotal ?? 0))}</td>
      </tr>
    </table>

    <!-- Items table (if any) -->
    ${(invoice.items || []).length > 0 ? `
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#374151;">Detail Produk:</p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;font-size:13px;">
      <thead>
        <tr style="background:#faf8f5;">
          <th style="padding:8px 14px;text-align:left;color:#6b7280;font-weight:700;">Produk</th>
          <th style="padding:8px 14px;text-align:center;color:#6b7280;font-weight:700;">Qty</th>
          <th style="padding:8px 14px;text-align:right;color:#6b7280;font-weight:700;">Harga</th>
          <th style="padding:8px 14px;text-align:right;color:#6b7280;font-weight:700;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>` : ''}

    <!-- Info note -->
    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;">
      <tr>
        <td style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;
                   padding:14px 18px;color:#92400e;font-size:13px;line-height:1.6;">
          <strong>ℹ️ Informasi:</strong><br/>
          Invoice PDF terlampir pada email ini. Mohon simpan sebagai bukti pembayaran Anda.<br/>
          Tim kami akan menghubungi Anda jika ada informasi tambahan yang dibutuhkan.
        </td>
      </tr>
    </table>

    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
      Jika ada pertanyaan, jangan ragu untuk menghubungi kami.<br/>
      Terima kasih telah berbelanja di <strong>Gala Printing</strong>. 🙏
    </p>
  </td></tr>`;

  try {
    await resendClient.emails.send({
      from: config.email.fromEmail,
      to,
      subject,
      html: baseWrapper(body),
      attachments: [
        {
          filename: `invoice-${invoice.invoice_number}.pdf`,
          content: pdfBuffer.toString('base64'),
        },
      ],
    });
    console.log(`[email] Invoice PDF sent → ${to}`);
  } catch (err) {
    console.error('[email] Invoice email failed:', err.message);
    // Fire-and-forget
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
      Halo <strong>${escapeHtml(recipientName || 'Pelanggan')}</strong>,<br/>
      Kami memiliki penawaran spesial yang sayang untuk dilewatkan.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#faf8f5;">
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;width:40%;">Judul</td>
        <td style="padding:10px 16px;font-size:14px;font-weight:600;">${escapeHtml(promoTitle)}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;border-top:1px solid #e5e7eb;">Deskripsi</td>
        <td style="padding:10px 16px;font-size:14px;border-top:1px solid #e5e7eb;">${escapeHtml(promoDescription)}</td>
      </tr>
      <tr style="background:#faf8f5;">
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;border-top:1px solid #e5e7eb;">Diskon</td>
        <td style="padding:10px 16px;font-size:14px;border-top:1px solid #e5e7eb;">${escapeHtml(String(discountValue))}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;border-top:1px solid #e5e7eb;">Kode Promo</td>
        <td style="padding:10px 16px;border-top:1px solid #e5e7eb;">
          <span style="background:#fef3c7;color:#b45309;font-size:16px;font-weight:700;
                       padding:6px 14px;border-radius:4px;letter-spacing:0.1em;">
            ${escapeHtml(promoCode)}
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

// ── New Notification Emails ───────────────────────────────────────────────────

/**
 * Kirim notifikasi "Pesanan Diterima" ke customer saat order baru dibuat.
 * Fire-and-forget.
 * @param {{ customerEmail: string, customerName: string, orderNumber: string, subtotal: number, items: object[] }} opts
 */
export async function sendOrderReceivedEmail({ customerEmail, customerName, orderNumber, subtotal, items = [] }) {
  if (!resendClient || !customerEmail) return;

  const itemRows = items.map((item) =>
    `<tr>
       <td style="padding:7px 14px;border-top:1px solid #e5e7eb;">${escapeHtml(item.name || '—')}</td>
       <td style="padding:7px 14px;border-top:1px solid #e5e7eb;text-align:center;">${item.quantity ?? 1}</td>
       <td style="padding:7px 14px;border-top:1px solid #e5e7eb;text-align:right;">${formatIDR(Number(item.price ?? 0) * Number(item.quantity ?? 1))}</td>
     </tr>`
  ).join('');

  const body = `
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:800;">Pesanan Anda Diterima! 🎉</h2>
    <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.7;">
      Halo <strong>${escapeHtml(customerName || 'Pelanggan')}</strong>,<br/>
      Terima kasih telah memesan di <strong>Gala Printing</strong>!
      Kami telah menerima pesanan Anda dan sedang menunggu konfirmasi pembayaran.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr style="background:#faf8f5;">
        <td style="padding:10px 16px;color:#6b7280;font-size:12px;font-weight:700;
                   text-transform:uppercase;letter-spacing:.04em;width:42%;">No. Pesanan</td>
        <td style="padding:10px 16px;font-size:14px;font-weight:700;">${escapeHtml(orderNumber)}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#6b7280;font-size:12px;font-weight:700;
                   text-transform:uppercase;letter-spacing:.04em;border-top:1px solid #e5e7eb;">Total</td>
        <td style="padding:10px 16px;font-size:15px;font-weight:800;color:${BRAND_COLOR};
                   border-top:1px solid #e5e7eb;">${formatIDR(Number(subtotal ?? 0))}</td>
      </tr>
    </table>
    ${items.length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;font-size:13px;">
      <thead>
        <tr style="background:#faf8f5;">
          <th style="padding:8px 14px;text-align:left;color:#6b7280;font-weight:700;">Produk</th>
          <th style="padding:8px 14px;text-align:center;color:#6b7280;font-weight:700;">Qty</th>
          <th style="padding:8px 14px;text-align:right;color:#6b7280;font-weight:700;">Harga</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>` : ''}
    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
      Harap segera lakukan pembayaran dan upload bukti bayar agar pesanan dapat segera diproses.<br/>
      Terima kasih telah berbelanja di <strong>Gala Printing</strong>. 🙏
    </p>
  </td></tr>`;

  try {
    await sendEmail({
      to: customerEmail,
      subject: `Pesanan Diterima: ${orderNumber} — Gala Printing`,
      html: baseWrapper(body),
    });
  } catch (err) {
    console.error('[email] Order received email failed:', err.message);
  }
}

/**
 * Kirim notifikasi "Mockup / Desain Diterima" saat status → Design Accepted.
 * Fire-and-forget.
 * @param {{ customerEmail: string, customerName: string, orderNumber: string }} opts
 */
export async function sendMockupAcceptedEmail({ customerEmail, customerName, orderNumber }) {
  if (!resendClient || !customerEmail) return;

  const body = `
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:800;">Mockup Anda Telah Diterima! ✅</h2>
    <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.7;">
      Halo <strong>${escapeHtml(customerName || 'Pelanggan')}</strong>,<br/>
      Kabar baik! Mockup / desain untuk pesanan Anda telah disetujui dan
      kami akan segera memulai proses produksi.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#faf8f5;">
        <td style="padding:10px 16px;color:#6b7280;font-size:12px;font-weight:700;
                   text-transform:uppercase;letter-spacing:.04em;">No. Pesanan</td>
        <td style="padding:10px 16px;font-size:14px;font-weight:700;">${escapeHtml(orderNumber)}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#6b7280;font-size:12px;font-weight:700;
                   text-transform:uppercase;letter-spacing:.04em;border-top:1px solid #e5e7eb;">Status</td>
        <td style="padding:10px 16px;border-top:1px solid #e5e7eb;">
          <span style="background:#dcfce7;color:#166534;font-size:13px;font-weight:700;
                       padding:4px 12px;border-radius:6px;">Desain Disetujui</span>
        </td>
      </tr>
    </table>
    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
      Tim produksi kami akan segera mengerjakan pesanan Anda.<br/>
      Terima kasih telah berbelanja di <strong>Gala Printing</strong>. 🙏
    </p>
  </td></tr>`;

  try {
    await sendEmail({
      to: customerEmail,
      subject: `Mockup Diterima: ${orderNumber} — Gala Printing`,
      html: baseWrapper(body),
    });
  } catch (err) {
    console.error('[email] Mockup accepted email failed:', err.message);
  }
}

/**
 * Kirim notifikasi login dari device baru.
 * Awaitable — dipakai di auth flow (bukan fire-and-forget).
 * @param {{ to: string, name: string, device: string, ip: string, time: string }} opts
 */
export async function sendLoginNewDeviceEmail({ to, name, device, ip, time }) {
  if (!resendClient || !to) return;

  const body = `
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:800;">Login dari Perangkat Baru</h2>
    <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">
      Halo <strong>${escapeHtml(name || 'Pengguna')}</strong>,<br/>
      Kami mendeteksi login ke akun Anda dari perangkat atau lokasi baru.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr style="background:#faf8f5;">
        <td style="padding:10px 16px;color:#6b7280;font-size:12px;font-weight:700;
                   text-transform:uppercase;letter-spacing:.04em;width:38%;">Perangkat</td>
        <td style="padding:10px 16px;font-size:14px;">${escapeHtml(device || 'Tidak diketahui')}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#6b7280;font-size:12px;font-weight:700;
                   text-transform:uppercase;letter-spacing:.04em;border-top:1px solid #e5e7eb;">IP</td>
        <td style="padding:10px 16px;font-size:14px;border-top:1px solid #e5e7eb;">${escapeHtml(ip || '—')}</td>
      </tr>
      <tr style="background:#faf8f5;">
        <td style="padding:10px 16px;color:#6b7280;font-size:12px;font-weight:700;
                   text-transform:uppercase;letter-spacing:.04em;border-top:1px solid #e5e7eb;">Waktu</td>
        <td style="padding:10px 16px;font-size:14px;border-top:1px solid #e5e7eb;">${escapeHtml(time || '—')}</td>
      </tr>
    </table>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;
                   padding:12px 18px;color:#b91c1c;font-size:13px;font-weight:600;line-height:1.6;">
          ⚠️ Bukan Anda yang login? Segera ubah password akun Anda dan hubungi kami.
        </td>
      </tr>
    </table>
    <p style="margin:0;color:#9ca3af;font-size:12px;">
      Jika ini adalah Anda, abaikan email ini.
    </p>
  </td></tr>`;

  try {
    await sendEmail({
      to,
      subject: 'Login dari Perangkat Baru — Gala Printing',
      html: baseWrapper(body),
    });
  } catch (err) {
    console.error('[email] Login new device email failed:', err.message);
    // Don't re-throw — auth flow must not break on email failure
  }
}

/**
 * Kirim alert login gagal berkali-kali ke pemilik akun.
 * Awaitable — dipakai di auth flow.
 * @param {{ to: string, name: string, attempts: number, ip: string, time: string }} opts
 */
export async function sendLoginFailedAlertEmail({ to, name, attempts, ip, time }) {
  if (!resendClient || !to) return;

  const body = `
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:800;">
      ⚠️ Peringatan: Percobaan Login Gagal
    </h2>
    <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">
      Halo <strong>${escapeHtml(name || 'Pengguna')}</strong>,<br/>
      Kami mendeteksi <strong>${Number(attempts)} percobaan login yang gagal</strong>
      pada akun Anda dalam waktu singkat.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #fca5a5;border-radius:8px;overflow:hidden;margin-bottom:20px;
                  background:#fef2f2;">
      <tr>
        <td style="padding:10px 16px;color:#b91c1c;font-size:12px;font-weight:700;
                   text-transform:uppercase;letter-spacing:.04em;width:38%;">Percobaan Gagal</td>
        <td style="padding:10px 16px;font-size:15px;font-weight:800;color:#b91c1c;">${Number(attempts)}×</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#b91c1c;font-size:12px;font-weight:700;
                   text-transform:uppercase;letter-spacing:.04em;border-top:1px solid #fca5a5;">IP</td>
        <td style="padding:10px 16px;font-size:14px;color:#991b1b;
                   border-top:1px solid #fca5a5;">${escapeHtml(ip || '—')}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#b91c1c;font-size:12px;font-weight:700;
                   text-transform:uppercase;letter-spacing:.04em;border-top:1px solid #fca5a5;">Waktu</td>
        <td style="padding:10px 16px;font-size:14px;color:#991b1b;
                   border-top:1px solid #fca5a5;">${escapeHtml(time || '—')}</td>
      </tr>
    </table>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;
                   padding:14px 18px;color:#b91c1c;font-size:13px;line-height:1.6;">
          <strong>Apa yang harus dilakukan?</strong><br/>
          Jika bukan Anda, segera <strong>ubah password</strong> akun Anda dan aktifkan keamanan tambahan.
          Hubungi kami jika membutuhkan bantuan.
        </td>
      </tr>
    </table>
    <p style="margin:0;color:#9ca3af;font-size:12px;">
      Jika ini adalah Anda yang sedang mencoba login, pastikan password Anda benar.
    </p>
  </td></tr>`;

  try {
    await sendEmail({
      to,
      subject: '⚠️ Peringatan Keamanan: Percobaan Login Gagal — Gala Printing',
      html: baseWrapper(body),
    });
  } catch (err) {
    console.error('[email] Login failed alert email failed:', err.message);
  }
}
