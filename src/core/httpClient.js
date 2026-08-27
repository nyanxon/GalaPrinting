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

export const USE_BACKEND = import.meta.env.VITE_USE_BACKEND === 'true';
export const API_BASE = import.meta.env.VITE_API_URL || '';

export function resolveApiUrl(path) {
  if (!path || typeof path !== 'string') return null;
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  return `${API_BASE}${path.startsWith('/') ? path : '/' + path}`;
}

// ---------------------------------------------------------------------------
// In-memory access token storage
// ---------------------------------------------------------------------------

/** @type {string|null} */
let _accessToken = null;

export function setAccessToken(token) {
  _accessToken = token;
}

export function getAccessToken() {
  return _accessToken;
}

export function clearSession() {
  _accessToken = null;
  window.dispatchEvent(new CustomEvent('gala:session-expired'));
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

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
// Refresh mutex — satu shared Promise untuk semua concurrent refresh attempts.
//
// ROOT CAUSE FIX: tanpa mutex ini, jika 2+ request 401 tiba bersamaan
// (misal React StrictMode double-mount, atau multiple components mount
// pada saat yang sama saat page refresh), masing-masing akan mencoba
// refresh sendiri-sendiri. Request kedua memakai refresh token yang sudah
// di-rotate oleh request pertama → backend deteksi "token reuse" →
// hapus seluruh family → user ter-logout.
//
// Dengan mutex: hanya 1 refresh request yang dikirim. Yang lain menunggu
// hasil dari request yang sama. Token lama hanya dipakai sekali.
// ---------------------------------------------------------------------------

/** Promise refresh yang sedang berjalan. Null jika tidak ada. */
let _refreshPromise = null;

/**
 * Jalankan satu refresh request. Jika sudah ada yang berjalan, kembalikan
 * promise yang sama — tidak membuat request baru.
 *
 * @returns {Promise<string>} access token baru
 */
export function performRefresh() {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = axios
    .post('/api/auth/refresh', {}, { withCredentials: true })
    .then((res) => {
      const newToken = res.data.accessToken;
      if (!newToken) throw new Error('No token in refresh response');
      setAccessToken(newToken);
      // Beritahu SocketProvider untuk reconnect dengan token baru
      window.dispatchEvent(new CustomEvent('gala:token-refreshed', { detail: { token: newToken } }));
      return newToken;
    })
    .catch((err) => {
      // Reset agar attempt berikutnya bisa mencoba lagi
      _refreshPromise = null;
      throw err;
    })
    .finally(() => {
      // Setelah selesai (sukses atau gagal), reset agar refresh berikutnya
      // bisa berjalan normal (misal 15 menit kemudian access token expired lagi)
      _refreshPromise = null;
    });

  return _refreshPromise;
}

// ---------------------------------------------------------------------------
// 401 interceptor — auto-refresh → retry → logout on failure
// ---------------------------------------------------------------------------

/** Whether a token refresh is currently in flight (untuk pending queue). */
let isRefreshing = false;

/**
 * @type {Array<{ resolve: Function, reject: Function, config: import('axios').InternalAxiosRequestConfig }>}
 */
let pendingQueue = [];

function flushQueue(newToken, error) {
  pendingQueue.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
    } else {
      config.headers['Authorization'] = `Bearer ${newToken}`;
      resolve(api(config));
    }
  });
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalConfig = error.config;

    // must_change_password enforcement — staff account must change password first
    if (error.response?.status === 403 && error.response?.data?.mustChangePassword) {
      window.dispatchEvent(new CustomEvent('gala:must-change-password'));
      return Promise.reject(error);
    }

    // Only handle 401 errors
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Avoid infinite loops on refresh endpoint itself
    if (originalConfig?.url?.includes('/api/auth/refresh')) {
      isRefreshing = false;
      flushQueue(null, new Error('Session expired'));
      if (_accessToken) clearSession();
      return Promise.reject(error);
    }

    // Unauthenticated request (no token in memory) — don't attempt refresh
    if (!_accessToken) {
      return Promise.reject(error);
    }

    // Queue concurrent requests during refresh
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject, config: originalConfig });
      });
    }

    isRefreshing = true;

    try {
      // Gunakan mutex performRefresh() — tidak membuat request duplikat
      const newToken = await performRefresh();

      originalConfig.headers['Authorization'] = `Bearer ${newToken}`;
      flushQueue(newToken, null);

      return api(originalConfig);
    } catch (refreshError) {
      flushQueue(null, refreshError);
      clearSession();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

