/**
 * stock.service.js — Stok per kombinasi atribut.
 *
 * Semua query stok memakai kombinasi kanonik [{name,value}] urut nama dan
 * combination_hash (sha1 hex) dari server/src/utils/stock.js. Hash dan format
 * JSON disimpan agar lookup deterministik & memanfaatkan UNIQUE
 * (product_id, combination_hash).
 *
 * Konvensi stok:
 *  - Produk tanpa atribut → satu baris dengan kombinasi [].
 *  - Baris hilang / belum ada → dianggap stok 0 (fail-safe).
 *  - Stok berkurang saat order dibuat (transactional, atomic conditional
 *    UPDATE), kembali saat order dibatalkan (Cancelled) / custom order dihapus.
 */

import { randomUUID } from 'crypto';
import { query } from '../db/connection.js';
import { canonicalizeCombination, combinationHash, generateCombinations } from '../utils/stock.js';

export { generateCombinations };

/**
 * Kanonikkan kombinasi terpilih → [{ name, value }] urut nama.
 * Tahan input berupa JSON string (mis. kolom order_items.attributes hasil
 * SELECT) maupun array.
 */
export function canonicalCombination(combination) {
  if (typeof combination === 'string') {
    try {
      combination = JSON.parse(combination);
    } catch {
      return [];
    }
  }
  return canonicalizeCombination(combination);
}

/** Hash sha1 hex dari kombinasi kanonik. */
export function hashCombination(combination) {
  return combinationHash(canonicalCombination(combination));
}

/** Error khusus stok — dipetakan ke HTTP 409 oleh errorHandler. */
export class StockInsufficientError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'StockInsufficientError';
    this.status = 409;
    this.code = 'STOCK_INSUFFICIENT';
    this.details = details;
  }
}

function parseDbJson(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Stok untuk satu kombinasi. Baris belum ada → 0 (fail-safe).
 * @param {string} productId
 * @param {unknown} combination
 * @returns {Promise<number>}
 */
export async function getStock(productId, combination) {
  const canonical = canonicalCombination(combination);
  const hash = combinationHash(canonical);
  const [rows] = await query(
    `SELECT stock_quantity FROM product_stock
     WHERE product_id = ? AND combination_hash = ?`,
    [productId, hash]
  );
  return rows.length > 0 ? Number(rows[0].stock_quantity) || 0 : 0;
}

/**
 * Cek stok banyak kombinasi sekaligus (pakai untuk validasi checkout).
 * @param {Array<{ productId: string, combination: unknown }>} entries
 * @returns {Promise<Map<string, number>>}  key = `${productId}:${hash}`
 */
export async function batchGetStocks(entries) {
  const result = new Map();
  const clean = Array.isArray(entries) ? entries.filter((e) => e && e.productId) : [];
  if (clean.length === 0) return result;

  // Key lokal per entry → hash, agar kita berikan 0 untuk yang tak ada row.
  const keyByHash = new Map();
  const unique = [];
  for (const e of clean) {
    const canonical = canonicalCombination(e.combination);
    const hash = combinationHash(canonical);
    const key = `${e.productId}:${hash}`;
    if (!keyByHash.has(key)) {
      keyByHash.set(key, { canonical, hash });
      unique.push({ productId: e.productId, hash });
    }
  }

  // Query IN (product_id, combination_hash) — jalankan per chunk kecil untuk
  // menghindari ukuran query yang tak terkendali.
  const CHUNK = 100;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const placeholders = slice.map(() => '(?, ?)').join(', ');
    const params = [];
    for (const s of slice) params.push(s.productId, s.hash);
    const [rows] = await query(
      `SELECT product_id, combination_hash, stock_quantity
       FROM product_stock
       WHERE (product_id, combination_hash) IN (${placeholders})`,
      params
    );
    for (const r of rows) {
      result.set(`${r.product_id}:${r.combination_hash}`, Number(r.stock_quantity) || 0);
    }
  }

  // Default 0 untuk entry tanpa row + local key.
  const merged = new Map();
  for (const e of clean) {
    const hash = combinationHash(canonicalCombination(e.combination));
    const key = `${e.productId}:${hash}`;
    merged.set(key, result.has(key) ? result.get(key) : 0);
  }
  return merged;
}

/**
 * Daftar semua baris stok sebuah produk (untuk form admin).
 * @param {string} productId
 * @returns {Promise<Array<{ id: string, combination: Array<{name:string,value:string}>, stockQuantity: number, updatedAt: Date }>>}
 */
export async function listProductStock(productId) {
  const [rows] = await query(
    `SELECT id, attribute_combination, stock_quantity, updated_at
     FROM product_stock
     WHERE product_id = ?
     ORDER BY updated_at DESC`,
    [productId]
  );
  return rows.map((r) => ({
    id: r.id,
    combination: parseDbJson(r.attribute_combination),
    stockQuantity: Number(r.stock_quantity) || 0,
    updatedAt: r.updated_at,
  }));
}

/**
 * Set stok satu kombinasi (upsert). stock >= 0 divalidasi di controller.
 * @param {string} productId
 * @param {unknown} combination
 * @param {number} stockQuantity
 */
export async function setProductStock(productId, combination, stockQuantity) {
  const canonical = canonicalCombination(combination);
  const hash = combinationHash(canonical);
  await query(
    `INSERT INTO product_stock
       (id, product_id, attribute_combination, combination_hash, stock_quantity)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       attribute_combination = ?, stock_quantity = ?`,
    [
      randomUUID(),
      productId,
      JSON.stringify(canonical),
      hash,
      stockQuantity,
      JSON.stringify(canonical),
      stockQuantity,
    ]
  );
}

/**
 * Pastikan baris stok ada untuk semua kombinasi produk (INSERT IGNORE, stok 0).
 * Dipakai saat produk dibuat/diubah atributnya agar form stok selalu lengkap.
 * @param {string} productId
 * @param {unknown} attributesDef  Kolom products.attributes (array/JSON string)
 */
export async function ensureProductStockRows(productId, attributesDef) {
  const combos = generateCombinations(attributesDef);
  if (combos.length === 0) return;
  const values = combos.map(() => '(?, ?, ?, ?, ?)').join(', ');
  const params = [];
  for (const combo of combos) {
    const canonical = Array.isArray(combo) ? combo : [];
    params.push(
      randomUUID(),
      productId,
      JSON.stringify(canonical),
      combinationHash(canonical),
      0
    );
  }
  await query(
    `INSERT IGNORE INTO product_stock
       (id, product_id, attribute_combination, combination_hash, stock_quantity)
     VALUES ${values}`,
    params
  );
}

/**
 * Kurangi stok secara atomik di dalam transaksi yang sedang berjalan.
 * Gagal (stok kurang / baris hilang) → StockInsufficientError → caller rollback.
 *
 * @param {import('mysql2/promise').Connection} conn  Koneksi transaksi aktif
 * @param {Array<{ productId: string, name: string, combination: unknown, quantity: number }>} entries
 */
export async function decrementStock(conn, entries) {
  // Agregasi per (product, hash) supaya item kembar digabung satu UPDATE.
  const agg = new Map();
  for (const e of entries) {
    if (!e || !e.productId) continue;
    const hash = combinationHash(canonicalCombination(e.combination));
    const key = `${e.productId}:${hash}`;
    const cur = agg.get(key);
    if (cur) {
      cur.quantity += Math.max(1, Number(e.quantity) || 1);
      cur.name = cur.name || e.name;
      cur.combination = e.combination;
      cur.requested = cur.requested || [];
    } else {
      agg.set(key, {
        productId: e.productId,
        name: e.name,
        combination: e.combination,
        quantity: Math.max(1, Number(e.quantity) || 1),
      });
    }
  }

  const insufficient = [];
  for (const { productId, name, combination, quantity } of agg.values()) {
    const hash = combinationHash(canonicalCombination(combination));
    const [res] = await conn.execute(
      `UPDATE product_stock
       SET stock_quantity = stock_quantity - ?
       WHERE product_id = ? AND combination_hash = ? AND stock_quantity >= ?`,
      [quantity, productId, hash, quantity]
    );
    if (Number(res.affectedRows) === 0) {
      let available = 0;
      const [rows] = await conn.execute(
        'SELECT stock_quantity FROM product_stock WHERE product_id = ? AND combination_hash = ?',
        [productId, hash]
      );
      if (rows.length > 0) available = Number(rows[0].stock_quantity) || 0;
      insufficient.push({ productId, name: name || 'Produk', combination, requested: quantity, available });
    }
  }

  if (insufficient.length > 0) {
    const label = insufficient
      .map((i) => {
        const comboText = canonicalCombination(i.combination)
          .map((a) => `${a.name}: ${a.value}`)
          .join(', ');
        const comboPart = comboText ? ` (${comboText})` : '';
        return `"${i.name}"${comboPart} sisa ${i.available}, diminta ${i.requested}`;
      })
      .join('; ');
    throw new StockInsufficientError(`Stok tidak mencukupi: ${label}`, insufficient);
  }
}

/**
 * Kembalikan stok untuk item order (saat dibatalkan / custom order dihapus).
 * Item tanpa product_id (barang custom bebas) dilewati. Bisa dipakai di dalam
 * transaksi (conn) atau lewat pool (tanpa conn).
 * @param {Array<{ productId?: string|null, attributes?: unknown, quantity?: number }>} items
 * @param {import('mysql2/promise').Connection} [conn]
 */
export async function restockItems(items, conn) {
  const run = conn
    ? (sql, params) => conn.execute(sql, params)
    : (sql, params) => query(sql, params);

  for (const item of Array.isArray(items) ? items : []) {
    const productId = item?.productId ?? item?.product_id ?? null;
    if (!productId) continue;
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const hash = combinationHash(canonicalCombination(item.attributes));
    await run(
      `UPDATE product_stock
       SET stock_quantity = stock_quantity + ?
       WHERE product_id = ? AND combination_hash = ?`,
      [quantity, productId, hash]
    );
  }
}