/**
 * stock.js — Helper kombinasi atribut produk (sisi frontend).
 *
 * Logika identik dengan server/src/utils/stock.js: kombinasi kanonik
 * = [{ name, value }] diurutkan berdasarkan nama. Dipakai admin untuk
 * menguraikan stok per kombinasi dan customer untuk cek ketersediaan stok.
 */

/**
 * Kanonikkan kombinasi atribut → [{ name, value }] urut nama, buang duplikat
 * nama (case-insensitive) dan entry kosong.
 * @param {unknown} selected
 * @returns {Array<{ name: string, value: string }>}
 */
export function canonicalizeCombination(selected) {
  if (!Array.isArray(selected)) return [];
  const seen = new Map();
  for (const a of selected) {
    if (!a || typeof a !== 'object') continue;
    const name = String(a.name ?? '').trim();
    const value = String(a.value ?? '').trim();
    if (!name || !value) continue;
    if (!seen.has(name.toLowerCase())) {
      seen.set(name.toLowerCase(), { name, value });
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Cartesian product dari definisi atribut produk.
 * defs: array [{ name, values: string[] }] — produk tanpa atribut → [[]].
 * @param {unknown} defs
 * @returns {Array<Array<{ name: string, value: string }>>}
 */
export function generateCombinations(defs) {
  const list = Array.isArray(defs) ? defs : [];
  const attrs = list
    .map((a) => ({
      name: String(a && a.name ? a.name : '').trim(),
      values: Array.isArray(a && a.values) ? a.values : [],
    }))
    .filter((a) => a.name && a.values.length > 0);

  if (attrs.length === 0) return [[]];

  let combos = [[]];
  for (const attr of attrs) {
    const next = [];
    for (const combo of combos) {
      for (const rawValue of attr.values) {
        const value = String(rawValue ?? '').trim();
        if (!value) continue;
        next.push([...combo, { name: attr.name, value }]);
      }
    }
    combos = next;
  }
  return combos;
}