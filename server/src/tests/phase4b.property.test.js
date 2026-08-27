// Phase 4b — Account creation, change password, must_change_password enforcement.

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

vi.mock('../utils/hash.js', () => ({
  hashPassword:    vi.fn(async (pw) => `hashed:${pw}`),
  comparePassword: vi.fn(async (plain, hash) => hash === `hashed:${plain}`),
}));

vi.mock('../utils/jwt.js', () => ({
  signAccessToken:   vi.fn(),
  verifyAccessToken: vi.fn(),
  signRefreshToken:  vi.fn(),
  verifyRefreshToken: vi.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { query } from '../db/connection.js';
import * as adminAccountsSvc from '../services/adminAccounts.service.js';
import * as accountsSvc from '../services/accounts.service.js';
import * as customerAuth from '../services/customerAuth.service.js';
import * as adminAuth from '../services/adminAuth.service.js';
import { authenticate } from '../middleware/auth.js';
import { verifyAccessToken } from '../utils/jwt.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = vi.fn().mockReturnThis();
  res.json   = vi.fn().mockImplementation((body) => { res.body = body; return res; });
  return res;
}

function staffReq(user = {}, path = '/api/orders') {
  return {
    user,
    originalUrl: path,
    headers: { authorization: 'Bearer fake-token' },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. createStaffAccount (adminAccounts.service)
// ═══════════════════════════════════════════════════════════════════════════════

describe('createStaffAccount', () => {
  it('inserts into users_admin with must_change_password=1 when email is free', async () => {
    // MySQL2 format: query() returns [rows, fields]
    query.mockResolvedValueOnce([[]]);   // email check — no existing row
    query.mockResolvedValueOnce([]);     // INSERT success
    query.mockResolvedValueOnce([[{     // findUserById return
      id: 'u-1', role: 'admin', name: 'A', email: 'a@test.com',
      phone: null, is_promoted_admin: 0, must_change_password: 1,
      is_email_verified: 0, avatar_url: null,
      created_at: '2025-01-01', updated_at: '2025-01-01', deleted_at: null,
    }]]);

    const result = await adminAccountsSvc.createStaffAccount({
      name: 'A', email: 'a@test.com', role: 'admin', password: 'pass123',
    });

    expect(result).not.toBeNull();
    expect(result.id).toBe('u-1');
    expect(result.must_change_password).toBe(1);
    // INSERT must be into users_admin with must_change_password = 1
    const insertCall = query.mock.calls[1];
    expect(insertCall[0]).toContain('must_change_password');
    expect(insertCall[0]).toContain('INSERT INTO users_admin');
  });

  it('rejects duplicate email with 409', async () => {
    query.mockResolvedValueOnce([[{ id: 'existing' }]]);

    await expect(
      adminAccountsSvc.createStaffAccount({
        name: 'A', email: 'dup@test.com', role: 'admin', password: 'pass123',
      })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects invalid role (not in STAFF_ROLES)', async () => {
    await expect(
      adminAccountsSvc.createStaffAccount({
        name: 'A', email: 'a@test.com', role: 'customer', password: 'pass123',
      })
    ).rejects.toMatchObject({ status: 422 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. createCustomerAccount (accounts.service)
// ═══════════════════════════════════════════════════════════════════════════════

describe('createCustomerAccount', () => {
  it('inserts into users_customer when email is free', async () => {
    query.mockResolvedValueOnce([[]]);         // email check
    query.mockResolvedValueOnce([]);           // INSERT
    query.mockResolvedValueOnce([[{            // SELECT back
      id: 'c-1', name: 'Cust', email: 'c@test.com', phone: null,
      is_email_verified: 0, avatar_url: null,
      created_at: '2025-01-01', updated_at: '2025-01-01', deleted_at: null,
    }]]);

    const result = await accountsSvc.createCustomerAccount({
      name: 'Cust', email: 'c@test.com', phone: '08123', password: 'pass123',
    });

    expect(result).not.toBeNull();
    expect(result.id).toBe('c-1');
    const insertCall = query.mock.calls[1];
    expect(insertCall[0]).toContain('INSERT INTO users_customer');
  });

  it('rejects duplicate email with 409', async () => {
    query.mockResolvedValueOnce([[{ id: 'existing' }]]);

    await expect(
      accountsSvc.createCustomerAccount({
        name: 'C', email: 'dup@test.com', phone: null, password: 'pass123',
      })
    ).rejects.toMatchObject({ status: 409 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. changePassword — customer
// ═══════════════════════════════════════════════════════════════════════════════

describe('changePassword — customer', () => {
  it('updates password_hash and invalidates refresh tokens', async () => {
    query.mockResolvedValueOnce([[{ id: 'c-1', password_hash: 'hashed:old' }]]); // SELECT user
    query.mockResolvedValueOnce([]);  // UPDATE password
    query.mockResolvedValueOnce([]);  // DELETE refresh_tokens

    const result = await customerAuth.changePassword('c-1', {
      currentPassword: 'old',
      newPassword: 'new123',
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain('berhasil');

    const updateCall = query.mock.calls[1];
    expect(updateCall[0]).toContain('UPDATE users_customer');
    expect(updateCall[0]).toContain('password_hash');
    expect(updateCall[1]).toContain('hashed:new123');
    expect(updateCall[1]).toContain('c-1');

    const deleteCall = query.mock.calls[2];
    expect(deleteCall[0]).toContain('DELETE FROM refresh_tokens');
    expect(deleteCall[1]).toContain('c-1');
  });

  it('rejects wrong current password with 401', async () => {
    query.mockResolvedValueOnce([[{ id: 'c-1', password_hash: 'hashed:correct' }]]);

    await expect(
      customerAuth.changePassword('c-1', {
        currentPassword: 'wrong',
        newPassword: 'new123',
      })
    ).rejects.toMatchObject({ status: 401 });
  });

  it('returns error when user not found', async () => {
    query.mockResolvedValueOnce([[]]);

    const result = await customerAuth.changePassword('nonexistent', {
      currentPassword: 'old',
      newPassword: 'new123',
    });

    expect(result.ok).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. changePassword — admin
// ═══════════════════════════════════════════════════════════════════════════════

describe('changePassword — admin', () => {
  it('updates password_hash, clears must_change_password, invalidates tokens', async () => {
    query.mockResolvedValueOnce([[{ id: 'a-1', password_hash: 'hashed:old' }]]);
    query.mockResolvedValueOnce([]);  // UPDATE
    query.mockResolvedValueOnce([]);  // DELETE refresh_tokens

    const result = await adminAuth.changePassword('a-1', {
      currentPassword: 'old',
      newPassword: 'new123',
    });

    expect(result.ok).toBe(true);

    const updateCall = query.mock.calls[1];
    expect(updateCall[0]).toContain('UPDATE users_admin');
    expect(updateCall[0]).toContain('must_change_password = 0');
    expect(updateCall[1]).toContain('hashed:new123');

    const deleteCall = query.mock.calls[2];
    expect(deleteCall[0]).toContain('DELETE FROM refresh_tokens');
    expect(deleteCall[1]).toContain('a-1');
  });

  it('rejects wrong current password with 401', async () => {
    query.mockResolvedValueOnce([[{ id: 'a-1', password_hash: 'hashed:correct' }]]);

    await expect(
      adminAuth.changePassword('a-1', {
        currentPassword: 'wrong',
        newPassword: 'new123',
      })
    ).rejects.toMatchObject({ status: 401 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. must_change_password enforcement (authenticate middleware)
// ═══════════════════════════════════════════════════════════════════════════════

describe('authenticate — must_change_password enforcement', () => {
  it('passes through for customer users (no DB check)', async () => {
    verifyAccessToken.mockReturnValue({
      sub: 'c-1', role: 'customer', name: 'C', email: 'c@test.com',
    });
    const next = vi.fn();
    const res = makeRes();
    const req = staffReq({ id: 'c-1', role: 'customer', name: 'C', email: 'c@test.com' });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('passes through for staff with must_change_password = 0', async () => {
    verifyAccessToken.mockReturnValue({
      sub: 'a-1', role: 'admin', name: 'A', email: 'a@test.com',
    });
    query.mockResolvedValueOnce([[{ must_change_password: 0 }]]);
    const next = vi.fn();
    const res = makeRes();
    const req = staffReq({ id: 'a-1', role: 'admin', name: 'A', email: 'a@test.com' });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('blocks staff with must_change_password = 1 on protected routes (403)', async () => {
    verifyAccessToken.mockReturnValue({
      sub: 'a-1', role: 'admin', name: 'A', email: 'a@test.com',
    });
    query.mockResolvedValueOnce([[{ must_change_password: 1 }]]);
    const next = vi.fn();
    const res = makeRes();
    const req = staffReq({ id: 'a-1', role: 'admin', name: 'A', email: 'a@test.com' }, '/api/orders');

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ mustChangePassword: true })
    );
  });

  it('allows /me even when must_change_password = 1', async () => {
    verifyAccessToken.mockReturnValue({
      sub: 'a-1', role: 'admin', name: 'A', email: 'a@test.com',
    });
    const next = vi.fn();
    const res = makeRes();
    const req = staffReq({ id: 'a-1', role: 'admin', name: 'A', email: 'a@test.com' }, '/api/auth/me');

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    // Exception path — no DB query
    expect(query).not.toHaveBeenCalled();
  });

  it('allows /change-password even when must_change_password = 1', async () => {
    verifyAccessToken.mockReturnValue({
      sub: 'a-1', role: 'admin', name: 'A', email: 'a@test.com',
    });
    const next = vi.fn();
    const res = makeRes();
    const req = staffReq({ id: 'a-1', role: 'admin', name: 'A', email: 'a@test.com' }, '/api/auth/change-password');

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('strips query string from path before checking exceptions', async () => {
    verifyAccessToken.mockReturnValue({
      sub: 'a-1', role: 'admin', name: 'A', email: 'a@test.com',
    });
    query.mockResolvedValueOnce([[{ must_change_password: 1 }]]);
    const next = vi.fn();
    const res = makeRes();
    const req = staffReq({ id: 'a-1', role: 'admin', name: 'A', email: 'a@test.com' }, '/api/orders?page=1');

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
