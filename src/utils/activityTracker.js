/**
 * utils/activityTracker.js — Global, fire-and-forget activity logging.
 *
 * Captures ALL button clicks app-wide from a single central point (event
 * delegation), queues them in memory, and flushes them to
 * POST /api/activity-log/batch in bulk — either every FLUSH_INTERVAL_MS or
 * as soon as MAX_QUEUE events pile up, whichever comes first.
 *
 * On page close (pagehide/beforeunload) the remaining queue is sent with
 * navigator.sendBeacon() so nothing is lost during refresh/navigation.
 *
 * This module NEVER touches the React tree and must never block rendering;
 * every public function is best-effort and swallows errors.
 */

import { api, getAccessToken, API_BASE } from '../core/httpClient.js';

const FLUSH_INTERVAL_MS = 5000;
const MAX_QUEUE = 20;

/** @type {Array<object>} */
let queue = [];

/** Timers */
let intervalTimer = null;

/** Current effective page path (updated by the provider on each navigation). */
let currentPagePath = '';

let sendBeaconSupported = typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function';

/**
 * Internal: append an in-flight event to the queue and maybe trigger a flush.
 * @param {object} event
 */
function push(event) {
  if (!event || !event.actionLabel) return;
  queue.push(event);
  if (queue.length >= MAX_QUEUE) {
    flush();
  } else if (!intervalTimer) {
    startInterval();
  }
}

/**
 * Internal: start the 5s interval that flushes whatever is queued.
 */
function startInterval() {
  if (intervalTimer) return;
  intervalTimer = setInterval(() => {
    if (queue.length > 0) flush();
    else stopIntervalIfEmpty();
  }, FLUSH_INTERVAL_MS);
}

function stopIntervalIfEmpty() {
  if (queue.length === 0 && intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}

/**
 * Public: record an activity.
 * @param {string} actionLabel - human-readable description, e.g. "Cetak Resi"
 * @param {object} [meta]
 * @param {string} [meta.pagePath]  - overrides the tracked current page
 * @param {string} [meta.targetType]
 * @param {string} [meta.targetId]
 * @param {object} [meta.metadata]
 */
export function track(actionLabel, meta = {}) {
  const evt = {
    actionLabel: String(actionLabel || '').slice(0, 255),
    pagePath: (meta.pagePath || currentPagePath || null),
    targetType: meta.targetType || null,
    targetId: meta.targetId || null,
    metadata: meta.metadata || null,
    clientTimestamp: new Date().toISOString(),
  };
  push(evt);
}

/**
 * Public: send everything currently queued.
 * Fire-and-forget — never awaits in a render path.
 */
export function flush() {
  const batch = queue;
  queue = [];
  stopIntervalIfEmpty();
  if (batch.length === 0) return;

  // Send synchronously over axios so the Authorization header is attached and
  // the server can attribute the actor from the JWT (never from the body).
  api
    .post('/api/activity-log/batch', { events: batch })
    .catch(() => {
      // Requeue on transient network failure so the events are not silently lost.
      // Cap the size to avoid unbounded growth.
      if (queue.length < MAX_QUEUE * 10) {
        queue = batch.concat(queue);
      }
    });
}

/**
 * Public: silently discard anything queued (e.g. on logout we do not want the
 * "log out" click itself to be re-attributed to the next session).
 */
export function clearQueue() {
  queue = [];
  stopIntervalIfEmpty();
}

/**
 * Public: set the current route path without logging anything.
 * @param {string} path
 */
export function setPagePath(path) {
  currentPagePath = typeof path === 'string' ? path : '';
}

/**
 * Public: flush the remaining queue on page close using sendBeacon.
 * sendBeacon cannot add custom headers, so the access token is passed as a
 * query param (over HTTPS) so the server can still attribute the actor.
 */
export function flushOnExit() {
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];

  if (sendBeaconSupported) {
    try {
      const auth = getAccessToken();
      // sendBeacon cannot set custom headers → pass the token as a query param
      // (over HTTPS) so the server can still attribute the actor.
      const qs = auth ? `?access_token=${encodeURIComponent(auth)}` : '';
      const payload = new Blob([JSON.stringify({ events: batch })], { type: 'application/json' });
      navigator.sendBeacon(`${API_BASE}/api/activity-log/batch${qs}`, payload);
    } catch {
      /* best effort — nothing more we can do */
    }
    return;
  }

  // Fallback for environments without sendBeacon: best-effort fetch with the
  // auth header. May be cancelled by the browser on unload, but worth trying.
  try {
    const auth = getAccessToken();
    fetch(`${API_BASE}/api/activity-log/batch`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}

/**
 * Public: register the one-and-only global click listener (event delegation).
 * Call once from the provider. Returns an unsubscribe function.
 *
 * @param {() => string} [getPagePath] - optional getter for current route path
 * @returns {() => void}
 */
export function initGlobalClickListener(getPagePath) {
  const handler = (event) => {
    const el = closestLoggable(event.target);
    if (!el) return;

    const actionLabel = resolveLabel(el);
    if (!actionLabel) return;

    const current = getPagePath ? getPagePath() : currentPagePath;
    track(actionLabel, { pagePath: current });
  };

  // Capture phase so we fire even if a child stops propagation.
  document.addEventListener('click', handler, true);
  return () => document.removeEventListener('click', handler, true);
}

/**
 * Walk up from the click target to find a loggable element:
 * a <button>, an <a>/[role=button] styled as a button, or anything with a
 * data-log attribute. Respects data-log-skip on the element or an ancestor.
 */
function closestLoggable(node) {
  let el = node && node.nodeType === 1 ? node : node && node.parentElement;
  while (el && el !== document) {
    if (el.hasAttribute && el.hasAttribute('data-log-skip')) return null;
    if (isLoggable(el)) return el;
    el = el.parentElement;
  }
  return null;
}

function isLoggable(el) {
  if (el.hasAttribute && el.hasAttribute('data-log')) return true;
  const tag = el.tagName && el.tagName.toLowerCase();
  if (tag === 'button') return true;
  if (tag === 'a') {
    const role = el.getAttribute && el.getAttribute('role');
    return role === 'button';
  }
  return false;
}

/**
 * Determine the action label with this priority:
 *   1. data-log-label attribute (explicit)
 *   2. visible text / aria-label
 *   3. generic fallback (element tag + closest meaningful selector)
 */
function resolveLabel(el) {
  const explicit = el.getAttribute && el.getAttribute('data-log-label');
  if (explicit && explicit.trim()) return explicit.trim().slice(0, 255);

  const aria = el.getAttribute && el.getAttribute('aria-label');
  if (aria && aria.trim()) return aria.trim().slice(0, 255);

  const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
  if (text) return text.slice(0, 255);

  return fallbackLabel(el);
}

function fallbackLabel(el) {
  const tag = el.tagName ? el.tagName.toLowerCase() : 'element';
  const id = el.id ? `#${el.id}` : '';
  const name = el.getAttribute ? el.getAttribute('name') : null;
  const cls = el.className && typeof el.className === 'string' ? el.className.split(/\s+/)[0] : null;
  return `Klik ${tag}${id}${name ? `[${name}]` : cls ? `.${cls}` : ''}`.slice(0, 255);
}

/**
 * Public: safe global init used by the provider (idempotent).
 * Returns an unsubscribe that also clears the interval timer.
 */
export function initActivityTracker(getPagePath) {
  const unsubscribeClickListener = initGlobalClickListener(getPagePath);
  window.addEventListener('pagehide', flushOnExit);
  window.addEventListener('beforeunload', flushOnExit);
  return () => {
    unsubscribeClickListener();
    window.removeEventListener('pagehide', flushOnExit);
    window.removeEventListener('beforeunload', flushOnExit);
    if (intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = null;
    }
  };
}
