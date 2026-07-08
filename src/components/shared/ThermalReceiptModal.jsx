/**
 * ThermalReceiptModal.jsx — Preview & cetak resi termal (80mm / 302px).
 *
 * Fitur 4: tampilkan preview resi termal, tombol "Print" membuka dialog
 * print browser dengan CSS @media print khusus layout termal.
 *
 * Props:
 *   invoice: object  — data invoice dari InvoiceSection
 *   onClose: fn
 */

import { useRef } from 'react';
import { formatCurrency } from '../../core/helpers.js';

const THERMAL_WIDTH_PX = 302; // ≈ 80mm at 96dpi

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

  return (
    <div
      className="thermal-receipt"
      style={{
        width: `${THERMAL_WIDTH_PX}px`,
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: '12px',
        lineHeight: '1.4',
        color: '#000',
        background: '#fff',
        padding: '8px',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.05em' }}>
          GALA PRINTING
        </div>
        <div style={{ fontSize: '10px', color: '#444' }}>galaprintofficialbali.co.id</div>
        <div style={{ fontSize: '10px', color: '#444' }}>Dalung, Kuta Utara, Badung, Bali</div>
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      {/* Invoice meta */}
      <div style={{ marginBottom: '6px' }}>
        <div><strong>No. Invoice :</strong> {invoice.invoice_number}</div>
        <div><strong>No. Order   :</strong> {invoice.order_number || '—'}</div>
        <div><strong>Tanggal     :</strong> {formatDate(invoice.created_at)}</div>
        {invoice.paid_at && (
          <div><strong>Dibayar     :</strong> {formatDate(invoice.paid_at)}</div>
        )}
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      {/* Customer */}
      <div style={{ marginBottom: '6px' }}>
        <div><strong>Customer :</strong> {invoice.customer_name || '—'}</div>
        {invoice.customer_phone && (
          <div><strong>Telp     :</strong> {invoice.customer_phone}</div>
        )}
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      {/* Items */}
      <div style={{ marginBottom: '4px' }}>
        {items.length === 0 ? (
          <div style={{ color: '#888' }}>—</div>
        ) : items.map((item, i) => {
          const sub = Number(item.price || 0) * Number(item.quantity || 1);
          return (
            <div key={item.id || i} style={{ marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ flex: 1, marginRight: '4px', wordBreak: 'break-word' }}>{item.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555' }}>
                <span>{item.quantity} x {formatCurrency(item.price)}</span>
                <span>{formatCurrency(sub)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      {/* Totals */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#166534' }}>
            <span>Diskon</span><span>-{formatCurrency(discount)}</span>
          </div>
        )}
        {tax > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Pajak</span><span>{formatCurrency(tax)}</span>
          </div>
        )}
      </div>

      <div style={{ borderTop: '2px solid #000', margin: '4px 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
        <span>TOTAL</span><span>{formatCurrency(total)}</span>
      </div>

      {invoice.payment_method && (
        <div style={{ marginBottom: '4px' }}>
          <strong>Metode Bayar:</strong> {invoice.payment_method}
        </div>
      )}

      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '11px', color: '#444', marginTop: '6px' }}>
        <div>Terima kasih atas kepercayaan Anda!</div>
        <div>Barang yang sudah dibeli tidak dapat dikembalikan.</div>
      </div>
    </div>
  );
}

export default function ThermalReceiptModal({ invoice, onClose }) {
  const printRef = useRef(null);

  function handlePrint() {
    // Buat window print khusus dengan hanya konten resi termal
    const printContents = printRef.current?.innerHTML || '';
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      // Fallback: window.print() biasa
      window.print();
      return;
    }
    printWindow.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Resi Termal — ${invoice.invoice_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      width: 302px;
      margin: 0 auto;
      background: #fff;
      color: #000;
    }
    @media print {
      @page { size: 80mm auto; margin: 2mm; }
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
          <span style={{ fontWeight: 700, fontSize: '15px' }}>🖨️ Preview Resi Termal (80mm)</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '18px', color: '#6b7280', lineHeight: 1,
            }}
          >✕</button>
        </div>

        {/* Preview box */}
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
            🖨️ Print Resi
          </button>
        </div>
      </div>
    </div>
  );
}
