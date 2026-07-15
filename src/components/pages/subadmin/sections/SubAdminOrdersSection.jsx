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

import { useState, useEffect, useCallback, useRef } from 'react';
import { listAllOrders, getAllowedNextStatuses, STATUS_CONFIG } from '../../../../services/orders.js';
import { formatCurrency } from '../../../../utils/format.js';
import OrderDetailModal from '../../../modals/OrderDetailModal.jsx';
import useOrderList, { getOrderState } from '../../../../hooks/useOrderList.js';

const ROLE_STAGES = {
  cashier:     ['Waiting for Payment', 'Payment Accepted'],
  cs:          ['Payment Accepted', 'Waiting for Design Approval', 'Design Accepted'],
  operational: ['Design Accepted', 'On Progress'],
  qc:          ['On Progress', 'Quality Checking', 'In Delivery', 'Finished'],
};

const STATE_LABEL = {
  action:  { text: 'Butuh Aksi', cls: 'role-state--action' },
  done:    { text: 'Sudah Diproses', cls: 'role-state--done' },
  pending: { text: 'Belum Sampai', cls: 'role-state--pending' },
  terminal:{ text: '', cls: 'role-state--terminal' },
};

export default function SubAdminOrdersSection({ extraColumn = null }) {
  const [orders, setOrders] = useState([]);
  const fetchOrdersRef = useRef(null);

  const {
    searchQuery, setSearchQuery,
    selectedOrder, setSelectedOrder,
    detailOpen, setDetailOpen,
    noteValues, setNoteValues,
    stateFilter, setStateFilter,
    actorRole,
    handleAdvance,
    handleNoteBlur,
    handleNoteKeyDown,
    handleDetailClick,
    getOrderStateForOrder,
  } = useOrderList({
    fetchOrders: () => fetchOrdersRef.current?.(),
    defaultRole: 'admin',
    enableStateFilter: true,
    roleStages: ROLE_STAGES,
  });

  // Wrapper: add Finished→terminal for non-qc roles (SubAdmin-specific behavior)
  const getOrderStateForRole = useCallback((order) => {
    const state = getOrderStateForOrder(order);
    if (order.status === 'Finished' && actorRole !== 'qc') return 'terminal';
    return state;
  }, [getOrderStateForOrder, actorRole]);

  const fetchOrders = useCallback(async () => {
    try {
      const raw = await listAllOrders();
      let all = Array.isArray(raw) ? raw : [];

      const ORDER_MAP = { action: 0, done: 1, pending: 2, terminal: 3 };
      all = [...all].sort((a, b) => {
        const sa = ORDER_MAP[getOrderStateForRole(a)] ?? 3;
        const sb = ORDER_MAP[getOrderStateForRole(b)] ?? 3;
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
  }, [searchQuery, getOrderStateForRole]);

  // Keep ref fresh for socket/event listeners
  fetchOrdersRef.current = fetchOrders;

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const displayOrders = stateFilter === 'all'
    ? orders
    : orders.filter((o) => getOrderStateForRole(o) === stateFilter);

  const actionCount  = orders.filter((o) => getOrderStateForRole(o) === 'action').length;
  const doneCount    = orders.filter((o) => getOrderStateForRole(o) === 'done').length;
  const pendingCount = orders.filter((o) => getOrderStateForRole(o) === 'pending').length;

  return (
    <div className="adm-card">
      <div className="adm-toolbar">
        <h2 className="adm-section-title">
          Semua Pesanan ({orders.length})
        </h2>
        <div className="adm-toolbar-right">
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
                const isQcDeliveryStatus =
                  actorRole === 'qc' &&
                  (order.status === 'Quality Checking' || order.status === 'In Delivery');
                const showAdvanceBtn = allowed.length > 0 && !isQcDeliveryStatus;
                const orderState = getOrderStateForRole(order);
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
