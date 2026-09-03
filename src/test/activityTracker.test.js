// Fitur Activity Log — Fase 2: client-side activity tracker (queue + global click capture).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the http client so we never make real network calls in tests.
vi.mock('../core/httpClient.js', () => ({
  api: { post: vi.fn() },
  getAccessToken: vi.fn(() => null),
  API_BASE: '',
}));

import * as tracker from '../utils/activityTracker.js';
import { api } from '../core/httpClient.js';

beforeEach(() => {
  vi.clearAllMocks();
  tracker.clearQueue();
  // Reset document between tests
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
  tracker.clearQueue();
});

describe('activityTracker — queue & flush', () => {
  it('flushes immediately when the queue reaches 20 events', () => {
    api.post.mockResolvedValue({ data: { ok: true } });
    for (let i = 0; i < 20; i++) tracker.track(`klik-${i}`, { pagePath: '/a' });
    expect(api.post).toHaveBeenCalledTimes(1);
    const [, body] = api.post.mock.calls[0];
    expect(body.events).toHaveLength(20);
  });

  it('does not flush before 20 events without the timer firing', () => {
    for (let i = 0; i < 5; i++) tracker.track(`a${i}`, {});
    expect(api.post).not.toHaveBeenCalled();
  });

  it('flushes after the interval elapses when events are queued', () => {
    vi.useFakeTimers();
    api.post.mockResolvedValue({ data: { ok: true } });
    tracker.track('satu', {});
    expect(api.post).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5100);
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('requeues events when the network call fails, but keeps retrying', () => {
    api.post.mockRejectedValue(new Error('network'));
    for (let i = 0; i < 20; i++) tracker.track(`x${i}`, {});
    // First flush attempted (and failed) → events requeued.
    expect(api.post).toHaveBeenCalledTimes(1);
    // A second flush carries the same events again.
    api.post.mockRejectedValue(new Error('network'));
    for (let i = 0; i < 20; i++) tracker.track(`y${i}`, {});
    expect(api.post).toHaveBeenCalledTimes(2);
  });

  it('track() captures pagePath, targetType, targetId and metadata', () => {
    api.post.mockResolvedValue({ data: { ok: true } });
    tracker.track('Hapus Order', {
      pagePath: '/admin/owner',
      targetType: 'order',
      targetId: 'ord-1',
      metadata: { deletedName: 'X' },
    });
    for (let i = 0; i < 19; i++) tracker.track(`filler${i}`, {});
    const ev = api.post.mock.calls[0][1].events[0];
    expect(ev.actionLabel).toBe('Hapus Order');
    expect(ev.pagePath).toBe('/admin/owner');
    expect(ev.targetType).toBe('order');
    expect(ev.targetId).toBe('ord-1');
    expect(ev.metadata).toEqual({ deletedName: 'X' });
  });
});

describe('activityTracker — global click listener & label resolution', () => {
  let cleanup;
  beforeEach(() => {
    cleanup = tracker.initGlobalClickListener(() => '/current');
  });
  afterEach(() => {
    if (cleanup) cleanup();
  });

  it('captures button clicks and uses visible text as the label', () => {
    document.body.innerHTML = `<button id="b">Cetak Nota</button>`;
    document.getElementById('b').click();
    api.post.mockResolvedValue({ data: { ok: true } });
    tracker.flush();
    expect(api.post).toHaveBeenCalledTimes(1);
    const ev = api.post.mock.calls[0][1].events[0];
    expect(ev.actionLabel).toBe('Cetak Nota');
    expect(ev.pagePath).toBe('/current');
  });

  it('prefers data-log-label over visible text', () => {
    document.body.innerHTML = `<button data-log-label="Ubah Status Order">Kirim</button>`;
    document.querySelector('button').click();
    api.post.mockResolvedValue({ data: { ok: true } });
    tracker.flush();
    expect(api.post.mock.calls[0][1].events[0].actionLabel).toBe('Ubah Status Order');
  });

  it('falls back to aria-label when no visible text is present', () => {
    document.body.innerHTML = `<button aria-label="Hapus Produk" style="width:0;height:0;font-size:0;padding:0;border:0;overflow:hidden"> </button>`;
    document.querySelector('button').click();
    api.post.mockResolvedValue({ data: { ok: true } });
    tracker.flush();
    expect(api.post.mock.calls[0][1].events[0].actionLabel).toBe('Hapus Produk');
  });

  it('skips elements marked with data-log-skip', () => {
    document.body.innerHTML = `<button data-log-skip>Jangan Log</button>`;
    document.querySelector('button').click();
    api.post.mockResolvedValue({ data: { ok: true } });
    tracker.flush();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('captures clicks on any element with data-log, even non-buttons', () => {
    document.body.innerHTML = `<div data-log data-log-label="Buka Produk" role="listitem">Item</div>`;
    document.querySelector('div').click();
    api.post.mockResolvedValue({ data: { ok: true } });
    tracker.flush();
    expect(api.post.mock.calls[0][1].events[0].actionLabel).toBe('Buka Produk');
  });
});
