/**
 * RevenueSection.jsx — Revenue summary with KPI cards and charts.
 * Equivalent to vanilla owner/sections/revenueSection.js
 *
 * Requirements: 10.1, 10.2, 13.4
 */

import { useState, useEffect } from 'react';
import Chart from '../../../charts/Chart.jsx';
import {
  getRevenueMetrics,
  getMonthlyStats,
} from '../../../../services/analyticsService.js';
import { listAllOrders } from '../../../../services/orderService.js';
import { formatCurrency } from '../../../../core/helpers.js';

export default function RevenueSection() {
  const [metrics, setMetrics] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [metricsData, monthlyData, ordersData] = await Promise.all([
          getRevenueMetrics(),
          getMonthlyStats(),
          listAllOrders(),
        ]);
        setMetrics(metricsData);
        setMonthly(Array.isArray(monthlyData) ? monthlyData : []);
        setOrders(Array.isArray(ordersData) ? ordersData.slice(0, 20) : []);
      } catch (err) {
        console.error('Failed to load revenue data:', err);
      }
    }
    load();
  }, []);

  if (!metrics) {
    return (
      <div className="adm-card">
        <div className="owner-loading">Memuat data revenue…</div>
      </div>
    );
  }

  // Daily revenue chart data (last 30 days) — format as "DD MMM"
  function fmtDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  }

  const dailyChartData = metrics.byDay.map((d) => ({
    label: fmtDate(d.date),
    value: d.revenue,
  }));

  // Monthly revenue chart data
  const monthlyChartData = monthly.map((m) => ({
    label: m.label,
    value: m.revenue,
  }));

  return (
    <div className="adm-card rev-section">
      <h2 className="adm-section-title" style={{ marginBottom: '20px' }}>Revenue</h2>

      {/* KPI Cards */}
      <div className="rev-kpi-row">
        <div className="rev-kpi-card">
          <div className="rev-kpi-label">Revenue Bulan Ini</div>
          <div className="rev-kpi-value">{formatCurrency(metrics.thisMonth)}</div>
        </div>
        <div className="rev-kpi-card">
          <div className="rev-kpi-label">Revenue Tahun Ini</div>
          <div className="rev-kpi-value">{formatCurrency(metrics.thisYear)}</div>
        </div>
        <div className="rev-kpi-card rev-kpi-card--total">
          <div className="rev-kpi-label">Total Revenue</div>
          <div className="rev-kpi-value">{formatCurrency(metrics.totalRevenue)}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="rev-charts-grid">
        <Chart
          data={dailyChartData}
          type="line"
          title="Revenue Harian (30 Hari Terakhir)"
          formatValue={(n) => formatCurrency(n)}
        />
        <Chart
          data={monthlyChartData}
          type="line"
          title="Revenue Bulanan (12 Bulan)"
          color="#2563eb"
          formatValue={(n) => formatCurrency(n)}
        />
      </div>

      {/* Invoice-style order list */}
      <div className="invoice-section">
        <h3 className="invoice-section-title">Daftar Pesanan Terbaru</h3>
        <div className="invoice-list">
          {orders.length === 0 ? (
            <div className="chart-empty">Belum ada pesanan.</div>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="invoice-row">
                <div className="invoice-row-left">
                  <div className="invoice-num">{o.orderNumber}</div>
                  <div className="invoice-customer">{o.customer?.name || '—'}</div>
                </div>
                <div className="invoice-row-right">
                  <span
                    className={`invoice-status invoice-status--${o.status
                      .toLowerCase()
                      .replace(/\s/g, '-')}`}
                  >
                    {o.status}
                  </span>
                  <span className="invoice-amount">{formatCurrency(o.subtotal)}</span>
                  <span className="invoice-date">
                    {new Date(o.createdAt).toLocaleDateString('id-ID')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
