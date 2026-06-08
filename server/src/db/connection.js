/**
 * connection.js — mysql2 promise pool and query helper.
 * Tests the connection on startup; exits on failure.
 *
 * Requirements: 3.1
 */

import mysql from 'mysql2/promise';
import { config } from '../config/env.js';

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00',
});

/**
 * Execute a parameterised SQL query.
 * @param {string} sql
 * @param {any[]} [params]
 * @returns {Promise<[import('mysql2').RowDataPacket[], import('mysql2').FieldPacket[]]>}
 */
export function query(sql, params = []) {
  return pool.execute(sql, params);
}

/**
 * Verify the database connection at startup.
 * Logs success or a warning on failure — does NOT exit so the server can still
 * start and serve static frontend files even if DB is temporarily unreachable.
 */
export async function testConnection() {
  try {
    const conn = await pool.getConnection();
    conn.release();
    console.log(`[db] Connected to MySQL at ${config.db.host}:${config.db.port}/${config.db.name}`);
  } catch (err) {
    console.error('[db] WARNING: Could not connect to MySQL:', err.message);
    console.error('[db] DB config — host:', config.db.host, 'port:', config.db.port, 'db:', config.db.name, 'user:', config.db.user);
    console.error('[db] Server will continue without DB — API routes requiring DB will fail.');
    // Do NOT exit — let the server start so we can see logs and serve static files
  }
}
