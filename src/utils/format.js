import { APP } from "../core/config.js";

export function formatCurrency(value) {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat(APP.locale, {
    style: "currency",
    currency: APP.currency,
    maximumFractionDigits: 0,
  }).format(number);
}
