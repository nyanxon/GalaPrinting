/**
 * seedFeatures.js — Mengisi tabel `features` dari server/src/config/features.js.
 * INSERT semua feature_key yang terdaftar; yang sudah ada akan di-skip.
 *
 * Run with: npm run seed:features (dari server/ directory)
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';
import { ALL_FEATURES } from '../config/features.js';

async function run() {
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;

  if (!DB_HOST || !DB_NAME || !DB_USER) {
    console.error('[seed-features] Missing required DB env vars. Check your .env file.');
    process.exit(1);
  }

  let conn;
  try {
    conn = await mysql.createConnection({
      host: DB_HOST,
      port: parseInt(DB_PORT, 10) || 3306,
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD || '',
      multipleStatements: false,
    });
    console.log(`[seed-features] Connected to ${DB_HOST}/${DB_NAME}`);
  } catch (err) {
    console.error('[seed-features] Could not connect to MySQL:', err.message);
    process.exit(1);
  }

  // Insert yang belum ada (skip yang sudah terdaftar)
  const values = ALL_FEATURES.map((f) => [f.key, f.label, f.category, f.description]);
  const [result] = await conn.query(
    'INSERT IGNORE INTO features (`key`, label, category, description) VALUES ?',
    [values]
  );

  const inserted = result.affectedRows;
  const total    = ALL_FEATURES.length;
  console.log(`[seed-features] ${inserted} feature baru di-insert (total registry: ${total}).`);

  // Verifikasi: tampilkan isi tabel features
  const [rows] = await conn.query(
    'SELECT `key`, label, category, description FROM features ORDER BY category ASC, `key` ASC'
  );
  console.log(`[seed-features] Isi tabel features (${rows.length} baris):`);
  for (const row of rows) {
    console.log(`  [${row.category}] ${row.key} — ${row.label}`);
  }

  // Cek konsistensi: feature di DB yang TIDAK ada di registry
  const dbKeys     = new Set(rows.map((r) => r.key));
  const regKeys    = new Set(ALL_FEATURES.map((f) => f.key));
  const orphanRows = [...dbKeys].filter((k) => !regKeys.has(k));
  if (orphanRows.length > 0) {
    console.warn(`[seed-features] WARNING: ${orphanRows.length} feature di DB tidak ada di registry: ${orphanRows.join(', ')}`);
  }

  await conn.end();
}

run().catch((err) => {
  console.error('[seed-features] Failed:', err.message);
  process.exit(1);
});
