/**
 * useOrderList.js — Shared state + logic for admin/subadmin/cashier order sections.
 *
 * Extracts:
 * - Auth context + actorRole
 * - Socket + window real-time listeners
 * - Search state
 * - Note state + handlers
 * - Detail modal state + handler
 * - Advance handler (with optional invoice reset)
 * - Cancel dialog state + handlers (optional)
 * - Invoice state + lazy loading + auto-print (optional)
 * - State filter + displayOrders + counts (optional)
 *
 * Sections keep their own: fetchOrders, rendering, filter UI, feature-specific columns.
 */

import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { AuthContext } from '../components/context/AuthContext.jsx';
import { useSocket } from '../components/context/SocketContext.jsx';
import {
  getOrderById,
  updateOrderStatus,
  updateAdminNote,
  getAllowedNextStatuses,
} from '../services/orders.js';
import { openInvoicePdf } from '../services/api/invoiceService.js';
import { showToast } from '../core/toastEmitter.js';
import { track } from '../utils/activityTracker.js';

const STATUS_ORDER = [
  'Waiting for Payment', 'Payment Accepted', 'Waiting for Design Approval',
  'Design Accepted', 'On Progress', 'Quality Checking', 'In Delivery', 'Finished',
];

/**
 * Determine "state" of an order from a role's perspective:
 *   'action'    — this role can/should advance this order now
 *   'done'      — this role already processed this order
 *   'pending'   — order hasn't reached this role's stage yet
 *   'terminal'  — order is Finished or Cancelled
 *
 * @param {object} order
 * @param {string} role
 * @param {object} roleStages — e.g. { cashier: [...], cs: [...], ... }
 * @returns {'action'|'done'|'pending'|'terminal'}
 */
export function getOrderState(order, role, roleStages) {
  const status = order.status;
  if (status === 'Cancelled') return 'terminal';

  const allowed = getAllowedNextStatuses(status, role, order.orderType || 'standard');
  if (allowed.length > 0) return 'action';

  const stages = roleStages[role] || [];
  if (stages.includes(status)) return 'done';

  const statusIdx = STATUS_ORDER.indexOf(status);
  const lastStageIdx = Math.max(
    ...stages.map((s) => STATUS_ORDER.indexOf(s)).filter((i) => i >= 0),
  );
  if (statusIdx > lastStageIdx) return 'done';

  return 'pending';
}

const DEFAULT_ROLE_STAGES = {
  cashier:     ['Waiting for Payment', 'Payment Accepted'],
  cs:          ['Payment Accepted', 'Waiting for Design Approval', 'Design Accepted'],
  operational: ['Design Accepted', 'On Progress'],
  qc:          ['On Progress', 'Quality Checking', 'In Delivery', 'Finished'],
};

/**
 * @param {object} config
 * @param {Function} config.fetchOrders — section's fetch function (should set state internally)
 * @param {string}   [config.defaultRole='admin'] — fallback role when user.role is missing
 * @param {boolean}  [config.enableCancel=false] — enable cancel dialog state + handlers
 * @param {boolean}  [config.enableInvoice=false] — enable invoice loading + auto-print
 * @param {boolean}  [config.enableStateFilter=false] — enable all/action/done/pending filter
 * @param {object}   [config.roleStages] — role→stages map for getOrderState
 */
export default function useOrderList({
  fetchOrders,
  defaultRole = 'admin',
  _enableCancel = false,
  enableInvoice = false,
  enableStateFilter = false,
  roleStages = DEFAULT_ROLE_STAGES,
}) {
  const { user } = useContext(AuthContext);
  const actorRole = user?.role || defaultRole;
  const socket = useSocket();

  // Core state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [noteValues, setNoteValues] = useState({});

  // State filter (SubAdmin / Cashier)
  const [stateFilter, setStateFilter] = useState(enableStateFilter ? 'all' : null);

  // Cancel dialog (Admin / Cashier)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTargetOrderId, setCancelTargetOrderId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonErr, setCancelReasonErr] = useState('');

  // Invoice (Admin / Cashier)
  const [invoiceMap, setInvoiceMap] = useState({});
  const [thermalInvoice, setThermalInvoice] = useState(null);
  const [thermalAutoPrint, setThermalAutoPrint] = useState(false);
  const pendingAutoPrintRef = useRef(new Set());

  // Ref to hold latest fetchOrders for socket/event listeners
  const fetchRef = useRef(fetchOrders);
  useEffect(() => {
    fetchRef.current = fetchOrders;
  });

  // ── Real-time listeners ──────────────────────────────────────────────────

  useEffect(() => {
    function handler() { fetchRef.current?.(); }
    window.addEventListener('gala:orders-updated', handler);
    return () => window.removeEventListener('gala:orders-updated', handler);
  }, []);

  useEffect(() => {
    if (!socket) return;
    function onOrderNew() { fetchRef.current?.(); }
    function onStatusChanged() { fetchRef.current?.(); }
    socket.on('order:new', onOrderNew);
    socket.on('order:status_changed', onStatusChanged);
    return () => {
      socket.off('order:new', onOrderNew);
      socket.off('order:status_changed', onStatusChanged);
    };
  }, [socket]);

  // ── Note handlers ────────────────────────────────────────────────────────

  const handleNoteBlur = useCallback(async (orderId) => {
    const note = noteValues[orderId] ?? '';
    const res = await updateAdminNote(orderId, note);
    if (res.ok) showToast('Catatan disimpan.', 'success', 1500);
  }, [noteValues]);

  const handleNoteKeyDown = useCallback((e, orderId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNoteBlur(orderId);
    }
  }, [handleNoteBlur]);

  // ── Detail modal ─────────────────────────────────────────────────────────

  const handleDetailClick = useCallback(async (orderId) => {
    try {
      const order = await getOrderById(orderId);
      if (order) { setSelectedOrder(order); setDetailOpen(true); }
    } catch (err) {
      console.error('Failed to load order detail:', err);
    }
  }, []);

  // ── Advance handler ──────────────────────────────────────────────────────

  const handleAdvance = useCallback(async (orderId, nextStatus) => {
    if (enableInvoice && nextStatus === 'Payment Accepted') {
      setInvoiceMap((prev) => { const n = { ...prev }; delete n[orderId]; return n; });
      pendingAutoPrintRef.current.add(orderId);
    }
    // Best-effort: read the current status so the log captures from → to.
    let fromStatus = null;
    try {
      const order = await getOrderById(orderId);
      fromStatus = order?.status ?? null;
    } catch { /* keep null */ }
    const res = await updateOrderStatus(orderId, nextStatus, actorRole);
    if (res.ok) {
      track('Ubah Status Order', {
        targetType: 'order', targetId: orderId,
        metadata: { from: fromStatus, to: nextStatus, role: actorRole },
      });
      showToast(`Status → "${nextStatus}".`, 'success');
    } else {
      showToast(res.message || 'Gagal mengubah status.', 'error');
    }
    fetchRef.current?.();
  }, [actorRole, enableInvoice]);

  // ── Cancel dialog ────────────────────────────────────────────────────────

  const handleOpenCancel = useCallback((orderId) => {
    setCancelTargetOrderId(orderId);
    setCancelReason('');
    setCancelReasonErr('');
    setCancelDialogOpen(true);
  }, []);

  const handleCancelConfirm = useCallback(async () => {
    if (!cancelReason.trim()) { setCancelReasonErr('Alasan pembatalan wajib diisi.'); return; }
    let fromStatus = null;
    try {
      const order = await getOrderById(cancelTargetOrderId);
      fromStatus = order?.status ?? null;
    } catch { /* keep null */ }
    const res = await updateOrderStatus(cancelTargetOrderId, 'Cancelled', actorRole, cancelReason.trim());
    if (res.ok) {
      track('Batalkan Order', {
        targetType: 'order', targetId: cancelTargetOrderId,
        metadata: { from: fromStatus, to: 'Cancelled', role: actorRole, reason: cancelReason.trim() },
      });
      showToast('Pesanan dibatalkan.', 'success');
      setCancelDialogOpen(false);
      setCancelTargetOrderId(null);
      setCancelReason('');
      setCancelReasonErr('');
      fetchRef.current?.();
    } else {
      setCancelReasonErr(res.message || 'Gagal membatalkan pesanan.');
    }
  }, [cancelReason, cancelTargetOrderId, actorRole]);

  const handleCancelClose = useCallback(() => {
    setCancelDialogOpen(false);
    setCancelTargetOrderId(null);
    setCancelReason('');
    setCancelReasonErr('');
  }, []);

  // ── Invoice auto-print ───────────────────────────────────────────────────
  // Note: invoice lazy-loading stays in each section because it depends on the
  // section's orders state. Sections should iterate orders and call
  // setInvoiceMap to trigger loading; the auto-print effect below reacts.

  useEffect(() => {
    if (!enableInvoice) return;
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
  }, [invoiceMap, enableInvoice]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getOrderStateForOrder = useCallback(
    (order) => getOrderState(order, actorRole, roleStages),
    [actorRole, roleStages],
  );

  return {
    // Core state
    searchQuery, setSearchQuery,
    selectedOrder, setSelectedOrder,
    detailOpen, setDetailOpen,
    noteValues, setNoteValues,

    // Filter state
    stateFilter, setStateFilter,

    // Cancel dialog state
    cancelDialogOpen, setCancelDialogOpen,
    cancelTargetOrderId, setCancelTargetOrderId,
    cancelReason, setCancelReason,
    cancelReasonErr, setCancelReasonErr,

    // Invoice state
    invoiceMap, setInvoiceMap,
    thermalInvoice, setThermalInvoice,
    thermalAutoPrint, setThermalAutoPrint,
    pendingAutoPrintRef,

    // Metadata
    actorRole,

    // Handlers
    handleAdvance,
    handleNoteBlur,
    handleNoteKeyDown,
    handleDetailClick,
    handleOpenCancel,
    handleCancelConfirm,
    handleCancelClose,

    // Utilities
    getOrderStateForOrder,
  };
}
