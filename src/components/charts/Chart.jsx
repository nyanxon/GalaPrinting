/**
 * src/components/charts/Chart.jsx
 * SVG chart wrapper — hand-rolled, no external library.
 *
 * Supported types:
 *   type="bar"        — vertical bar chart
 *   type="line"       — single-series area/line chart
 *   type="multiline"  — multi-series line chart (see series prop below)
 *   type="hbar"       — horizontal bar chart
 *   type="sparkline"  — tiny inline trend line (no axes, no labels)
 *   type="donut"      — donut/pie chart with legend
 *
 * Standard props (all types):
 *   data         — Array<{ label: string, value: number }>
 *   type         — one of the strings above
 *   title        — optional chart title string
 *   color        — optional hex color (default: '#785e40')
 *   formatValue  — optional (n: number) => string
 *
 * multiline-specific props:
 *   series       — Array<{ key: string, label: string, color: string }>
 *   data         — Array<{ label: string, [seriesKey]: number, ... }>
 *   activeKeys   — Set<string> | undefined — visible series keys (controlled from parent)
 *   onToggleSeries — (key: string) => void — called when a series legend pill is clicked
 *
 * donut-specific props:
 *   data         — Array<{ label: string, value: number, color?: string }>
 *
 * sparkline-specific props:
 *   data         — Array<{ value: number }>
 *   color        — line/stroke color
 */

import { BRAND_COLOR } from '../../config/brand.js';

const DEFAULT_COLOR = BRAND_COLOR;
const defaultFormat = (n) => String(n);

const DONUT_PALETTE = [
  BRAND_COLOR, 'var(--color-info)', 'var(--color-success)', 'var(--color-danger)', '#d97706',
  '#7c3aed', '#0891b2', '#be185d', '#059669', '#ea580c',
];

/* ─────────────────────────────────────────────────────────── */
/* ── Sparkline ──────────────────────────────────────────────  */
/* ─────────────────────────────────────────────────────────── */
function Sparkline({ data = [] }) {
  if (!data || data.length < 2) {
    return <span style={{ color: 'var(--gray-light)', fontSize: 11 }}>—</span>;
  }

  const W = 56;
  const H = 22;
  const values = data.map((d) => d.value ?? 0);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range  = maxVal - minVal || 1;

  const toX = (i) => (i / (values.length - 1)) * W;
  const toY = (v) => H - ((v - minVal) / range) * H;

  const points = values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');

  // Trend direction: compare last vs first
  const trendUp = values[values.length - 1] >= values[0];
  const trendColor = trendUp ? 'var(--color-success)' : 'var(--color-danger)';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={trendColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* ── Line Chart (single-series) ─────────────────────────────  */
/* ─────────────────────────────────────────────────────────── */
function LineChart({ data, color = DEFAULT_COLOR, title, formatValue = defaultFormat }) {
  if (!data || !data.length) {
    return (
      <div className="chart-card">
        {title && <h3 className="chart-title">{title}</h3>}
        <div className="chart-empty">Belum ada data.</div>
      </div>
    );
  }

  const W = 600;
  const H = 160;
  const PAD = { top: 16, right: 16, bottom: 32, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range  = maxVal - minVal || 1;

  const toX = (i) => PAD.left + (i / (data.length - 1 || 1)) * innerW;
  const toY = (v) => PAD.top + innerH - ((v - minVal) / range) * innerH;

  const points = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ');

  const areaPath = [
    `M ${toX(0)},${PAD.top + innerH}`,
    ...data.map((d, i) => `L ${toX(i)},${toY(d.value)}`),
    `L ${toX(data.length - 1)},${PAD.top + innerH}`,
    'Z',
  ].join(' ');

  const yTicks = [minVal, minVal + range / 2, maxVal].map((v, i) => {
    const y = toY(v);
    return (
      <g key={i}>
        <text x={PAD.left - 6} y={y + 4} textAnchor="end" className="chart-axis-label">
          {formatValue(Math.round(v))}
        </text>
        <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} className="chart-grid-line" />
      </g>
    );
  });

  const step = Math.max(1, Math.floor(data.length / 6));
  const xLabels = data
    .filter((_, i) => i % step === 0 || i === data.length - 1)
    .map((d) => {
      const i = data.indexOf(d);
      return (
        <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" className="chart-axis-label">
          {d.label}
        </text>
      );
    });

  const dots = data.map((d, i) => (
    <circle key={i} cx={toX(i)} cy={toY(d.value)} r="3" fill={color} className="chart-dot">
      <title>{d.label}: {formatValue(d.value)}</title>
    </circle>
  ));

  const gradId = `lineGrad-${color.replace('#', '')}`;

  return (
    <div className="chart-card">
      {title && <h3 className="chart-title">{title}</h3>}
      <div className="chart-svg-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" aria-label={title || 'Line chart'}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {yTicks}
          <path d={areaPath} fill={`url(#${gradId})`} />
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {dots}
          {xLabels}
        </svg>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* ── Multi-series Line Chart ────────────────────────────────  */
/* ─────────────────────────────────────────────────────────── */
/**
 * data: Array<{ label: string, [seriesKey]: number }>
 * series: Array<{ key: string, label: string, color: string }>
 * activeKeys: Set<string> — which series are currently visible
 * onToggleSeries: (key) => void
 */
function MultiLineChart({
  data = [],
  series = [],
  title,
  formatValue = defaultFormat,
  activeKeys,
  onToggleSeries,
}) {
  if (!data.length || !series.length) {
    return (
      <div className="chart-card">
        {title && <h3 className="chart-title">{title}</h3>}
        <div className="chart-empty">Belum ada data.</div>
      </div>
    );
  }

  const visible = series.filter((s) => !activeKeys || activeKeys.has(s.key));

  const W = 600;
  const H = 180;
  const PAD = { top: 16, right: 16, bottom: 32, left: 54 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // Global min/max across all visible series
  let maxVal = 1;
  let minVal = 0;
  if (visible.length > 0) {
    const allVals = data.flatMap((d) => visible.map((s) => Number(d[s.key] ?? 0)));
    maxVal = Math.max(...allVals, 1);
    minVal = Math.min(...allVals, 0);
  }
  const range = maxVal - minVal || 1;

  const toX = (i) => PAD.left + (i / (data.length - 1 || 1)) * innerW;
  const toY = (v) => PAD.top + innerH - ((v - minVal) / range) * innerH;

  // Y-axis ticks
  const yTicks = [minVal, minVal + range / 2, maxVal].map((v, i) => {
    const y = toY(v);
    return (
      <g key={i}>
        <text x={PAD.left - 6} y={y + 4} textAnchor="end" className="chart-axis-label">
          {formatValue(Math.round(v))}
        </text>
        <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} className="chart-grid-line" />
      </g>
    );
  });

  // X-axis labels
  const step = Math.max(1, Math.floor(data.length / 6));
  const xLabels = data
    .filter((_, i) => i % step === 0 || i === data.length - 1)
    .map((d) => {
      const i = data.indexOf(d);
      return (
        <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" className="chart-axis-label">
          {d.label}
        </text>
      );
    });

  // Series lines + dots
  const seriesLines = visible.map((s) => {
    const points = data.map((d, i) => `${toX(i)},${toY(Number(d[s.key] ?? 0))}`).join(' ');
    const gradId = `mlGrad-${s.key}`;
    const areaPath = [
      `M ${toX(0)},${PAD.top + innerH}`,
      ...data.map((d, i) => `L ${toX(i)},${toY(Number(d[s.key] ?? 0))}`),
      `L ${toX(data.length - 1)},${PAD.top + innerH}`,
      'Z',
    ].join(' ');

    return (
      <g key={s.key}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <polyline
          points={points}
          fill="none"
          stroke={s.color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {data.map((d, i) => (
          <circle key={i} cx={toX(i)} cy={toY(Number(d[s.key] ?? 0))} r="3" fill={s.color} className="chart-dot">
            <title>{d.label} — {s.label}: {formatValue(Number(d[s.key] ?? 0))}</title>
          </circle>
        ))}
      </g>
    );
  });

  return (
    <div className="chart-card">
      {title && <h3 className="chart-title">{title}</h3>}

      {/* Series toggle pills */}
      <div className="chart-series-pills" role="group" aria-label="Toggle series">
        {series.map((s) => {
          const isActive = !activeKeys || activeKeys.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              className={`chart-series-pill${isActive ? ' chart-series-pill--active' : ''}`}
              style={isActive ? { borderColor: s.color, color: s.color, background: s.color + '18' } : {}}
              onClick={() => onToggleSeries && onToggleSeries(s.key)}
              aria-pressed={isActive}
            >
              <span
                className="chart-series-dot"
                style={{ background: isActive ? s.color : '#ccc' }}
              />
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="chart-svg-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" aria-label={title || 'Multi-series line chart'}>
          {yTicks}
          {seriesLines}
          {xLabels}
        </svg>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* ── Bar Chart (vertical) ───────────────────────────────────  */
/* ─────────────────────────────────────────────────────────── */
function BarChart({ data, color = DEFAULT_COLOR, title, formatValue = defaultFormat }) {
  if (!data || !data.length) {
    return (
      <div className="chart-card">
        {title && <h3 className="chart-title">{title}</h3>}
        <div className="chart-empty">Belum ada data.</div>
      </div>
    );
  }

  const W = 600;
  const H = 200;

  const max  = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.max(16, (W / data.length) * 0.6);
  const gap  = (W - barW * data.length) / (data.length + 1);

  const bars = data.map((d, i) => {
    const barH = (d.value / max) * (H - 30);
    const x    = gap + i * (barW + gap);
    const y    = H - 20 - barH;
    return (
      <g key={i}>
        <rect x={x} y={y} width={barW} height={barH} fill={color} rx="3" />
        <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="10" style={{ fill: 'var(--text)' }}>
          {formatValue(d.value)}
        </text>
        <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize="10" style={{ fill: 'var(--gray-light)' }}>
          {d.label}
        </text>
      </g>
    );
  });

  return (
    <div className="chart-card">
      {title && <h3 className="chart-title">{title}</h3>}
      <div className="chart-svg-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" aria-label={title || 'Bar chart'}>
          {bars}
        </svg>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* ── Horizontal Bar Chart ───────────────────────────────────  */
/* ─────────────────────────────────────────────────────────── */
function HBarChart({ data, color = DEFAULT_COLOR, title, formatValue = defaultFormat }) {
  if (!data || !data.length) {
    return (
      <div className="chart-card">
        {title && <h3 className="chart-title">{title}</h3>}
        <div className="chart-empty">Belum ada data.</div>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  const rows = data.map((d, i) => {
    const pct = Math.round((d.value / max) * 100);
    return (
      <div key={i} className="hbar-row">
        <div className="hbar-label">{d.label}</div>
        <div className="hbar-track">
          <div className="hbar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <div className="hbar-val">{formatValue(d.value)}</div>
      </div>
    );
  });

  return (
    <div className="chart-card">
      {title && <h3 className="chart-title">{title}</h3>}
      <div className="hbar-chart">{rows}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* ── Donut Chart ─────────────────────────────────────────────  */
/* ─────────────────────────────────────────────────────────── */
function DonutChart({ data = [], title, formatValue = defaultFormat }) {
  if (!data || !data.length) {
    return (
      <div className="chart-card">
        {title && <h3 className="chart-title">{title}</h3>}
        <div className="chart-empty">Belum ada data.</div>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + (d.value || 0), 0) || 1;

  const R     = 70;   // outer radius
  const r     = 44;   // inner radius (donut hole)
  const cx    = 90;
  const cy    = 90;
  const W     = 180;
  const H     = 180;

  // Build SVG arc segments using prefix sums — no external mutation inside map()
  const angleData = data.map((d) => {
    const fraction = (d.value || 0) / total;
    return { d, fraction, angle: fraction * 2 * Math.PI };
  });

  // Compute cumulative start angles via prefix sum (pure — no side effects)
  const startAngles = angleData.reduce((acc, _item, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + angleData[i - 1].angle);
    return acc;
  }, []);

  const slices = angleData.map(({ d, fraction, angle }, i) => {
    const color   = d.color || DONUT_PALETTE[i % DONUT_PALETTE.length];
    const startA  = startAngles[i] - Math.PI / 2;
    const endA    = startA + angle;

    if (fraction < 0.001) return null; // skip invisible slices

    const x1 = cx + R * Math.cos(startA);
    const y1 = cy + R * Math.sin(startA);
    const x2 = cx + R * Math.cos(endA);
    const y2 = cy + R * Math.sin(endA);
    const ix1 = cx + r * Math.cos(endA);
    const iy1 = cy + r * Math.sin(endA);
    const ix2 = cx + r * Math.cos(startA);
    const iy2 = cy + r * Math.sin(startA);

    const largeArc = angle > Math.PI ? 1 : 0;

    const d_attr = [
      `M ${x1} ${y1}`,
      `A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${r} ${r} 0 ${largeArc} 0 ${ix2} ${iy2}`,
      'Z',
    ].join(' ');

    const pct = Math.round(fraction * 100);

    return (
      <path key={i} d={d_attr} fill={color} stroke="#fff" strokeWidth="1.5">
        <title>{d.label}: {formatValue(d.value)} ({pct}%)</title>
      </path>
    );
  }).filter(Boolean);

  // Legend items
  const legend = data.map((d, i) => {
    const color = d.color || DONUT_PALETTE[i % DONUT_PALETTE.length];
    const pct   = Math.round(((d.value || 0) / total) * 100);
    return (
      <div key={i} className="donut-legend-item">
        <span className="donut-legend-dot" style={{ background: color }} />
        <span className="donut-legend-label">{d.label}</span>
        <span className="donut-legend-pct">{pct}%</span>
      </div>
    );
  });

  return (
    <div className="chart-card donut-chart-card">
      {title && <h3 className="chart-title">{title}</h3>}
      <div className="donut-layout">
        <div className="donut-svg-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} className="donut-svg" aria-label={title || 'Donut chart'}>
            {slices}
            {/* Centre label */}
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" style={{ fill: 'var(--gray-mid)' }} fontFamily="inherit">
              Total
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" fontSize="12" fontWeight="700" style={{ fill: 'var(--text)' }} fontFamily="inherit">
              {formatValue(total)}
            </text>
          </svg>
        </div>
        <div className="donut-legend">{legend}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* ── Chart (public API) ──────────────────────────────────────  */
/* ─────────────────────────────────────────────────────────── */
export default function Chart({
  data = [],
  type = 'bar',
  color,
  title,
  formatValue,
  // multiline props
  series,
  activeKeys,
  onToggleSeries,
}) {
  if (type === 'sparkline') {
    return <Sparkline data={data} color={color} />;
  }
  if (type === 'donut') {
    return <DonutChart data={data} title={title} formatValue={formatValue} />;
  }
  if (type === 'multiline') {
    return (
      <MultiLineChart
        data={data}
        series={series}
        title={title}
        formatValue={formatValue}
        activeKeys={activeKeys}
        onToggleSeries={onToggleSeries}
      />
    );
  }
  if (type === 'line') {
    return <LineChart data={data} color={color} title={title} formatValue={formatValue} />;
  }
  if (type === 'hbar') {
    return <HBarChart data={data} color={color} title={title} formatValue={formatValue} />;
  }
  return <BarChart data={data} color={color} title={title} formatValue={formatValue} />;
}

// Named export for direct sparkline use in KPI cards
export { Sparkline };
