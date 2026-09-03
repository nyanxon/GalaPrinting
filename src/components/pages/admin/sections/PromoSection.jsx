/**
 * PromoSection.jsx — Promo code management for Admin and Owner.
 *
 * Features:
 * - List all promo codes with usage stats
 * - Create / edit / delete promo codes
 * - View per-promo usage log (who used it, when, discount amount)
 * - Supports: percentage & fixed discount, daily limit, min purchase, max discount, expiry
 */

import { useState, useEffect, useRef } from 'react';
import { api } from '../../../../core/httpClient.js';
import { track } from '../../../../utils/activityTracker.js';
import { formatCurrency } from '../../../../utils/format.js';
import { showToast } from '../../../../core/toastEmitter.js';

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchPromos() {
  const res = await api.get('/api/promo');
  return res.data.data ?? [];
}

async function fetchUsageLog(promoId) {
  const res = await api.get(`/api/promo/${promoId}/usage`);
  return res.data.data ?? [];
}

async function createPromo(data) {
  const res = await api.post('/api/promo', data);
  return res.data.data;
}

async function updatePromo(id, data) {
  const res = await api.put(`/api/promo/${id}`, data);
  return res.data.data;
}

async function deletePromo(id) {
  await api.delete(`/api/promo/${id}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateInput(dt) {
  if (!dt) return '';
  return new Date(dt).toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
}

const EMPTY_FORM = {
  code: '',
  description: '',
  type: 'percentage',
  value: '',
  maxUses: '',
  dailyLimit: '',
  minPurchase: '',
  maxDiscount: '',
  expiresAt: '',
  isActive: true,
};

// ── Promo Form Modal ──────────────────────────────────────────────────────────

function PromoModal({ promo, onClose, onSaved }) {
  const [form, setForm] = useState(
    promo
      ? {
          code:        promo.code,
          description: promo.description ?? '',
          type:        promo.type,
          value:       String(promo.value),
          maxUses:     promo.maxUses != null ? String(promo.maxUses) : '',
          dailyLimit:  promo.dailyLimit != null ? String(promo.dailyLimit) : '',
          minPurchase: promo.minPurchase > 0 ? String(promo.minPurchase) : '',
          maxDiscount: promo.maxDiscount != null ? String(promo.maxDiscount) : '',
          expiresAt:   formatDateInput(promo.expiresAt),
          isActive:    promo.isActive,
        }
      : { ...EMPTY_FORM }
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const overlayRef = useRef(null);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const payload = {
      code:        form.code.trim().toUpperCase(),
      description: form.description.trim() || null,
      type:        form.type,
      value:       Number(form.value),
      maxUses:     form.maxUses     !== '' ? Number(form.maxUses)     : null,
      dailyLimit:  form.dailyLimit  !== '' ? Number(form.dailyLimit)  : null,
      minPurchase: form.minPurchase !== '' ? Number(form.minPurchase) : 0,
      maxDiscount: form.maxDiscount !== '' ? Number(form.maxDiscount) : null,
      expiresAt:   form.expiresAt   !== '' ? new Date(form.expiresAt).toISOString() : null,
      isActive:    form.isActive,
    };

    setSaving(true);
    try {
      if (promo) {
        await updatePromo(promo.id, payload);
        track('Update Promo', {
          targetType: 'promo', targetId: promo.id,
          metadata: { code: payload.code },
        });
        showToast('Promo berhasil diperbarui.', 'success');
      } else {
        await createPromo(payload);
        track('Tambah Promo', {
          targetType: 'promo',
          metadata: { code: payload.code, type: payload.type },
        });
        showToast('Promo berhasil dibuat.', 'success');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal menyimpan promo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="adm-modal-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="promo-modal-title"
    >
      <div className="adm-modal" style={{ maxWidth: '560px' }}>
        <div className="adm-modal-header">
          <h2 className="adm-modal-title" id="promo-modal-title">
            {promo ? 'Edit Promo' : 'Buat Promo Baru'}
          </h2>
          <button className="adm-modal-close" type="button" aria-label="Tutup" onClick={onClose}>✕</button>
        </div>

        <div className="adm-modal-body">
          <form className="adm-form" onSubmit={handleSubmit} noValidate>

            {/* Code */}
            <div className="adm-field">
              <label className="adm-label" htmlFor="pr-code">Kode Promo *</label>
              <input
                className="adm-input"
                id="pr-code"
                name="code"
                value={form.code}
                onChange={handleChange}
                placeholder="GALA10"
                required
                style={{ textTransform: 'uppercase' }}
              />
            </div>

            {/* Description */}
            <div className="adm-field">
              <label className="adm-label" htmlFor="pr-desc">Deskripsi</label>
              <input
                className="adm-input"
                id="pr-desc"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Diskon 10% untuk semua produk"
              />
            </div>

            {/* Type + Value */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="adm-field">
                <label className="adm-label" htmlFor="pr-type">Tipe Diskon *</label>
                <select className="adm-input" id="pr-type" name="type" value={form.type} onChange={handleChange}>
                  <option value="percentage">Persentase (%)</option>
                  <option value="fixed">Nominal (Rp)</option>
                </select>
              </div>
              <div className="adm-field">
                <label className="adm-label" htmlFor="pr-value">
                  Nilai Diskon * {form.type === 'percentage' ? '(%)' : '(Rp)'}
                </label>
                <input
                  className="adm-input"
                  id="pr-value"
                  name="value"
                  type="number"
                  min="0"
                  max={form.type === 'percentage' ? 100 : undefined}
                  step={form.type === 'percentage' ? '0.01' : '1000'}
                  value={form.value}
                  onChange={handleChange}
                  placeholder={form.type === 'percentage' ? '10' : '50000'}
                  required
                />
              </div>
            </div>

            {/* Daily limit + Max uses */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="adm-field">
                <label className="adm-label" htmlFor="pr-daily">
                  Batas per Hari
                  <span className="adm-hint"> (orang pertama)</span>
                </label>
                <input
                  className="adm-input"
                  id="pr-daily"
                  name="dailyLimit"
                  type="number"
                  min="1"
                  value={form.dailyLimit}
                  onChange={handleChange}
                  placeholder="Kosong = tidak terbatas"
                />
              </div>
              <div className="adm-field">
                <label className="adm-label" htmlFor="pr-maxuses">
                  Total Maks. Penggunaan
                </label>
                <input
                  className="adm-input"
                  id="pr-maxuses"
                  name="maxUses"
                  type="number"
                  min="1"
                  value={form.maxUses}
                  onChange={handleChange}
                  placeholder="Kosong = tidak terbatas"
                />
              </div>
            </div>

            {/* Min purchase + Max discount */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="adm-field">
                <label className="adm-label" htmlFor="pr-minpurchase">
                  Minimal Pembelanjaan (Rp)
                </label>
                <input
                  className="adm-input"
                  id="pr-minpurchase"
                  name="minPurchase"
                  type="number"
                  min="0"
                  step="1000"
                  value={form.minPurchase}
                  onChange={handleChange}
                  placeholder="0 = tidak ada minimum"
                />
              </div>
              <div className="adm-field">
                <label className="adm-label" htmlFor="pr-maxdiscount">
                  Maks. Potongan Harga (Rp)
                </label>
                <input
                  className="adm-input"
                  id="pr-maxdiscount"
                  name="maxDiscount"
                  type="number"
                  min="0"
                  step="1000"
                  value={form.maxDiscount}
                  onChange={handleChange}
                  placeholder="Kosong = tidak dibatasi"
                />
              </div>
            </div>

            {/* Expires at */}
            <div className="adm-field">
              <label className="adm-label" htmlFor="pr-expires">
                Berlaku Hingga
              </label>
              <input
                className="adm-input"
                id="pr-expires"
                name="expiresAt"
                type="datetime-local"
                value={form.expiresAt}
                onChange={handleChange}
              />
            </div>

            {/* Active toggle */}
            <div className="adm-field adm-field--check">
              <label className="adm-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={form.isActive}
                  onChange={handleChange}
                />
                Promo aktif
              </label>
            </div>

            {error && <div className="adm-form-alert" role="alert">{error}</div>}

            <div className="adm-form-actions">
              <button className="adm-btn adm-btn--primary" type="submit" disabled={saving}>
                {saving ? 'Menyimpan…' : (promo ? 'Simpan Perubahan' : 'Buat Promo')}
              </button>
              <button className="adm-btn" type="button" onClick={onClose} disabled={saving}>Batal</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Usage Log Modal ───────────────────────────────────────────────────────────

function UsageLogModal({ promo, onClose }) {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const overlayRef = useRef(null);

  useEffect(() => {
    fetchUsageLog(promo.id)
      .then(setLog)
      .catch(() => showToast('Gagal memuat log penggunaan.', 'error'))
      .finally(() => setLoading(false));
  }, [promo.id]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="adm-modal-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="promo-log-title"
    >
      <div className="adm-modal" style={{ maxWidth: '720px' }}>
        <div className="adm-modal-header">
          <h2 className="adm-modal-title" id="promo-log-title">
            Log Penggunaan — <span style={{ color: 'var(--brand-brown, #785E40)' }}>{promo.code}</span>
          </h2>
          <button className="adm-modal-close" type="button" aria-label="Tutup" onClick={onClose}>✕</button>
        </div>

        <div className="adm-modal-body">
          {/* Summary */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div className="promo-stat-card">
              <div className="promo-stat-value">{promo.usageCount}</div>
              <div className="promo-stat-label">Total Penggunaan</div>
            </div>
            {promo.dailyLimit && (
              <div className="promo-stat-card">
                <div className="promo-stat-value">{promo.dailyLimit}</div>
                <div className="promo-stat-label">Batas per Hari</div>
              </div>
            )}
            {promo.maxUses && (
              <div className="promo-stat-card">
                <div className="promo-stat-value">{promo.maxUses}</div>
                <div className="promo-stat-label">Maks. Total</div>
              </div>
            )}
          </div>

          {loading ? (
            <p style={{ color: 'var(--gray-light)', textAlign: 'center', padding: '24px' }}>Memuat log...</p>
          ) : log.length === 0 ? (
            <p style={{ color: 'var(--gray-light)', textAlign: 'center', padding: '24px' }}>
              Belum ada penggunaan untuk promo ini.
            </p>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Pelanggan</th>
                    <th>Email</th>
                    <th>Subtotal</th>
                    <th>Potongan</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((entry) => (
                    <tr key={entry.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>{formatDate(entry.used_at)}</td>
                      <td>{entry.customer_name || '—'}</td>
                      <td style={{ fontSize: '13px', color: 'var(--gray-mid)' }}>{entry.customer_email || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(entry.order_subtotal)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: 700 }}>
                        -{formatCurrency(entry.discount_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main PromoSection ─────────────────────────────────────────────────────────

export default function PromoSection() {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [logPromo, setLogPromo] = useState(null);

  async function loadPromos() {
    setLoading(true);
    try {
      const data = await fetchPromos();
      setPromos(data);
    } catch (err) {
      showToast(err?.response?.data?.message || 'Gagal memuat data promo.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPromos(); }, []);

  async function handleDelete(promo) {
    if (!window.confirm(`Hapus promo "${promo.code}"? Semua log penggunaan juga akan dihapus.`)) return;
    try {
      await deletePromo(promo.id);
      track('Hapus Promo', {
        targetType: 'promo', targetId: promo.id,
        metadata: { code: promo.code },
      });
      showToast('Promo dihapus.', 'success');
      loadPromos();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Gagal menghapus promo.', 'error');
    }
  }

  async function handleToggleActive(promo) {
    try {
      await updatePromo(promo.id, { isActive: !promo.isActive });
      track('Ubah Status Promo', {
        targetType: 'promo', targetId: promo.id,
        metadata: { isActive: !promo.isActive, code: promo.code },
      });
      showToast(promo.isActive ? 'Promo dinonaktifkan.' : 'Promo diaktifkan.', 'success');
      loadPromos();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Gagal mengubah status promo.', 'error');
    }
  }

  return (
    <>
      <div className="adm-card">
        <div className="adm-toolbar">
          <h2 className="adm-section-title">Manajemen Promo ({promos.length})</h2>
          <div className="adm-toolbar-right">
            <button
              className="adm-btn adm-btn--primary"
              type="button"
              onClick={() => { setEditingPromo(null); setModalOpen(true); }}
            >
              + Buat Promo
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ padding: '32px', textAlign: 'center', color: 'var(--gray-light)' }}>Memuat data promo...</p>
        ) : promos.length === 0 ? (
          <p style={{ padding: '32px', textAlign: 'center', color: 'var(--gray-light)' }}>
            Belum ada promo. Klik "+ Buat Promo" untuk membuat promo pertama.
          </p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Deskripsi</th>
                  <th>Diskon</th>
                  <th>Syarat</th>
                  <th>Penggunaan</th>
                  <th>Berlaku Hingga</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {promos.map((p) => {
                  const isExpired = p.expiresAt && new Date(p.expiresAt) < new Date();
                  const isExhausted = p.maxUses != null && p.usageCount >= p.maxUses;

                  return (
                    <tr key={p.id}>
                      {/* Code */}
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', letterSpacing: '0.05em' }}>
                          {p.code}
                        </span>
                      </td>

                      {/* Description */}
                      <td style={{ color: 'var(--gray-mid)', fontSize: '13px', maxWidth: '160px' }}>
                        {p.description || '—'}
                      </td>

                      {/* Discount */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className="promo-badge promo-badge--discount">
                          {p.type === 'percentage'
                            ? `${p.value}%`
                            : formatCurrency(p.value)}
                        </span>
                        {p.maxDiscount != null && (
                          <div style={{ fontSize: '11px', color: 'var(--gray-light)', marginTop: '2px' }}>
                            maks. {formatCurrency(p.maxDiscount)}
                          </div>
                        )}
                      </td>

                      {/* Conditions */}
                      <td style={{ fontSize: '12px', color: 'var(--gray-mid)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {p.minPurchase > 0 && (
                            <span>Min. {formatCurrency(p.minPurchase)}</span>
                          )}
                          {p.dailyLimit != null && (
                            <span>🕐 {p.dailyLimit} orang/hari</span>
                          )}
                          {p.maxUses != null && (
                            <span>📊 Maks. {p.maxUses}×</span>
                          )}
                          {!p.minPurchase && p.dailyLimit == null && p.maxUses == null && (
                            <span style={{ color: '#ccc' }}>—</span>
                          )}
                        </div>
                      </td>

                      {/* Usage */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="promo-usage-btn"
                          type="button"
                          onClick={() => setLogPromo(p)}
                          title="Lihat log penggunaan"
                        >
                          {p.usageCount}
                          {p.maxUses != null && (
                            <span style={{ color: 'var(--gray-light)', fontWeight: 400 }}>/{p.maxUses}</span>
                          )}
                          <span style={{ marginLeft: '4px', fontSize: '11px' }}>👁</span>
                        </button>
                      </td>

                      {/* Expires */}
                      <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {p.expiresAt ? (
                          <span style={{ color: isExpired ? 'var(--color-danger)' : '#3a3a3a' }}>
                            {isExpired ? '⚠️ ' : ''}{formatDate(p.expiresAt)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--gray-light)' }}>Tidak terbatas</span>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        {isExpired ? (
                          <span className="promo-badge promo-badge--expired">Kedaluwarsa</span>
                        ) : isExhausted ? (
                          <span className="promo-badge promo-badge--exhausted">Habis</span>
                        ) : p.isActive ? (
                          <span className="promo-badge promo-badge--active">Aktif</span>
                        ) : (
                          <span className="promo-badge promo-badge--inactive">Nonaktif</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="adm-actions">
                          <button
                            className="adm-btn adm-btn--edit"
                            type="button"
                            onClick={() => { setEditingPromo(p); setModalOpen(true); }}
                          >
                            Edit
                          </button>
                          <button
                            className={`adm-btn ${p.isActive ? 'adm-btn--delete' : 'adm-btn--primary'}`}
                            type="button"
                            onClick={() => handleToggleActive(p)}
                            style={{ fontSize: '12px', padding: '4px 10px' }}
                          >
                            {p.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button
                            className="adm-btn adm-btn--delete"
                            type="button"
                            onClick={() => handleDelete(p)}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {modalOpen && (
        <PromoModal
          promo={editingPromo}
          onClose={() => { setModalOpen(false); setEditingPromo(null); }}
          onSaved={loadPromos}
        />
      )}

      {/* Usage log modal */}
      {logPromo && (
        <UsageLogModal
          promo={logPromo}
          onClose={() => setLogPromo(null)}
        />
      )}
    </>
  );
}
