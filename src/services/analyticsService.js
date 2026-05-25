/**
 * services/analyticsService.js
 *
 * Shared analytics data source for Admin & Owner dashboards.
 * When USE_BACKEND=true: calls /api/analytics/* endpoints.
 * When USE_BACKEND=false: all metrics are derived from orderService + productService
 *   and website visits/product views are tracked in localStorage.
 *
 * Requirements: 16.1
 */

import { readJson, writeJson } from "../core/storage.js";
import { USE_BACKEND, api } from "../core/httpClient.js";
import { listAllOrders } from "./orderService.js";
import { listProducts } from "./productService.js";

const VISITS_KEY   = "gala.analytics.visits";
const VIEWS_KEY    = "gala.analytics.productViews";

/* ── Visit tracking ──────────────────────────────────────── */

/** Record a page visit (call from main.js on customer pages) */
export async function recordVisit() {
  if (USE_BACKEND) {
    try {
      await api.post('/api/analytics/visit');
    } catch {
      // fire-and-forget; ignore errors
    }
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const data  = readJson(VISITS_KEY, {});
  data[today] = (data[today] || 0) + 1;
  writeJson(VISITS_KEY, data);
}

/** Record a product view */
export async function recordProductView(productId) {
  if (USE_BACKEND) {
    try {
      await api.post('/api/analytics/product-view', { productId });
    } catch {
      // fire-and-forget; ignore errors
    }
    return;
  }
  const data = readJson(VIEWS_KEY, {});
  data[productId] = (data[productId] || 0) + 1;
  writeJson(VIEWS_KEY, data);
}

/* ── Revenue helpers ─────────────────────────────────────── */

function isSameMonth(isoDate, year, month) {
  const d = new Date(isoDate);
  return d.getFullYear() === year && d.getMonth() === month;
}

function isSameYear(isoDate, year) {
  return new Date(isoDate).getFullYear() === year;
}

/**
 * Get revenue metrics.
 * @returns {Promise<{ totalRevenue: number, thisMonth: number, thisYear: number, byDay: Array<{date:string,revenue:number}> }>}
 */
export async function getRevenueMetrics() {
  if (USE_BACKEND) {
    const res = await api.get('/api/analytics/revenue');
    const data = res.data.data;
    // Normalise byDay dates — MySQL may return Date objects
    if (data?.byDay) {
      data.byDay = data.byDay.map((r) => ({
        date:    typeof r.date === 'object' ? r.date.toISOString?.().slice(0, 10) : String(r.date).slice(0, 10),
        revenue: Number(r.revenue ?? 0),
      }));
    }
    return data;
  }
  // localStorage fallback
  const orders = listAllOrders();
  const now    = new Date();
  const year   = now.getFullYear();
  const month  = now.getMonth();

  const totalRevenue = orders.reduce((s, o) => s + (o.subtotal || 0), 0);
  const thisMonth    = orders
    .filter((o) => isSameMonth(o.createdAt, year, month))
    .reduce((s, o) => s + (o.subtotal || 0), 0);
  const thisYear     = orders
    .filter((o) => isSameYear(o.createdAt, year))
    .reduce((s, o) => s + (o.subtotal || 0), 0);

  // Revenue by day — last 30 days
  const byDay = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const revenue = orders
      .filter((o) => o.createdAt.slice(0, 10) === dateStr)
      .reduce((s, o) => s + (o.subtotal || 0), 0);
    byDay.push({ date: dateStr, revenue });
  }

  return { totalRevenue, thisMonth, thisYear, byDay };
}

/**
 * Get monthly revenue for the past 12 months.
 * @returns {Promise<Array<{label:string, revenue:number, orders:number}>>}
 */
export async function getMonthlyStats() {
  if (USE_BACKEND) {
    const res = await api.get('/api/analytics/monthly');
    // Backend returns { month: 'YYYY-MM', order_count, revenue } — normalise to { label, orders, revenue }
    return (res.data.data || []).map((r) => ({
      label:   r.month ?? r.label,
      orders:  Number(r.order_count ?? r.orders ?? 0),
      revenue: Number(r.revenue ?? 0),
    }));
  }
  // localStorage fallback
  const orders = listAllOrders();
  const now    = new Date();
  const result = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const label = d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
    const monthOrders = orders.filter((o) => isSameMonth(o.createdAt, y, m));
    result.push({
      label,
      revenue: monthOrders.reduce((s, o) => s + (o.subtotal || 0), 0),
      orders:  monthOrders.length,
    });
  }
  return result;
}

/* ── Website visits ──────────────────────────────────────── */

/**
 * Get daily visit counts for the last N days.
 * @param {number} days
 * @returns {Promise<Array<{date:string, visits:number}>>}
 */
export async function getVisitStats(days = 30) {
  if (USE_BACKEND) {
    const res = await api.get('/api/analytics/visits');
    // Backend returns { date, count } — normalise to { date, visits }
    return (res.data.data || []).map((r) => ({
      date:   typeof r.date === 'object' ? r.date.toISOString?.().slice(0, 10) : String(r.date).slice(0, 10),
      visits: Number(r.count ?? r.visits ?? 0),
    }));
  }
  // localStorage fallback
  const data = readJson(VISITS_KEY, {});
  const now  = new Date();
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    result.push({ date: dateStr, visits: data[dateStr] || 0 });
  }
  return result;
}

/**
 * Get total website visits (all time).
 * @returns {Promise<number>}
 */
export async function getTotalVisits() {
  if (USE_BACKEND) {
    try {
      const res = await api.get('/api/analytics/visits/total');
      return Number(res.data.data?.total ?? 0);
    } catch {
      return 0;
    }
  }
  const data = readJson(VISITS_KEY, {});
  return Object.values(data).reduce((s, v) => s + v, 0);
}

/* ── Product views ───────────────────────────────────────── */

/**
 * Get top N most-viewed products.
 * @param {number} n
 * @returns {Promise<Array<{productId:string, name:string, category:string, views:number}>>}
 */
export async function getTopViewedProducts(n = 5) {
  if (USE_BACKEND) {
    try {
      const res = await api.get('/api/analytics/product-views', { params: { limit: n } });
      return (res.data.data || []).map((r) => ({
        productId: r.product_id ?? r.productId,
        name:      r.name,
        category:  r.category ?? '—',
        views:     Number(r.views ?? 0),
      }));
    } catch {
      return [];
    }
  }
  // localStorage fallback
  const data     = readJson(VIEWS_KEY, {});
  const products = await listProducts();
  return Object.entries(data)
    .map(([id, views]) => {
      const p = products.find((p) => p.id === id);
      return { productId: id, name: p?.name || id, category: p?.category || "—", views };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, n);
}

/* ── Best seller ─────────────────────────────────────────── */

/**
 * Get best-selling products by quantity sold.
 * @param {number} n
 * @returns {Promise<Array<{productId:string, name:string, category:string, qty:number, revenue:number}>>}
 */
export async function getBestSellers(n = 5) {
  if (USE_BACKEND) {
    const res = await api.get('/api/analytics/best-sellers');
    return res.data.data;
  }
  // localStorage fallback
  const orders   = listAllOrders();
  const products = await listProducts();
  const map      = {};

  orders.forEach((o) => {
    (o.items || []).forEach((item) => {
      if (!map[item.productId]) map[item.productId] = { qty: 0, revenue: 0 };
      map[item.productId].qty     += item.quantity;
      map[item.productId].revenue += item.price * item.quantity;
    });
  });

  return Object.entries(map)
    .map(([id, stats]) => {
      const p = products.find((p) => p.id === id);
      return { productId: id, name: p?.name || id, category: p?.category || "—", ...stats };
    })
    .sort((a, b) => b.qty - a.qty)
    .slice(0, n);
}
