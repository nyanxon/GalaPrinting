import { APP } from "./config.js";

/**
 * Debounce a function — delays execution until after `ms` ms of inactivity.
 * @param {Function} fn
 * @param {number} ms
 */
export function debounce(fn, ms = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function formatCurrency(value) {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat(APP.locale, {
    style: "currency",
    currency: APP.currency,
    maximumFractionDigits: 0,
  }).format(number);
}

export function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

