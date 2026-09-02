/**
 * stock.js — Pure helpers untuk stok per kombinasi atribut.
 *
 * Kombinasi = array [{ name, value }] yang SAMA BENTUKNYA dengan
 * selected-attributes di cart_items / order_items. Representasi canonical
 * diurutkan berdasarkan nama atribut (localeCompare) supaya kombinasi yang
 * sama selalu menghasilkan string & hash identik — aman untuk lookup dan
 * UNIQUE index (product_id, combination_hash).
 */

import { createHash } from 'crypto';

/**
 * Canonicalize daftar atribut terpilih menjadi [{ name, value }] yang
 * diurutkan berdasarkan nama. Duplikat nama (case-insensitive) dibuang,
 * entry kosong diabaikan.
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
 * sha1 hex dari JSON canonical kombinasi — kunci utama lookup stok.
 * @param {unknown} combination
 * @returns {string}
 */
export function combinationHash(combination) {
  return createHash('sha1')
    .update(JSON.stringify(canonicalizeCombination(combination)))
    .digest('hex');
}

/**
 * Cartesian product dari definisi atribut produk.
 *
 * products.attributes berbentuk:
 *   [{ name, affectsPrice, values: [{ value, priceModifier }] | string[] }]
 *
 * Produk TANPA atribut → mengembalikan satu kombinasi kosong [[]].
 * @param {unknown} defs  Kolom products.attributes (array atau JSON string)
 * @returns {Array<Array<{ name: string, value: string }>>}
 */
export function generateCombinations(defs) {
  let list = defs;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) list = [];

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
        const value =
          typeof rawValue === 'string'
            ? rawValue.trim()
            : String(rawValue && rawValue.value != null ? rawValue.value : rawValue ?? '').trim();
        if (!value) continue;
        next.push([...combo, { name: attr.name, value }]);
      }
    }
    combos = next;
  }
  return combos;
}