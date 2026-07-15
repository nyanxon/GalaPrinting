/**
 * ThermalReceiptModal.jsx — Preview & cetak resi termal (58mm).
 *
 * Props:
 *   invoice: object  — data invoice
 *   onClose: fn
 *   autoPrint: bool  — auto-print on mount
 */

import { useRef, useEffect } from 'react';
import { formatCurrency } from '../../core/helpers.js';

/* 58mm at 96dpi ≈ 220px */
const PAPER_WIDTH_PX = 220;

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function ThermalReceiptContent({ invoice }) {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const subtotal = Number(invoice.subtotal || 0);
  const discount = Number(invoice.discount_amount || 0);
  const tax      = Number(invoice.tax_amount || 0);
  const total    = Number(invoice.total || subtotal - discount + tax);

  const css = {
    root: {
      width: `${PAPER_WIDTH_PX}px`,
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: '11px',
      fontWeight: 700,
      lineHeight: '1.35',
      color: '#000',
      background: '#fff',
      padding: '6px 4px',
      boxSizing: 'border-box',
      WebkitTextStroke: '0.3px #000',
    },
    center:  { textAlign: 'center' },
    bold:    { fontWeight: 700 },
    small:   { fontSize: '9px', color: '#555', WebkitTextStroke: '0.2px #555' },
    sep:     { borderTop: '1px dashed #999', margin: '4px 0' },
    sepBold: { borderTop: '2px solid #000', margin: '4px 0' },
    row:     { display: 'flex', justifyContent: 'space-between' },
    muted:   { color: '#555' },
    green:   { color: '#166534' },
  };

  return (
    <div className="thermal-receipt" style={css.root}>
      {/* ── HEADER ── */}
      <div style={{ ...css.center, marginBottom: '4px' }}>
        <div style={{ ...css.bold, fontSize: '14px', letterSpacing: '0.05em', WebkitTextStroke: '0.5px #000' }}>
          GALA PRINTING
        </div>
        <div style={css.small}>galaprintofficialbali.co.id</div>
        <div style={css.small}>Dalung, Kuta Utara, Badung, Bali</div>
      </div>

      <div style={css.sep} />

      {/* ── INVOICE META ── */}
      <div style={{ marginBottom: '4px' }}>
        <div><span style={css.bold}>No. Inv</span> : {invoice.invoice_number}</div>
        <div><span style={css.bold}>No. Ord</span> : {invoice.order_number || '—'}</div>
        <div><span style={css.bold}>Tanggal</span> : {formatDate(invoice.created_at)}</div>
        {invoice.paid_at && (
          <div><span style={css.bold}>Dibayar</span> : {formatDate(invoice.paid_at)}</div>
        )}
        {invoice.payment_status === 'paid' && (
          <div style={{ ...css.bold, ...css.green, marginTop: '2px' }}>
            ** LUNAS **
          </div>
        )}
      </div>

      <div style={css.sep} />

      {/* ── CUSTOMER ── */}
      <div style={{ marginBottom: '4px' }}>
        <div><span style={css.bold}>Customer</span></div>
        <div>{invoice.customer_name || '—'}</div>
        {invoice.customer_phone && (
          <div style={css.muted}>Telp: {invoice.customer_phone}</div>
        )}
      </div>

      <div style={css.sep} />

      {/* ── ITEMS ── */}
      <div style={{ marginBottom: '4px' }}>
        {items.length === 0 ? (
          <div style={css.muted}>—</div>
        ) : items.map((item, i) => {
          const sub = Number(item.price || 0) * Number(item.quantity || 1);
          return (
            <div key={item.id || i} style={{ marginBottom: '3px' }}>
              <div style={{ wordBreak: 'break-word' }}>{item.name}</div>
              <div style={{ ...css.row, ...css.muted, fontSize: '10px' }}>
                <span>{item.quantity} x {formatCurrency(item.price)}</span>
                <span>{formatCurrency(sub)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={css.sep} />

      {/* ── TOTALS ── */}
      <div style={{ marginBottom: '2px' }}>
        <div style={css.row}>
          <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div style={{ ...css.row, ...css.green }}>
            <span>Diskon</span><span>-{formatCurrency(discount)}</span>
          </div>
        )}
        {tax > 0 && (
          <div style={css.row}>
            <span>Pajak</span><span>{formatCurrency(tax)}</span>
          </div>
        )}
      </div>

      <div style={css.sepBold} />

      <div style={{ ...css.row, ...css.bold, fontSize: '12px', marginBottom: '4px', WebkitTextStroke: '0.4px #000' }}>
        <span>TOTAL</span><span>{formatCurrency(total)}</span>
      </div>

      {invoice.payment_method && (
        <div style={{ marginBottom: '4px', fontSize: '10px' }}>
          <span style={css.bold}>Bayar:</span> {invoice.payment_method}
        </div>
      )}

      <div style={css.sep} />

      {/* ── FOOTER ── */}
      <div style={{ ...css.center, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        <div>Terima kasih atas kepercayaan Anda!</div>
        <div>Barang yang sudah dibeli tidak</div>
        <div>dapat dikembalikan.</div>
      </div>
    </div>
  );
}

export default function ThermalReceiptModal({ invoice, onClose, autoPrint }) {
  const printRef = useRef(null);

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
    printWindow.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Resi — ${invoice.invoice_number}</title>
    <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      font-weight: 700;
      -webkit-text-stroke: 0.3px #000;
      width: 220px;
      margin: 0 auto;
      background: #fff;
      color: #000;
    }
    @media print {
      @page { size: 58mm auto; margin: 1mm; }
      body { width: 100%; }
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
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid #e5e7eb',
        }}>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>Preview Resi (58mm)</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '18px', color: '#6b7280', lineHeight: 1,
            }}
          >✕</button>
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
              <ThermalReceiptContent invoice={invoice} />
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
