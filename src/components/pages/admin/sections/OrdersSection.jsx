/**
 * OrdersSection.jsx — Paginated orders table with status select dropdown.
 * Fitur 1: menampilkan approval badge "Sudah di-ACC oleh [nama] pada [tgl]"
 *          dan memblokir update status untuk tahap yang sudah di-approve.
 */

import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { AuthContext } from '../../../context/AuthContext.jsx';
import {
  listOrdersPaginated,
  getOrderById,
  updateOrderStatus,
  updateAdminNote,
  getAllowedNextStatuses,
  STATUS_CONFIG,
  ORDER_STATUSES,
} from '../../../../services/orderService.js';
import { formatCurrency } from '../../../../core/helpers.js';
import OrderDetailModal from '../../../shared/OrderDetailModal.jsx';
import { showToast } from '../../../../core/toastEmitter.js';
import { useSocket } from '../../../context/SocketContext.jsx';
import { getInvoiceByOrderId, openInvoicePdf } from '../../../../services/invoiceService.js';
import ThermalReceiptModal from '../../../shared/ThermalReceiptModal.jsx';

const PAGE_SIZE = 10;

/**
 * Fitur 1: Cek apakah status saat ini sudah di-lock (sudah di-approve sebelumnya).
 * Jika iya, return objek approval; jika tidak, return null.
 * @param {object} order
 * @returns {{ approved_name: string, approved_at: string } | null}
 */
function getApprovalForCurrentStatus(order) {
  if (!Array.isArray(order.approvals) || order.approvals.length === 0) return null;
  return order.approvals.find((a) => a.stage === order.status) || null;
}

function PaginationBar({ page, totalPages, total, limit, onPageChange }) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  const pages = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) {
    pages.push(p);
  }

  return (
    <div className="adm-pagination">
      <span className="adm-page-info">
        {start}–{end} dari {total}
      </span>
      <div className="adm-page-btns">
        <button
          className="adm-page-btn"
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ‹
        </button>
        {pages.map((p) => (
          <button
            key={p}
            className={`adm-page-btn${p === page ? ' active' : ''}`}
            type="button"
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        <button
          className="adm-page-btn"
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}

export default function OrdersSection() {
  const { user } = useContext(AuthContext);
  const actorRole = user?.role || 'admin';
  const socket = useSocket();

  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [result, setResult] = useState({ items: [], total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [noteValues, setNoteValues] = useState({});
  const [cancelDialogOpen, setCancelDialogOpen]     = useState(false);
  const [cancelTargetOrderId, setCancelTargetOrderId] = useState(null);
  const [cancelReason, setCancelReason]             = useState('');
  const [cancelReasonErr, setCancelReasonErr]       = useState('');

  // Invoice + auto-print states
  const [invoiceMap, setInvoiceMap]                 = useState({});
  const [thermalInvoice, setThermalInvoice]         = useState(null);
  const [thermalAutoPrint, setThermalAutoPrint]     = useState(false);
  const pendingAutoPrintRef = useRef(new Set());

  const fetchOrders = useCallback(async () => {
    try {
      const data = await listOrdersPaginated({ page: currentPage, limit: PAGE_SIZE, status: filterStatus });
      const q = searchQuery.toLowerCase();
      if (q) {
        const filtered = data.items.filter(
          (o) =>
            o.orderNumber.toLowerCase().includes(q) ||
            (o.customer?.name || '').toLowerCase().includes(q) ||
            (o.customerPhone || '').includes(q)
        );
        return { ...data, items: filtered, total: filtered.length };
      }
      return data;
    } catch (err) {
      console.error('Failed to load orders:', err);
      return null;
    }
  }, [currentPage, filterStatus, searchQuery]);

  useEffect(() => {
    fetchOrders().then((data) => { if (data) setResult(data); });
  }, [fetchOrders]);

  // Listen for order updates from other parts of the app
  useEffect(() => {
    function handler() {
      fetchOrders().then((data) => { if (data) setResult(data); });
    }
    window.addEventListener('gala:orders-updated', handler);
    return () => window.removeEventListener('gala:orders-updated', handler);
  }, [fetchOrders]);

  // Real-time: listen socket order:new & order:status_changed agar tidak perlu refresh manual
  useEffect(() => {
    if (!socket) return;

    function handleOrderNew() {
      // Refresh list — order baru masuk
      fetchOrders().then((data) => { if (data) setResult(data); });
    }

    function handleOrderStatusChanged() {
      // Refresh list supaya status terbaru tampil
      fetchOrders().then((data) => { if (data) setResult(data); });
    }

    socket.on('order:new', handleOrderNew);
    socket.on('order:status_changed', handleOrderStatusChanged);

    return () => {
      socket.off('order:new', handleOrderNew);
      socket.off('order:status_changed', handleOrderStatusChanged);
    };
  }, [socket, fetchOrders]);

  // Lazy-load invoice for "Payment Accepted" orders (with retry for 404)
  useEffect(() => {
    result.items.forEach((order) => {
      if (order.status !== 'Payment Accepted') return;
      if (invoiceMap[order.id] !== undefined) return;
      setInvoiceMap((prev) => ({ ...prev, [order.id]: 'loading' }));

      async function fetchWithRetry(attempt = 0) {
        try {
          const inv = await getInvoiceByOrderId(order.id);
          if (inv) {
            setInvoiceMap((prev) => ({ ...prev, [order.id]: inv }));
          } else if (attempt < 1) {
            setTimeout(() => fetchWithRetry(attempt + 1), 1000);
          } else {
            setInvoiceMap((prev) => ({ ...prev, [order.id]: null }));
          }
        } catch {
          setInvoiceMap((prev) => ({ ...prev, [order.id]: null }));
        }
      }
      fetchWithRetry();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.items]);

  // Auto-print: when invoice loads for a pending order, trigger A4 PDF + thermal receipt
  useEffect(() => {
    for (const orderId of pendingAutoPrintRef.current) {
      const inv = invoiceMap[orderId];
      if (inv && inv !== 'loading' && inv !== 'error' && inv !== null) {
        pendingAutoPrintRef.current.delete(orderId);
        if (inv.id) {
          openInvoicePdf(inv.id).catch(() => {
            showToast('Gagal membuka PDF invoice.', 'error');
          });
        }
        setThermalInvoice(inv);
        setThermalAutoPrint(true);
        break;
      }
      if (inv === null || inv === 'error') {
        pendingAutoPrintRef.current.delete(orderId);
        showToast('Invoice gagal dimuat, silakan coba print manual.', 'error');
      }
    }
  }, [invoiceMap]);

  async function handleStatusChange(orderId, newStatus) {
    if (newStatus === 'Cancelled') {
      setCancelTargetOrderId(orderId);
      setCancelReason('');
      setCancelReasonErr('');
      setCancelDialogOpen(true);
      return;
    }

    // Track for auto-print when advancing to Payment Accepted
    if (newStatus === 'Payment Accepted') {
      setInvoiceMap((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      pendingAutoPrintRef.current.add(orderId);
    }

    const res = await updateOrderStatus(orderId, newStatus, actorRole);
    if (res.ok) {
      showToast(`Status → "${newStatus}".`, 'success');
    } else {
      showToast(res.message || 'Gagal mengubah status.', 'error');
    }
    const data = await fetchOrders();
    if (data) setResult(data);
  }

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
      const data = await fetchOrders();
      if (data) setResult(data);
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

  async function handleNoteBlur(orderId) {
    const note = noteValues[orderId] ?? '';
    const res = await updateAdminNote(orderId, note);
    if (res.ok) showToast('Catatan disimpan.', 'success', 1500);
  }

  function handleNoteKeyDown(e, orderId) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNoteBlur(orderId);
    }
  }

  async function handleDetailClick(orderId) {
    try {
      // Fetch full order with items, history, and design files
      const order = await getOrderById(orderId);
      if (order) {
        setSelectedOrder(order);
        setDetailOpen(true);
      }
    } catch (err) {
      console.error('Failed to load order detail:', err);
    }
  }

  function handleFilterChange(e) {
    setFilterStatus(e.target.value);
    setCurrentPage(1);
  }

  function handleSearchChange(e) {
    setSearchQuery(e.target.value.trim());
    setCurrentPage(1);
  }

  const filterOptions = ['', ...ORDER_STATUSES];

  return (
    <div className="adm-card">
      <div className="adm-toolbar">
        <h2 className="adm-section-title">Semua Pesanan ({result.total})</h2>
        <div className="adm-toolbar-right">
          <input
            className="adm-input adm-search"
            type="search"
            placeholder="Cari ID / nama customer…"
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Cari pesanan"
          />
          <select
            className="adm-input"
            value={filterStatus}
            onChange={handleFilterChange}
            aria-label="Filter status"
          >
            {filterOptions.map((s) => (
              <option key={s || '__all__'} value={s}>
                {s || 'Semua Status'}
              </option>
            ))}
          </select>
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
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="adm-empty">
                  Belum ada pesanan.
                </td>
              </tr>
            ) : (
              result.items.map((order) => {
                const cfg = STATUS_CONFIG[order.status] || { icon: '○', badge: '' };
                const allowed = getAllowedNextStatuses(
                  order.status,
                  actorRole,
                  order.orderType || 'standard'
                );

                // Fitur 1: cek apakah status ini sudah di-approve/locked
                const approvalInfo = getApprovalForCurrentStatus(order);
                const isLocked = Boolean(approvalInfo);

                return (
                  <tr key={order.id}>
                    <td>
                      <code>{order.orderNumber}</code>
                      {order.updatedAt && (
                        <div className="adm-date">
                          Diperbarui:{' '}
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
                      {order.promoCode && (
                        <div style={{ marginTop: '4px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            background: '#f0fdf4', border: '1px solid #bbf7d0',
                            borderRadius: '4px', padding: '2px 8px',
                            fontSize: '11px', fontWeight: 700, color: '#15803d',
                          }}>
                            🏷️ {order.promoCode} -{formatCurrency(order.discountAmount || 0)}
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      {/* Fitur 1: tampilkan badge ACC jika sudah di-lock, jika tidak tampilkan dropdown */}
                      {isLocked ? (
                        <div>
                          <span className={`order-status-badge ${cfg.badge}`} style={{ display: 'block', marginBottom: '6px' }}>
                            {cfg.icon} {order.status}
                          </span>
                          <span className="adm-approved-badge" title={`Di-ACC oleh ${approvalInfo.approved_name || approvalInfo.approver_name_live || 'admin'}`}>
                            ✅ Di-ACC: {approvalInfo.approved_name || approvalInfo.approver_name_live || 'Admin'}
                            <br />
                            <small>{new Date(approvalInfo.approved_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
                          </span>
                        </div>
                      ) : allowed.length > 0 ? (
                        <select
                          className="adm-status-select"
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          aria-label="Status"
                        >
                          <option value={order.status}>
                            {cfg.icon} {order.status}
                          </option>
                          {allowed.map((s) => {
                            const sc = STATUS_CONFIG[s] || { icon: '→' };
                            return (
                              <option key={s} value={s}>
                                {sc.icon} {s}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <span className={`order-status-badge ${cfg.badge}`}>
                          {cfg.icon} {order.status}
                        </span>
                      )}
                    </td>
                    <td>
                      <input
                        className="adm-input adm-note-input"
                        type="text"
                        placeholder="Catatan admin…"
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
                        <button
                          className="adm-btn adm-btn--detail"
                          type="button"
                          title="Lihat detail pesanan"
                          onClick={() => handleDetailClick(order.id)}
                        >
                          🔍 Detail
                        </button>

                        {/* Invoice buttons untuk Payment Accepted */}
                        {order.status === 'Payment Accepted' && invoiceMap[order.id] && invoiceMap[order.id] !== 'loading' && invoiceMap[order.id] !== null && (
                          <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                            <button
                              type="button"
                              className="adm-btn adm-btn--thermal"
                              style={{ fontSize: '11px', padding: '4px 8px' }}
                              onClick={() => { setThermalInvoice(invoiceMap[order.id]); setThermalAutoPrint(false); }}
                              title="Print resi termal (80mm)"
                            >
                              🖨️ Print Resi
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="adm-date" style={{ marginTop: '4px' }}>
                        {new Date(order.createdAt).toLocaleDateString('id-ID')}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        limit={result.limit}
        onPageChange={setCurrentPage}
      />

      <OrderDetailModal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        order={selectedOrder}
        actorRole={actorRole}
        onOrderUpdated={(updated) => {
          setSelectedOrder(updated);
          fetchOrders().then((data) => { if (data) setResult(data); });
        }}
      />

      {/* Thermal Receipt Modal */}
      {thermalInvoice && (
        <ThermalReceiptModal
          invoice={thermalInvoice}
          onClose={() => { setThermalInvoice(null); setThermalAutoPrint(false); }}
          autoPrint={thermalAutoPrint}
        />
      )}

      {/* ── Cancellation Reason Dialog ── */}
      {cancelDialogOpen && (
        <div
          className="cancel-dialog-overlay"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            className="cancel-dialog"
            style={{
              background: '#fff', borderRadius: '12px', padding: '28px 32px',
              minWidth: '360px', maxWidth: '480px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
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
              placeholder="Contoh: Stok habis, customer tidak merespons, dll."
              value={cancelReason}
              onChange={(e) => { setCancelReason(e.target.value); setCancelReasonErr(''); }}
              style={{ width: '100%', resize: 'vertical', marginBottom: '8px' }}
              aria-label="Alasan pembatalan"
            />
            {cancelReasonErr && (
              <p style={{ color: '#b91c1c', fontSize: '13px', margin: '0 0 12px' }}>
                {cancelReasonErr}
              </p>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="adm-btn"
                onClick={handleCancelClose}
              >
                Batal
              </button>
              <button
                type="button"
                className="adm-btn adm-btn--danger"
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
