/**
 * discounts.js — Util diskon manual order offline (frontend).
 *
 * MIRROR dari server/src/utils/discounts.js — rumus hitung WAJIB identik
 * (basis gross, additive dari base yang sama, clamp per scope) supaya
 * preview di form tidak selisih dengan hasil simpan di server.
 */

export const DISCOUNT_TYPES = ['percentage', 'nominal'];

/**
 * Parse daftar diskon dari data order/invoice (terima array hasil mysql2
 * atau JSON string). Baris tidak valid diabaikan.
 */
export function parseDiscountRows(raw) {
  let list = raw;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((d) => {
      if (!d || typeof d !== 'object') return null;
      const type = String(d.type ?? '').trim();
      const value = Number(d.value);
      if ((type !== 'percentage' && type !== 'nominal') || !Number.isFinite(value)) return null;
      if (type === 'percentage' && (value < 0 || value > 100)) return null;
      if (type === 'nominal' && value < 0) return null;
      return { type, value, label: String(d.label ?? '').trim() };
    })
    .filter(Boolean);
}

/** Potongan satu baris terhadap base (percentage dibulatkan ke Rupiah).
 *  Nilai di-clamp sebagai defense-in-depth — input dari parseDiscountRows
 *  sudah valid, tapi jaga bila dipanggil dengan data mentah. */
export function computeOneDiscount(row, base) {
  const b = Number(base) || 0;
  if (!row) return 0;
  const value = Number(row.value) || 0;
  if (row.type === 'percentage') {
    return Math.round((b * Math.min(Math.max(value, 0), 100)) / 100);
  }
  return Math.max(0, value);
}

/**
 * Total potongan sebuah scope: additive dari base yang sama,
 * di-clamp ke rentang [0, base] — tidak pernah negatif/melebihi gross.
 */
export function discountTotalFor(rows, base) {
  const b = Number(base) || 0;
  const list = Array.isArray(rows) ? rows : [];
  const sum = list.reduce((acc, row) => acc + computeOneDiscount(row, b), 0);
  return Math.max(0, Math.min(sum, b));
}

/** Label singkat satu baris diskon, mis. "Diskon member (5%)" / "(Rp 5.000)". */
export function describeDiscount(row) {
  if (!row) return '';
  const jenis = row.type === 'percentage' ? `${row.value}%` : `Rp ${Number(row.value).toLocaleString('id-ID')}`;
  return row.label ? `${row.label} (${jenis})` : jenis;
}
