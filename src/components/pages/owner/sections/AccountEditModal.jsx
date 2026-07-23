/**
 * AccountEditModal.jsx — Modal for editing a user's role and permissions.
 *
 * Read-only user info (name, email) + editable role dropdown + permission checkboxes.
 * Used by AccountsSection in the Owner dashboard.
 */

import { useState, useEffect } from 'react';
import { STAFF_ROLE_CONFIG } from '../../../../config/roles.js';

const ALL_ROLES = [
  { value: 'customer',    label: 'Customer' },
  { value: 'admin',       label: 'Super Admin' },
  { value: 'owner',       label: 'Owner' },
  { value: 'cashier',     label: 'Kasir' },
  { value: 'cs',          label: 'Customer Service' },
  { value: 'operational', label: 'Operasional' },
  { value: 'qc',          label: 'Quality Control' },
  { value: 'offline',     label: 'Offline Admin' },
];

const PERMISSION_KEYS = [
  { key: 'dashboard',            label: 'Dashboard' },
  { key: 'customer_management',  label: 'Customer Management' },
  { key: 'account_management',   label: 'Account Management' },
  { key: 'order_management',     label: 'Order Management' },
  { key: 'import_data',          label: 'Import Data' },
  { key: 'export_data',          label: 'Export Data' },
  { key: 'master_data',          label: 'Master Data' },
  { key: 'reports',              label: 'Reports' },
  { key: 'finance',              label: 'Finance' },
  { key: 'settings',             label: 'Settings' },
  { key: 'user_management',      label: 'User Management' },
  { key: 'activity_log',         label: 'Activity Log' },
];

export default function AccountEditModal({ user, permissions, onClose, onSave, saving }) {
  const [newRole, setNewRole]                 = useState(user?.role || 'customer');
  const [checkedPerms, setCheckedPerms]       = useState(new Set(permissions || []));

  useEffect(() => {
    if (user) setNewRole(user.role);
    if (permissions) setCheckedPerms(new Set(permissions));
  }, [user, permissions]);

  function togglePerm(key) {
    setCheckedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
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
              {ALL_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* ── Permissions checkboxes ── */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', fontSize: '0.9rem' }}>
              Permissions
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '8px',
              }}
            >
              {PERMISSION_KEYS.map((perm) => (
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
