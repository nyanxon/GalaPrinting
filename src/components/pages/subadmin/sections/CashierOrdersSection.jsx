/**
 * CashierOrdersSection.jsx — Orders untuk Cashier role.
 *
 * Fitur 1: Cashier sekarang melihat SEMUA order. Order tidak pernah hilang
 *          setelah status berubah. Kolom "Status Saya" menunjukkan state
 *          order dari perspektif Cashier.
 *
 * Fitur 2: Invoice button muncul untuk order ber-status "Payment Accepted".
 *
 * Fitur 4: Socket auto-refresh saat ada order baru atau status berubah.
 *
 * Requirements: 11.1, 13.4
 */

import { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../../../context/AuthContext.jsx';
import {
  listAllOrders,
  getOrderById,
  updateOrderStatus,
  updateAdminNote,
  getAllowedNextStatuses,
  STATUS_CONFIG,
} from '../../../../services/orderService.js';
import { getSocket } from '../../../../core/socket.js';
import { formatCurrency } from '../../../../core/helpers.js';
import OrderDetailModal from '../../../shared/OrderDetailModal.jsx';
import { showToast } from '../../../../core/toastEmitter.js';
import { resolveApiUrl } from '../../../../core/httpClient.js';
import { getInvoiceByOrderId, openInvoicePdf, createInvoice } from '../../../../services/invoiceService.js';
import ThermalReceiptModal from '../../../shared/ThermalReceiptModal.jsx';

// ── Fitur 1: state order dari perspektif Cashier ──────────────────────────────

const CASHIER_STAGES = ['Waiting for Payment', 'Payment Accepted'];
const STATUS_ORDER = [
  'Waiting for Payment', 'Payment Accepted', 'Waiting for Design Approval',
  'Design Accepted', 'On Progress', 'Quality Checking', 'In Delivery', 'Finished',
];

function getOrderState(order, role) {
  const status = order.status;
  if (status === 'Cancelled') return 'terminal';

  const allowed = getAllowedNextStatuses(status, role, order.orderType || 'standard');
  if (allowed.length > 0) return 'action';

  if (CASHIER_STAGES.includes(status)) return 'done';

  const statusIdx    = STATUS_ORDER.indexOf(status);
  const lastStageIdx = Math.max(...CASHIER_STAGES.map((s) => STATUS_ORDER.indexOf(s)).filter((i) => i >= 0));
  if (statusIdx > lastStageIdx) return 'done';

  return 'pending';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getProofUrl(proof) {
  if (!proof) return null;
  if (typeof proof === 'string') return resolveApiUrl(proof);
  if (proof.dataUrl) return proof.dataUrl;
  if (proof.url) return resolveApiUrl(proof.url);
  return null;
}

function CashierProofCell({ order, onCancel }) {
  const proof    = order.paymentProof;
  const proofUrl = getProofUrl(proof);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      {proof ? (
        proofUrl ? (
          <a className="adm-btn" href={proofUrl} target="_blank" rel="noopener noreferrer">
            🔍 Lihat
          </a>
        ) : (
          <span className="adm-date">Ada bukti</span>
        )
      ) : (
        <span className="adm-date">Belum ada bukti</span>
      )}

      {order.status !== 'Cancelled' && order.status !== 'Finished' && order.status !== 'Payment Accepted' && (
        <button
          type="button"
          className="adm-btn"
          style={{
            background: '#b91c1c', color: '#fff', border: 'none',
            fontSize: '12px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
          }}
          onClick={() => onCancel(order.id)}
        >
          ❌ Batalkan
        </button>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CashierOrdersSection() {
  const { user } = useContext(AuthContext);
  const actorRole = user?.role || 'cashier';

  const [orders, setOrders]               = useState([]);
  const [searchQuery, setSearchQuery]     = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailOpen, setDetailOpen]       = useState(false);
  const [noteValues, setNoteValues]       = useState({});
  const [stateFilter, setStateFilter]     = useState('all');

  // Fitur 2: invoice status per order
  const [invoiceMap, setInvoiceMap]         = useState({});
  // Fitur 4 (print): thermal modal
  const [thermalInvoice, setThermalInvoice] = useState(null);

  // Cancellation dialog
  const [cancelDialogOpen, setCancelDialogOpen]       = useState(false);
  const [cancelTargetOrderId, setCancelTargetOrderId] = useState(null);
  const [cancelReason, setCancelReason]               = useState('');
  const [cancelReasonErr, setCancelReasonErr]         = useState('');

  // Fitur 1: fetch ALL orders — tidak ada filter status
  const fetchOrders = useCallback(async () => {
    try {
      const raw = await listAllOrders();
      let all = Array.isArray(raw) ? raw : [];

      // Sort: action → done → pending → terminal, lalu terbaru di atas dalam tiap grup
      const ORDER_MAP = { action: 0, done: 1, pending: 2, terminal: 3 };
      all = [...all].sort((a, b) => {
        const sa = ORDER_MAP[getOrderState(a, actorRole)] ?? 3;
        const sb = ORDER_MAP[getOrderState(b, actorRole)] ?? 3;
        if (sa !== sb) return sa - sb;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

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
  }, [searchQuery, actorRole]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Custom event (dari komponen lain)
  useEffect(() => {
    function handler() { fetchOrders(); }
    window.addEventListener('gala:orders-updated', handler);
    return () => window.removeEventListener('gala:orders-updated', handler);
  }, [fetchOrders]);

  // Fitur 4: auto-refresh saat socket event order baru / status berubah
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    function onOrderNew()      { fetchOrders(); }
    function onStatusChanged() { fetchOrders(); }
    socket.on('order:new',            onOrderNew);
    socket.on('order:status_changed', onStatusChanged);
    return () => {
      socket.off('order:new',            onOrderNew);
      socket.off('order:status_changed', onStatusChanged);
    };
  }, [fetchOrders]);

  // Fitur 2: lazy-load invoice untuk order Payment Accepted
  useEffect(() => {
    orders.forEach((order) => {
      if (order.status !== 'Payment Accepted') return;
      if (invoiceMap[order.id] !== undefined) return;
      setInvoiceMap((prev) => ({ ...prev, [order.id]: 'loading' }));
      getInvoiceByOrderId(order.id)
        .then((inv) => setInvoiceMap((prev) => ({ ...prev, [order.id]: inv ?? null })))
        .catch(() => setInvoiceMap((prev) => ({ ...prev, [order.id]: null })));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  async function handleAdvance(orderId, nextStatus) {
    // Jika akan advance ke Payment Accepted, reset invoiceMap agar bisa di-fetch ulang
    if (nextStatus === 'Payment Accepted') {
      setInvoiceMap((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    }

    const res = await updateOrderStatus(orderId, nextStatus, actorRole);
    if (res.ok) {
      showToast(`Status → "${nextStatus}".`, 'success');
    } else {
      showToast(res.message || 'Gagal mengubah status.', 'error');
      return;
    }
    fetchOrders();

    // Setelah Payment Accepted: auto-fetch invoice, buka PDF, tampilkan thermal
    if (nextStatus === 'Payment Accepted') {
      // Tunggu backend membuat invoice — naikkan timeout agar lebih andal di production
      await new Promise((resolve) => setTimeout(resolve, 2500));
      try {
        const inv = await getInvoiceByOrderId(orderId);
        if (inv) {
          // Update invoiceMap agar tombol langsung muncul
          setInvoiceMap((prev) => ({ ...prev, [orderId]: inv }));
          // Buka PDF A4 otomatis
          try { await openInvoicePdf(inv.id); } catch { /* silent */ }
          // Tampilkan modal resi termal
          setThermalInvoice(inv);
        } else {
          // Invoice belum siap setelah 2.5 detik — coba sekali lagi setelah 2 detik
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const invRetry = await getInvoiceByOrderId(orderId);
          if (invRetry) {
            setInvoiceMap((prev) => ({ ...prev, [orderId]: invRetry }));
            try { await openInvoicePdf(invRetry.id); } catch { /* silent */ }
            setThermalInvoice(invRetry);
          }
        }
      } catch {
        // Invoice mungkin belum siap — cashier bisa buka manual dari tabel
      }
    }
  }

  async function handleNoteBlur(orderId) {
    const note = noteValues[orderId] ?? '';
    const res  = await updateAdminNote(orderId, note);
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

  function handleOpenCancel(orderId) {
    setCancelTargetOrderId(orderId);
    setCancelReason('');
    setCancelReasonErr('');
    setCancelDialogOpen(true);
  }

  async function handleCancelConfirm() {
    if (!cancelReason.trim()) { setCancelReasonErr('Alasan pembatalan wajib diisi.'); return; }
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

  // Buat invoice jika belum ada (untuk order lama), lalu buka PDF + tampilkan thermal
  async function handleEnsureInvoice(orderId) {
    try {
      // Coba buat invoice
      const inv = await createInvoice({ order_id: orderId });
      setInvoiceMap((prev) => ({ ...prev, [orderId]: inv }));
      showToast(`Invoice ${inv.invoice_number} berhasil dibuat.`, 'success');
      // Buka PDF otomatis
      try { await openInvoicePdf(inv.id); } catch { /* silent */ }
      // Tampilkan thermal
      setThermalInvoice(inv);
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal membuat invoice.';
      showToast(msg, 'error');
      // Coba fetch ulang — mungkin sudah ada
      try {
        const existing = await getInvoiceByOrderId(orderId);
        if (existing) {
          setInvoiceMap((prev) => ({ ...prev, [orderId]: existing }));
        }
      } catch { /* ignore */ }
    }
  }

  // ── Filter display ────────────────────────────────────────────────────────

  const displayOrders = stateFilter === 'all'
    ? orders
    : orders.filter((o) => getOrderState(o, actorRole) === stateFilter);

  const actionCount  = orders.filter((o) => getOrderState(o, actorRole) === 'action').length;
  const doneCount    = orders.filter((o) => getOrderState(o, actorRole) === 'done').length;
  const pendingCount = orders.filter((o) => getOrderState(o, actorRole) === 'pending').length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="adm-card">
      <div className="adm-toolbar">
        <h2 className="adm-section-title">
          Semua Pesanan ({orders.length})
        </h2>
        <div className="adm-toolbar-right">
          {/* Filter toggle — Fitur 1 */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { key: 'all',     label: `Semua (${orders.length})` },
              { key: 'action',  label: `Butuh Aksi (${actionCount})` },
              { key: 'done',    label: `Selesai (${doneCount})` },
              { key: 'pending', label: `Menunggu (${pendingCount})` },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`adm-btn${stateFilter === key ? ' adm-btn--primary' : ''}`}
                style={{ fontSize: '12px', padding: '4px 10px' }}
                onClick={() => setStateFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            className="adm-input adm-search"
            type="search"
            placeholder="Cari ID / nama…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.trim())}
            aria-label="Cari pesanan"
            style={{ marginLeft: '8px' }}
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
              <th>Status Order</th>
              <th>Status Saya</th>
              <th>Catatan</th>
              <th>Aksi</th>
              <th>Bukti Bayar</th>
            </tr>
          </thead>
          <tbody>
            {displayOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="adm-empty">
                  {stateFilter === 'action'
                    ? 'Tidak ada pesanan yang butuh aksi sekarang.'
                    : 'Tidak ada pesanan.'}
                </td>
              </tr>
            ) : (
              displayOrders.map((order) => {
                const cfg            = STATUS_CONFIG[order.status] || { icon: '○', badge: '' };
                const allowed        = getAllowedNextStatuses(order.status, actorRole, order.orderType || 'standard');
                const advanceTargets = allowed.filter((s) => s !== 'Cancelled');
                const orderState     = getOrderState(order, actorRole);

                const stateBadge = {
                  action:  { text: 'Butuh Aksi',    bg: '#dcfce7', color: '#166534' },
                  done:    { text: 'Sudah Diproses', bg: '#e0e7ff', color: '#3730a3' },
                  pending: { text: 'Menunggu',       bg: '#fef9c3', color: '#92400e' },
                  terminal:{ text: '',               bg: '',        color: '' },
                }[orderState] || { text: '', bg: '', color: '' };

                return (
                  <tr
                    key={order.id}
                    style={{ opacity: (orderState === 'pending' || orderState === 'terminal') ? 0.65 : 1 }}
                  >
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

                    {/* Kolom Status Saya — Fitur 1 */}
                    <td>
                      {stateBadge.text ? (
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: '12px',
                          fontSize: '11px', fontWeight: 600,
                          background: stateBadge.bg, color: stateBadge.color,
                        }}>
                          {stateBadge.text}
                        </span>
                      ) : (
                        <span className="adm-date">—</span>
                      )}
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
                        disabled={orderState === 'pending'}
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

                        {/* Fitur 2: Invoice button untuk Payment Accepted */}
                        {order.status === 'Payment Accepted' && (
                          <div style={{ marginTop: '4px' }}>
                            {invoiceMap[order.id] === 'loading' ? (
                              <span className="adm-date">Mengecek…</span>
                            ) : invoiceMap[order.id] ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {/* Satu tombol PDF A4 */}
                                <button
                                  className="adm-btn adm-btn--secondary"
                                  type="button"
                                  style={{ fontSize: '11px', padding: '4px 8px' }}
                                  onClick={async () => {
                                    try { await openInvoicePdf(invoiceMap[order.id].id); }
                                    catch { showToast('Gagal membuka PDF invoice.', 'error'); }
                                  }}
                                  title={`Buka PDF invoice ${invoiceMap[order.id].invoice_number}`}
                                >
                                  🧾 {invoiceMap[order.id].invoice_number}
                                </button>
                                {/* Print Resi Termal */}
                                <button
                                  type="button"
                                  className="adm-btn adm-btn--thermal"
                                  style={{ fontSize: '11px', padding: '4px 8px' }}
                                  onClick={() => setThermalInvoice(invoiceMap[order.id])}
                                  title="Print resi termal (58/80mm)"
                                >
                                  🖨️ Print Resi
                                </button>
                              </div>
                            ) : (
                              /* Invoice belum ada — tampilkan tombol buat invoice (untuk order lama) */
                              <button
                                className="adm-btn"
                                type="button"
                                style={{
                                  fontSize: '11px', padding: '4px 8px',
                                  background: '#f59e0b', color: '#fff', border: 'none',
                                }}
                                onClick={() => handleEnsureInvoice(order.id)}
                                title="Buat invoice untuk order ini"
                              >
                                🧾 Buat Invoice
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
                      <CashierProofCell order={order} onCancel={handleOpenCancel} />
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

      {/* Fitur 4 (print): Resi Termal Modal */}
      {thermalInvoice && (
        <ThermalReceiptModal
          invoice={thermalInvoice}
          onClose={() => setThermalInvoice(null)}
        />
      )}

      {/* ── Cancellation Dialog ── */}
      {cancelDialogOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '28px 32px',
            minWidth: '360px', maxWidth: '480px', width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}>
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
