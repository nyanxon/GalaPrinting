/**
 * FeaturePermissionSection.jsx — Owner: per-account feature checklist
 * (dynamic permission system, Step 5).
 *
 * Reads the feature catalog (GET /api/features) + the account's current
 * permissions (GET /api/admin-accounts/:id/permissions), renders a
 * collapsible checklist per category, and saves the whole granted set with
 * PUT /api/admin-accounts/:id/permissions.
 *
 * Features are independent units — no feature_key is ever bound to a role here.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  listFeatures,
  getAccountPermissions,
  updateAccountPermissions,
} from '../../../../services/adminManagement.js';
import { STAFF_ROLE_CONFIG } from '../../../../config/roles.js';
import { showToast } from '../../../../core/toastEmitter.js';

export default function FeaturePermissionSection({ userId }) {
  const navigate = useNavigate();

  const [categories, setCategories]     = useState([]);
  const [account, setAccount]           = useState(null);
  const [granted, setGranted]           = useState(new Set());
  const [expanded, setExpanded]         = useState(new Set());
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState(false);
  const [saving, setSaving]             = useState(false);

  const allFeatures = useMemo(
    () => categories.flatMap((c) => c.features),
    [categories],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [catData, permData] = await Promise.all([
        listFeatures(),
        getAccountPermissions(userId),
      ]);
      setCategories(catData);
      setAccount(permData.user ?? null);
      setGranted(new Set(permData.permissions.filter((p) => p.granted).map((p) => p.feature_key)));
      setExpanded(new Set(catData.map((c) => c.category)));
    } catch (_err) {
      setLoadError(true);
      showToast('Gagal memuat data permission.', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function toggleExpand(categoryName) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) next.delete(categoryName);
      else next.add(categoryName);
      return next;
    });
  }

  function toggleFeature(key) {
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCategory(category) {
    const keys = category.features.map((f) => f.key);
    const allChecked = keys.length > 0 && keys.every((k) => granted.has(k));
    setGranted((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (allChecked) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  }

  function countGranted(category) {
    return category.features.filter((f) => granted.has(f.key)).length;
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const payload = allFeatures.map((f) => ({
        feature_key: f.key,
        granted: granted.has(f.key),
      }));
      const result = await updateAccountPermissions(userId, payload);
      if (result?.permissions) {
        setGranted(new Set(result.permissions.filter((p) => p.granted).map((p) => p.feature_key)));
      }
      showToast('Permission berhasil disimpan.');
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan permission.';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="adm-card">
        <p className="adm-empty">Memuat data permission…</p>
      </div>
    );
  }

  if (loadError || !account) {
    return (
      <div className="adm-card">
        <p className="adm-empty">Akun tidak ditemukan atau gagal dimuat.</p>
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <button className="adm-btn" type="button" onClick={() => navigate('/admin/owner/admin-management')}>
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const roleColor = STAFF_ROLE_CONFIG[account.role]?.color ?? '#6b7280';
  const grantedCount = allFeatures.filter((f) => granted.has(f.key)).length;

  return (
    <div className="adm-card">
      <div className="adm-toolbar">
        <h2 className="adm-section-title">Atur Permission — {account.name || account.email}</h2>
        <button className="adm-btn" type="button" onClick={() => navigate('/admin/owner/admin-management')}>
          ‹ Kembali
        </button>
      </div>

      {/* Account summary */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 24px',
          alignItems: 'center',
          background: '#fafafa',
          border: '1px solid #e5e5e5',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '16px',
          fontSize: '13px',
          lineHeight: '1.7',
        }}
      >
        <span><span style={{ color: '#666' }}>Nama:</span> <strong>{account.name || '—'}</strong></span>
        <span><span style={{ color: '#666' }}>Email:</span> {account.email}</span>
        <span>
          <span style={{ color: '#666' }}>Role:</span>{' '}
          <span
            style={{
              display: 'inline-block',
              padding: '1px 8px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 700,
              background: roleColor + '18',
              color: roleColor,
            }}
          >
            {STAFF_ROLE_CONFIG[account.role]?.label ?? account.role}
          </span>
        </span>
        <span>
          <span style={{ color: '#666' }}>Status:</span>{' '}
          {account.is_promoted_admin ? (
            <span style={{ color: '#16a34a', fontWeight: 600 }}>Admin Dinamis</span>
          ) : (
            <span style={{ color: '#6b7280', fontWeight: 600 }}>Reguler</span>
          )}
        </span>
        <span style={{ marginLeft: 'auto', color: '#6b7280' }}>
          {grantedCount}/{allFeatures.length} fitur aktif
        </span>
      </div>

      {!account.is_promoted_admin && (
        <div
          role="status"
          style={{
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#92400e',
          }}
        >
          Akun ini belum dijadikan Admin Dinamis. Konfigurasi yang disimpan tetap disimpan,
          tapi baru berlaku setelah akun di-promote dari halaman Kelola Admin.
        </div>
      )}

      {/* Category accordion */}
      <div className="fperm-groups">
        {categories.map((cat) => {
          const catGranted = countGranted(cat);
          const isOpen = expanded.has(cat.category);
          const allChecked = cat.features.length > 0 && catGranted === cat.features.length;
          return (
            <div key={cat.category} className="fperm-group">
              <div className="fperm-group-header">
                <button
                  className="fperm-group-toggle"
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggleExpand(cat.category)}
                >
                  <span className={`fperm-caret${isOpen ? ' fperm-caret--open' : ''}`} aria-hidden="true">▸</span>
                  <span className="fperm-group-title">{cat.category}</span>
                  <span className="fperm-group-count">{catGranted}/{cat.features.length}</span>
                </button>
                <button
                  className="fperm-group-select"
                  type="button"
                  onClick={() => toggleCategory(cat)}
                >
                  {allChecked ? 'Kosongkan' : 'Centang Semua'}
                </button>
              </div>
              {isOpen && (
                <div className="fperm-group-body">
                  {cat.features.map((f) => {
                    const checked = granted.has(f.key);
                    return (
                      <label
                        key={f.key}
                        className="fperm-item"
                        title={f.description || f.label}
                        style={{
                          borderColor: checked ? '#c7dba6' : '#e0e0e0',
                          background: checked ? '#f4faf0' : '#fff',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFeature(f.key)}
                          disabled={saving}
                          style={{ accentColor: 'var(--brand-brown, #785E40)' }}
                          aria-label={f.label}
                        />
                        <span className="fperm-item-label">{f.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="adm-modal-actions" style={{ padding: '16px 0 0' }}>
        <button
          className="adm-btn"
          type="button"
          onClick={() => navigate('/admin/owner/admin-management')}
          disabled={saving}
        >
          Batal
        </button>
        <button
          className="adm-btn adm-btn--primary"
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saving ? 'Menyimpan…' : 'Simpan Permission'}
        </button>
      </div>
    </div>
  );
}
