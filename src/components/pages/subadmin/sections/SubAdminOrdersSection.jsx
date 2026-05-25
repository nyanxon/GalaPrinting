/**
 * SubAdminOrdersSection.jsx — Role-filtered orders table for sub-admin roles.
 *
 * Renders only the orders whose status falls within `visibleStatuses`.
 * Each role can advance orders to the next allowed status based on
 * ALLOWED_TRANSITIONS in orderService.js.
 *
 * Props:
 *   visibleStatuses — string[] of order statuses this role can see
 *   extraColumns    — optional object { header: string, renderCell: (order) => ReactNode }
 *                     for role-specific extra columns (e.g. Cashier proof, QC tracking)
 *
 * Requirements: 11.1, 11.2, 13.4
 */

import { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../../../context/AuthContext.jsx';
import {
  listOrdersPaginated,
  listAllOrders,
  getOrderById,
  updateOrderStatus,
  updateAdminNote,
  getAllowedNextStatuses,
  STATUS_CONFIG,
} from '../../../../services/orderService.js';
import { formatCurrency } from '../../../../core/helpers.js';
import OrderDetailModal from '../../../shared/OrderDetailModal.jsx';
import { showToast } from '../../../../core/toastEmitter.js';

export default function SubAdminOrdersSection({ visibleStatuses = [], extraColumn = null }) {
  const { user } = useContext(AuthContext);
  const actorRole = user?.role || 'admin';

  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [noteValues, setNoteValues] = useState({});

  const fetchOrders = useCallback(async () => {
    try {
      const q = searchQuery.toLowerCase();
      // In backend mode, filter by status on the server side (one request per visible status)
      // In localStorage mode, fetch all and filter client-side
      let all = [];
      if (visibleStatuses.length > 0) {
        // Fetch each visible status separately and merge (backend supports single status filter)
        const results = await Promise.all(
          visibleStatuses.map((status) =>
            listOrdersPaginated({ page: 1, limit: 200, status })
              .then((r) => r.items)
              .catch(() => [])
          )
        );
        all = results.flat();
      } else {
        const raw = await listAllOrders();
        all = Array.isArray(raw) ? raw : [];
      }

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
  }, [searchQuery, visibleStatuses]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Listen for order updates from other parts of the app
  useEffect(() => {
    function handler() { fetchOrders(); }
    window.addEventListener('gala:orders-updated', handler);
    return () => window.removeEventListener('gala:orders-updated', handler);
  }, [fetchOrders]);

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

  const statusLabel = visibleStatuses.join(', ');

  return (
    <div className="adm-card">
      <div className="adm-toolbar">
        <h2 className="adm-section-title">
          Pesanan Saya ({orders.length})
          <span className="adm-date" style={{ fontWeight: 400, marginLeft: '8px' }}>
            Status: {statusLabel}
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
              {extraColumn && <th>{extraColumn.header}</th>}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={extraColumn ? 7 : 6} className="adm-empty">
                  Tidak ada pesanan untuk ditangani.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const cfg = STATUS_CONFIG[order.status] || { icon: '○', badge: '' };
                const allowed = getAllowedNextStatuses(
                  order.status,
                  actorRole,
                  order.orderType || 'standard'
                );
                // QC role handles delivery via extra column — don't show advance btn for those statuses
                const isQcDeliveryStatus =
                  actorRole === 'qc' &&
                  (order.status === 'Quality Checking' || order.status === 'In Delivery');
                const showAdvanceBtn = allowed.length > 0 && !isQcDeliveryStatus;

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
                        {showAdvanceBtn && (
                          <button
                            className="adm-btn adm-btn--primary"
                            type="button"
                            onClick={() => handleAdvance(order.id, allowed[0])}
                          >
                            {cfg.icon} → {allowed[0]}
                          </button>
                        )}
                        <button
                          className="adm-btn adm-btn--detail"
                          type="button"
                          title="Lihat detail pesanan"
                          onClick={() => handleDetailClick(order.id)}
                          style={{ marginTop: showAdvanceBtn ? '4px' : '0' }}
                        >
                          🔍 Detail
                        </button>
                      </div>
                      <div className="adm-date" style={{ marginTop: '4px' }}>
                        {new Date(order.createdAt).toLocaleDateString('id-ID')}
                      </div>
                    </td>
                    {extraColumn && (
                      <td>{extraColumn.renderCell(order, fetchOrders)}</td>
                    )}
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
    </div>
  );
}
