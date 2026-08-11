/**
 * RevenueSection.jsx — Full analytics & reporting dashboard for the owner.
 * Phases 1–7: filter bar, 6 KPI cards with sparklines, multi-series trend,
 * donut charts, breakdown card, monthly comparison, top products, recent orders
 * table, export, and quick insights.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, ShoppingCart, Users, DollarSign,
  AlertCircle, BarChart2, ArrowUpRight, ArrowDownRight, Trash2,
} from 'lucide-react';
import Chart, { Sparkline } from '../../../charts/Chart.jsx';
import DashboardFilterBar from '../DashboardFilterBar.jsx';
import {
  getRevenueMetrics,
  getMonthlyStats,
  getBestSellers,
  resetRevenueData,
} from '../../../../services/analyticsService.js';
import {
  listOrdersPaginated,
  getOrderById,
  STATUS_CONFIG,
} from '../../../../services/orders.js';
import { listCategories } from '../../../../services/categories.js';
import { formatCurrency } from '../../../../utils/format.js';
import OrderDetailModal from '../../../modals/OrderDetailModal.jsx';
import PaginationBar from '../../../ui/PaginationBar.jsx';

/* ── helpers ───────────────────────────────────────────────── */
function pctChange(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function fmtDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

function fmtPct(n) {
  const abs = Math.abs(n);
  return `${n >= 0 ? '+' : '−'}${abs.toFixed(1)}%`;
}

function buildFiltersForApi(filters) {
  const { from, to, categoryId, status } = filters;
  const params = {};
  if (from)       params.from       = from;
  if (to)         params.to         = to;
  if (categoryId) params.categoryId = categoryId;
  if (status)     params.status     = status;
  return params;
}

/* ── Skeleton card ─────────────────────────────────────────── */
function SkeletonCard({ height = 90 }) {
  return (
    <div
      className="rev-skeleton"
      style={{ height, borderRadius: 14 }}
      aria-hidden="true"
    />
  );
}

/* ── KPI Card ──────────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, prev, sparkData, color, tooltip, onClick }) {
  const change = pctChange(value, prev);
  const up     = change >= 0;

  return (
    <button
      type="button"
      className="rev-kpi-card rev-kpi-card--v2"
      style={{ '--kpi-color': color }}
      onClick={onClick}
      title={tooltip}
      aria-label={`${label}: ${value}`}
    >
      <div className="rev-kpi-v2-top">
        <div className="rev-kpi-v2-icon" aria-hidden="true">
          <Icon size={18} />
        </div>
        <div className="rev-kpi-v2-label">{label}</div>
      </div>
      <div className="rev-kpi-v2-value">{value}</div>
      <div className="rev-kpi-v2-bottom">
        <span className={`rev-kpi-change rev-kpi-change--${up ? 'up' : 'down'}`}>
          {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {fmtPct(change)}
        </span>
        <span className="rev-kpi-vs">vs periode sebelumnya</span>
        {sparkData && sparkData.length > 1 && (
          <Sparkline data={sparkData} color={up ? '#16a34a' : '#dc2626'} />
        )}
      </div>
    </button>
  );
}

/* ── Export helpers ────────────────────────────────────────── */
function exportCsv(orders) {
  const headers = ['Invoice', 'Customer', 'Status', 'Metode Bayar', 'Subtotal', 'Diskon', 'Tanggal'];
  const rows = orders.map((o) => [
    o.orderNumber,
    o.customer?.name || '',
    o.status,
    o.paymentMethod || '',
    o.subtotal,
    o.discountAmount || 0,
    new Date(o.createdAt).toLocaleDateString('id-ID'),
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `revenue-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportExcel(orders) {
  // Simple TSV wrapped as .xls (Excel opens natively)
  const headers = ['Invoice', 'Customer', 'Status', 'Metode Bayar', 'Subtotal', 'Diskon', 'Tanggal'];
  const rows = orders.map((o) => [
    o.orderNumber,
    o.customer?.name || '',
    o.status,
    o.paymentMethod || '',
    o.subtotal,
    o.discountAmount || 0,
    new Date(o.createdAt).toLocaleDateString('id-ID'),
  ]);
  const tsv = [headers, ...rows].map((r) => r.join('\t')).join('\n');
  const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `revenue-export-${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPdf(metrics, monthly) {
  // Opens a minimal print-ready page in a new tab
  const lines = [
    '<html><head><meta charset="utf-8"><title>Revenue Report</title>',
    '<style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}',
    'th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}th{background:#f5f5f5}</style>',
    '</head><body>',
    `<h1>Revenue Report — ${new Date().toLocaleDateString('id-ID')}</h1>`,
    `<p>Total Revenue: <strong>${formatCurrency(metrics?.totalRevenue || 0)}</strong></p>`,
    `<p>Profit: <strong>${formatCurrency(metrics?.totalProfit || 0)}</strong></p>`,
    `<p>Orders: <strong>${metrics?.orderCount || 0}</strong></p>`,
    '<h2>Monthly Summary</h2><table><tr><th>Bulan</th><th>Orders</th><th>Revenue</th><th>Profit</th></tr>',
    ...monthly.map((m) => `<tr><td>${m.label}</td><td>${m.orders}</td><td>${formatCurrency(m.revenue)}</td><td>${formatCurrency(m.profit || 0)}</td></tr>`),
    '</table></body></html>',
  ].join('');
  const win = window.open('', '_blank');
  if (win) { win.document.write(lines); win.document.close(); win.print(); }
}

/* ── ResetRevenueModal ─────────────────────────────────────── */

/**
 * Two-step confirmation modal for the destructive revenue reset action.
 *
 * Step 1: Displays what will be deleted with a stern warning.
 * Step 2: User must type the word "RESET" exactly before the confirm button enables.
 */
function ResetRevenueModal({ onClose, onConfirmed }) {
  const [typedWord, setTypedWord]   = useState('');
  const [note, setNote]             = useState('');
  const [resetting, setResetting]   = useState(false);
  const [error, setError]           = useState('');

  const confirmed = typedWord === 'RESET';

  async function handleReset() {
    if (!confirmed) return;
    setResetting(true);
    setError('');
    try {
      const result = await resetRevenueData({ note });
      if (!result.ok) {
        setError(result.message || 'Reset gagal.');
        return;
      }
      onConfirmed(result.data);
    } catch (err) {
      setError(err?.message || 'Terjadi kesalahan tak terduga.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="adm-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title">
      <div className="adm-modal" style={{ maxWidth: 520 }}>

        {/* Header */}
        <div className="adm-modal-header" style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
          <h2 className="adm-modal-title" id="reset-modal-title" style={{ color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trash2 size={18} aria-hidden="true" />
            Hapus Semua Data Revenue
          </h2>
          <button className="adm-modal-close" type="button" aria-label="Tutup" onClick={onClose} disabled={resetting}>
            ✕
          </button>
        </div>

        <div className="adm-modal-body">
          {/* Warning block */}
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
          }}>
            <p style={{ fontWeight: 700, color: '#b91c1c', margin: '0 0 8px' }}>
              ⚠️ Tindakan ini tidak dapat dibatalkan.
            </p>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#374151' }}>
              Data berikut akan dihapus permanen:
            </p>
            <ul style={{ margin: '0 0 8px', paddingLeft: 20, fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
              <li>Semua <strong>pesanan</strong> (orders, order items, riwayat status)</li>
              <li>Semua data <strong>kunjungan website</strong> (analytics_visits)</li>
              <li>Semua data <strong>tampilan produk</strong> (analytics_product_views)</li>
              <li>Nomor urut pesanan akan <strong>direset ke awal</strong></li>
            </ul>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
              Data yang <strong>tidak</strong> dihapus: produk, kategori, pelanggan, ulasan, promo, percakapan.
            </p>
          </div>

          {/* Optional reason */}
          <div className="adm-field" style={{ marginBottom: 16 }}>
            <label className="adm-label" htmlFor="reset-note">
              Alasan reset <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opsional, maks. 500 karakter)</span>
            </label>
            <textarea
              id="reset-note"
              className="adm-input"
              rows={2}
              maxLength={500}
              placeholder="Misalnya: awal periode baru, migrasi sistem…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={resetting}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {/* Confirmation word */}
          <div className="adm-field" style={{ marginBottom: 20 }}>
            <label className="adm-label" htmlFor="reset-confirm-word">
              Ketik <strong style={{ color: '#b91c1c', letterSpacing: 1 }}>RESET</strong> untuk mengkonfirmasi:
            </label>
            <input
              id="reset-confirm-word"
              className="adm-input"
              type="text"
              placeholder="RESET"
              value={typedWord}
              onChange={(e) => setTypedWord(e.target.value)}
              disabled={resetting}
              autoComplete="off"
              spellCheck={false}
              style={{ fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}
            />
          </div>

          {error && (
            <div className="adm-form-alert" role="alert" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="adm-form-actions">
            <button
              type="button"
              className="adm-btn"
              onClick={onClose}
              disabled={resetting}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={!confirmed || resetting}
              style={{
                background: confirmed ? '#b91c1c' : '#e5e7eb',
                color: confirmed ? '#fff' : '#9ca3af',
                border: 'none',
                borderRadius: 6,
                padding: '8px 20px',
                fontWeight: 700,
                cursor: confirmed && !resetting ? 'pointer' : 'not-allowed',
                transition: 'background 0.15s',
              }}
            >
              {resetting ? 'Menghapus…' : '🗑️ Hapus Semua Data'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ────────────────────────────────────────── */
export default function RevenueSection() {
  // Filter state — lazy initializer so Date.now() is only called once on mount
  const [filters, setFilters] = useState(() => {
    const now = new Date();
    const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`;
    return { preset: '30d', from, to, categoryId: '', status: '' };
  });

  // Data state
  const [metrics,     setMetrics]     = useState(null);
  const [monthly,     setMonthly]     = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [orders,      setOrders]      = useState({ items: [], total: 0, page: 1, limit: 10, totalPages: 1 });
  const [orderPage,   setOrderPage]   = useState(1);

  // UI state
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  // Track minutes-since-last-update as state so Date.now() is never called during render
  const [minutesAgo,  setMinutesAgo]  = useState(0);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [activeSeriesKeys, setActiveSeriesKeys] = useState(new Set(['revenue', 'profit', 'orders']));

  // Reset modal
  const [resetOpen,    setResetOpen]    = useState(false);
  const [resetResult,  setResetResult]  = useState(null);

  // Load categories once
  useEffect(() => {
    listCategories().then((cats) => setCategories(Array.isArray(cats) ? cats : [])).catch(() => {});
  }, []);

  // Keep minutesAgo in sync with lastUpdated — recalculates every 30 s
  useEffect(() => {
    if (!lastUpdated) return;
    const calc = () => setMinutesAgo(Math.round((Date.now() - lastUpdated.getTime()) / 60000));
    calc();
    const id = setInterval(calc, 30_000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  // Main data fetch — re-runs whenever filters or orderPage change
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiFilters = buildFiltersForApi(filters);
      const [metricsData, monthlyData, sellersData, ordersData] = await Promise.all([
        getRevenueMetrics(apiFilters),
        getMonthlyStats(apiFilters),
        getBestSellers(5, apiFilters),
        listOrdersPaginated({
          page:   orderPage,
          limit:  10,
          status: filters.status || undefined,
        }),
      ]);
      setMetrics(metricsData);
      setMonthly(Array.isArray(monthlyData) ? monthlyData : []);
      setBestSellers(Array.isArray(sellersData) ? sellersData : []);
      setOrders(ordersData || { items: [], total: 0, page: 1, limit: 10, totalPages: 1 });
      setLastUpdated(new Date());
    } catch (err) {
      console.error('RevenueSection load error:', err);
      setError('Gagal memuat data. Klik "Coba Lagi" untuk refresh.');
    } finally {
      setLoading(false);
    }
  }, [filters, orderPage]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function handleFilterChange(partial) {
    setFilters((prev) => ({ ...prev, ...partial }));
    setOrderPage(1);
  }

  function handleToggleSeries(key) {
    setActiveSeriesKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  }

  async function handleOrderDetail(orderId) {
    try {
      const order = await getOrderById(orderId);
      if (order) { setSelectedOrder(order); setDetailOpen(true); }
    } catch (err) { console.error(err); }
  }

  function handleExport(format) {
    if (format === 'csv')   exportCsv(orders.items);
    if (format === 'excel') exportExcel(orders.items);
    if (format === 'pdf')   exportPdf(metrics, monthly);
  }

  /* ── Derived chart data ───────────────────────────────────── */
  const trendData = (metrics?.byDay || []).map((d) => ({
    label:   fmtDate(d.date),
    revenue: d.revenue  || 0,
    profit:  d.profit   || 0,
    orders:  d.orders   || 0,
  }));

  const trendSeries = [
    { key: 'revenue', label: 'Revenue',    color: '#785e40' },
    { key: 'profit',  label: 'Profit',     color: '#16a34a' },
    { key: 'orders',  label: 'Pesanan',    color: '#2563eb' },
  ];

  const categoryDonutData = (metrics?.byCategory || []).map((c) => ({
    label: c.category_name || c.categoryName || c.name || c.category || '—',
    value: Number(c.revenue || 0),
  }));

  const sourceDonutData = (metrics?.bySources || []).map((s) => ({
    label: s.source,
    value: Number(s.revenue || 0),
  }));

  const bestSellersBarData = bestSellers.map((p) => ({
    label: p.name,
    value: p.qty,
  }));

  const monthlyBarData = monthly.map((m) => ({
    label: m.label,
    value: m.revenue,
  }));

  // Sparkline data from daily revenue (last 14 points)
  const sparkRevenue = trendData.slice(-14).map((d) => ({ value: d.revenue }));
  const sparkProfit  = trendData.slice(-14).map((d) => ({ value: d.profit  }));
  const sparkOrders  = trendData.slice(-14).map((d) => ({ value: d.orders  }));
  const sparkAov     = trendData.slice(-14).map((d, _, arr) => ({
    value: arr[0]?.orders ? d.revenue / arr[0].orders : 0,
  }));

  const m    = metrics;
  const prev = m?.prev;

  /* ── Quick insights ─────────────────────────────────────────── */
  function buildInsights() {
    if (!m) return [];
    const insights = [];
    const revChange = pctChange(m.totalRevenue, prev?.totalRevenue);
    if (Math.abs(revChange) > 0.5) {
      insights.push({
        icon: revChange >= 0 ? '📈' : '📉',
        text: `Revenue ${revChange >= 0 ? 'naik' : 'turun'} ${Math.abs(revChange).toFixed(1)}% dibanding periode sebelumnya.`,
      });
    }
    if (categoryDonutData.length > 0) {
      insights.push({ icon: '🏆', text: `Kategori terlaris: ${categoryDonutData[0].label} (${formatCurrency(categoryDonutData[0].value)}).` });
    }
    if (m.orderCount > 0) {
      insights.push({ icon: '🛒', text: `AOV periode ini: ${formatCurrency(m.aov)}.` });
    }
    if (m.customerCount > 0) {
      const returnPct = Math.round((m.returningCustomers / m.customerCount) * 100);
      insights.push({ icon: '🔄', text: `${returnPct}% customer melakukan pembelian ulang.` });
    }
    const best = trendData.reduce((max, d) => d.revenue > (max?.revenue || 0) ? d : max, null);
    if (best) {
      insights.push({ icon: '📅', text: `Hari terbaik: ${best.label} (${formatCurrency(best.revenue)}).` });
    }
    return insights;
  }

  const insights = buildInsights();

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="adm-card rev-section">
      {/* ── Header row ── */}
      <div className="rev-section-header">
        <h2 className="adm-section-title" style={{ margin: 0 }}>Revenue Dashboard</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastUpdated && !loading && (
            <span className="dfb-updated" aria-live="polite">
              updated {minutesAgo}m ago
            </span>
          )}
          <button
            type="button"
            onClick={() => { setResetResult(null); setResetOpen(true); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: '1px solid #fca5a5',
              color: '#b91c1c',
              borderRadius: 6,
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="Hapus semua data revenue (tidak dapat dibatalkan)"
          >
            <Trash2 size={13} aria-hidden="true" />
            Reset Data
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <DashboardFilterBar
        filters={filters}
        onChange={handleFilterChange}
        categories={categories}
        onExport={handleExport}
        loading={loading}
        lastUpdated={lastUpdated}
      />

      {/* ── Error state ── */}
      {error && (
        <div className="rev-error" role="alert">
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
          <button type="button" className="adm-btn adm-btn--primary" onClick={fetchAll} style={{ marginLeft: 'auto' }}>
            Coba Lagi
          </button>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="rev-kpi-row rev-kpi-row--6">
        {loading || !m ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard
              icon={DollarSign} label="Revenue" color="#785e40"
              value={formatCurrency(m.totalRevenue)}
              prev={prev?.totalRevenue} sparkData={sparkRevenue}
              tooltip="Total pendapatan kotor dari pesanan selesai"
            />
            <KpiCard
              icon={TrendingUp} label="Profit" color="#16a34a"
              value={formatCurrency(m.totalProfit)}
              prev={prev?.totalProfit} sparkData={sparkProfit}
              tooltip="Revenue dikurangi diskon, refund, dan ongkir"
            />
            <KpiCard
              icon={ShoppingCart} label="Pesanan" color="#2563eb"
              value={m.orderCount.toLocaleString('id-ID')}
              prev={prev?.orderCount} sparkData={sparkOrders}
              tooltip="Jumlah pesanan aktif / selesai"
            />
            <KpiCard
              icon={Users} label="Customer" color="#7c3aed"
              value={m.customerCount.toLocaleString('id-ID')}
              prev={prev?.customerCount}
              tooltip="Jumlah customer unik dalam periode ini"
            />
            <KpiCard
              icon={BarChart2} label="AOV" color="#d97706"
              value={formatCurrency(m.aov)}
              prev={prev?.aov} sparkData={sparkAov}
              tooltip="Average Order Value — rata-rata nilai per pesanan"
            />
            <KpiCard
              icon={TrendingDown} label="Refund" color="#dc2626"
              value={formatCurrency(m.totalRefunds)}
              prev={prev?.totalRefunds}
              tooltip="Total nilai yang direfund dalam periode ini"
            />
          </>
        )}
      </div>

      {/* ── Revenue Trend + Category Donut ── */}
      <div className="rev-charts-grid rev-charts-grid--70-30">
        <div>
          {loading ? <SkeletonCard height={220} /> : (
            <Chart
              type="multiline"
              data={trendData}
              series={trendSeries}
              title="Revenue Trend"
              formatValue={(n) => formatCurrency(n)}
              activeKeys={activeSeriesKeys}
              onToggleSeries={handleToggleSeries}
            />
          )}
        </div>
        <div>
          {loading ? <SkeletonCard height={220} /> : (
            <Chart
              type="donut"
              data={categoryDonutData}
              title="Revenue per Kategori"
              formatValue={(n) => formatCurrency(n)}
            />
          )}
        </div>
      </div>

      {/* ── Top Products + Revenue Breakdown ── */}
      <div className="rev-charts-grid">
        <div>
          {loading ? <SkeletonCard height={160} /> : (
            <Chart
              type="hbar"
              data={bestSellersBarData}
              title="Top Products (Qty Terjual)"
              color="#785e40"
              formatValue={(n) => `${n} pcs`}
            />
          )}
        </div>

        {/* Revenue Breakdown card */}
        <div className="chart-card">
          <h3 className="chart-title">Revenue Breakdown</h3>
          {loading || !m ? <SkeletonCard height={120} /> : (
            <div className="rev-breakdown">
              <div className="rev-breakdown-row">
                <span>Revenue</span>
                <span className="rev-breakdown-val">{formatCurrency(m.totalRevenue)}</span>
              </div>
              <div className="rev-breakdown-row">
                <span>Ongkir</span>
                <span className="rev-breakdown-val rev-breakdown-val--neutral">+{formatCurrency(m.totalShipping)}</span>
              </div>
              <div className="rev-breakdown-row rev-breakdown-row--neg">
                <span>Diskon</span>
                <span className="rev-breakdown-val rev-breakdown-val--neg">−{formatCurrency(m.totalDiscount)}</span>
              </div>
              <div className="rev-breakdown-row rev-breakdown-row--neg">
                <span>Refund</span>
                <span className="rev-breakdown-val rev-breakdown-val--neg">−{formatCurrency(m.totalRefunds)}</span>
              </div>
              <div className="rev-breakdown-row rev-breakdown-row--total">
                <span>Net Revenue</span>
                <span className="rev-breakdown-val rev-breakdown-val--total">{formatCurrency(m.totalProfit)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Monthly Comparison + Revenue Sources ── */}
      <div className="rev-charts-grid">
        <div>
          {loading ? <SkeletonCard height={160} /> : (
            <Chart
              type="bar"
              data={monthlyBarData}
              title="Revenue Bulanan (12 Bulan)"
              color="#2563eb"
              formatValue={(n) => formatCurrency(n)}
            />
          )}
        </div>
        <div>
          {loading ? <SkeletonCard height={160} /> : (
            <Chart
              type="donut"
              data={sourceDonutData}
              title="Revenue per Metode Bayar"
              formatValue={(n) => formatCurrency(n)}
            />
          )}
        </div>
      </div>

      {/* ── Recent Orders table ── */}
      <div style={{ marginTop: 8 }}>
        <h3 className="adm-section-title" style={{ marginBottom: 12 }}>Pesanan Terbaru</h3>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Status</th>
                <th>Metode Bayar</th>
                <th>Jumlah</th>
                <th>Dibuat</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="adm-empty">Memuat…</td></tr>
              ) : orders.items.length === 0 ? (
                <tr><td colSpan={8} className="adm-empty">Belum ada pesanan.</td></tr>
              ) : (
                orders.items.map((order) => {
                  const cfg   = STATUS_CONFIG[order.status] || { icon: '○', badge: '' };
                  const items = order.items || [];
                  const itemSummary = items.length === 0 ? '—'
                    : items.length === 1 ? `${items[0].name} ×${items[0].quantity}`
                    : `${items[0].name} dan ${items.length - 1} lainnya`;
                  return (
                    <tr key={order.id}>
                      <td><code style={{ fontSize: 12 }}>{order.orderNumber}</code></td>
                      <td>
                        <div>{order.customer?.name || '—'}</div>
                        {order.customer?.phone && <div className="adm-date">{order.customer.phone}</div>}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        <div>{itemSummary}</div>
                        <div className="adm-date">{items.length} item</div>
                      </td>
                      <td>
                        <span className={`order-status-badge ${cfg.badge}`}>
                          {cfg.icon} {order.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{order.paymentMethod || <span style={{ color: '#9b9b9b' }}>—</span>}</td>
                      <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {formatCurrency(order.subtotal)}
                        {order.discountAmount > 0 && (
                          <div className="adm-date" style={{ color: '#16a34a' }}>−{formatCurrency(order.discountAmount)}</div>
                        )}
                      </td>
                      <td className="adm-date">{new Date(order.createdAt).toLocaleDateString('id-ID')}</td>
                      <td>
                        <button
                          className="adm-btn adm-btn--detail"
                          type="button"
                          title="Lihat detail pesanan"
                          onClick={() => handleOrderDetail(order.id)}
                        >
                          🔍 Detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={orders.page}
          totalPages={orders.totalPages}
          total={orders.total}
          limit={orders.limit}
          onPageChange={setOrderPage}
        />
      </div>

      {/* ── Quick Insights ── */}
      {insights.length > 0 && (
        <div className="rev-insights">
          <h3 className="adm-section-title" style={{ marginBottom: 12 }}>Quick Insights</h3>
          <div className="rev-insights-list">
            {insights.map((ins, i) => (
              <div key={i} className="rev-insight-item">
                <span className="rev-insight-icon" aria-hidden="true">{ins.icon}</span>
                <span>{ins.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Order Detail Modal ── */}
      <OrderDetailModal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        order={selectedOrder}
      />

      {/* ── Revenue Reset Modal ── */}
      {resetOpen && (
        <ResetRevenueModal
          onClose={() => setResetOpen(false)}
          onConfirmed={(data) => {
            setResetOpen(false);
            setResetResult(data);
            // Reload dashboard data so charts reflect the cleared state
            fetchAll();
          }}
        />
      )}

      {/* ── Reset success banner ── */}
      {resetResult && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#166534',
            color: '#fff',
            borderRadius: 8,
            padding: '12px 24px',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            maxWidth: 480,
            textAlign: 'center',
          }}
        >
          <span>✅</span>
          <span>
            Reset berhasil — {resetResult.ordersDeleted} pesanan,{' '}
            {resetResult.visitsDeleted} kunjungan, dan{' '}
            {resetResult.viewsDeleted} tampilan produk dihapus.
          </span>
          <button
            type="button"
            onClick={() => setResetResult(null)}
            aria-label="Tutup notifikasi"
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
              marginLeft: 4,
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
