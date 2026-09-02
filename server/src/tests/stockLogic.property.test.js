// Fitur Stok — Fase 1: logika pure kombinasi atribut & hash.

import { describe, it, expect } from 'vitest';
import {
  canonicalizeCombination,
  combinationHash,
  generateCombinations,
} from '../utils/stock.js';

describe('canonicalizeCombination', () => {
  it('mengurutkan berdasarkan nama atribut (localeCompare)', () => {
    expect(canonicalizeCombination([
      { name: 'Ukuran', value: 'A3' },
      { name: 'Bahan', value: 'AP150' },
    ])).toEqual([
      { name: 'Bahan', value: 'AP150' },
      { name: 'Ukuran', value: 'A3' },
    ]);
  });

  it('membuang duplikat nama (case-insensitive) dan entry kosong', () => {
    expect(canonicalizeCombination([
      { name: 'Bahan', value: 'AP150' },
      { name: 'bahan', value: 'HVS' },
      { name: '', value: 'X' },
      { name: 'Ukuran', value: '' },
      null,
      'garbage',
    ])).toEqual([
      { name: 'Bahan', value: 'AP150' },
    ]);
  });

  it('non-array mengembalikan kombinasi kosong', () => {
    expect(canonicalizeCombination(null)).toEqual([]);
    expect(canonicalizeCombination('nope')).toEqual([]);
  });
});

describe('combinationHash', () => {
  it('deterministik & tidak peduli urutan input (hash dari bentuk canonical)', () => {
    const a = combinationHash([{ name: 'Ukuran', value: 'A3' }, { name: 'Bahan', value: 'AP150' }]);
    const b = combinationHash([{ name: 'Bahan', value: 'AP150' }, { name: 'Ukuran', value: 'A3' }]);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{40}$/);
  });

  it('kombinasi berbeda → hash berbeda', () => {
    const a = combinationHash([{ name: 'Bahan', value: 'AP150' }]);
    const b = combinationHash([{ name: 'Bahan', value: 'HVS' }]);
    expect(a).not.toBe(b);
  });

  it('kombinasi kosong menghasilkan hash stabil', () => {
    expect(combinationHash([])).toBe(combinationHash(null));
    expect(combinationHash([])).toBe(combinationHash(undefined));
    expect(combinationHash([])).toBe(combinationHash([{ name: '', value: '' }]));
  });
});

describe('generateCombinations', () => {
  it('produk tanpa atribut → satu kombinasi kosong (awal stok produk simpel)', () => {
    expect(generateCombinations(undefined)).toEqual([[]]);
    expect(generateCombinations(null)).toEqual([[]]);
    expect(generateCombinations([])).toEqual([[]]);
  });

  it('menerima definisi dari JSON string kolom DB', () => {
    const json = JSON.stringify([
      { name: 'Finishing', values: ['Laminasi', 'Tanpa Laminasi'] },
    ]);
    const combos = generateCombinations(json);
    expect(combos).toEqual([
      [{ name: 'Finishing', value: 'Laminasi' }],
      [{ name: 'Finishing', value: 'Tanpa Laminasi' }],
    ]);
  });

  it('cartesian product 2 atribut = n1 * n2 kombinasi', () => {
    const combos = generateCombinations([
      { name: 'Ukuran', values: ['A4', 'A3'] },
      { name: 'Bahan', values: ['AP150', 'HVS'] },
    ]);
    expect(combos).toHaveLength(4);
    for (const c of combos) expect(c).toHaveLength(2);
    const keys = combos.map((c) => combinationHash(c));
    expect(new Set(keys).size).toBe(4);
  });

  it('mendukung values berbentuk objek { value, priceModifier }', () => {
    const combos = generateCombinations([
      { name: 'Finishing', values: [{ value: 'Glossy', priceModifier: 500 }, { value: 'Doff' }] },
    ]);
    expect(combos).toEqual([
      [{ name: 'Finishing', value: 'Glossy' }],
      [{ name: 'Finishing', value: 'Doff' }],
    ]);
  });

  it('membuang pilihan kosong dan atribut tanpa nama/values', () => {
    const combos = generateCombinations([
      { name: 'Ukuran', values: ['A4', '', '  '] },
      { name: '', values: ['X'] },
      { name: 'Hampa', values: [] },
      null,
    ]);
    expect(combos).toEqual([
      [{ name: 'Ukuran', value: 'A4' }],
    ]);
  });
});