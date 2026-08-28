/**
 * activityLog.js — Frontend service for the Activity Log feature.
 *
 * Backs the Admin/Owner "LOG" view:
 *   - GET    /api/activity-log?actorType&from&to&search&page&limit
 *   - GET    /api/activity-log/pdf (same filters, unpaginated, for PDF export)
 *   - DELETE /api/activity-log/older-than?months=1|3|6
 *   - POST   /api/activity-log/:id/read
 *   - POST   /api/activity-log/read-all
 *   - GET    /api/activity-log/unread-count
 *   - GET    /api/activity-log/retention
 *   - PUT    /api/activity-log/retention
 *
 * All of these are admin+owner only (enforced server-side by requireRole).
 */

import { api } from '../core/httpClient.js';

/**
 * Paginated list of activity log entries.
 *
 * @param {{ actorType?: string, from?: string, to?: string, search?: string,
 *           page?: number, limit?: number }} filters
 * @returns {Promise<{ items: object[], total: number, page: number, totalPages: number }>}
 */
export async function listActivityLogs({ actorType, from, to, search, page, limit } = {}) {
  const params = new URLSearchParams();
  if (actorType) params.set('actorType', actorType);
  if (from)      params.set('from', from);
  if (to)        params.set('to', to);
  if (search)    params.set('search', search);
  params.set('page', String(page || 1));
  params.set('limit', String(limit || 20));
  const qs = params.toString();
  const res = await api.get(`/api/activity-log${qs ? '?' + qs : ''}`);
  return res.data;
}

/**
 * Unpaginated raw rows matching the filters, for client-side PDF generation.
 *
 * @param {{ actorType?: string, from?: string, to?: string, search?: string }} filters
 * @returns {Promise<object[]>}
 */
export async function listActivityLogsForPdf({ actorType, from, to, search } = {}) {
  const params = new URLSearchParams();
  if (actorType) params.set('actorType', actorType);
  if (from)      params.set('from', from);
  if (to)        params.set('to', to);
  if (search)    params.set('search', search);
  const qs = params.toString();
  const res = await api.get(`/api/activity-log/pdf${qs ? '?' + qs : ''}`);
  return res.data.items || [];
}

/**
 * Delete activity log entries older than `months` (1, 3, or 6).
 *
 * @param {1|3|6} months
 * @returns {Promise<{ ok: boolean, deleted: number, cutoff: string }>}
 */
export async function deleteLogsOlderThan(months) {
  const res = await api.delete(`/api/activity-log/older-than?months=${months}`);
  return res.data;
}

/**
 * Mark a single log as read for the current reader.
 * @param {string|number} logId
 * @returns {Promise<{ ok: boolean, read: boolean, created: boolean }>}
 */
export async function markLogRead(logId) {
  const res = await api.post(`/api/activity-log/${encodeURIComponent(logId)}/read`);
  return res.data;
}

/**
 * Mark every log as read for the current reader.
 * @returns {Promise<{ ok: boolean, marked: boolean }>}
 */
export async function markAllLogsRead() {
  const res = await api.post('/api/activity-log/read-all');
  return res.data;
}

/**
 * Number of unread logs for the current reader.
 * @returns {Promise<number>}
 */
export async function getUnreadLogCount() {
  const res = await api.get('/api/activity-log/unread-count');
  return typeof res.data?.count === 'number' ? res.data.count : 0;
}

/**
 * Current auto-retention setting.
 * @returns {Promise<{ months: number, enabled: boolean }>}
 */
export async function getRetentionSetting() {
  const res = await api.get('/api/activity-log/retention');
  return res.data;
}

/**
 * Set auto-retention months (0 = OFF, or 3/6/12).
 * @param {0|3|6|12} months
 * @returns {Promise<{ months: number, enabled: boolean }>}
 */
export async function setRetentionSetting(months) {
  const res = await api.put('/api/activity-log/retention', { months });
  return res.data;
}
