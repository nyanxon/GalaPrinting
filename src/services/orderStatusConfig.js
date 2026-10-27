/**
 * orderStatusConfig.js — Pure order status, timeline, and transition constants.
 *
 * This module intentionally has no browser or React dependencies so it can be
 * imported by UI code and by backend parity tests.
 *
 * Backend `TRANSITIONS` in `server/src/services/orders.service.js` is the source
 * of truth for non-cancelled transitions. `ROLE_TRANSITIONS` below mirrors it;
 * `server/src/tests/orderStatusFrontendParity.test.js` guards against drift.
 */

export const ORDER_STATUSES = [
  'Waiting for Design Approval',
  'Design Accepted',
  'Waiting for Payment',
  'Payment Accepted',
  'On Progress',
  'Quality Checking',
  'In Delivery',
  'Finished',
  'Cancelled',
];

export const TERMINAL_STATUSES = ['Finished', 'Cancelled'];
export const NON_TERMINAL_STATUSES = ORDER_STATUSES.filter(
  (status) => !TERMINAL_STATUSES.includes(status)
);

/** Toast shown when a status update loses the optimistic-concurrency race (HTTP 409). */
export const STATUS_CONFLICT_MESSAGE = 'Status order sudah berubah';

/** Timeline steps for all orders. */
export const STANDARD_TIMELINE = [...ORDER_STATUSES];

/** Custom orders follow the same flow — derived, not a separate copy. */
export const CUSTOM_TIMELINE = [...STANDARD_TIMELINE];

/** Visible timeline steps (cancellation is rendered separately). */
export const STANDARD_STEPS = ORDER_STATUSES.filter((status) => status !== 'Cancelled');
export const CUSTOM_STEPS = [...STANDARD_STEPS];

/**
 * Non-cancelled transitions per role. Cancelled is handled separately by
 * CANCELLABLE_STATUSES_BY_ROLE so the UI can expose cancellation as its own
 * action instead of a normal "next status".
 */
export const ROLE_TRANSITIONS = {
  cashier: {
    'Waiting for Payment': ['Payment Accepted'],
    'Payment Accepted': [],
  },
  cs: {
    'Waiting for Design Approval': ['Design Accepted'],
    'Design Accepted': ['Waiting for Payment'],
  },
  qc: {
    'On Progress': ['Quality Checking'],
    'Quality Checking': ['In Delivery', 'On Progress'],
    'In Delivery': ['Finished'],
  },
  admin: {
    'Waiting for Payment': ['Payment Accepted'],
    'Payment Accepted': ['Waiting for Design Approval', 'On Progress'],
    'Waiting for Design Approval': ['Design Accepted'],
    'Design Accepted': ['Waiting for Payment'],
    'On Progress': ['Quality Checking'],
    'Quality Checking': ['In Delivery', 'On Progress'],
    'In Delivery': ['Finished'],
  },
  operational: {
    'Payment Accepted': ['On Progress'],
  },
  // Owner has no normal transition; only cancellation is allowed.
  owner: {},
};

/** Cancellation allowlist per role. Finished/Cancelled are never cancellable. */
export const CANCELLABLE_STATUSES_BY_ROLE = {
  cashier: ['Waiting for Payment'],
  admin: [...NON_TERMINAL_STATUSES],
  owner: [...NON_TERMINAL_STATUSES],
};

/** D3 delete rules mirrored for the localStorage fallback. */
export const CASHIER_DELETABLE_STATUSES = ['Waiting for Payment'];
export const CS_CUSTOM_DELETABLE_STATUSES = [
  'Waiting for Design Approval',
  'Design Accepted',
  'Waiting for Payment',
];

function cloneTransitionMap(map) {
  return Object.fromEntries(
    Object.entries(map).map(([status, transition]) => [
      status,
      { next: [...transition.next], roles: [...transition.roles] },
    ])
  );
}

function buildStatusTransitionMap(roleTransitions) {
  const result = {};

  for (const status of ORDER_STATUSES) {
    const next = [];
    const roles = [];

    for (const [role, transitions] of Object.entries(roleTransitions)) {
      for (const nextStatus of transitions[status] || []) {
        if (!next.includes(nextStatus)) next.push(nextStatus);
        if (!roles.includes(role)) roles.push(role);
      }
    }

    if (next.length > 0) result[status] = { next, roles };
  }

  return result;
}

/**
 * Status → { next, roles } map used by existing UI components.
 * Role order in ROLE_TRANSITIONS is intentional: it preserves the primary
 * action order (e.g. QC's "In Delivery" before "On Progress" QC-reject).
 */
export const ALLOWED_TRANSITIONS = buildStatusTransitionMap(ROLE_TRANSITIONS);

/** Custom orders use the same transitions — derived, not a separate copy. */
export const CUSTOM_TRANSITIONS = cloneTransitionMap(ALLOWED_TRANSITIONS);

/** Status display config (icon + badge color class). */
export const STATUS_CONFIG = {
  'Waiting for Payment':         { icon: '💳', badge: 'status--waiting-payment',  label: 'Menunggu Pembayaran',       color: '#92400e', bg: '#fef3c7' },
  'Payment Accepted':            { icon: '✅', badge: 'status--payment-accepted', label: 'Pembayaran Diterima',       color: '#166534', bg: '#dcfce7' },
  'Waiting for Design Approval': { icon: '🎨', badge: 'status--waiting-design',   label: 'Menunggu Konfirmasi Desain', color: '#5b21b6', bg: '#ede9fe' },
  'Design Accepted':             { icon: '👍', badge: 'status--design-accepted',  label: 'Desain Disetujui',          color: '#1e40af', bg: '#dbeafe' },
  'On Progress':                 { icon: '⚙️', badge: 'status--on-progress',      label: 'Sedang Diproses',           color: '#9a3412', bg: '#ffedd5' },
  'Quality Checking':            { icon: '🔍', badge: 'status--qc',               label: 'Quality Check',             color: '#0369a1', bg: '#e0f2fe' },
  'In Delivery':                 { icon: '🚚', badge: 'status--in-delivery',      label: 'Dalam Pengiriman',          color: '#15803d', bg: '#f0fdf4' },
  'Finished':                    { icon: '🎉', badge: 'status--finished',         label: 'Selesai',                   color: '#166534', bg: '#dcfce7' },
  'Cancelled':                   { icon: '❌', badge: 'status--cancelled',        label: 'Dibatalkan',                color: '#991b1b', bg: '#fee2e2' },
};

/**
 * Get allowed non-cancelled next statuses for a role.
 *
 * Uses the per-role map (not the aggregated ALLOWED_TRANSITIONS map) so a role
 * never receives a target that only another role may perform.
 * `orderType` is accepted for call-site compatibility; custom and standard
 * orders share the same flow.
 */
export function getAllowedNextStatuses(currentStatus, actorRole) {
  const transitions = ROLE_TRANSITIONS[actorRole];
  if (!transitions) return [];
  return [...(transitions[currentStatus] || [])];
}

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(status);
}

export function canCancelStatus(status, actorRole) {
  if (!status || isTerminalStatus(status)) return false;
  return (CANCELLABLE_STATUSES_BY_ROLE[actorRole] || []).includes(status);
}

export function canCancelOrder(order, actorRole) {
  return canCancelStatus(order?.status, actorRole);
}

export function canDeleteOrder(order, actorRole) {
  if (!order) return false;
  if (actorRole === 'admin') return true;
  if (actorRole === 'cashier') return CASHIER_DELETABLE_STATUSES.includes(order.status);
  if (actorRole === 'cs') {
    const orderType = order.orderType ?? order.order_type;
    return orderType === 'custom' && CS_CUSTOM_DELETABLE_STATUSES.includes(order.status);
  }
  return false;
}
