// Feature: dynamic-permissions — Step 6 trial wiring.
// Proves GET /api/export/database now runs checkFeature('export.database')
// BESIDE requireRole, with the decision table:
//   - not promoted admin (legacy account)         → 200 (legacy role system owns it)
//   - promoted admin, no grant / denied grant      → 403
//   - promoted admin, granted                      → 200
//   - wrong role (cashier) even if not promoted    → 403 (requireRole still active)

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { createServer } from 'http';

vi.mock('../db/connection.js', () => ({
  query: vi.fn(),
}));

vi.mock('../config/env.js', () => ({
  config: {
    uploadDir: './uploads',
    clientOrigin: 'http://localhost:5173',
    nodeEnv: 'test',
  },
}));

const { currentUser } = vi.hoisted(() => ({ currentUser: { value: null } }));

vi.mock('../middleware/auth.js', () => ({
  authenticate: (req, _res, next) => {
    req.user = currentUser.value;
    next();
  },
}));

import { query } from '../db/connection.js';
import exportRoutes from '../routes/export.routes.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('GET /api/export/database — checkFeature wiring', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/export', exportRoutes);
    app.use(errorHandler);
    await new Promise((resolve) => {
      server = createServer(app).listen(0, resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    currentUser.value = null;
    query.mockReset();
    // Default for the exportDatabase controller's per-table SELECTs.
    query.mockResolvedValue([[{ _sample: 1 }]]);
  });

  async function fetchDatabase() {
    return fetch(`${baseUrl}/api/export/database`, {
      headers: { Authorization: 'Bearer test-token' },
    });
  }

  it('legacy account (not promoted) keeps working — 200', async () => {
    query.mockResolvedValueOnce([[{ is_promoted_admin: 0 }]]);
    currentUser.value = { id: 'u_admin', role: 'admin' };

    const res = await fetchDatabase();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.tables).toBeTypeOf('object');
    // Controller ran its per-table queries after checkFeature passed through.
    expect(query).toHaveBeenCalledTimes(1 + Object.keys(body.tables).length);
    // checkFeature did look up is_promoted_admin first.
    expect(query.mock.calls[0][0]).toContain('is_promoted_admin');
  });

  it('promoted admin WITHOUT grant is rejected — 403', async () => {
    query
      .mockResolvedValueOnce([[{ is_promoted_admin: 1 }]])
      .mockResolvedValueOnce([[]]);
    currentUser.value = { id: 'u_promoted', role: 'admin' };

    const res = await fetchDatabase();

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.message).toContain('tidak memiliki akses');
    // Controller must never run: only the two checkFeature queries happen.
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('promoted admin WITH grant is allowed — 200', async () => {
    query
      .mockResolvedValueOnce([[{ is_promoted_admin: 1 }]])
      .mockResolvedValueOnce([[{ granted: 1 }]]);
    currentUser.value = { id: 'u_promoted', role: 'owner' };

    const res = await fetchDatabase();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(query).toHaveBeenCalledTimes(2 + Object.keys(body.tables).length);
  });

  it('requireRole still guards: cashier is rejected even if not promoted', async () => {
    currentUser.value = { id: 'u_cashier', role: 'cashier' };

    const res = await fetchDatabase();

    expect(res.status).toBe(403);
    // Only one query would be allowed past requireRole; requireRole blocks
    // before checkFeature ever queries the DB.
    expect(query).not.toHaveBeenCalled();
  });
});
