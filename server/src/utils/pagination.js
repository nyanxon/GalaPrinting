/**
 * pagination.js — Shared pagination helper.
 * Normalizes page/limit inputs into safe integer values with a capped limit.
 */

/**
 * @param {number|string|undefined} page
 * @param {number|string|undefined} limit
 * @param {number} maxLimit - hard cap for limitNum
 * @param {number} [defaultLimit=20] - fallback when limit is non-numeric
 * @returns {{ pageNum: number, limitNum: number, offset: number }}
 */
export function parsePagination(page, limit, maxLimit, defaultLimit = 20) {
  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || defaultLimit));
  const offset   = (pageNum - 1) * limitNum;
  return { pageNum, limitNum, offset };
}
