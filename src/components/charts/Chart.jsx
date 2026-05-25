/**
 * src/components/charts/Chart.jsx
 * SVG chart wrapper — React equivalent of vanilla charts.js and
 * js/modules/owner/dashboard/components/charts.js.
 *
 * Props:
 *   data         — Array<{ label: string, value: number }>
 *   type         — 'bar' | 'line' | 'hbar'
 *   title        — optional chart title string
 *   color        — optional hex color string (default: '#785e40')
 *   formatValue  — optional (n: number) => string formatter
 */

const DEFAULT_COLOR = '#785e40';
const defaultFormat = (n) => String(n);

/** ── Line Chart ─────────────────────────────────────────── */
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
  const range = maxVal - minVal || 1;

  const toX = (i) => PAD.left + (i / (data.length - 1 || 1)) * innerW;
  const toY = (v) => PAD.top + innerH - ((v - minVal) / range) * innerH;

  const points = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ');

  // Area fill path
  const areaPath = [
    `M ${toX(0)},${PAD.top + innerH}`,
    ...data.map((d, i) => `L ${toX(i)},${toY(d.value)}`),
    `L ${toX(data.length - 1)},${PAD.top + innerH}`,
    'Z',
  ].join(' ');

  // Y-axis ticks (3 ticks)
  const yTicks = [minVal, minVal + range / 2, maxVal].map((v, i) => {
    const y = toY(v);
    return (
      <g key={i}>
        <text
          x={PAD.left - 6}
          y={y + 4}
          textAnchor="end"
          className="chart-axis-label"
        >
          {formatValue(Math.round(v))}
        </text>
        <line
          x1={PAD.left}
          y1={y}
          x2={PAD.left + innerW}
          y2={y}
          className="chart-grid-line"
        />
      </g>
    );
  });

  // X-axis labels — show every Nth to avoid crowding
  const step = Math.max(1, Math.floor(data.length / 6));
  const xLabels = data
    .filter((_, i) => i % step === 0 || i === data.length - 1)
    .map((d) => {
      const i = data.indexOf(d);
      return (
        <text
          key={i}
          x={toX(i)}
          y={H - 4}
          textAnchor="middle"
          className="chart-axis-label"
        >
          {d.label}
        </text>
      );
    });

  // Dots on data points
  const dots = data.map((d, i) => (
    <circle
      key={i}
      cx={toX(i)}
      cy={toY(d.value)}
      r="3"
      fill={color}
      className="chart-dot"
    >
      <title>{d.label}: {formatValue(d.value)}</title>
    </circle>
  ));

  const gradId = `lineGrad-${color.replace('#', '')}`;

  return (
    <div className="chart-card">
      {title && <h3 className="chart-title">{title}</h3>}
      <div className="chart-svg-wrap">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="chart-svg"
          aria-label={title || 'Line chart'}
        >
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

/** ── Bar Chart (vertical) ───────────────────────────────── */
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

  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.max(16, (W / data.length) * 0.6);
  const gap = (W - barW * data.length) / (data.length + 1);

  const bars = data.map((d, i) => {
    const barH = (d.value / max) * (H - 30);
    const x = gap + i * (barW + gap);
    const y = H - 20 - barH;
    return (
      <g key={i}>
        <rect x={x} y={y} width={barW} height={barH} fill={color} rx="3" />
        <text
          x={x + barW / 2}
          y={y - 6}
          textAnchor="middle"
          fontSize="10"
          fill="#1f1f1f"
        >
          {formatValue(d.value)}
        </text>
        <text
          x={x + barW / 2}
          y={H - 4}
          textAnchor="middle"
          fontSize="10"
          fill="#9b9b9b"
        >
          {d.label}
        </text>
      </g>
    );
  });

  return (
    <div className="chart-card">
      {title && <h3 className="chart-title">{title}</h3>}
      <div className="chart-svg-wrap">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="chart-svg"
          aria-label={title || 'Bar chart'}
        >
          {bars}
        </svg>
      </div>
    </div>
  );
}

/** ── Horizontal Bar Chart ───────────────────────────────── */
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
          <div
            className="hbar-fill"
            style={{ width: `${pct}%`, background: color }}
          />
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

/** ── Chart (public API) ─────────────────────────────────── */
export default function Chart({ data = [], type = 'bar', color, title, formatValue }) {
  if (type === 'line') {
    return <LineChart data={data} color={color} title={title} formatValue={formatValue} />;
  }
  if (type === 'hbar') {
    return <HBarChart data={data} color={color} title={title} formatValue={formatValue} />;
  }
  return <BarChart data={data} color={color} title={title} formatValue={formatValue} />;
}
