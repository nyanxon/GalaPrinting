/**
 * Real-MySQL integration tests for Phase 2A status transitions.
 *
 * Guarded: runs only when RUN_DB_TESTS=1 AND all DB/JWT env vars are present.
 * Safety: when RUN_DB_TESTS=1, DB_HOST MUST be 127.0.0.1 or localhost AND
 * DB_NAME must match /(^|_)test$/i. The suite refuses to load otherwise so it
 * can never touch a shared or production database by accident.
 * Without a dedicated test database these tests are SKIPPED.
 *
 * Run on a DB machine:
 *   $env:RUN_DB_TESTS='1'; npm test --prefix server -- src/tests/orderStatusTransaction.guarded.test.js
 */

import 'dotenv/config';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  assertSafeDbTestEnv,
  isLocalDbHost,
} from './helpers/dbTestGuard.js';

// Throws before any DB connection is opened when the run targets a non-local
// host or a database whose name does not end in "test".
assertSafeDbTestEnv(process.env);

const RUN_REQUESTED = process.env.RUN_DB_TESTS === '1';
const DB_HOST_IS_LOCAL = isLocalDbHost(process.env.DB_HOST);

const DB_ENABLED =
  RUN_REQUESTED &&
  DB_HOST_IS_LOCAL &&
  Boolean(
    process.env.DB_HOST &&
    process.env.DB_NAME &&
    process.env.DB_USER &&
    'DB_PASSWORD' in process.env &&
    process.env.JWT_ACCESS_SECRET &&
    process.env.JWT_REFRESH_SECRET
  );

const describeDb = DB_ENABLED ? describe : describe.skip;

let svc;
let db;
const createdOrderIds = new Set();

async function waitForInvoice(orderId, timeoutMs = 3000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const [rows] = await db.query('SELECT id FROM invoices WHERE order_id = ?', [orderId]);
    if (rows.length > 0) return rows[0];
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Invoice for ${orderId} was not created within ${timeoutMs}ms`);
}

async function createTestOrder(initialStatus) {
  const order = await svc.createOrder({
    customer: {
      name: 'Phase 2A Test',
      phone: '080000000000',
      address: 'Test address',
      email: null,
    },
    items: [{ name: 'Test item', price: 10000, quantity: 1 }],
    subtotal: 10000,
    source: 'online',
    orderType: 'standard',
    initialStatus,
  });
  createdOrderIds.add(order.id);
  await waitForInvoice(order.id);
  return order;
}

function conflictStatus(err) {
  return err?.status === 409 || err?.status === 403;
}

beforeAll(async () => {
  if (!DB_ENABLED) return;
  svc = await import('../services/orders.service.js');
  db = await import('../db/connection.js');
});

afterEach(async () => {
  if (!DB_ENABLED) return;
  for (const id of createdOrderIds) {
    try {
      await svc.deleteOrder(id, { role: 'admin' });
    } catch {
      // best-effort cleanup
    }
  }
  createdOrderIds.clear();
});

describeDb('Phase 2A status transactions (real MySQL)', () => {
  it('two concurrent transitions: exactly one succeeds, the other is rejected', async () => {
    const order = await createTestOrder('On Progress');

    const results = await Promise.allSettled([
      svc.updateOrderStatus(order.id, 'Quality Checking', 'qc-1', 'qc', null, 'QC 1'),
      svc.updateOrderStatus(order.id, 'Quality Checking', 'qc-2', 'qc', null, 'QC 2'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(conflictStatus(rejected[0].reason)).toBe(true);

    const latest = await svc.getOrderById(order.id);
    expect(latest.status).toBe('Quality Checking');
  });

  it('QC reject rework flow ends with In Delivery history and approval', async () => {
    const order = await createTestOrder('On Progress');

    await svc.updateOrderStatus(order.id, 'Quality Checking', 'qc-1', 'qc', null, 'QC 1');
    await svc.updateOrderStatus(order.id, 'On Progress', 'qc-1', 'qc', null, 'QC 1');
    await svc.updateOrderStatus(order.id, 'Quality Checking', 'qc-1', 'qc', null, 'QC 1');
    await svc.setTrackingNumber(order.id, 'RESI-PHASE2A', 'JNE', 'qc-1', 'qc', 'QC 1');

    const latest = await svc.getOrderById(order.id);
    expect(latest.status).toBe('In Delivery');
    expect(latest.tracking_number).toBe('RESI-PHASE2A');
    expect(latest.history.some((h) => h.to_status === 'Quality Checking')).toBe(true);
    expect(latest.history.some((h) => h.to_status === 'In Delivery')).toBe(true);
    expect(latest.approvals.some((a) => a.stage === 'In Delivery')).toBe(true);
  });

  it('Payment Accepted completes quickly without nested-connection deadlock', async () => {
    const order = await createTestOrder('Waiting for Payment');

    const run = Promise.allSettled([
      svc.updateOrderStatus(
        order.id,
        'Payment Accepted',
        'cashier-1',
        'cashier',
        null,
        'Cashier',
        { paymentStatus: 'paid', paymentMethod: 'cash' }
      ),
      svc.updateOrderStatus(
        order.id,
        'Payment Accepted',
        'cashier-2',
        'cashier',
        null,
        'Cashier 2',
        { paymentStatus: 'paid', paymentMethod: 'transfer' }
      ),
    ]);

    const result = await Promise.race([
      run,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Payment Accepted timed out (>5s)')), 5000)
      ),
    ]);

    const fulfilled = result.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);
    expect(result.some((r) => r.status === 'rejected' && conflictStatus(r.reason))).toBe(true);

    const latest = await svc.getOrderById(order.id);
    expect(latest.status).toBe('Payment Accepted');
    const [invoiceRows] = await db.query(
      'SELECT payment_status FROM invoices WHERE order_id = ?',
      [order.id]
    );
    expect(invoiceRows[0].payment_status).toBe('paid');
  });
});
