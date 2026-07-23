/**
 * AccountEditModal.jsx — Modal for editing a user's role and permissions.
 *
 * Read-only user info (name, email) + editable role dropdown + permission checkboxes.
 * Checkboxes are DYNAMIC: they change based on the selected role, showing only
 * the menus/features that role actually has.
 *
 * Uses src/config/permissions.js as the single source of truth.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { STAFF_ROLE_CONFIG } from '../../../../config/roles.js';
import { ALL_ROLE_VALUES, getPermissionsForRole } from '../../../../config/permissions.js';

export default function AccountEditModal({ user, permissions, onClose, onSave, saving }) {
  const [newRole, setNewRole]           = useState(user?.role || 'customer');
  const [checkedPerms, setCheckedPerms] = useState(new Set(permissions || []));

  const selectAllRef = useRef(null);

  // Permissions valid for the currently selected role
  const availablePerms = useMemo(() => getPermissionsForRole(newRole), [newRole]);
  const availableKeys  = useMemo(() => availablePerms.map((p) => p.key), [availablePerms]);

  const checkedCount = useMemo(
    () => availableKeys.filter((k) => checkedPerms.has(k)).length,
    [availableKeys, checkedPerms],
  );
  const allChecked    = availableKeys.length > 0 && checkedCount === availableKeys.length;
  const someChecked   = checkedCount > 0 && checkedCount < availableKeys.length;

  // Keep indeterminate state in sync (native property, not attribute)
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

  // Re-sync state when props change (modal opens with new data)
  useEffect(() => {
    if (user) setNewRole(user.role);
    if (permissions) setCheckedPerms(new Set(permissions));
  }, [user, permissions]);

  // When role changes, filter checkedPerms to only keep valid keys for the new role
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

  function handleSubmit(e) {
    e.preventDefault();
    onSave(newRole, Array.from(checkedPerms));
  }

  if (!user) return null;

  return (
    <div
      className="adm-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-account-title"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div className="adm-modal" style={{ maxWidth: '600px' }}>
        <h3 className="adm-modal-title" id="edit-account-title">
          Edit Akun — {user.name}
        </h3>

        <form onSubmit={handleSubmit}>
          {/* ── Read-only user info ── */}
          <div
            style={{
              background: '#fafafa',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 14px',
              marginBottom: '16px',
              fontSize: '0.9rem',
              lineHeight: '1.7',
            }}
          >
            <div>
              <span style={{ color: 'var(--muted)', minWidth: 80, display: 'inline-block' }}>Nama</span>:
              <strong> {user.name || '—'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--muted)', minWidth: 80, display: 'inline-block' }}>Email</span>:
              {' '}{user.email}
            </div>
          </div>

          {/* ── Role dropdown ── */}
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="role-select"
              style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.9rem' }}
            >
              Role
            </label>
            <select
              id="role-select"
              className="adm-input"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              disabled={saving}
              style={{ width: '100%' }}
            >
              {ALL_ROLE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {STAFF_ROLE_CONFIG[r]?.label ?? r}
                </option>
              ))}
            </select>
          </div>

          {/* ── Permissions checkboxes (dynamic per role) ── */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                Permissions
                {availablePerms.length > 0 && (
                  <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '0.8rem', marginLeft: '8px' }}>
                    {checkedCount}/{availablePerms.length} dipilih
                  </span>
                )}
              </label>
            </div>

            {availablePerms.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                Tidak ada menu untuk role ini.
              </p>
            ) : (
              <>
                {/* Permission grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '8px',
                    marginBottom: '8px',
                  }}
                >
                  {availablePerms.map((perm) => (
                    <label
                      key={perm.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        background: checkedPerms.has(perm.key) ? '#f0fdf4' : '#fff',
                        fontSize: '0.85rem',
                        transition: 'background 0.15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checkedPerms.has(perm.key)}
                        onChange={() => togglePerm(perm.key)}
                        disabled={saving}
                        style={{ accentColor: 'var(--brand-brown)' }}
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>

                {/* Select All */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px dashed var(--border)',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    background: allChecked ? '#f0fdf4' : someChecked ? '#fffbeb' : '#fff',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    transition: 'background 0.15s',
                  }}
                >
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleSelectAll}
                    disabled={saving}
                    style={{ accentColor: 'var(--brand-brown)' }}
                  />
                  Centang Semua
                </label>
              </>
            )}
          </div>

          {/* ── Action buttons ── */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              borderTop: '1px solid var(--border)',
              paddingTop: '16px',
            }}
          >
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
              className="adm-btn adm-btn-primary"
              disabled={saving}
            >
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
