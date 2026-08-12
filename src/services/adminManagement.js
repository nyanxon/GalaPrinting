/**
 * adminManagement.js — Frontend service for the dynamic permission system.
 *
 * Backs the Owner "Kelola Admin & Permission" pages. All endpoints are
 * owner-only and map 1:1 to Step 3 of the permission system:
 *   - GET  /api/admin-accounts                 (promotable accounts)
 *   - POST /api/admin-accounts/:id/promote
 *   - POST /api/admin-accounts/:id/revoke
 *   - GET  /api/features                       (feature catalog per category)
 *   - GET  /api/admin-accounts/:id/permissions (full granted list)
 *   - PUT  /api/admin-accounts/:id/permissions (upsert granted list)
 */

import { api } from '../core/httpClient.js';

/**
 * List every account the Owner can promote (non-owner staff).
 *
 * @param {{ q?: string }} [params] — optional name/email search filter
 * @returns {Promise<Array<object>>} — account rows incl. is_promoted_admin
 */
export async function listAdminAccounts({ q } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  const qs = params.toString();
  const res = await api.get(`/api/admin-accounts${qs ? '?' + qs : ''}`);
  return res.data.items || [];
}

/**
 * Promote an account to dynamic admin (is_promoted_admin = true).
 *
 * @param {string} userId
 * @returns {Promise<object>} updated user row
 */
export async function promoteAccount(userId) {
  const res = await api.post(`/api/admin-accounts/${userId}/promote`);
  return res.data.user;
}

/**
 * Revoke dynamic admin status (is_promoted_admin = false).
 * Permissions are kept, just deactivated — so re-promotion restores them.
 *
 * @param {string} userId
 * @returns {Promise<object>} updated user row
 */
export async function revokeAccount(userId) {
  const res = await api.post(`/api/admin-accounts/${userId}/revoke`);
  return res.data.user;
}

/**
 * Feature catalog grouped by category (from config/features.js).
 *
 * @returns {Promise<Array<{ category: string, features: Array<{ key: string, label: string, description: string|null }> }>>}
 */
export async function listFeatures() {
  const res = await api.get('/api/features');
  return res.data.categories || [];
}

/**
 * Full permission list for one account — every registered feature included,
 * granted=false when never explicitly set.
 *
 * @param {string} userId
 * @returns {Promise<{ user: object|null, permissions: Array<{ feature_key: string, label: string, category: string, granted: boolean }> }>}
 */
export async function getAccountPermissions(userId) {
  const res = await api.get(`/api/admin-accounts/${userId}/permissions`);
  return res.data;
}

/**
 * Upsert the granted set for one account.
 *
 * @param {string} userId
 * @param {Array<{ feature_key: string, granted: boolean }>} permissions
 * @returns {Promise<object>} updated { user, permissions }
 */
export async function updateAccountPermissions(userId, permissions) {
  const res = await api.put(`/api/admin-accounts/${userId}/permissions`, { permissions });
  return res.data;
}
