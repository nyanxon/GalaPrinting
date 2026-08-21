/**
 * discounts.js — Util diskon manual order offline.
 *
 * Aturan perhitungan (dikonfirmasi):
 *   1. Basis GROSS  — diskon subtotal dihitung dari Σ harga gross semua item,
 *      bukan dari total setelah diskon item.
 *   2. ADDITIVE     — beberapa diskon dalam scope yang sama masing-masing
 *      dihitung dari base yang sama, lalu potongannya dijumlahkan (bukan
 *      bertumpuk/compounding).
 *   3. CLAMP        — potongan per scope = min(Σ potongan, base); total akhir
 *      tidak pernah negatif.
 *
 * Dipakai bersama oleh orders.controller (resolve harga) dan invoicePdf
 * (menampilkan rincian) supaya angka selalu konsisten.
 */

export const DISCOUNT_TYPES = ['percentage', 'nominal'];
const MAX_DISCOUNT_ROWS = 30;
const MAX_LABEL_LEN = 100;

/**
 * Validasi & normalisasi satu baris diskon dari client.
 * Baris tidak valid dikembalikan sebagai null (diabaikan, tidak crash).
 * @param {unknown} d
 * @returns {{ type: string, value: number, label: string }|null}
 */
export function parseDiscountRow(d) {
  if (!d || typeof d !== 'object') return null;
  const type = String(d.type ?? '').trim();
  if (!DISCOUNT_TYPES.includes(type)) return null;
  const value = Number(d.value);
  if (!Number.isFinite(value)) return null;
  if (type === 'percentage' && (value < 0 || value > 100)) return null;
  if (type === 'nominal' && value < 0) return null;
  const label = String(d.label ?? '').trim().slice(0, MAX_LABEL_LEN);
  return { type, value, label };
}

/**
 * Normalisasi daftar diskon (terima array atau JSON string).
 * Baris tidak valid diabaikan. Maks. 30 baris.
 * @param {unknown} raw
 * @returns {{ type: string, value: number, label: string }[]}
 */
export function parseDiscountList(raw) {
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
    .map(parseDiscountRow)
    .filter(Boolean)
    .slice(0, MAX_DISCOUNT_ROWS);
}

/**
 * Potongan satu baris diskon terhadap base (belum di-clamp per scope).
 * percentage dibulatkan ke Rupiah terdekat; nilai negatif / persen >100
 * di-clamp sebagai defense-in-depth (input sudah divalidasi di parseDiscountRow).
 * @param {{ type: string, value: number }} row
 * @param {number} base
 * @returns {number}
 */
export function computeOneDiscount(row, base) {
  if (!row) return 0;
  const b = Number(base) || 0;
  const value = Number(row.value) || 0;
  if (row.type === 'percentage') {
    return Math.round((b * Math.min(Math.max(value, 0), 100)) / 100);
  }
  return Math.max(0, value);
}

/**
 * Total potongan sebuah scope: additive dari base yang sama, di-clamp
 * ke rentang [0, base] — tidak pernah negatif atau melebihi gross.
 * @param {{ type: string, value: number }[]} rows
 * @param {number} base
 * @returns {number}
 */
export function discountTotalFor(rows, base) {
  const b = Number(base) || 0;
  const list = Array.isArray(rows) ? rows : [];
  const sum = list.reduce((acc, row) => acc + computeOneDiscount(row, b), 0);
  return Math.max(0, Math.min(sum, b));
}

/**
 * Serialisasi daftar diskon untuk disimpan ke kolom JSON.
 * Mengembalikan JSON string atau null saat kosong (pola normalizeSelectedAttributes).
 * @param {unknown} raw
 * @returns {string|null}
 */
export function serializeDiscountList(raw) {
  const list = parseDiscountList(raw);
  return list.length > 0 ? JSON.stringify(list) : null;
}
