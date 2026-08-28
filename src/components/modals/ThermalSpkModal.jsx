/**
 * ThermalSpkModal.jsx — Preview & cetak SPK (Surat Perintah Kerja) termal (58mm / 80mm).
 *
 * Dokumen internal instruksi produksi, dicetak di printer thermal yang sama
 * dengan resi/invoice. Reuse data invoice (tidak membuat sumber data baru).
 *
 * Props:
 *   invoice: object  — data invoice (dari getInvoiceByOrderId / getInvoiceById)
 *   onClose: fn
 *   autoPrint: bool  — auto-print on mount
 *
 * Paper sizes:
 *   58mm → 48mm printable (3mm margin each side) ≈ 181px at 96dpi
 *   80mm → 72mm printable (4mm margin each side) ≈ 272px at 96dpi
 */

import { useRef, useEffect, useState, useCallback, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { track } from '../../utils/activityTracker.js';

const STORAGE_KEY = 'gala.thermal.paperSize';

/* Paper dimension configs — sama persis dengan ThermalReceiptModal */
const PAPER_CONFIG = {
  '58mm': {
    label: '58mm',
    paperWidthMm: 58,
    marginHorizontalMm: 3,
    contentWidthPx: 181,
    fontSize: 14,
    headerFontSize: 22,
    totalFontSize: 16,
    smallFontSize: 12,
    lineHeight: 1.4,
  },
  '80mm': {
    label: '80mm',
    paperWidthMm: 80,
    marginHorizontalMm: 4,
    contentWidthPx: 272,
    fontSize: 16,
    headerFontSize: 26,
    totalFontSize: 18,
    smallFontSize: 13,
    lineHeight: 1.45,
  },
};

function getSavedPaperSize() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && PAPER_CONFIG[saved]) return saved;
  } catch { /* ignore */ }
  return '58mm';
}

/** Format tanggal: DD/MM/YYYY, HH.mm */
function formatSpkDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}, ${hh}.${mi}`;
}

/** Nama file desain dari design_file_path (tanpa path). */
function designFileName(item) {
  if (!item || !item.design_file_path) return '';
  return String(item.design_file_path).split('/').pop() || '';
}

/** Dimensi item: "200 x 172" dari length_cm/width_cm, fallback kolom size. */
function dims(item) {
  const len = item.length_cm;
  const wid = item.width_cm;
  const hasDims = len !== null && len !== undefined && len !== '' && wid !== null && wid !== undefined && wid !== '';
  if (hasDims) {
    const f = (v) => {
      const n = Number(v);
      return String(Number.isInteger(n) ? n : n);
    };
    return `${f(len)} x ${f(wid)}`;
  }
  if (item.size) return String(item.size);
  return '';
}

/* ── SPK Content ──────────────────────────────────────────────────────────── */

function ThermalSpkContent({ invoice, paperSize, operatorName }) {
  const cfg = PAPER_CONFIG[paperSize];
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const logoSize = cfg.headerFontSize;
  const numColW = Math.round(cfg.fontSize * 1.7);
  const nameAlign = numColW + 2;

  const css = {
    root: {
      width: `${cfg.contentWidthPx}px`,
      fontFamily: "'Consolas', 'Courier New', monospace",
      fontSize: `${cfg.fontSize}px`,
      fontWeight: 700,
      lineHeight: `${cfg.lineHeight}`,
      color: '#000',
      background: '#fff',
      padding: `6px ${cfg.marginHorizontalMm}px`,
      boxSizing: 'border-box',
      WebkitTextStroke: '0px',
    },
    center:  { textAlign: 'center' },
    bold:    { fontWeight: 700 },
    small:   { fontSize: `${cfg.smallFontSize}px`, color: '#000', WebkitTextStroke: '0px' },
    muted:   { color: '#000' },
  };

  const statusLabel = {
    paid: 'LUNAS',
    partial: 'DP',
    unpaid: 'BELUM BAYAR',
  };
  const statusText = statusLabel[invoice.payment_status] || invoice.payment_status || '—';

  return (
    <div className="thermal-spk" style={css.root}>
      {/* ── HEADER: logo di ujung kiri (absolute), "SPK" + subjudul di tengah ── */}
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <div style={{ position: 'relative' }}>
          <img
            src="/gala-logo2.svg"
            alt="Gala Logo"
            style={{
              position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
              width: `${logoSize}px`, height: `${logoSize}px`,
              filter: 'grayscale(1) contrast(1.2)',
            }}
          />
          <div style={{ ...css.bold, fontSize: `${cfg.headerFontSize}px`, letterSpacing: '0.02em', lineHeight: 1.1 }}>
            SPK
          </div>
        </div>
        <div style={{ ...css.small, lineHeight: 1.2, marginTop: '2px' }}>(Surat Perintah Kerja)</div>
      </div>

      {/* ── META ── */}
      <div style={{ marginBottom: '6px' }}>
        <div><span style={css.bold}>No. Inv</span>    : {invoice.invoice_number || '—'}</div>
        <div><span style={css.bold}>No. Ord</span>    : {invoice.order_number || '—'}</div>
        <div><span style={css.bold}>Tanggal</span>    : {formatSpkDate(invoice.created_at)}</div>
        <div><span style={css.bold}>Status</span>     : {statusText}</div>
        <div><span style={css.bold}>Customer</span>   : {invoice.customer_name || '—'}</div>
      </div>

      {/* ── ITEMS ── */}
      <div style={{ marginTop: '10px', marginBottom: '6px' }}>
        {items.length === 0 ? (
          <div style={css.muted}>—</div>
        ) : items.map((item, i) => {
          const dim = dims(item);
          const catatan = item.notes || designFileName(item);
          return (
            <div key={item.id || i} style={{ marginBottom: '6px' }}>
              <div style={{ display: 'flex' }}>
                <span style={{ flexShrink: 0, width: `${numColW}px`, marginRight: '2px' }}>{i + 1}.</span>
                <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{item.name}</span>
              </div>
              <div style={{ paddingLeft: `${nameAlign}px`, marginTop: '2px' }}>
                <span>{Number(item.quantity) || 1}x</span>
                {dim ? <span> ({dim})</span> : null}
              </div>
              <div style={{ ...css.muted, fontSize: `${cfg.smallFontSize}px`, paddingLeft: `${nameAlign}px`, marginTop: '2px' }}>
                catatan: {catatan || '—'}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── TTD ── */}
      <div style={{ textAlign: 'right', marginTop: '12px' }}>
        <div style={{ fontSize: `${cfg.smallFontSize}px` }}>TTD</div>
        <div style={{ height: '48px' }} />
        <div style={{ fontSize: `${cfg.smallFontSize}px` }}>{operatorName || '—'}</div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ fontSize: `${cfg.smallFontSize - 2}px`, color: '#000', marginTop: '12px', lineHeight: 1.4 }}>
        <div>*Pastikan cek file sebelum naik cetak</div>
        <div>*cek kembali kesesuaian keterangan file dan SPK</div>
      </div>
    </div>
  );
}

/* ── Main Modal ───────────────────────────────────────────────────────────── */

export default function ThermalSpkModal({ invoice, onClose, autoPrint }) {
  const printRef = useRef(null);
  const [paperSize, setPaperSize] = useState(getSavedPaperSize);
  const { user } = useContext(AuthContext);

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
    track('Cetak SPK', {
      targetType: 'invoice', targetId: invoice?.id ?? null,
      metadata: { invoice_number: invoice?.invoice_number ?? null, paperSize, by: user?.name ?? null },
    });
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
  <title>SPK — ${invoice.invoice_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: ${cfg.fontSize}px;
      font-weight: 700;
      -webkit-text-stroke: 0;
      width: ${cfg.paperWidthMm}mm;
      margin: 0 auto;
      background: #fff;
      color: #000;
    }
    img { display: block; filter: grayscale(1) contrast(1.2); }
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
          <span style={{ fontWeight: 700, fontSize: '15px' }}>Preview SPK</span>
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
              <ThermalSpkContent invoice={invoice} paperSize={paperSize} operatorName={user?.name} />
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
            Print SPK
          </button>
        </div>
      </div>
    </div>
  );
}