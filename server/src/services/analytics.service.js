/**
 * analytics.service.js — Analytics business logic.
 *
 * Requirements: 12.1–12.7
 *
 * All revenue/order queries now accept optional filter params:
 *   from       — ISO date string (YYYY-MM-DD), inclusive
 *   to         — ISO date string (YYYY-MM-DD), inclusive
 *   categoryId — filter orders that contain items from this category
 *   customerId — filter orders placed by a specific customer
 *   status     — single order status string; if omitted, uses COMPLETED_STATUSES
 */

import { query } from '../db/connection.js';

const COMPLETED_STATUSES = ['Finished', 'In Delivery', 'Quality Checking', 'On Progress'];

/**
 * Build a reusable WHERE fragment + params array from filter options.
 * All returned clauses already include the leading AND keyword.
 *
 * @param {object} filters
 * @param {string} [orderAlias='o'] - alias for the orders table
 * @param {boolean} [includeJoin=false] - whether to include a JOIN clause for categoryId
 * @returns {{ whereClauses: string[], params: any[], joinClause: string }}
 */
function buildFilterClauses(filters = {}, orderAlias = 'o') {
  const { from, to, customerId, status } = filters;
  const whereClauses = [];
  const params = [];

  if (status) {
    whereClauses.push(`AND ${orderAlias}.status = ?`);
    params.push(status);
  } else {
    whereClauses.push(
      `AND ${orderAlias}.status IN (${COMPLETED_STATUSES.map(() => '?').join(',')})`
    );
    params.push(...COMPLETED_STATUSES);
  }

  if (from) {
    whereClauses.push(`AND DATE(${orderAlias}.created_at) >= ?`);
    params.push(from);
  }

  if (to) {
    whereClauses.push(`AND DATE(${orderAlias}.created_at) <= ?`);
    params.push(to);
  }

  if (customerId) {
    whereClauses.push(`AND ${orderAlias}.customer_id = ?`);
    params.push(customerId);
  }

  return { whereClauses, params };
}

/**
 * Build a category-scoped sub-query clause.
 * Returns empty string when categoryId is not set.
 */
function buildCategoryClause(filters = {}, orderAlias = 'o') {
  if (!filters.categoryId) return { clause: '', params: [] };
  // An order "belongs to" a category if any of its items belongs to a product in that category
  const clause = `AND ${orderAlias}.id IN (
    SELECT DISTINCT oi.order_id FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE p.category_id = ?
  )`;
  return { clause, params: [filters.categoryId] };
}

// ─────────────────────────────────────────────────────────────

export async function getRevenue(filters = {}) {
  const { whereClauses, params: baseParams } = buildFilterClauses(filters);
  const { clause: catClause, params: catParams } = buildCategoryClause(filters);

  const w = whereClauses.join(' ') + ' ' + catClause;
  const p = [...baseParams, ...catParams];

  // Total aggregates
  const [[agg]] = await query(
    `SELECT
       COALESCE(SUM(subtotal), 0)        AS total_revenue,
       COALESCE(SUM(shipping_cost), 0)   AS total_shipping,
       COALESCE(SUM(discount_amount), 0) AS total_discount,
       COALESCE(SUM(tax_amount), 0)      AS total_tax,
       COALESCE(SUM(refund_amount), 0)   AS total_refunds,
       COALESCE(SUM(subtotal - discount_amount - refund_amount - shipping_cost), 0) AS total_profit,
       COUNT(*)                           AS order_count,
       COUNT(DISTINCT customer_id)        AS customer_count,
       CASE WHEN COUNT(*) > 0
         THEN COALESCE(SUM(subtotal), 0) / COUNT(*) ELSE 0 END AS aov
     FROM orders o
     WHERE 1=1 ${w}`,
    p
  );

  // Comparison period: same length of time immediately before the current window
  let compParams;
  let compWhere;
  if (filters.from && filters.to) {
    const daysDiff = Math.round(
      (new Date(filters.to) - new Date(filters.from)) / (1000 * 60 * 60 * 24)
    ) + 1;
    const compTo = new Date(new Date(filters.from).getTime() - 86400000).toISOString().slice(0, 10);
    const compFrom = new Date(new Date(filters.from).getTime() - daysDiff * 86400000)
      .toISOString()
      .slice(0, 10);

    const { whereClauses: compClauses, params: compBaseParams } = buildFilterClauses({
      ...filters,
      from: compFrom,
      to: compTo,
    });
    const { clause: compCatClause, params: compCatP } = buildCategoryClause(filters);
    compWhere = compClauses.join(' ') + ' ' + compCatClause;
    compParams = [...compBaseParams, ...compCatP];
  } else {
    // Default: compare to previous calendar month
    const { whereClauses: prevClauses, params: prevParams } = buildFilterClauses({
      status: filters.status,
      customerId: filters.customerId,
    });
    const { clause: prevCatClause, params: prevCatP } = buildCategoryClause(filters);
    compWhere = prevClauses.join(' ')
      + ` AND MONTH(o.created_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))`
      + ` AND YEAR(o.created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))`
      + ' ' + prevCatClause;
    compParams = [...prevParams, ...prevCatP];
  }

  const [[prevAgg]] = await query(
    `SELECT
       COALESCE(SUM(subtotal), 0)        AS total_revenue,
       COALESCE(SUM(subtotal - discount_amount - refund_amount - shipping_cost), 0) AS total_profit,
       COUNT(*)                           AS order_count,
       COUNT(DISTINCT customer_id)        AS customer_count,
       COALESCE(SUM(refund_amount), 0)    AS total_refunds,
       CASE WHEN COUNT(*) > 0
         THEN COALESCE(SUM(subtotal), 0) / COUNT(*) ELSE 0 END AS aov
     FROM orders o
     WHERE 1=1 ${compWhere}`,
    compParams
  );

  // Revenue by day for trend chart
  const [byDayRows] = await query(
    `SELECT DATE(o.created_at) AS date,
       COALESCE(SUM(o.subtotal), 0) AS revenue,
       COALESCE(SUM(o.subtotal - o.discount_amount - o.refund_amount - o.shipping_cost), 0) AS profit,
       COUNT(*) AS orders
     FROM orders o
     WHERE 1=1 ${w}
       AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY DATE(o.created_at)
     ORDER BY date ASC`,
    p
  );

  // Revenue by category
  const [byCategoryRows] = await query(
    `SELECT
       c.id AS category_id,
       c.name AS category_name,
       COALESCE(SUM(oi.price * oi.quantity), 0) AS revenue
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON oi.product_id = p.id
     JOIN categories c ON p.category_id = c.id
     WHERE 1=1 ${w}
     GROUP BY c.id, c.name
     ORDER BY revenue DESC`,
    p
  );

  // Revenue by payment method (sources)
  const [bySourceRows] = await query(
    `SELECT
       COALESCE(payment_method, 'Tidak Diketahui') AS source,
       COALESCE(SUM(subtotal), 0) AS revenue,
       COUNT(*) AS orders
     FROM orders o
     WHERE 1=1 ${w}
     GROUP BY payment_method
     ORDER BY revenue DESC`,
    p
  );

  // Returning customers: customers with >1 order in the filtered range
  const [returningRows] = await query(
    `SELECT COUNT(*) AS returning_customers FROM (
       SELECT customer_id, COUNT(*) AS cnt
       FROM orders o
       WHERE 1=1 ${w} AND customer_id IS NOT NULL
       GROUP BY customer_id
       HAVING cnt > 1
     ) AS multi_order_customers`,
    p
  );

  return {
    totalRevenue:         parseFloat(agg.total_revenue),
    totalShipping:        parseFloat(agg.total_shipping),
    totalDiscount:        parseFloat(agg.total_discount),
    totalTax:             parseFloat(agg.total_tax),
    totalRefunds:         parseFloat(agg.total_refunds),
    totalProfit:          parseFloat(agg.total_profit),
    orderCount:           parseInt(agg.order_count, 10),
    customerCount:        parseInt(agg.customer_count, 10),
    aov:                  parseFloat(agg.aov),
    returningCustomers:   parseInt(returningRows[0]?.returning_customers ?? 0, 10),

    // Previous period for comparison
    prev: {
      totalRevenue:  parseFloat(prevAgg.total_revenue),
      totalProfit:   parseFloat(prevAgg.total_profit),
      orderCount:    parseInt(prevAgg.order_count, 10),
      customerCount: parseInt(prevAgg.customer_count, 10),
      totalRefunds:  parseFloat(prevAgg.total_refunds),
      aov:           parseFloat(prevAgg.aov),
    },

    byDay:       byDayRows,
    byCategory:  byCategoryRows,
    bySources:   bySourceRows,
  };
}

export async function getMonthlyStats(filters = {}) {
  const { whereClauses, params } = buildFilterClauses(filters);
  const { clause: catClause, params: catParams } = buildCategoryClause(filters);

  const w = whereClauses.join(' ') + ' ' + catClause;
  const p = [...params, ...catParams];

  const [rows] = await query(
    `SELECT
       DATE_FORMAT(o.created_at, '%Y-%m') AS month,
       COUNT(*) AS order_count,
       COALESCE(SUM(o.subtotal), 0) AS revenue,
       COALESCE(SUM(o.subtotal - o.discount_amount - o.refund_amount - o.shipping_cost), 0) AS profit
     FROM orders o
     WHERE 1=1 ${w}
       AND o.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY DATE_FORMAT(o.created_at, '%Y-%m')
     ORDER BY month ASC`,
    p
  );
  return rows;
}

export async function getVisits() {
  const [rows] = await query(
    `SELECT visit_date AS date, count
     FROM analytics_visits
     WHERE visit_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     ORDER BY visit_date ASC`
  );
  return rows;
}

export async function getTotalVisits() {
  const [[row]] = await query(
    `SELECT COALESCE(SUM(count), 0) AS total FROM analytics_visits`
  );
  return parseInt(row.total, 10);
}

export async function getTopProductViews(limit = 5) {
  const [rows] = await query(
    `SELECT
       apv.product_id,
       COALESCE(p.name, apv.product_id) AS name,
       COALESCE(c.name, '—') AS category,
       SUM(apv.count) AS views
     FROM analytics_product_views apv
     LEFT JOIN products p ON apv.product_id = p.id
     LEFT JOIN categories c ON p.category_id = c.id
     GROUP BY apv.product_id, p.name, c.name
     ORDER BY views DESC
     LIMIT ?`,
    [limit]
  );
  return rows;
}

export async function getBestSellers(filters = {}) {
  const { whereClauses, params } = buildFilterClauses(filters);
  const { clause: catClause, params: catParams } = buildCategoryClause(filters);

  const w = whereClauses.join(' ') + ' ' + catClause;
  const p = [...params, ...catParams];

  const [rows] = await query(
    `SELECT
       oi.product_id,
       oi.name,
       c.name AS category,
       SUM(oi.quantity) AS qty,
       SUM(oi.price * oi.quantity) AS revenue
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     LEFT JOIN products p ON oi.product_id = p.id
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE 1=1 ${w}
     GROUP BY oi.product_id, oi.name, c.name
     ORDER BY qty DESC
     LIMIT 5`,
    p
  );
  return rows;
}

export async function recordVisit() {
  await query(
    `INSERT INTO analytics_visits (visit_date, count)
     VALUES (CURDATE(), 1)
     ON DUPLICATE KEY UPDATE count = count + 1`
  );
}

export async function recordProductView(productId) {
  await query(
    `INSERT INTO analytics_product_views (product_id, view_date, count)
     VALUES (?, CURDATE(), 1)
     ON DUPLICATE KEY UPDATE count = count + 1`,
    [productId]
  );
}

// ── Revenue reset ─────────────────────────────────────────────────────────────

/**
 * Delete all revenue data from the database and reset the order sequence counter.
 *
 * Deletion order respects FK constraints:
 *   order_history  (FK → orders CASCADE — but we delete explicitly for the count)
 *   order_items    (FK → orders CASCADE — same)
 *   orders
 *   analytics_visits
 *   analytics_product_views
 *   order_sequence.last_seq → reset to 0
 *
 * Wrapped in a single transaction — if anything fails, nothing is deleted.
 *
 * @param {{ actorId: string, note?: string }} opts
 * @returns {Promise<{ ordersDeleted: number, visitsDeleted: number, viewsDeleted: number }>}
 */
import { pool } from '../db/connection.js';
import { randomUUID } from 'crypto';

export async function resetAllRevenueData({ actorId, note = null }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Disable FK checks so we can truncate in any order inside the transaction
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

    // Count rows before deletion so we can log them
    const [[{ ordersDeleted }]]  = await conn.execute('SELECT COUNT(*) AS ordersDeleted FROM orders');
    const [[{ visitsDeleted }]]  = await conn.execute('SELECT COUNT(*) AS visitsDeleted FROM analytics_visits');
    const [[{ viewsDeleted }]]   = await conn.execute('SELECT COUNT(*) AS viewsDeleted  FROM analytics_product_views');

    // Delete all revenue-related data
    await conn.execute('DELETE FROM order_history');
    await conn.execute('DELETE FROM order_items');
    await conn.execute('DELETE FROM orders');
    await conn.execute('DELETE FROM analytics_visits');
    await conn.execute('DELETE FROM analytics_product_views');

    // Reset order sequence so numbering starts from 1 again
    await conn.execute('UPDATE order_sequence SET last_seq = 0 WHERE id = 1');

    // Re-enable FK checks
    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Write an audit log entry (this table is never reset)
    await conn.execute(
      `INSERT INTO revenue_reset_log (id, performed_by, orders_deleted, visits_deleted, views_deleted, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [randomUUID(), actorId || null, ordersDeleted, visitsDeleted, viewsDeleted, note || null]
    );

    await conn.commit();

    return {
      ordersDeleted:  Number(ordersDeleted),
      visitsDeleted:  Number(visitsDeleted),
      viewsDeleted:   Number(viewsDeleted),
    };
  } catch (err) {
    await conn.rollback();
    // Make sure FK checks are always re-enabled even on rollback
    try { await conn.execute('SET FOREIGN_KEY_CHECKS = 1'); } catch {}
    throw err;
  } finally {
    conn.release();
  }
}
