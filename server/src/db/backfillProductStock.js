/**
 * backfillProductStock.js — Seed/migrasi stok awal: buat baris product_stock
 * (stock_quantity = 0) untuk SEMUA kombinasi atribut setiap produk yang belum
 * punya baris. Idempotent (INSERT IGNORE) — aman dijalankan ulang.
 *
 * Keputusan default stok awal = 0 (fail-safe): produk existing dianggap habis
 * sampai admin mengisi stok tiap kombinasi. Baris selalu dibuat agar form stok
 * admin langsung menampilkan semua kombinasi (tidak ada kombinasi "hilang").
 *
 * Dipanggil otomatis oleh migrate.js (reuse koneksi) atau standalone:
 *   node src/db/backfillProductStock.js
 */

import { randomUUID } from 'crypto';
import { pool } from './connection.js';
import { generateCombinations, combinationHash } from '../utils/stock.js';

const BATCH_SIZE = 200;

/**
 * Backfill baris product_stock untuk semua produk yang belum punya baris.
 * @param {import('mysql2/promise').Connection} conn  Koneksi aktif
 * @returns {Promise<{ scannedProducts: number, created: number }>}
 */
export async function backfillProductStock(conn) {
  const start = Date.now();
  let created = 0;

  const [products] = await conn.execute('SELECT id, attributes FROM products');
  const scannedProducts = products.length;

  const upsert = async (rows) => {
    if (rows.length === 0) return;
    const values = rows.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const params = [];
    for (const r of rows) {
      params.push(r.id, r.productId, r.combinationJson, r.hash, r.stock);
    }
    const [res] = await conn.execute(
      `INSERT IGNORE INTO product_stock
         (id, product_id, attribute_combination, combination_hash, stock_quantity)
       VALUES ${values}`,
      params
    );
    created += Number(res.affectedRows) || 0;
  };

  let batch = [];
  for (const product of products) {
    let defs = product.attributes;
    if (typeof defs === 'string') {
      try {
        defs = JSON.parse(defs);
      } catch {
        defs = null;
      }
    }
    const combos = generateCombinations(defs);
    for (const combo of combos) {
      const canonical = Array.isArray(combo) ? combo : [];
      batch.push({
        id: randomUUID(),
        productId: product.id,
        combinationJson: JSON.stringify(canonical),
        hash: combinationHash(canonical),
        stock: 0,
      });
    }
    if (batch.length >= BATCH_SIZE) {
      await upsert(batch);
      batch = [];
    }
  }
  await upsert(batch);

  const ms = Date.now() - start;
  console.log(`[stock] Backfill selesai: ${scannedProducts} produk, ${created} baris stok baru (${ms}ms).`);
  return { scannedProducts, created };
}

// ── Standalone entrypoint ────────────────────────────────────────────
const isDirect = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('backfillProductStock.js');
if (isDirect) {
  let conn;
  try {
    conn = await pool.getConnection();
    await backfillProductStock(conn);
  } catch (err) {
    console.error('[stock] Backfill gagal:', err.message);
    process.exitCode = 1;
  } finally {
    if (conn) conn.release();
    await pool.end().catch(() => {});
  }
}