/**
 * core/httpClient.js — Centralized HTTP client
 *
 * Controls whether the service layer calls the real backend API or
 * continues using the localStorage-backed mock implementations.
 *
 * Set VITE_USE_BACKEND=true in your .env to enable backend mode.
 *
 * Requirements: 16.2, 16.3, 16.4, 16.5
 */

import axios from 'axios';

// ---------------------------------------------------------------------------
// Feature flag — read once at module load time
// ---------------------------------------------------------------------------

/**
 * When true, all service files call the backend API.
 * When false (default), services use localStorage implementations unchanged.
 *
 * Requirement 16.2
 */
export const USE_BACKEND = import.meta.env.VITE_USE_BACKEND === 'true';
export const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Resolve a backend-relative path to a full URL when needed.
 * If the path is already absolute or a data URI, it is returned unchanged.
 * When no VITE_API_URL is configured, relative paths stay relative for same-origin routing.
 *
 * @param {string|null|undefined} path
 * @returns {string|null}
 */
export function resolveApiUrl(path) {
  if (!path || typeof path !== 'string') return null;
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  return `${API_BASE}${path.startsWith('/') ? path : '/' + path}`;
}

// ---------------------------------------------------------------------------
// In-memory access token storage
// The token is intentionally NOT stored in localStorage to reduce XSS risk.
// ---------------------------------------------------------------------------

/** @type {string|null} */
let _accessToken = null;

/**
 * Store the access token in memory.
 * Call this after a successful login or token refresh.
 *
 * Requirement 16.3
 * @param {string} token
 */
export function setAccessToken(token) {
  _accessToken = token;
}

/**
 * Return the current in-memory access token, or null if not authenticated.
 * Used by service modules to determine whether the user is logged in.
 *
 * @returns {string|null}
 */
export function getAccessToken() {
  return _accessToken;
}

/**
 * Clear the in-memory access token and dispatch a session-expired event.
 * Call this on logout or when a token refresh fails.
 * Navigation is handled by AuthNavigationHandler inside the React Router tree.
 *
 * Requirement 16.5
 */
export function clearSession() {
  _accessToken = null;
  window.dispatchEvent(new CustomEvent('gala:session-expired'));
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

/**
 * Pre-configured axios instance for all backend API calls.
 * - baseURL defaults to VITE_API_URL or `/api` for same-origin backend routing
 * - withCredentials: true so the HttpOnly refresh cookie is sent automatically
 *
 * Requirement 16.3
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Request interceptor — attach Authorization header
// ---------------------------------------------------------------------------

api.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers['Authorization'] = `Bearer ${_accessToken}`;
  }
  return config;
});

// ---------------------------------------------------------------------------
// 401 interceptor — auto-refresh → retry → logout on failure
//
// Design:
//   - On 401: if a refresh is already in flight, queue the request.
//   - Otherwise: attempt one refresh via POST /api/auth/refresh.
//   - On refresh success: update stored token, flush the queue, retry original.
//   - On refresh failure: reject all queued requests, call clearSession().
//
// Requirements: 16.4, 16.5
// ---------------------------------------------------------------------------

/** Whether a token refresh is currently in flight. */
let isRefreshing = false;

/**
 * Requests that arrived while a refresh was in flight.
 * Each entry holds resolve/reject callbacks and the original axios config.
 * @type {Array<{ resolve: Function, reject: Function, config: import('axios').InternalAxiosRequestConfig }>}
 */
let pendingQueue = [];

/**
 * Flush the pending queue after a refresh attempt.
 * @param {string|null} newToken  New access token on success, null on failure.
 * @param {Error|null}  error     Error to reject with on failure.
 */
function flushQueue(newToken, error) {
  pendingQueue.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
    } else {
      // Attach the new token and retry
      config.headers['Authorization'] = `Bearer ${newToken}`;
      resolve(api(config));
    }
  });
  pendingQueue = [];
}

api.interceptors.response.use(
  // Pass through successful responses unchanged
  (response) => response,

  async (error) => {
    const originalConfig = error.config;

    // Only handle 401 errors; let everything else propagate
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Avoid infinite loops: if the failing request was itself the refresh call,
    // clear the session immediately without queuing.
    if (originalConfig?.url?.includes('/api/auth/refresh')) {
      isRefreshing = false;
      flushQueue(null, new Error('Session expired'));
      // Only redirect if we actually had a session (token was in memory)
      if (_accessToken) clearSession();
      return Promise.reject(error);
    }

    // If there was never an access token in memory, this is an unauthenticated
    // request (e.g. getCurrentUser on page load). Don't attempt a refresh —
    // just reject so the caller can handle it gracefully.
    if (!_accessToken) {
      return Promise.reject(error);
    }

    // If a refresh is already in flight, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject, config: originalConfig });
      });
    }

    // Start a refresh
    isRefreshing = true;

    try {
      // POST /api/auth/refresh — the HttpOnly cookie is sent automatically
      // because withCredentials: true is set on the instance.
      const { data } = await axios.post(
        '/api/auth/refresh',
        {},
        { withCredentials: true },
      );

      const newToken = data.accessToken;
      setAccessToken(newToken);

      // Retry the original request with the new token
      originalConfig.headers['Authorization'] = `Bearer ${newToken}`;

      // Flush all queued requests with the new token
      flushQueue(newToken, null);

      return api(originalConfig);
    } catch (refreshError) {
      // Refresh failed — reject all queued requests and clear the session
      flushQueue(null, refreshError);
      clearSession();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

