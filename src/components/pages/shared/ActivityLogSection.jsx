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

function emitReadRefresh() {
  try {
    window.dispatchEvent(new Event(REFRESH_EVENT));
  } catch { /* ignore */ }
}

function fmtDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
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

  return (
    <div className="adm-card">
      <div className="adm-toolbar">
        <h2 className="adm-section-title">Log Aktivitas ({total})</h2>
        <div className="adm-toolbar-right">
          <button className="adm-btn" type="button" onClick={handleMarkAllRead} disabled={loading || total === 0}>
            Tandai Semua Dibaca
          </button>
          <button className="adm-btn adm-btn--primary" type="button" onClick={handleExportPdf} disabled={exporting || loading}>
            {exporting ? 'Mengexport…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <form className="adm-form" onSubmit={handleApplyFilters} noValidate style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <select
          className="adm-input"
          value={actorType}
          onChange={(e) => setActorType(e.target.value)}
          aria-label="Tipe aktor"
          style={{ width: 140 }}
        >
          <option value="">Semua Aktor</option>
          <option value="admin">Admin / Staff</option>
          <option value="customer">Customer</option>
        </select>
        <input
          className="adm-input"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="Dari tanggal"
          style={{ width: 150 }}
        />
        <span>s.d.</span>
        <input
          className="adm-input"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="Sampai tanggal"
          style={{ width: 150 }}
        />
        <input
          className="adm-input adm-search"
          type="search"
          placeholder="Cari aktor / aksi…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Cari"
          style={{ flex: '1 1 180px' }}
        />
        <button className="adm-btn adm-btn--primary" type="submit" disabled={loading}>Filter</button>
        <button className="adm-btn" type="button" onClick={handleReset} disabled={loading}>Reset</button>
      </form>

      {/* ── Retention ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>Hapus log lebih lama dari:</span>
        {RETENTION_OPTIONS.map((o) => (
          <button
            key={o.value}
            className="adm-btn adm-btn--delete"
            type="button"
            disabled={deleting}
            onClick={() => handleDeleteOlder(o.value)}
            style={{ padding: '4px 12px', fontSize: 12 }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* ── Auto-retention (scheduled) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>Auto-hapus terjadwal:</span>
        <select
          className="adm-input"
          value={retentionMonths}
          onChange={(e) => setRetentionMonths(Number(e.target.value))}
          aria-label="Auto-hapus log"
          style={{ width: 150 }}
        >
          {AUTO_RETENTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          className="adm-btn adm-btn--secondary"
          type="button"
          disabled={retentionSaving}
          onClick={handleSaveRetention}
          style={{ padding: '4px 12px', fontSize: 12 }}
        >
          {retentionSaving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <p className="adm-empty">Memuat log…</p>
      ) : rows.length === 0 ? (
        <p className="adm-empty">Tidak ada log yang cocok.</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Aktor</th>
                <th>Aksi</th>
                <th>Target</th>
                <th>Halaman</th>
                <th>IP</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  style={r.read === false ? { background: '#fdf6ec', fontWeight: 700 } : undefined}
                >
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r.createdAt)}</td>
                  <td>
                    {r.actorName || <em style={{ color: '#9ca3af' }}>anonim</em>}
                    {r.actorRole && <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>{actorRoleLabel(r.actorRole)}</div>}
                  </td>
                  <td>{r.actionLabel}</td>
                  <td><code style={{ fontSize: 12 }}>{summarizeTarget(r.targetType, r.targetId, r.metadata)}</code></td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pagePath || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.ipAddress || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button
                      className="adm-btn adm-btn--secondary"
                      type="button"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => handleViewLog(r)}
                    >
                      Lihat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
