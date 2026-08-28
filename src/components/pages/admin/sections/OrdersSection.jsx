/**
 * OrdersSection.jsx — Paginated orders table with status select dropdown.
 * Fitur 1: menampilkan approval badge "Sudah di-ACC oleh [nama] pada [tgl]"
 *          dan memblokir update status untuk tahap yang sudah di-approve.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  listOrdersPaginated,
  updateOrderStatus,
  getAllowedNextStatuses,
  STATUS_CONFIG,
  ORDER_STATUSES,
} from '../../../../services/orders.js';
import { formatCurrency } from '../../../../utils/format.js';
import { track } from '../../../../utils/activityTracker.js';
import { getInvoiceByOrderId, openInvoicePdf } from '../../../../services/api/invoiceService.js';
import { showToast } from '../../../../core/toastEmitter.js';
import OrderDetailModal from '../../../modals/OrderDetailModal.jsx';
import ThermalReceiptModal from '../../../modals/ThermalReceiptModal.jsx';
import PaginationBar from '../../../ui/PaginationBar.jsx';
import useOrderList from '../../../../hooks/useOrderList.js';

const PAGE_SIZE = 10;

function getApprovalForCurrentStatus(order) {
  if (!Array.isArray(order.approvals) || order.approvals.length === 0) return null;
  return order.approvals.find((a) => a.stage === order.status) || null;
}

export default function OrdersSection() {
  const [result, setResult] = useState({ items: [], total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 });
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const fetchOrdersRef = useRef(null);

  const {
    searchQuery, setSearchQuery,
    selectedOrder, setSelectedOrder,
    detailOpen, setDetailOpen,
    noteValues, setNoteValues,
    actorRole,
    handleNoteBlur,
    handleNoteKeyDown,
    handleDetailClick,
    handleOpenCancel,
    handleCancelConfirm,
    handleCancelClose,
    cancelDialogOpen,
    cancelReason, setCancelReason,
    cancelReasonErr,
    invoiceMap, setInvoiceMap,
    thermalInvoice, setThermalInvoice,
    thermalAutoPrint, setThermalAutoPrint,
    pendingAutoPrintRef,
  } = useOrderList({
    fetchOrders: () => fetchOrdersRef.current?.(),
    defaultRole: 'admin',
    enableCancel: true,
    enableInvoice: true,
  });

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
        setResult({ ...data, items: filtered, total: filtered.length });
      } else {
        setResult(data);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
  }, [currentPage, filterStatus, searchQuery]);

  fetchOrdersRef.current = fetchOrders;

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Invoice lazy-load for "Payment Accepted" orders (with retry for 404)
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

  async function handleStatusChange(orderId, newStatus) {
    if (newStatus === 'Cancelled') {
      handleOpenCancel(orderId);
      return;
    }

    if (newStatus === 'Payment Accepted') {
      setInvoiceMap((prev) => { const n = { ...prev }; delete n[orderId]; return n; });
      pendingAutoPrintRef.current.add(orderId);
    }

    const current = result.items?.find((o) => o.id === orderId);
    const res = await updateOrderStatus(orderId, newStatus, actorRole);
    if (res.ok) {
      track('Ubah Status Order', {
        targetType: 'order', targetId: orderId,
        metadata: { from: current?.status ?? null, to: newStatus, role: actorRole },
      });
      showToast(`Status → "${newStatus}".`, 'success');
    } else {
      showToast(res.message || 'Gagal mengubah status.', 'error');
    }
    fetchOrders();
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
                <td colSpan={6} className="adm-empty">Belum ada pesanan.</td>
              </tr>
            ) : (
              result.items.map((order) => {
                const cfg = STATUS_CONFIG[order.status] || { icon: '○', badge: '' };
                const allowed = getAllowedNextStatuses(order.status, actorRole, order.orderType || 'standard');
                const approvalInfo = getApprovalForCurrentStatus(order);
                const isLocked = Boolean(approvalInfo);

                return (
                  <tr key={order.id}>
                    <td>
                      <code>{order.orderNumber}</code>
                      {order.updatedAt && (
                        <div className="adm-date">
                          Diperbarui: {new Date(order.updatedAt).toLocaleDateString('id-ID')}
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
                              title="Print resi termal"
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
          fetchOrders();
        }}
      />

      {thermalInvoice && (
        <ThermalReceiptModal
          invoice={thermalInvoice}
          onClose={() => { setThermalInvoice(null); setThermalAutoPrint(false); }}
          autoPrint={thermalAutoPrint}
        />
      )}

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
              onChange={(e) => { setCancelReason(e.target.value); }}
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
