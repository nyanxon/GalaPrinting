/**
 * DashboardFilterBar.jsx
 *
 * Shared filter bar for Revenue / Reports / Analytics sections.
 * Renders: DateRange | Category | Status | Export
 *
 * Props:
 *   filters      — { from, to, preset, categoryId, status }
 *   onChange     — (partial: Partial<filters>) => void
 *   categories   — Array<{ id, name }>
 *   onExport     — (format: 'pdf'|'excel'|'csv') => void
 *   loading      — boolean
 *   lastUpdated  — Date | null
 */

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Download } from 'lucide-react';
import { ORDER_STATUSES } from '../../../services/orders.js';

const DATE_PRESETS = [
  { key: 'today',        label: 'Hari Ini' },
  { key: '7d',           label: '7 Hari' },
  { key: '30d',          label: '30 Hari' },
  { key: 'this_month',   label: 'Bulan Ini' },
  { key: 'this_year',    label: 'Tahun Ini' },
  { key: 'custom',       label: 'Custom' },
];

function presetsToRange(preset) {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);
  if (preset === 'today') return { from: today, to: today };
  if (preset === '7d') {
    const from = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
    return { from, to: today };
  }
  if (preset === '30d') {
    const from = new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10);
    return { from, to: today };
  }
  if (preset === 'this_month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    return { from, to: today };
  }
  if (preset === 'this_year') {
    const from = `${now.getFullYear()}-01-01`;
    return { from, to: today };
  }
  return { from: '', to: '' };
}

function relativeTime(date) {
  if (!date) return null;
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60)       return `${diffSec}d ago`;
  if (diffSec < 3600)     return `${Math.round(diffSec / 60)}m ago`;
  return `${Math.round(diffSec / 3600)}h ago`;
}

// Generic dropdown with trigger + panel
function Dropdown({ trigger, children, className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className={`dfb-dropdown ${className}`} ref={ref}>
      <button
        type="button"
        className="dfb-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {trigger}
        <ChevronDown size={14} style={{ marginLeft: 4, opacity: 0.6 }} />
      </button>
      {open && (
        <div className="dfb-panel" role="menu">
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export default function DashboardFilterBar({
  filters = {},
  onChange,
  categories = [],
  onExport,
  loading = false,
  lastUpdated = null,
}) {
  const preset     = filters.preset || '30d';
  const categoryId = filters.categoryId || '';
  const status     = filters.status || '';

  const [customFrom, setCustomFrom] = useState(filters.from || '');
  const [customTo,   setCustomTo]   = useState(filters.to   || '');

  function handlePresetSelect(key, close) {
    if (key === 'custom') {
      onChange({ preset: 'custom' });
    } else {
      const range = presetsToRange(key);
      onChange({ preset: key, ...range });
    }
    close();
  }

  function handleCustomApply() {
    if (customFrom && customTo) {
      onChange({ preset: 'custom', from: customFrom, to: customTo });
    }
  }

  const activePresetLabel = DATE_PRESETS.find((p) => p.key === preset)?.label || preset;
  const activeCategoryLabel = categories.find((c) => c.id === categoryId)?.name || 'Semua Kategori';
  const activeStatusLabel = status || 'Semua Status';
  const updatedText = relativeTime(lastUpdated);

  return (
    <div className="dfb-bar">
      <div className="dfb-bar-left">
        {/* Date range */}
        <Dropdown
          trigger={
            <>
              <Calendar size={14} style={{ marginRight: 5 }} />
              {activePresetLabel}
            </>
          }
        >
          {(close) => (
            <div className="dfb-date-panel">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={`dfb-option${preset === p.key ? ' dfb-option--active' : ''}`}
                  onClick={() => handlePresetSelect(p.key, close)}
                  role="menuitem"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </Dropdown>

        {/* Category */}
        {categories.length > 0 && (
          <Dropdown trigger={activeCategoryLabel}>
            {(close) => (
              <>
                <button
                  type="button"
                  className={`dfb-option${!categoryId ? ' dfb-option--active' : ''}`}
                  onClick={() => { onChange({ categoryId: '' }); close(); }}
                  role="menuitem"
                >
                  Semua Kategori
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`dfb-option${categoryId === c.id ? ' dfb-option--active' : ''}`}
                    onClick={() => { onChange({ categoryId: c.id }); close(); }}
                    role="menuitem"
                  >
                    {c.name}
                  </button>
                ))}
              </>
            )}
          </Dropdown>
        )}

        {/* Status */}
        <Dropdown trigger={activeStatusLabel}>
          {(close) => (
            <>
              <button
                type="button"
                className={`dfb-option${!status ? ' dfb-option--active' : ''}`}
                onClick={() => { onChange({ status: '' }); close(); }}
                role="menuitem"
              >
                Semua Status
              </button>
              {ORDER_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`dfb-option${status === s ? ' dfb-option--active' : ''}`}
                  onClick={() => { onChange({ status: s }); close(); }}
                  role="menuitem"
                >
                  {s}
                </button>
              ))}
            </>
          )}
        </Dropdown>

        {/* Inline custom date range — shown only when preset === 'custom' */}
        {preset === 'custom' && (
          <div className="dfb-custom-range dfb-custom-range--inline">
            <input
              type="date"
              className="dfb-date-input"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
              aria-label="Dari tanggal"
            />
            <span className="dfb-date-sep">—</span>
            <input
              type="date"
              className="dfb-date-input"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              aria-label="Sampai tanggal"
            />
            <button
              type="button"
              className="dfb-apply-btn"
              disabled={!customFrom || !customTo}
              onClick={handleCustomApply}
            >
              Terapkan
            </button>
          </div>
        )}
      </div>

      <div className="dfb-bar-right">
        {updatedText && !loading && (
          <span className="dfb-updated" aria-live="polite">
            updated {updatedText}
          </span>
        )}
        {loading && <span className="dfb-loading">Memuat…</span>}

        {onExport && (
          <Dropdown
            trigger={
              <>
                <Download size={14} style={{ marginRight: 5 }} />
                Export
              </>
            }
            className="dfb-dropdown--right"
          >
            {(close) => (
              <>
                <button type="button" className="dfb-option" onClick={() => { onExport('pdf');   close(); }} role="menuitem">📄 PDF</button>
                <button type="button" className="dfb-option" onClick={() => { onExport('excel'); close(); }} role="menuitem">📊 Excel (.xlsx)</button>
                <button type="button" className="dfb-option" onClick={() => { onExport('csv');   close(); }} role="menuitem">📋 CSV</button>
              </>
            )}
          </Dropdown>
        )}
      </div>
    </div>
  );
}
