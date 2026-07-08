/**
 * SubAdminOrdersSection.jsx — Role-filtered orders table for sub-admin roles.
 *
 * Fitur 1 — Order tidak pernah hilang dari list.
 * Semua order ditampilkan, diurutkan: "butuh aksi" di atas (actionRequired),
 * lalu "sudah diproses role ini" di tengah, lalu "belum sampai di role ini" di bawah.
 * Setiap role hanya bisa advance status miliknya sendiri — tombol advance
 * hanya muncul kalau getAllowedNextStatuses() mengembalikan pilihan valid.
 *
 * Props:
 *   extraColumn — optional { header: string, renderCell: (order, onRefresh) => ReactNode }
 *                 untuk kolom tambahan role-specific (e.g. QC tracking)
 *
 * Requirements: 11.1, 11.2, 13.4
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

/**
 * Tentukan "state" order dari perspektif role tertentu:
 *   'action'    — role ini bisa/harus advance order ini sekarang
 *   'done'      — role ini sudah selesai memproses order ini
 *   'pending'   — order belum sampai di tahap role ini (masih di role sebelumnya)
 *   'terminal'  — order sudah Finished atau Cancelled
 *
 * ROLE_STAGES mendefinisikan pada status apa saja suatu role "bertanggung jawab".
 */
const ROLE_STAGES = {
  cashier:     ['Waiting for Payment', 'Payment Accepted'],
  cs:          ['Payment Accepted', 'Waiting for Design Approval', 'Design Accepted'],
  operational: ['Design Accepted', 'On Progress'],
  qc:          ['On Progress', 'Quality Checking', 'In Delivery', 'Finished'],
};

function getOrderState(order, role) {
  const status = order.status;
  if (status === 'Cancelled') return 'terminal';
  if (status === 'Finished' && role !== 'qc') return 'terminal';

  const allowed = getAllowedNextStatuses(status, role, order.orderType || 'standard');
  if (allowed.length > 0) return 'action';

  const stages = ROLE_STAGES[role] || [];
  if (stages.includes(status)) return 'done';

  // Cek apakah status sudah melewati semua stage role ini
  const STATUS_ORDER = [
    'Waiting for Payment', 'Payment Accepted', 'Waiting for Design Approval',
    'Design Accepted', 'On Progress', 'Quality Checking', 'In Delivery', 'Finished',
  ];
  const statusIdx = STATUS_ORDER.indexOf(status);
  const lastStageIdx = Math.max(...stages.map((s) => STATUS_ORDER.indexOf(s)).filter((i) => i >= 0));
  if (statusIdx > lastStageIdx) return 'done';

  return 'pending';
}

const STATE_LABEL = {
  action:  { text: 'Butuh Aksi', cls: 'role-state--action' },
  done:    { text: 'Sudah Diproses', cls: 'role-state--done' },
  pending: { text: 'Belum Sampai', cls: 'role-state--pending' },
  terminal:{ text: '', cls: 'role-state--terminal' },
};

export default function SubAdminOrdersSection({ extraColumn = null }) {
  const { user } = useContext(AuthContext);
  const actorRole = user?.role || 'admin';

  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [noteValues, setNoteValues] = useState({});
  // Filter tampilan: 'all' | 'action' | 'done' | 'pending'
  const [stateFilter, setStateFilter] = useState('all');

  const fetchOrders = useCallback(async () => {
    try {
      // Fitur 1: ambil SEMUA order — tidak ada filter status
      const raw = await listAllOrders();
      let all = Array.isArray(raw) ? raw : [];

      // Sort: action → done → pending → terminal
      const ORDER_MAP = { action: 0, done: 1, pending: 2, terminal: 3 };
      all = [...all].sort((a, b) => {
        const sa = ORDER_MAP[getOrderState(a, actorRole)] ?? 3;
        const sb = ORDER_MAP[getOrderState(b, actorRole)] ?? 3;
        if (sa !== sb) return sa - sb;
        // Dalam group yang sama, terbaru di atas
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

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Listen for socket/custom events
  useEffect(() => {
    function handler() { fetchOrders(); }
    window.addEventListener('gala:orders-updated', handler);
    return () => window.removeEventListener('gala:orders-updated', handler);
  }, [fetchOrders]);

  // Fitur 4: auto-refresh list saat ada socket event order baru / status berubah
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
      const order = await getOrderById(orderId);
      if (order) {
        setSelectedOrder(order);
        setDetailOpen(true);
      }
    } catch (err) {
      console.error('Failed to load order detail:', err);
    }
  }

  // Filter orders berdasarkan stateFilter
  const displayOrders = stateFilter === 'all'
    ? orders
    : orders.filter((o) => getOrderState(o, actorRole) === stateFilter);

  const actionCount  = orders.filter((o) => getOrderState(o, actorRole) === 'action').length;
  const doneCount    = orders.filter((o) => getOrderState(o, actorRole) === 'done').length;
  const pendingCount = orders.filter((o) => getOrderState(o, actorRole) === 'pending').length;

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
              {extraColumn && <th>{extraColumn.header}</th>}
            </tr>
          </thead>
          <tbody>
            {displayOrders.length === 0 ? (
              <tr>
                <td colSpan={extraColumn ? 8 : 7} className="adm-empty">
                  {stateFilter === 'action'
                    ? 'Tidak ada pesanan yang butuh aksi sekarang.'
                    : 'Tidak ada pesanan.'}
                </td>
              </tr>
            ) : (
              displayOrders.map((order) => {
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
                const orderState = getOrderState(order, actorRole);
                const stateInfo = STATE_LABEL[orderState] || STATE_LABEL.terminal;

                return (
                  <tr
                    key={order.id}
                    style={{
                      opacity: orderState === 'pending' || orderState === 'terminal' ? 0.65 : 1,
                    }}
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
                    {/* Kolom "Status Saya" — Fitur 1: tampilkan state order dari perspektif role ini */}
                    <td>
                      {stateInfo.text ? (
                        <span
                          className={`role-state-badge ${stateInfo.cls}`}
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background:
                              orderState === 'action'  ? '#dcfce7' :
                              orderState === 'done'    ? '#e0e7ff' :
                              orderState === 'pending' ? '#fef9c3' : '#f3f4f6',
                            color:
                              orderState === 'action'  ? '#166534' :
                              orderState === 'done'    ? '#3730a3' :
                              orderState === 'pending' ? '#92400e' : '#6b7280',
                          }}
                        >
                          {stateInfo.text}
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
