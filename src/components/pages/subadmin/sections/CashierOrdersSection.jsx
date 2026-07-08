/**
 * CashierOrdersSection.jsx — Orders filtered to payment-related statuses.
 *
 * Cashier responsibilities: verify payments and confirm incoming orders.
 * Visible statuses: "Waiting for Payment", "Payment Accepted"
 *
 * Requirements: 11.1, 13.4
 */

import { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../../../context/AuthContext.jsx';
import {
  listOrdersPaginated,
  getOrderById,
  updateOrderStatus,
  updateAdminNote,
  getAllowedNextStatuses,
  STATUS_CONFIG,
} from '../../../../services/orderService.js';
import { formatCurrency } from '../../../../core/helpers.js';
import OrderDetailModal from '../../../shared/OrderDetailModal.jsx';
import { showToast } from '../../../../core/toastEmitter.js';
import { resolveApiUrl } from '../../../../core/httpClient.js';
import { createInvoice, getInvoiceByOrderId, openInvoicePdf } from '../../../../services/invoiceService.js';

const CASHIER_STATUSES = ['Waiting for Payment', 'Payment Accepted'];

function getProofUrl(proof) {
  if (!proof) return null;
  if (typeof proof === 'string') return resolveApiUrl(proof);
  if (proof.dataUrl) return proof.dataUrl;
  if (proof.url) return resolveApiUrl(proof.url);
  return null;
}

function CashierProofCell({ order, onCancel }) {
  const proof = order.paymentProof;
  const proofUrl = getProofUrl(proof);

  return (
    <div className="cashier-proof-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      {/* Bukti bayar button */}
      {proof ? (
        proofUrl ? (
          <a
            className="adm-btn cashier-proof-view-btn"
            href={proofUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            🔍 Lihat
          </a>
        ) : (
          <span className="adm-date">Ada bukti</span>
        )
      ) : (
        <span className="adm-date">Belum ada bukti</span>
      )}

      {/* Cancel button — only for non-terminal statuses */}
      {order.status !== 'Cancelled' && order.status !== 'Finished' && (
        <button
          type="button"
          className="adm-btn"
          style={{
            background: '#b91c1c',
            color: '#fff',
            border: 'none',
            fontSize: '12px',
            padding: '4px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
          onClick={() => onCancel(order.id)}
        >
          ❌ Batalkan
        </button>
      )}
    </div>
  );
}

export default function CashierOrdersSection() {
  const { user } = useContext(AuthContext);
  const actorRole = user?.role || 'cashier';

  const [orders, setOrders]           = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailOpen, setDetailOpen]   = useState(false);
  const [noteValues, setNoteValues]   = useState({});
  // Fitur 2: track invoice status per order
  const [invoiceMap, setInvoiceMap]   = useState({}); // orderId → invoice|null|'loading'
  const [creatingInvoice, setCreatingInvoice] = useState(null); // orderId

  // Cancellation dialog state
  const [cancelDialogOpen, setCancelDialogOpen]       = useState(false);
  const [cancelTargetOrderId, setCancelTargetOrderId] = useState(null);
  const [cancelReason, setCancelReason]               = useState('');
  const [cancelReasonErr, setCancelReasonErr]         = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      const results = await Promise.all(
        CASHIER_STATUSES.map((status) =>
          listOrdersPaginated({ page: 1, limit: 200, status })
            .then((r) => r.items)
            .catch(() => [])
        )
      );
      let all = results.flat();
      const q = searchQuery.toLowerCase();
      if (q) {
        all = all.filter(
          (o) =>
            (o.orderNumber || '').toLowerCase().includes(q) ||
            (o.customer?.name || '').toLowerCase().includes(q) ||
            (o.customerPhone || '').includes(q)
        );
      }
      setOrders(all);
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
  }, [searchQuery]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    function handler() { fetchOrders(); }
    window.addEventListener('gala:orders-updated', handler);
    return () => window.removeEventListener('gala:orders-updated', handler);
  }, [fetchOrders]);

  // Fitur 2: cek invoice untuk setiap order Payment Accepted
  useEffect(() => {
    orders.forEach((order) => {
      if (order.status !== 'Payment Accepted') return;
      if (invoiceMap[order.id] !== undefined) return; // sudah di-fetch
      setInvoiceMap((prev) => ({ ...prev, [order.id]: 'loading' }));
      getInvoiceByOrderId(order.id)
        .then((inv) => setInvoiceMap((prev) => ({ ...prev, [order.id]: inv })))
        .catch(() => setInvoiceMap((prev) => ({ ...prev, [order.id]: null })));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  async function handleAdvance(orderId, nextStatus) {
    const res = await updateOrderStatus(orderId, nextStatus, actorRole);
    if (res.ok) {
      showToast(`Status → "${nextStatus}".`, 'success');
    } else {
      showToast(res.message || 'Gagal mengubah status.', 'error');
    }
    fetchOrders();
  }

  async function handleNoteBlur(orderId) {
    const note = noteValues[orderId] ?? '';
    const res = await updateAdminNote(orderId, note);
    if (res.ok) showToast('Catatan disimpan.', 'success', 1500);
  }

  function handleNoteKeyDown(e, orderId) {
    if (e.key === 'Enter') { e.preventDefault(); handleNoteBlur(orderId); }
  }

  async function handleDetailClick(orderId) {
    try {
      const order = await getOrderById(orderId);
      if (order) { setSelectedOrder(order); setDetailOpen(true); }
    } catch (err) {
      console.error('Failed to load order detail:', err);
    }
  }

  // Open cancel dialog
  function handleOpenCancel(orderId) {
    setCancelTargetOrderId(orderId);
    setCancelReason('');
    setCancelReasonErr('');
    setCancelDialogOpen(true);
  }

  // Confirm cancellation
  async function handleCancelConfirm() {
    if (!cancelReason.trim()) {
      setCancelReasonErr('Alasan pembatalan wajib diisi.');
      return;
    }
    const res = await updateOrderStatus(cancelTargetOrderId, 'Cancelled', actorRole, cancelReason.trim());
    if (res.ok) {
      showToast('Pesanan dibatalkan.', 'success');
      setCancelDialogOpen(false);
      setCancelTargetOrderId(null);
      setCancelReason('');
      setCancelReasonErr('');
      fetchOrders();
    } else {
      setCancelReasonErr(res.message || 'Gagal membatalkan pesanan.');
    }
  }

  function handleCancelClose() {
    setCancelDialogOpen(false);
    setCancelTargetOrderId(null);
    setCancelReason('');
    setCancelReasonErr('');
  }

  // Fitur 2: buat invoice dari order
  async function handleCreateInvoice(orderId) {
    setCreatingInvoice(orderId);
    try {
      const inv = await createInvoice({ order_id: orderId });
      setInvoiceMap((prev) => ({ ...prev, [orderId]: inv }));
      showToast(`Invoice ${inv.invoice_number} berhasil dibuat.`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal membuat invoice.', 'error');
    } finally {
      setCreatingInvoice(null);
    }
  }

  return (
    <div className="adm-card">
      <div className="adm-toolbar">
        <h2 className="adm-section-title">
          Pesanan Saya ({orders.length})
          <span className="adm-date" style={{ fontWeight: 400, marginLeft: '8px' }}>
            Status: {CASHIER_STATUSES.join(', ')}
          </span>
        </h2>
        <div className="adm-toolbar-right">
          <input
            className="adm-input adm-search"
            type="search"
            placeholder="Cari ID / nama…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.trim())}
            aria-label="Cari pesanan"
          />
        </div>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>No. Transaksi</th>
              <th>Customer</th>
              <th>Produk</th>
              <th>Status</th>
              <th>Catatan</th>
              <th>Aksi</th>
              <th>Bukti Bayar</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="adm-empty">
                  Tidak ada pesanan untuk ditangani.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const cfg     = STATUS_CONFIG[order.status] || { icon: '○', badge: '' };
                const allowed = getAllowedNextStatuses(order.status, actorRole, order.orderType || 'standard');
                // Filter out 'Cancelled' from advance button — handled separately
                const advanceTargets = allowed.filter((s) => s !== 'Cancelled');

                return (
                  <tr key={order.id}>
                    <td>
                      <code>{order.orderNumber}</code>
                      {order.updatedAt && (
                        <div className="adm-date">
                          {new Date(order.updatedAt).toLocaleDateString('id-ID')}
                        </div>
                      )}
                    </td>
                    <td>
                      <div>{order.customer?.name || order.customerPhone || '—'}</div>
                      {order.customer?.phone && (
                        <div className="adm-date">{order.customer.phone}</div>
                      )}
                    </td>
                    <td>
                      <div className="odm-items-chips">
                        {(order.items || []).map((item, idx) => (
                          <span key={item.id || idx} className="odm-item-chip">
                            {item.name} ×{item.quantity}
                            {(item.designFileName || item.designDataUrl) ? ' 🎨' : ''}
                          </span>
                        ))}
                        {(!order.items || order.items.length === 0) && '—'}
                      </div>
                      <div className="adm-date">{formatCurrency(order.subtotal)}</div>
                    </td>
                    <td>
                      <span className={`order-status-badge ${cfg.badge}`}>
                        {cfg.icon} {order.status}
                      </span>
                    </td>
                    <td>
                      <input
                        className="adm-input adm-note-input"
                        type="text"
                        placeholder="Catatan…"
                        value={noteValues[order.id] ?? order.adminNote ?? ''}
                        onChange={(e) =>
                          setNoteValues((prev) => ({ ...prev, [order.id]: e.target.value }))
                        }
                        onBlur={() => handleNoteBlur(order.id)}
                        onKeyDown={(e) => handleNoteKeyDown(e, order.id)}
                      />
                    </td>
                    <td>
                      <div className="adm-actions">
                        {advanceTargets.length > 0 && (
                          <button
                            className="adm-btn adm-btn--primary"
                            type="button"
                            onClick={() => handleAdvance(order.id, advanceTargets[0])}
                          >
                            {cfg.icon} → {advanceTargets[0]}
                          </button>
                        )}
                        <button
                          className="adm-btn adm-btn--detail"
                          type="button"
                          title="Lihat detail pesanan"
                          onClick={() => handleDetailClick(order.id)}
                          style={{ marginTop: advanceTargets.length > 0 ? '4px' : '0' }}
                        >
                          🔍 Detail
                        </button>

                        {/* Fitur 2: Invoice button — tampil untuk Payment Accepted */}
                        {order.status === 'Payment Accepted' && (
                          <div style={{ marginTop: '4px' }}>
                            {invoiceMap[order.id] === 'loading' ? (
                              <span className="adm-date">Mengecek invoice…</span>
                            ) : invoiceMap[order.id] ? (
                              <button
                                className="adm-btn adm-btn--secondary"
                                type="button"
                                style={{ fontSize: '11px', padding: '4px 8px' }}
                                onClick={() => openInvoicePdf(invoiceMap[order.id].id)}
                                title={`Invoice ${invoiceMap[order.id].invoice_number}`}
                              >
                                🧾 {invoiceMap[order.id].invoice_number}
                              </button>
                            ) : (
                              <button
                                className="adm-btn adm-btn--thermal"
                                type="button"
                                style={{ fontSize: '11px', padding: '4px 8px' }}
                                disabled={creatingInvoice === order.id}
                                onClick={() => handleCreateInvoice(order.id)}
                                title="Buat invoice untuk order ini"
                              >
                                {creatingInvoice === order.id ? 'Membuat…' : '➕ Invoice'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="adm-date" style={{ marginTop: '4px' }}>
                        {new Date(order.createdAt).toLocaleDateString('id-ID')}
                      </div>
                    </td>
                    <td>
                      <CashierProofCell
                        order={order}
                        onCancel={handleOpenCancel}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <OrderDetailModal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        order={selectedOrder}
      />

      {/* ── Cancellation Reason Dialog ── */}
      {cancelDialogOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff', borderRadius: '12px', padding: '28px 32px',
              minWidth: '360px', maxWidth: '480px', width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700 }}>
              ❌ Batalkan Pesanan
            </h3>
            <p style={{ margin: '0 0 16px', color: '#555', fontSize: '14px' }}>
              Masukkan alasan pembatalan. Alasan ini akan ditampilkan kepada customer.
            </p>
            <textarea
              className="adm-input"
              rows={4}
              placeholder="Contoh: Bukti pembayaran tidak valid, customer tidak merespons, dll."
              value={cancelReason}
              onChange={(e) => { setCancelReason(e.target.value); setCancelReasonErr(''); }}
              style={{ width: '100%', resize: 'vertical', marginBottom: '8px', boxSizing: 'border-box' }}
              aria-label="Alasan pembatalan"
            />
            {cancelReasonErr && (
              <p style={{ color: '#b91c1c', fontSize: '13px', margin: '0 0 12px' }}>
                {cancelReasonErr}
              </p>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="adm-btn" onClick={handleCancelClose}>
                Batal
              </button>
              <button
                type="button"
                className="adm-btn"
                style={{ background: '#b91c1c', color: '#fff', border: 'none' }}
                onClick={handleCancelConfirm}
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
