/**
 * Controller-level tests for the optional `expectedStatus` guard:
 *   - invalid value -> HTTP 400 without touching the service
 *   - valid value   -> forwarded as options to the service
 *   - absent value  -> legacy call shape (expectedStatus undefined)
 *   - service 409   -> HTTP 409 response
 *
 * No database is required; the service layer is spied on.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const svc = await import('../services/orders.service.js');
const ctrl = await import('../controllers/orders.controller.js');
const { STATUS_CHANGED_MESSAGE } = await import('../config/orderStatuses.js');

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

function makeReq({ id = 'order-1', body = {}, user = { id: 'admin-1', role: 'admin', name: 'Admin' } } = {}) {
  return { params: { id }, body, user };
}

function statusError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('PATCH /status expectedStatus validation', () => {
  it('returns 400 for an invalid expectedStatus without calling the service', async () => {
    const update = vi.spyOn(svc, 'updateOrderStatus');
    const res = makeRes();
    const next = vi.fn();

    await ctrl.updateOrderStatus(
      makeReq({ body: { newStatus: 'Quality Checking', expectedStatus: 'Bogus' } }),
      res,
      next
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ ok: false });
    expect(update).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards a valid expectedStatus and uses options.out for the previous status', async () => {
    const get = vi.spyOn(svc, 'getOrderById');
    const update = vi
      .spyOn(svc, 'updateOrderStatus')
      .mockImplementation(async (...args) => {
        args[7].out.previousStatus = 'On Progress';
        return { id: 'order-1', status: 'Quality Checking' };
      });
    const res = makeRes();
    const next = vi.fn();

    await ctrl.updateOrderStatus(
      makeReq({ body: { newStatus: 'Quality Checking', expectedStatus: 'On Progress' } }),
      res,
      next
    );

    expect(res.statusCode).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    const options = update.mock.calls[0][7];
    expect(options.expectedStatus).toBe('On Progress');
    expect(options.out).toEqual({ previousStatus: 'On Progress' });
    // Step 5: the controller must not fetch the order again just for the status.
    expect(get).not.toHaveBeenCalled();
  });

  it('does not send expectedStatus when the client omits it', async () => {
    const update = vi
      .spyOn(svc, 'updateOrderStatus')
      .mockResolvedValue({ id: 'order-1', status: 'Quality Checking' });
    const res = makeRes();

    await ctrl.updateOrderStatus(
      makeReq({ body: { newStatus: 'Quality Checking' } }),
      res,
      vi.fn()
    );

    const options = update.mock.calls[0][7];
    expect(options.expectedStatus).toBeUndefined();
    expect(options.out).toEqual({});
  });

  it('maps a service 409 to HTTP 409 with the shared message', async () => {
    vi.spyOn(svc, 'updateOrderStatus').mockRejectedValue(
      statusError(409, STATUS_CHANGED_MESSAGE)
    );
    const res = makeRes();

    await ctrl.updateOrderStatus(
      makeReq({ body: { newStatus: 'In Delivery', expectedStatus: 'On Progress' } }),
      res,
      vi.fn()
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ ok: false, message: STATUS_CHANGED_MESSAGE });
  });
});

describe('PATCH /orders/:id/tracking previousStatus', () => {
  it('uses options.out and does not issue an extra getOrderById query', async () => {
    const get = vi.spyOn(svc, 'getOrderById');
    const set = vi.spyOn(svc, 'setTrackingNumber').mockImplementation(async (...args) => {
      args[6].out.previousStatus = 'Quality Checking';
      return { id: 'order-1', status: 'In Delivery' };
    });

    const req = {
      params: { id: 'order-1' },
      body: { trackingNumber: 'RESI-1', courierName: 'JNE' },
      user: { id: 'qc-1', role: 'qc', name: 'QC' },
    };
    const res = makeRes();

    await ctrl.setTracking(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set.mock.calls[0][6]).toEqual({ out: expect.any(Object) });
    expect(set.mock.calls[0][6].out.previousStatus).toBe('Quality Checking');
    expect(get).not.toHaveBeenCalled();
  });
});

describe('DELETE /orders/:id expectedStatus validation', () => {
  it('returns 400 for an invalid expectedStatus without calling the service', async () => {
    const del = vi.spyOn(svc, 'deleteOrder');
    const res = makeRes();
    const next = vi.fn();

    await ctrl.deleteOrder(makeReq({ body: { expectedStatus: 'Bogus' } }), res, next);

    expect(res.statusCode).toBe(400);
    expect(del).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards a valid expectedStatus to the service', async () => {
    const del = vi
      .spyOn(svc, 'deleteOrder')
      .mockResolvedValue({ id: 'order-1', status: 'Waiting for Payment' });
    const req = makeReq({ body: { expectedStatus: 'Waiting for Payment' } });
    const res = makeRes();

    await ctrl.deleteOrder(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(del).toHaveBeenCalledWith('order-1', req.user, {
      expectedStatus: 'Waiting for Payment',
    });
  });

  it('maps a service 409 to HTTP 409', async () => {
    vi.spyOn(svc, 'deleteOrder').mockRejectedValue(
      statusError(409, STATUS_CHANGED_MESSAGE)
    );
    const res = makeRes();

    await ctrl.deleteOrder(
      makeReq({ body: { expectedStatus: 'On Progress' } }),
      res,
      vi.fn()
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ ok: false, message: STATUS_CHANGED_MESSAGE });
  });
});
