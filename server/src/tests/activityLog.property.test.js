// Fitur Activity Log — Fase 1: batch insert + JWT-derived actor resolution.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/env.js', () => ({
  config: {
    nodeEnv: 'test',
    db: { host: 'localhost', port: 3306, name: 'test', user: 'test', password: '' },
    jwt: { accessSecret: 'test-access', refreshSecret: 'test-refresh', accessExpiresIn: '15m', refreshExpiresIn: '7d' },
    bcryptRounds: 10,
    email: { resendApiKey: null, fromEmail: 'test@test.com', adminEmail: null, frontendUrl: 'http://localhost:5173' },
    isDev: false, isProd: false,
  },
}));

vi.mock('../db/connection.js', () => ({
  query: vi.fn(),
  pool: { getConnection: vi.fn() },
}));

vi.mock('../utils/jwt.js', () => ({
  verifyAccessToken:   vi.fn(),
  signAccessToken:     vi.fn(),
  signRefreshToken:    vi.fn(),
  verifyRefreshToken:  vi.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { query } from '../db/connection.js';
import * as svc from '../services/activityLog.service.js';
import * as ctrl from '../controllers/activityLog.controller.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { VALID_PERMISSION_KEYS } from '../controllers/accounts.controller.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = vi.fn().mockImplementation((code) => { res.statusCode = code; return res; });
  res.json = vi.fn().mockImplementation((body) => { res.body = body; return res; });
  return res;
}

function next(err) { return err; }

describe('activityLog.service — insertBatch (bulk insert)', () => {
  it('builds ONE multi-row INSERT and skips events without a label', async () => {
    query.mockResolvedValue([{ affectedRows: 1 }]);

    const inserted = await svc.insertBatch([
      { actor_type: 'customer', action_label: 'Buka Produk' },
      { actor_type: 'customer', action_label: '' },          // skipped
      { actor_type: 'customer', action_label: 'Tambah Keranjang', metadata: { id: 7 } },
    ]);

    expect(inserted).toBe(1);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/^INSERT INTO activity_logs/);
    // 2 valid events → 2 rows in a single statement (10 placeholders each)
    expect((sql.match(/\?/g) || []).length).toBe(20);
    expect(params).toHaveLength(20);
  });

  it('returns 0 without hitting the DB when events array is empty', async () => {
    const inserted = await svc.insertBatch([]);
    expect(inserted).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('mangles oversized metadata instead of failing the insert', async () => {
    query.mockResolvedValue([{ affectedRows: 1 }]);
    const big = { blob: 'x'.repeat(100000) };
    await svc.insertBatch([{ actor_type: 'admin', action_label: 'Aksi', metadata: big }]);
    expect(query).toHaveBeenCalledTimes(1);
    const [, params] = query.mock.calls[0];
    const metaJson = params[8];
    expect(JSON.parse(metaJson)).toHaveProperty('truncated', true);
  });

  it('truncates actor id/name/role and page path to column limits', async () => {
    query.mockResolvedValue([{ affectedRows: 1 }]);
    await svc.insertBatch([{
      actor_type: 'admin',
      actor_id: 'x'.repeat(100),
      actor_name: 'n'.repeat(500),
      actor_role: 'r'.repeat(100),
      action_label: 'L',
      page_path: 'p'.repeat(1000),
    }]);
    const [, params] = query.mock.calls[0];
    expect(params[1]).toHaveLength(36);   // actor_id CHAR(36)
    expect(params[2]).toHaveLength(120);  // actor_name VARCHAR(120)
    expect(params[3]).toHaveLength(30);   // actor_role VARCHAR(30)
    expect(params[5]).toHaveLength(255);  // page_path VARCHAR(255)
  });
});

describe('activityLog.controller — createBatch', () => {
  it('derives actor from JWT for a staff user (never from body)', async () => {
    query.mockResolvedValue([{ affectedRows: 1 }]);
    const req = {
      user: { id: 'staff-1', role: 'owner', name: 'Budi' },
      ip: '1.2.3.4',
      body: {
        events: [{ actionLabel: 'Hapus Produk', targetType: 'product', targetId: 'p1' }],
      },
    };
    const res = makeRes();
    await ctrl.createBatch(req, res, next);

    expect(res.body.ok).toBe(true);
    const [, params] = query.mock.calls[0];
    expect(params[0]).toBe('admin');          // actor_type from JWT role
    expect(params[1]).toBe('staff-1');        // actor_id from JWT
    expect(params[2]).toBe('Budi');           // actor_name from JWT
    expect(params[3]).toBe('owner');          // actor_role from JWT
  });

  it('attributes anonymous / not-logged-in users to customer with NULL actor', async () => {
    query.mockResolvedValue([{ affectedRows: 1 }]);
    const req = { user: null, ip: '9.9.9.9', body: { events: [{ actionLabel: 'Klik Home' }] } };
    const res = makeRes();
    await ctrl.createBatch(req, res, next);

    const [, params] = query.mock.calls[0];
    expect(params[0]).toBe('customer');
    expect(params[1]).toBeNull();             // actor_id NULL
    expect(params[2]).toBeNull();             // actor_name NULL
  });

  it('rejects batch larger than the cap', async () => {
    const big = { events: Array.from({ length: 101 }, () => ({ actionLabel: 'x' })) };
    const res = makeRes();
    await ctrl.createBatch({ user: null, ip: '1.1.1.1', body: big }, res, next);
    expect(res.statusCode).toBe(422);
    expect(query).not.toHaveBeenCalled();
  });

  it('never lets a save failure break the client request', async () => {
    query.mockRejectedValue(new Error('DB down'));
    const req = { user: null, ip: '1.1.1.1', body: { events: [{ actionLabel: 'A' }] } };
    const res = makeRes();
    await ctrl.createBatch(req, res, next);
    expect(res.statusCode).toBe(200);
    expect(res.body.skipped).toBe(true);
  });
});

describe('optionalAuth — resolve identity when present, never block when absent', () => {
  it('attaches req.user for a valid token', () => {
    verifyAccessToken.mockReturnValue({ sub: 'u1', role: 'admin', name: 'Ana' });
    const req = { headers: { authorization: 'Bearer tok' } };
    const calledNext = vi.fn();
    optionalAuth(req, {}, calledNext);
    expect(req.user).toEqual({ id: 'u1', role: 'admin', name: 'Ana', email: undefined });
    expect(calledNext).toHaveBeenCalledTimes(1);
  });

  it('passes through with no req.user when token is invalid', () => {
    verifyAccessToken.mockImplementation(() => { throw new Error('bad'); });
    const req = { headers: { authorization: 'Bearer bad' } };
    const calledNext = vi.fn();
    optionalAuth(req, {}, calledNext);
    expect(req.user).toBeUndefined();
    expect(calledNext).toHaveBeenCalledTimes(1);
  });

  it('passes through when no Authorization header is present', () => {
    const req = { headers: {} };
    const calledNext = vi.fn();
    optionalAuth(req, {}, calledNext);
    expect(req.user).toBeUndefined();
    expect(calledNext).toHaveBeenCalledTimes(1);
  });
});

describe('activityLog — LOG nav permission key is registered server-side', () => {
  it('VALID_PERMISSION_KEYS includes "log" so the LOG nav item survives explicit permission sets', () => {
    expect(VALID_PERMISSION_KEYS).toContain('log');
  });
});

describe('activityLog.service — per-reader read-state (Fase 5)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('markLogRead inserts IGNORE and reports whether it actually created a row', async () => {
    query.mockResolvedValue([{ affectedRows: 1 }]);
    await expect(svc.markLogRead('42', 'reader-1')).resolves.toBe(true);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/INSERT IGNORE INTO activity_log_reads/);
    expect(params).toEqual(['42', 'reader-1']);

    query.mockResolvedValue([{ affectedRows: 0 }]);
    await expect(svc.markLogRead('42', 'reader-1')).resolves.toBe(false);
  });

  it('markLogRead is a no-op guard when ids are missing', async () => {
    await expect(svc.markLogRead(null, 'reader-1')).resolves.toBe(false);
    await expect(svc.markLogRead('1', null)).resolves.toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it('markAllRead copies every existing log id as read for the reader', async () => {
    query.mockResolvedValue([{ affectedRows: 5 }]);
    await expect(svc.markAllRead('reader-1')).resolves.toBe(true);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/INSERT IGNORE INTO activity_log_reads/);
    expect(sql).toMatch(/SELECT al\.id, \? FROM activity_logs al/);
    expect(params).toEqual(['reader-1']);
  });

  it('unreadCountFor counts logs with no read row for the reader', async () => {
    query.mockResolvedValue([[{ total: 7 }]]);
    await expect(svc.unreadCountFor('reader-1')).resolves.toBe(7);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/activity_log_reads alr/);
    expect(params).toEqual(['reader-1']);

    query.mockResolvedValue([[{ total: 0 }]]);
    await expect(svc.unreadCountFor('reader-1')).resolves.toBe(0);
  });

  it('listLogs LEFT JOINs the read table and exposes the read flag', async () => {
    query.mockResolvedValueOnce([[{ total: 1 }]])           // count
         .mockResolvedValueOnce([[{
            id: 1, actor_type: 'admin', actor_id: 'a', actor_name: 'A',
            actor_role: 'owner', action_label: 'Aksi', page_path: '/log',
            target_type: null, target_id: null, metadata: null, ip_address: '1.1.1.1',
            is_read: 0, created_at: '2026-08-28 10:00:00',
          }]]);
    const res = await svc.listLogs({ page: 1, limit: 20, readerUserId: 'reader-1' });
    expect(res.items[0].read).toBe(false);
    const selectSql = query.mock.calls[1][0];
    const selectParams = query.mock.calls[1][1];
    expect(selectSql).toMatch(/LEFT JOIN activity_log_reads alr/);
    expect(selectParams[0]).toBe('reader-1');
  });
});

describe('activityLog.service — auto-retention setting + purge (Fase 5)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('getRetentionSetting defaults to OFF when no row exists', async () => {
    query.mockResolvedValue([[]]);
    await expect(svc.getRetentionSetting()).resolves.toEqual({ months: 0, enabled: false });
  });

  it('setRetentionSetting upserts the value and reflects enabled', async () => {
    query.mockResolvedValue([{ affectedRows: 1 }]);
    query.mockResolvedValueOnce([[]]); // getRetentionSetting returns default... then set
    await svc.setRetentionSetting(3);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/ON DUPLICATE KEY UPDATE/);
    expect(params).toEqual(['activity_log_retention_months', '3']);
  });

  it('monthsAgoCutoff yields a UTC YYYY-MM-DD HH:MM:SS string', () => {
    const s = svc.monthsAgoCutoff(3);
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('purgeOldLogs is a no-op when retention is OFF', async () => {
    query.mockResolvedValue([[]]); // getRetentionSetting -> no row -> OFF
    await expect(svc.purgeOldLogs()).resolves.toBe(0);
    expect(query).toHaveBeenCalledTimes(1); // only the setting read, no DELETE
  });

  it('purgeOldLogs deletes old rows when retention is ON', async () => {
    query.mockResolvedValueOnce([[{ setting_value: '3' }]])   // getRetentionSetting
         .mockResolvedValueOnce([{ affectedRows: 99 }]);       // DELETE
    await expect(svc.purgeOldLogs()).resolves.toBe(99);
    const [sql] = query.mock.calls[1];
    expect(sql).toMatch(/DELETE FROM activity_logs WHERE created_at < \?/);
  });
});
