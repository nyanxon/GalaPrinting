/**
 * ReportsSection.jsx — Monthly stats, charts, and downloadable reports.
 * Equivalent to vanilla owner/sections/reportsSection.js
 *
 * Requirements: 10.1, 13.4
 */

import { useState, useEffect } from 'react';
import Chart from '../../../charts/Chart.jsx';
import {
  getMonthlyStats,
  getRevenueMetrics,
  getVisitStats,
  getTopViewedProducts,
} from '../../../../services/analyticsService.js';
import { formatCurrency } from '../../../../utils/format.js';

export default function ReportsSection() {
  const [monthly, setMonthly] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [visits, setVisits] = useState([]);
  const [topViews, setTopViews] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [monthlyData, revenueData, visitsData, topViewsData] = await Promise.all([
          getMonthlyStats(),
          getRevenueMetrics(),
          getVisitStats(30),
          getTopViewedProducts(5),
        ]);
        setMonthly(Array.isArray(monthlyData) ? monthlyData : []);
        setRevenue(revenueData);
        setVisits(Array.isArray(visitsData) ? visitsData : []);
        setTopViews(Array.isArray(topViewsData) ? topViewsData : []);
      } catch (err) {
        console.error('Failed to load reports data:', err);
      }
    }
    load();
  }, []);

  function handleViewReport(m) {
    alert(`Laporan ${m.label}\nPesanan: ${m.orders}\nRevenue: ${formatCurrency(m.revenue)}`);
  }

  function handleDownloadReport(m) {
    const content = [
      'GALA PRINTING BALI',
      `REPORT — ${m.label}`,
      '',
      `Total Pesanan: ${m.orders}`,
      `Total Revenue: ${formatCurrency(m.revenue)}`,
      '',
      'Generated: ' + new Date().toLocaleString('id-ID'),
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${m.label.replace(/\s/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Derived summary stats
  const totalOrders = monthly.reduce((s, m) => s + m.orders, 0);
  const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0);
  const bestMonth = monthly.reduce(
    (best, m) => (m.revenue > best.revenue ? m : best),
    monthly[0] || { label: '—', revenue: 0 }
  );

  // Chart data — format dates as "DD MMM" (e.g. "01 Jan")
  function fmtDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  }

  const dailyRevenueData = revenue
    ? revenue.byDay.slice(-30).map((d) => ({ label: fmtDate(d.date), value: d.revenue }))
    : [];

  const visitChartData = visits.map((v) => ({ label: fmtDate(v.date), value: v.visits }));

  const productViewData = topViews.map((p) => ({ label: p.name, value: p.views }));

  return (
    <div className="adm-card">
      {/* Report header */}
      <div className="report-header">
        <div className="report-logo">🖨️ <strong>GALA PRINTING BALI</strong></div>
        <div className="report-date">
          REPORT —{' '}
          {new Date().toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      </div>

      <h2 className="adm-section-title" style={{ margin: '20px 0 16px' }}>
        Statistik Bulanan
      </h2>

      {/* Summary cards */}
      <div className="report-summary-grid">
        <div className="report-summary-card">
          <div className="report-summary-label">Total Pesanan (12 Bln)</div>
          <div className="report-summary-value">{totalOrders}</div>
        </div>
        <div className="report-summary-card">
          <div className="report-summary-label">Total Revenue (12 Bln)</div>
          <div className="report-summary-value">{formatCurrency(totalRevenue)}</div>
        </div>
        <div className="report-summary-card">
          <div className="report-summary-label">Bulan Terbaik</div>
          <div className="report-summary-value">{bestMonth.label}</div>
          <div className="report-summary-sub">{formatCurrency(bestMonth.revenue)}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="rev-charts-grid" style={{ marginTop: '24px' }}>
        <Chart
          data={dailyRevenueData}
          type="line"
          title="Revenue Bulan Ini (Harian)"
          formatValue={(n) => formatCurrency(n)}
        />
        <Chart
          data={visitChartData}
          type="line"
          title="Website Visits (30 Hari)"
          color="#16a34a"
          formatValue={(n) => `${n} kunjungan`}
        />
      </div>

      <div style={{ marginTop: '16px' }}>
        <Chart
          data={productViewData}
          type="hbar"
          title="Produk Paling Dilihat"
          color="#2563eb"
          formatValue={(n) => `${n}x`}
        />
      </div>

      {/* Monthly report table */}
      <h3 className="adm-section-title" style={{ margin: '24px 0 12px' }}>
        Laporan Bulanan
      </h3>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Bulan</th>
              <th>Pesanan</th>
              <th>Revenue</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {monthly.length === 0 ? (
              <tr>
                <td colSpan={4} className="adm-empty">
                  Belum ada data.
                </td>
              </tr>
            ) : (
              monthly.map((m, i) => (
                <tr key={i}>
                  <td>{m.label}</td>
                  <td>{m.orders}</td>
                  <td>{formatCurrency(m.revenue)}</td>
                  <td>
                    <div className="adm-actions">
                      <button
                        className="adm-btn adm-btn--edit"
                        type="button"
                        onClick={() => handleViewReport(m)}
                      >
                        Lihat
                      </button>
                      <button
                        className="adm-btn adm-btn--primary"
                        type="button"
                        onClick={() => handleDownloadReport(m)}
                      >
                        Unduh
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
