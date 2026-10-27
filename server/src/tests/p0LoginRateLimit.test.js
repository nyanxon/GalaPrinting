/**
 * P0 login rate-limit regression test.
 *
 * The controller is mocked, so no DB is required.
 * Verify the same limit against the real login flow in staging.
 */

import { describe, it, expect, vi, afterAll } from 'vitest';
import express from 'express';

vi.mock('../db/connection.js', () => ({ query: vi.fn() }));
vi.mock('../utils/jwt.js', () => ({ verifyAccessToken: vi.fn() }));

vi.mock('../controllers/auth.controller.js', () => {
  const ok = (_req, res) => res.json({ ok: true });
  return {
    register: ok,
    login: ok,
    adminLogin: ok,
    refresh: ok,
    logout: ok,
    me: ok,
    changePassword: ok,
    verifyEmail: ok,
    resendVerification: ok,
    forgotPassword: ok,
    resetPassword: ok,
    staffForgotPassword: ok,
    staffResetPassword: ok,
  };
});

import authRoutes from '../routes/auth.routes.js';

let server;
let baseUrl;

async function start() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

describe('login limiter', () => {
  it('returns 429 on the 11th attempt in the window', async () => {
    await start();
    const payload = JSON.stringify({ email: 'User@Example.com', password: 'secret' });
    const headers = { 'content-type': 'application/json' };

    const statuses = [];
    for (let i = 0; i < 10; i += 1) {
      const res = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers, body: payload });
      statuses.push(res.status);
    }
    const eleventh = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers, body: payload });

    expect(statuses).toEqual(Array(10).fill(200));
    expect(eleventh.status).toBe(429);
    const body = await eleventh.json();
    expect(body.message).toBe('Terlalu banyak percobaan. Coba lagi nanti.');
  });
});
