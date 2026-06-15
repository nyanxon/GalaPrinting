/**
 * export.controller.js — Owner-only endpoint to export all database tables as JSON.
 * Returns a JSON snapshot of every named table so the client can package it into a ZIP.
 *
 * Security: authenticate + requireRole('owner', 'admin') applied on the route.
 */

import { query } from '../db/connection.js';

/** Tables to include in the database export (same order as migrations). */
const EXPORT_TABLES = [
  'users',
  'categories',
  'products',
  'orders',
  'order_items',
  'order_history',
  'cart_items',
  'conversations',
  'messages',
  'reviews',
  'analytics_visits',
  'analytics_product_views',
  'refresh_tokens',
  'promo_codes',
  'addresses',
  'notifications',
];

export async function exportDatabase(req, res, next) {
  try {
    const snapshot = {};

    for (const table of EXPORT_TABLES) {
      try {
        const [rows] = await query(`SELECT * FROM \`${table}\``);
        snapshot[table] = rows;
      } catch {
        // Table may not exist in this deployment — include empty array, keep going
        snapshot[table] = [];
      }
    }

    return res.json({
      ok: true,
      exportedAt: new Date().toISOString(),
      tables: snapshot,
    });
  } catch (err) {
    next(err);
  }
}
