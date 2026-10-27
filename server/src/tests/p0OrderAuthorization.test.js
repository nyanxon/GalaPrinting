/**
 * P0 order authorization regression tests.
 *
 * These tests mock the service/storage layers and do NOT require a database.
 * Run the same scenarios against a real DB in CI/staging before deploy.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { access, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { assertCanAccessOrder } from '../utils/orderAccess.js';
import * as ordersSvc from '../services/orders.service.js';
import * as invoiceSvc from '../services/invoice.service.js';
import * as ordersCtrl from '../controllers/orders.controller.js';
import * as invoiceCtrl from '../controllers/invoice.controller.js';
import { StorageService } from '../utils/storage.js';

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

vi.mock('../db/connection.js', () => ({ query: vi.fn() }));

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

const customerA = { id: 'customer-a', role: 'customer', name: 'A' };
const customerB = { id: 'customer-b', role: 'customer', name: 'B' };
const staff = { id: 'staff-1', role: 'admin', name: 'Admin' };

const orderB = {
  id: 'order-b',
  order_number: 'GALA-1',
  customer_id: customerB.id,
  customer_phone: '081234567890',
  customer_email: 'b@example.com',
  customer_address: 'Rahasia',
  status: 'On Progress',
  delivery_method: 'delivery',
  tracking_number: 'RESI-1',
  courier_name: 'JNE',
  timelineMap: { 'On Progress': '2026-01-01T00:00:00.000Z' },
  items: [{ id: 'item-1', name: 'Kaos', quantity: 2 }],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('assertCanAccessOrder', () => {
  it('allows staff and denies other customers with 404', () => {
    expect(() => assertCanAccessOrder(staff, orderB)).not.toThrow();
    expect(() => assertCanAccessOrder(customerB, orderB)).not.toThrow();

    let status;
    try {
      assertCanAccessOrder(customerA, orderB);
    } catch (err) {
      status = err.status;
    }
    expect(status).toBe(404);
  });

  it('returns 404 when the order is null or undefined, even for staff', () => {
    for (const user of [staff, customerB]) {
      for (const order of [null, undefined]) {
        expect(() => assertCanAccessOrder(user, order)).toThrowError(
          expect.objectContaining({ name: 'OrderAccessError', status: 404 })
        );
      }
    }
  });
});

describe('GET /api/orders/my', () => {
  it('always lists orders for the authenticated customer, never a supplied id', async () => {
    const list = vi.spyOn(ordersSvc, 'listOrdersByCustomer').mockResolvedValue([]);

    const res = makeRes();
    await ordersCtrl.listMyOrders(
      { user: customerA, query: { customerId: customerB.id } },
      res,
      vi.fn()
    );

    expect(list).toHaveBeenCalledWith({ customerId: customerA.id });
    expect(res.statusCode).toBe(200);
  });
});

describe('GET /api/orders/:id', () => {
  it('returns 404 for customer A on customer B order and 200 for staff', async () => {
    vi.spyOn(ordersSvc, 'getOrderById').mockResolvedValue(orderB);

    const resA = makeRes();
    await ordersCtrl.getOrder({ params: { id: orderB.id }, user: customerA }, resA, vi.fn());
    expect(resA.statusCode).toBe(404);

    const resStaff = makeRes();
    await ordersCtrl.getOrder({ params: { id: orderB.id }, user: staff }, resStaff, vi.fn());
    expect(resStaff.statusCode).toBe(200);
  });

  it('returns 404 when getOrderById returns null or undefined', async () => {
    for (const missing of [null, undefined]) {
      vi.spyOn(ordersSvc, 'getOrderById').mockResolvedValue(missing);

      const res = makeRes();
      await ordersCtrl.getOrder({ params: { id: 'missing' }, user: staff }, res, vi.fn());

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ ok: false, message: 'Pesanan tidak ditemukan.' });
    }
  });
});

describe('GET /api/invoices/:id', () => {
  it('returns 404 for customer A and 200 for staff', async () => {
    vi.spyOn(invoiceSvc, 'getInvoiceById').mockResolvedValue({ id: 'inv-1', order_id: orderB.id });
    vi.spyOn(ordersSvc, 'getOrderById').mockResolvedValue(orderB);

    const resA = makeRes();
    await invoiceCtrl.getInvoice({ params: { id: 'inv-1' }, user: customerA }, resA, vi.fn());
    expect(resA.statusCode).toBe(404);

    const resStaff = makeRes();
    await invoiceCtrl.getInvoice({ params: { id: 'inv-1' }, user: staff }, resStaff, vi.fn());
    expect(resStaff.statusCode).toBe(200);
  });

  it('returns 404 when the invoice order is null or undefined', async () => {
    vi.spyOn(invoiceSvc, 'getInvoiceById').mockResolvedValue({ id: 'inv-1', order_id: 'missing' });

    for (const missing of [null, undefined]) {
      vi.spyOn(ordersSvc, 'getOrderById').mockResolvedValue(missing);

      const res = makeRes();
      await invoiceCtrl.getInvoice({ params: { id: 'inv-1' }, user: staff }, res, vi.fn());

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ ok: false, message: 'Pesanan tidak ditemukan.' });
    }
  });
});

describe('GET /api/orders/:orderId/invoice', () => {
  it('returns 404 for customer A and 200 for staff', async () => {
    vi.spyOn(ordersSvc, 'getOrderById').mockResolvedValue(orderB);
    vi.spyOn(invoiceSvc, 'getInvoiceByOrderId').mockResolvedValue({ id: 'inv-1', order_id: orderB.id });

    const resA = makeRes();
    await invoiceCtrl.getInvoiceByOrder({ params: { orderId: orderB.id }, user: customerA }, resA, vi.fn());
    expect(resA.statusCode).toBe(404);

    const resStaff = makeRes();
    await invoiceCtrl.getInvoiceByOrder({ params: { orderId: orderB.id }, user: staff }, resStaff, vi.fn());
    expect(resStaff.statusCode).toBe(200);
  });

  it('returns 404 when the order is null or undefined', async () => {
    for (const missing of [null, undefined]) {
      vi.spyOn(ordersSvc, 'getOrderById').mockResolvedValue(missing);

      const res = makeRes();
      await invoiceCtrl.getInvoiceByOrder(
        { params: { orderId: 'missing' }, user: staff },
        res,
        vi.fn()
      );

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ ok: false, message: 'Pesanan tidak ditemukan.' });
    }
  });
});

describe('upload ownership', () => {
  it('returns 404 and saves nothing when the order does not exist (payment proof)', async () => {
    for (const missing of [null, undefined]) {
      vi.spyOn(ordersSvc, 'getOrderById').mockResolvedValue(missing);
      const save = vi.spyOn(StorageService, 'save');
      const attach = vi.spyOn(ordersSvc, 'attachPaymentProof');

      const res = makeRes();
      await ordersCtrl.uploadPaymentProof(
        { params: { id: 'missing' }, user: staff, file: { originalname: 'x.png' } },
        res,
        vi.fn()
      );

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ ok: false, message: 'Pesanan tidak ditemukan.' });
      expect(save).not.toHaveBeenCalled();
      expect(attach).not.toHaveBeenCalled();
    }
  });

  it('returns 404 and saves nothing when the order does not exist (design)', async () => {
    for (const missing of [null, undefined]) {
      vi.spyOn(ordersSvc, 'getOrderById').mockResolvedValue(missing);
      const save = vi.spyOn(StorageService, 'save');
      const attach = vi.spyOn(ordersSvc, 'attachDesignFile');

      const res = makeRes();
      await ordersCtrl.uploadDesignFile(
        { params: { id: 'missing', itemId: 'item-1' }, user: staff, file: { originalname: 'x.pdf' } },
        res,
        vi.fn()
      );

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ ok: false, message: 'Pesanan tidak ditemukan.' });
      expect(save).not.toHaveBeenCalled();
      expect(attach).not.toHaveBeenCalled();
    }
  });

  it('does not save or overwrite a payment proof for another customer', async () => {
    vi.spyOn(ordersSvc, 'getOrderById').mockResolvedValue(orderB);
    const save = vi.spyOn(StorageService, 'save');
    const attach = vi.spyOn(ordersSvc, 'attachPaymentProof');

    const res = makeRes();
    await ordersCtrl.uploadPaymentProof(
      { params: { id: orderB.id }, user: customerA, file: { originalname: 'x.png' } },
      res,
      vi.fn()
    );

    expect(res.statusCode).toBe(404);
    expect(save).not.toHaveBeenCalled();
    expect(attach).not.toHaveBeenCalled();
  });

  it('deletes the Multer temp file when payment-proof ownership fails', async () => {
    vi.spyOn(ordersSvc, 'getOrderById').mockResolvedValue(orderB);

    const dir = await mkdtemp(join(tmpdir(), 'gala-upload-'));
    const tempPath = join(dir, 'payment.png');
    await writeFile(tempPath, 'proof');

    try {
      const res = makeRes();
      await ordersCtrl.uploadPaymentProof(
        { params: { id: orderB.id }, user: customerA, file: { path: tempPath } },
        res,
        vi.fn()
      );

      expect(res.statusCode).toBe(404);
      await expect(access(tempPath)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('deletes the Multer temp file when the design item is foreign', async () => {
    vi.spyOn(ordersSvc, 'getOrderById').mockResolvedValue(orderB);

    const dir = await mkdtemp(join(tmpdir(), 'gala-upload-'));
    const tempPath = join(dir, 'design.pdf');
    await writeFile(tempPath, 'design');

    try {
      const res = makeRes();
      await ordersCtrl.uploadDesignFile(
        { params: { id: orderB.id, itemId: 'item-foreign' }, user: customerB, file: { path: tempPath } },
        res,
        vi.fn()
      );

      expect(res.statusCode).toBe(404);
      await expect(access(tempPath)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not save a design for another customer or a foreign item', async () => {
    vi.spyOn(ordersSvc, 'getOrderById').mockResolvedValue(orderB);
    const save = vi.spyOn(StorageService, 'save');
    const attach = vi.spyOn(ordersSvc, 'attachDesignFile');

    const resOtherCustomer = makeRes();
    await ordersCtrl.uploadDesignFile(
      { params: { id: orderB.id, itemId: 'item-1' }, user: customerA, file: {} },
      resOtherCustomer,
      vi.fn()
    );
    expect(resOtherCustomer.statusCode).toBe(404);
    expect(save).not.toHaveBeenCalled();

    const resForeignItem = makeRes();
    await ordersCtrl.uploadDesignFile(
      { params: { id: orderB.id, itemId: 'item-foreign' }, user: customerB, file: {} },
      resForeignItem,
      vi.fn()
    );
    expect(resForeignItem.statusCode).toBe(404);
    expect(save).not.toHaveBeenCalled();
    expect(attach).not.toHaveBeenCalled();
  });
});

describe('GET /api/orders/track', () => {
  it('requires phone and returns generic 404 when missing or mismatched', async () => {
    vi.spyOn(ordersSvc, 'findOrder').mockResolvedValue(orderB);

    const missing = makeRes();
    await ordersCtrl.trackOrder({ query: { orderNumber: orderB.order_number } }, missing, vi.fn());
    expect(missing.statusCode).toBe(404);
    expect(missing.body.message).toBe('Pesanan tidak ditemukan.');

    const wrong = makeRes();
    await ordersCtrl.trackOrder(
      { query: { orderNumber: orderB.order_number, phone: '089999999' } },
      wrong,
      vi.fn()
    );
    expect(wrong.statusCode).toBe(404);
    expect(wrong.body.message).toBe('Pesanan tidak ditemukan.');
  });

  it('normalizes phone and returns only non-sensitive fields', async () => {
    vi.spyOn(ordersSvc, 'findOrder').mockResolvedValue(orderB);

    const res = makeRes();
    await ordersCtrl.trackOrder(
      { query: { orderNumber: orderB.order_number, phone: '+62 812-3456-7890' } },
      res,
      vi.fn()
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual({
      orderNumber: 'GALA-1',
      status: 'On Progress',
      timelineMap: orderB.timelineMap,
      items: [{ name: 'Kaos', quantity: 2 }],
      deliveryMethod: 'delivery',
      trackingNumber: 'RESI-1',
      courierName: 'JNE',
    });
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('b@example.com');
    expect(serialized).not.toContain('Rahasia');
    expect(serialized).not.toContain('081234567890');
  });

  it.each([
    '+62812-3456-7890',
    '6281234567890',
    '081234567890',
    '81234567890',
    '+62 812 3456 7890',
    '0812-3456-7890',
    '0812 3456 7890',
  ])('matches the stored phone for equivalent format %s', async (phone) => {
    vi.spyOn(ordersSvc, 'findOrder').mockResolvedValue(orderB);

    const res = makeRes();
    await ordersCtrl.trackOrder(
      { query: { orderNumber: orderB.order_number, phone } },
      res,
      vi.fn()
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.data.orderNumber).toBe('GALA-1');
  });

  it.each([
    '08123456789',
    '628123456789',
    '081298765432',
    '+6281298765432',
    '8123456',
    '0812345',
    '081234567',
    'not-a-phone',
  ])('returns the same generic 404 for a non-matching phone %s', async (phone) => {
    vi.spyOn(ordersSvc, 'findOrder').mockResolvedValue(orderB);

    const res = makeRes();
    await ordersCtrl.trackOrder(
      { query: { orderNumber: orderB.order_number, phone } },
      res,
      vi.fn()
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ ok: false, message: 'Pesanan tidak ditemukan.' });
  });
});
