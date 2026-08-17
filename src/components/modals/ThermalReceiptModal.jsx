/**
 * ThermalReceiptModal.jsx — Preview & cetak resi termal (58mm / 80mm).
 *
 * Props:
 *   invoice: object  — data invoice
 *   onClose: fn
 *   autoPrint: bool  — auto-print on mount
 *
 * Paper sizes:
 *   58mm → 48mm printable (3mm margin each side) ≈ 181px at 96dpi
 *   80mm → 72mm printable (4mm margin each side) ≈ 272px at 96dpi
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { formatCurrency } from '../../utils/format.js';

const STORAGE_KEY = 'gala.thermal.paperSize';

/* Paper dimension configs — single source of truth */
const PAPER_CONFIG = {
  '58mm': {
    label: '58mm',
    paperWidthMm: 58,
    marginHorizontalMm: 3,
    contentWidthPx: 181,
    fontSize: 12,
    headerFontSize: 15,
    totalFontSize: 14,
    smallFontSize: 10,
    lineHeight: 1.3,
  },
  '80mm': {
    label: '80mm',
    paperWidthMm: 80,
    marginHorizontalMm: 4,
    contentWidthPx: 272,
    fontSize: 13,
    headerFontSize: 17,
    totalFontSize: 15,
    smallFontSize: 11,
    lineHeight: 1.35,
  },
};

function getSavedPaperSize() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && PAPER_CONFIG[saved]) return saved;
  } catch { /* ignore */ }
  return '58mm';
}

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/* ── Receipt Content ──────────────────────────────────────────────────────── */

function ThermalReceiptContent({ invoice, paperSize }) {
  const cfg = PAPER_CONFIG[paperSize];
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const subtotal = Number(invoice.subtotal || 0);
  const discount = Number(invoice.discount_amount || 0);
  const tax      = Number(invoice.tax_amount || 0);
  const total    = Number(invoice.total || subtotal - discount + tax);

  const logoSize = paperSize === '80mm' ? 40 : 32;

  const css = {
    root: {
      width: `${cfg.contentWidthPx}px`,
      fontFamily: "'Courier New', 'Lucida Console', 'Consolas', monospace",
      fontSize: `${cfg.fontSize}px`,
      fontWeight: 700,
      lineHeight: `${cfg.lineHeight}`,
      color: '#000',
      background: '#fff',
      padding: `6px ${cfg.marginHorizontalMm}px`,
      boxSizing: 'border-box',
      WebkitTextStroke: '0.3px #000',
    },
    center:  { textAlign: 'center' },
    bold:    { fontWeight: 700 },
    small:   { fontSize: `${cfg.smallFontSize}px`, color: '#000', WebkitTextStroke: '0.3px #000' },
    sep:     { borderTop: '1px dashed #999', margin: '4px 0' },
    sepBold: { borderTop: '2px solid #000', margin: '4px 0' },
    row:     { display: 'flex', justifyContent: 'space-between' },
    muted:   { color: '#000' },
    green:   { color: '#166534' },
  };

  const paymentStatusLabel = {
    paid: 'Lunas',
    unpaid: 'Belum Bayar',
    partial: 'Bayar Sebagian',
  };

  return (
    <div className="thermal-receipt" style={css.root}>
      {/* ── HEADER ── */}
      <div style={{ ...css.center, marginBottom: '4px' }}>
        <img
          src="/gala-logo2.svg"
          alt="Gala Logo"
          style={{ width: `${logoSize}px`, height: `${logoSize}px`, margin: '0 auto 2px', display: 'block' }}
        />
        <div style={{ ...css.bold, fontSize: `${cfg.headerFontSize}px`, letterSpacing: '0.05em', WebkitTextStroke: '0.5px #000' }}>
          GALA
        </div>
        <div style={{ ...css.bold, fontSize: `${cfg.headerFontSize - 2}px`, letterSpacing: '0.08em', WebkitTextStroke: '0.4px #000' }}>
          PRINTING
        </div>
        <div style={css.small}>galaprintofficialbali.co.id</div>
        <div style={css.small}>Dalung, Kuta Utara, Badung, Bali</div>
      </div>

      <div style={css.sepBold} />

      {/* ── INVOICE META ── */}
      <div style={{ marginBottom: '4px' }}>
        <div><span style={css.bold}>No. Nota</span>  : {invoice.invoice_number}</div>
        <div><span style={css.bold}>Tanggal</span>   : {formatDate(invoice.created_at)}</div>
        <div><span style={css.bold}>Pelanggan</span> : {invoice.customer_name || '—'}</div>
        <div><span style={css.bold}>No. Telp</span>  : {invoice.customer_phone || '—'}</div>
        <div><span style={css.bold}>Operator</span>  : {invoice.operator || invoice.created_by_name || '—'}</div>
        <div><span style={css.bold}>Status</span>    : {paymentStatusLabel[invoice.payment_status] || invoice.payment_status || '—'}</div>
      </div>

      <div style={css.sepBold} />

      {/* ── ITEMS ── */}
      <div style={{ marginBottom: '4px' }}>
        {items.length === 0 ? (
          <div style={css.muted}>—</div>
        ) : items.map((item, i) => {
          const sub = Number(item.price || 0) * Number(item.quantity || 1);
          return (
            <div key={item.id || i} style={{ marginBottom: '3px' }}>
              <div style={{ wordBreak: 'break-word' }}>{i + 1}. {item.name}</div>
              <div style={{ ...css.muted, fontSize: `${cfg.smallFontSize}px`, paddingLeft: '12px' }}>
                <span>{item.quantity} x {formatCurrency(item.price)}</span>
                <span style={{ float: 'right' }}>{formatCurrency(sub)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={css.sepBold} />

      <div style={{ ...css.row, ...css.bold, fontSize: `${cfg.totalFontSize}px`, marginBottom: '4px', WebkitTextStroke: '0.4px #000' }}>
        <span>TOTAL</span><span>{formatCurrency(total)}</span>
      </div>

      <div style={css.sepBold} />

      {/* ── FOOTER ── */}
      <div style={{ fontSize: `${cfg.smallFontSize}px`, color: '#000', marginTop: '4px' }}>
        <div>* Barang yang sudah dibeli tidak</div>
        <div>  dapat dikembalikan</div>
        <div style={{ marginTop: '2px' }}>* Barang yang sudah 2 minggu dan</div>
        <div>  tidak diambil bukan tanggung</div>
        <div>  jawab kami</div>
        <div style={{ ...css.center, marginTop: '6px' }}>Terima kasih atas kepercayaan anda!</div>
      </div>
    </div>
  );
}

/* ── Main Modal ───────────────────────────────────────────────────────────── */

export default function ThermalReceiptModal({ invoice, onClose, autoPrint }) {
  const printRef = useRef(null);
  const [paperSize, setPaperSize] = useState(getSavedPaperSize);

  const cfg = PAPER_CONFIG[paperSize];

  /* Persist paper size choice */
  const handlePaperSizeChange = useCallback((size) => {
    setPaperSize(size);
    try { localStorage.setItem(STORAGE_KEY, size); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => { handlePrint(); }, 400);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePrint() {
    const printContents = printRef.current?.innerHTML || '';
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      window.print();
      return;
    }
    const logoSize = paperSize === '80mm' ? 40 : 32;
    printWindow.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Resi — ${invoice.invoice_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', 'Lucida Console', 'Consolas', monospace;
      font-size: ${cfg.fontSize}px;
      font-weight: 700;
      -webkit-text-stroke: 0.3px #000;
      width: ${cfg.paperWidthMm}mm;
      margin: 0 auto;
      background: #fff;
      color: #000;
    }
    img { display: block; margin: 0 auto 2px; }
    @media print {
      @page {
        size: ${cfg.paperWidthMm}mm auto;
        margin: 0;
      }
      body {
        width: ${cfg.paperWidthMm}mm;
        margin: 0;
        padding: 3mm ${cfg.marginHorizontalMm}mm;
      }
    }
  </style>
</head>
<body>
  ${printContents}
  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  </script>
</body>
</html>`);
    printWindow.document.close();
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: '12px',
          overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
          maxHeight: '90vh', overflowY: 'auto',
          width: '420px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid #e5e7eb',
        }}>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>Preview Resi</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '18px', color: '#6b7280', lineHeight: 1,
            }}
          >✕</button>
        </div>

        {/* Paper size selector */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '10px 20px', borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Ukuran Kertas:</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {Object.keys(PAPER_CONFIG).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => handlePaperSizeChange(size)}
                style={{
                  padding: '4px 14px',
                  borderRadius: '6px',
                  border: paperSize === size ? '2px solid #785E40' : '1px solid #d1d5db',
                  background: paperSize === size ? '#785E40' : '#fff',
                  color: paperSize === size ? '#fff' : '#374151',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {size}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: 'auto' }}>
            {cfg.contentWidthPx}px content
          </span>
        </div>

        {/* Preview */}
        <div style={{ padding: '20px', background: '#f9fafb', display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              background: '#fff',
              boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
              border: '1px solid #e5e7eb',
            }}
          >
            <div ref={printRef}>
              <ThermalReceiptContent invoice={invoice} paperSize={paperSize} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex', gap: '12px', justifyContent: 'flex-end',
          padding: '14px 20px', borderTop: '1px solid #e5e7eb',
        }}>
          <button type="button" className="adm-btn" onClick={onClose}>Tutup</button>
          <button
            type="button"
            className="adm-btn adm-btn--primary"
            onClick={handlePrint}
            style={{ background: '#785E40', borderColor: '#785E40' }}
          >
            Print Resi
          </button>
        </div>
      </div>
    </div>
  );
}
