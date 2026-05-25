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
  const price = Number(data.price);
  if (isNaN(price) || price < 0) {
    errors.push("Harga harus berupa angka ≥ 0.");
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
