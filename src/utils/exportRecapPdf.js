import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { formatCurrency } from './format.js';

const SOURCE_LABELS = {
  shopee:        'Shopee',
  tokopedia:     'Tokopedia',
  tiktok_shop:   'TikTok Shop',
};

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('id-ID');
}

/**
 * Generate and download a PDF recap for a range of dates.
 *
 * @param {Array} days - array of daily recap objects from /api/revenue/recap-range
 * @param {string} start - start date YYYY-MM-DD
 * @param {string} end - end date YYYY-MM-DD
 */
export function exportRecapPdf(days, start, end) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 15;

  // ── Title ──
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Rekap Pendapatan', 14, y);
  y += 7;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`${fmtDate(start)} — ${fmtDate(end)}`, 14, y);
  y += 12;

  for (const day of days) {
    // Check page break
    if (y > 170) {
      doc.addPage();
      y = 15;
    }

    // ── Day header ──
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(fmtDate(day.date), 14, y);
    y += 7;

    // ── Summary line ──
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const parts = [
      `Website: ${formatCurrency(day.website_total)}`,
    ];
    for (const [key, label] of Object.entries(SOURCE_LABELS)) {
      const val = day.manual_by_category[key] ?? 0;
      if (val > 0) parts.push(`${label}: ${formatCurrency(val)}`);
    }
    parts.push(`Total: ${formatCurrency(day.grand_total)}`);
    doc.text(parts.join('  |  '), 14, y);
    y += 6;

    // ── Website transactions table ──
    if (day.website_transactions.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Transaksi Website', 14, y);
      y += 1;

      let endY = y;
      autoTable(doc, {
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['No. Order', 'Tanggal Bayar', 'Status', 'Sumber', 'Nominal']],
        body: day.website_transactions.map((tx) => [
          tx.order_number,
          fmtDate(tx.paid_at),
          tx.status,
          tx.source === 'offline' ? 'Order Offline' : tx.source === 'custom' ? 'Custom' : 'Online',
          formatCurrency(Number(tx.subtotal)),
        ]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [75, 85, 99] },
        didDrawPage: (data) => { if (data.cursor) endY = data.cursor.y; },
      });
      y = endY + 5;
    }

    // ── Manual transactions table ──
    if (day.manual_transactions.length > 0) {
      if (y > 170) {
        doc.addPage();
        y = 15;
      }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Transaksi Manual', 14, y);
      y += 1;

      let endY = y;
      autoTable(doc, {
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['Tanggal', 'Sumber', 'Nominal', 'Catatan']],
        body: day.manual_transactions.map((tx) => [
          fmtDate(tx.transaction_date),
          SOURCE_LABELS[tx.source_category] ?? tx.source_category,
          formatCurrency(Number(tx.amount)),
          tx.notes || '',
        ]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [75, 85, 99] },
        didDrawPage: (data) => { if (data.cursor) endY = data.cursor.y; },
      });
      y = endY + 8;
    } else {
      y += 2;
    }
  }

  // ── Footer on every page ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150);
    doc.text(
      `Dicetak: ${new Date().toLocaleString('id-ID')}  |  Halaman ${i} dari ${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  const filename = `rekap-pendapatan-${start}-sd-${end}.pdf`;
  doc.save(filename);
  return filename;
}
