/**
 * Guarded real-MySQL tests for Phase 2A status-transaction scenarios that are
 * not covered by orderStatusTransaction.guarded.test.js:
 *
 *   a. 20 concurrent updates on one order -> exactly one wins, no deadlock.
 *   a2. The same legacy 20-way race without expectedStatus prints its conflict
 *       distribution (403-or-409) so behaviour without the new parameter stays
 *       observable.
 *   b. Full Payment Accepted flow < 5s and the pool is fully returned.
 *   c. QC reject -> rework -> QC again -> In Delivery, with a recreated
 *      Quality Checking approval and a complete order_history trail.
 *   d. setTrackingNumber on Quality Checking -> In Delivery with history and
 *      an In Delivery approval.
 *   e. A mid-transaction history failure rolls back the status change and
 *      releases the connection.
 *   f. A stale admin cancel (expectedStatus no longer matches) gets 409 while
 *      the winning advance remains the final status.
 *
 * Guarded twice:
 *   - RUN_DB_TESTS=1 and all DB/JWT env vars must be present, otherwise SKIP.
 *   - When RUN_DB_TESTS=1, DB_HOST MUST be 127.0.0.1 or localhost AND DB_NAME
 *     must match /(^|_)test$/i; otherwise the file refuses to load.
 *
 * No .env file is required or written: pass the values through the process
 * environment (see the PowerShell commands in the task report).
 */

import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
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

if (RUN_REQUESTED && !DB_ENABLED) {
  console.warn(
    '[db-tests] RUN_DB_TESTS=1 but the DB/JWT environment is incomplete; ' +
      'scenario DB tests will be skipped.'
  );
}

const describeDb = DB_ENABLED ? describe : describe.skip;

let svc;
let db;
const createdOrderIds = new Set();
const createdTriggerNames = new Set();

// ── Helpers ─────────────────────────────────────────────────────────────────

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

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
      name: 'Phase 2A Scenario Test',
      phone: '080000000001',
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
  // createOrder() auto-creates the invoice fire-and-forget; wait for it so
  // later assertions and cleanup never race with that background task.
  await waitForInvoice(order.id);
  return order;
}

/**
 * Prove the pool has no leaked connection: acquire EVERY connection in the
 * pool within the timeout, then release them all. If a connection from the
 * flow under test was never released, the last getConnection() stays queued
 * and this helper fails instead of hanging the suite.
 */
async function assertPoolFullyAvailable(label, timeoutMs = 3000) {
  const core = db.pool.pool;
  const limit = core.config.connectionLimit;
  const acquired = [];

  try {
    for (let i = 0; i < limit; i += 1) {
      const conn = await withTimeout(
        db.pool.getConnection(),
        timeoutMs,
        `${label}: acquiring connection ${i + 1}/${limit}`
      );
      acquired.push(conn);
    }
  } catch (err) {
    throw new Error(
      `${label}: connection pool is not fully available (possible leak). ${err.message}`,
      { cause: err }
    );
  } finally {
    for (const conn of acquired) conn.release();
  }

  expect(core._connectionQueue.length, `${label}: queued waiters`).toBe(0);
  expect(core._freeConnections.length, `${label}: free connections`).toBe(limit);
}

async function dropTrigger(name) {
  await db.pool.query(`DROP TRIGGER IF EXISTS \`${name}\``);
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  if (!DB_ENABLED) return;
  svc = await import('../services/orders.service.js');
  db = await import('../db/connection.js');
});

afterEach(async () => {
  if (!DB_ENABLED) return;

  for (const name of createdTriggerNames) {
    try {
      await dropTrigger(name);
    } catch {
      // best-effort cleanup
    }
  }
  createdTriggerNames.clear();

  for (const id of createdOrderIds) {
    try {
      await svc.deleteOrder(id, { role: 'admin' });
    } catch {
      // best-effort cleanup
    }
  }
  createdOrderIds.clear();
});

afterAll(async () => {
  if (!DB_ENABLED || !db) return;
  try {
    await db.pool.end();
  } catch {
    // best-effort shutdown
  }
});

// ── Scenarios ───────────────────────────────────────────────────────────────

describeDb('Phase 2A status transaction scenarios (real MySQL, local only)', () => {
  it('(a) 20 concurrent updates with expectedStatus: exactly one wins, 19 get 409, no deadlock/timeout', async () => {
    const order = await createTestOrder('On Progress');
    const attempts = 20;

    const results = await withTimeout(
      Promise.allSettled(
        Array.from({ length: attempts }, (_, i) =>
          svc.updateOrderStatus(
            order.id,
            'Quality Checking',
            `qc-concurrent-${i}`,
            'qc',
            null,
            `QC Concurrent ${i}`,
            null,
            { expectedStatus: 'On Progress' }
          )
        )
      ),
      20000,
      '20 concurrent status updates'
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(attempts - 1);

    const reasons = rejected.map((r) => r.reason);
    const deadlocks = reasons.filter(
      (err) => err?.errno === 1213 || err?.code === 'ER_LOCK_DEADLOCK'
    );
    const lockTimeouts = reasons.filter(
      (err) => err?.errno === 1205 || err?.code === 'ER_LOCK_WAIT_TIMEOUT'
    );
    expect(deadlocks).toHaveLength(0);
    expect(lockTimeouts).toHaveLength(0);

    // Every loser sent the original displayed status, so the optimistic
    // concurrency guard must reject them with 409 (never 403).
    const conflictStatuses = reasons.map((err) => err?.status);
    expect(conflictStatuses).toHaveLength(attempts - 1);
    expect(conflictStatuses.every((status) => status === 409)).toBe(true);
    expect(reasons.every((err) => /Status order sudah berubah/.test(err.message))).toBe(true);

    const latest = await svc.getOrderById(order.id);
    expect(latest.status).toBe('Quality Checking');
    expect(latest.history.filter((h) => h.to_status === 'Quality Checking')).toHaveLength(1);
    expect(
      latest.approvals.filter((a) => a.stage === 'Quality Checking')
    ).toHaveLength(1);

    const counts = conflictStatuses.reduce((acc, status) => {
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    console.info('[db-test] 20-way concurrency (expectedStatus) loser statuses:', counts);
  });

  it('(a2) 20 concurrent updates WITHOUT expectedStatus keep the legacy conflict distribution', async () => {
    const order = await createTestOrder('On Progress');
    const attempts = 20;

    const results = await withTimeout(
      Promise.allSettled(
        Array.from({ length: attempts }, (_, i) =>
          svc.updateOrderStatus(
            order.id,
            'Quality Checking',
            `qc-legacy-${i}`,
            'qc',
            null,
            `QC Legacy ${i}`
          )
        )
      ),
      20000,
      '20 concurrent legacy status updates'
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(attempts - 1);

    const reasons = rejected.map((r) => r.reason);
    expect(
      reasons.some((err) => err?.errno === 1213 || err?.code === 'ER_LOCK_DEADLOCK')
    ).toBe(false);
    expect(
      reasons.some((err) => err?.errno === 1205 || err?.code === 'ER_LOCK_WAIT_TIMEOUT')
    ).toBe(false);

    // Legacy callers do not send expectedStatus. The row lock makes losers
    // re-read the committed status (403 from the transition guard) or hit the
    // defensive UPDATE predicate (409); both are acceptable, but only one wins.
    const conflictStatuses = reasons.map((err) => err?.status);
    expect(conflictStatuses.every((status) => status === 403 || status === 409)).toBe(true);

    const counts = conflictStatuses.reduce((acc, status) => {
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    console.info('[db-test] 20-way concurrency (no expectedStatus) loser statuses:', counts);

    const latest = await svc.getOrderById(order.id);
    expect(latest.status).toBe('Quality Checking');
  });

  it('(b) Payment Accepted finishes under 5s and returns every pool connection', async () => {
    const order = await createTestOrder('Waiting for Payment');

    const started = Date.now();
    const updated = await withTimeout(
      svc.updateOrderStatus(
        order.id,
        'Payment Accepted',
        'cashier-payment',
        'cashier',
        null,
        'Cashier Payment',
        { paymentStatus: 'paid', paymentMethod: 'cash' }
      ),
      5000,
      'Payment Accepted transition'
    );
    const elapsedMs = Date.now() - started;

    expect(elapsedMs).toBeLessThan(5000);
    expect(updated.status).toBe('Payment Accepted');
    expect(
      updated.history.some(
        (h) => h.from_status === 'Waiting for Payment' && h.to_status === 'Payment Accepted'
      )
    ).toBe(true);
    expect(
      updated.approvals.some((a) => a.stage === 'Payment Accepted')
    ).toBe(true);

    const [invoiceRows] = await db.query(
      'SELECT payment_status, payment_method, locked, paid_at FROM invoices WHERE order_id = ?',
      [order.id]
    );
    expect(invoiceRows).toHaveLength(1);
    expect(invoiceRows[0].payment_status).toBe('paid');
    expect(invoiceRows[0].payment_method).toBe('cash');
    expect(Number(invoiceRows[0].locked)).toBe(1);
    expect(invoiceRows[0].paid_at).toBeTruthy();

    await assertPoolFullyAvailable('Payment Accepted');
  });

  it('(c) QC reject -> rework -> QC again -> In Delivery recreates the approval and records every step', async () => {
    const order = await createTestOrder('On Progress');

    await svc.updateOrderStatus(
      order.id,
      'Quality Checking',
      'qc-rework',
      'qc',
      null,
      'QC Rework'
    );
    const [firstQcRows] = await db.query(
      "SELECT id FROM order_approvals WHERE order_id = ? AND stage = 'Quality Checking'",
      [order.id]
    );
    expect(firstQcRows).toHaveLength(1);

    // QC reject: rework is explicitly allowed to bypass the On Progress lock.
    await svc.updateOrderStatus(
      order.id,
      'On Progress',
      'qc-rework',
      'qc',
      null,
      'QC Rework'
    );
    const [qcAfterReject] = await db.query(
      "SELECT id FROM order_approvals WHERE order_id = ? AND stage = 'Quality Checking'",
      [order.id]
    );
    expect(qcAfterReject).toHaveLength(0);

    // QC again: the Quality Checking approval must be recreated with a new id.
    await svc.updateOrderStatus(
      order.id,
      'Quality Checking',
      'qc-rework',
      'qc',
      null,
      'QC Rework'
    );
    const [secondQcRows] = await db.query(
      "SELECT id FROM order_approvals WHERE order_id = ? AND stage = 'Quality Checking'",
      [order.id]
    );
    expect(secondQcRows).toHaveLength(1);
    expect(secondQcRows[0].id).not.toBe(firstQcRows[0].id);

    const final = await svc.setTrackingNumber(
      order.id,
      'RESI-REWORK',
      'JNE',
      'qc-rework',
      'qc',
      'QC Rework'
    );

    expect(final.status).toBe('In Delivery');
    expect(final.tracking_number).toBe('RESI-REWORK');

    const steps = final.history.map(
      (h) => `${h.from_status ?? 'null'} -> ${h.to_status}`
    );
    expect(steps.filter((s) => s === 'On Progress -> Quality Checking')).toHaveLength(2);
    expect(steps).toContain('Quality Checking -> On Progress');
    expect(steps).toContain('Quality Checking -> In Delivery');

    expect(
      final.approvals.filter((a) => a.stage === 'Quality Checking')
    ).toHaveLength(1);
    expect(final.approvals.some((a) => a.stage === 'On Progress')).toBe(true);
    expect(final.approvals.some((a) => a.stage === 'In Delivery')).toBe(true);
  });

  it('(d) setTrackingNumber on Quality Checking advances to In Delivery with history and approval', async () => {
    const order = await createTestOrder('On Progress');

    await svc.updateOrderStatus(
      order.id,
      'Quality Checking',
      'qc-tracking',
      'qc',
      null,
      'QC Tracking'
    );

    const updated = await svc.setTrackingNumber(
      order.id,
      'RESI-TRACK-1',
      'J&T',
      'qc-tracking',
      'qc',
      'QC Tracking'
    );

    expect(updated.status).toBe('In Delivery');
    expect(updated.tracking_number).toBe('RESI-TRACK-1');
    expect(updated.courier_name).toBe('J&T');
    expect(
      updated.history.filter(
        (h) => h.from_status === 'Quality Checking' && h.to_status === 'In Delivery'
      )
    ).toHaveLength(1);
    expect(updated.history.filter((h) => h.to_status === 'In Delivery')).toHaveLength(1);

    const inDeliveryApprovals = updated.approvals.filter(
      (a) => a.stage === 'In Delivery'
    );
    expect(inDeliveryApprovals).toHaveLength(1);
    expect(inDeliveryApprovals[0].approved_role).toBe('qc');
  });

  it('(e) a history insert failure rolls back the status change and releases the connection', async () => {
    const order = await createTestOrder('On Progress');
    const triggerName = `trg_rollback_${order.id.replace(/-/g, '').slice(0, 20)}`;

    createdTriggerNames.add(triggerName);
    await dropTrigger(triggerName);

    // Fires only for THIS order, so concurrently running test files that
    // insert history for their own orders are unaffected.
    await db.pool.query(
      `CREATE TRIGGER \`${triggerName}\`
       BEFORE INSERT ON order_history
       FOR EACH ROW
       BEGIN
         IF NEW.order_id = '${order.id}' THEN
           SIGNAL SQLSTATE '45000'
             SET MESSAGE_TEXT = 'forced order_history failure (rollback test)';
         END IF;
       END`
    );

    try {
      let failure = null;
      try {
        await svc.updateOrderStatus(
          order.id,
          'Quality Checking',
          'qc-rollback',
          'qc',
          null,
          'QC Rollback'
        );
      } catch (err) {
        failure = err;
      }

      expect(failure).not.toBeNull();
      expect(
        failure.errno === 1644 ||
          /forced order_history failure/.test(failure.message || '')
      ).toBe(true);

      const latest = await svc.getOrderById(order.id);
      expect(latest.status).toBe('On Progress');
      expect(
        latest.history.filter((h) => h.to_status === 'Quality Checking')
      ).toHaveLength(0);
      expect(
        latest.approvals.filter((a) => a.stage === 'Quality Checking')
      ).toHaveLength(0);

      // The UPDATE orders predicate ran before the failing INSERT, so this
      // assertion also proves the rollback undid it.
      await assertPoolFullyAvailable('rollback after history failure');
    } finally {
      await dropTrigger(triggerName);
      createdTriggerNames.delete(triggerName);
    }
  });

  it('(f) a stale admin cancel with expectedStatus is rejected 409 while the winning advance persists', async () => {
    const order = await createTestOrder('On Progress');

    // A (QC) advances first and commits.
    await svc.updateOrderStatus(
      order.id,
      'Quality Checking',
      'qc-winner',
      'qc',
      null,
      'QC Winner'
    );

    // B (admin) still displays "On Progress" and tries to cancel.
    let failure = null;
    try {
      await svc.updateOrderStatus(
        order.id,
        'Cancelled',
        'admin-stale',
        'admin',
        'Customer request',
        'Admin Stale',
        null,
        { expectedStatus: 'On Progress' }
      );
    } catch (err) {
      failure = err;
    }

    expect(failure).not.toBeNull();
    expect(failure.status).toBe(409);
    expect(failure.message).toMatch(/Status order sudah berubah/);

    const latest = await svc.getOrderById(order.id);
    expect(latest.status).toBe('Quality Checking');
    expect(latest.history.some((h) => h.to_status === 'Cancelled')).toBe(false);
    expect(
      latest.history.filter((h) => h.to_status === 'Quality Checking')
    ).toHaveLength(1);
  });
});
