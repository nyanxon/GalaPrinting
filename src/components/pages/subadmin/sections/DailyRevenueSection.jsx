/**
 * DailyRevenueSection.jsx — Rekap Data Harian untuk CashierDashboard.
 *
 * Menampilkan KPI pendapatan per sumber, tabel transaksi website (read-only),
 * dan tabel transaksi manual yang dapat ditambah / diedit / dihapus via modal.
 *
 * Requirements: 7.1–7.7, 8.1–8.4, 9.1–9.3, 10.1–10.3, 11.1–11.4
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../core/httpClient.js';
import { formatCurrency } from '../../../../utils/format.js';
import { exportRecapPdf } from '../../../../utils/exportRecapPdf.js';
import { showToast } from '../../../../core/toastEmitter.js';
import '../../../../styles/css/pages/daily-revenue.css';

/* ── Konstanta label & badge ───────────────────────────────────────────────── */

const CATEGORY_LABELS = {
  shopee:        'Shopee',
  tokopedia:     'Tokopedia',
  tiktok_shop:   'TikTok Shop',
};

const CATEGORY_BADGE_CLASS = {
  shopee:        'rev-source-badge--shopee',
  tokopedia:     'rev-source-badge--tokopedia',
  tiktok_shop:   'rev-source-badge--tiktok',
};

/* ── Nilai awal form ───────────────────────────────────────────────────────── */

const FORM_CATEGORIES = CATEGORY_LABELS;

const EMPTY_FORM = {
  transaction_date: '',
  source_category:  '',
  amount:           '',
  notes:            '',
};

/* ── Helper format tanggal untuk display di tabel ─────────────────────────── */

function formatDateDisplay(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('id-ID');
}

/* ── Helper: ambil tanggal hari ini sebagai YYYY-MM-DD ────────────────────── */

function todayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* ══════════════════════════════════════════════════════════════════════════════
   Komponen utama
   ══════════════════════════════════════════════════════════════════════════════ */

export default function DailyRevenueSection() {
  /* ── State ─────────────────────────────────────────────────────────────── */
  const [selectedDate, setSelectedDate] = useState(todayString);
  const [recap,        setRecap]        = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [modal,        setModal]        = useState(null); // { mode, transaction? }
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [fieldErrors,  setFieldErrors]  = useState({});
  const [submitting,   setSubmitting]   = useState(false);
  const [rangeStart,   setRangeStart]   = useState(todayString);
  const [rangeEnd,     setRangeEnd]     = useState(todayString);
  const [exporting,    setExporting]    = useState(false);

  /* ── Load rekap ────────────────────────────────────────────────────────── */

  const loadRecap = useCallback(async (date) => {
    setLoading(true);
    setRecap(null);
    try {
      const res = await api.get('/api/revenue/daily-recap?date=' + date);
      setRecap(res.data.data);
    } catch (err) {
      showToast(
        err.response?.data?.message || 'Gagal memuat rekap.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecap(selectedDate);
  }, [selectedDate, loadRecap]);

  /* ── PDF export ─────────────────────────────────────────────────────────── */

  async function handleExportPdf() {
    if (!rangeStart || !rangeEnd) {
      showToast('Pilih tanggal awal dan akhir.', 'error');
      return;
    }
    if (rangeStart > rangeEnd) {
      showToast('Tanggal awal tidak boleh lebih besar dari tanggal akhir.', 'error');
      return;
    }
    setExporting(true);
    try {
      const res = await api.get(
        `/api/revenue/recap-range?start=${rangeStart}&end=${rangeEnd}`
      );
      const days = res.data.data;
      if (!days || days.length === 0) {
        showToast('Tidak ada data untuk rentang tanggal ini.', 'error');
        return;
      }
      exportRecapPdf(days, rangeStart, rangeEnd);
      showToast('PDF berhasil diunduh.', 'success');
    } catch (err) {
      showToast(
        err.response?.data?.message || 'Gagal membuat PDF.',
        'error'
      );
    } finally {
      setExporting(false);
    }
  }

  /* ── Validasi form ─────────────────────────────────────────────────────── */

  function validateForm() {
    const errors = {};

    if (!form.transaction_date) {
      errors.transaction_date = 'Tanggal transaksi wajib diisi.';
    }
    if (!form.source_category) {
      errors.source_category = 'Kategori sumber wajib dipilih.';
    }
    if (!form.amount || Number(form.amount) <= 0) {
      errors.amount = 'Nominal wajib diisi dan harus lebih dari 0.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  /* ── Modal handlers ────────────────────────────────────────────────────── */

  function handleOpenAdd() {
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setModal({ mode: 'add' });
  }

  function handleOpenEdit(tx) {
    // Normalkan transaction_date ke YYYY-MM-DD untuk <input type="date">
    const rawDate = tx.transaction_date;
    const normalizedDate =
      rawDate && rawDate.length > 10
        ? rawDate.slice(0, 10)
        : rawDate || '';

    setForm({
      transaction_date: normalizedDate,
      source_category:  tx.source_category  || '',
      amount:           tx.amount != null ? String(tx.amount) : '',
      notes:            tx.notes            || '',
    });
    setFieldErrors({});
    setModal({ mode: 'edit', transaction: tx });
  }

  function handleOpenDelete(tx) {
    setModal({ mode: 'confirm-delete', transaction: tx });
  }

  function handleCloseModal() {
    setModal(null);
    setFieldErrors({});
  }

  /* ── Submit tambah / edit ──────────────────────────────────────────────── */

  async function handleSubmit() {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      let res;
      if (modal.mode === 'add') {
        res = await api.post('/api/revenue/manual-transaction', form);
      } else {
        res = await api.put(
          '/api/revenue/manual-transaction/' + modal.transaction.id,
          form
        );
      }

      if (res.data.ok) {
        handleCloseModal();
        loadRecap(selectedDate);
        showToast(
          modal.mode === 'add'
            ? 'Transaksi berhasil ditambahkan.'
            : 'Transaksi berhasil diperbarui.',
          'success'
        );
      }
    } catch (err) {
      showToast(
        err.response?.data?.message || 'Gagal menyimpan.',
        'error'
      );
      // Modal tetap terbuka — tidak memanggil handleCloseModal()
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Konfirmasi hapus ──────────────────────────────────────────────────── */

  async function handleConfirmDelete() {
    setSubmitting(true);
    try {
      await api.delete(
        '/api/revenue/manual-transaction/' + modal.transaction.id
      );
      handleCloseModal();
      loadRecap(selectedDate);
      showToast('Transaksi berhasil dihapus.', 'success');
    } catch (err) {
      showToast(
        err.response?.data?.message || 'Gagal menghapus.',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Helper update field form ──────────────────────────────────────────── */

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  /* ── Data rekap per sumber ─────────────────────────────────────────────── */

  const manualByCategory = recap?.manual_by_category ?? {};
  const websiteTotal     = recap?.website_total       ?? 0;
  const grandTotal       = recap?.grand_total         ?? 0;

  const websiteTransactions = recap?.website_transactions ?? [];
  const manualTransactions  = recap?.manual_transactions  ?? [];

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div className="adm-card">

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="adm-toolbar">
        <h2 className="adm-section-title">📊 Rekap Harian</h2>
        <input
          type="date"
          className="adm-input"
          style={{ width: 'auto' }}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          aria-label="Pilih tanggal rekap"
        />
      </div>

      {/* ── Export PDF toolbar ─────────────────────────────────────────── */}
      <div
        className="adm-toolbar"
        style={{ marginTop: '8px', gap: '8px', flexWrap: 'wrap' }}
      >
        <span style={{ fontWeight: 600, fontSize: '13px' }}>📄 Export PDF</span>
        <input
          type="date"
          className="adm-input"
          style={{ width: 'auto' }}
          value={rangeStart}
          onChange={(e) => setRangeStart(e.target.value)}
          aria-label="Tanggal awal"
        />
        <span style={{ alignSelf: 'center', color: 'var(--muted)' }}>s/d</span>
        <input
          type="date"
          className="adm-input"
          style={{ width: 'auto' }}
          value={rangeEnd}
          onChange={(e) => setRangeEnd(e.target.value)}
          aria-label="Tanggal akhir"
        />
        <button
          type="button"
          className="adm-btn adm-btn--primary"
          disabled={exporting}
          onClick={handleExportPdf}
        >
          {exporting ? 'Membuat PDF…' : '⬇ Download PDF'}
        </button>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="rev-kpi-grid" style={{ margin: '16px 0' }}>

        {/* Website (Otomatis) */}
        <div className="rev-kpi-card">
          <span className="rev-kpi-card__label">🌐 Website</span>
          {loading ? (
            <div className="rev-daily-skeleton" />
          ) : (
            <span className="rev-kpi-card__value">
              {formatCurrency(websiteTotal)}
            </span>
          )}
        </div>

        {/* Shopee */}
        <div className="rev-kpi-card">
          <span className="rev-kpi-card__label">🛍 Shopee</span>
          {loading ? (
            <div className="rev-daily-skeleton" />
          ) : (
            <span className="rev-kpi-card__value">
              {formatCurrency(manualByCategory.shopee ?? 0)}
            </span>
          )}
        </div>

        {/* Tokopedia */}
        <div className="rev-kpi-card">
          <span className="rev-kpi-card__label">🟢 Tokopedia</span>
          {loading ? (
            <div className="rev-daily-skeleton" />
          ) : (
            <span className="rev-kpi-card__value">
              {formatCurrency(manualByCategory.tokopedia ?? 0)}
            </span>
          )}
        </div>

        {/* TikTok Shop */}
        <div className="rev-kpi-card">
          <span className="rev-kpi-card__label">🎵 TikTok Shop</span>
          {loading ? (
            <div className="rev-daily-skeleton" />
          ) : (
            <span className="rev-kpi-card__value">
              {formatCurrency(manualByCategory.tiktok_shop ?? 0)}
            </span>
          )}
        </div>

        {/* Grand Total */}
        <div className="rev-kpi-card rev-kpi-card--grand">
          <span className="rev-kpi-card__label">💰 Grand Total</span>
          {loading ? (
            <div className="rev-daily-skeleton" />
          ) : (
            <span className="rev-kpi-card__value">
              {formatCurrency(grandTotal)}
            </span>
          )}
        </div>

      </div>

      {/* ── Tabel Website (read-only) ────────────────────────────────────── */}
      <section style={{ marginBottom: '28px' }}>
        <div
          className="adm-toolbar"
          style={{ marginBottom: '10px' }}
        >
          <span style={{ fontWeight: 600 }}>🌐 Transaksi Website</span>
          <span className="rev-website-badge">Otomatis dari Sistem</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="adm-table">
            <thead>
              <tr>
                <th>No. Order</th>
                <th>Tanggal Bayar</th>
                <th>Status</th>
                <th>Nominal</th>
              </tr>
            </thead>
            <tbody>
              {websiteTransactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="adm-empty">
                    Belum ada data.
                  </td>
                </tr>
              ) : (
                websiteTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <code>{tx.order_number}</code>
                    </td>
                    <td>{formatDateDisplay(tx.paid_at)}</td>
                    <td>{tx.status}</td>
                    <td>{formatCurrency(Number(tx.subtotal))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Tabel Transaksi Manual ───────────────────────────────────────── */}
      <section>
        <div
          className="adm-toolbar"
          style={{ marginBottom: '10px' }}
        >
          <span style={{ fontWeight: 600 }}>📝 Transaksi Manual</span>
          <button
            type="button"
            className="adm-btn adm-btn--primary"
            onClick={handleOpenAdd}
          >
            ＋ Tambah Transaksi
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Sumber</th>
                <th>Nominal</th>
                <th>Catatan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {manualTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="adm-empty">
                    Belum ada data.
                  </td>
                </tr>
              ) : (
                manualTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{formatDateDisplay(tx.transaction_date)}</td>
                    <td>
                      <span
                        className={`rev-source-badge ${
                          CATEGORY_BADGE_CLASS[tx.source_category] ?? ''
                        }`}
                      >
                        {CATEGORY_LABELS[tx.source_category] ?? tx.source_category}
                      </span>
                    </td>
                    <td>{formatCurrency(Number(tx.amount))}</td>
                    <td
                      style={{
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={tx.notes || ''}
                    >
                      {tx.notes || <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="adm-btn"
                          style={{ padding: '4px 12px', fontSize: '13px' }}
                          onClick={() => handleOpenEdit(tx)}
                          aria-label={`Edit transaksi ${tx.id}`}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          className="adm-btn"
                          style={{
                            padding: '4px 12px',
                            fontSize: '13px',
                            color: '#dc2626',
                            borderColor: '#fca5a5',
                          }}
                          onClick={() => handleOpenDelete(tx)}
                          aria-label={`Hapus transaksi ${tx.id}`}
                        >
                          🗑️ Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          Modal Form Tambah / Edit
         ══════════════════════════════════════════════════════════════════ */}
      {modal && (modal.mode === 'add' || modal.mode === 'edit') && (
        <div className="rev-modal-overlay" role="dialog" aria-modal="true">
          <div className="rev-modal">

            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>
              {modal.mode === 'add'
                ? '＋ Tambah Transaksi Manual'
                : '✏️ Edit Transaksi'}
            </h3>

            {/* ── Tanggal Transaksi ── */}
            <div className="offline-form-field" style={{ marginBottom: '14px' }}>
              <label className="offline-form-label">
                Tanggal Transaksi <span className="offline-required">*</span>
              </label>
              <input
                type="date"
                className={`adm-input${fieldErrors.transaction_date ? ' adm-input--error' : ''}`}
                value={form.transaction_date}
                onChange={(e) => setField('transaction_date', e.target.value)}
              />
              {fieldErrors.transaction_date && (
                <span className="offline-field-error">
                  {fieldErrors.transaction_date}
                </span>
              )}
            </div>

            {/* ── Kategori Sumber ── */}
            <div className="offline-form-field" style={{ marginBottom: '14px' }}>
              <label className="offline-form-label">
                Kategori Sumber <span className="offline-required">*</span>
              </label>
              <select
                className={`adm-input${fieldErrors.source_category ? ' adm-input--error' : ''}`}
                value={form.source_category}
                onChange={(e) => setField('source_category', e.target.value)}
              >
                <option value="">— Pilih kategori —</option>
                {Object.entries(FORM_CATEGORIES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {fieldErrors.source_category && (
                <span className="offline-field-error">
                  {fieldErrors.source_category}
                </span>
              )}
            </div>

            {/* ── Nominal ── */}
            <div className="offline-form-field" style={{ marginBottom: '14px' }}>
              <label className="offline-form-label">
                Nominal (Rp) <span className="offline-required">*</span>
              </label>
              <input
                type="number"
                min="1"
                className={`adm-input${fieldErrors.amount ? ' adm-input--error' : ''}`}
                placeholder="0"
                value={form.amount}
                onChange={(e) => setField('amount', e.target.value)}
              />
              {fieldErrors.amount && (
                <span className="offline-field-error">
                  {fieldErrors.amount}
                </span>
              )}
            </div>

            {/* ── Catatan ── */}
            <div className="offline-form-field" style={{ marginBottom: '24px' }}>
              <label className="offline-form-label">Catatan (opsional)</label>
              <textarea
                className="adm-input"
                rows={3}
                placeholder="Catatan tambahan…"
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* ── Tombol aksi ── */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                className="adm-btn"
                onClick={handleCloseModal}
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="adm-btn adm-btn--primary"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Menyimpan…' : '💾 Simpan'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Modal Konfirmasi Hapus
         ══════════════════════════════════════════════════════════════════ */}
      {modal?.mode === 'confirm-delete' && (
        <div className="rev-modal-overlay" role="dialog" aria-modal="true">
          <div className="rev-modal" style={{ maxWidth: '400px' }}>

            <h3 style={{ marginTop: 0, marginBottom: '12px' }}>
              🗑️ Hapus Transaksi
            </h3>

            <p style={{ marginBottom: '12px', color: 'var(--text)' }}>
              Apakah Anda yakin ingin menghapus transaksi ini?
            </p>

            {/* Detail transaksi yang akan dihapus */}
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 16px',
                marginBottom: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span>
                <strong>Nominal:</strong>{' '}
                {formatCurrency(Number(modal.transaction.amount))}
              </span>
              <span>
                <strong>Sumber:</strong>{' '}
                <span
                  className={`rev-source-badge ${
                    CATEGORY_BADGE_CLASS[modal.transaction.source_category] ?? ''
                  }`}
                >
                  {CATEGORY_LABELS[modal.transaction.source_category] ??
                    modal.transaction.source_category}
                </span>
              </span>
              {modal.transaction.notes && (
                <span>
                  <strong>Catatan:</strong> {modal.transaction.notes}
                </span>
              )}
            </div>

            {/* Tombol aksi */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                className="adm-btn"
                onClick={handleCloseModal}
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="adm-btn"
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  borderColor: '#dc2626',
                }}
                onClick={handleConfirmDelete}
                disabled={submitting}
              >
                {submitting ? 'Menghapus…' : '🗑️ Hapus'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
