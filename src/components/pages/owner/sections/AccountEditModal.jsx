/**
 * AccountEditModal.jsx — Modal for editing a user's role and permissions.
 *
 * Follows the same CSS class pattern as ProductsSection / CustomersSection:
 *   adm-modal-overlay → adm-modal → adm-modal-header / adm-modal-body / adm-modal-actions
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { STAFF_ROLE_CONFIG } from '../../../../config/roles.js';
import { ALL_ROLE_VALUES, getPermissionsForRole } from '../../../../config/permissions.js';

export default function AccountEditModal({ user, permissions, onClose, onSave, saving }) {
  const [newRole, setNewRole]           = useState(user?.role || 'customer');
  const [checkedPerms, setCheckedPerms] = useState(new Set(permissions || []));

  const selectAllRef  = useRef(null);
  const overlayRef    = useRef(null);

  const availablePerms = useMemo(() => getPermissionsForRole(newRole), [newRole]);
  const availableKeys  = useMemo(() => availablePerms.map((p) => p.key), [availablePerms]);

  const checkedCount = useMemo(
    () => availableKeys.filter((k) => checkedPerms.has(k)).length,
    [availableKeys, checkedPerms],
  );
  const allChecked  = availableKeys.length > 0 && checkedCount === availableKeys.length;
  const someChecked = checkedCount > 0 && checkedCount < availableKeys.length;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someChecked;
  }, [someChecked]);

  useEffect(() => {
    if (user) setNewRole(user.role);
    if (permissions) setCheckedPerms(new Set(permissions));
  }, [user, permissions]);

  useEffect(() => {
    const validKeys = new Set(availableKeys);
    setCheckedPerms((prev) => {
      const filtered = new Set([...prev].filter((k) => validKeys.has(k)));
      if (filtered.size === prev.size && [...filtered].every((k) => prev.has(k))) return prev;
      return filtered;
    });
  }, [availableKeys]);

  function togglePerm(key) {
    setCheckedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelectAll() {
    setCheckedPerms((prev) => {
      if (allChecked) return new Set([...prev].filter((k) => !availableKeys.includes(k)));
      return new Set([...prev, ...availableKeys]);
    });
  }

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current && !saving) onClose();
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(newRole, Array.from(checkedPerms));
  }

  if (!user) return null;

  return (
    <div
      className="adm-modal-overlay"
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-account-title"
      onClick={handleOverlayClick}
    >
      <div className="adm-modal" style={{ maxWidth: '600px' }}>

        {/* ── Header ── */}
        <div className="adm-modal-header">
          <h2 className="adm-modal-title" id="edit-account-title">
            Edit Akun
          </h2>
          <button
            className="adm-modal-close"
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            disabled={saving}
          >
            ✕
          </button>
        </div>

        {/* ── Body ── */}
        <div className="adm-modal-body">
          <form onSubmit={handleSubmit}>

            {/* Read-only user info */}
            <div
              style={{
                background: 'var(--gray-bg-3)',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                padding: '12px 14px',
                marginBottom: '16px',
                fontSize: '0.9rem',
                lineHeight: '1.7',
              }}
            >
              <div>
                <span style={{ color: '#666', minWidth: 80, display: 'inline-block' }}>Nama</span>:
                <strong> {user.name || '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#666', minWidth: 80, display: 'inline-block' }}>Email</span>:
                {' '}{user.email}
              </div>
            </div>

            {/* Role dropdown */}
            <div className="adm-field" style={{ marginBottom: '16px' }}>
              <label className="adm-label" htmlFor="role-select">Role</label>
              <select
                id="role-select"
                className="adm-input"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                disabled={saving}
              >
                {ALL_ROLE_VALUES.map((r) => (
                  <option key={r} value={r}>
                    {STAFF_ROLE_CONFIG[r]?.label ?? r}
                  </option>
                ))}
              </select>
            </div>

            {/* Permissions */}
            <div className="adm-field">
              <label className="adm-label">
                Permissions
                {availablePerms.length > 0 && (
                  <span style={{ fontWeight: 400, color: 'var(--gray-500)', fontSize: '12px', marginLeft: '8px' }}>
                    {checkedCount}/{availablePerms.length} dipilih
                  </span>
                )}
              </label>

              {availablePerms.length === 0 ? (
                <p style={{ color: 'var(--gray-500)', fontSize: '13px', fontStyle: 'italic', margin: '4px 0 0' }}>
                  Tidak ada menu untuk role ini.
                </p>
              ) : (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: '8px',
                    }}
                  >
                    {availablePerms.map((perm) => {
                      const isActive = checkedPerms.has(perm.key);
                      return (
                        <label
                          key={perm.key}
                          className="adm-field--check"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: `1px solid ${isActive ? '#c7dba6' : '#e0e0e0'}`,
                            cursor: saving ? 'not-allowed' : 'pointer',
                            background: isActive ? '#f4faf0' : '#fff',
                            fontSize: '13px',
                            transition: 'border-color 0.15s, background 0.15s',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => togglePerm(perm.key)}
                            disabled={saving}
                            style={{ accentColor: 'var(--brand-brown, #785E40)' }}
                          />
                          {perm.label}
                        </label>
                      );
                    })}
                  </div>

                  {/* Select All */}
                  <label
                    className="adm-field--check"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      marginTop: '8px',
                      borderRadius: '6px',
                      border: `1px dashed ${allChecked ? '#c7dba6' : someChecked ? '#fcd34d' : 'var(--gray-300)'}`,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      background: allChecked ? '#f4faf0' : someChecked ? 'var(--color-warning-bg-2)' : 'var(--gray-bg-3)',
                      fontSize: '13px',
                      fontWeight: 600,
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleSelectAll}
                      disabled={saving}
                      style={{ accentColor: 'var(--brand-brown, #785E40)' }}
                    />
                    Centang Semua
                  </label>
                </>
              )}
            </div>

            {/* Actions — inside form so submit works */}
            <div className="adm-modal-actions" style={{ padding: '16px 0 0' }}>
              <button
                type="button"
                className="adm-btn"
                onClick={onClose}
                disabled={saving}
              >
                Batal
              </button>
              <button
                type="submit"
                className="adm-btn adm-btn--primary"
                disabled={saving}
              >
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
