/**
 * P0 auth middleware regression tests (mocked DB / JWT).
 *
 * No database is required. Also run against a real deleted staff row in staging.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/connection.js', () => ({ query: vi.fn() }));
vi.mock('../utils/jwt.js', () => ({ verifyAccessToken: vi.fn() }));

import { query } from '../db/connection.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { authenticate } from '../middleware/auth.js';

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

function staffReq(path = '/api/orders') {
  return {
    headers: { authorization: 'Bearer token' },
    originalUrl: path,
    user: undefined,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyAccessToken.mockReturnValue({ sub: 'staff-1', role: 'admin', name: 'Admin', email: 'a@x.id' });
});

describe('staff auth middleware', () => {
  it('returns 401 when the staff row is missing or soft-deleted', async () => {
    query.mockResolvedValue([[]]);
    const res = makeRes();
    const next = vi.fn();

    authenticate(staffReq(), res, next);
    await vi.waitFor(() => expect(res.statusCode).toBe(401));

    expect(next).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when the DB query fails', async () => {
    query.mockRejectedValue(new Error('db down'));
    const res = makeRes();
    const next = vi.fn();

    authenticate(staffReq(), res, next);
    await vi.waitFor(() => expect(res.statusCode).toBe(503));

    expect(next).not.toHaveBeenCalled();
  });

  it('still checks deleted status for must_change_password exceptions', async () => {
    query.mockResolvedValue([[]]);
    const res = makeRes();
    const next = vi.fn();

    authenticate(staffReq('/api/auth/me'), res, next);
    await vi.waitFor(() => expect(res.statusCode).toBe(401));

    expect(next).not.toHaveBeenCalled();
  });

  it('allows /api/auth/me when the account exists even if must_change_password is set', async () => {
    query.mockResolvedValue([[{ must_change_password: 1 }]]);
    const res = makeRes();
    const next = vi.fn();

    authenticate(staffReq('/api/auth/me'), res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());
  });
});
