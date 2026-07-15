/**
 * InvoiceSection.jsx — Panel invoice untuk cashier & admin.
 *
 * Fitur 2: list invoice, update payment status.
 * Fitur 3: tampilkan delivery method di detail order.
 * Fitur 4: tombol Print Resi (termal) & Download/Kirim PDF A4.
 * Fitur offline: tombol "➕ Order Offline" untuk input pesanan toko.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  listInvoices,
  getInvoiceById,
  updateInvoicePaymentStatus,
  updateInvoice,
  sendInvoiceEmail,
  openInvoicePdf,
} from '../../../../services/invoiceService.js';
import { api } from '../../../../core/httpClient.js';
import { showToast } from '../../../../core/toastEmitter.js';
import { formatCurrency } from '../../../../utils/format.js';
import ThermalReceiptModal from '../../../modals/ThermalReceiptModal.jsx';
import { getSocket } from '../../../../core/socket.js';

const PAGE_SIZE = 20;

const PAYMENT_STATUS_LABELS = {
  unpaid:  { label: 'Belum Bayar', color: '#b91c1c', bg: '#fee2e2' },
  paid:    { label: 'Lunas',       color: '#166534', bg: '#dcfce7' },
  partial: { label: 'Partial',     color: '#92400e', bg: '#fef3c7' },
};

function PaginationBar({ page, totalPages, total, limit, onPageChange }) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * limit + 1;
  const end   = Math.min(page * limit, total);
  return (
    <div className="adm-pagination">
      <span className="adm-page-info">{start}–{end} dari {total}</span>
      <div className="adm-page-btns">
        <button className="adm-page-btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>‹</button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p = Math.max(1, Math.min(page - 2 + i, totalPages - 4 + i));
          return (
            <button key={p} className={`adm-page-btn${p === page ? ' active' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
          );
        })}
        <button className="adm-page-btn" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>›</button>
      </div>
    </div>
  );
}

// ── Create Offline Order Modal ────────────────────────────────────────────────

function CreateOfflineOrderModal({ onClose, onCreated }) {
  const [customerName, setCustomerName]   = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [adminNote, setAdminNote]         = useState('');
  const [items, setItems]                 = useState([{ name: '', price: '', quantity: 1 }]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');

  function addItem() {
    setItems((prev) => [...prev, { name: '', price: '', quantity: 1 }]);
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx, field, value) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!customerName.trim()) { setError('Nama customer wajib diisi.'); return; }
    if (items.some((it) => !it.name.trim() || !it.price)) { setError('Semua item harus memiliki nama dan harga.'); return; }

    setLoading(true);
    setError('');
    try {
      const validItems = items.map((it) => ({
        name: it.name.trim(),
        price: Number(it.price),
        quantity: Number(it.quantity) || 1,
      }));

      const res = await api.post('/api/orders/offline', {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        adminNote: adminNote.trim(),
        items: validItems,
        subtotal,
      });

      showToast(`Order offline berhasil dibuat: ${res.data.data.order_number}`, 'success');
      onCreated(res.data.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membuat order offline.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inv-modal-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="inv-modal-header">
          <h3>🏪 Input Order Offline / Toko</h3>
          <button type="button" className="inv-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="inv-form">
          {/* Data Customer */}
          <div style={{ background: '#faf8f5', borderRadius: '8px', padding: '14px', marginBottom: '4px' }}>
            <div className="inv-section-title" style={{ marginBottom: '10px' }}>Data Customer</div>
            <div className="inv-form-row">
              <label className="inv-label">
                Nama Customer <span style={{ color: '#b91c1c' }}>*</span>
                <input className="adm-input" type="text" placeholder="Nama customer…" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
              </label>
              <label className="inv-label">
                No. Telepon
                <input className="adm-input" type="tel" placeholder="0812xxxx…" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </label>
            </div>
            <label className="inv-label" style={{ marginTop: '10px' }}>
              Alamat
              <input className="adm-input" type="text" placeholder="Alamat customer (opsional)…" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
            </label>
          </div>

          {/* Item Pesanan */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div className="inv-section-title" style={{ marginBottom: 0 }}>Item Pesanan</div>
              <button type="button" className="adm-btn" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={addItem}>+ Tambah Item</button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'flex-end' }}>
                <label className="inv-label">
                  {idx === 0 && <>Nama Produk <span style={{ color: '#b91c1c' }}>*</span></>}
                  <input className="adm-input" type="text" placeholder="Nama produk/jasa…" value={item.name} onChange={(e) => updateItem(idx, 'name', e.target.value)} required />
                </label>
                <label className="inv-label">
                  {idx === 0 && <>Harga Satuan <span style={{ color: '#b91c1c' }}>*</span></>}
                  <input className="adm-input" type="number" min="0" placeholder="0" value={item.price} onChange={(e) => updateItem(idx, 'price', e.target.value)} required />
                </label>
                <label className="inv-label">
                  {idx === 0 && 'Qty'}
                  <input className="adm-input" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                </label>
                <div style={{ paddingBottom: '2px' }}>
                  {items.length > 1 && (
                    <button type="button" className="adm-btn" style={{ padding: '6px 10px', color: '#b91c1c', border: '1px solid #fca5a5' }} onClick={() => removeItem(idx)}>✕</button>
                  )}
                </div>
              </div>
            ))}
            <div style={{ textAlign: 'right', fontSize: '14px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
              Subtotal: {formatCurrency(subtotal)}
            </div>
          </div>

          <label className="inv-label">
            Catatan Admin
            <textarea className="adm-input" rows={2} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Catatan internal (opsional)…" style={{ resize: 'vertical' }} />
          </label>

          {error && <p className="inv-error">{error}</p>}
          <div className="inv-form-actions">
            <button type="button" className="adm-btn" onClick={onClose}>Batal</button>
            <button type="submit" className="adm-btn adm-btn--primary" disabled={loading}>
              {loading ? 'Menyimpan…' : '💾 Simpan Order Offline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Invoice Detail Modal ──────────────────────────────────────────────────────

function InvoiceDetailModal({ invoiceId, onClose, onUpdated }) {
  const [invoice, setInvoice]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [emailSending, setEmailSending]     = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [newMethod, setNewMethod] = useState('');
  const [thermalOpen, setThermalOpen] = useState(false);

  useEffect(() => {
    getInvoiceById(invoiceId)
      .then((inv) => {
        setInvoice(inv);
        setNewStatus(inv.payment_status);
        setNewMethod(inv.payment_method || '');
      })
      .catch(() => showToast('Gagal memuat invoice.', 'error'))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  async function handleStatusUpdate() {
    if (!newStatus || invoice.locked) return;
    setStatusUpdating(true);
    try {
      const updated = await updateInvoicePaymentStatus(invoice.id, newStatus, newMethod);
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
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Order: {invoice.order_number}</span>
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
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>🔒 Locked (sudah paid)</div>
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
                    <tr><td colSpan={4} style={{ color: '#9ca3af', padding: '12px' }}>—</td></tr>
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
              <div className="inv-total-row inv-total-row--grand"><span>TOTAL</span><span>{formatCurrency(invoice.total)}</span></div>
            </div>

            {/* Update payment status — hanya jika belum locked */}
            {!invoice.locked && (
              <div className="inv-update-section">
                <div className="inv-section-title">Update Status Pembayaran</div>
                <div className="inv-form-row" style={{ alignItems: 'flex-end' }}>
                  <label className="inv-label">
                    Status
                    <select className="adm-input" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                      <option value="unpaid">Belum Bayar</option>
                      <option value="partial">Partial</option>
                      <option value="paid">Lunas</option>
                    </select>
                  </label>
                  <label className="inv-label">
                    Metode Bayar
                    <select className="adm-input" value={newMethod} onChange={(e) => setNewMethod(e.target.value)}>
                      <option value="">— Pilih —</option>
                      <option value="Transfer Bank">Transfer Bank</option>
                      <option value="QRIS">QRIS</option>
                      <option value="Tunai">Tunai</option>
                      <option value="COD">COD</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="adm-btn adm-btn--primary"
                    onClick={handleStatusUpdate}
                    disabled={statusUpdating}
                    style={{ alignSelf: 'flex-end' }}
                  >
                    {statusUpdating ? 'Menyimpan…' : 'Simpan'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="inv-modal-footer">
            <button type="button" className="adm-btn" onClick={onClose}>Tutup</button>
            {/* Fitur 4: Print Resi Termal */}
            <button
              type="button"
              className="adm-btn adm-btn--thermal"
              onClick={() => setThermalOpen(true)}
              title="Print resi termal (58mm)"
            >
              🖨️ Print Resi
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
  const [offlineOpen, setOfflineOpen] = useState(false);
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

  function handleCreated() {
    fetchInvoices();
  }

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
            <option value="partial">Partial</option>
            <option value="paid">Lunas</option>
          </select>
          <button
            type="button"
            className="adm-btn adm-btn--primary"
            onClick={() => setOfflineOpen(true)}
          >
            🏪 Order Offline
          </button>
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

      {offlineOpen && (
        <CreateOfflineOrderModal
          onClose={() => setOfflineOpen(false)}
          onCreated={() => { handleCreated(); }}
        />
      )}

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
