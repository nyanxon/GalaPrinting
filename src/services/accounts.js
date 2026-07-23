/**
 * accounts.js — Frontend service for Account management API.
 *
 * All endpoints are owner-only (GET/PUT /api/admin/accounts).
 */

import { api } from '../core/httpClient.js';

/**
 * List all accounts with pagination, search, and role filter.
 *
 * @param {{ page?: number, limit?: number, q?: string, role?: string }} params
 * @returns {Promise<object>} — { items, total, page, limit, totalPages }
 */
export async function listAccounts({ page, limit, q, role } = {}) {
  const params = new URLSearchParams();
  if (page)  params.set('page', String(page));
  if (limit) params.set('limit', String(limit));
  if (q)     params.set('q', q);
  if (role)  params.set('role', role);

  const qs = params.toString();
  const res = await api.get(`/api/admin/accounts${qs ? '?' + qs : ''}`);
  return res.data;
}

/**
 * Get a single account with permissions.
 *
 * @param {string} id
 * @returns {Promise<{ user: object, permissions: string[] }>}
 */
export async function getAccount(id) {
  const res = await api.get(`/api/admin/accounts/${id}`);
  return res.data.data;
}

/**
 * Update an account's role and permissions.
 *
 * @param {string} id
 * @param {{ role: string, permissions: string[] }} data
 * @returns {Promise<{ user: object, permissions: string[] }>}
 */
export async function updateAccount(id, data) {
  const res = await api.put(`/api/admin/accounts/${id}`, data);
  return res.data.data;
}
