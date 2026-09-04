/**
 * migrate.js — Reads all .sql migration files in order and executes them.
 * Run with: npm run migrate (from the server/ directory)
 *
 * Requirements: 3.2
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function run() {
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;

  if (!DB_HOST || !DB_NAME || !DB_USER) {
    console.error('[migrate] Missing required DB env vars. Check your .env file.');
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
      multipleStatements: true,
    });
    console.log(`[migrate] Connected to ${DB_HOST}/${DB_NAME}`);
  } catch (err) {
    console.error('[migrate] Could not connect to MySQL:', err.message);
    process.exit(1);
  }

  // Read migration files sorted by filename (001_, 002_, …)
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.warn('[migrate] No .sql files found in', MIGRATIONS_DIR);
    await conn.end();
    return;
  }

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8').trim();
    if (!sql) {
      console.log(`[migrate] Skipping empty file: ${file}`);
      continue;
    }
    try {
      await conn.query(sql);
      console.log(`[migrate] ✓ ${file}`);
    } catch (err) {
      console.error(`[migrate] ✗ ${file}: ${err.message}`);
      await conn.end();
      process.exit(1);
    }
  }

  console.log('[migrate] All migrations completed successfully.');
  await conn.end();
}

run();
