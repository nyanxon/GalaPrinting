/**
 * AnalyticsSection.jsx — Visit analytics, product views, and best sellers.
 * Equivalent to vanilla owner/sections/analyticsSection.js
 *
 * Requirements: 10.1, 10.2, 10.3, 13.4
 */

import { useState, useEffect } from 'react';
import Chart from '../../../charts/Chart.jsx';
import {
  getTotalVisits,
  getVisitStats,
  getTopViewedProducts,
  getBestSellers,
  recordVisit,
} from '../../../../services/analyticsService.js';
import { formatCurrency } from '../../../../core/helpers.js';

export default function AnalyticsSection() {
  const [totalVisits, setTotalVisits] = useState(0);
  const [visitData, setVisitData] = useState([]);
  const [topViewed, setTopViewed] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);

  useEffect(() => {
    // Record this visit, equivalent to vanilla implementation
    try {
      recordVisit();
    } catch (err) {
      console.error('Failed to record visit:', err);
    }

    async function load() {
      try {
        const [totalVisitsCount, visitStatsData, topViewedData, bestSellersData] = await Promise.all([
          getTotalVisits(),
          getVisitStats(30),
          getTopViewedProducts(5),
          getBestSellers(5),
        ]);
        setTotalVisits(totalVisitsCount);
        setVisitData(Array.isArray(visitStatsData) ? visitStatsData : []);
        setTopViewed(Array.isArray(topViewedData) ? topViewedData : []);
        setBestSellers(Array.isArray(bestSellersData) ? bestSellersData : []);
      } catch (err) {
        console.error('Failed to load analytics data:', err);
      }
    }
    load();
  }, []);

  const totalProductViews = topViewed.reduce((s, p) => s + p.views, 0);

  // Chart data — format date as "DD MMM" (e.g. "01 Jan")
  function fmtDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  }

  const visitChartData = visitData.map((v) => ({
    label: fmtDate(v.date),
    value: v.visits,
  }));

  const viewedChartData = topViewed.map((p) => ({
    label: p.name,
    value: p.views,
  }));

  return (
    <div className="adm-card">
      <h2 className="adm-section-title" style={{ marginBottom: '20px' }}>Analytics</h2>

      {/* KPI Cards */}
      <div className="rev-kpi-row">
        <div className="rev-kpi-card">
          <div className="rev-kpi-label">Total Website Visits</div>
          <div className="rev-kpi-value">{totalVisits.toLocaleString('id-ID')}</div>
        </div>
        <div className="rev-kpi-card">
          <div className="rev-kpi-label">Produk Dilihat</div>
          <div className="rev-kpi-value">{totalProductViews.toLocaleString('id-ID')}</div>
        </div>
        <div className="rev-kpi-card">
          <div className="rev-kpi-label">Best Seller</div>
          <div className="rev-kpi-value" style={{ fontSize: '16px' }}>
            {bestSellers[0]?.name || '—'}
          </div>
          {bestSellers[0] && (
            <div className="rev-kpi-sub">{bestSellers[0].qty} terjual</div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="rev-charts-grid" style={{ marginTop: '24px' }}>
        <Chart
          data={visitChartData}
          type="line"
          title="Website Visits (30 Hari Terakhir)"
          color="#16a34a"
          formatValue={(n) => `${n}`}
        />
        <Chart
          data={viewedChartData}
          type="hbar"
          title="Produk Paling Dilihat"
          color="#2563eb"
          formatValue={(n) => `${n}x`}
        />
      </div>

      {/* Best sellers table */}
      <h3 className="adm-section-title" style={{ margin: '24px 0 12px' }}>
        Best Seller Products
      </h3>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Produk</th>
              <th>Kategori</th>
              <th>Terjual</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {bestSellers.length === 0 ? (
              <tr>
                <td colSpan={5} className="adm-empty">
                  Belum ada data penjualan.
                </td>
              </tr>
            ) : (
              bestSellers.map((p, i) => (
                <tr key={p.productId}>
                  <td>{i + 1}</td>
                  <td>{p.name}</td>
                  <td>{p.category}</td>
                  <td>{p.qty}</td>
                  <td>{formatCurrency(p.revenue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
