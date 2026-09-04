/**
 * invoicePdf.js — Generate PDF invoice A4 menggunakan pdfkit.
 * Fitur 4: PDF A4 untuk dikirim ke email customer.
 *
 * Returns { pdfBuffer: Buffer }
 */

import PDFDocument from 'pdfkit';
import { BRAND_COLOR } from '../config/brand.js';
import { parseDiscountList, discountTotalFor } from './discounts.js';

const GRAY_HEX  = '#6b7280';
const BLACK_HEX = '#111827';

function formatIDR(amount) {
  const num = Number(amount || 0);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
}

function formatDate(date) {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function escStr(val) {
  return typeof val === 'string' ? val : String(val ?? '—');
}

/**
 * Generate PDF invoice A4.
 * @param {object} invoice  Data invoice dari svc.getInvoiceById() (includes items, customer fields)
 * @returns {Promise<{ pdfBuffer: Buffer }>}
 */
export async function generateInvoicePdf(invoice) {
  return new Promise((resolve, reject) => {
    try {
      const chunks = [];
      const doc = new PDFDocument({ size: 'A4', margin: 50, margin_bottom: 10 });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve({ pdfBuffer: Buffer.concat(chunks) }));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const margin = 50;
      const contentWidth = pageWidth - margin * 2;

      // ── Header ──────────────────────────────────────────────────────────
      doc.fillColor(BRAND_COLOR).rect(0, 0, pageWidth, 90).fill();

      // Nama perusahaan
      doc
        .fillColor('#ffffff')
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('Gala Printing', margin, 28);

      doc
        .fillColor('rgba(255,255,255,0.8)')
        .fontSize(10)
        .font('Helvetica')
        .text('galaprintofficialbali.co.id', margin, 54);

      // Label INVOICE
      doc
        .fillColor('#ffffff')
        .fontSize(28)
        .font('Helvetica-Bold')
        .text('INVOICE', pageWidth - margin - 120, 28, { align: 'right', width: 120 });

      doc.fillColor(BLACK_HEX);

      // ── Info Box ─────────────────────────────────────────────────────────
      const infoY = 110;
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor(GRAY_HEX)
        .text('No. Invoice:', margin, infoY)
        .text('Tanggal:', margin, infoY + 18)
        .text('Status Bayar:', margin, infoY + 36);

      const statusColors = {
        paid:    '#15803d',
        unpaid:  '#b91c1c',
        dp:      '#c2800d',
      };
      const statusLabels = { paid: 'LUNAS', unpaid: 'BELUM BAYAR', dp: 'DP' };

      doc
        .fillColor(BLACK_HEX)
        .font('Helvetica-Bold')
        .text(escStr(invoice.invoice_number), margin + 90, infoY)
        .font('Helvetica')
        .text(formatDate(invoice.created_at), margin + 90, infoY + 18);

      const psColor = statusColors[invoice.payment_status] || BLACK_HEX;
      doc
        .fillColor(psColor)
        .font('Helvetica-Bold')
        .text(statusLabels[invoice.payment_status] || escStr(invoice.payment_status), margin + 90, infoY + 36);

      // No. Order di kanan
      doc
        .fillColor(GRAY_HEX)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('No. Pesanan:', pageWidth / 2 + 10, infoY)
        .text('Tgl. Bayar:', pageWidth / 2 + 10, infoY + 18)
        .text('Metode Bayar:', pageWidth / 2 + 10, infoY + 36);

      doc
        .fillColor(BLACK_HEX)
        .font('Helvetica')
        .text(escStr(invoice.order_number), pageWidth / 2 + 100, infoY)
        .text(invoice.paid_at ? formatDate(invoice.paid_at) : '—', pageWidth / 2 + 100, infoY + 18)
        .text(invoice.payment_method || '—', pageWidth / 2 + 100, infoY + 36);

      // ── Billing Info ──────────────────────────────────────────────────────
      const billY = infoY + 70;
      doc
        .fillColor(BRAND_COLOR)
        .rect(margin, billY, contentWidth, 22)
        .fill();

      doc
        .fillColor('#ffffff')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('TAGIHAN KEPADA', margin + 10, billY + 6);

      doc
        .fillColor(BLACK_HEX)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(escStr(invoice.customer_name), margin, billY + 30);

      const phoneStr = invoice.customer_phone ? `Telp: ${invoice.customer_phone}` : '';
      const emailStr = invoice.customer_email ? `Email: ${invoice.customer_email}` : '';
      const addrStr  = invoice.customer_address || '';

      doc.font('Helvetica').fontSize(10).fillColor(GRAY_HEX);
      if (phoneStr) doc.text(phoneStr, margin, billY + 46);
      if (emailStr) doc.text(emailStr, margin, billY + (phoneStr ? 60 : 46));
      if (addrStr)  doc.text(addrStr,  margin, billY + 74, { width: contentWidth / 2 - 10 });

      // ── Items Table ──────────────────────────────────────────────────────
      const tableY = billY + 130;

      // Header row
      doc.fillColor(BRAND_COLOR).rect(margin, tableY, contentWidth, 24).fill();

      const colX = {
        no:    margin,
        item:  margin + 30,
        qty:   margin + contentWidth * 0.55,
        price: margin + contentWidth * 0.70,
        sub:   margin + contentWidth * 0.85,
      };

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('No', colX.no + 5, tableY + 8)
        .text('Item / Produk', colX.item, tableY + 8)
        .text('Qty', colX.qty, tableY + 8)
        .text('Harga Satuan', colX.price, tableY + 8)
        .text('Subtotal', colX.sub, tableY + 8);

      // Item rows
      const items = Array.isArray(invoice.items) ? invoice.items : [];
      let currentY = tableY + 24;

      items.forEach((item, idx) => {
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#faf8f5';
        // Item produk per m² menampilkan dimensi (P × L cm) di baris kedua.
        const hasDim = Boolean(item.length_cm && item.width_cm);
        // Diskon manual per item: tampilkan rincian potongan di baris tambahan.
        const itemDiscRows = parseDiscountList(item.discounts);
        const itemGross = Number(item.price || 0) * Number(item.quantity || 1);
        const itemDiscAmt = itemDiscRows.length > 0 ? discountTotalFor(itemDiscRows, itemGross) : 0;
        const rowH = 22 + (hasDim ? 12 : 0) + (itemDiscAmt > 0 ? 12 : 0);

        doc.fillColor(rowBg).rect(margin, currentY, contentWidth, rowH).fill();

        // Bottom border
        doc.strokeColor('#e5e7eb').lineWidth(0.5)
          .moveTo(margin, currentY + rowH)
          .lineTo(margin + contentWidth, currentY + rowH)
          .stroke();

        const subTotal = Number(item.price || 0) * Number(item.quantity || 1);

        doc
          .fillColor(BLACK_HEX)
          .font('Helvetica')
          .fontSize(9)
          .text(String(idx + 1), colX.no + 5, currentY + 7)
          .text(escStr(item.name), colX.item, currentY + 7, { width: colX.qty - colX.item - 10, ellipsis: true })
          .text(String(item.quantity || 1), colX.qty, currentY + 7)
          .text(formatIDR(item.price), colX.price, currentY + 7, { width: colX.sub - colX.price - 5 })
          .text(formatIDR(subTotal), colX.sub, currentY + 7, { width: margin + contentWidth - colX.sub - 5 });

        let extraY = currentY + 19;
        if (hasDim) {
          doc
            .fillColor(GRAY_HEX)
            .font('Helvetica')
            .fontSize(7.5)
            .text(escStr(`${item.length_cm} × ${item.width_cm} cm`), colX.item, extraY, { width: colX.qty - colX.item - 10, ellipsis: true });
          extraY += 12;
        }
        if (itemDiscAmt > 0) {
          const discLabel = itemDiscRows
            .map((d) => (d.label || (d.type === 'percentage' ? `${d.value}%` : 'Nominal')))
            .join(' + ');
          doc
            .fillColor('#15803d')
            .font('Helvetica')
            .fontSize(7.5)
            .text(escStr(`Diskon (${discLabel}): -${formatIDR(itemDiscAmt)}`), colX.item, extraY, { width: colX.qty - colX.item - 10, ellipsis: true });
        }

        currentY += rowH;
      });

      if (items.length === 0) {
        doc.fillColor(GRAY_HEX).font('Helvetica').fontSize(10)
          .text('—', margin + 10, currentY + 8);
        currentY += 30;
      }

      // ── Totals ───────────────────────────────────────────────────────────
      const totalsX = margin + contentWidth * 0.60;
      const totalsLabelX = totalsX;
      const totalsValueX = margin + contentWidth - 80;
      currentY += 10;

      // Rincian diskon manual: per item + per baris diskon subtotal
      // (additive — tiap baris dihitung dari basis gross yang sama).
      const orderDiscRows = parseDiscountList(invoice.order_discounts);
      const itemsGrossSum = items.reduce(
        (s, it) => s + Number(it.price || 0) * Number(it.quantity || 1),
        0
      );
      const itemDiscTotal = items.reduce((s, it) => {
        const rows = parseDiscountList(it.discounts);
        if (rows.length === 0) return s;
        const gross = Number(it.price || 0) * Number(it.quantity || 1);
        return s + discountTotalFor(rows, gross);
      }, 0);

      const discountDetailRows = [];
      if (itemDiscTotal > 0) {
        discountDetailRows.push({
          label: 'Diskon item',
          val: `-${formatIDR(itemDiscTotal)}`,
          style: 'detail',
        });
      }
      orderDiscRows.forEach((d) => {
        const amt = discountTotalFor([d], itemsGrossSum);
        if (amt <= 0) return;
        const jenis = d.type === 'percentage' ? `${d.value}%` : formatIDR(d.value);
        const name = d.label ? `${d.label} (${jenis})` : jenis;
        discountDetailRows.push({
          label: `Diskon ${name}`,
          val: `-${formatIDR(amt)}`,
          style: 'detail',
        });
      });

      const discountRows = discountDetailRows.length > 0
        ? discountDetailRows
        : Number(invoice.discount_amount || 0) > 0
          ? [{ label: 'Diskon', val: `-${formatIDR(invoice.discount_amount)}`, style: 'normal', raw: true }]
          : [];

      const totalRows = [
        { label: 'Subtotal',  val: invoice.subtotal, style: 'normal' },
        ...discountRows,
        { label: 'Pajak',     val: invoice.tax_amount, style: 'normal' },
        { label: 'TOTAL',     val: invoice.total, style: 'bold' },
      ];

      totalRows.forEach(({ label, val, style, raw }) => {
        const isBold = style === 'bold';
        const displayVal = raw || style === 'detail' ? val : formatIDR(val);

        if (isBold) {
          doc.fillColor(BRAND_COLOR).rect(totalsLabelX - 10, currentY - 2, contentWidth - (totalsLabelX - margin - 10) + 10, 22).fill();
          doc
            .fillColor('#ffffff')
            .font('Helvetica-Bold')
            .fontSize(11)
            .text(label, totalsLabelX, currentY + 4)
            .text(displayVal, totalsValueX, currentY + 4, { align: 'right', width: 80 });
          currentY += 26;
        } else {
          doc
            .fillColor(GRAY_HEX)
            .font('Helvetica')
            .fontSize(9)
            .text(label, totalsLabelX, currentY + 3)
            .fillColor(BLACK_HEX)
            .text(displayVal, totalsValueX, currentY + 3, { align: 'right', width: 80 });
          currentY += 18;
        }
      });

      // Baris DP & Sisa/Pelunasan — saat status = DP, atau saat LUNAS yang
      // berawal dari DP (dp_amount dipertahankan sebagai histori).
      const hasDpHistory = invoice.payment_status === 'dp'
        || (invoice.payment_status === 'paid' && invoice.dp_amount != null);
      if (hasDpHistory) {
        const dpPaid = Number(invoice.dp_amount || 0);
        const remaining = Math.max(Number(invoice.total || 0) - dpPaid, 0);

        currentY += 8;

        const dpLabel = invoice.dp_paid_at
          ? `DP (${formatDate(invoice.dp_paid_at)})`
          : 'DP';

        doc
          .fillColor(GRAY_HEX)
          .font('Helvetica')
          .fontSize(9)
          .text(dpLabel, totalsLabelX, currentY + 3)
          .fillColor(BLACK_HEX)
          .text(formatIDR(dpPaid), totalsValueX, currentY + 3, { align: 'right', width: 80 });
        currentY += 18;

        if (invoice.payment_status === 'dp') {
          doc
            .fillColor(GRAY_HEX)
            .font('Helvetica')
            .fontSize(9)
            .text('Sisa Pembayaran', totalsLabelX, currentY + 3)
            .fillColor('#b91c1c')
            .font('Helvetica-Bold')
            .text(formatIDR(remaining), totalsValueX, currentY + 3, { align: 'right', width: 80 });
        } else {
          const pelunasanLabel = invoice.paid_at
            ? `Pelunasan (${formatDate(invoice.paid_at)})`
            : 'Pelunasan';
          doc
            .fillColor(GRAY_HEX)
            .font('Helvetica')
            .fontSize(9)
            .text(pelunasanLabel, totalsLabelX, currentY + 3)
            .fillColor(BLACK_HEX)
            .text(formatIDR(remaining), totalsValueX, currentY + 3, { align: 'right', width: 80 });
        }
        currentY += 18;
      }

      // Notes
      if (invoice.notes) {
        currentY += 12;
        doc
          .fillColor(GRAY_HEX)
          .font('Helvetica-Bold')
          .fontSize(9)
          .text('Catatan:', margin, currentY)
          .font('Helvetica')
          .text(escStr(invoice.notes), margin, currentY + 14, { width: contentWidth });
      }

      // ── Footer ───────────────────────────────────────────────────────────
      const footerY = doc.page.height - 60;
      doc
        .fillColor('#e5e7eb')
        .rect(margin, footerY - 10, contentWidth, 1)
        .fill();

      doc
        .fillColor(GRAY_HEX)
        .font('Helvetica')
        .fontSize(9)
        .text(
          'Terima kasih telah mempercayakan percetakan Anda kepada Gala Printing.',
          margin, footerY, { align: 'center', width: contentWidth }
        )
        .text(
          'Jl. Tibung Sari Gg. Camplung No.5X, Kwanji, Dalung, Kuta Utara, Badung Regency, Bali',
          margin, footerY + 14, { align: 'center', width: contentWidth }
        )
        .text(
          'noreply@galaprintofficialbali.co.id',
          margin, footerY + 28, { align: 'center', width: contentWidth }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
