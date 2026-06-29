/**
 * services/analyticsService.js
 *
 * Shared analytics data source for Admin & Owner dashboards.
 * When USE_BACKEND=true: calls /api/analytics/* endpoints.
 * When USE_BACKEND=false: all metrics are derived from orderService + productService
 *   and website visits/product views are tracked in localStorage.
 *
 * All revenue/monthly/best-sellers functions now accept an optional `filters` object:
 *   {
 *     from:       string (YYYY-MM-DD)
 *     to:         string (YYYY-MM-DD)
 *     categoryId: string
 *     customerId: string
 *     status:     string
 *   }
 *
 * Requirements: 16.1
 */

import { readJson, writeJson } from "../core/storage.js";
import { USE_BACKEND, api } from "../core/httpClient.js";
import { listAllOrders } from "./orderService.js";
import { listProducts } from "./productService.js";

const VISITS_KEY   = "gala.analytics.visits";
const VIEWS_KEY    = "gala.analytics.productViews";

const COMPLETED_STATUSES = new Set(['Finished', 'In Delivery', 'Quality Checking', 'On Progress']);

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

/* ── Filter helpers (localStorage fallback) ──────────────── */

function isSameMonth(isoDate, year, month) {
  const d = new Date(isoDate);
  return d.getFullYear() === year && d.getMonth() === month;
}

function isSameYear(isoDate, year) {
  return new Date(isoDate).getFullYear() === year;
}

/**
 * Filter an orders array by the same criteria the backend applies.
 * Mirrors buildFilterClauses() in analytics.service.js exactly.
 */
function applyFilters(orders, filters = {}) {
  const { from, to, categoryId, customerId, status } = filters;
  return orders.filter((o) => {
    // Status filter
    if (status) {
      if (o.status !== status) return false;
    } else {
      if (!COMPLETED_STATUSES.has(o.status)) return false;
    }

    // Date range
    const orderDate = (o.createdAt ?? '').slice(0, 10);
    if (from && orderDate < from) return false;
    if (to   && orderDate > to)   return false;

    // Customer
    if (customerId && o.customerId !== customerId) return false;

    // Category — check if any order item's product belongs to this category
    if (categoryId) {
      const hasCategory = (o.items || []).some((item) => item.categoryId === categoryId);
      if (!hasCategory) return false;
    }

    return true;
  });
}

/** Shift a date range one period earlier (for comparison) */
function shiftPeriodBack(from, to) {
  const fromDate = new Date(from);
  const toDate   = new Date(to);
  const diffMs   = toDate.getTime() - fromDate.getTime() + 86400000; // +1 day inclusive
  const newTo    = new Date(fromDate.getTime() - 86400000);          // day before from
  const newFrom  = new Date(newTo.getTime() - diffMs + 86400000);
  return {
    from: newFrom.toISOString().slice(0, 10),
    to:   newTo.toISOString().slice(0, 10),
  };
}

/* ── Revenue helpers ─────────────────────────────────────── */

/**
 * Get full revenue metrics for the dashboard.
 * Replaces the old getRevenueMetrics() — returns richer data.
 *
 * @param {object} [filters]
 * @returns {Promise<object>}
 */
export async function getRevenueMetrics(filters = {}) {
  if (USE_BACKEND) {
    const params = { ...filters };
    const res = await api.get('/api/analytics/revenue', { params });
    const data = res.data.data;
    // Normalise byDay dates — MySQL may return Date objects
    if (data?.byDay) {
      data.byDay = data.byDay.map((r) => ({
        date:    typeof r.date === 'object' ? r.date.toISOString?.().slice(0, 10) : String(r.date).slice(0, 10),
        revenue: Number(r.revenue ?? 0),
        profit:  Number(r.profit  ?? 0),
        orders:  Number(r.orders  ?? 0),
      }));
    }
    return data;
  }

  // ── localStorage fallback ──────────────────────────────────
  const allOrders  = listAllOrders();
  const orders     = applyFilters(allOrders, filters);
  const now        = new Date();
  const year       = now.getFullYear();
  const month      = now.getMonth();

  // Compute previous period for comparison
  let prevOrders;
  if (filters.from && filters.to) {
    const { from: pFrom, to: pTo } = shiftPeriodBack(filters.from, filters.to);
    prevOrders = applyFilters(allOrders, { ...filters, from: pFrom, to: pTo });
  } else {
    const prevYear  = month === 0 ? year - 1 : year;
    const prevMonth = month === 0 ? 11 : month - 1;
    prevOrders = applyFilters(allOrders, {
      ...filters,
      from: new Date(prevYear, prevMonth, 1).toISOString().slice(0, 10),
      to:   new Date(prevYear, prevMonth + 1, 0).toISOString().slice(0, 10),
    });
  }

  function sumField(arr, field) {
    return arr.reduce((s, o) => s + (Number(o[field]) || 0), 0);
  }
  function uniqueCustomers(arr) {
    return new Set(arr.map((o) => o.customerId).filter(Boolean)).size;
  }

  const totalRevenue  = sumField(orders, 'subtotal');
  const totalDiscount = sumField(orders, 'discountAmount');
  const totalRefunds  = sumField(orders, 'refundAmount');
  const totalShipping = sumField(orders, 'shippingCost');
  const totalTax      = sumField(orders, 'taxAmount');
  const totalProfit   = totalRevenue - totalDiscount - totalRefunds - totalShipping;
  const orderCount    = orders.length;
  const customerCount = uniqueCustomers(orders);
  const aov           = orderCount > 0 ? totalRevenue / orderCount : 0;

  const returningCustomers = Array.from(
    orders.reduce((map, o) => {
      if (o.customerId) map.set(o.customerId, (map.get(o.customerId) || 0) + 1);
      return map;
    }, new Map())
  ).filter(([, cnt]) => cnt > 1).length;

  // Legacy compat fields
  const thisMonth = applyFilters(allOrders, {
    ...filters,
    from: new Date(year, month, 1).toISOString().slice(0, 10),
    to:   new Date(year, month + 1, 0).toISOString().slice(0, 10),
  }).reduce((s, o) => s + (o.subtotal || 0), 0);

  const thisYear = applyFilters(allOrders, {
    ...filters,
    from: `${year}-01-01`,
    to:   `${year}-12-31`,
  }).reduce((s, o) => s + (o.subtotal || 0), 0);

  // Revenue by day (last 30 days or filtered range)
  const rangeFrom = filters.from
    ? new Date(filters.from)
    : new Date(now.getTime() - 29 * 86400000);
  const rangeTo = filters.to ? new Date(filters.to) : now;
  const byDay = [];
  for (let d = new Date(rangeFrom); d <= rangeTo; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const dayOrders = orders.filter((o) => (o.createdAt ?? '').slice(0, 10) === dateStr);
    byDay.push({
      date:    dateStr,
      revenue: dayOrders.reduce((s, o) => s + (o.subtotal || 0), 0),
      profit:  dayOrders.reduce((s, o) => s + (o.subtotal - (o.discountAmount || 0) - (o.refundAmount || 0) - (o.shippingCost || 0)), 0),
      orders:  dayOrders.length,
    });
  }

  // Revenue by category (derive from item.categoryId or item.category if available)
  const catMap = {};
  orders.forEach((o) => {
    (o.items || []).forEach((item) => {
      const key = item.categoryId || item.category || 'Lainnya';
      if (!catMap[key]) catMap[key] = { category_id: key, category_name: item.category || key, revenue: 0 };
      catMap[key].revenue += item.price * item.quantity;
    });
  });
  const byCategory = Object.values(catMap).sort((a, b) => b.revenue - a.revenue);

  // Revenue by payment method
  const sourceMap = {};
  orders.forEach((o) => {
    const key = o.paymentMethod || 'Tidak Diketahui';
    if (!sourceMap[key]) sourceMap[key] = { source: key, revenue: 0, orders: 0 };
    sourceMap[key].revenue += o.subtotal || 0;
    sourceMap[key].orders++;
  });
  const bySources = Object.values(sourceMap).sort((a, b) => b.revenue - a.revenue);

  return {
    totalRevenue,
    totalShipping,
    totalDiscount,
    totalTax,
    totalRefunds,
    totalProfit,
    orderCount,
    customerCount,
    aov,
    returningCustomers,
    thisMonth,
    thisYear,
    byDay,
    byCategory,
    bySources,
    prev: {
      totalRevenue:  sumField(prevOrders, 'subtotal'),
      totalProfit:   prevOrders.reduce((s, o) => s + (o.subtotal - (o.discountAmount || 0) - (o.refundAmount || 0) - (o.shippingCost || 0)), 0),
      orderCount:    prevOrders.length,
      customerCount: uniqueCustomers(prevOrders),
      totalRefunds:  sumField(prevOrders, 'refundAmount'),
      aov:           prevOrders.length > 0 ? sumField(prevOrders, 'subtotal') / prevOrders.length : 0,
    },
  };
}

/**
 * Get monthly revenue for the past 12 months.
 * @param {object} [filters]
 * @returns {Promise<Array<{label:string, revenue:number, profit:number, orders:number}>>}
 */
export async function getMonthlyStats(filters = {}) {
  if (USE_BACKEND) {
    const res = await api.get('/api/analytics/monthly', { params: filters });
    return (res.data.data || []).map((r) => ({
      label:   r.month ?? r.label,
      orders:  Number(r.order_count ?? r.orders ?? 0),
      revenue: Number(r.revenue ?? 0),
      profit:  Number(r.profit  ?? 0),
    }));
  }
  // localStorage fallback
  const allOrders = listAllOrders();
  const now       = new Date();
  const result    = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const monthFrom = new Date(y, m, 1).toISOString().slice(0, 10);
    const monthTo   = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    const label = d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
    const monthOrders = applyFilters(allOrders, { ...filters, from: monthFrom, to: monthTo });
    const revenue = monthOrders.reduce((s, o) => s + (o.subtotal || 0), 0);
    const profit  = monthOrders.reduce((s, o) => s + (o.subtotal - (o.discountAmount || 0) - (o.refundAmount || 0) - (o.shippingCost || 0)), 0);
    result.push({ label, revenue, profit, orders: monthOrders.length });
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

/* ── Best sellers ────────────────────────────────────────── */

/**
 * Get best-selling products by quantity sold.
 * @param {number} n
 * @param {object} [filters]
 * @returns {Promise<Array<{productId:string, name:string, category:string, qty:number, revenue:number}>>}
 */
export async function getBestSellers(n = 5, filters = {}) {
  if (USE_BACKEND) {
    const res = await api.get('/api/analytics/best-sellers', { params: filters });
    return res.data.data;
  }
  // localStorage fallback
  const allOrders = listAllOrders();
  const orders    = applyFilters(allOrders, filters);
  const products  = await listProducts();
  const map       = {};

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
