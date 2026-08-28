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

import { useState, useEffect, useCallback, useRef } from 'react';
import { listAllOrders, getAllowedNextStatuses, STATUS_CONFIG } from '../../../../services/orders.js';
import { formatCurrency } from '../../../../utils/format.js';
import { resolveApiUrl } from '../../../../core/httpClient.js';
import { getInvoiceByOrderId, openInvoicePdf } from '../../../../services/api/invoiceService.js';
import { showToast } from '../../../../core/toastEmitter.js';
import OrderDetailModal from '../../../modals/OrderDetailModal.jsx';
import ThermalReceiptModal from '../../../modals/ThermalReceiptModal.jsx';
import ThermalSpkModal from '../../../modals/ThermalSpkModal.jsx';
import useOrderList from '../../../../hooks/useOrderList.js';

const CASHIER_STAGES = ['Waiting for Payment', 'Payment Accepted'];

const ROLE_STAGES = { cashier: CASHIER_STAGES };

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
  const [orders, setOrders] = useState([]);
  const fetchOrdersRef = useRef(null);

  const {
    searchQuery, setSearchQuery,
    selectedOrder, setSelectedOrder,
    detailOpen, setDetailOpen,
    noteValues, setNoteValues,
    stateFilter, setStateFilter,
    actorRole,
    invoiceMap, setInvoiceMap,
    thermalInvoice, setThermalInvoice,
    thermalAutoPrint, setThermalAutoPrint,
    pendingAutoPrintRef,
    handleAdvance: hookAdvance,
    handleNoteBlur,
    handleNoteKeyDown,
    handleDetailClick,
    handleOpenCancel,
    handleCancelConfirm,
    handleCancelClose,
    getOrderStateForOrder,
    cancelDialogOpen,
    cancelReason, setCancelReason,
    cancelReasonErr,
  } = useOrderList({
    fetchOrders: () => fetchOrdersRef.current?.(),
    defaultRole: 'cashier',
    enableCancel: true,
    enableInvoice: true,
    enableStateFilter: true,
    roleStages: ROLE_STAGES,
  });

  // SPK (Surat Perintah Kerja) — dokumen produksi internal per order.
  const [spkInvoice, setSpkInvoice] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      const raw = await listAllOrders();
      let all = Array.isArray(raw) ? raw : [];

      const ORDER_MAP = { action: 0, done: 1, pending: 2, terminal: 3 };
      all = [...all].sort((a, b) => {
        const sa = ORDER_MAP[getOrderStateForOrder(a)] ?? 3;
        const sb = ORDER_MAP[getOrderStateForOrder(b)] ?? 3;
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
  }, [searchQuery, getOrderStateForOrder]);

  // Keep ref fresh for socket/event listeners
  fetchOrdersRef.current = fetchOrders;

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Fitur 2: lazy-load invoice
  const pastPaymentStatuses = ['Waiting for Design Approval', 'On Progress', 'Ready to Ship', 'Shipped', 'Completed'];
  useEffect(() => {
    orders.forEach((order) => {
      if (order.status !== 'Payment Accepted' && !pastPaymentStatuses.includes(order.status)) return;
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
        } catch (err) {
          console.error('[CashierOrders] Gagal memuat invoice:', err?.response?.data?.message || err.message);
          setInvoiceMap((prev) => ({ ...prev, [order.id]: 'error' }));
        }
      }
      fetchWithRetry();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  // Wrap advance to handle invoice reset + auto-print tracking
  const handleAdvance = useCallback(async (orderId, nextStatus) => {
    if (nextStatus === 'Payment Accepted') {
      setInvoiceMap((prev) => { const n = { ...prev }; delete n[orderId]; return n; });
      pendingAutoPrintRef.current.add(orderId);
    }
    hookAdvance(orderId, nextStatus);
  }, [hookAdvance, setInvoiceMap, pendingAutoPrintRef]);

  const displayOrders = stateFilter === 'all'
    ? orders
    : orders.filter((o) => getOrderStateForOrder(o) === stateFilter);

  const actionCount  = orders.filter((o) => getOrderStateForOrder(o) === 'action').length;
  const doneCount    = orders.filter((o) => getOrderStateForOrder(o) === 'done').length;
  const pendingCount = orders.filter((o) => getOrderStateForOrder(o) === 'pending').length;

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
                const orderState     = getOrderStateForOrder(order);

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

                        {invoiceMap[order.id] !== undefined && (
                          <div style={{ marginTop: '4px' }}>
                            {invoiceMap[order.id] === 'loading' ? (
                              <span className="adm-date" style={{ fontSize: '11px' }}>⏳ Memuat invoice…</span>
                            ) : invoiceMap[order.id] === 'error' ? (
                              <div>
                                <span className="adm-date" style={{ fontSize: '11px', color: '#b91c1c' }}>
                                  ⚠️ Gagal memuat invoice
                                </span>
                                <button
                                  className="adm-btn"
                                  type="button"
                                  style={{ fontSize: '10px', padding: '2px 6px', marginTop: '2px', display: 'block' }}
                                  onClick={() => {
                                    setInvoiceMap((prev) => {
                                      const next = { ...prev };
                                      delete next[order.id];
                                      return next;
                                    });
                                  }}
                                >
                                  🔄 Coba lagi
                                </button>
                              </div>
                            ) : invoiceMap[order.id] ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                                  onClick={() => setThermalInvoice(invoiceMap[order.id])}
                                  title="Print resi termal (58mm)"
                                >
                                  🖨️ Print Resi
                                </button>
                                <button
                                  type="button"
                                  className="adm-btn adm-btn--thermal"
                                  style={{ fontSize: '11px', padding: '4px 8px' }}
                                  onClick={() => setSpkInvoice(invoiceMap[order.id])}
                                  title="Cetak SPK produksi (58mm)"
                                >
                                  📋 Cetak SPK
                                </button>
                              </div>
                            ) : (
                              <span className="adm-date" style={{ fontSize: '11px' }}>Invoice sedang diproses…</span>
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

      {thermalInvoice && (
        <ThermalReceiptModal
          invoice={thermalInvoice}
          onClose={() => { setThermalInvoice(null); setThermalAutoPrint(false); }}
          autoPrint={thermalAutoPrint}
        />
      )}

      {spkInvoice && (
        <ThermalSpkModal invoice={spkInvoice} onClose={() => setSpkInvoice(null)} />
      )}

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
              onChange={(e) => { setCancelReason(e.target.value); }}
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
