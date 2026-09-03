/**
 * InvoiceSection.jsx — Panel invoice untuk cashier & admin.
 *
 * Fitur 2: list invoice, update payment status.
 * Fitur 3: tampilkan delivery method di detail order.
 * Fitur 4: tombol Print Nota (termal) & Download/Kirim PDF A4.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  listInvoices,
  getInvoiceById,
  updateInvoicePaymentStatus,
  sendInvoiceEmail,
  openInvoicePdf,
} from '../../../../services/api/invoiceService.js';
import { showToast } from '../../../../core/toastEmitter.js';
import { formatCurrency } from '../../../../utils/format.js';
import PaginationBar from '../../../ui/PaginationBar.jsx';
import ThermalReceiptModal from '../../../modals/ThermalReceiptModal.jsx';
import { getSocket } from '../../../../core/socket.js';

const PAGE_SIZE = 20;

const PAYMENT_STATUS_LABELS = {
  unpaid:  { label: 'Belum Bayar', color: 'var(--color-danger-dark)', bg: 'var(--color-danger-bg)' },
  paid:    { label: 'Lunas',       color: 'var(--color-success-dark)', bg: 'var(--color-success-border-light)' },
  dp:      { label: 'DP',          color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
};

// ── Invoice Detail Modal ──────────────────────────────────────────────────────

function InvoiceDetailModal({ invoiceId, onClose, onUpdated }) {
  const [invoice, setInvoice]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [emailSending, setEmailSending]     = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [newMethod, setNewMethod] = useState('');
  const [newDpAmount, setNewDpAmount] = useState('');
  const [thermalOpen, setThermalOpen] = useState(false);

  useEffect(() => {
    getInvoiceById(invoiceId)
      .then((inv) => {
        setInvoice(inv);
        setNewStatus(inv.payment_status === 'dp' ? 'paid' : inv.payment_status);
        setNewMethod(inv.payment_method || '');
        setNewDpAmount(inv.dp_amount != null ? String(inv.dp_amount) : '');
      })
      .catch(() => showToast('Gagal memuat invoice.', 'error'))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  async function handleStatusUpdate() {
    if (!newStatus || invoice.locked) return;
    setStatusUpdating(true);
    try {
      const updated = await updateInvoicePaymentStatus(invoice.id, newStatus, newMethod, newDpAmount);
      setInvoice(updated);
      onUpdated(updated);
      showToast(`Status pembayaran diperbarui: ${updated.payment_status}`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal update status.', 'error');
    } finally {
      setStatusUpdating(false);
    }
  }

  async function handleSendEmail() {
    setEmailSending(true);
    try {
      await sendInvoiceEmail(invoice.id);
      showToast('Email invoice berhasil dikirim ke customer.', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal mengirim email.', 'error');
    } finally {
      setEmailSending(false);
    }
  }

  if (loading) return (
    <div className="inv-modal-overlay">
      <div className="inv-modal" style={{ textAlign: 'center', padding: '40px' }}>Memuat invoice…</div>
    </div>
  );

  if (!invoice) return null;

  const psCfg = PAYMENT_STATUS_LABELS[invoice.payment_status] || { label: invoice.payment_status, color: '#333', bg: '#eee' };
  const items = Array.isArray(invoice.items) ? invoice.items : [];

  return (
    <>
      <div className="inv-modal-overlay" onClick={onClose}>
        <div className="inv-modal inv-modal--wide" onClick={(e) => e.stopPropagation()}>
          <div className="inv-modal-header">
            <div>
              <h3>🧾 {invoice.invoice_number}</h3>
              <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Order: {invoice.order_number}</span>
            </div>
            <button type="button" className="inv-modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="inv-modal-body">
            {/* Customer & meta */}
            <div className="inv-detail-grid">
              <div>
                <div className="inv-detail-label">Customer</div>
                <div className="inv-detail-value">{invoice.customer_name || '—'}</div>
                {invoice.customer_phone && <div className="inv-detail-sub">{invoice.customer_phone}</div>}
                {invoice.customer_email && <div className="inv-detail-sub">{invoice.customer_email}</div>}
              </div>
              <div>
                <div className="inv-detail-label">Tanggal Invoice</div>
                <div className="inv-detail-value">{new Date(invoice.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                {invoice.paid_at && (
                  <div className="inv-detail-sub">Dibayar: {new Date(invoice.paid_at).toLocaleDateString('id-ID')}</div>
                )}
              </div>
              <div>
                <div className="inv-detail-label">Status Pembayaran</div>
                <span className="inv-status-badge" style={{ background: psCfg.bg, color: psCfg.color }}>
                  {psCfg.label}
                </span>
                {invoice.locked && (
                  <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '4px' }}>🔒 Locked (sudah paid)</div>
                )}
              </div>
              <div>
                <div className="inv-detail-label">Dibuat oleh</div>
                <div className="inv-detail-value">{invoice.creator_name || '—'}</div>
              </div>
            </div>

            {/* Items table */}
            <div className="inv-items-section">
              <div className="inv-section-title">Item Pesanan</div>
              <table className="inv-items-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Harga</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={4} style={{ color: 'var(--gray-400)', padding: '12px' }}>—</td></tr>
                  ) : items.map((item, i) => (
                    <tr key={item.id || i}>
                      <td>{item.name}</td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.price * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="inv-totals">
              <div className="inv-total-row"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
              {Number(invoice.discount_amount) > 0 && (
                <div className="inv-total-row inv-total-row--discount"><span>Diskon</span><span>-{formatCurrency(invoice.discount_amount)}</span></div>
              )}
              {Number(invoice.tax_amount) > 0 && (
                <div className="inv-total-row"><span>Pajak</span><span>{formatCurrency(invoice.tax_amount)}</span></div>
              )}
              {(() => {
                const isDp = invoice.payment_status === 'dp';
                const hasDp = isDp || (invoice.payment_status === 'paid' && invoice.dp_amount != null);
                if (!hasDp) return null;
                const dp = Number(invoice.dp_amount || 0);
                const sisa = Math.max(Number(invoice.total || 0) - dp, 0);
                const dpDate = invoice.dp_paid_at
                  ? new Date(invoice.dp_paid_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
                  : '';
                const paidDate = invoice.paid_at
                  ? new Date(invoice.paid_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
                  : '';
                return (
                  <>
                    <div className="inv-total-row">
                      <span>{dpDate ? `DP diterima (${dpDate})` : 'DP'}</span>
                      <span>{formatCurrency(dp)}</span>
                    </div>
                    {isDp ? (
                      <div className="inv-total-row inv-total-row--discount">
                        <span>Sisa Pembayaran</span>
                        <span>{formatCurrency(sisa)}</span>
                      </div>
                    ) : (
                      <div className="inv-total-row">
                        <span>{paidDate ? `Pelunasan diterima (${paidDate})` : 'Pelunasan'}</span>
                        <span>{formatCurrency(sisa)}</span>
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="inv-total-row inv-total-row--grand"><span>TOTAL</span><span>{formatCurrency(invoice.total)}</span></div>
            </div>

            {/* Update payment status — hanya jika belum locked */}
            {!invoice.locked && (
              <div className="inv-update-section">
                <div className="inv-section-title">Update Status Pembayaran</div>
                <div className="inv-form-row">
                  <label className="inv-label">
                    Status
                    <select className="adm-input" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                      {invoice.payment_status === 'dp' ? (
                        <option value="paid">Lunas</option>
                      ) : (
                        <>
                          <option value="unpaid">Belum Bayar</option>
                          <option value="dp">DP</option>
                          <option value="paid">Lunas</option>
                        </>
                      )}
                    </select>
                  </label>
                  <label className="inv-label">
                    Metode Bayar
                    <select className="adm-input" value={newMethod} onChange={(e) => setNewMethod(e.target.value)}>
                      <option value="">— Pilih —</option>
                      <option value="Transfer Bank">Transfer Bank</option>
                      <option value="QRIS">QRIS</option>
                      <option value="Tunai">Tunai</option>
                    </select>
                  </label>
                </div>

                {newStatus === 'dp' && (
                  <div className="inv-form-row inv-form-row--3">
                    <label className="inv-label">
                      Nominal DP
                      <input
                        className="adm-input"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={newDpAmount}
                        onChange={(e) => setNewDpAmount(e.target.value)}
                      />
                    </label>
                    <div className="inv-label">
                      <div className="inv-detail-label">DP</div>
                      <div className="inv-detail-value">{newDpAmount ? formatCurrency(Number(newDpAmount) || 0) : '—'}</div>
                    </div>
                    <div className="inv-label">
                      <div className="inv-detail-label">Sisa Pembayaran</div>
                      <div className="inv-detail-value" style={{ color: 'var(--color-danger-dark)' }}>
                        {formatCurrency(Math.max(Number(invoice.total || 0) - (Number(newDpAmount) || 0), 0))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="inv-form-actions">
                  <button
                    type="button"
                    className="adm-btn adm-btn--primary"
                    onClick={handleStatusUpdate}
                    disabled={statusUpdating}
                  >
                    {statusUpdating ? 'Menyimpan…' : '💾 Simpan'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="inv-modal-footer">
            <button type="button" className="adm-btn" onClick={onClose}>Tutup</button>
            {/* Fitur 4: Print Nota Termal */}
            <button
              type="button"
              className="adm-btn adm-btn--thermal"
              onClick={() => setThermalOpen(true)}
              title="Print nota termal (58mm)"
            >
              🖨️ Print Nota
            </button>
            {/* Fitur 4: Download PDF A4 */}
            <button
              type="button"
              className="adm-btn adm-btn--secondary"
              onClick={async () => {
                try {
                  await openInvoicePdf(invoice.id);
                } catch {
                  showToast('Gagal membuka PDF invoice.', 'error');
                }
              }}
              title="Buka/download PDF invoice A4"
            >
              📄 PDF A4
            </button>
            {/* Fitur 4: Kirim email PDF ke customer */}
            {invoice.customer_email && (
              <button
                type="button"
                className="adm-btn adm-btn--primary"
                onClick={handleSendEmail}
                disabled={emailSending}
                title={`Kirim PDF invoice ke ${invoice.customer_email}`}
              >
                {emailSending ? 'Mengirim…' : '📧 Kirim Email'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fitur 4: Resi Termal Modal */}
      {thermalOpen && (
        <ThermalReceiptModal invoice={invoice} onClose={() => setThermalOpen(false)} />
      )}
    </>
  );
}

// ── Main InvoiceSection ───────────────────────────────────────────────────────

export default function InvoiceSection() {
  const [result, setResult]           = useState({ items: [], total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 });
  const [page, setPage]               = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [detailId, setDetailId]       = useState(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const data = await listInvoices({ page, limit: PAGE_SIZE, payment_status: filterStatus });
      setResult(data);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    }
  }, [page, filterStatus]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // Real-time: reload invoice list saat ada order baru atau status berubah
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function handleOrderNew() {
      fetchInvoices();
    }
    function handleOrderStatusChanged() {
      fetchInvoices();
    }

    socket.on('order:new', handleOrderNew);
    socket.on('order:status_changed', handleOrderStatusChanged);

    return () => {
      socket.off('order:new', handleOrderNew);
      socket.off('order:status_changed', handleOrderStatusChanged);
    };
  }, [fetchInvoices]);

  function handleUpdated(updatedInv) {
    setResult((prev) => ({
      ...prev,
      items: prev.items.map((inv) => inv.id === updatedInv.id ? { ...inv, ...updatedInv } : inv),
    }));
  }

  return (
    <div className="adm-card">
      <div className="adm-toolbar">
        <h2 className="adm-section-title">Invoice ({result.total})</h2>
        <div className="adm-toolbar-right">
          <select
            className="adm-input"
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            aria-label="Filter status pembayaran"
          >
            <option value="">Semua Status</option>
            <option value="unpaid">Belum Bayar</option>
            <option value="dp">DP</option>
            <option value="paid">Lunas</option>
          </select>
        </div>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>No. Invoice</th>
              <th>No. Order</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Status</th>
              <th>Metode Bayar</th>
              <th>Tanggal</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={8} className="adm-empty">Belum ada invoice.</td>
              </tr>
            ) : result.items.map((inv) => {
              const psCfg = PAYMENT_STATUS_LABELS[inv.payment_status] || { label: inv.payment_status, color: '#333', bg: '#eee' };
              return (
                <tr key={inv.id}>
                  <td><code>{inv.invoice_number}</code></td>
                  <td><code>{inv.order_number || '—'}</code></td>
                  <td>{inv.customer_name || '—'}</td>
                  <td><strong>{formatCurrency(inv.total)}</strong></td>
                  <td>
                    <span className="inv-status-badge" style={{ background: psCfg.bg, color: psCfg.color }}>
                      {psCfg.label}
                    </span>
                  </td>
                  <td>{inv.payment_method || '—'}</td>
                  <td>
                    <div>{new Date(inv.created_at).toLocaleDateString('id-ID')}</div>
                    {inv.paid_at && (
                      <div className="adm-date">Dibayar: {new Date(inv.paid_at).toLocaleDateString('id-ID')}</div>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="adm-btn adm-btn--detail"
                      onClick={() => setDetailId(inv.id)}
                    >
                      🔍 Detail
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PaginationBar
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        limit={result.limit}
        onPageChange={setPage}
      />

      {detailId && (
        <InvoiceDetailModal
          invoiceId={detailId}
          onClose={() => setDetailId(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
