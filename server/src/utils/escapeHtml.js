/**
 * escapeHtml.js — Shared HTML escaping utility.
 * Escapes HTML special characters to prevent XSS when content is rendered
 * (chat messages, email templates).
 *
 * @param {*} str — value to escape; non-strings are coerced via String()
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
