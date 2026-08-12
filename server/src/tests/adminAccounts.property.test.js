// Feature: dynamic-permissions — adminAccounts service + controller must
// produce a stable full permission list for every registered feature,
// defaulting granted=false, and must reject unknown feature keys.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

vi.mock('../db/connection.js', () => ({
  query: vi.fn(),
  pool: { getConnection: vi.fn() },
}));

import * as svc from '../services/adminAccounts.service.js';
import * as ctrl from '../controllers/adminAccounts.controller.js';
import { query, pool } from '../db/connection.js';
import { FEATURE_CATEGORIES, ALL_FEATURES } from '../config/features.js';

const VALID_KEYS = ALL_FEATURES.map((f) => f.key);

beforeEach(() => {
  query.mockReset();
  pool.getConnection.mockReset();
});

function fakeUser(over = {}) {
  return {
    id: 'u_001',
    role: 'admin',
    name: 'Admin Satu',
    email: 'admin1@example.com',
    is_promoted_admin: 0,
    ...over,
  };
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

describe('listFeatures grouping', () => {
  it('groups exactly the registry keys, one feature_key per entry', () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_KEYS), (key) => {
        const groups = svc.listFeatures();
        const all = groups.flatMap((g) => g.features.map((f) => f.key));
        return all.filter((k) => k === key).length === 1;
      }),
      { numRuns: 10 }
    );
  });

  it('returns categories from FEATURE_CATEGORIES with correct labels', () => {
    const groups = svc.listFeatures();
    expect(groups.length).toBe(Object.values(FEATURE_CATEGORIES).length);
    const categories = Object.values(FEATURE_CATEGORIES).map((g) => g.category);
    for (const group of groups) {
      expect(categories).toContain(group.category);
    }
  });
});

describe('isValidFeatureKey', () => {
  it('accepts every registered key and rejects garbage', () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_KEYS), (key) => {
        expect(svc.isValidFeatureKey(key)).toBe(true);
      }),
      { numRuns: 50 }
    );
    expect(svc.isValidFeatureKey('orders.no-such-feature')).toBe(false);
    expect(svc.isValidFeatureKey('')).toBe(false);
    expect(svc.isValidFeatureKey(undefined)).toBe(false);
    expect(svc.isValidFeatureKey(null)).toBe(false);
  });
});

describe('getAccountPermissions', () => {
  it('merges stored grants with defaults for ALL registered features', async () => {
    query
      .mockResolvedValueOnce([[fakeUser()]])
      .mockResolvedValueOnce([
        [
          { feature_key: 'orders.view', granted: 1 },
          { feature_key: 'orders.create', granted: 0 },
        ],
      ]);

    const { user, permissions } = await svc.getAccountPermissions('u_001');

    expect(user).toBeTruthy();
    expect(permissions.length).toBe(ALL_FEATURES.length);

    // every registered feature present exactly once
    const seen = new Set(permissions.map((p) => p.feature_key));
    expect(seen.size).toBe(ALL_FEATURES.length);
    for (const f of ALL_FEATURES) expect(seen.has(f.key)).toBe(true);

    const ordersView = permissions.find((p) => p.feature_key === 'orders.view');
    const ordersCreate = permissions.find((p) => p.feature_key === 'orders.create');
    const unset = permissions.find((p) => p.feature_key === 'categories.view');
    expect(ordersView.granted).toBe(true);
    expect(ordersCreate.granted).toBe(false);
    expect(unset.granted).toBe(false);
  });

  it('returns user=null for unknown user without touching permissions', async () => {
    query.mockResolvedValueOnce([[]]);
    const { user } = await svc.getAccountPermissions('missing');
    expect(user).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe('updateAccountPermissions validation (controller)', () => {
  it('rejects non-array payload with 422', async () => {
    const req = { params: { userId: 'u_001' }, body: { permissions: 'nope' } };
    const res = makeRes();
    await ctrl.updateAccountPermissions(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('rejects unknown feature_key with 422', async () => {
    const req = {
      params: { userId: 'u_001' },
      body: { permissions: [{ feature_key: 'orders.hack', granted: true }] },
    };
    const res = makeRes();
    await ctrl.updateAccountPermissions(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('rejects non-boolean granted with 422', async () => {
    const req = {
      params: { userId: 'u_001' },
      body: { permissions: [{ feature_key: 'orders.view', granted: 'yes' }] },
    };
    const res = makeRes();
    await ctrl.updateAccountPermissions(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('upserts valid items and returns merged permissions', async () => {
    const conn = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
    };
    pool.getConnection.mockResolvedValue(conn);

    // 1) user-exists check (updateAccountPermissions)
    query.mockResolvedValueOnce([[fakeUser()]]);
    // 2) getAccountPermissions after update: user row + stored perms
    query
      .mockResolvedValueOnce([[fakeUser()]])
      .mockResolvedValueOnce([[{ feature_key: 'orders.view', granted: 1 }]]);

    const req = {
      params: { userId: 'u_001' },
      body: { permissions: [{ feature_key: 'orders.view', granted: true }] },
    };
    const res = makeRes();
    await ctrl.updateAccountPermissions(req, res, vi.fn());

    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.query).toHaveBeenCalledWith(
      expect.stringContaining('ON DUPLICATE KEY UPDATE'),
      ['u_001', 'orders.view', 1]
    );
    expect(res.body.ok).toBe(true);
    expect(res.body.permissions).toHaveLength(ALL_FEATURES.length);
    expect(
      res.body.permissions.find((p) => p.feature_key === 'orders.view').granted
    ).toBe(true);
  });

  it('rolls back and rethrows on DB failure', async () => {
    const conn = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockRejectedValue(new Error('db down')),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
    };
    pool.getConnection.mockResolvedValue(conn);
    query.mockResolvedValueOnce([[fakeUser()]]);

    const req = {
      params: { userId: 'u_001' },
      body: { permissions: [{ feature_key: 'orders.view', granted: true }] },
    };
    const next = vi.fn();
    await ctrl.updateAccountPermissions(req, makeRes(), next);

    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('promote / revoke', () => {
  it('promote returns the updated user', async () => {
    query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[fakeUser({ is_promoted_admin: 1 })]]);

    const res = makeRes();
    await ctrl.promoteAccount({ params: { userId: 'u_001' } }, res, vi.fn());
    expect(res.body.ok).toBe(true);
    expect(res.body.user.is_promoted_admin).toBe(1);
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('SET is_promoted_admin = 1'),
      ['u_001']
    );
  });

  it('revoke returns 404 when user is gone', async () => {
    query.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const res = makeRes();
    await ctrl.revokeAccount({ params: { userId: 'missing' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('SET is_promoted_admin = 0'),
      ['missing']
    );
  });

  it('listAdminAccounts excludes owner and supports search', async () => {
    query.mockResolvedValueOnce([[fakeUser(), fakeUser({ id: 'u_002' })]]);
    const res = makeRes();
    await ctrl.listAdminAccounts({ query: { q: 'admin' } }, res, vi.fn());
    expect(res.body.items).toHaveLength(2);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('role != ?'),
      ['owner', '%admin%', '%admin%']
    );
  });
});
