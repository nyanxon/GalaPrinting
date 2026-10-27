/**
 * P0 /diag regression test.
 *
 * Uses dummy env vars so importing the Express app does not exit.
 * No DB connection is opened before a query is executed.
 */

import { describe, it, expect, afterAll, vi } from 'vitest';

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

import { createApp } from '../app.js';

let server;
let baseUrl;

async function start() {
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

describe('/diag', () => {
  it('returns only { ok: true } without environment details', async () => {
    await start();
    const res = await fetch(`${baseUrl}/diag`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it('no longer exposes /diag/log', async () => {
    const res = await fetch(`${baseUrl}/diag/log`);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
  });
});
