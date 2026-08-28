/**
 * ActivityLogSection.jsx — Shared Log (Activity Log) section for Admin & Owner.
 *
 * Lists activity_logs from /api/activity-log with filters (actor type, date
 * range, search), pagination, PDF export (client-side jsPDF), and manual
 * retention (delete logs older than 1/3/6 months).
 *
 * Access is admin+owner only (enforced server-side by requireRole in the route).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  LogIn, Plus, Pencil, Trash2, Printer, CircleDot,
} from 'lucide-react';
import {
  listActivityLogs,
  listActivityLogsForPdf,
  deleteLogsOlderThan,
  markLogRead,
  markAllLogsRead,
  getRetentionSetting,
  setRetentionSetting,
} from '../../../services/activityLog.js';
import { STAFF_ROLE_CONFIG } from '../../../config/roles.js';
import { showToast } from '../../../core/toastEmitter.js';
import PaginationBar from '../../ui/PaginationBar.jsx';
import LogDetailModal from './LogDetailModal.jsx';
import { REFRESH_EVENT } from '../../../hooks/useLogUnreadBadge.js';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const PAGE_SIZE = 20;
const RETENTION_OPTIONS = [
  { value: 1, label: '1 bulan' },
  { value: 3, label: '3 bulan' },
  { value: 6, label: '6 bulan' },
];
const AUTO_RETENTION_OPTIONS = [
  { value: 0, label: 'Nonaktif' },
  { value: 3, label: '3 bulan' },
  { value: 6, label: '6 bulan' },
  { value: 12, label: '12 bulan' },
];

/*
 * The backend stores only a free-text actionLabel (captured from button
 * clicks). There is no structured actionType, so we bucket it heuristically
 * for badge coloring/icons only — the raw label is always shown alongside.
 */
function classifyAction(label = '') {
  const s = String(label || '').toLowerCase();
  if (/(login|sign\s*in|masuk akun|logout|sign\s*out|keluar)/.test(s)) return 'login';
  if (/(hapus|delete|remove|batal)/.test(s)) return 'delete';
  if (/(ubah|edit|update|perbarui|ganti)/.test(s)) return 'update';
  if (/(tambah|buat|create|daftar|register)/.test(s)) return 'create';
  if (/(cetak|print|export|unduh|download|pdf)/.test(s)) return 'print';
  return 'other';
}

const ACTION_BADGE_ICON = {
  login: LogIn,
  create: Plus,
  update: Pencil,
  delete: Trash2,
  print: Printer,
  other: CircleDot,
};

const ACTION_BADGE_LABEL = {
  login: 'Login / logout',
  create: 'Membuat',
  update: 'Mengubah',
  delete: 'Menghapus / membatalkan',
  print: 'Cetak / export',
  other: 'Aktivitas lain',
};

function emitReadRefresh() {
  try {
    window.dispatchEvent(new Event(REFRESH_EVENT));
  } catch { /* ignore */ }
}

/*
 * The API returns `created_at` as a timezone-less WIB (UTC+7) string
 * (the server does `created_at + INTERVAL 7 HOUR`). `new Date` on such a
 * string assumes the browser's OWN timezone, so the epoch drifts whenever
 * the viewer is not on UTC+7 (e.g. admin at UTC), turning hours-old events
 * into near-zero/negative deltas ("baru saja"). Treat naive datetimes as
 * UTC+7 so every client resolves the same absolute moment.
 */
const NAIVE_DT_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/;

function parseLogTime(dateStr) {
  if (!dateStr) return null;
  const d = NAIVE_DT_RE.test(dateStr)
    ? new Date(`${dateStr.replace(' ', 'T')}+07:00`)
    : new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = parseLogTime(dateStr);
  if (!d) return dateStr;
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function fmtRelative(dateStr) {
  if (!dateStr) return '—';
  const d = parseLogTime(dateStr);
  if (!d) return dateStr;
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 45) return 'baru saja';
  if (sec < 3600) return `${Math.floor(sec / 60)} menit lalu`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} jam lalu`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} hari lalu`;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtFilterDate(v) {
  if (!v) return '';
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function actorRoleLabel(role) {
  if (!role) return '';
  return STAFF_ROLE_CONFIG[role]?.label ?? role;
}

function summarizeTarget(type, id, metadata) {
  const parts = [];
  if (type) parts.push(type);
  if (id) parts.push(id);
  const extra = metadata && typeof metadata === 'object'
    ? ['name', 'order_number', 'code', 'email']
        .map((k) => metadata[k])
        .filter((v) => v != null && v !== '')
        .slice(0, 1)
    : [];
  const tail = extra.length ? extra[0] : '';
  if (!tail) return parts.join(' · ') || '—';
  return `${parts.join(' · ') ? parts.join(' · ') + ' · ' : ''}${tail}`;
}

function LogSkeletonRows() {
  return (
    <div className="log-list" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="log-row log-row--skeleton">
          <span className="log-badge rev-skeleton" />
          <div className="log-main">
            <div className="rev-skeleton" style={{ width: '38%', height: 13, borderRadius: 6 }} />
            <div className="rev-skeleton" style={{ width: '72%', height: 13, borderRadius: 6, marginTop: 8 }} />
            <div className="rev-skeleton" style={{ width: '46%', height: 11, borderRadius: 6, marginTop: 8 }} />
          </div>
          <div className="log-actions">
            <div className="rev-skeleton" style={{ width: 56, height: 28, borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function LogEmpty({ hasFilters, onReset }) {
  return (
    <div className="log-empty">
      <CircleDot className="log-empty-icon" size={30} aria-hidden="true" />
      <p className="log-empty-text">Belum ada aktivitas.</p>
      {hasFilters && (
        <button className="adm-btn adm-btn--secondary adm-btn-sm" type="button" onClick={onReset}>
          Reset filter
        </button>
      )}
    </div>
  );
}

export default function ActivityLogSection() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);

  const [actorType, setActorType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [retentionMonths, setRetentionMonths] = useState(0);
  const [retentionSaving, setRetentionSaving] = useState(false);

  // `load` is stable; callers pass the exact filters to use so it never
  // refetches on its own (avoids refetching on every keystroke).
  const load = useCallback(async (filters, targetPage = 1) => {
    const f = filters || {};
    setLoading(true);
    try {
      const res = await listActivityLogs({
        actorType: f.actorType || undefined,
        from: f.from || undefined,
        to: f.to || undefined,
        search: f.search || undefined,
        page: targetPage,
        limit: PAGE_SIZE,
      });
      setRows(res.items || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 0);
    } catch (err) {
      showToast(err?.response?.data?.message || 'Gagal memuat log.', 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const currentFilters = { actorType, from, to, search };

  useEffect(() => {
    load(currentFilters, 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mounted = true;
    getRetentionSetting()
      .then((r) => { if (mounted) setRetentionMonths(typeof r?.months === 'number' ? r.months : 0); })
      .catch(() => { /* non-fatal; default to OFF */ });
    return () => { mounted = false; };
  }, []);

  function handleApplyFilters(e) {
    e.preventDefault();
    if (from && to && from > to) {
      showToast('Tanggal awal tidak boleh lebih besar dari tanggal akhir.', 'error');
      return;
    }
    load(currentFilters, 1);
  }

  function handleReset() {
    setActorType('');
    setFrom('');
    setTo('');
    setSearch('');
    setPage(1);
    load({ actorType: '', from: '', to: '', search: '' }, 1);
  }

  function handleRemoveFilter(key, e) {
    e.preventDefault();
    e.stopPropagation();
    const f = { ...currentFilters };
    if (key === 'actorType') f.actorType = '';
    else if (key === 'from') f.from = '';
    else if (key === 'to') f.to = '';
    else if (key === 'from-to') { f.from = ''; f.to = ''; }
    else if (key === 'search') f.search = '';
    setActorType(f.actorType);
    setFrom(f.from);
    setTo(f.to);
    setSearch(f.search);
    load(f, 1);
  }

  async function handleExportPdf() {
    if (from && to && from > to) {
      showToast('Tanggal awal tidak boleh lebih besar dari tanggal akhir.', 'error');
      return;
    }
    setExporting(true);
    try {
      const items = await listActivityLogsForPdf({
        actorType: actorType || undefined,
        from: from || undefined,
        to: to || undefined,
        search: search || undefined,
      });
      if (items.length === 0) {
        showToast('Tidak ada data untuk diexport.', 'info');
        return;
      }
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      let y = 15;

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Log Aktivitas', 14, y);
      y += 7;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const range = `${from || '…'} — ${to || '…'}`;
      doc.text(`Rentang: ${range}${actorType ? `  |  Tipe: ${actorType}` : ''}`, 14, y);
      y += 5;
      doc.setFontSize(9);
      doc.text(`Total: ${items.length} kejadian`, 14, y);
      y += 3;

      let endY = y;
      autoTable(doc, {
        startY: y,
        margin: { left: 10, right: 10 },
        head: [['Waktu', 'Aktor', 'Aksi', 'Target', 'Halaman', 'IP']],
        body: items.map((r) => [
          fmtDateTime(r.createdAt),
          `${r.actorName || '—'}${r.actorRole ? ' (' + actorRoleLabel(r.actorRole) + ')' : ''}`,
          r.actionLabel || '',
          summarizeTarget(r.targetType, r.targetId, r.metadata),
          r.pagePath || '',
          r.ipAddress || '',
        ]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [120, 94, 64] },
        didDrawPage: (data) => { if (data.cursor) endY = data.cursor.y; },
      });
      y = endY + 8;

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150);
        doc.text(
          `Dicetak: ${new Date().toLocaleString('id-ID')}  |  Halaman ${i} dari ${pageCount}`,
          pageW / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        );
      }

      const filename = `log-aktivitas-${from || 'all'}-sd-${to || 'all'}.pdf`;
      doc.save(filename);
      showToast('PDF log berhasil diunduh.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Gagal export PDF.', 'error');
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteOlder(months) {
    if (!window.confirm(`Hapus semua log yang lebih lama dari ${months} bulan? Tindakan ini tidak dapat dibatalkan.`)) return;
    setDeleting(true);
    try {
      const res = await deleteLogsOlderThan(months);
      showToast(`${res.deleted} log dihapus.`, 'success');
      load(currentFilters, 1);
    } catch (err) {
      showToast(err?.response?.data?.message || 'Gagal menghapus log.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  async function handleViewLog(log) {
    if (!log) return;
    setSelectedLog(log);
    if (log.read === false) {
      try {
        await markLogRead(log.id);
        setRows((prev) => prev.map((r) => (r.id === log.id ? { ...r, read: true } : r)));
        emitReadRefresh();
      } catch { /* non-fatal */ }
    }
  }

  function handleCloseDetail() {
    setSelectedLog(null);
  }

  async function handleMarkAllRead() {
    try {
      await markAllLogsRead();
      setRows((prev) => prev.map((r) => ({ ...r, read: true })));
      emitReadRefresh();
      showToast('Semua log ditandai sudah dibaca.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Gagal menandai log.', 'error');
    }
  }

  async function handleSaveRetention() {
    setRetentionSaving(true);
    try {
      await setRetentionSetting(retentionMonths);
      showToast(retentionMonths ? `Auto-retention: hapus log lebih dari ${retentionMonths} bulan.` : 'Auto-retention dinonaktifkan.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Gagal menyimpan pengaturan.', 'error');
    } finally {
      setRetentionSaving(false);
    }
  }

  // Active filters → removable chips (one per dimension).
  const chips = [];
  if (actorType === 'admin') chips.push({ key: 'actorType', label: 'Admin & Staff' });
  if (actorType === 'customer') chips.push({ key: 'actorType', label: 'Customer' });
  if (from && to) chips.push({ key: 'from-to', label: `${fmtFilterDate(from)} s.d. ${fmtFilterDate(to)}` });
  else if (from) chips.push({ key: 'from', label: `Mulai ${fmtFilterDate(from)}` });
  else if (to) chips.push({ key: 'to', label: `Sampai ${fmtFilterDate(to)}` });
  if (search) chips.push({ key: 'search', label: `"${search}"` });
  const hasActiveFilters = chips.length > 0;

  return (
    <div className="adm-card">
      <div className="adm-toolbar">
        <h2 className="adm-section-title">Log Aktivitas ({total})</h2>
        <div className="adm-toolbar-right">
          <button
            className="adm-btn"
            type="button"
            onClick={handleMarkAllRead}
            disabled={loading || total === 0}
          >
            Tandai Semua Dibaca
          </button>
          <button
            className="adm-btn adm-btn--primary"
            type="button"
            onClick={handleExportPdf}
            disabled={exporting || loading}
          >
            {exporting ? 'Mengexport…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <form className="log-filter-bar" onSubmit={handleApplyFilters} noValidate>
        <div className="log-field log-field--type">
          <label className="log-field-label" htmlFor="log-type">Tipe Log</label>
          <select
            className="adm-input"
            id="log-type"
            value={actorType}
            onChange={(e) => setActorType(e.target.value)}
          >
            <option value="">Semua</option>
            <option value="admin">Admin / Staff</option>
            <option value="customer">Customer</option>
          </select>
        </div>
        <div className="log-field log-field--date">
          <label className="log-field-label" htmlFor="log-from">Dari</label>
          <input
            className="adm-input"
            id="log-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="log-field log-field--date">
          <label className="log-field-label" htmlFor="log-to">Sampai</label>
          <input
            className="adm-input"
            id="log-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="log-field log-field--search">
          <label className="log-field-label" htmlFor="log-search">Cari</label>
          <input
            className="adm-input adm-search"
            id="log-search"
            type="search"
            placeholder="Aktor / aksi / target…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="log-field log-field--actions">
          <button className="adm-btn adm-btn--primary" type="submit" disabled={loading}>Filter</button>
          <button className="adm-btn" type="button" onClick={handleReset} disabled={loading}>Reset</button>
        </div>
      </form>

      {/* ── Active filter chips ── */}
      {hasActiveFilters && (
        <div className="log-chips">
          {chips.map((c) => (
            <span key={c.key} className="log-chip">
              {c.label}
              <button
                type="button"
                aria-label={`Hapus filter: ${c.label}`}
                onClick={(e) => handleRemoveFilter(c.key, e)}
              >
                ✕
              </button>
            </span>
          ))}
          <button className="log-chip-reset" type="button" onClick={handleReset}>Hapus semua</button>
        </div>
      )}

      {/* ── Retention & scheduled cleanup ── */}
      <div className="log-settings">
        <div className="log-settings-group">
          <span className="log-settings-label">Hapus log lebih lama dari:</span>
          {RETENTION_OPTIONS.map((o) => (
            <button
              key={o.value}
              className="adm-btn adm-btn--delete adm-btn-sm"
              type="button"
              disabled={deleting}
              onClick={() => handleDeleteOlder(o.value)}
            >
              <Trash2 size={12} aria-hidden="true" />
              {o.label}
            </button>
          ))}
        </div>
        <span className="log-settings-divider" aria-hidden="true" />
        <div className="log-settings-group">
          <span className="log-settings-label">Auto-hapus terjadwal:</span>
          <select
            className="adm-input"
            value={retentionMonths}
            onChange={(e) => setRetentionMonths(Number(e.target.value))}
            aria-label="Auto-hapus log"
          >
            {AUTO_RETENTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            className="adm-btn adm-btn--secondary adm-btn-sm"
            type="button"
            disabled={retentionSaving}
            onClick={handleSaveRetention}
          >
            {retentionSaving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>

      {/* ── Log list ── */}
      {loading ? (
        <LogSkeletonRows />
      ) : rows.length === 0 ? (
        <LogEmpty hasFilters={hasActiveFilters} onReset={handleReset} />
      ) : (
        <div className="log-list">
          {rows.map((r) => {
            const cat = classifyAction(r.actionLabel);
            const BadgeIcon = ACTION_BADGE_ICON[cat] || CircleDot;
            const targetText = summarizeTarget(r.targetType, r.targetId, r.metadata);
            const fullTime = fmtDateTime(r.createdAt);
            return (
              <div key={r.id} className={`log-row${r.read === false ? ' log-row--unread' : ''}`}>
                <span className="log-dot" aria-hidden="true" />
                <span
                  className={`log-badge log-badge--${cat}`}
                  title={ACTION_BADGE_LABEL[cat] || 'Aktivitas lain'}
                >
                  <BadgeIcon size={14} aria-hidden="true" />
                </span>
                <div className="log-main">
                  <div className="log-head">
                    <span className="log-actor">
                      {r.actorName || <em className="log-anon">anonim</em>}
                    </span>
                    {r.actorRole && (
                      <span className="log-role">{actorRoleLabel(r.actorRole)}</span>
                    )}
                    {!r.actorRole && r.actorType === 'customer' && (
                      <span className="log-role">Customer</span>
                    )}
                    <span className="log-time" title={fullTime}>
                      <span className="log-time-rel">{fmtRelative(r.createdAt)}</span>
                      <span className="log-time-full">{fullTime}</span>
                    </span>
                  </div>
                  <div className="log-body">
                    <span className="log-action">{r.actionLabel}</span>
                    {targetText !== '—' && (
                      <span className="log-target" title={targetText}>{targetText}</span>
                    )}
                  </div>
                  {r.pagePath && (
                    <div className="log-meta">
                      <span className="log-path" title={r.pagePath}>{r.pagePath}</span>
                    </div>
                  )}
                </div>
                <div className="log-actions">
                  <button
                    className="adm-btn adm-btn--secondary adm-btn-sm"
                    type="button"
                    onClick={() => handleViewLog(r)}
                  >
                    Lihat
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PaginationBar
        page={page}
        totalPages={totalPages}
        total={total}
        limit={PAGE_SIZE}
        onPageChange={(p) => load(currentFilters, p)}
      />

      <LogDetailModal log={selectedLog} isOpen={selectedLog != null} onClose={handleCloseDetail} />
    </div>
  );
}