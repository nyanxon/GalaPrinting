/**
 * FASE 2D D5 — customer upload restrictions.
 *
 * Matrix:
 *   - customer + payment proof: status allowlist AND invoice not paid/locked
 *   - customer + design file : status = Waiting for Design Approval only
 *   - staff                   : unchanged (always allowed)
 *
 * No database is required; services and storage are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { access, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ORDER_STATUSES } from '../config/orderStatuses.js';
import {
  CUSTOMER_DESIGN_UPLOAD_STATUSES,
  CUSTOMER_PAYMENT_PROOF_STATUSES,
  UPLOAD_FORBIDDEN_MESSAGE,
} from '../utils/uploadAccess.js';

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

vi.mock('../utils/storage.js', () => ({
  StorageService: {
    save: vi.fn(async () => ({ path: '/uploads/test-file', url: '/uploads/test-file' })),
    delete: vi.fn(async () => {}),
  },
}));

const ordersSvc = await import('../services/orders.service.js');
const ctrl = await import('../controllers/orders.controller.js');
const { StorageService } = await import('../utils/storage.js');

const CUSTOMER = { id: 'customer-1', role: 'customer', name: 'Customer' };
const STAFF = { id: 'admin-1', role: 'admin', name: 'Admin' };

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function makeOrder(overrides = {}) {
  return {
    id: 'order-1',
    order_number: 'GALA-1',
    customer_id: CUSTOMER.id,
    source: 'online',
    status: 'Waiting for Design Approval',
    items: [{ id: 'item-1', name: 'Kaos', quantity: 1 }],
    ...overrides,
  };
}

async function uploadPaymentProof({
  user = CUSTOMER,
  order = makeOrder(),
  invoice = { payment_status: 'unpaid', locked: 0 },
  file = { originalname: 'proof.png' },
} = {}) {
  vi.spyOn(ordersSvc, 'getOrderById').mockResolvedValue(order);
  const invoiceSpy = vi.spyOn(ordersSvc, 'getInvoicePaymentState').mockResolvedValue(invoice);
  const attach = vi.spyOn(ordersSvc, 'attachPaymentProof').mockResolvedValue(order);

  const res = makeRes();
  const next = vi.fn();
  await ctrl.uploadPaymentProof(
    { params: { id: order.id }, user, file },
    res,
    next
  );

  return { res, next, attach, invoiceSpy };
}

async function uploadDesign({
  user = CUSTOMER,
  order = makeOrder(),
  itemId = 'item-1',
  file = { originalname: 'design.pdf' },
} = {}) {
  vi.spyOn(ordersSvc, 'getOrderById').mockResolvedValue(order);
  const attach = vi.spyOn(ordersSvc, 'attachDesignFile').mockResolvedValue(undefined);

  const res = makeRes();
  const next = vi.fn();
  await ctrl.uploadDesignFile(
    { params: { id: order.id, itemId }, user, file },
    res,
    next
  );

  return { res, next, attach };
}

const tempDirs = [];

async function makeTempFile(name) {
  const dir = await mkdtemp(join(tmpdir(), 'gala-d5-'));
  tempDirs.push(dir);
  const path = join(dir, name);
  await writeFile(path, 'upload');
  return path;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  StorageService.save.mockResolvedValue({ path: '/uploads/test-file', url: '/uploads/test-file' });
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('D5 customer payment-proof allowlist', () => {
  it.each(
    ORDER_STATUSES.map((status) => ({
      status,
      allowed: CUSTOMER_PAYMENT_PROOF_STATUSES.includes(status),
    }))
  )('customer at "$status" -> allowed=$allowed', async ({ status, allowed }) => {
    const { res, next, attach } = await uploadPaymentProof({
      order: makeOrder({ status }),
    });

    if (allowed) {
      expect(res.statusCode).toBe(200);
      expect(StorageService.save).toHaveBeenCalledTimes(1);
      expect(attach).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    } else {
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({
        ok: false,
        message: UPLOAD_FORBIDDEN_MESSAGE.payment_proof_status,
      });
      expect(StorageService.save).not.toHaveBeenCalled();
      expect(attach).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    }
  });

  it.each(
    ORDER_STATUSES.map((status) => ({
      status,
      allowed: CUSTOMER_PAYMENT_PROOF_STATUSES.includes(status),
    }))
  )('staff at "$status" is unchanged -> allowed=$allowed', async ({ status }) => {
    const { res, attach, invoiceSpy } = await uploadPaymentProof({
      user: STAFF,
      order: makeOrder({ status }),
      // Staff must still be allowed even when the invoice is paid and locked.
      invoice: { payment_status: 'paid', locked: 1 },
    });

    expect(res.statusCode).toBe(200);
    expect(StorageService.save).toHaveBeenCalledTimes(1);
    expect(attach).toHaveBeenCalledTimes(1);
    expect(invoiceSpy).not.toHaveBeenCalled();
  });

  it('customer may upload when invoice is unpaid or absent', async () => {
    const first = await uploadPaymentProof({ invoice: null });
    expect(first.res.statusCode).toBe(200);
    expect(first.invoiceSpy).toHaveBeenCalledWith('order-1');

    vi.clearAllMocks();
    const second = await uploadPaymentProof({
      invoice: { payment_status: 'unpaid', locked: 0 },
    });
    expect(second.res.statusCode).toBe(200);
  });

  it('customer may upload when invoice is DP (not paid, not locked)', async () => {
    const { res } = await uploadPaymentProof({
      order: makeOrder({ status: 'Waiting for Payment' }),
      invoice: { payment_status: 'dp', locked: 0 },
    });

    expect(res.statusCode).toBe(200);
  });

  it('customer is denied when the invoice is paid even at an allowed status', async () => {
    const { res, attach } = await uploadPaymentProof({
      order: makeOrder({ status: 'Waiting for Payment' }),
      invoice: { payment_status: 'paid', locked: 1 },
    });

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      ok: false,
      message: UPLOAD_FORBIDDEN_MESSAGE.payment_proof_paid,
    });
    expect(StorageService.save).not.toHaveBeenCalled();
    expect(attach).not.toHaveBeenCalled();
  });

  it('customer is denied when the invoice is locked without being paid', async () => {
    const { res } = await uploadPaymentProof({
      order: makeOrder({ status: 'Design Accepted' }),
      invoice: { payment_status: 'dp', locked: 1 },
    });

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe(UPLOAD_FORBIDDEN_MESSAGE.payment_proof_paid);
  });
});

describe('D5 customer design-file allowlist', () => {
  it.each(
    ORDER_STATUSES.map((status) => ({
      status,
      allowed: CUSTOMER_DESIGN_UPLOAD_STATUSES.includes(status),
    }))
  )('customer at "$status" -> allowed=$allowed', async ({ status, allowed }) => {
    const { res, next, attach } = await uploadDesign({
      order: makeOrder({ status }),
    });

    if (allowed) {
      expect(res.statusCode).toBe(200);
      expect(StorageService.save).toHaveBeenCalledTimes(1);
      expect(attach).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    } else {
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({
        ok: false,
        message: UPLOAD_FORBIDDEN_MESSAGE.design_status,
      });
      expect(StorageService.save).not.toHaveBeenCalled();
      expect(attach).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    }
  });

  it.each(ORDER_STATUSES)('staff design upload at "%s" is unchanged', async (status) => {
    const { res, attach } = await uploadDesign({
      user: STAFF,
      order: makeOrder({ status }),
    });

    expect(res.statusCode).toBe(200);
    expect(StorageService.save).toHaveBeenCalledTimes(1);
    expect(attach).toHaveBeenCalledTimes(1);
  });
});

describe('D5 denied uploads clean up the Multer temp file', () => {
  it('deletes the temp payment proof and never saves it', async () => {
    const tempPath = await makeTempFile('payment.png');

    const { res } = await uploadPaymentProof({
      order: makeOrder({ status: 'On Progress' }),
      file: { path: tempPath, originalname: 'payment.png' },
    });

    expect(res.statusCode).toBe(403);
    expect(StorageService.save).not.toHaveBeenCalled();
    await expect(access(tempPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('deletes the temp design file and never saves it', async () => {
    const tempPath = await makeTempFile('design.pdf');

    const { res } = await uploadDesign({
      order: makeOrder({ status: 'Design Accepted' }),
      file: { path: tempPath, originalname: 'design.pdf' },
    });

    expect(res.statusCode).toBe(403);
    expect(StorageService.save).not.toHaveBeenCalled();
    await expect(access(tempPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
