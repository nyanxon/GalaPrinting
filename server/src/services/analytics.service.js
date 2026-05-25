/**
 * analytics.service.js — Analytics business logic.
 *
 * Requirements: 12.1–12.7
 */

import { query } from '../db/connection.js';

const COMPLETED_STATUSES = ['Finished', 'In Delivery', 'Quality Checking', 'On Progress'];

export async function getRevenue() {
  const [totalRows] = await query(
    `SELECT COALESCE(SUM(subtotal), 0) AS total
     FROM orders
     WHERE status IN (${COMPLETED_STATUSES.map(() => '?').join(',')})`,
    COMPLETED_STATUSES
  );

  const [monthRows] = await query(
    `SELECT COALESCE(SUM(subtotal), 0) AS total
     FROM orders
     WHERE status IN (${COMPLETED_STATUSES.map(() => '?').join(',')})
       AND MONTH(created_at) = MONTH(NOW())
       AND YEAR(created_at) = YEAR(NOW())`,
    COMPLETED_STATUSES
  );

  const [yearRows] = await query(
    `SELECT COALESCE(SUM(subtotal), 0) AS total
     FROM orders
     WHERE status IN (${COMPLETED_STATUSES.map(() => '?').join(',')})
       AND YEAR(created_at) = YEAR(NOW())`,
    COMPLETED_STATUSES
  );

  const [byDayRows] = await query(
    `SELECT DATE(created_at) AS date, COALESCE(SUM(subtotal), 0) AS revenue
     FROM orders
     WHERE status IN (${COMPLETED_STATUSES.map(() => '?').join(',')})
       AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    COMPLETED_STATUSES
  );

  return {
    totalRevenue: parseFloat(totalRows[0].total),
    thisMonth:    parseFloat(monthRows[0].total),
    thisYear:     parseFloat(yearRows[0].total),
    byDay:        byDayRows,
  };
}

export async function getMonthlyStats() {
  const [rows] = await query(
    `SELECT
       DATE_FORMAT(created_at, '%Y-%m') AS month,
       COUNT(*) AS order_count,
       COALESCE(SUM(subtotal), 0) AS revenue
     FROM orders
     WHERE status IN (${COMPLETED_STATUSES.map(() => '?').join(',')})
       AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY DATE_FORMAT(created_at, '%Y-%m')
     ORDER BY month ASC`,
    COMPLETED_STATUSES
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

export async function getBestSellers() {
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
     WHERE o.status IN (${COMPLETED_STATUSES.map(() => '?').join(',')})
     GROUP BY oi.product_id, oi.name, c.name
     ORDER BY qty DESC
     LIMIT 5`,
    COMPLETED_STATUSES
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
