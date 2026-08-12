// Feature: dynamic-permissions — checkFeature middleware unit tests.
// Step 4: built separately, NOT wired to any route yet. These tests prove
// the decision table:
//   - not promoted admin  → pass through (legacy role system owns it)
//   - promoted + granted  → pass through
//   - promoted + denied   → 403
//   - promoted + no row   → 403 (default deny)

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/connection.js', () => ({
  query: vi.fn(),
}));

import checkFeature from '../middleware/checkFeature.js';
import { query } from '../db/connection.js';

beforeEach(() => {
  query.mockReset();
});

function makeReq(user) {
  return { user };
}

function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = vi.fn().mockReturnThis();
  res.json = vi.fn().mockImplementation((body) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('checkFeature — non-promoted admin skips check', () => {
  it('passes through when is_promoted_admin = 0', async () => {
    query.mockResolvedValueOnce([[{ is_promoted_admin: 0 }]]);
    const next = vi.fn();
    const res = makeRes();

    await checkFeature('orders.view')(makeReq({ id: 'u_001' }), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    // must NOT query admin_permissions for non-promoted accounts
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).not.toContain('admin_permissions');
  });
});

describe('checkFeature — promoted admin enforced', () => {
  it('passes through when granted = 1', async () => {
    query
      .mockResolvedValueOnce([[{ is_promoted_admin: 1 }]])
      .mockResolvedValueOnce([[{ granted: 1 }]]);
    const next = vi.fn();
    const res = makeRes();

    await checkFeature('orders.view')(makeReq({ id: 'u_001' }), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('admin_permissions'),
      ['u_001', 'orders.view']
    );
  });

  it('blocks with 403 when granted = 0', async () => {
    query
      .mockResolvedValueOnce([[{ is_promoted_admin: 1 }]])
      .mockResolvedValueOnce([[{ granted: 0 }]]);
    const next = vi.fn();
    const res = makeRes();

    await checkFeature('orders.view')(makeReq({ id: 'u_001' }), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.ok).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks with 403 when no permission row exists (default deny)', async () => {
    query
      .mockResolvedValueOnce([[{ is_promoted_admin: 1 }]])
      .mockResolvedValueOnce([[]]);
    const next = vi.fn();
    const res = makeRes();

    await checkFeature('orders.view')(makeReq({ id: 'u_001' }), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.message).toContain('tidak memiliki akses');
    expect(next).not.toHaveBeenCalled();
  });
});

describe('checkFeature — auth & error handling', () => {
  it('returns 401 when no user id', async () => {
    const next = vi.fn();
    const res = makeRes();

    await checkFeature('orders.view')(makeReq({}), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when user row missing', async () => {
    query.mockResolvedValueOnce([[]]);
    const next = vi.fn();
    const res = makeRes();

    await checkFeature('orders.view')(makeReq({ id: 'ghost' }), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards DB errors to next(err)', async () => {
    query.mockRejectedValueOnce(new Error('db down'));
    const next = vi.fn();
    const res = makeRes();

    await checkFeature('orders.view')(makeReq({ id: 'u_001' }), res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.status).not.toHaveBeenCalled();
  });
});
