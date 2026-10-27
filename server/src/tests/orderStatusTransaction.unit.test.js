import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STATUS_CHANGED_MESSAGE } from '../config/orderStatuses.js';

const db = vi.hoisted(() => ({
  query: vi.fn(),
  getConnection: vi.fn(),
  storageDelete: vi.fn(),
}));

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
  query: db.query,
  pool: { getConnection: db.getConnection },
}));

vi.mock('../utils/storage.js', () => ({
  StorageService: {
    delete: db.storageDelete,
    save: vi.fn(),
  },
}));

const svc = await import('../services/orders.service.js');

function makeHarness({
  order,
  approvals = [],
  invoices = [],
  items = [],
  affectedRows = 1,
}) {
  const state = {
    order: { ...order },
    approvals: approvals.map((a) => ({ ...a })),
    invoices: invoices.map((i) => ({ ...i })),
    items: items.map((i) => ({ ...i })),
    history: [],
  };
  const calls = [];

  const conn = {
    beginTransaction: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
    release: vi.fn(),
    execute: vi.fn(async (sql, params = []) => {
      calls.push({ sql, params });

      if (sql.includes('SELECT * FROM orders') && sql.includes('FOR UPDATE')) {
        return [[state.order], []];
      }

      if (sql.includes('FROM order_approvals oa') && sql.includes('oa.stage = ?')) {
        const [orderId, stage] = params;
        const row = state.approvals.find(
          (a) => a.order_id === orderId && a.stage === stage
        );
        return [row ? [row] : [], []];
      }

      if (sql.includes('SELECT * FROM invoices WHERE order_id')) {
        return [state.invoices, []];
      }

      if (sql.includes('SELECT payment_status FROM invoices')) {
        return [state.invoices.map((i) => ({ payment_status: i.payment_status })), []];
      }

      if (sql.includes('SELECT design_file_path FROM order_items')) {
        return [
          state.items
            .filter((i) => i.design_file_path)
            .map((i) => ({ design_file_path: i.design_file_path })),
          [],
        ];
      }

      if (sql.includes('UPDATE orders SET')) {
        const id = params[params.length - 2];
        const expectedStatus = params[params.length - 1];
        if (id !== state.order.id || expectedStatus !== state.order.status) {
          return [{ affectedRows: 0 }, []];
        }
        const status = params[0];
        state.order = { ...state.order, status };
        if (sql.includes('tracking_number')) {
          state.order.tracking_number = params[1];
          state.order.courier_name = params[2];
        }
        return [{ affectedRows }, []];
      }

      if (sql.includes("DELETE FROM order_approvals") && sql.includes("Quality Checking")) {
        state.approvals = state.approvals.filter((a) => a.stage !== 'Quality Checking');
        return [{ affectedRows: 1 }, []];
      }

      if (sql.includes('INSERT INTO order_history')) {
        const [, orderId, fromStatus, toStatus, actorId, reason] = params;
        state.history.push({
          order_id: orderId,
          from_status: fromStatus,
          to_status: toStatus,
          actor_id: actorId,
          cancellation_reason: reason,
        });
        return [{ affectedRows: 1 }, []];
      }

      if (sql.includes('INSERT IGNORE INTO order_approvals')) {
        const [, orderId, stage] = params;
        if (!state.approvals.some((a) => a.stage === stage)) {
          state.approvals.push({ order_id: orderId, stage, approved_name: params[5] });
        }
        return [{ affectedRows: 1 }, []];
      }

      return [{ affectedRows: 1 }, []];
    }),
  };

  db.getConnection.mockResolvedValue(conn);
  db.query.mockImplementation(async (sql) => {
    if (sql.includes('FROM orders o')) return [[state.order], []];
    if (sql.includes('FROM order_items')) return [state.items, []];
    if (sql.includes('FROM order_history')) return [state.history, []];
    if (sql.includes('FROM order_approvals')) return [state.approvals, []];
    return [[], []];
  });

  return { conn, calls, state };
}

function baseOrder(overrides = {}) {
  return {
    id: 'order-1',
    order_number: 'GALA-1',
    status: 'Quality Checking',
    source: 'online',
    order_type: 'standard',
    customer_id: null,
    customer_email: null,
    payment_proof_path: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.storageDelete.mockResolvedValue(undefined);
});

describe('single-transition transaction', () => {
  it('D1: QC rework bypasses the On Progress lock and reopens Quality Checking', async () => {
    const { calls, state } = makeHarness({
      order: baseOrder(),
      approvals: [
        { order_id: 'order-1', stage: 'On Progress', approved_name: 'Admin' },
        { order_id: 'order-1', stage: 'Quality Checking', approved_name: 'QC' },
      ],
    });

    const updated = await svc.updateOrderStatus(
      'order-1',
      'On Progress',
      'qc-1',
      'qc',
      null,
      'QC Satu'
    );

    expect(updated.status).toBe('On Progress');
    expect(state.approvals.some((a) => a.stage === 'Quality Checking')).toBe(false);
    expect(calls.some((c) => c.sql.includes('DELETE FROM order_approvals'))).toBe(true);
    expect(calls.some((c) => c.sql.includes('INSERT IGNORE INTO order_approvals'))).toBe(true);
    expect(calls.some((c) => c.sql.includes('INSERT INTO order_history'))).toBe(true);
  });

  it('other locked transitions still return 403 without updating', async () => {
    const { calls } = makeHarness({
      order: baseOrder({ status: 'In Delivery' }),
      approvals: [{ order_id: 'order-1', stage: 'Finished', approved_name: 'Admin' }],
    });

    await expect(
      svc.updateOrderStatus('order-1', 'Finished', 'qc-1', 'qc', null, 'QC')
    ).rejects.toMatchObject({ status: 403 });

    expect(calls.some((c) => c.sql.includes('UPDATE orders SET'))).toBe(false);
  });

  it('rejects D2 Design Accepted -> On Progress for operational and admin', async () => {
    for (const role of ['operational', 'admin']) {
      makeHarness({ order: baseOrder({ status: 'Design Accepted' }) });
      await expect(
        svc.updateOrderStatus('order-1', 'On Progress', 'staff-1', role, null, 'Staff')
      ).rejects.toMatchObject({ status: 403 });
    }
  });

  it('returns 409 when the status predicate no longer matches', async () => {
    makeHarness({ order: baseOrder({ status: 'On Progress' }), affectedRows: 0 });

    await expect(
      svc.updateOrderStatus('order-1', 'Quality Checking', 'qc-1', 'qc', null, 'QC')
    ).rejects.toMatchObject({
      status: 409,
      message: 'Status order sudah berubah. Muat ulang data.',
    });
  });

  it.each(['paid', 'dp'])(
    'D6: cancelling a %s order preserves the payment proof and design files',
    async (paymentStatus) => {
      const { calls } = makeHarness({
        order: baseOrder({
          status: 'On Progress',
          payment_proof_path: '/uploads/payments/proof.png',
        }),
        invoices: [{ id: 'inv-1', payment_status: paymentStatus }],
        items: [{ id: 'item-1', design_file_path: '/uploads/designs/design.pdf' }],
      });

      await svc.updateOrderStatus(
        'order-1',
        'Cancelled',
        'admin-1',
        'admin',
        'Customer request',
        'Admin'
      );

      expect(calls.some((c) => c.sql.includes('SELECT payment_status FROM invoices'))).toBe(true);
      expect(db.storageDelete).not.toHaveBeenCalled();
    }
  );

  it('D6: cancelling an unpaid order deletes both the payment proof and design files', async () => {
    makeHarness({
      order: baseOrder({
        status: 'On Progress',
        payment_proof_path: '/uploads/payments/proof.png',
      }),
      invoices: [{ id: 'inv-1', payment_status: 'unpaid' }],
      items: [{ id: 'item-1', design_file_path: '/uploads/designs/design.pdf' }],
    });

    await svc.updateOrderStatus(
      'order-1',
      'Cancelled',
      'admin-1',
      'admin',
      'Customer request',
      'Admin'
    );

    expect(db.storageDelete).toHaveBeenCalledTimes(2);
    expect(db.storageDelete).toHaveBeenCalledWith('/uploads/payments/proof.png');
    expect(db.storageDelete).toHaveBeenCalledWith('/uploads/designs/design.pdf');
  });

  it('D6: cancelling an order without an invoice deletes both file types', async () => {
    makeHarness({
      order: baseOrder({
        status: 'On Progress',
        payment_proof_path: '/uploads/payments/proof.png',
      }),
      invoices: [],
      items: [{ id: 'item-1', design_file_path: '/uploads/designs/design.pdf' }],
    });

    await svc.updateOrderStatus(
      'order-1',
      'Cancelled',
      'admin-1',
      'admin',
      'Customer request',
      'Admin'
    );

    expect(db.storageDelete).toHaveBeenCalledTimes(2);
    expect(db.storageDelete).toHaveBeenCalledWith('/uploads/payments/proof.png');
    expect(db.storageDelete).toHaveBeenCalledWith('/uploads/designs/design.pdf');
  });

  it('Payment Accepted uses one connection and updates the invoice in the same transaction', async () => {
    const { calls } = makeHarness({
      order: baseOrder({ status: 'Waiting for Payment' }),
      invoices: [
        {
          id: 'inv-1',
          order_id: 'order-1',
          payment_status: 'unpaid',
          payment_method: null,
          dp_amount: null,
          dp_paid_at: null,
          total: '100000',
        },
      ],
    });

    const updated = await svc.updateOrderStatus(
      'order-1',
      'Payment Accepted',
      'cashier-1',
      'cashier',
      null,
      'Cashier',
      { paymentStatus: 'paid', paymentMethod: 'cash' }
    );

    expect(updated.status).toBe('Payment Accepted');
    expect(db.getConnection).toHaveBeenCalledTimes(1);
    expect(calls.some((c) => c.sql.includes('UPDATE invoices'))).toBe(true);
    expect(calls.some((c) => c.sql.includes('INSERT INTO order_history'))).toBe(true);
    expect(calls.some((c) => c.sql.includes('INSERT IGNORE INTO order_approvals'))).toBe(true);
  });

  it('populates options.out.previousStatus for updateOrderStatus', async () => {
    makeHarness({ order: baseOrder({ status: 'On Progress' }) });
    const out = {};

    const updated = await svc.updateOrderStatus(
      'order-1',
      'Quality Checking',
      'qc-1',
      'qc',
      null,
      'QC',
      null,
      { out }
    );

    expect(out.previousStatus).toBe('On Progress');
    expect(updated.status).toBe('Quality Checking');
  });

  it('populates options.out.previousStatus for setTrackingNumber auto-advance', async () => {
    makeHarness({ order: baseOrder({ status: 'Quality Checking' }) });
    const out = {};

    const updated = await svc.setTrackingNumber(
      'order-1',
      'RESI-OUT',
      'JNE',
      'qc-1',
      'qc',
      'QC',
      { out }
    );

    expect(out.previousStatus).toBe('Quality Checking');
    expect(updated.status).toBe('In Delivery');
  });

  it('reports the unchanged status when setTrackingNumber does not advance', async () => {
    makeHarness({ order: baseOrder({ status: 'On Progress' }) });
    const out = {};

    const updated = await svc.setTrackingNumber(
      'order-1',
      'RESI-OUT',
      'JNE',
      'admin-1',
      'admin',
      'Admin',
      { out }
    );

    expect(out.previousStatus).toBe('On Progress');
    expect(updated.status).toBe('On Progress');
  });

  it('setTrackingNumber auto-advances with history and In Delivery approval', async () => {
    const { calls, state } = makeHarness({
      order: baseOrder({ status: 'Quality Checking' }),
    });

    const updated = await svc.setTrackingNumber(
      'order-1',
      'RESI-123',
      'JNE',
      'qc-1',
      'qc',
      'QC Satu'
    );

    expect(updated.status).toBe('In Delivery');
    expect(state.order.tracking_number).toBe('RESI-123');
    expect(calls.some((c) => c.sql.includes('INSERT INTO order_history'))).toBe(true);
    expect(
      calls.some(
        (c) =>
          c.sql.includes('INSERT IGNORE INTO order_approvals') &&
          c.params.includes('In Delivery')
      )
    ).toBe(true);
    expect(
      calls.some(
        (c) => c.sql.includes('UPDATE orders SET') && c.params.includes('RESI-123')
      )
    ).toBe(true);
  });
});

describe('optimistic concurrency (expectedStatus)', () => {
  it('proceeds normally when expectedStatus matches the locked status', async () => {
    const { state } = makeHarness({ order: baseOrder({ status: 'On Progress' }) });

    const updated = await svc.updateOrderStatus(
      'order-1',
      'Quality Checking',
      'qc-1',
      'qc',
      null,
      'QC',
      null,
      { expectedStatus: 'On Progress' }
    );

    expect(updated.status).toBe('Quality Checking');
    expect(state.order.status).toBe('Quality Checking');
    expect(state.history.some((h) => h.to_status === 'Quality Checking')).toBe(true);
  });

  it('returns 409 on mismatch BEFORE role validation and never updates the row', async () => {
    const { calls } = makeHarness({ order: baseOrder({ status: 'Quality Checking' }) });

    // Cashier cannot perform Quality Checking -> In Delivery, so a role-first
    // implementation would return 403. The stale expectedStatus must win with 409.
    await expect(
      svc.updateOrderStatus(
        'order-1',
        'In Delivery',
        'cashier-1',
        'cashier',
        null,
        'Cashier',
        null,
        { expectedStatus: 'On Progress' }
      )
    ).rejects.toMatchObject({
      status: 409,
      message: STATUS_CHANGED_MESSAGE,
    });

    expect(calls.some((c) => c.sql.includes('UPDATE orders SET'))).toBe(false);
    expect(calls.some((c) => c.sql.includes('INSERT INTO order_history'))).toBe(false);
  });

  it('keeps the legacy behaviour when expectedStatus is absent (403 for invalid role)', async () => {
    makeHarness({ order: baseOrder({ status: 'Quality Checking' }) });

    await expect(
      svc.updateOrderStatus('order-1', 'In Delivery', 'cashier-1', 'cashier', null, 'Cashier')
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects an invalid expectedStatus with 400 before opening a connection', async () => {
    await expect(
      svc.updateOrderStatus(
        'order-1',
        'Quality Checking',
        'qc-1',
        'qc',
        null,
        'QC',
        null,
        { expectedStatus: 'Not A Real Status' }
      )
    ).rejects.toMatchObject({ status: 400 });

    expect(db.getConnection).not.toHaveBeenCalled();
  });

  it('deleteOrder proceeds when expectedStatus matches', async () => {
    const { calls } = makeHarness({ order: baseOrder({ status: 'Waiting for Payment' }) });

    const deleted = await svc.deleteOrder(
      'order-1',
      { role: 'cashier' },
      { expectedStatus: 'Waiting for Payment' }
    );

    expect(deleted.id).toBe('order-1');
    expect(calls.some((c) => c.sql.includes('DELETE FROM orders'))).toBe(true);
  });

  it('deleteOrder returns 409 on mismatch BEFORE permission checks', async () => {
    const { calls } = makeHarness({ order: baseOrder({ status: 'On Progress' }) });

    // Cashier could not delete an On Progress order anyway (403); a stale
    // expectedStatus must surface as 409 first.
    await expect(
      svc.deleteOrder(
        'order-1',
        { role: 'cashier' },
        { expectedStatus: 'Waiting for Payment' }
      )
    ).rejects.toMatchObject({
      status: 409,
      message: STATUS_CHANGED_MESSAGE,
    });

    expect(calls.some((c) => c.sql.includes('DELETE FROM orders'))).toBe(false);
  });

  it('deleteOrder rejects an invalid expectedStatus with 400 before opening a connection', async () => {
    await expect(
      svc.deleteOrder('order-1', { role: 'admin' }, { expectedStatus: 'nope' })
    ).rejects.toMatchObject({ status: 400 });

    expect(db.getConnection).not.toHaveBeenCalled();
  });
});
