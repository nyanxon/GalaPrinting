/**
 * orderStatusFrontendParity.test.js
 *
 * Guards the frontend status configuration against drift from the backend
 * `TRANSITIONS` matrix. Normal transitions and cancellation are compared
 * separately because the UI exposes cancellation as its own action.
 */

import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  Object.assign(process.env, {
    DB_HOST: '127.0.0.1',
    DB_NAME: 'gala_test',
    DB_USER: 'root',
    DB_PASSWORD: '',
    JWT_ACCESS_SECRET: 'test-access',
    JWT_REFRESH_SECRET: 'test-refresh',
  });
});

vi.mock('../db/connection.js', () => ({
  query: vi.fn(),
  pool: { getConnection: vi.fn() },
}));

const { TRANSITIONS } = await import('../services/orders.service.js');
const {
  ORDER_STATUSES: BACKEND_ORDER_STATUSES,
  STATUS_CHANGED_MESSAGE: BACKEND_STATUS_CHANGED_MESSAGE,
} = await import('../config/orderStatuses.js');
const {
  ORDER_STATUSES,
  ROLE_TRANSITIONS,
  CANCELLABLE_STATUSES_BY_ROLE,
  STATUS_CONFLICT_MESSAGE,
} = await import('../../../src/services/orderStatusConfig.js');

const ROLES = Object.keys(TRANSITIONS);
const NON_CANCELLED_STATUSES = ORDER_STATUSES.filter((status) => status !== 'Cancelled');

function backendNext(role, status) {
  return (TRANSITIONS[role]?.[status] || []).filter((next) => next !== 'Cancelled');
}

function frontendNext(role, status) {
  return ROLE_TRANSITIONS[role]?.[status] || [];
}

describe('Frontend/backend order status parity', () => {
  it('has an identical status vocabulary', () => {
    expect(BACKEND_ORDER_STATUSES).toEqual(ORDER_STATUSES);
  });

  it('uses the same conflict message prefix in backend and frontend', () => {
    expect(BACKEND_STATUS_CHANGED_MESSAGE.startsWith(STATUS_CONFLICT_MESSAGE)).toBe(true);
  });

  it('covers exactly the backend roles', () => {
    expect(Object.keys(ROLE_TRANSITIONS).sort()).toEqual([...ROLES].sort());
  });

  it('has identical non-cancelled transitions per role and status', () => {
    for (const role of ROLES) {
      for (const status of NON_CANCELLED_STATUSES) {
        expect(
          frontendNext(role, status),
          `${role} / ${status}`,
        ).toEqual(backendNext(role, status));
      }

      const extraStatuses = Object.keys(ROLE_TRANSITIONS[role] || {})
        .filter((status) => !(status in (TRANSITIONS[role] || {})));
      expect(extraStatuses, `${role} defines unknown statuses`).toEqual([]);
    }
  });

  it('matches the backend Cancelled allowlist per role', () => {
    for (const role of ROLES) {
      const backendCancellable = NON_CANCELLED_STATUSES.filter((status) =>
        (TRANSITIONS[role]?.[status] || []).includes('Cancelled')
      );
      const frontendCancellable = CANCELLABLE_STATUSES_BY_ROLE[role] || [];

      expect(
        [...frontendCancellable].sort(),
        `${role} cancellation allowlist`,
      ).toEqual([...backendCancellable].sort());
    }
  });
});
