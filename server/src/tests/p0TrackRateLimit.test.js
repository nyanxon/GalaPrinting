/**
 * P0 public order-tracking rate-limit regression test.
 *
 * Uses dummy env vars so importing the Express app does not exit.
 * Requests stop before any DB query because the phone parameter is missing.
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

describe('public tracking limiter', () => {
  it('returns 429 on the 11th lookup in the window', async () => {
    await start();
    const url = `${baseUrl}/api/orders/track?orderNumber=GALA-1`;

    const statuses = [];
    for (let i = 0; i < 10; i += 1) {
      const res = await fetch(url);
      statuses.push(res.status);
    }
    const eleventh = await fetch(url);

    expect(statuses).toEqual(Array(10).fill(404));
    expect(eleventh.status).toBe(429);
  });
});
