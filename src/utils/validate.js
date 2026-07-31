/**
 * core/validate.js — Simple form validation helpers.
 * Returns { ok: boolean, errors: string[] }
 */

/**
 * Validate a product data object.
 * @param {{ name?: string, category?: string, price?: number|string }} data
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateProduct(data) {
  const errors = [];

  if (!String(data.name || "").trim()) {
    errors.push("Nama produk wajib diisi.");
  }
  if (!String(data.category || "").trim()) {
    errors.push("Kategori wajib dipilih.");
  }

  const priceCustomer = Number(data.priceCustomer ?? data.price_customer ?? data.price);
  if (isNaN(priceCustomer) || priceCustomer < 0) {
    errors.push("Harga customer harus berupa angka ≥ 0.");
  }

  const priceBroker = Number(data.priceBroker ?? data.price_broker ?? data.price);
  if (isNaN(priceBroker) || priceBroker < 0) {
    errors.push("Harga broker harus berupa angka ≥ 0.");
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Validate a paginate options object.
 * @param {{ page?: number, limit?: number }} opts
 * @returns {{ page: number, limit: number }}
 */
export function normalizePagination({ page = 1, limit = 10 } = {}) {
  return {
    page:  Math.max(1, Math.floor(Number(page)  || 1)),
    limit: Math.max(1, Math.floor(Number(limit) || 10)),
  };
}
